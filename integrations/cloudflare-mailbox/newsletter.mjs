import { reject } from './queue.mjs';

export const NEWSLETTER_ORIGIN='https://tournstack-mailbox.tournstack.workers.dev';
export function validateNewsletter(value){
  const already=value?.MessageKind==='already-subscribed';
  const unsubscribe=value?.MessageKind==='unsubscribe-link';
  const keys=already?['SubmissionId','Email','MessageKind']:unsubscribe?['SubmissionId','Email','MessageKind','UnsubscribeURL']:['SubmissionId','Email','VerificationURL','UnsubscribeURL'];
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k)) || keys.some(k=>typeof value[k]!=='string'))throw reject(400);
  const m=Object.fromEntries(keys.map(k=>[k,value[k].trim()]));
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(m.SubmissionId) || m.Email.length>254 || !/^[\x21-\x7e]+$/.test(m.Email) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.Email))throw reject(400);
  if(already)return m;
  for(const [key,pathname] of [['VerificationURL','/newsletter/confirm'],['UnsubscribeURL','/newsletter/unsubscribe']]){
    if(unsubscribe && key==='VerificationURL')continue;
    let u;try{u=new URL(m[key]);}catch{throw reject(400);}
    if(u.origin!==NEWSLETTER_ORIGIN || u.pathname!==pathname || u.searchParams.size!==1 || !/^[a-f0-9]{128}$/.test(u.searchParams.get('token')||'') || u.hash || u.username || u.password)throw reject(400);
  }
  return m;
}

async function validPublicToken(token,purpose,secret){
  if(typeof token!=='string'||token.length!==128||!/^[a-f0-9]{128}$/.test(token) || !secret || secret.length<32)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(purpose+':'+token.slice(0,64))));
  const actual=Uint8Array.from(token.slice(64).match(/../g),hex=>parseInt(hex,16));
  let difference=0;for(let i=0;i<bytes.length;i++)difference|=bytes[i]^actual[i];return difference===0;
}

// Only the Worker and Apps Script know the relay key. No email address is put in a URL.
export async function newsletterBackend(env,action,token=''){
  const endpoint=env.NEWSLETTER_BACKEND_URL;
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint||''))throw Error('Newsletter backend unavailable.');
  const timestamp=String(Date.now()),data=[action,token,timestamp].join('\n');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MAIL_RELAY_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const r=await fetch(endpoint,{method:'POST',body:new URLSearchParams({Action:action,Token:token,Timestamp:timestamp,Signature:signature}),signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error('Newsletter backend request failed.');
  const result=await r.json();if(typeof result.ok!=='boolean')throw Error('Newsletter backend response invalid.');return result;
}

function page(title,text,{token='',action='',button='',status=200,retryAfter}={}){
  const form=token?`<form method="post" action="${action}"><input type="hidden" name="token" value="${token}"><button type="submit">${button}</button></form>`:'';
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${title} — TournStack</title><style>body{margin:0;background:#EEF2F7;color:#0F172A;font:17px/1.65 Arial,sans-serif}main{max-width:560px;margin:8vh auto;padding:32px;background:#F8FAFC;border-radius:16px}h1{font-size:28px;line-height:1.25}button{font:inherit;background:#1855CC;color:#F8FAFC;border:0;border-radius:8px;padding:14px 20px;cursor:pointer}a{color:#1855CC}button:focus-visible,a:focus-visible{outline:3px solid #1855CC;outline-offset:4px}@media(max-width:620px){main{margin:24px 16px;padding:24px}}</style></head><body><main><p><strong>TournStack</strong></p><h1>${title}</h1><p>${text}</p>${form}<p><a href="https://tournstack.com/">Back to TournStack</a> · <a href="https://tournstack.com/privacy.html#newsletter">Privacy</a></p></main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',...(retryAfter?{'Retry-After':String(retryAfter)}:{}),'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}

// A confirmation is recorded only after the backend's one-use state transition.
// Never forward the private request URL, token, email, referrer or form body.
export async function recordConfirmation(request){
  const ip=request.headers.get('CF-Connecting-IP'),agent=request.headers.get('User-Agent');
  if(!ip || !agent || request.headers.get('DNT')==='1' || request.headers.get('Sec-GPC')==='1')return;
  try{
    const response=await fetch('https://plausible.io/api/event',{
      method:'POST',headers:{'Content-Type':'application/json','User-Agent':agent,'X-Forwarded-For':ip},
      body:JSON.stringify({name:'Newsletter Subscription Confirmed',domain:'tournstack.com',url:'https://tournstack.com/newsletter-confirmed'}),
      signal:AbortSignal.timeout(4000)
    });
    if(!response.ok || response.headers.get('x-plausible-dropped')==='1')console.warn('Newsletter confirmation analytics not recorded.');
  }catch{console.warn('Newsletter confirmation analytics unavailable.');}
}

export async function newsletterPublic(request,env,ctx){
  const url=new URL(request.url),confirm=url.pathname==='/newsletter/confirm';
  if(!confirm && url.pathname!=='/newsletter/unsubscribe')return null;
  if(request.method==='GET'){
    const token=url.searchParams.get('token')||'';
    if(!await validPublicToken(token,confirm?'confirm':'unsubscribe',env.MAIL_RELAY_TOKEN))return page('This link is incomplete or invalid.','Please use the full link in your email.');
    return page(confirm?'Ready for a little TournStack news?':'Unsubscribe from TournStack news?',confirm?'Confirm that you’d like TournStack news when our newsletter launches. You can unsubscribe anytime.':'Confirm below to cancel your signup or unsubscribe.',{token,action:url.pathname,button:confirm?'Confirm subscription':'Unsubscribe'});
  }
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'GET, POST','Cache-Control':'no-store'}});
  const origin=request.headers.get('Origin');
  // Native forms with no-referrer can send Origin: null. Only accept that
  // browser case when Fetch Metadata identifies a same-origin submission.
  const sameOriginOpaque=origin==='null' && request.headers.get('Sec-Fetch-Site')==='same-origin';
  if(origin && origin!==url.origin && !sameOriginOpaque)return new Response('Request rejected.',{status:403});
  if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('Content-Type')||''))return new Response('Request rejected.',{status:415});
  const reader=request.body?.getReader();if(!reader)return new Response('Request rejected.',{status:400});
  let raw='',length=0;const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>256){await reader.cancel();return new Response('Request too large.',{status:413});}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();
  const token=new URLSearchParams(raw).get('token')||'';
  if(!await validPublicToken(token,confirm?'confirm':'unsubscribe',env.MAIL_RELAY_TOKEN))return page('This link is incomplete or invalid.','Please use the full link in your email.');
  try{
    if(!env.CONTACT_QUEUE)throw Error('Newsletter guard unavailable.');
    const queue=env.CONTACT_QUEUE.get(env.CONTACT_QUEUE.idFromName('tournstack-contact-mail-v1'));
    const result=await queue.publicNewsletterAction(confirm?'newsletter-confirm':'newsletter-unsubscribe',token);
    if(result?.error){
      const limited=result.status===429;
      const retryAfter=Number.isSafeInteger(result.retryAfter)&&result.retryAfter>0&&result.retryAfter<=86400?result.retryAfter:60;
      const wait=retryAfter>60?'The service has reached its daily request allowance. Please use the same link after the next midnight UTC, or email info@tournstack.com.':'This link has received several requests. Please wait one minute, then use the same link again.';
      return page(limited?'Please try again later.':'Please try again shortly.',limited?wait:'We could not check that update. Please use the same link again shortly, or email info@tournstack.com.',{status:limited?429:503,retryAfter:limited?retryAfter:undefined});
    }
    if(typeof result?.ok!=='boolean')throw Error('Newsletter guard response invalid.');
    if(!result.ok)return page('This link has expired or was already used.','You can request a fresh signup link from the TournStack website.');
    if(confirm&&result.newlyConfirmed===true){
      const recording=recordConfirmation(request);
      if(ctx?.waitUntil)ctx.waitUntil(recording);else await recording;
    }
    if(confirm&&result.newlyConfirmed!==true){
      // A cached/concurrent receipt proves a past confirmation, not the current
      // subscription state: the visitor may since have unsubscribed.
      return page('Confirmation already processed.','This confirmation was completed earlier. It does not change a later unsubscribe request. To subscribe again, use the newsletter form on the TournStack website.');
    }
    return page(confirm?'You’re on the list.':'You’re unsubscribed.',confirm?'Thanks for joining us. We’ll email you when our newsletter is ready.':'Your newsletter subscription is inactive. You won’t receive our newsletter.');
  }catch{return page('Please try again shortly.','We couldn’t confirm that update. Please try this link again or email info@tournstack.com.',{status:503});}
}
