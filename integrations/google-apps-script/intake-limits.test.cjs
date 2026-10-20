// Local VM and numeric fixture state only; no Google/network/record mutation.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'Code.gs'),'utf8');
function fixture(shared){
  const state=shared||{properties:new Map([['TURNSTILE_SECRET','fixture-secret']]),locked:false,time:Date.UTC(2026,9,20),reads:0,writes:0,network:0,valid:false};
  const context={console:{error(){}},Date:class extends Date{static now(){return state.time;}},
    PropertiesService:{getScriptProperties:()=>({getProperty(k){if(state.brokenRead)throw Error('unavailable');state.reads++;return state.properties.get(k);},setProperty(k,v){if(!state.locked)throw Error('write outside lock');if(state.brokenWrite)throw Error('unavailable');state.writes++;state.properties.set(k,v);}})},
    LockService:{getScriptLock:()=>{let held=false;return {waitLock(){if(state.locked||state.brokenLock)throw Error('busy');state.locked=true;held=true;},hasLock:()=>held,releaseLock(){assert(held);held=false;state.locked=false;}};}},
    UrlFetchApp:{fetch(){state.network++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:state.valid,action:'contact',hostname:'tournstack.com'})};}},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})}};
  vm.createContext(context);vm.runInContext(source,context);return {state,context,verify:()=>context.verifyTurnstile_('fixture-token','https://tournstack.com')};
}
test('invalid input does not consume allowance or perform external verification',()=>{
  const f=fixture(),bad={Origin:'https://attacker.invalid',SubmissionId:'fixture-0000000000',Name:'Test',Email:'fixture@example.invalid',Inquiry:'Local fixture','cf-turnstile-response':'token'};
  assert(f.context.doPost({parameter:bad}).html.includes('"ok":false'));
  assert.equal(f.context.verifyTurnstile_('', 'https://tournstack.com'),false);
  assert.equal(f.state.network,0);assert.equal(f.state.writes,0);
  for(const length of [65537,-1,'bad']){
    const event={contentLength:length};Object.defineProperty(event,'parameter',{get(){throw Error('oversized fields accessed');}});
    assert(f.context.doPost(event).html.includes('"ok":false'));
  }
  assert(f.context.doPost({postData:{length:65537}}).html.includes('"ok":false'));
  assert(f.context.receipt_('https://tournstack.com','a'.repeat(40000),false).html.length<1000);
  const unicode={...bad,Origin:'https://tournstack.com',Inquiry:'界'.repeat(5000)};
  const length=Buffer.byteLength(new URLSearchParams(unicode).toString());
  assert(length>32768&&length<65536);f.context.doPost({contentLength:length,parameter:unicode});assert.equal(f.state.network,1);
});
test('nonempty rejected proofs stop at120/minute; fresh invocation and minute/day rollover preserve bounds',()=>{
  const a=fixture(),b=fixture(a.state);
  for(let i=0;i<121;i++)assert.equal((i%2?a:b).verify(),false);
  assert.equal(a.state.network,120);
  a.state.time+=60000;assert.equal(b.verify(),false);assert.equal(a.state.network,121);
  for(let i=121;i<3000;i++){if(i%120===0)a.state.time+=60000;a.verify();}
  assert.equal(a.state.network,3000);a.state.time+=60000;b.verify();assert.equal(a.state.network,3000);
  a.state.time=Date.UTC(2026,9,21);b.verify();assert.equal(a.state.network,3001);
});
test('verified form intake stops at200/day without changing mail cap or trusting caller identity',()=>{
  const f=fixture();f.state.valid=true;
  for(let i=0;i<200;i++){if(i===120)f.state.time+=60000;assert.equal(f.verify(),true);}
  const calls=f.state.network;assert.equal(f.verify(),false);assert.equal(f.state.network,calls);
  f.state.time=Date.UTC(2026,9,21);assert.equal(f.verify(),true);
});
test('lock contention, unavailable storage and corrupt state fail closed before network',()=>{
  for(const fault of ['brokenLock','brokenRead','brokenWrite']){
    const f=fixture();f.state[fault]=true;assert.equal(f.verify(),false);assert.equal(f.state.network,0);assert.equal(f.state.locked,false);
  }
  for(const value of ['{','{"v":2}','{"v":1,"minute":-1,"day":0,"minuteAttempts":0,"dayAttempts":0,"intakes":0}']){
    const f=fixture();f.state.properties.set('PUBLIC_FORM_ALLOWANCE_V1',value);assert.equal(f.verify(),false);assert.equal(f.state.network,0);
  }
  const f=fixture(),second=fixture(f.state);f.state.locked=true;assert.equal(second.verify(),false);assert.equal(f.state.network,0);f.state.locked=false;assert.equal(second.context.claimFormAllowance_('verification'),true);
});
test('counter state is fixed size and contains no submitted identity or proof',()=>{
  const f=fixture();for(let i=0;i<200;i++)f.verify();
  const saved=f.state.properties.get('PUBLIC_FORM_ALLOWANCE_V1');
  assert(saved.length<160);assert(!saved.includes('token'));assert(!saved.includes('email'));assert(!saved.includes('origin'));assert.equal(f.state.writes,120);
});
