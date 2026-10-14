(() => {
  'use strict';
  const form = document.querySelector('#newsletter-signup');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const email = form.elements.namedItem('Email');
  const status = document.querySelector('#newsletter-status');
  const endpoint = window.TOURNSTACK_CONFIG?.contactEndpoint || '';
  const siteKey = window.TOURNSTACK_CONFIG?.turnstileSiteKey || '';
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint) && /^0x[\w-]+$/.test(siteKey);
  let widgetId, pending = null, timer = null, started = false;
  button.disabled = true;
  if (!configured) { status.textContent = 'Signup is temporarily unavailable.'; return; }
  form.action = endpoint;
  const expired = () => { button.disabled = true; status.textContent = 'Please complete the human check again.'; };
  const render = () => {
    if (!window.turnstile || widgetId !== undefined) return;
    widgetId = window.turnstile.render('#newsletter-turnstile', {
      sitekey: siteKey, action: 'newsletter', theme: 'dark', size: 'compact',
      callback: () => { if (!pending) button.disabled = false; if (/^(Checking that|The human check|Please complete)/.test(status.textContent)) status.textContent = ''; },
      'expired-callback': expired,
      'error-callback': () => { button.disabled = true; status.textContent = 'The human check could not load. Please refresh and try again.'; }
    });
  };
  const start = () => {
    if (started) return;
    started = true;
    status.textContent = 'Checking that you’re human…';
    if (window.turnstile) { render(); return; }
    let script = [...document.scripts].find(s => s.src.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js'));
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.addEventListener('load', render, {once:true});
      script.addEventListener('error', () => { status.textContent = 'The human check could not load. Please refresh and try again.'; }, {once:true});
      document.head.append(script);
    } else script.addEventListener('load', render, {once:true});
  };
  form.addEventListener('focusin', start, {once:true});
  const reset = () => {
    button.disabled = true;
    form.removeAttribute('aria-busy');
    if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
  };
  form.addEventListener('submit', event => {
    email.value = email.value.trim();
    if (pending || widgetId === undefined || !window.turnstile?.getResponse(widgetId) || !form.reportValidity()) {
      event.preventDefault(); if (!pending) status.textContent = 'Enter your email and complete the human check.'; return;
    }
    pending = window.crypto.randomUUID();
    form.elements.namedItem('SubmissionId').value = pending;
    form.elements.namedItem('Origin').value = window.location.origin;
    form.elements.namedItem('SourcePath').value = window.location.pathname;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your confirmation link…';
    timer = window.setTimeout(() => { pending = null; reset(); status.textContent = 'We couldn’t confirm the request. Please check your email or try again.'; }, 45000);
  });
  window.addEventListener('message', event => {
    let origin; try { origin = new URL(event.origin); } catch { return; }
    const google = origin.protocol === 'https:' && (origin.hostname === 'script.google.com' || origin.hostname === 'script.googleusercontent.com' || origin.hostname.endsWith('-script.googleusercontent.com'));
    const receipt = event.data;
    if (!google || !pending || receipt?.type !== 'tournstack-newsletter-result' || receipt.submissionId !== pending || typeof receipt.ok !== 'boolean') return;
    window.clearTimeout(timer); pending = null; reset();
    if (receipt.ok) { form.reset(); status.textContent = 'Check your email and confirm to join the list.'; }
    else status.textContent = 'We couldn’t send your confirmation link. Please try again.';
  });
})();
