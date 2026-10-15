/* One advertising owner. Read integrations/advertising.md before enabling.
 * Account settings, current notice and live vendor withdrawal checks are release gates.
 * Public identifiers are configuration, not secrets. Unsent text is checked locally
 * only to warn before a consent-withdrawal reload; it is never stored or transmitted.
 */
(() => {
  'use strict';
  const config = Object.freeze({
    noticeVersion: 'advertising-2026-10-15-v2',
    noticePublished: true,
    metaEnabled: true,
    linkedInEnabled: true,
    metaPixelId: '1637153127858631',
    linkedInPartnerId: '11117593'
  });
  const hosts = new Set(['tournstack.com', 'www.tournstack.com']);
  const routes = new Set(['/', '/index.html', '/vision.html', '/faq.html', '/author-mitja-mitrusevski.html']);
  const markerKey = 'tournstack-advertising-choice';
  const lifetime = 180 * 86400000;
  let gestureUntil = 0, metaScript = null, metaReady = false, metaInitialised = false;
  let metaGranted = false, linkedInStarted = false, withdrawing = false;
  let reloadWarningAccepted = false;

  // Start with an empty campaign-query allowlist. A regex cannot establish that
  // an arbitrary UTM value contains no personal data. Register actual values first.
  const safeURL = (url, referrer = false) => {
    if (url.protocol !== 'https:' || url.username || url.password || url.search) return false;
    if (!hosts.has(url.hostname)) return referrer && url.pathname === '/' && !url.hash;
    if (!routes.has(url.pathname)) return false;
    if (!url.hash) return true;
    if (referrer) return false;
    try { return !!document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) { return false; }
  };
  const permittedPage = () => {
    try {
      if (!hosts.has(location.hostname) || !safeURL(new URL(location.href))) return false;
      return !document.referrer || safeURL(new URL(document.referrer), true);
    } catch (_) { return false; }
  };
  const privateSignal = () => navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const readConsent = () => {
    try {
      const choice = window.getCkyConsent?.();
      return choice?.isUserActionCompleted === true && choice.categories?.advertisement === true &&
        typeof choice.consentID === 'string' && choice.consentID ? choice : null;
    } catch (_) { return null; }
  };
  const readMarker = () => {
    try {
      const marker = JSON.parse(localStorage.getItem(markerKey) || 'null');
      if (marker && (!Number.isFinite(marker.expires) || marker.expires <= Date.now())) {
        localStorage.removeItem(markerKey);
        return null;
      }
      return marker;
    } catch (_) { return null; }
  };
  const forgetMarker = () => { try { localStorage.removeItem(markerKey); } catch (_) { /* Fail closed. */ } };
  const currentChoice = () => {
    const marker = readMarker();
    if (!config.noticePublished || privateSignal() || !permittedPage()) return false;
    const consent = readConsent();
    return !!(consent && marker && marker.version === config.noticeVersion &&
      marker.consentID === consent.consentID && Number.isFinite(marker.expires) &&
      marker.expires > Date.now() && marker.expires <= Date.now() + lifetime);
  };
  const clearCookies = names => {
    const present = new Set(document.cookie.split(';').map(pair => pair.trim().split('=')[0]));
    names = names.filter(name => present.has(name));
    if (!names.length) return;
    // Delete only known advertising names at applicable host/domain and path variants.
    const domains = ['', location.hostname, '.' + location.hostname, 'tournstack.com', '.tournstack.com'];
    const paths = new Set(['/']);
    const parts = location.pathname.split('/');
    for (let i = 1; i < parts.length; i++) paths.add(parts.slice(0, i).join('/') || '/');
    for (const name of names) for (const domain of domains) for (const path of paths) {
      document.cookie = name + '=; Max-Age=0; Path=' + path + '; Secure; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
    }
  };
  const revokeMeta = () => {
    metaGranted = false;
    try { window.fbq?.('consent', 'revoke'); } catch (_) { /* Keep the local gate closed. */ }
  };
  const hasUnsentText = () => Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]')).some(field => {
    if (field.disabled || field.readOnly || field.closest('.cky-preference-center, .cky-consent-container, [hidden], [aria-hidden="true"]')) return false;
    if (field.tagName === 'INPUT' && !['text', 'email', 'tel', 'url', 'search', 'number', 'password'].includes(field.type)) return false;
    return field.isContentEditable ? !!field.textContent.trim() : !!field.value.trim() && field.value !== field.defaultValue;
  });
  const reloadAfterWithdrawal = () => {
    if (!linkedInStarted || withdrawing) return;
    withdrawing = true;
    forgetMarker();
    // Stop new SDK requests during teardown, including page-exit beacons. This
    // temporary document-only policy disappears on reload. CMP logging may finish.
    // Do not patch browser APIs or rely on undocumented LinkedIn debug controls.
    const barrier = document.createElement('meta');
    barrier.httpEquiv = 'Content-Security-Policy';
    barrier.content = "connect-src https://log.cookieyes.com; img-src 'none'; script-src 'none'; frame-src 'none'; form-action 'none'";
    document.head.append(barrier);
    // A change from another tab may arrive without this page's warning. Stop
    // advertising immediately, but leave text in the DOM for copying before reload.
    if (!reloadWarningAccepted && hasUnsentText()) {
      const dialog = document.createElement('dialog');
      dialog.className = 'advertising-reload-dialog';
      dialog.setAttribute('aria-label', 'Advertising turned off');
      const text = document.createElement('p');
      text.textContent = 'Advertising is off. This page needs to reload before you continue. You have unsent text: copy it before reloading.';
      const copy = document.createElement('button');
      copy.type = 'button'; copy.textContent = 'Keep page open to copy text';
      copy.addEventListener('click', () => dialog.close());
      const reload = document.createElement('button');
      reload.type = 'button'; reload.textContent = 'Reload page';
      reload.addEventListener('click', () => location.reload());
      dialog.append(text, copy, reload); document.body.append(dialog); dialog.showModal();
      // Keep a usable reload control after closing the dialog. No text is saved.
      const notice = document.createElement('button');
      notice.className = 'advertising-reload-notice';
      notice.type = 'button'; notice.textContent = 'Advertising is off — reload page to continue';
      notice.addEventListener('click', () => dialog.showModal());
      document.body.prepend(notice);
      return;
    }
    // CookieYes finishes persisting its choice during the current event cycle.
    queueMicrotask(() => location.reload());
  };
  const revoke = () => {
    revokeMeta();
    clearCookies(['_fbp', '_fbc', 'li_fat_id']);
    reloadAfterWithdrawal();
  };
  const activateMeta = () => {
    if (withdrawing || !metaReady || metaGranted || !currentChoice()) return;
    try {
      window.fbq('consent', 'grant');
      if (!metaInitialised) {
        window.fbq('set', 'autoConfig', false, config.metaPixelId);
        window.fbq('init', config.metaPixelId);
        metaInitialised = true;
      }
      metaGranted = true;
      window.fbq('trackSingle', config.metaPixelId, 'PageView');
    } catch (_) { revokeMeta(); }
  };
  const startMeta = () => {
    if (metaScript) { activateMeta(); return; }
    // Another owner could have different consent or matching settings: refuse it.
    if (window.fbq || document.querySelector('script[src*="connect.facebook.net"]')) return;
    const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; fbq.push = fbq;
    window.fbq = fbq; window._fbq = fbq;
    fbq('consent', 'revoke');
    metaScript = document.createElement('script');
    metaScript.async = true;
    metaScript.referrerPolicy = 'no-referrer';
    metaScript.src = 'https://connect.facebook.net/en_US/fbevents.js';
    metaScript.onload = () => { metaReady = true; activateMeta(); };
    // A blocked Meta resource must not reload a consented LinkedIn page in a loop.
    metaScript.onerror = revokeMeta;
    document.head.append(metaScript);
  };
  const startLinkedIn = () => {
    // Standard Insight Tag bootstrap, admitted only by the current-notice gate.
    // Withdrawal retires this document; removing the script alone is not teardown.
    if (withdrawing || linkedInStarted || !currentChoice()) return;
    if (window.lintrk || document.querySelector('script[src*="snap.licdn.com"]')) return;
    linkedInStarted = true;
    window._linkedin_partner_id = config.linkedInPartnerId;
    window._linkedin_data_partner_ids = [config.linkedInPartnerId];
    window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
    window.lintrk.q = [];
    const script = document.createElement('script');
    script.async = true; script.referrerPolicy = 'no-referrer';
    script.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
    document.head.append(script);
  };
  const reconcile = () => {
    if (withdrawing) return;
    if (!currentChoice()) { revoke(); return; }
    if (config.metaEnabled) startMeta();
    if (config.linkedInEnabled) startLinkedIn();
  };
  // Window capture precedes CookieYes's document/target click handlers, including
  // keyboard-generated clicks. Cancel leaves both the choice and input untouched.
  window.addEventListener('click', event => {
    if (!event.isTrusted || !linkedInStarted || withdrawing) return;
    const preferences = event.target.closest?.('.cky-banner-element, .cky-btn-customize, .cky-btn-revisit, [data-cky-tag="revisit-consent"]');
    const decision = event.target.closest?.('.cky-btn-preferences, .cky-btn-reject');
    if (!preferences && !(decision && !reloadWarningAccepted)) return;
    if (!hasUnsentText()) { reloadWarningAccepted = false; return; }
    reloadWarningAccepted = window.confirm('You have unsent text. Turning advertising off will reload this page and may clear it. Cancel to finish or copy your text first, or choose OK to continue.');
    if (!reloadWarningAccepted) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  // Supplement CMP renewal with an explicit current-notice acknowledgement.
  // An initial CMP update or an old stored choice alone cannot write this marker.
  document.addEventListener('click', event => {
    if (event.isTrusted && event.target.closest?.('.cky-btn-accept, .cky-btn-preferences, .cky-btn-reject')) {
      gestureUntil = Date.now() + 1500;
    }
  }, true);
  document.addEventListener('cookieyes_consent_update', event => {
    if (withdrawing) return;
    const detail = event.detail;
    if (!detail || !Array.isArray(detail.accepted) || !Array.isArray(detail.rejected)) {
      forgetMarker(); revoke(); return;
    }
    if (!detail.accepted.includes('advertisement') || detail.rejected.includes('advertisement')) {
      gestureUntil = 0; forgetMarker(); revoke(); return;
    }
    const fromGesture = Date.now() <= gestureUntil;
    gestureUntil = 0;
    // The hosted CMP updates its cookie/API during the consent event cycle.
    queueMicrotask(() => {
      const consent = readConsent();
      if (config.noticePublished && fromGesture && consent && !privateSignal()) {
        try { localStorage.setItem(markerKey, JSON.stringify({version:config.noticeVersion, consentID:consent.consentID, expires:Date.now()+lifetime})); } catch (_) { revoke(); return; }
      }
      reconcile();
    });
  });
  for (const event of ['cookieyes_banner_load', 'cookieyes_banner_loaded']) document.addEventListener(event, reconcile);
  window.addEventListener('storage', reconcile);
  window.addEventListener('pageshow', reconcile);
  window.addEventListener('hashchange', reconcile);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reconcile(); });
  // Handles a returning visitor when the CMP loaded before this deferred script.
  reconcile();
})();
