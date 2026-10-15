// Captured real SDKs and actual public CMP. All event/log/form endpoints intercepted.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TS_PLAYWRIGHT || 'playwright');
const root=path.resolve(__dirname,'../..');
const fixtures=process.env.TS_ADVERTISING_FIXTURES;
if(!fixtures)throw Error('Set TS_ADVERTISING_FIXTURES to the privately captured SDK directory');
const width=Number(process.env.TS_CMP_TEST_WIDTH||1440);
const out={at:new Date().toISOString(),width,scope:'Local source with LinkedIn switch enabled in memory; real public CMP and captured unmodified vendor SDKs; collector replies synthetic, no delivery',checks:[],attempts:[],errors:[],realEvents:0,realSubmissions:0};
const value='synthetic-private@example.invalid',hash=crypto.createHash('sha256').update(value).digest('hex');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/'+browser.version()+' Safari/537.36'});
 let phase='initial';
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='tournstack.com'&&req.method()==='GET'){
   const f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.abort();
   let body=fs.readFileSync(f);
   if(/advertising\.[a-f0-9]+\.js$/.test(f))body=Buffer.from(fs.readFileSync(root+'/assets/js/advertising.js','utf8').replace('linkedInEnabled: false','linkedInEnabled: true'));
   if(/styles\.[a-f0-9]+\.css$/.test(f))body=fs.readFileSync(root+'/assets/css/styles.css');
   return route.fulfill({contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream',body});
  }
  if(u.hostname==='cdn-cookieyes.com'&&req.method()==='GET') {const response=await route.fetch({maxRedirects:0});return route.fulfill({response});}
  if(u.hostname==='snap.licdn.com'&&u.pathname==='/li.lms-analytics/insight.min.js'){
   out.attempts.push({phase,kind:'library',vendor:'LinkedIn'});
   return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(fixtures+'/linkedin-current-sdk.js')});
  }
  if(u.hostname==='connect.facebook.net'){
   const f=u.pathname==='/en_US/fbevents.js'?'alignment-meta-fbevents.js':u.pathname==='/signals/config/1637153127858631'?'alignment-meta-config.js':null;
   if(f){out.attempts.push({phase,kind:'library',vendor:'Meta',config:f.includes('config')});return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(fixtures+'/'+f)});}
  }
  if(/linkedin|licdn|facebook/.test(u.hostname)){
   let data=req.postData()||'';try{data=zlib.gunzipSync(Buffer.from(data,'base64')).toString()}catch{}
   let json;try{json=JSON.parse(data)}catch{}
   const raw=decodeURIComponent(u.href+' '+data);
   out.attempts.push({phase,kind:'event',host:u.hostname,path:u.pathname,method:req.method(),event:json?.signalType||u.searchParams.get('ev'),subSignal:json?.subSignalType,button:json?.domAttributes?.innerText,keys:json?Object.keys(json):[...u.searchParams.keys()],hasFormValue:raw.includes(value)||raw.includes(hash)||raw.includes('synthetic-private'),hasMatching:!!json?.hem||[...u.searchParams.keys()].some(k=>/^ud\[/.test(k))});
   if(req.resourceType()==='image')return route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')});
   return route.fulfill({status:200,headers:{'access-control-allow-origin':'https://tournstack.com','access-control-allow-credentials':'true'},contentType:req.resourceType()==='script'?'application/javascript':'application/json',body:req.resourceType()==='script'?'/* intercepted */':'{}'});
  }
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>out.errors.push(e.message));
 await page.goto('https://tournstack.com/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Preferences',exact:true}).waitFor();
 assert.equal(out.attempts.length,0);out.checks.push('Fresh visit: no advertising requests');
 phase='grant';await page.getByRole('button',{name:'Preferences',exact:true}).click();
 const checkbox=page.locator('.cky-preference-center input[type="checkbox"]').last();assert.equal(await checkbox.isChecked(),false);await checkbox.focus();await page.keyboard.press('Space');
 await page.getByRole('button',{name:'Save My Preferences',exact:true}).click();await page.waitForTimeout(2500);
 assert(out.attempts.some(a=>a.event==='PAGE_VISIT'));assert(out.attempts.some(a=>a.event==='PageView'));
 assert.equal(out.attempts.filter(a=>a.kind==='library'&&a.vendor==='LinkedIn').length,1);
 out.checks.push('Genuine keyboard CMP save: one LinkedIn loader; automatic visit and Meta PageView');
 phase='interaction';await page.locator('#newsletter-email').fill(value);
 // Exercise the button and form listeners with all receiver traffic blocked.
 await page.locator('#newsletter-signup button[type="submit"]').evaluate(b=>b.disabled=false);
 await page.locator('#newsletter-signup button[type="submit"]').click();await page.waitForTimeout(500);
 await page.evaluate(()=>document.querySelector('#newsletter-signup').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true})));
 await page.waitForTimeout(500);
 let prompts=0;page.once('dialog',async d=>{prompts++;await d.dismiss()});
 await page.locator('.cky-banner-element').first().click();
 assert.equal(prompts,1);assert.equal(await page.locator('#newsletter-email').inputValue(),value);
 assert.equal(await page.locator('.cky-preference-center').isVisible(),false);
 out.checks.push('Unsent-text warning: cancel preserves input and leaves preferences closed');
 page.once('dialog',async d=>{prompts++;await d.accept()});
 await page.locator('.cky-banner-element').first().click();
 assert.equal(prompts,2);await page.getByRole('button',{name:'Save My Preferences',exact:true}).waitFor();
 await checkbox.uncheck();
 phase='decision';await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Save My Preferences',exact:true}).click()]);
 phase='after-withdraw';await page.waitForTimeout(1500);
 assert.equal(await page.locator('script[src*="licdn"],script[src*="connect.facebook.net"]').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('tournstack-advertising-choice')),null);
 assert.equal(await page.evaluate(()=>window.getCkyConsent()?.categories.advertisement),false);
 assert(!out.attempts.some(a=>a.phase==='after-withdraw'));out.checks.push('Confirmed withdrawal reloads once; saved denial, no vendors after reload');
 phase='regrant';await page.locator('.cky-banner-element').first().click();await page.getByRole('button',{name:'Accept All',exact:true}).last().click();await page.waitForTimeout(1500);
 assert.equal(out.attempts.filter(a=>a.kind==='library'&&a.vendor==='LinkedIn').length,2);
 // Another-tab withdrawal: no warning had been accepted in this fresh document.
 await page.locator('#newsletter-email').fill(value);
 phase='cross-tab';const tab=await context.newPage();await tab.goto('https://tournstack.com/privacy.html',{waitUntil:'domcontentloaded'});await tab.evaluate(()=>localStorage.removeItem('tournstack-advertising-choice'));await tab.close();
 await page.locator('.advertising-reload-dialog').waitFor();assert.equal(await page.locator('#newsletter-email').inputValue(),value);
 const count=out.attempts.length;
 // Force a late SDK call and exit signal after revocation. CSP must stop the egress.
 await page.evaluate(()=>{window.lintrk('track');window.dispatchEvent(new Event('pagehide'));navigator.sendBeacon('https://px.ads.linkedin.com/wa/','synthetic-late');});
 await page.waitForTimeout(700);assert.equal(out.attempts.length,count,'No new advertising egress after retirement');
 await page.getByRole('button',{name:'Keep page open to copy text'}).click();assert.equal(await page.locator('#newsletter-email').inputValue(),value);
 await page.locator('.advertising-reload-notice').click();await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Reload page',exact:true}).click()]);
 await page.waitForTimeout(700);assert.equal(await page.locator('script[src*="licdn"]').count(),0);
 out.checks.push('Cross-tab withdrawal: network stopped immediately; unsent text remains available to copy, then clean reload');
 assert(out.attempts.filter(a=>a.kind==='event').every(a=>!a.hasFormValue&&!a.hasMatching));
 out.checks.push('Captured visit/button/form-interaction payloads contain no synthetic field value/hash or matching data');
 out.cookies=(await context.cookies()).map(({name,domain,expires})=>({name,domain,expires}));
 out.status='PASS';await context.close();
}catch(e){out.errors.push(e.stack);process.exitCode=1}finally{out.endedAt=new Date().toISOString();fs.writeFileSync(fixtures+'/linkedin-normal-cmp-'+width+'.json',JSON.stringify(out,null,2));console.log(JSON.stringify({status:out.status,checks:out.checks,errors:out.errors,attempts:out.attempts.length},null,2));await browser.close()}})();
