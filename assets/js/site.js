(() => {
  'use strict';

  // Native disclosures remain usable if JavaScript is unavailable.
  const questions = [...document.querySelectorAll('.faq-item')];
  questions.forEach((question) => {
    question.addEventListener('toggle', () => {
      if (!question.open) return;
      questions.forEach((other) => {
        if (other !== question) other.open = false;
      });
    });
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    const blocks = document.querySelectorAll(
      '.section-intro, .feature, .audience-card, .example-panel, .team-card, ' +
      '.vision-editorial, .validation-panel, .roadmap-grid article, ' +
      '.contact-inner, .saas-inner, .faq-group-heading, .faq-item, ' +
      '.contact-intro, .contact-form-card'
    );
    const revealAll = () => {
      blocks.forEach((block) => block.classList.remove('reveal-pending'));
    };
    try {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      blocks.forEach((block) => {
        if (block.getBoundingClientRect().top < window.innerHeight) return;
        block.classList.add('reveal-block', 'reveal-pending');
        observer.observe(block);
      });
      reducedMotion.addEventListener('change', (event) => {
        if (event.matches) {
          observer.disconnect();
          revealAll();
        }
      });
    } catch {
      revealAll();
    }
  }

  const form = document.querySelector('#contact-form');
  if (form) {
    const name = form.elements.namedItem('Name');
    const email = form.elements.namedItem('Email');
    const inquiry = form.elements.namedItem('Inquiry');
    const status = document.querySelector('#contact-status');
    const button = form.querySelector('button[type="submit"]');
    const endpoint = window.TOURNSTACK_CONFIG?.contactEndpoint || '';
    const configured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);
    let pending = null;
    let timer = null;
    let lastPayload = '';
    let submissionId = '';
    button.disabled = !configured;
    if (configured) {
      form.action = endpoint;
      status.textContent = '';
    } else {
      status.textContent = 'The form is being connected. Please email info@tournstack.com for now.';
    }
    [name, inquiry].forEach((field) => {
      field.addEventListener('input', () => field.setCustomValidity(''));
    });
    form.addEventListener('submit', (event) => {
      if (!configured || pending) {
        event.preventDefault();
        return;
      }
      name.value = name.value.trim();
      email.value = email.value.trim();
      inquiry.value = inquiry.value.trim();
      name.setCustomValidity(name.value ? '' : 'Please enter your name.');
      inquiry.setCustomValidity(inquiry.value ? '' : 'Please enter your inquiry.');
      if (!form.reportValidity()) {
        event.preventDefault();
        return;
      }
      const payload = JSON.stringify([name.value, email.value, inquiry.value]);
      if (payload !== lastPayload) {
        submissionId = window.crypto.randomUUID();
        lastPayload = payload;
      }
      form.elements.namedItem('SubmissionId').value = submissionId;
      form.elements.namedItem('Origin').value = window.location.origin;
      pending = submissionId;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending your inquiry…';
      timer = window.setTimeout(() => {
        pending = null;
        button.disabled = false;
        form.removeAttribute('aria-busy');
        status.textContent = 'We could not confirm receipt. Your inquiry may already be saved. Please retry or email info@tournstack.com.';
      }, 45000);
      // Native POST into the hidden transport iframe. Success is shown only
      // after an authenticated-origin Google receipt with this request ID.
    });
    window.addEventListener('message', (event) => {
      let origin;
      try { origin = new URL(event.origin); } catch { return; }
      const googleOrigin = origin.protocol === 'https:' &&
        (origin.hostname === 'script.google.com' ||
         origin.hostname === 'script.googleusercontent.com' ||
         origin.hostname.endsWith('-script.googleusercontent.com'));
      const receipt = event.data;
      if (!googleOrigin || !pending || !receipt ||
          receipt.type !== 'tournstack-contact-result' ||
          receipt.submissionId !== pending || typeof receipt.ok !== 'boolean') return;
      window.clearTimeout(timer);
      pending = null;
      button.disabled = false;
      form.removeAttribute('aria-busy');
      if (receipt.ok) {
        form.reset();
        submissionId = '';
        lastPayload = '';
        status.textContent = 'Your inquiry has been received. Thank you — we’ll be in touch.';
      } else {
        status.textContent = 'Your inquiry could not be saved. Please try again or email info@tournstack.com.';
      }
    });
  }

  const prompt = document.querySelector('#interest-prompt');
  if (!prompt || form || document.body.dataset.page === 'thanks') return;

  const seenKey = 'tournstack-invitation-seen-v2';
  const elapsedKey = 'tournstack-invitation-elapsed-v2';
  const read = (key) => {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  };
  const write = (key, value) => {
    try { window.sessionStorage.setItem(key, value); } catch { /* Optional. */ }
  };
  if (read(seenKey)) return;

  const delay = 30000;
  let elapsed = Math.max(0, Math.min(delay, Number(read(elapsedKey)) || 0));
  let started = null;
  let timer = null;
  let shown = false;

  const pause = () => {
    if (started !== null) elapsed += performance.now() - started;
    started = null;
    window.clearTimeout(timer);
    timer = null;
    write(elapsedKey, String(Math.min(delay, elapsed)));
  };
  const show = () => {
    pause();
    if (shown || document.hidden) return;
    shown = true;
    write(seenKey, '1');
    prompt.hidden = false;
    // Non-modal invitation: no overlay, forced focus or notification permission.
  };
  const start = () => {
    if (shown || document.hidden || started !== null) return;
    started = performance.now();
    timer = window.setTimeout(show, Math.max(0, delay - elapsed));
  };
  const dismiss = () => {
    prompt.hidden = true;
    if (prompt.contains(document.activeElement)) {
      document.querySelector('.nav-contact')?.focus();
    }
  };
  prompt.querySelector('[data-dismiss-prompt]').addEventListener('click', dismiss);
  prompt.querySelector('a').addEventListener('click', () => {
    write(seenKey, '1');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !prompt.hidden) dismiss();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else start();
  });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', start);
  start();
})();
