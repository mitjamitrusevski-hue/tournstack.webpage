'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {ROOT_FILES} = require('../../scripts/public-artifact.cjs');
const {inlineHashes, policy, securityRules, updateRules, browserHeaders} = require('./security-policy.cjs');
const root = path.resolve(__dirname, '../..');
test('baseline protects framing, object embedding, form destinations and browser capabilities', () => {
  const headers = browserHeaders(root);
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(headers['content-security-policy'], /object-src 'none'/);
  assert.match(headers['content-security-policy'], /form-action 'self' https:\/\/script\.google\.com/);
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['strict-transport-security'], 'max-age=86400');
  assert(!/includeSubDomains|preload/i.test(headers['strict-transport-security']));
  assert(!headers['permissions-policy'].includes('clipboard'));
  assert(headers['content-security-policy-report-only'].includes('tournstack-public-chat.tournstack.workers.dev'));
});
test('strict candidate disallows arbitrary inline/eval scripts while preserving reviewed resource origins', () => {
  const {candidate, baseline} = policy(root);
  const script = candidate.split('; ').find(x => x.startsWith('script-src '));
  assert(script.includes("'sha256-"));
  assert(!script.includes('unsafe-inline') && !script.includes('unsafe-eval'));
  assert(candidate.includes('https://challenges.cloudflare.com'));
  assert(candidate.includes('https://*.googleusercontent.com'));
  assert(!baseline.includes('script-src'), 'Unverified provider compatibility must not be silently enforced');
  assert(!candidate.includes('report-uri') && !candidate.includes('report-to'), 'No new reporting/data collection endpoint');
});
test('generated rules retain unrelated rules and have exact HTTPS public-host boundaries', () => {
  const old = {rules: [{ref: 'existing-cache', action: 'rewrite'}]};
  const updated = updateRules(old, root);
  assert.deepEqual(updated.rules[0], old.rules[0]);
  assert.equal(updated.rules.length, 3);
  assert.deepEqual(updateRules(updated, root), updated);
  assert(securityRules(root).every(r => r.expression.includes('"tournstack.com" "www.tournstack.com"') && r.expression.includes('and ssl')));
});
test('inline hashes normalize browser newlines, detect code changes and ignore JSON-LD', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tournstack-policy-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const name of ROOT_FILES.filter(x => x.endsWith('.html'))) fs.writeFileSync(path.join(dir, name), '<h1>Fixture</h1>');
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, '<script>\r\nwindow.test=1;\r\n</script><script type="application/ld+json">{"x":1}</script>');
  const before = inlineHashes(dir);
  fs.writeFileSync(file, '<script>\nwindow.test=1;\n</script><script type="application/ld+json">{"x":2}</script>');
  assert.deepEqual(inlineHashes(dir), before);
  fs.writeFileSync(file, '<script>\nwindow.test=2;\n</script>');
  assert.notDeepEqual(inlineHashes(dir), before);
});

// Execute the actual parent loader with controlled time and browser state.
function loaderFixture({enabled=true,protocol='https:',hostname='tournstack.com',readyState='complete',returningOpen=false,panelValue,blockedStorage=false,progress=null,pathname='/',hidden=false,focused=true}={}) {
 const vm=require('node:vm'),source=fs.readFileSync(path.join(root,'assets/js/chatbot.js'),'utf8');
 assert.match(source,/const ENABLED=(?:true|false);/);
 const nodes=[],frames=[],hints=[],listeners={},documentListeners={},events=[],posts=[],storageReads=[],storageWrites=[],storageRemovals=[],timers=new Map(),storage=new Map();let now=0,timerId=0;
 if(panelValue!==undefined)storage.set('tournstack-niko-panel-v1',panelValue);
 if(returningOpen)storage.set('tournstack-niko-panel-v1','true');
 if(progress)storage.set('tournstack-niko-engagement-v1',JSON.stringify(progress));
 function element(tag){
  const e={tagName:tag,style:{},dataset:{},attributes:{},children:[],listeners:{},hidden:false,
   setAttribute(n,v){this.attributes[n]=v;},removeAttribute(n){delete this.attributes[n];},
   addEventListener(n,fn){this.listeners[n]=fn;},append(...values){this.children.push(...values);},
   classList:{toggle(n,v){e[n]=v;}}};
  if(tag==='iframe')e.contentWindow={postMessage:(...args)=>posts.push(args)};
  nodes.push(e);return e;
 }
 const document={readyState,hidden,hasFocus:()=>focused,currentScript:{dataset:{nikoLauncher:'/assets/test-launcher.svg'}},
  createElement:element,body:{append(e){if(e.tagName==='iframe')frames.push(e);}},head:{append(e){hints.push(e);}},
  getElementById(){return null;},addEventListener(n,fn){documentListeners[n]=fn;}};
 const window={addEventListener(n,fn){listeners[n]=fn;},plausible:(...args)=>events.push(args)};
 vm.runInNewContext(source.replace(/const ENABLED=(?:true|false);/,'const ENABLED='+enabled+';'),{document,window,sessionStorage:{getItem(k){storageReads.push(k);if(blockedStorage)throw Error('blocked');return storage.get(k)||null;},setItem(k,v){storageWrites.push({key:k,value:v});if(blockedStorage)throw Error('blocked');storage.set(k,v);},removeItem(k){storageRemovals.push(k);if(blockedStorage)throw Error('blocked');storage.delete(k);}},performance:{now:()=>now},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:now+ms,ms});return id;},clearTimeout(id){timers.delete(id);},location:{protocol,hostname,origin:protocol+'//'+hostname,pathname},innerHeight:900});
 const button=nodes.find(e=>e.id==='niko-chat-launcher');
 function advance(ms){const end=now+ms;let limit=100;while(limit--){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}assert(limit>0,'Timer loop');now=end;}
 return {frames,hints,listeners,documentListeners,events,posts,timers,storage,storageReads,storageWrites,storageRemovals,nodes,button,document,advance,
  click(){button.listeners.click();},focus(value){focused=value;listeners[value?'focus':'blur']();},visibility(value){document.hidden=value;documentListeners.visibilitychange();},
  state(open,extra={}){const frame=frames[0];listeners.message({source:frame.contentWindow,origin:'https://tournstack-public-chat.tournstack.workers.dev',data:{channel:'tournstack-niko-v1',type:'state',open},...extra});}};
}

test('Niko respects disabled launch control and approved HTTPS hosts',()=>{
 for(const options of [{enabled:false},{protocol:'http:'},{hostname:'attacker.example'}])assert.equal(loaderFixture(options).nodes.length,0);
 assert(loaderFixture({hostname:'www.tournstack.com'}).button);
});
test('fresh visits keep the lightweight button without preload, speculative connections or progress storage',()=>{
 const f=loaderFixture();assert(f.button);assert.equal(f.button.type,'button');assert.equal(f.button.attributes['aria-expanded'],'false');
 f.button.listeners.pointerenter?.();f.button.listeners.focus?.();f.listeners.load?.();f.advance(60000);
 f.focus(false);f.visibility(true);f.advance(60000);f.focus(true);f.visibility(false);
 f.listeners.pagehide();f.listeners.pageshow({persisted:true});
 assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);assert.equal(f.timers.size,0);assert.equal(f.posts.length,0);
 assert.deepEqual(f.storageReads,['tournstack-niko-panel-v1']);
 assert.deepEqual(f.storageWrites,[]);assert.deepEqual(f.storageRemovals,[]);assert.equal(f.storage.size,0);
});
test('click mounts one isolated frame and opens it through the authenticated handshake',()=>{
 const f=loaderFixture();f.click();f.click();assert.equal(f.frames.length,1);assert.equal(f.hints.length,1);const frame=f.frames[0];
 assert.equal(frame.src,'https://tournstack-public-chat.tournstack.workers.dev/');assert.equal(frame.attributes.allow,'clipboard-write');
 assert.equal(frame.attributes.sandbox,'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads');assert.equal(frame.referrerPolicy,'strict-origin');
 assert.equal(frame['is-open'],true);assert.equal(frame.style.height,'680px');
 f.state(false);assert.equal(f.storage.get('tournstack-niko-panel-v1'),'true');assert.equal(f.posts[0][0].type,'open');
 f.state(true);assert.equal(f.button.hidden,true);assert.equal(frame.hidden,false);assert.equal(f.timers.size,0);
 assert(f.storageWrites.every(row=>row.key==='tournstack-niko-panel-v1'));
});
test('open conversation restores immediately while the page is loading and never shrinks for a stale closed state',()=>{
 const f=loaderFixture({returningOpen:true,readyState:'interactive'});assert.equal(f.frames.length,1);const frame=f.frames[0];
 assert.equal(frame.hidden,false);assert.equal(frame['is-open'],true);assert.equal(frame.style.height,'680px');assert.equal(f.button.hidden,true);
 f.state(false);assert.equal(frame['is-open'],true);assert.equal(f.storage.get('tournstack-niko-panel-v1'),'true');
 f.state(true);f.state(false);assert.equal(frame['is-open'],false);assert.equal(frame.style.height,'88px');assert.equal(f.storage.get('tournstack-niko-panel-v1'),'false');
});
test('qualified legacy progress is neither consumed nor changed across navigation and reload',()=>{
 const progress={version:1,activeMs:30000,pageChanged:true,lastPath:'/'},saved=JSON.stringify(progress);
 for(const pathname of ['/','/faq.html','/blog.html','/why-were-building-tournstack.html']) {
  const f=loaderFixture({pathname,progress,readyState:'interactive'});
  f.listeners.load?.();f.advance(120000);f.focus(false);f.focus(true);f.listeners.pagehide();f.listeners.pageshow({persisted:true});
  assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);assert.equal(f.timers.size,0);
  assert.deepEqual(f.storageReads,['tournstack-niko-panel-v1']);assert.deepEqual(f.storageWrites,[]);assert.deepEqual(f.storageRemovals,[]);
  assert.equal(f.storage.get('tournstack-niko-engagement-v1'),saved);
 }
});
test('only an exact previously open preference restores a frame; closed or malformed preferences stay idle',()=>{
 for(const panelValue of ['false','TRUE','1','{"open":true}']) {
  const f=loaderFixture({panelValue});f.advance(60000);assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);assert.deepEqual(f.storageWrites,[]);
 }
 for(const pathname of ['/faq.html','/why-were-building-tournstack.html']) {
  const f=loaderFixture({returningOpen:true,pathname});assert.equal(f.frames.length,1);assert.equal(f.frames[0]['is-open'],true);assert.equal(f.frames[0].style.height,'680px');
 }
});
test('blocked storage keeps initial visits idle and native button activation usable',()=>{
 const f=loaderFixture({blockedStorage:true,hidden:true,focused:false});
 f.advance(60000);f.visibility(false);f.focus(true);assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);assert.deepEqual(f.storageWrites,[]);
 f.button.listeners.click({type:'click',detail:0});assert.equal(f.frames.length,1);f.state(true);assert.equal(f.frames[0].hidden,false);
 assert.deepEqual(f.storageReads,['tournstack-niko-panel-v1']);assert(f.storageWrites.every(row=>row.key==='tournstack-niko-panel-v1'));
});
test('failed loads retain a keyboard-usable retry button and ignore forged readiness',()=>{
 const f=loaderFixture();f.click();f.state(true,{origin:'https://attacker.example'});assert.equal(f.button.hidden,false);f.advance(15000);
 assert.match(f.nodes.find(e=>e.id==='niko-launcher-status').textContent,/try again/);assert.equal(f.frames[0].hidden,true);f.click();f.state(false);f.state(true);assert.equal(f.button.hidden,true);assert.equal(f.frames.length,1);
});
test('iframe messages require exact source and origin and forward only categorical analytics',()=>{
 const f=loaderFixture();f.click();const frame=f.frames[0],data={channel:'tournstack-niko-v1',type:'analytics',kind:'rating',props:{stars:5,privateText:'must not forward'}};
 f.listeners.message({source:frame.contentWindow,origin:'https://attacker.example',data});f.listeners.message({source:{},origin:'https://tournstack-public-chat.tournstack.workers.dev',data});assert.equal(f.events.length,0);
 f.listeners.message({source:frame.contentWindow,origin:'https://tournstack-public-chat.tournstack.workers.dev',data});assert.equal(f.events.length,1);assert.equal(f.events[0][0],'Chatbot Rating Submitted');assert.equal(JSON.stringify(f.events[0][1]),JSON.stringify({props:{stars:5},url:'https://tournstack.com/'}));
});

test('open iframe retains foreground and back-forward lifecycle messages without progress storage',()=>{
 const f=loaderFixture();f.click();f.state(true);f.posts.length=0;
 f.focus(false);f.focus(true);f.visibility(true);f.visibility(false);f.listeners.pagehide();f.advance(60000);f.listeners.pageshow({persisted:true});
 assert.deepEqual(f.posts.map(args=>args[0].type),['away','resume','away','resume','away','resume']);
 assert(f.posts.every(args=>args[0].channel==='tournstack-niko-v1'&&args[1]==='https://tournstack-public-chat.tournstack.workers.dev'));
 assert.equal(f.frames.length,1);assert.equal(f.hints.length,1);assert.equal(f.timers.size,0);
 assert.deepEqual(f.storageReads,['tournstack-niko-panel-v1']);assert(f.storageWrites.every(row=>row.key==='tournstack-niko-panel-v1'));assert.deepEqual(f.storageRemovals,[]);
});
test('back-forward restoration of a closed panel never creates a frame or consumes legacy progress',()=>{
 const f=loaderFixture({panelValue:'false'});f.listeners.pagehide();f.advance(60000);
 const saved=JSON.stringify({version:1,activeMs:30000,pageChanged:true,lastPath:'/faq.html'});
 f.storage.set('tournstack-niko-engagement-v1',saved);f.listeners.pageshow({persisted:true});f.advance(60000);
 assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);assert.equal(f.posts.length,0);assert.equal(f.timers.size,0);
 assert.deepEqual(f.storageReads,['tournstack-niko-panel-v1']);assert.deepEqual(f.storageWrites,[]);assert.equal(f.storage.get('tournstack-niko-engagement-v1'),saved);
});
