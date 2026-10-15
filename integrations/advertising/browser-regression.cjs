// Run with Playwright and Chrome installed. All HTTP(S) traffic is intercepted.
// TS_PLAYWRIGHT may point to an existing Playwright module; no live SDK/mail runs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TS_PLAYWRIGHT || 'playwright');
const root=path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const turnstile=`window.turnstile={_widgets:[],render(selector,options){const el=document.querySelector(selector),input=document.createElement('input');input.type='hidden';input.name='cf-turnstile-response';input.value='synthetic-token';el.append(input);const id=this._widgets.push({el,options})-1;queueMicrotask(()=>options.callback('synthetic-token'));return id;},getResponse(){return 'synthetic-token';},reset(id){queueMicrotask(()=>this._widgets[id].options.callback('synthetic-token'));}};`;
const result={at:new Date().toISOString(),environment:'Chrome; all requests intercepted; synthetic CMP/vendor/Turnstile/receiver',checks:[],realVendorRequests:0,realSubmissions:0};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  async function setup(options={}) {
   const context=await browser.newContext({viewport:{width:options.width||390,height:900},reducedMotion:'reduce',javaScriptEnabled:options.js!==false});
   const requests=[];let receiptMode='success';
   await context.addInitScript(({throwAnalytics,blockedStorage,returning})=>{
    window.__calls=[];window.__analytics=[];
    window.plausible=(...args)=>{if(throwAnalytics)throw Error('synthetic analytics failure');window.__analytics.push(args);};window.plausible.init=()=>{};
    if(blockedStorage)Object.defineProperty(window,'sessionStorage',{get(){throw Error('synthetic storage failure');}});
    window.__consent={isUserActionCompleted:true,categories:{advertisement:!!returning},consentID:'synthetic-choice'};
    window.getCkyConsent=()=>window.__consent;
    if(returning)localStorage.setItem('tournstack-advertising-choice',JSON.stringify({version:'advertising-2026-10-15-v2',consentID:'synthetic-choice',expires:Date.now()+60000}));
   },options);
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='tournstack.com'&&request.method()==='GET') {
     const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
     if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Missing test file'});
     let body=fs.readFileSync(file);
     if(/advertising\.[a-f0-9]+\.js$/.test(file))body=Buffer.from(body.toString().replace(/linkedInEnabled: (true|false)/,'linkedInEnabled: '+!!options.enableCandidates));
     return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body});
    }
    requests.push({host:url.hostname,path:url.pathname,method:request.method()});
    if(url.hostname==='challenges.cloudflare.com')return route.fulfill({contentType:'application/javascript',body:turnstile});
    if(url.hostname==='connect.facebook.net')return route.fulfill({contentType:'application/javascript',body:'window.fbq.callMethod=function(){window.__calls.push(Array.from(arguments));};'});
    if(url.hostname==='script.google.com'&&request.method()==='POST') {
     const params=new URLSearchParams(request.postData());
     const receipt={type:'tournstack-contact-result',submissionId:params.get('SubmissionId'),ok:receiptMode!=='failure'};
     if(receiptMode==='wrong-id')receipt.submissionId='unrelated-synthetic-id';
     return route.fulfill({contentType:'text/html',body:'<!doctype html><script>window.top.postMessage('+JSON.stringify(receipt)+',"https://tournstack.com");</script>'});
    }
    return route.abort();
   });
   return {context,requests,page:await context.newPage(),mode:value=>{receiptMode=value;}};
  }
  for(const width of [1440,390]) {
   const f=await setup({width,enableCandidates:false});const {page}=f;
   await page.goto('https://tournstack.com/');
   assert(!f.requests.some(r=>/facebook|licdn/.test(r.host)));
   await page.evaluate(()=>{
    for(const [label,grant] of [['accept',true],['reject',false]]) {
     const button=document.createElement('button');button.className='cky-btn-'+label;button.textContent='Synthetic '+label;
     button.onclick=()=>{window.__consent.categories.advertisement=grant;document.dispatchEvent(new CustomEvent('cookieyes_consent_update',{detail:{accepted:grant?['necessary','advertisement']:['necessary'],rejected:grant?[]:['advertisement']}}));};
     document.body.prepend(button);
    }
   });
   await page.getByRole('button',{name:'Synthetic accept',exact:true}).click({force:true});
   await page.waitForFunction(()=>window.__calls.some(c=>c[0]==='trackSingle'));
   assert.equal(f.requests.filter(r=>r.host==='connect.facebook.net').length,1);
   assert(!f.requests.some(r=>r.host.includes('licdn')));
   await page.locator('#newsletter-email').fill('synthetic-private@example.invalid');
   await page.getByRole('button',{name:'Synthetic reject',exact:true}).click({force:true});
   assert.equal(await page.locator('#newsletter-email').inputValue(),'synthetic-private@example.invalid');
   assert.equal(await page.evaluate(()=>window.__calls.at(-1)[1]),'revoke');
   await page.getByRole('button',{name:'Synthetic accept',exact:true}).click({force:true});
   await page.waitForFunction(()=>window.__calls.filter(c=>c[0]==='trackSingle').length===2);
   assert.equal(f.requests.filter(r=>r.host==='connect.facebook.net').length,1);
   assert(!JSON.stringify(await page.evaluate(()=>window.__calls)).includes('synthetic-private'));
   await page.evaluate(()=>document.dispatchEvent(new CustomEvent('cookieyes_consent_update',{detail:{accepted:['advertisement'],rejected:[]}})));
   assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c[0]==='trackSingle').length),2);
   result.checks.push({width,check:'Meta-only fixture: denied/grant/withdraw/regrant; one mock loader; unchanged typed newsletter value; no values in loader arguments (full LinkedIn lifecycle covered separately)',status:'PASS'});
   await f.context.close();
  }
  for(const route of ['/contact.html','/privacy.html','/inquiry-received.html','/unsubscribe.html','/?token=synthetic-private']) {
   const f=await setup({returning:true,enableCandidates:true});await f.page.goto('https://tournstack.com'+route);await f.page.waitForTimeout(50);
   assert(!f.requests.some(r=>/facebook|licdn/.test(r.host)),route);await f.context.close();
  }
  const nojs=await setup({js:false,returning:true,enableCandidates:true});await nojs.page.goto('https://tournstack.com/');assert(!nojs.requests.some(r=>/facebook|licdn/.test(r.host)));await nojs.context.close();
  result.checks.push({check:'excluded pages/private query and no-JavaScript have no vendor requests',status:'PASS'});
  const invitation=await setup();await invitation.page.clock.install();await invitation.page.goto('https://tournstack.com/');
  await invitation.page.clock.fastForward(31000);assert.equal(await invitation.page.locator('#interest-prompt').evaluate(e=>e.hidden),false);
  await invitation.page.keyboard.press('Escape');assert.equal(await invitation.page.locator('#interest-prompt').evaluate(e=>e.hidden),true);
  assert.equal(await invitation.page.evaluate(()=>sessionStorage.length),0);
  await invitation.page.goto('https://tournstack.com/vision.html');assert.equal(await invitation.page.locator('#interest-prompt').evaluate(e=>e.hidden),true);
  await invitation.context.close();result.checks.push({check:'invitation appears after visible timer, closes with Escape, writes no session storage and resets on navigation',status:'PASS'});
  for(const blockedStorage of [false,true]) {
   const f=await setup({throwAnalytics:true,blockedStorage});await f.page.goto('https://tournstack.com/contact.html#contact-form');
   await f.page.locator('#contact-name').fill('Synthetic test');await f.page.locator('#contact-email').fill('synthetic@example.invalid');await f.page.locator('#contact-inquiry').fill('Never sent to production.');
   await f.page.locator('#contact-form button[type=submit]').click();await f.page.locator('#inquiry-sent:modal').waitFor();
   assert.equal(new URL(f.page.url()).pathname,blockedStorage?'/contact.html':'/inquiry-received.html');
   await f.page.keyboard.press('Escape');await f.page.waitForURL('**/contact.html#contact-form');
   if(!blockedStorage){await f.page.goto('https://tournstack.com/inquiry-received.html');await f.page.waitForURL('**/contact.html#contact-form');}
   result.checks.push({check:'saved receipt survives throwing analytics; blockedStorage='+blockedStorage+'; Escape and one-use receipt',status:'PASS'});
   await f.context.close();
  }
  const f=await setup();await f.page.goto('https://tournstack.com/contact.html');
  await f.page.locator('#contact-name').fill('Synthetic test');await f.page.locator('#contact-email').fill('synthetic@example.invalid');await f.page.locator('#contact-inquiry').fill('Keep this text after failure.');
  f.mode('wrong-id');await f.page.locator('#contact-form button[type=submit]').click();await f.page.waitForTimeout(100);
  assert.equal(await f.page.locator('#contact-form').getAttribute('aria-busy'),'true');
  await f.page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://attacker.invalid',data:{type:'tournstack-contact-result',submissionId:document.querySelector('[name=SubmissionId]').value,ok:true}})));
  assert.equal(await f.page.locator('#contact-form').getAttribute('aria-busy'),'true');
  await f.page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://script.google.com',data:{type:'tournstack-contact-result',submissionId:document.querySelector('[name=SubmissionId]').value,ok:false}})));
  assert((await f.page.locator('#contact-status').textContent()).includes('could not be saved'));
  assert.equal(await f.page.locator('#contact-inquiry').inputValue(),'Keep this text after failure.');assert.equal(await f.page.evaluate(()=>window.__analytics.length),0);
  await f.context.close();result.checks.push({check:'wrong receipt ID/untrusted origin ignored; trusted server error preserves input and counts no conversion',status:'PASS'});
 } finally {await browser.close();}
 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
