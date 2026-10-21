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

// Exercise both launch states using an in-memory copy of the actual loader.
function loaderFixture({enabled = true, protocol = 'https:', hostname = 'tournstack.com', readyState = 'complete', returningOpen = false, blockedStorage = false} = {}) {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(root, 'assets/js/chatbot.js'), 'utf8');
  assert.match(source, /const ENABLED=(?:true|false);/, 'Loader must retain an explicit launch control');
  const frames = [], listeners = {}, events = [], posts = [], timers = new Map();let timerId=0;
  const frame = {style: {}, contentWindow: {postMessage: (...args) => posts.push(args)}, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }, classList: {toggle(name, value) { frame[name] = value; }}};
  const document = {readyState,createElement(tag) { assert.equal(tag, 'iframe'); return frame; }, body: {append(value) { frames.push(value); }},
    getElementById() { return null; }, addEventListener() {}};
  const window = {addEventListener(name, fn) { listeners[name] = fn; }, plausible: (...args) => events.push(args)};
  vm.runInNewContext(source.replace(/const ENABLED=(?:true|false);/, 'const ENABLED=' + enabled + ';'),
    {document, window, sessionStorage:{getItem(){if(blockedStorage)throw Error('blocked');return String(returningOpen);},setItem(){}},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},location: {protocol, hostname, origin: protocol + '//' + hostname, pathname: '/'}, innerHeight: 900});
  return {frames, frame, listeners, events, posts,timers};
}

test('Niko respects the disabled launch control and only embeds on the approved HTTPS website', () => {
  for (const options of [{enabled: false}, {protocol: 'http:'}, {hostname: 'attacker.example'}]) {
    assert.equal(loaderFixture(options).frames.length, 0);
  }
  assert.equal(loaderFixture({hostname: 'www.tournstack.com'}).frames.length, 1);
});

test('Niko iframe delegates clipboard write only and preserves sandbox isolation', () => {
  const {frames, frame} = loaderFixture();
  assert.equal(frames.length, 1);
  assert.equal(frame.src, 'https://tournstack-public-chat.tournstack.workers.dev/');
  assert.equal(frame.attributes.allow, 'clipboard-write');
  assert.equal(frame.attributes.sandbox, 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads');
  assert.equal(frame.referrerPolicy, 'strict-origin');
  assert.equal(frame.title, 'Coach Niko, TournStack AI assistant');
  assert(!frame.attributes.allow.includes('clipboard-read'));
});

test('iframe messages still require both the exact source window and exact origin', () => {
  const {frame, listeners, events} = loaderFixture();
  const data = {channel: 'tournstack-niko-v1', type: 'analytics', kind: 'rating', props: {stars: 5, privateText: 'must not forward'}};
  listeners.message({source: frame.contentWindow, origin: 'https://attacker.example', data});
  listeners.message({source: {}, origin: 'https://tournstack-public-chat.tournstack.workers.dev', data});
  assert.equal(events.length, 0);
  listeners.message({source: frame.contentWindow, origin: 'https://tournstack-public-chat.tournstack.workers.dev', data});
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'Chatbot Rating Submitted');
  assert.equal(JSON.stringify(events[0][1]), JSON.stringify({props: {stars: 5}, url: 'https://tournstack.com/'}));
});


test('closed Niko waits for the main page load and cancels its fallback',()=>{
 const f=loaderFixture({readyState:'interactive'});assert.equal(f.frames.length,1);assert.equal(f.frame.src,undefined);assert.equal(f.timers.size,1);
 f.listeners.load();assert.equal(f.frame.src,'https://tournstack-public-chat.tournstack.workers.dev/');assert.equal(f.timers.size,0);
});
test('returning open Niko restores immediately even while the main page is loading',()=>{
 const f=loaderFixture({readyState:'interactive',returningOpen:true});assert.equal(f.frame.src,'https://tournstack-public-chat.tournstack.workers.dev/');assert.equal(f.frame['is-open'],true);assert.equal(f.timers.size,0);
});
test('closed Niko has a bounded load fallback, including storage-blocked browsers',()=>{
 for(const blockedStorage of [false,true]){const f=loaderFixture({readyState:'interactive',blockedStorage});const timer=[...f.timers.values()][0];assert.equal(timer.ms,3000);timer.fn();assert.equal(f.frame.src,'https://tournstack-public-chat.tournstack.workers.dev/');assert.equal(f.timers.size,0);}
});
