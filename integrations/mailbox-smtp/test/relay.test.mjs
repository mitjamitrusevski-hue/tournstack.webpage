import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openQueue, createHandler } from '../relay.mjs';
import { buildMessage, LOGO_LINK } from '../messages.mjs';

const contact = {SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000001',Name:'Jane <Player>',Email:'player@example.com',Inquiry:'How can I organize a league?'};
const token = 'a'.repeat(64);
async function request(handler,{method='POST',url='/contact-email',authorization=`Bearer ${token}`,value=contact,body}={}) {
  const req = Readable.from([Buffer.from(body ?? JSON.stringify(value))]);
  Object.assign(req,{method,url,headers:{authorization,'content-type':'application/json'}});
  let status,result;
  await handler(req,{writeHead(s){status=s;},end(v){result=JSON.parse(v);}});
  return {status,result};
}

test('authentication, fixed sender, JSON/header validation, and durable deduplication',async () => {
  const queue = openQueue(':memory:');
  try {
    const handler = createHandler({token,queue});
    assert.equal((await request(handler,{authorization:'Bearer wrong'})).status,401);
    assert.equal((await request(handler,{value:{...contact,to:'attacker@example.com'}})).status,400);
    assert.equal((await request(handler,{value:{...contact,Email:'player@example.com\r\nBcc:bad@example.com'}})).status,400);
    assert.equal((await request(handler,{body:'x'.repeat(32769)})).status,413);
    assert.equal((await request(handler)).status,202);
    assert.equal((await request(handler)).status,202);
    assert.equal(queue.db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,2);
    assert.equal((await request(handler,{value:{...contact,Inquiry:'Changed inquiry'}})).status,409);
    const sent=[];
    await queue.drain({async sendMail(m){sent.push(m);return {accepted:[m.to]};}});
    assert.equal(sent.length,2);
    for(const m of sent) assert.deepEqual(m.from,{name:'TournStack',address:'info@tournstack.com'});
    assert.equal(sent[0].to,'info@tournstack.com');
    assert.equal(sent[0].replyTo,contact.Email);
    assert.equal(sent[0].subject,'New Contact');
    assert.equal(sent[0].text,`Name: ${contact.Name}\nEmail: ${contact.Email}\nInquiry: ${contact.Inquiry}`);
    assert.equal(sent[1].to,contact.Email);assert.equal(sent[1].replyTo,'info@tournstack.com');
    assert(sent[1].html.includes('Jane &lt;Player&gt;'));
    assert(sent[1].html.includes('cid:tournstack-logo'));
    assert.equal(new URL(LOGO_LINK).searchParams.get('utm_term'),'logo');
    assert(!/#[fF]{6}\b|#0{6}\b/.test(sent[1].html));
    assert(queue.db.prepare('SELECT payload FROM jobs').all().every(j=>j.payload===''));
    await queue.drain({async sendMail(){throw Error('Already sent');}});
    assert.equal(sent.length,2);
  } finally {queue.db.close();}
});

test('SMTP failure preserves queued content, retries only failed message and stops permanent failures',async () => {
  let time=100000;const queue=openQueue(':memory:',{now:()=>time});let failed=true;const sent=[];
  try {
    queue.enqueue(contact);
    const transport={async sendMail(m){if(m.to===contact.Email && failed) throw Object.assign(Error('Temporary'),{responseCode:451});sent.push(m);return {accepted:[m.to]};}};
    await queue.drain(transport,{error(){}});
    assert.equal(sent.length,1);
    assert.equal(queue.db.prepare("SELECT state FROM jobs WHERE kind='confirmation'").get().state,'pending');
    failed=false;time+=30000;await queue.drain(transport);
    assert.equal(sent.length,2);
    queue.enqueue({...contact,SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000002'});
    await queue.drain({async sendMail(){throw Object.assign(Error('Rejected'),{responseCode:550});}},{error(){}});
    assert.equal(queue.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE state='failed'").get().n,2);
  } finally {queue.db.close();}
});

test('recipient confirmation cap and global cap survive separate requests',() => {
  const queue=openQueue(':memory:',{maxContacts:3,maxConfirmations:1});
  try {
    for(let i=1;i<=3;i++)queue.enqueue({...contact,SubmissionId:`aaaaaaaa-bbbb-cccc-dddd-${String(i).padStart(12,'0')}`});
    assert.equal(queue.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind='notification'").get().n,3);
    assert.equal(queue.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind='confirmation'").get().n,1);
    assert.throws(()=>queue.enqueue({...contact,SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000004'}),e=>e.status===429);
  } finally {queue.db.close();}
});

test('confirmation contains no inquiry content or marketing subscription language',() => {
  const message=buildMessage('confirmation',contact);
  assert(!message.html.includes(contact.Inquiry));
  assert(message.text.includes('Hi Jane <Player>,'));
  assert(!message.html.includes('newsletter'));
});

test('queued jobs and duplicate protection survive process restart',async () => {
  const dir=mkdtempSync(join(tmpdir(),'tournstack-mail-test-'));
  let queue;
  try {
    queue=openQueue(join(dir,'queue.sqlite'));queue.enqueue(contact);queue.db.close();queue=null;
    queue=openQueue(join(dir,'queue.sqlite'));queue.enqueue(contact);
    assert.equal(queue.db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,2);
    const sent=[];await queue.drain({async sendMail(m){sent.push(m);return {accepted:[m.to]};}});
    assert.equal(sent.length,2);
  } finally {queue?.db.close();rmSync(dir,{recursive:true,force:true});}
});
