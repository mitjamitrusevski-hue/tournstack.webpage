import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('Apps Script saves before authenticated relay request and preserves contact after relay failure',() => {
  const rows=[['Timestamp','Name','Email','Inquiry']],requests=[],events=[],cache=new Map();
  let fail=false,locked=false;
  const sheet={getLastRow:()=>rows.length,getMaxRows:()=>1000,setFrozenRows(){},getRange(row,col,count=1,width=1){return {
    getValues:()=>[rows[row-1].slice(col-1,col-1+width)],setValues(v){rows[row-1]=v[0];events.push('save');return this;},
    setNumberFormat(){return this;},setFontFamily(){return this;},setFontColor(){return this;},setBackground(){return this;},setFontWeight(){return this;},setWrap(){return this;}
  };}};
  const ctx={console:{error(){}},SpreadsheetApp:{openById:id=>{assert.equal(id,'1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM');return {getSheetByName:()=>sheet,setSpreadsheetTimeZone(){}};},flush(){}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>({MAIL_RELAY_URL:'https://relay.example.com/contact-email',MAIL_RELAY_TOKEN:'a'.repeat(64)})[k]})},
    UrlFetchApp:{fetch(url,options){requests.push({url,options});events.push('queue');return {getResponseCode:()=>fail?503:202};}},
    LockService:{getScriptLock:()=>({waitLock(){locked=true;},hasLock:()=>locked,releaseLock(){locked=false;}})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'allowall'},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})},
    ContentService:{createTextOutput:v=>v}};
  vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../../google-apps-script/Code.gs',import.meta.url),'utf8'),ctx);
  ctx.setupContacts();assert.equal(requests.length,0);
  const contact={Origin:'https://tournstack.com',SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000001',Name:'Test Organizer',Email:'organizer@example.com',Inquiry:'Please tell me about pilots.'};
  assert(ctx.doPost({parameter:contact}).html.includes('"ok":true'));
  assert.deepEqual(events,['save','queue']);assert.equal(rows.length,2);
  assert.equal(Object.prototype.toString.call(rows[1][0]),'[object Date]');
  assert.equal(requests[0].options.headers.Authorization,'Bearer '+'a'.repeat(64));
  assert.equal(requests[0].options.followRedirects,false);
  assert.deepEqual(JSON.parse(requests[0].options.payload),{SubmissionId:contact.SubmissionId,Name:contact.Name,Email:contact.Email,Inquiry:contact.Inquiry});
  ctx.doPost({parameter:contact});assert.equal(rows.length,2);assert.equal(requests.length,1);
  fail=true;
  const output=ctx.doPost({parameter:{...contact,SubmissionId:'aaaaaaaa-bbbb-cccc-dddd-000000000002',Inquiry:'=HYPERLINK("https://example.com")'}});
  assert(output.html.includes('"ok":true'));assert.equal(rows.length,3);assert(rows[2][3].startsWith("'="));assert(!locked);
  const invalid=ctx.doPost({parameter:{...contact,Origin:'https://attacker.example'}});assert(invalid.html.includes('"ok":false'));
});
