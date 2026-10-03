import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { makeMIME } from '../mime.mjs';
import { mailboxSMTP } from '../smtp.mjs';
import { queueStore, validateContact, retention } from '../queue.mjs';
import { handleRequest } from '../http.mjs';

const c={SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000001',Name:'Jane <Player>',Email:'player@example.com',Inquiry:'Please help with a league.'};
function queue(options={}){
  const db=new DatabaseSync(':memory:');
  const sql={exec(q,...args){const s=db.prepare(q);const result=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>result};}};
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
  return {db,store:queueStore(sql,transaction,options)};
}
function smtpMock(response,{hang=false}={}){
  const writes=[],encoder=new TextEncoder();let controller,closed=false;
  const socket={opened:Promise.resolve({}),closed:Promise.resolve(),
    readable:new ReadableStream({start(value){controller=value;for(let i=0;i<response.length;i+=7)controller.enqueue(encoder.encode(response.slice(i,i+7)));if(!hang){controller.close();closed=true;}}}),
    writable:new WritableStream({write(v){writes.push(new TextDecoder().decode(v));}}),
    async close(){if(!closed){controller.close();closed=true;}}};
  return {writes,connect(address,options){assert.deepEqual(address,{hostname:'smtp.mailbox.org',port:465});assert.equal(options.secureTransport,'on');return socket;}};
}

test('SMTP authenticates over TLS, sends fixed sender, parses fragmented multiline replies and dot-stuffs DATA',async()=>{
  const fake=smtpMock('220 Ready\r\n250-mailbox\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 50000\r\n235 Authenticated\r\n250 Sender\r\n250 Recipient\r\n354 Data\r\n250 Queued\r\n221 Bye\r\n');
  const message={from:'info@tournstack.com',to:c.Email,raw:'Subject: Test\r\n\r\n.Hello\r\n'};
  assert((await mailboxSMTP(fake.connect,{user:'info@tournstack.com',password:'test-password'},message)).accepted);
  assert(fake.writes.includes('MAIL FROM:<info@tournstack.com>\r\n'));
  assert(fake.writes.some(v=>v.includes('\r\n..Hello\r\n.\r\n')));
});
test('SMTP LOGIN fallback, auth-only verification and permanent rejection',async()=>{
  const fake=smtpMock('220 Ready\r\n250 AUTH LOGIN\r\n334 Username\r\n334 Password\r\n235 Authenticated\r\n221 Bye\r\n');
  await mailboxSMTP(fake.connect,{user:'info@tournstack.com',password:'test-password'});
  assert(fake.writes.includes('AUTH LOGIN\r\n'));assert(!fake.writes.some(v=>v.startsWith('MAIL FROM')));
  const failed=smtpMock('220 Ready\r\n250 AUTH PLAIN\r\n535 Rejected\r\n');
  await assert.rejects(()=>mailboxSMTP(failed.connect,{user:'info@tournstack.com',password:'test-password'}),e=>e.responseCode===535 && !e.message.includes('test-password'));
});
test('SMTP timeout fails before acceptance but a missing QUIT reply does not resend accepted mail',async()=>{
  const stalled=smtpMock('220 Ready\r\n',{hang:true});
  await assert.rejects(()=>mailboxSMTP(stalled.connect,{user:'info@tournstack.com',password:'test-password'},null,20),/timeout/);
  const accepted=smtpMock('220 Ready\r\n250 AUTH PLAIN\r\n235 OK\r\n250 OK\r\n250 OK\r\n354 Data\r\n250 Queued\r\n',{hang:true});
  assert((await mailboxSMTP(accepted.connect,{user:'info@tournstack.com',password:'test-password'},makeMIME('notification',c),20)).accepted);
});
test('MIME includes branded inline logo, personalized escaped text and correct sender/reply destinations',()=>{
  const m=makeMIME('confirmation',c);
  assert(m.raw.includes('From: TournStack <info@tournstack.com>'));
  assert(m.raw.includes('Reply-To: info@tournstack.com'));
  assert(m.raw.includes('Content-ID: <tournstack-logo>'));assert(m.raw.includes('Content-Type: image/png'));
  assert(m.raw.includes('multipart/alternative'));
  const parts=m.raw.split('Content-Transfer-Encoding: base64\r\n\r\n').slice(1).map(p=>Buffer.from(p.split('\r\n--')[0].replace(/\r\n/g,''),'base64').toString('utf8'));
  assert(parts.some(p=>p.includes('Jane &lt;Player&gt;')));
  assert(parts.some(p=>p.includes('utm_campaign=contact-confirmation')));
  assert(!parts.some(p=>p.includes(c.Inquiry)));
});
test('durable queue deduplicates, leases, retries, clears sent content, enforces caps and purges retention',()=>{
  let time=100000;const {store,db}=queue({now:()=>time,maxContacts:2,maxConfirmations:1});
  try{
    const contact=validateContact(c);store.enqueue(contact,'hash');store.enqueue(contact,'hash');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,2);
    assert.throws(()=>store.enqueue(contact,'changed'),e=>e.status===409);
    const first=store.claim();assert.equal(first.attempts,1);store.success(first);
    const second=store.claim();assert.equal(store.failure(second,{responseCode:451}),'pending');
    assert.equal(store.claim(),null);time+=30000;const retry=store.claim();assert.equal(retry.attempts,2);store.success(retry);
    store.enqueue({...contact,SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000002'},'second');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind='confirmation'").get().n,1);
    assert.throws(()=>store.enqueue({...contact,SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000003'},'third'),e=>e.status===429);
    const lease=store.claim();assert(lease);assert.equal(store.claim(),null);
    time+=45000;const recovered=store.claim();assert.equal(recovered.id,lease.id);assert.equal(recovered.attempts,2);
    assert.equal(store.failure(recovered,{responseCode:550}),'failed');
    assert(db.prepare("SELECT payload FROM jobs WHERE state='sent'").all().every(r=>r.payload===''));
    time+=retention+1;store.purge();assert.deepEqual(store.stats(),{});assert.equal(store.nextAlarm(),null);
  }finally{db.close();}
});
test('Worker authentication, limited payload, unknown recipient override rejection and private health stats',async()=>{
  const {store,db}=queue();const env={MAIL_RELAY_TOKEN:'a'.repeat(64),SMTP_USER:'info@tournstack.com',SMTP_PASSWORD:'test-password',CONTACT_QUEUE:{idFromName:v=>v,get:()=>({
    async enqueue(v){try{const contact=validateContact(v);store.enqueue(contact,JSON.stringify(contact));return {status:202};}catch(e){return {status:e.status};}},stats:async()=>store.stats(),verifySMTP:async()=>{}})}};
  const req=(path,value=c,token=env.MAIL_RELAY_TOKEN)=>new Request('https://relay.example'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(value)});
  try{
    assert.equal((await handleRequest(req('/contact-email',c,'wrong'),env)).status,401);
    assert.equal((await handleRequest(req('/contact-email',{...c,to:'attacker@example.com'}),env)).status,400);
    assert.equal((await handleRequest(req('/contact-email',{...c,Email:'player@example.com\r\nBcc: attacker@example.com'}),env)).status,400);
    assert.equal((await handleRequest(req('/contact-email'),env)).status,202);
    const response=await handleRequest(new Request('https://relay.example/health',{headers:{Authorization:'Bearer '+env.MAIL_RELAY_TOKEN}}),env);
    assert.equal(response.status,200);const health=await response.json();assert.equal(health.queue.pending,2);
    assert(!JSON.stringify(health).includes(c.Email));
    assert.equal((await handleRequest(req('/contact-email',{...c,Inquiry:'a'.repeat(40000)}),env)).status,413);
  }finally{db.close();}
});
