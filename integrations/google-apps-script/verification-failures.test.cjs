// All transports and stores are in-memory. No network or production records.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=['Code.gs','Newsletter.gs'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
for(const kind of ['contact','newsletter','newsletter-unsubscribe-request']){
 for(const failure of ['missing','invalid','expired','reused','wrong-host','wrong-action','http-error','malformed','network-error']){
  test(`${kind}: ${failure} verification cannot access storage or enqueue mail`,()=>{
   let stores=0,mail=0;
   const action=kind==='contact'?'contact':'newsletter';
   const result={success:true,action,hostname:'tournstack.com'};
   if(['invalid','expired','reused'].includes(failure)){result.success=false;result['error-codes']=[failure==='invalid'?'invalid-input-response':'timeout-or-duplicate'];}
   if(failure==='wrong-host')result.hostname='attacker.example';
   if(failure==='wrong-action')result.action=kind==='contact'?'newsletter':'contact';
   const context={console:{error(){}},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-secret'})},
    UrlFetchApp:{fetch(url){if(!url.endsWith('/siteverify')){mail++;throw Error('Unexpected mail');}if(failure==='network-error')throw Error('Offline');return {getResponseCode:()=>failure==='http-error'?503:200,getContentText:()=>failure==='malformed'?'{':JSON.stringify(result)};}},
    SpreadsheetApp:{openById(){stores++;throw Error('Unexpected storage');}},LockService:{getScriptLock(){stores++;throw Error('Unexpected lock');}},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput:html=>({setXFrameOptionsMode:()=>({html})})}};
   vm.createContext(context);vm.runInContext(source,context);
   const parameter={Kind:kind,Origin:'https://tournstack.com',SubmissionId:'isolated-request-12345',Name:'Synthetic test',Email:'synthetic@example.invalid',Inquiry:'Isolated test',ConsentVersion:'newsletter-2026-10-14','cf-turnstile-response':failure==='missing'?'':'synthetic-token'};
   const response=context.doPost({parameter});assert(response.html.includes('"ok":false'));assert.equal(stores,0);assert.equal(mail,0);
  });
 }
}
