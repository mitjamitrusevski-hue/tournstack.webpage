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
function loaderFixture({enabled=true,protocol='https:',hostname='tournstack.com',readyState='complete',returningOpen=false,blockedStorage=false,progress=null,pathname='/',hidden=false,focused=true}={}) {
 const vm=require('node:vm'),source=fs.readFileSync(path.join(root,'assets/js/chatbot.js'),'utf8');
 assert.match(source,/const ENABLED=(?:true|false);/);
 const nodes=[],frames=[],hints=[],listeners={},documentListeners={},events=[],posts=[],timers=new Map(),storage=new Map();let now=0,timerId=0;
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
 vm.runInNewContext(source.replace(/const ENABLED=(?:true|false);/,'const ENABLED='+enabled+';'),{document,window,sessionStorage:{getItem(k){if(blockedStorage)throw Error('blocked');return storage.get(k)||null;},setItem(k,v){if(blockedStorage)throw Error('blocked');storage.set(k,v);}},performance:{now:()=>now},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:now+ms,ms});return id;},clearTimeout(id){timers.delete(id);},location:{protocol,hostname,origin:protocol+'//'+hostname,pathname},innerHeight:900});
 const button=nodes.find(e=>e.id==='niko-chat-launcher');
 function advance(ms){const end=now+ms;let limit=100;while(limit--){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}assert(limit>0,'Timer loop');now=end;}
 return {frames,hints,listeners,documentListeners,events,posts,timers,storage,nodes,button,document,advance,
  click(){button.listeners.click();},focus(value){focused=value;listeners[value?'focus':'blur']();},visibility(value){document.hidden=value;documentListeners.visibilitychange();},
  state(open,extra={}){const frame=frames[0];listeners.message({source:frame.contentWindow,origin:'https://tournstack-public-chat.tournstack.workers.dev',data:{channel:'tournstack-niko-v1',type:'state',open},...extra});}};
}

test('Niko respects disabled launch control and approved HTTPS hosts',()=>{
 for(const options of [{enabled:false},{protocol:'http:'},{hostname:'attacker.example'}])assert.equal(loaderFixture(options).nodes.length,0);
 assert(loaderFixture({hostname:'www.tournstack.com'}).button);
});
test('fresh visits show only the lightweight button, including after load and 30 seconds on one page',()=>{
 const f=loaderFixture();assert(f.button);assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);
 f.advance(60000);assert.equal(f.frames.length,0);assert.equal(f.hints.length,0);
 assert.equal(JSON.parse(f.storage.get('tournstack-niko-engagement-v1')).activeMs,30000);
});
test('click mounts one isolated frame and opens it through the authenticated handshake',()=>{
 const f=loaderFixture();f.click();f.click();assert.equal(f.frames.length,1);const frame=f.frames[0];
 assert.equal(frame.src,'https://tournstack-public-chat.tournstack.workers.dev/');assert.equal(frame.attributes.allow,'clipboard-write');
 assert.equal(frame.attributes.sandbox,'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads');assert.equal(frame.referrerPolicy,'strict-origin');
 assert.equal(frame['is-open'],true);assert.equal(frame.style.height,'680px');
 f.state(false);assert.equal(f.storage.get('tournstack-niko-panel-v1'),'true');assert.equal(f.posts[0][0].type,'open');
 f.state(true);assert.equal(f.button.hidden,true);assert.equal(frame.hidden,false);assert.equal(f.timers.size,0);
});
test('open conversation restores immediately while the page is loading and never shrinks for a stale closed state',()=>{
 const f=loaderFixture({returningOpen:true,readyState:'interactive'});assert.equal(f.frames.length,1);const frame=f.frames[0];
 assert.equal(frame.hidden,false);assert.equal(frame['is-open'],true);assert.equal(frame.style.height,'680px');assert.equal(f.button.hidden,true);
 f.state(false);assert.equal(frame['is-open'],true);assert.equal(f.storage.get('tournstack-niko-panel-v1'),'true');
 f.state(true);f.state(false);assert.equal(frame['is-open'],false);assert.equal(frame.style.height,'88px');assert.equal(f.storage.get('tournstack-niko-panel-v1'),'false');
});
test('preload requires cumulative foreground time and a different page; reload is insufficient',()=>{
 const first=loaderFixture();first.advance(12000);first.listeners.pagehide();const saved=JSON.parse(first.storage.get('tournstack-niko-engagement-v1'));
 assert.equal(saved.activeMs,12000);
 const reload=loaderFixture({progress:saved});reload.advance(30000);assert.equal(reload.frames.length,0);
 const second=loaderFixture({pathname:'/faq.html',progress:saved});second.advance(17999);assert.equal(second.frames.length,0);second.advance(1);assert.equal(second.frames.length,1);
 second.state(false);assert.equal(second.frames[0]['is-open'],false);assert.equal(second.storage.get('tournstack-niko-panel-v1'),'false');
});
test('hidden and unfocused time do not advance preload eligibility',()=>{
 const progress={version:1,activeMs:0,pageChanged:true,lastPath:'/faq.html'},f=loaderFixture({progress,pathname:'/faq.html'});
 f.advance(5000);f.visibility(true);f.advance(60000);assert.equal(f.frames.length,0);f.visibility(false);f.advance(10000);f.focus(false);f.advance(60000);assert.equal(f.frames.length,0);f.focus(true);f.advance(14999);assert.equal(f.frames.length,0);f.advance(1);assert.equal(f.frames.length,1);
});
test('qualified preload waits for main page load; hidden qualified pages and blocked storage remain usable',()=>{
 const progress={version:1,activeMs:30000,pageChanged:true,lastPath:'/'},f=loaderFixture({progress,readyState:'interactive'});
 assert.equal(f.frames.length,0);f.listeners.load();assert.equal(f.frames.length,1);
 const hidden=loaderFixture({progress,hidden:true});assert.equal(hidden.frames.length,0);hidden.visibility(false);assert.equal(hidden.frames.length,1);
 const blocked=loaderFixture({blockedStorage:true});blocked.advance(60000);assert.equal(blocked.frames.length,0);blocked.click();assert.equal(blocked.frames.length,1);
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

test('back-forward cached pages merge newer tab progress without counting time while away',()=>{
 const f=loaderFixture();f.advance(10000);f.listeners.pagehide();f.advance(60000);
 f.storage.set('tournstack-niko-engagement-v1',JSON.stringify({version:1,activeMs:25000,pageChanged:true,lastPath:'/faq.html'}));f.listeners.pageshow({persisted:true});
 assert.equal(f.frames.length,0);f.advance(5000);assert.equal(f.frames.length,1);
});
