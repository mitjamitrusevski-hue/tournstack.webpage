// Bounded short-lived abuse metadata; never persist a raw token or address.
export const NEWSLETTER_ACTION_LIMITS=Object.freeze({perPurposePerMinute:60,perPurposePerDay:1000,perTokenPerMinute:5,maxEntries:256,confirmationCacheMs:60000});
const KEY='newsletter-public-allowance-v1';
const limited=(retryAfter=60)=>Object.assign(new Error('Newsletter action temporarily limited.'),{status:429,retryAfter});
const unavailable=()=>Object.assign(new Error('Newsletter action unavailable.'),{status:503});
const integer=v=>Number.isSafeInteger(v)&&v>=0;

function currentState(value,time){
  const minute=Math.floor(time/60000),day=Math.floor(time/86400000),s=value??{v:1,minute,day,confirm:0,unsubscribe:0,confirmDay:0,unsubscribeDay:0,tokens:{}};
  if(s.v!==1||!integer(s.minute)||s.minute>minute||!integer(s.day)||s.day>day||!integer(s.confirm)||!integer(s.unsubscribe)||
    !integer(s.confirmDay)||!integer(s.unsubscribeDay)||s.confirmDay>1000||s.unsubscribeDay>1000||
    s.confirm>60||s.unsubscribe>60||!s.tokens||typeof s.tokens!=='object'||Array.isArray(s.tokens)||
    Object.keys(s.tokens).length>NEWSLETTER_ACTION_LIMITS.maxEntries)throw unavailable();
  for(const [key,t] of Object.entries(s.tokens)){
    if(!/^(confirm|unsubscribe):[a-f0-9]{64}$/.test(key)||!t||!integer(t.minute)||t.minute>minute||
      !integer(t.attempts)||t.attempts>5||!integer(t.until)||typeof t.ok!=='boolean')throw unavailable();
    if(t.minute<minute&&t.until<=time)delete s.tokens[key];
  }
  if(s.minute!==minute){s.minute=minute;s.confirm=0;s.unsubscribe=0;}
  if(s.day!==day){s.day=day;s.confirmDay=0;s.unsubscribeDay=0;}
  return s;
}

export function createNewsletterActionGuard({storage,backend,now=Date.now}){
  let queue=Promise.resolve();const pending=new Map();
  const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
  return async function act(action,token){
    const purpose=action==='newsletter-confirm'?'confirm':action==='newsletter-unsubscribe'?'unsubscribe':null;
    if(!purpose||typeof token!=='string'||token.length!==128||!/^[a-f0-9]{128}$/.test(token))throw unavailable();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const key=purpose+':'+digest;
    if(pending.has(key)){const result=await pending.get(key);return {...result,newlyConfirmed:false};}
    if(pending.size>=NEWSLETTER_ACTION_LIMITS.maxEntries)throw limited();
    const task=(async()=>{
      const admission=await serial(async()=>{
        const time=now(),s=currentState(await storage.get(KEY),time),minute=Math.floor(time/60000);
        const prior=s.tokens[key];
        if(purpose==='confirm'&&prior?.until>time)return {cached:true,ok:prior.ok};
        if(s[purpose+'Day']>=NEWSLETTER_ACTION_LIMITS.perPurposePerDay)throw limited(Math.ceil(((Math.floor(time/86400000)+1)*86400000-time)/1000));
        if(s[purpose]>=NEWSLETTER_ACTION_LIMITS.perPurposePerMinute||
          prior?.minute===minute&&prior.attempts>=NEWSLETTER_ACTION_LIMITS.perTokenPerMinute||
          !prior&&Object.keys(s.tokens).length>=NEWSLETTER_ACTION_LIMITS.maxEntries)throw limited();
        s[purpose]++;s[purpose+'Day']++;
        s.tokens[key]={minute,attempts:prior?.minute===minute?prior.attempts+1:1,until:0,ok:false};
        await storage.put(KEY,s);
        return {cached:false};
      });
      if(admission.cached)return {ok:admission.ok,newlyConfirmed:false};
      const result=await backend(action,token);
      if(typeof result?.ok!=='boolean'||result.retryable===true)throw unavailable();
      if(purpose==='confirm')await serial(async()=>{
        const time=now(),s=currentState(await storage.get(KEY),time);
        // Network duration may cross a minute boundary. Keep only this bounded
        // terminal receipt; a failed persistence cannot cause another transition.
        if(!s.tokens[key]&&Object.keys(s.tokens).length>=NEWSLETTER_ACTION_LIMITS.maxEntries)return;
        s.tokens[key]??={minute:Math.floor(time/60000),attempts:0,until:0,ok:false};
        s.tokens[key].until=time+NEWSLETTER_ACTION_LIMITS.confirmationCacheMs;s.tokens[key].ok=result.ok;
        await storage.put(KEY,s);
      });
      // Never cache completed unsubscribe: a subsequent real subscription state
      // must always be checked, within the separate unsubscribe allowance.
      return {ok:result.ok,newlyConfirmed:purpose==='confirm'&&result.ok};
    })();
    pending.set(key,task);
    try{return await task;}finally{pending.delete(key);}
  };
}
