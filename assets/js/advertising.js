/* One advertising owner. Read integrations/advertising.md before enabling.
 * Account settings, current notice and live vendor withdrawal checks are release gates.
 * Public identifiers are configuration, not secrets. No form values enter this module.
 */
(() => {
  'use strict';
  const config = Object.freeze({
    noticeVersion: 'advertising-2026-10-15-v1',
    noticePublished: true,
    metaEnabled: true,
    linkedInEnabled: false,
    metaPixelId: '1637153127858631',
    linkedInPartnerId: '11117593'
  });
  const hosts = new Set(['tournstack.com', 'www.tournstack.com']);
  const routes = new Set(['/', '/index.html', '/vision.html', '/faq.html', '/author-mitja-mitrusevski.html']);
  const markerKey = 'tournstack-advertising-choice';
  const lifetime = 180 * 86400000;
  let gestureUntil = 0, metaScript = null, metaReady = false, metaInitialised = false;
  let metaGranted = false, linkedInStarted = false, withdrawing = false;

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
  const revoke = () => {
    metaGranted = false;
    try { window.fbq?.('consent', 'revoke'); } catch (_) { /* Keep the local gate closed. */ }
    clearCookies(['_fbp', '_fbc', 'li_fat_id']);
    if (linkedInStarted && !withdrawing) {
      // There is no assumed lintrk consent/teardown API. LinkedIn is never
      // admitted to a document containing a form (see startLinkedIn).
      withdrawing = true;
      location.reload();
    }
  };
  const activateMeta = () => {
    if (!metaReady || metaGranted || !currentChoice()) return;
    try {
      window.fbq('consent', 'grant');
      if (!metaInitialised) {
        window.fbq('set', 'autoConfig', false, config.metaPixelId);
        window.fbq('init', config.metaPixelId);
        metaInitialised = true;
      }
      metaGranted = true;
      window.fbq('trackSingle', config.metaPixelId, 'PageView');
    } catch (_) { revoke(); }
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
    metaScript.onerror = revoke;
    document.head.append(metaScript);
  };
  const startLinkedIn = () => {
    // All four current marketing pages contain newsletter forms. Keep this tag
    // blocked there until a supported withdrawal method preserves unsent input.
    // Removing an executed script does not stop its timers or Website Actions.
    if (document.querySelector('form, input, textarea, [contenteditable="true"]') || linkedInStarted) return;
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
    if (!currentChoice()) { revoke(); return; }
    if (config.metaEnabled) startMeta();
    if (config.linkedInEnabled) startLinkedIn();
  };
  // Supplement CMP renewal with an explicit current-notice acknowledgement.
  // An initial CMP update or an old stored choice alone cannot write this marker.
  document.addEventListener('click', event => {
    if (event.isTrusted && event.target.closest?.('.cky-btn-accept, .cky-btn-preferences, .cky-btn-reject')) {
      gestureUntil = Date.now() + 1500;
    }
  }, true);
  document.addEventListener('cookieyes_consent_update', event => {
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
