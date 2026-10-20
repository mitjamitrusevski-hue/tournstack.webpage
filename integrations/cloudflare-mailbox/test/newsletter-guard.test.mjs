import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createNewsletterActionGuard} from '../newsletter-guard.mjs';
import {newsletterPublic} from '../newsletter.mjs';
const token=n=>n.toString(16).padStart(128,'0');
function fixture(){
  const values=new Map(),f={time:Date.UTC(2026,9,20),calls:0,ok:true};
  f.storage={async get(k){if(f.brokenRead)throw Error('unavailable');return structuredClone(values.get(k));},async put(k,v){if(f.brokenWrite)throw Error('unavailable');values.set(k,structuredClone(v));}};
  f.values=values;f.create=()=>createNewsletterActionGuard({storage:f.storage,now:()=>f.time,backend:async()=>{f.calls++;if(f.wait)await f.wait;if(f.failure)throw Error('backend unavailable');return {ok:f.ok,...f.retryable?{retryable:true}:{}};}});
  f.act=f.create();return f;
}
test('concurrent duplicate confirmation reaches backend once; analytics transition returned once',async()=>{
  const f=fixture();let release;f.wait=new Promise(r=>release=r);
  const tasks=Array.from({length:20},()=>f.act('newsletter-confirm',token(1)));
  await new Promise(r=>setTimeout(r,10));assert.equal(f.calls,1);release();
  const results=await Promise.all(tasks);assert.equal(results.filter(r=>r.newlyConfirmed).length,1);
  assert.equal((await f.act('newsletter-confirm',token(1))).newlyConfirmed,false);assert.equal(f.calls,1);
  f.act=f.create();assert.equal((await f.act('newsletter-confirm',token(1))).ok,true);assert.equal(f.calls,1);
});
test('invalid/expired terminal confirmation is cached60seconds; transient failure may retry within bounds',async()=>{
  const f=fixture();f.ok=false;for(let i=0;i<20;i++)assert.equal((await f.act('newsletter-confirm',token(2))).ok,false);
  assert.equal(f.calls,1);f.time+=60001;await f.act('newsletter-confirm',token(2));assert.equal(f.calls,2);
  f.failure=true;for(let i=0;i<5;i++)await assert.rejects(f.act('newsletter-confirm',token(3)));
  await assert.rejects(f.act('newsletter-confirm',token(3)),e=>e.status===429);assert.equal(f.calls,7);
  f.failure=false;f.retryable=true;await assert.rejects(f.act('newsletter-confirm',token(4)),e=>e.status===503);
  f.retryable=false;f.ok=true;assert.equal((await f.act('newsletter-confirm',token(4))).newlyConfirmed,true);
});
test('unsubscribe remains separate, uncached and sees fresh state; per-token allowance survives restart',async()=>{
  const f=fixture();assert.equal((await f.act('newsletter-unsubscribe',token(1))).ok,true);
  f.ok=false;assert.equal((await f.act('newsletter-unsubscribe',token(1))).ok,false);assert.equal(f.calls,2);
  for(let i=0;i<3;i++)await f.act('newsletter-unsubscribe',token(1));
  f.act=f.create();await assert.rejects(f.act('newsletter-unsubscribe',token(1)),e=>e.status===429);
  f.time+=60000;f.ok=true;assert.equal((await f.act('newsletter-unsubscribe',token(1))).ok,true);
});
test('parallel distinct requests obey shared purpose caps; rollover and request cleanup bound state',async()=>{
  const f=fixture();const results=await Promise.allSettled(Array.from({length:80},(_,i)=>f.act('newsletter-confirm',token(i+1))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,60);assert.equal(f.calls,60);
  assert.equal((await f.act('newsletter-unsubscribe',token(999))).ok,true);
  for(let minute=1;minute<=5;minute++){f.time+=60001;for(let i=0;i<60;i++)await f.act('newsletter-confirm',token(1000+minute*100+i));}
  const saved=[...f.values.values()][0];assert(Object.keys(saved.tokens).length<=120);assert(!JSON.stringify(saved).includes(token(999)));
});
test('bad storage and malformed state fail closed with no backend action',async()=>{
  for(const fault of ['brokenRead','brokenWrite']){const f=fixture();f[fault]=true;await assert.rejects(f.act('newsletter-confirm',token(1)));assert.equal(f.calls,0);}
  const f=fixture();f.values.set('newsletter-public-allowance-v1',{v:2});await assert.rejects(f.act('newsletter-confirm',token(1)));assert.equal(f.calls,0);
});
test('daily bounds are independent by purpose and reset at UTC midnight',async()=>{
  const f=fixture();
  for(let i=0;i<1000;i++){if(i&&i%60===0)f.time+=60001;await f.act('newsletter-confirm',token(10000+i));}
  f.time+=60001;await assert.rejects(f.act('newsletter-confirm',token(99999)),e=>e.status===429&&e.retryAfter>60);
  assert.equal((await f.act('newsletter-unsubscribe',token(99999))).ok,true);
  f.time=Date.UTC(2026,9,21);assert.equal((await f.act('newsletter-confirm',token(99999))).ok,true);
});
test('HTTP guard failure returns truthful private retry page and never directly falls back to backend',async()=>{
  const secret='local-fixture-'.repeat(5),random='a'.repeat(64),signed=random+createHmac('sha256',secret).update('confirm:'+random).digest('hex');
  const env={MAIL_RELAY_TOKEN:secret};const req=()=>new Request('https://tournstack-mailbox.tournstack.workers.dev/newsletter/confirm',{method:'POST',headers:{Origin:'https://tournstack-mailbox.tournstack.workers.dev'},body:new URLSearchParams({token:signed})});
  assert.equal((await newsletterPublic(req(),env)).status,503);
  env.CONTACT_QUEUE={idFromName:v=>v,get:()=>({publicNewsletterAction:async()=>({error:true,status:429})})};
  const denied=await newsletterPublic(req(),env);assert.equal(denied.status,429);assert.equal(denied.headers.get('Retry-After'),'60');assert.equal(denied.headers.get('Cache-Control'),'no-store');assert.match(await denied.text(),/same link/);
});
test('cached confirmation after unsubscribe describes a past action without claiming current subscription',async()=>{
  const secret='private-cache-fixture-'.repeat(3),values=new Map();let state='pending',calls=0;
  const signed=purpose=>{const random=(purpose==='confirm'?'a':'b').repeat(64);return random+createHmac('sha256',secret).update(purpose+':'+random).digest('hex');};
  const guard=createNewsletterActionGuard({
    storage:{async get(k){return structuredClone(values.get(k));},async put(k,v){values.set(k,structuredClone(v));}},
    backend:async action=>{calls++;if(action==='newsletter-unsubscribe'){state='inactive';return {ok:true};}if(state==='pending'){state='active';return {ok:true};}return {ok:false};}
  });
  const env={MAIL_RELAY_TOKEN:secret,CONTACT_QUEUE:{idFromName:v=>v,get:()=>({publicNewsletterAction:guard})}};
  const request=purpose=>new Request('https://tournstack-mailbox.tournstack.workers.dev/newsletter/'+purpose,{method:'POST',headers:{Origin:'https://tournstack-mailbox.tournstack.workers.dev'},body:new URLSearchParams({token:signed(purpose)})});
  const first=await newsletterPublic(request('confirm'),env);assert.match(await first.text(),/You’re on the list/);
  const unsubscribed=await newsletterPublic(request('unsubscribe'),env);assert.match(await unsubscribed.text(),/You’re unsubscribed/);
  const replay=await newsletterPublic(request('confirm'),env),html=await replay.text();
  assert.equal(state,'inactive');assert.equal(calls,2);assert.equal(replay.status,200);
  assert.match(html,/Confirmation already processed/);assert.match(html,/does not change a later unsubscribe request/);
  assert.doesNotMatch(html,/You’re on the list|We’ll email you/);
  assert.equal(replay.headers.get('Cache-Control'),'no-store');assert.equal(replay.headers.get('X-Robots-Tag'),'noindex, nofollow');
});
