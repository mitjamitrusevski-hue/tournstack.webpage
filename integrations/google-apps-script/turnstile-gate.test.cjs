const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
let verificationResult = { success: true, action: 'contact', hostname: 'tournstack.com' };
let fetches = 0;
let sheetAccesses = 0;
const context = {
  console: { error() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-secret' }) },
  UrlFetchApp: { fetch: (url, options) => {
    fetches++;
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.payload.response, 'test-token');
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(verificationResult) };
  } },
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: 'allowall' },
    createHtmlOutput: (html) => ({ setXFrameOptionsMode: () => ({ html }) })
  },
  SpreadsheetApp: { openById: () => { sheetAccesses++; throw new Error('Sheet reached'); } },
  LockService: { getScriptLock: () => ({ waitLock() {}, hasLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null }) }
};
vm.createContext(context);
vm.runInContext(source, context);

assert.equal(context.verifyTurnstile_('', 'https://tournstack.com'), false);
assert.equal(fetches, 0);
assert.equal(context.verifyTurnstile_('test-token', 'https://tournstack.com'), true);
verificationResult = { success: true, action: 'contact', hostname: 'attacker.example' };
assert.equal(context.verifyTurnstile_('test-token', 'https://tournstack.com'), false);
verificationResult = { success: true, action: 'other', hostname: 'tournstack.com' };
assert.equal(context.verifyTurnstile_('test-token', 'https://tournstack.com'), false);
verificationResult = { success: false, action: 'contact', hostname: 'tournstack.com' };
assert.equal(context.verifyTurnstile_('test-token', 'https://tournstack.com'), false);

const contact = {
  Origin: 'https://tournstack.com', SubmissionId: 'test-submission-id-1234',
  Name: 'Test', Email: 'test@example.com', Inquiry: 'Hello'
};
context.doPost({ parameter: contact });
assert.equal(sheetAccesses, 0, 'missing token must not reach the Sheet');
context.doPost({ parameter: { ...contact, 'cf-turnstile-response': 'test-token' } });
assert.equal(sheetAccesses, 0, 'failed verification must not reach the Sheet');
verificationResult = { success: true, action: 'contact', hostname: 'tournstack.com' };
context.doPost({ parameter: { ...contact, 'cf-turnstile-response': 'test-token' } });
assert.equal(sheetAccesses, 1, 'valid verification may reach the existing Sheet handler');
console.log('Turnstile gate checks passed');
