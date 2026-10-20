// Optional newsletter signup is separate from contact inquiries.
const NEWSLETTER_TAB = 'Newsletter';
const NEWSLETTER_CONSENT_VERSION = 'newsletter-2026-10-14';
const NEWSLETTER_CONSENT_TEXT = 'Email me TournStack news. Unsubscribe anytime.';
const NEWSLETTER_PUBLIC_ORIGIN = 'https://tournstack-mailbox.tournstack.workers.dev';
const NEWSLETTER_HEADERS = ['Email', 'Status', 'RequestedAt', 'ConfirmedAt', 'ConsentVersion', 'Source', 'VerificationTokenHash', 'VerificationExpiresAt', 'UnsubscribeTokenHash', 'LastEmailQueuedAt', 'SubmissionId', 'ConsentText', 'SubscriptionStatus', 'StatusChangedAt'];

function newsletterSheet_() {
  const book = SpreadsheetApp.openById(CONTACTS_SHEET_ID);
  let sheet = book.getSheetByName(NEWSLETTER_TAB);
  if (!sheet) {
    sheet = book.insertSheet(NEWSLETTER_TAB);
    sheet.getRange(1, 1, 1, NEWSLETTER_HEADERS.length).setValues([NEWSLETTER_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, NEWSLETTER_HEADERS.length).setFontFamily('Montserrat').setFontColor('#0F172A');
    sheet.getRange(1, 1, 1, NEWSLETTER_HEADERS.length).setBackground('#EEF2F7').setFontWeight('bold');
    sheet.hideColumns(7, 3);
  }
  // Extend the existing 12-column schema in place; preserve all contact/token fields.
  if (sheet.getMaxColumns() < 14) sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
  const headers = sheet.getRange(1, 1, 1, 14).getValues()[0];
  if (headers.slice(0, 12).join('|') !== NEWSLETTER_HEADERS.slice(0, 12).join('|') || headers.slice(12).some((v, i) => v && v !== NEWSLETTER_HEADERS[12 + i])) throw new Error('Newsletter headers do not match.');
  if (headers.slice(12).join('|') !== NEWSLETTER_HEADERS.slice(12).join('|')) {
    sheet.getRange(1, 13, 1, 2).setValues([NEWSLETTER_HEADERS.slice(12)]).setFontFamily('Montserrat').setFontColor('#0F172A').setBackground('#EEF2F7').setFontWeight('bold');
    if (sheet.getLastRow() > 1) {
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues();
      sheet.getRange(2, 13, rows.length, 2).setValues(rows.map(row => row[12] ? row.slice(12, 14) : row[1] === 'confirmed' ? ['active', row[3]] : ['', '']));
      sheet.getRange(2, 14, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  }
  return sheet;
}

function newsletterHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function newsletterToken_(purpose, secret) {
  const random = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const mac = Utilities.computeHmacSha256Signature(purpose + ':' + random, secret, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
  return random + mac;
}

function newsletterReceipt_(origin, id, ok) {
  const target = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  const safeId = typeof id === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(id) ? id : '';
  const data = JSON.stringify({type:'tournstack-newsletter-result', submissionId:safeId, ok:ok}).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>TournStack newsletter request</title></head><body><p>' + (ok ? 'Please check your inbox for signup details. If you already joined, you’re all set.' : 'We could not confirm your request. Please try again.') + '</p><script>window.top.postMessage(' + data + ',' + JSON.stringify(target) + ');</script></body></html>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function newsletterSignup_(p) {
  const origin = String(p.Origin || ''), id = String(p.SubmissionId || ''), email = String(p.Email || '').trim().toLowerCase();
  const valid = ALLOWED_ORIGINS.indexOf(origin) !== -1 && /^[a-zA-Z0-9-]{16,80}$/.test(id) && !p.Website &&
    email.length <= 254 && /^[\x21-\x7e]+$/.test(email) && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && p.ConsentVersion === NEWSLETTER_CONSENT_VERSION;
  if (!valid || !verifyTurnstile_(p['cf-turnstile-response'], origin, 'newsletter')) return newsletterReceipt_(origin, id, false);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = newsletterSheet_();
    cleanupNewsletter_(sheet);
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, NEWSLETTER_HEADERS.length).getValues() : [];
    const index = rows.findIndex(row => row[0] === email), old = index === -1 ? null : rows[index];
    // Generic receipts avoid revealing whether an address is already subscribed.
    if (old && old[1] === 'confirmed' && old[12] === 'active') {
      // Send status privately to the mailbox, never disclose list membership in the browser.
      const noticeRecentlyQueued = String(old[10]).indexOf('notice:') === 0 && old[9] && Date.now() - new Date(old[9]).getTime() < 86400000;
      if (!noticeRecentlyQueued) {
        const noticeSettings = relaySettings_(), noticeId = Utilities.getUuid();
        const noticeResponse = UrlFetchApp.fetch(noticeSettings.url.replace(/\/contact-email$/, '/newsletter-request'), {
          method:'post', contentType:'application/json', headers:{Authorization:'Bearer ' + noticeSettings.token},
          payload:JSON.stringify({SubmissionId:noticeId, Email:email, MessageKind:'already-subscribed'}),
          muteHttpExceptions:true, followRedirects:false
        });
        if (noticeResponse.getResponseCode() === 202) {
          sheet.getRange(index + 2, 10).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm:ss');
          sheet.getRange(index + 2, 11).setValue('notice:' + noticeId);
        }
      }
      return newsletterReceipt_(origin, id, true);
    }
    if (old && old[1] === 'pending' && old[9] && Date.now() - new Date(old[9]).getTime() < 86400000) return newsletterReceipt_(origin, id, true);
    if (rows.length >= 50000) throw new Error('Newsletter capacity reached.');
    const settings = relaySettings_();
    const token = newsletterToken_('confirm', settings.token);
    const unsubscribe = newsletterToken_('unsubscribe', settings.token);
    const mailId = Utilities.getUuid();
    const now = new Date(), rowNumber = index === -1 ? sheet.getLastRow() + 1 : index + 2;
    if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    const sourcePath = ['/', '/index.html', '/vision.html', '/faq.html', '/contact.html', '/privacy.html', '/author-mitja-mitrusevski.html'].indexOf(p.SourcePath) !== -1 ? p.SourcePath : '/';
    const row = ['', 'pending', now, old?.[3] || '', NEWSLETTER_CONSENT_VERSION, origin + sourcePath + '#newsletter-signup', newsletterHash_(token), new Date(Date.now() + 86400000), newsletterHash_(unsubscribe), '', mailId, NEWSLETTER_CONSENT_TEXT, old?.[12] === 'inactive' ? 'inactive' : '', old?.[12] === 'inactive' ? old[13] : ''];
    sheet.getRange(rowNumber, 1, 1, NEWSLETTER_HEADERS.length).setNumberFormat('@').setValues([row]).setFontFamily('Montserrat').setFontColor('#0F172A').setBackground('#F8FAFC');
    // Rich text writes a literal string, including unusual valid local parts beginning with '='.
    sheet.getRange(rowNumber, 1).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(email).build());
    sheet.getRange(rowNumber, 3, 1, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(rowNumber, 8).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(rowNumber, 10).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(rowNumber, 14).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    SpreadsheetApp.flush();
    const response = UrlFetchApp.fetch(settings.url.replace(/\/contact-email$/, '/newsletter-request'), {
      method:'post', contentType:'application/json', headers:{Authorization:'Bearer ' + settings.token},
      payload:JSON.stringify({SubmissionId:mailId, Email:email, VerificationURL:NEWSLETTER_PUBLIC_ORIGIN + '/newsletter/confirm?token=' + token, UnsubscribeURL:NEWSLETTER_PUBLIC_ORIGIN + '/newsletter/unsubscribe?token=' + unsubscribe}),
      muteHttpExceptions:true, followRedirects:false
    });
    if (response.getResponseCode() !== 202) throw new Error('Newsletter mail was not queued.');
    sheet.getRange(rowNumber, 10).setValue(new Date());
    return newsletterReceipt_(origin, id, true);
  } catch (_) {
    console.error('Newsletter request failed. No submitted details logged.');
    return newsletterReceipt_(origin, id, false);
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}

function cleanupNewsletter_(sheet) {
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, NEWSLETTER_HEADERS.length).getValues(), now = Date.now();
  for (let i = rows.length - 1; i >= 0; i--) {
    const inactive = rows[i][12] === 'inactive', confirmed = rows[i][1] === 'confirmed';
    const age = now - new Date(inactive ? rows[i][13] : confirmed ? rows[i][3] : rows[i][2]).getTime();
    if (age > (inactive || confirmed ? 730 : 7) * 86400000) sheet.deleteRow(i + 2);
  }
}

function writeNewsletterTransition_(sheet, index, row) {
  // Commit status, dates and one-use token changes together. Do not rewrite A:
  // its rich-text email may legitimately start with a formula character.
  const values = [row.slice(1, NEWSLETTER_HEADERS.length)];
  const range = sheet.getRange(index + 2, 2, 1, NEWSLETTER_HEADERS.length - 1);
  try {
    range.setValues(values);
    SpreadsheetApp.flush();
  } catch (error) {
    // A service error can arrive after the write committed. Reconcile the exact
    // intended row under the existing ScriptLock before reporting a retry.
    if (JSON.stringify(range.getValues()) !== JSON.stringify(values)) throw error;
  }
  try {
    sheet.getRange(index + 2, 4).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(index + 2, 14).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  } catch (_) { console.error('Newsletter status saved; date formatting failed.'); }
}

function newsletterAction_(p) {
  const json = value => ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
  const action = String(p.Action || ''), token = String(p.Token || ''), timestamp = String(p.Timestamp || ''), signature = String(p.Signature || '');
  const secret = PropertiesService.getScriptProperties().getProperty('MAIL_RELAY_TOKEN');
  if (!secret || !/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/.test(signature) || (action !== 'newsletter-cleanup' && !/^[a-f0-9]{128}$/.test(token))) return json({ok:false});
  const expected = Utilities.computeHmacSha256Signature([action, token, timestamp].join('\n'), secret, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
  let difference = 0; for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (difference) return json({ok:false});
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = newsletterSheet_();
    cleanupNewsletter_(sheet);
    if (action === 'newsletter-cleanup') return json({ok:true});
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, NEWSLETTER_HEADERS.length).getValues() : [], hash = newsletterHash_(token);
    const index = rows.findIndex(row => row[action === 'newsletter-confirm' ? 6 : 8] === hash);
    if (index === -1) return json({ok:false});
    const row = rows[index];
    if (action === 'newsletter-unsubscribe') {
      const next = row.slice();
      next[1] = 'unsubscribed';
      if (row[12] !== 'inactive') { next[12] = 'inactive'; next[13] = new Date(); }
      next[6] = ''; next[7] = '';
      writeNewsletterTransition_(sheet, index, next);
      return json({ok:true});
    }
    if (row[1] !== 'pending' || new Date(row[7]).getTime() < Date.now()) return json({ok:false});
    const next = row.slice(), confirmedAt = new Date();
    next[1] = 'confirmed'; next[3] = confirmedAt;
    next[12] = 'active'; next[13] = confirmedAt;
    next[6] = ''; next[7] = '';
    writeNewsletterTransition_(sheet, index, next);
    return json({ok:true});
  } catch (_) {console.error('Newsletter status update failed.'); return json({ok:false,retryable:true});}
  finally {if (lock.hasLock()) lock.releaseLock();}
}

function newsletterUnsubscribeRequest_(p) {
  const origin = String(p.Origin || ''), id = String(p.SubmissionId || ''), email = String(p.Email || '').trim().toLowerCase();
  if (ALLOWED_ORIGINS.indexOf(origin) === -1 || !/^[a-zA-Z0-9-]{16,80}$/.test(id) || p.Website || email.length > 254 || !/^[\x21-\x7e]+$/.test(email) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !verifyTurnstile_(p['cf-turnstile-response'], origin, 'newsletter')) return newsletterReceipt_(origin, id, false);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = newsletterSheet_();
    cleanupNewsletter_(sheet);
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues() : [];
    const index = rows.findIndex(row => row[0] === email), row = rows[index];
    if (!row || (row[12] === 'inactive' && row[1] !== 'pending')) return newsletterReceipt_(origin, id, true);
    if (String(row[10]).startsWith('unsubscribe:') && row[9] && Date.now() - new Date(row[9]).getTime() < 3600000) return newsletterReceipt_(origin, id, true);
    const settings = relaySettings_(), token = newsletterToken_('unsubscribe', settings.token), mailId = Utilities.getUuid();
    const response = UrlFetchApp.fetch(settings.url.replace(/\/contact-email$/, '/newsletter-request'), {
      method:'post', contentType:'application/json', headers:{Authorization:'Bearer ' + settings.token},
      payload:JSON.stringify({SubmissionId:mailId, Email:email, MessageKind:'unsubscribe-link', UnsubscribeURL:NEWSLETTER_PUBLIC_ORIGIN + '/newsletter/unsubscribe?token=' + token}),
      muteHttpExceptions:true, followRedirects:false
    });
    if (response.getResponseCode() !== 202) return newsletterReceipt_(origin, id, false);
    // Rotate only after acceptance; merely requesting a link never changes status.
    sheet.getRange(index + 2, 9).setValue(newsletterHash_(token));
    sheet.getRange(index + 2, 10).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(index + 2, 11).setValue('unsubscribe:' + mailId);
    return newsletterReceipt_(origin, id, true);
  } catch (_) {console.error('Newsletter unsubscribe request failed.'); return newsletterReceipt_(origin, id, false);}
  finally {if (lock.hasLock()) lock.releaseLock();}
}
