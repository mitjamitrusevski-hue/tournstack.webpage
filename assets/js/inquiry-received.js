(() => {
  'use strict';
  let receipt;
  try {
    receipt = JSON.parse(window.sessionStorage.getItem('tournstack-contact-receipt') || 'null');
    window.sessionStorage.removeItem('tournstack-contact-receipt');
  } catch (_) { receipt = null; }
  const valid = receipt && /^[a-zA-Z0-9-]{16,80}$/.test(receipt.id || '') && receipt.expires > Date.now() && receipt.expires <= Date.now()+600000;
  if (!valid) { window.location.replace('/contact.html#contact-form'); return; }
  let returnURL = '/contact.html#contact-form';
  try {
    const url = new URL(receipt.returnURL);
    if (url.origin === window.location.origin && url.pathname === '/contact.html') returnURL = url.href;
  } catch (_) { /* Use the ordinary contact destination. */ }
  // Load analytics only after consuming a recent saved-inquiry receipt. No personal fields or IDs are sent.
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
  window.plausible.init = window.plausible.init || function (options) { window.plausible.o = options || {}; };
  window.plausible.init();
  window.plausible('Contact Inquiry Submitted');
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://plausible.io/js/pa-hcj_wYFVMwBOaNDFRuGWR.js';
  document.head.append(script);
  const dialog = document.querySelector('#inquiry-sent');
  const close = () => window.location.replace(returnURL);
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', close);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else { dialog.setAttribute('open', ''); dialog.querySelector('button').addEventListener('click', close); }
})();
