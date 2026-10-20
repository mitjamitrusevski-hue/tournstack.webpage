import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { newsletterPublic, newsletterBackend } from '../newsletter.mjs';

test('confirmation analytics follows a new saved confirmation, never link views, reused tokens or unsubscribe', async () => {
  const env={MAIL_RELAY_TOKEN:'a'.repeat(64),NEWSLETTER_BACKEND_URL:'https://script.google.com/macros/s/test/exec'};
  env.CONTACT_QUEUE={idFromName:v=>v,get:()=>({publicNewsletterAction:async(action,token)=>{const result=await newsletterBackend(env,action,token);return {...result,newlyConfirmed:action==='newsletter-confirm'&&result.ok};}})};
  const makeToken=purpose=>'b'.repeat(64)+createHmac('sha256',env.MAIL_RELAY_TOKEN).update(purpose+':'+'b'.repeat(64)).digest('hex');
  const original=globalThis.fetch,events=[];let saved=true,failAnalytics=false;
  globalThis.fetch=async (url,options)=>{
    if(url===env.NEWSLETTER_BACKEND_URL)return Response.json({ok:saved});
    assert.equal(url,'https://plausible.io/api/event');events.push(options);
    if(failAnalytics)throw Error('Local simulated outage');
    return new Response(null,{status:202});
  };
  const headers={'User-Agent':'Local browser fixture','CF-Connecting-IP':'192.0.2.10'};
  const post=(purpose='confirm',extra={})=>new Request('https://tournstack-mailbox.tournstack.workers.dev/newsletter/'+purpose,{method:'POST',headers:{...headers,...extra},body:new URLSearchParams({token:makeToken(purpose)})});
  try {
    await newsletterPublic(new Request('https://tournstack-mailbox.tournstack.workers.dev/newsletter/confirm?token='+makeToken('confirm'),{headers}),env);
    assert.equal(events.length,0);
    const tasks=[];const response=await newsletterPublic(post(),env,{waitUntil:p=>tasks.push(p)});await Promise.all(tasks);
    assert.match(await response.text(),/on the list/);assert.equal(events.length,1);
    const event=JSON.parse(events[0].body);
    assert.deepEqual(event,{name:'Newsletter Subscription Confirmed',domain:'tournstack.com',url:'https://tournstack.com/newsletter-confirmed'});
    assert.equal(events[0].headers['X-Forwarded-For'],'192.0.2.10');
    assert(!events[0].body.includes(makeToken('confirm')));
    saved=false;await newsletterPublic(post(),env);assert.equal(events.length,1);
    saved=true;await newsletterPublic(post('unsubscribe'),env);assert.equal(events.length,1);
    await newsletterPublic(post('confirm',{'DNT':'1'}),env);assert.equal(events.length,1);
    await newsletterPublic(post('confirm',{'Sec-GPC':'1'}),env);assert.equal(events.length,1);
    await newsletterPublic(post('confirm',{'CF-Connecting-IP':''}),env);assert.equal(events.length,1);
    failAnalytics=true;assert.match(await (await newsletterPublic(post(),env)).text(),/on the list/);assert.equal(events.length,2);
  } finally {globalThis.fetch=original;}
});
