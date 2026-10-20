// Isolated Sheet/service fixtures only; no live form, subscriber or email access.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=['Code.gs','Newsletter.gs'].map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('\n');
function fixture({inactive=false}={}){
  const secret='local-transition-fixture-'.repeat(3),confirm='a'.repeat(128),unsubscribe='b'.repeat(128);
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const f={time:Date.UTC(2026,9,20),locked:false,writes:[],fault:null,readbackBroken:false};
  const started=new Date(f.time-1000);
  f.row=['=literal@example.invalid','pending',started,'','newsletter-2026-10-14','https://tournstack.com/#newsletter-signup',hash(confirm),new Date(f.time+86400000),hash(unsubscribe),started,'fixture-mail-id','Email me TournStack news. Unsubscribe anytime.',inactive?'inactive':'',inactive?started:''];
  const sheet={getLastRow:()=>2,getRange(r,c,n=1,m=1){
    assert.equal(r,2);const range={
      getValues(){if(f.readbackBroken)throw Error('read unavailable');return [structuredClone(f.row.slice(c-1,c-1+m))];},
      setValues(values){
        assert.equal(f.locked,true);f.writes.push({column:c,width:m});
        if(f.fault==='before-write'){f.fault=null;throw Error('write not accepted');}
        for(let j=0;j<m;j++)f.row[c+j-1]=values[0][j];
        if(f.fault==='after-write'){f.fault=null;throw Error('response lost after commit');}
        return range;
      },
      setNumberFormat(){if(f.fault==='format')throw Error('format unavailable');return range;}
    };return range;
  }};
  const context={console:{error(){}},Date:class extends Date{constructor(...args){super(...(args.length?args:[f.time]));}static now(){return f.time;}},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>secret})},
    LockService:{getScriptLock:()=>({waitLock(){assert.equal(f.locked,false);f.locked=true;},hasLock:()=>f.locked,releaseLock(){f.locked=false;}})},
    Utilities:{Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,value)=>[...crypto.createHash('sha256').update(value).digest()],computeHmacSha256Signature:(value,key)=>[...crypto.createHmac('sha256',key).update(value).digest()]},
    SpreadsheetApp:{flush(){if(f.fault==='flush'){f.fault=null;throw Error('flush acknowledgement lost');}}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}
  };
  vm.createContext(context);vm.runInContext(source,context);
  context.newsletterSheet_=()=>sheet;context.cleanupNewsletter_=()=>{};
  f.run=action=>{
    const Action=action==='confirm'?'newsletter-confirm':'newsletter-unsubscribe',Token=action==='confirm'?confirm:unsubscribe,Timestamp=String(f.time);
    const Signature=crypto.createHmac('sha256',secret).update([Action,Token,Timestamp].join('\n')).digest('hex');
    return context.newsletterAction_({Action,Token,Timestamp,Signature});
  };
  return f;
}
test('confirmation commits its complete transition once and preserves literal email and unrelated fields',()=>{
  const f=fixture({inactive:true}),before=structuredClone(f.row);
  assert.equal(f.run('confirm').ok,true);assert.equal(f.row[1],'confirmed');assert.equal(f.row[12],'active');
  assert.equal(+f.row[3],f.time);assert.equal(+f.row[13],f.time);assert.equal(f.row[6],'');assert.equal(f.row[7],'');
  for(const column of [0,2,4,5,8,9,10,11])assert.deepEqual(f.row[column],before[column]);
  assert.deepEqual(f.writes,[{column:2,width:13}]);assert.equal(f.locked,false);
  assert.equal(f.run('confirm').ok,false);assert.equal(f.writes.length,1,'single-use confirmation cannot reactivate');
});
test('failure before the transition leaves pending state intact and a valid retry can finish',()=>{
  const f=fixture({inactive:true}),before=structuredClone(f.row);f.fault='before-write';
  assert.deepEqual(f.run('confirm'),{ok:false,retryable:true});assert.deepEqual(f.row,before);assert.equal(f.locked,false);
  assert.equal(f.run('confirm').ok,true);assert.equal(f.row[1],'confirmed');assert.equal(f.row[12],'active');
});
test('committed transition is reconciled after lost write or flush acknowledgement; formatting is noncritical',()=>{
  for(const fault of ['after-write','flush','format']){
    const f=fixture();f.fault=fault;assert.equal(f.run('confirm').ok,true,fault);
    assert.equal(f.row[1],'confirmed');assert.equal(f.row[12],'active');assert.equal(f.row[6],'');assert.equal(f.locked,false);
    assert.deepEqual(f.writes,[{column:2,width:13}]);
  }
});
test('an unavailable readback does not turn an uncertain write into claimed success',()=>{
  const f=fixture();f.fault='after-write';
  // The first read locates the token; fail only the subsequent reconciliation.
  const run=f.run;
  Object.defineProperty(f,'readbackBroken',{get(){return f.writes.length>0;}});
  assert.deepEqual(run('confirm'),{ok:false,retryable:true});assert.equal(f.locked,false);
});
test('unsubscribe commits inactive state and token invalidation together, preserving status date on repeats',()=>{
  const f=fixture();assert.equal(f.run('confirm').ok,true);f.time+=5000;
  f.fault='before-write';assert.equal(f.run('unsubscribe').retryable,true);assert.equal(f.row[12],'active');
  f.fault='after-write';assert.equal(f.run('unsubscribe').ok,true);assert.equal(f.row[1],'unsubscribed');assert.equal(f.row[12],'inactive');
  const inactiveAt=+f.row[13];f.time+=5000;assert.equal(f.run('unsubscribe').ok,true);assert.equal(+f.row[13],inactiveAt);
  assert.equal(f.run('confirm').ok,false);assert.equal(f.row[12],'inactive');assert.equal(f.row[0],'=literal@example.invalid');
  assert(f.writes.every(write=>write.column===2&&write.width===13));assert.equal(f.locked,false);
});
test('unsubscribe before confirmation invalidates the confirmation and never activates a pending address',()=>{
  const f=fixture();assert.equal(f.run('unsubscribe').ok,true);assert.equal(f.run('confirm').ok,false);
  assert.equal(f.row[1],'unsubscribed');assert.equal(f.row[12],'inactive');assert.equal(f.writes.length,1);
});
