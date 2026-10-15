// Isolated contract tests. Vendor libraries never execute and no network is used.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../assets/js/advertising.js'), 'utf8');

function fixture(options = {}) {
  const listeners = new Map(), scripts = [], calls = [], deletions = [];
  const storage = new Map();
  const url = new URL(options.url || 'https://tournstack.com/');
  let consent = options.consent === undefined ? {isUserActionCompleted:true, categories:{advertisement:true}, consentID:'synthetic-choice'} : options.consent;
  let reloads = 0;
  const addEventListener = (name, fn) => { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); };
  const document = {
    referrer: options.referrer || '', hidden:false, addEventListener,
    get cookie() { return '_fbp=synthetic; _fbc=synthetic; li_fat_id=synthetic; necessary=keep'; },
    set cookie(value) { deletions.push(value); },
    getElementById: id => id === 'features' ? {} : null,
    querySelector: selector => selector.startsWith('form,') ? (options.form === false ? null : {}) : null,
    createElement: () => ({}), head:{append: script => scripts.push(script)}
  };
  const context = {
    document, location:{href:url.href,hostname:url.hostname,pathname:url.pathname,reload:()=>reloads++},
    navigator:{doNotTrack:options.dnt,globalPrivacyControl:options.gpc}, URL, Date, Set, JSON, Number, Object, queueMicrotask,
    localStorage:{getItem:k=>{if(options.storageBlocked)throw Error('blocked');return storage.get(k)||null;},setItem:(k,v)=>{if(options.storageBlocked)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)},
    getCkyConsent:()=>{if(options.cmpThrows)throw Error('CMP unavailable');return consent;}, addEventListener
  };
  context.window = context;
  const marker = {version:'advertising-2026-10-15-v1',consentID:'synthetic-choice',expires:Date.now()+60000,...options.marker};
  if(options.returning !== false)storage.set('tournstack-advertising-choice',JSON.stringify(marker));
  if(options.otherOwner)context.fbq = (...args)=>calls.push(args);
  let code = source;
  if(!options.production)code=code.replace(/noticePublished: (true|false)/,'noticePublished: '+(options.noticePublished !== false)).replace(/metaEnabled: (true|false)/,'metaEnabled: '+(options.metaEnabled !== false)).replace(/linkedInEnabled: (true|false)/,'linkedInEnabled: true');
  vm.runInNewContext(code, context);
  const emit = (name,event={}) => (listeners.get(name)||[]).forEach(fn=>fn(event));
  const update = async (value, detail) => {
    consent = value;
    emit('cookieyes_consent_update',{detail:detail || {accepted:value?.categories?.advertisement?['necessary','advertisement']:['necessary'],rejected:value?.categories?.advertisement?[]:['advertisement']}});
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {scripts,calls,deletions,storage,context,emit,update,
    consent:()=>consent,reloads:()=>reloads,
    click:(trusted=true)=>emit('click',{isTrusted:trusted,target:{closest:()=>({})}}),
    ready:()=>{const script=scripts.find(s=>s.src.includes('facebook'));if(script){context.fbq.callMethod=(...args)=>calls.push(args);script.onload();}}
  };
}

test('production enables only Meta with a valid current choice, even on a form-free page',()=>{
  const f=fixture({production:true,form:false});assert.equal(f.scripts.length,1);f.ready();
  assert(f.scripts[0].src.includes('connect.facebook.net'));
  assert.deepEqual(f.calls.filter(c=>c[0]==='trackSingle'),[['trackSingle','1637153127858631','PageView']]);
});
test('production fresh visits and old choices do not load a vendor',()=>{
  for(const consent of [null,{isUserActionCompleted:true,categories:{advertisement:true},consentID:'synthetic-choice'}]) {
    assert.equal(fixture({production:true,returning:false,consent,form:false}).scripts.length,0);
  }
});
test('notice rollback blocks both vendors and Meta switch blocks Meta',()=>{
  assert.equal(fixture({noticePublished:false,form:false}).scripts.length,0);
  assert.equal(fixture({metaEnabled:false}).scripts.length,0);
});
test('expired consent marker is removed on the next check, including excluded pages',()=>{
  for(const url of ['https://tournstack.com/','https://tournstack.com/privacy.html']) {
    const f=fixture({url,marker:{expires:Date.now()-1}});
    assert.equal(f.scripts.length,0);
    assert.equal(f.storage.has('tournstack-advertising-choice'),false);
  }
});
for(const [label,options] of Object.entries({
  fresh:{returning:false,consent:null}, oldChoice:{returning:false}, oldNotice:{marker:{version:'old'}},
  wrongChoice:{marker:{consentID:'other'}}, expired:{marker:{expires:0}}, future:{marker:{expires:Date.now()+181*86400000}},
  incomplete:{consent:{isUserActionCompleted:false,categories:{advertisement:true},consentID:'synthetic-choice'}},
  necessaryOnly:{consent:{isUserActionCompleted:true,categories:{necessary:true,advertisement:false},consentID:'synthetic-choice'}},
  analyticsOnly:{consent:{isUserActionCompleted:true,categories:{analytics:true},consentID:'synthetic-choice'}},
  malformed:{consent:{categories:'yes'}}, unavailable:{cmpThrows:true}, storageBlocked:{storageBlocked:true}, dnt:{dnt:'1'}, gpc:{gpc:true}
}))test(label+' fails closed',()=>assert.equal(fixture(options).scripts.length,0));

for(const route of ['/contact.html','/privacy.html','/inquiry-received.html','/unsubscribe.html','/newsletter-confirmed','/?email=synthetic','/?utm_source=unregistered','/#unknown'])
  test('excluded context '+route,()=>assert.equal(fixture({url:'https://tournstack.com'+route}).scripts.length,0));
for(const host of ['demo.tournstack.com','indexer.tournstack.com','tournstack.com.attacker.invalid'])
  test('excluded host '+host,()=>assert.equal(fixture({url:'https://'+host+'/'}).scripts.length,0));
for(const referrer of ['https://tournstack.com/contact.html','https://tournstack.com/?token=synthetic','https://external.invalid/private','https://external.invalid/?email=synthetic'])
  test('sensitive referrer blocks initialization: '+new URL(referrer).pathname,()=>assert.equal(fixture({referrer}).scripts.length,0));

test('returning consent, late CMP events and repeat updates produce one Meta init/PageView',async()=>{
  const f=fixture();assert.equal(f.scripts.length,1);f.ready();
  f.emit('cookieyes_banner_load');f.emit('cookieyes_banner_loaded');await f.update(f.consent());
  assert.equal(f.scripts.length,1);
  assert.deepEqual(f.calls.filter(c=>c[0]==='init'),[['init','1637153127858631']]);
  assert.deepEqual(f.calls.filter(c=>c[0]==='trackSingle'),[['trackSingle','1637153127858631','PageView']]);
  assert(f.calls.some(c=>c[0]==='set'&&c[1]==='autoConfig'&&c[2]===false));
});
test('old choice and synthetic click cannot renew; a trusted current choice can',async()=>{
  const f=fixture({returning:false});await f.update(f.consent());assert.equal(f.scripts.length,0);
  f.click(false);await f.update(f.consent());assert.equal(f.scripts.length,0);
  f.click();await f.update(f.consent());assert.equal(f.scripts.length,1);
});
test('withdraw during library download prevents initialization on completion',async()=>{
  const f=fixture();await f.update({isUserActionCompleted:true,categories:{advertisement:false},consentID:'synthetic-choice'});
  f.ready();assert.equal(f.calls.filter(c=>c[0]==='init'||c[0]==='trackSingle').length,0);
});
test('withdraw clears known cookies, stops events; regrant has one current view and no duplicate library',async()=>{
  const f=fixture();f.ready();const allowed=f.consent();
  await f.update({...allowed,categories:{advertisement:false}});
  assert.equal(f.storage.size,0);assert(f.calls.some(c=>c[0]==='consent'&&c[1]==='revoke'));
  assert(f.deletions.some(c=>c.startsWith('_fbp=')));assert(f.deletions.every(c=>!c.startsWith('necessary=')));
  f.emit('pageshow');assert.equal(f.calls.filter(c=>c[0]==='trackSingle').length,1);
  f.click();await f.update(allowed);assert.equal(f.scripts.length,1);
  assert.equal(f.calls.filter(c=>c[0]==='init').length,1);assert.equal(f.calls.filter(c=>c[0]==='trackSingle').length,2);
});
test('malformed notification revokes a running tag and removes the marker',async()=>{
  const f=fixture();f.ready();await f.update(f.consent(),{});assert.equal(f.storage.size,0);
  assert.equal(f.calls.at(-1)[1],'revoke');
});
test('another Meta owner is never initialized by this loader',()=>assert.equal(fixture({otherOwner:true}).scripts.length,0));
test('LinkedIn refuses pages with forms; form-free candidate reloads after withdrawal',async()=>{
  assert(!fixture().scripts.some(s=>s.src.includes('licdn')));
  const f=fixture({form:false});assert.equal(f.scripts.filter(s=>s.src.includes('licdn')).length,1);
  assert.equal(f.context._linkedin_partner_id,'11117593');
  await f.update({...f.consent(),categories:{advertisement:false}});f.emit('pageshow');assert.equal(f.reloads(),1);
});
