const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const secret='test-relay-'.repeat(8),sheets=new Map(),queued=[];
class Sheet {
  constructor(){this.rows=[];}
  getLastRow(){return this.rows.length;} getMaxRows(){return 1000;}
  insertRowsAfter(){} setFrozenRows(){} hideColumns(){}
  deleteRow(n){this.rows.splice(n-1,1);}
  getRange(r,c,n=1,m=1){const s=this;return {
    getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>s.rows[r+i-1]?.[c+j-1]??''));},
    setValues(values){for(let i=0;i<n;i++){s.rows[r+i-1]??=[];for(let j=0;j<m;j++)s.rows[r+i-1][c+j-1]=values[i][j];}return this;},
    setValue(v){return this.setValues([[v]]);},
    setRichTextValue(v){return this.setValue(v.text);},
    clearContent(){return this.setValues(Array.from({length:n},()=>Array(m).fill('')));},
    setNumberFormat(){return this;},setFontFamily(){return this;},setFontColor(){return this;},setBackground(){return this;},setFontWeight(){return this;}
  };}
}
let verification={success:true,action:'newsletter',hostname:'tournstack.com'};
const context={console:{error(){}},Date,
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets.get(name),insertSheet:name=>{const s=new Sheet();sheets.set(name,s);return s;}}),flush(){},newRichTextValue:()=>({setText(text){this.text=text;return this;},build(){return {text:this.text};}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>({TURNSTILE_SECRET:'test-turnstile',MAIL_RELAY_TOKEN:secret,MAIL_RELAY_URL:'https://tournstack-mailbox.tournstack.workers.dev/contact-email'})[name]})},
  LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},getUuid:()=>crypto.randomUUID(),computeDigest:(alg,value)=>[...crypto.createHash('sha256').update(value).digest()],computeHmacSha256Signature:(value,key)=>[...crypto.createHmac('sha256',key).update(value).digest()]},
  UrlFetchApp:{fetch:(url,options)=>{
    if(url.includes('/siteverify'))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(verification)};
    assert.equal(url,'https://tournstack-mailbox.tournstack.workers.dev/newsletter-request');
    queued.push(JSON.parse(options.payload));return {getResponseCode:()=>202};
  }},
  HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput:html=>({setXFrameOptionsMode:()=>({html})})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}
};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'Code.gs'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'Newsletter.gs'),'utf8'),context);
const input={Kind:'newsletter',Origin:'https://tournstack.com',SourcePath:'/vision.html',SubmissionId:crypto.randomUUID(),Email:'=literal@example.com',ConsentVersion:'newsletter-2026-10-14','cf-turnstile-response':'test-token'};
context.doPost({parameter:{...input,'cf-turnstile-response':''}});assert.equal(sheets.size,0);assert.equal(queued.length,0);
verification={success:true,action:'contact',hostname:'tournstack.com'};
context.doPost({parameter:input});assert.equal(sheets.size,0);assert.equal(queued.length,0);
verification={success:true,action:'newsletter',hostname:'tournstack.com'};
context.doPost({parameter:{...input,ConsentVersion:'unknown'}});assert.equal(sheets.size,0);
context.doPost({parameter:input});const sheet=sheets.get('Newsletter');assert.equal(sheet.rows.length,2);assert.equal(sheet.rows[1][0],input.Email);assert.equal(sheet.rows[1][1],'pending');assert.equal(sheet.rows[1][5],'https://tournstack.com/vision.html#newsletter-signup');assert.equal(queued.length,1);
const token=new URL(queued[0].VerificationURL).searchParams.get('token'),unsubscribe=new URL(queued[0].UnsubscribeURL).searchParams.get('token');
assert.match(token,/^[a-f0-9]{128}$/);assert(!JSON.stringify(sheet.rows).includes(token));
assert.equal(crypto.createHmac('sha256',secret).update('confirm:'+token.slice(0,64)).digest('hex'),token.slice(64));
context.doPost({parameter:{...input,SubmissionId:crypto.randomUUID()}});assert.equal(queued.length,1);assert.equal(sheet.rows.length,2);
function action(Action,Token){const Timestamp=String(Date.now()),Signature=crypto.createHmac('sha256',secret).update([Action,Token,Timestamp].join('\n')).digest('hex');return {Action,Token,Timestamp,Signature};}
let request=action('newsletter-confirm',token);
assert.equal(context.doPost({parameter:{...request,Signature:'0'.repeat(64)}}).ok,false);assert.equal(sheet.rows[1][1],'pending');
assert.equal(context.doPost({parameter:{...request,Timestamp:String(Date.now()-400000)}}).ok,false);
assert.equal(context.doPost({parameter:request}).ok,true);assert.equal(sheet.rows[1][1],'confirmed');assert.equal(sheet.rows[1][6],'');
assert.equal(context.doPost({parameter:request}).ok,false,'confirmation token is single use');
const confirmedBefore=sheet.rows[1].slice(),queuedBefore=queued.length;
context.doPost({parameter:{...input,SubmissionId:crypto.randomUUID()}});
assert.equal(queued.length,queuedBefore+1);assert.equal(queued.at(-1).MessageKind,'already-subscribed');
assert.equal(sheet.rows.length,2);for(const column of [0,1,2,3,4,5,6,7,8,11])assert.equal(sheet.rows[1][column],confirmedBefore[column]);
context.doPost({parameter:{...input,SubmissionId:crypto.randomUUID()}});assert.equal(queued.length,queuedBefore+1,'one already-subscribed message per 24 hours');
sheet.rows[1][9]=new Date(Date.now()-86400001);context.doPost({parameter:{...input,SubmissionId:crypto.randomUUID()}});assert.equal(queued.length,queuedBefore+2,'notice allowed after cooldown');

assert.equal(context.doPost({parameter:action('newsletter-unsubscribe',unsubscribe)}).ok,true);assert.equal(sheet.rows.length,1);
context.doPost({parameter:{...input,SubmissionId:crypto.randomUUID()}});const expired=new URL(queued.at(-1).VerificationURL).searchParams.get('token');sheet.rows[1][7]=new Date(Date.now()-1);
assert.equal(context.doPost({parameter:action('newsletter-confirm',expired)}).ok,false);
sheet.rows[1][2]=new Date(Date.now()-8*86400000);
assert.equal(context.doPost({parameter:action('newsletter-cleanup','')}).ok,true);assert.equal(sheet.rows.length,1);
context.doPost({parameter:{...input,SubmissionId:crypto.randomUUID()}});sheet.rows[1][1]='confirmed';sheet.rows[1][3]=new Date(Date.now()-731*86400000);
context.doPost({parameter:action('newsletter-cleanup','')});assert.equal(sheet.rows.length,1);
console.log('Newsletter checks passed: human/action/consent gates, literal email, pending/deduplication, HMAC, one-use confirmation, expiry, unsubscribe and retention.');
