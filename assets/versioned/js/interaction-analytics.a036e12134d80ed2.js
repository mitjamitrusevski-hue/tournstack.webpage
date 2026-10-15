(() => {
  'use strict';
  const track = (name, props) => {
    try { window.plausible?.(name, { props }); } catch (_) { /* Analytics must not interrupt navigation. */ }
  };
  const placement = (element) => {
    if (element.closest('.site-header')) return 'header';
    if (element.closest('.site-footer')) return 'footer';
    if (element.closest('#interest-prompt')) return 'invitation';
    if (element.closest('.hero, .vision-hero, .faq-hero, .contact-hero')) return 'hero';
    if (element.closest('.contact-section')) return 'contact-section';
    return 'body';
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let destination;
    try { destination = new URL(link.href, location.href); } catch (_) { return; }
    if (destination.protocol === 'mailto:') {
      track('Email Link Click', { placement: placement(link) });
    } else if (destination.origin === location.origin && destination.pathname === '/contact.html') {
      track('Contact Link Click', { placement: placement(link) });
    }
  });
  // Summary activation covers pointer, Enter and Space. Ignore automatic deep-link
  // openings and closing a question; count each intentional reopening.
  document.querySelectorAll('.faq-item > summary').forEach((summary) => {
    summary.addEventListener('click', (event) => {
      const question = summary.parentElement;
      if (!event.defaultPrevented && !question.open) {
        track('FAQ Answer Opened', {
          question: question.querySelector('.faq-question').textContent.trim(),
          question_id: question.id
        });
      }
    });
  });
})();
