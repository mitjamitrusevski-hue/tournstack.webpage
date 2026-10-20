import { DurableObject } from 'cloudflare:workers';
import { connect } from 'cloudflare:sockets';
import { handleRequest } from './http.mjs';
import { queueStore, validateContact } from './queue.mjs';
import { makeMIME } from './mime.mjs';
import { mailboxSMTP } from './smtp.mjs';
import { validateNewsletter, newsletterBackend } from './newsletter.mjs';
import { createNewsletterActionGuard } from './newsletter-guard.mjs';

export default {fetch:handleRequest};
export class ContactMailQueue extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    const cap=(v,n)=>{const i=Number(v??n);if(!Number.isSafeInteger(i)||i<1)throw Error('Invalid operational cap.');return i;};
    this.queue=queueStore(ctx.storage.sql,fn=>ctx.storage.transactionSync(fn),{
      maxContacts:cap(env.MAX_CONTACTS_PER_DAY,100),maxConfirmations:cap(env.MAX_CONFIRMATIONS_PER_ADDRESS_PER_DAY,3)
    });
    this.newsletterAction=createNewsletterActionGuard({storage:ctx.storage,backend:(action,token)=>newsletterBackend(env,action,token)});
  }
  async publicNewsletterAction(action,token){
    try{return await this.newsletterAction(action,token);}
    catch(e){return {error:true,status:e.status===429?429:503,retryAfter:e.status===429?e.retryAfter:undefined};}
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
  async enqueueNewsletter(value){
    try{
      this.queue.purge();
      const message=validateNewsletter(value);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(message))))).map(b=>b.toString(16).padStart(2,'0')).join('');
      this.queue.enqueueNewsletter(message,hash);
      if(!await this.ctx.storage.get('newsletter-cleanup-next'))await this.ctx.storage.put('newsletter-cleanup-next',Date.now()+86400000);
      const next=this.queue.nextAlarm(),current=await this.ctx.storage.getAlarm();
      if(next!==null && (current===null || current>next))await this.ctx.storage.setAlarm(next);
      return {status:202};
    }catch(e){return {status:e.status||503};}
  }
  async verifySMTP(){await mailboxSMTP(connect,{user:this.env.SMTP_USER,password:this.env.SMTP_PASSWORD});}
  async alarm(){
    this.queue.purge();
    let cleanup=await this.ctx.storage.get('newsletter-cleanup-next');
    if(cleanup && cleanup<=Date.now()){
      try{const result=await newsletterBackend(this.env,'newsletter-cleanup');if(!result.ok)throw Error('Cleanup rejected');cleanup=Date.now()+86400000;}
      catch{cleanup=Date.now()+3600000;console.error(JSON.stringify({event:'newsletter-cleanup-retry'}));}
      await this.ctx.storage.put('newsletter-cleanup-next',cleanup);
    }
    for(let i=0;i<2;i++){
      const job=this.queue.claim();if(!job)break;
      // Persist recovery wake before network I/O in case the isolate stops mid-send.
      await this.ctx.storage.setAlarm(Date.now()+45000);
      try{
        await mailboxSMTP(connect,{user:this.env.SMTP_USER,password:this.env.SMTP_PASSWORD},makeMIME(job.kind,JSON.parse(job.payload)));
        this.queue.success(job);
      }catch(e){const state=this.queue.failure(job,e);console.error(JSON.stringify({event:'smtp-job-failed',kind:job.kind,state,attempts:job.attempts}));}
    }
    const next=[this.queue.nextAlarm(),cleanup||null].filter(v=>v!==null).sort((a,b)=>a-b)[0]??null;
    if(next===null)await this.ctx.storage.deleteAlarm();else await this.ctx.storage.setAlarm(next);
  }
}
