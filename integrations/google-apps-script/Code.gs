// TournStack website contact endpoint. Deploy as a Web App executing as owner.
const CONTACTS_SHEET_ID = '1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM';
const CONTACTS_TAB = 'WEB Contacts';
const ALLOWED_ORIGINS = ['https://tournstack.com', 'https://www.tournstack.com'];

function setupContacts() {
  const book = SpreadsheetApp.openById(CONTACTS_SHEET_ID);
  const sheet = book.getSheetByName(CONTACTS_TAB);
  if (!sheet) throw new Error('WEB Contacts tab is missing.');
  const expected = ['Timestamp', 'Name', 'Email', 'Inquiry'];
  if (sheet.getRange(1, 1, 1, 4).getValues()[0].join('|') !== expected.join('|')) {
    throw new Error('The existing headers do not match. No data was changed.');
  }
  book.setSpreadsheetTimeZone('Europe/Warsaw');
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, sheet.getMaxRows(), 4)
    .setFontFamily('Montserrat').setFontColor('#0F172A').setBackground('#F8FAFC');
  sheet.getRange(1, 1, 1, 4).setBackground('#EEF2F7').setFontWeight('bold');
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 3).setNumberFormat('@');
  sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setWrap(true);
  relaySettings_(); // Check configuration without sending a test email.
}

function doGet() {
  return ContentService.createTextOutput('TournStack contact endpoint. Submit inquiries through https://tournstack.com/contact.html.');
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const origin = String(p.Origin || '');
  const id = String(p.SubmissionId || '');
  const name = String(p.Name || '').trim();
  const email = String(p.Email || '').trim();
  const inquiry = String(p.Inquiry || '').trim();
  const valid = ALLOWED_ORIGINS.indexOf(origin) !== -1 &&
    /^[a-zA-Z0-9-]{16,80}$/.test(id) && !p.Website &&
    name.length > 0 && name.length <= 100 && !/[\r\n]/.test(name) &&
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    inquiry.length > 0 && inquiry.length <= 5000;
  if (!valid) return receipt_(origin, id, false);

  const lock = LockService.getScriptLock();
  let saved = false;
  try {
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    const key = 'contact-' + id;
    if (cache.get(key)) return receipt_(origin, id, true);
    const sheet = SpreadsheetApp.openById(CONTACTS_SHEET_ID).getSheetByName(CONTACTS_TAB);
    if (!sheet) throw new Error('Contact tab unavailable.');
    const row = sheet.getLastRow() + 1;
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    sheet.getRange(row, 2, 1, 3).setNumberFormat('@');
    sheet.getRange(row, 1, 1, 4).setValues([
      [new Date(), sheetText_(name), sheetText_(email), sheetText_(inquiry)]
    ]);
    SpreadsheetApp.flush();
    saved = true;
    cache.put(key, 'saved', 21600); // Retry deduplication for up to six hours.
    try {
      sheet.getRange(row, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
      sheet.getRange(row, 1, 1, 4).setFontFamily('Montserrat')
        .setFontColor('#0F172A').setBackground('#F8FAFC');
      sheet.getRange(row, 4).setWrap(true);
    } catch (error) {
      console.error('Contact saved; row formatting failed.');
    }
    try {
      sendContactEmails_({SubmissionId: id, Name: name, Email: email, Inquiry: inquiry});
    } catch (error) {
      // The row remains saved if the mailbox SMTP relay is unavailable.
      console.error('Contact saved; email queue submission failed. Check relay configuration and Apps Script executions.');
    }
  } catch (error) {
    console.error('Contact processing failed. Check sheet access and Apps Script executions.');
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
  return receipt_(origin, id, saved);
}

function relaySettings_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('MAIL_RELAY_URL') || '');
  const token = String(props.getProperty('MAIL_RELAY_TOKEN') || '');
  if (!/^https:\/\/[^\s?#@]+\/contact-email$/.test(url) || token.length < 32) {
    throw new Error('Configure MAIL_RELAY_URL (HTTPS /contact-email) and MAIL_RELAY_TOKEN in Script Properties.');
  }
  return {url: url, token: token};
}

function sendContactEmails_(contact) {
  const settings = relaySettings_();
  const response = UrlFetchApp.fetch(settings.url, {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + settings.token},
    payload: JSON.stringify(contact), muteHttpExceptions: true, followRedirects: false
  });
  if (response.getResponseCode() !== 202) throw new Error('Email relay did not accept the contact.');
}

function verifyMailRelay() {
  const settings = relaySettings_();
  const response = UrlFetchApp.fetch(settings.url.replace(/\/contact-email$/, '/smtp-check'), {
    method: 'post', headers: {Authorization: 'Bearer ' + settings.token},
    muteHttpExceptions: true, followRedirects: false
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('SMTP check failed. Check Worker secrets, main mailbox login, application password and mailbox.org access.');
  }
  console.log('Mailbox.org TLS connection and SMTP authentication succeeded. No email was sent.');
}

function sheetText_(value) {
  // Treat visitor text literally rather than as a spreadsheet formula.
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function receipt_(origin, id, ok) {
  const target = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];
  const result = JSON.stringify({type: 'tournstack-contact-result', submissionId: id, ok: ok})
    .replace(/</g, '\\u003c');
  // The framed receipt contains no submitted details or sheet contents.
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>TournStack contact receipt</title></head>' +
    '<body style="background:#F8FAFC;color:#0F172A"><p>' +
    (ok ? 'Your inquiry has been received.' : 'Your inquiry could not be saved.') +
    '</p><script>window.top.postMessage(' + result + ',' + JSON.stringify(target) + ');</script></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
