import { DurableObject } from 'cloudflare:workers';
import { connect } from 'cloudflare:sockets';
import { handleRequest } from './http.mjs';
import { queueStore, validateContact } from './queue.mjs';
import { makeMIME } from './mime.mjs';
import { mailboxSMTP } from './smtp.mjs';

export default {fetch:handleRequest};
export class ContactMailQueue extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    const cap=(v,n)=>{const i=Number(v??n);if(!Number.isSafeInteger(i)||i<1)throw Error('Invalid operational cap.');return i;};
    this.queue=queueStore(ctx.storage.sql,fn=>ctx.storage.transactionSync(fn),{
      maxContacts:cap(env.MAX_CONTACTS_PER_DAY,100),maxConfirmations:cap(env.MAX_CONFIRMATIONS_PER_ADDRESS_PER_DAY,3)
    });
  }
  async enqueue(value){
    try {
      this.queue.purge();
      const contact=validateContact(value);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(contact))))).map(b=>b.toString(16).padStart(2,'0')).join('');
      this.queue.enqueue(contact,hash);
      const next=this.queue.nextAlarm(),current=await this.ctx.storage.getAlarm();
      if(next!==null && (current===null || current>next))await this.ctx.storage.setAlarm(next);
      return {status:202};
    } catch(e){return {status:e.status || 503};}
  }
  async stats(){return this.queue.stats();}
  async verifySMTP(){await mailboxSMTP(connect,{user:this.env.SMTP_USER,password:this.env.SMTP_PASSWORD});}
  async alarm(){
    this.queue.purge();
    for(let i=0;i<2;i++){
      const job=this.queue.claim();if(!job)break;
      // Persist recovery wake before network I/O in case the isolate stops mid-send.
      await this.ctx.storage.setAlarm(Date.now()+45000);
      try{
        await mailboxSMTP(connect,{user:this.env.SMTP_USER,password:this.env.SMTP_PASSWORD},makeMIME(job.kind,JSON.parse(job.payload)));
        this.queue.success(job);
      }catch(e){const state=this.queue.failure(job,e);console.error(JSON.stringify({event:'smtp-job-failed',kind:job.kind,state,attempts:job.attempts}));}
    }
    const next=this.queue.nextAlarm();
    if(next===null)await this.ctx.storage.deleteAlarm();else await this.ctx.storage.setAlarm(next);
  }
}
