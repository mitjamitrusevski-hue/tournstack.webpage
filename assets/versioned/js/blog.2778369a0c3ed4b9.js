/* Lightweight Blog presentation; first-party likes load near the control only. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const normalise = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const header = $('.site-header');
  if (header && window.ResizeObserver) new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  }).observe(header);
  const grid = $('[data-blog-grid]');
  if (grid) {
    const cards = Array.from(grid.querySelectorAll('[data-blog-card]'));
    const search = $('#blog-search');
    const categories = Array.from(document.querySelectorAll('[data-blog-category]'));
    const latest = $('[data-blog-latest]');
    const status = $('[data-blog-status]');
    const pagination = $('[data-blog-pagination]');
    const empty = $('[data-blog-empty]');
    let category = '', query = '', page = 1;
    const pageSize = 9;
    const load = () => {
      const params = new URLSearchParams(location.search);
      category = params.get('category') || '';
      query = params.get('q') || '';
      const routePage = Number((location.pathname.match(/blog-page-(\d+)\.html$/) || [])[1]) || 1;
      page = Math.max(1, parseInt(params.get('page'), 10) || routePage);
      if (!categories.some(button => button.dataset.blogCategory === category)) category = '';
      search.value = query;
    };
    function pageURL(number) {
      const url = new URL(!category && !query && number > 1 ? `blog-page-${number}.html` : 'blog.html', location.href);
      if (category) url.searchParams.set('category', category);
      if (query) url.searchParams.set('q', query);
      if ((category || query) && number > 1) url.searchParams.set('page', number);
      return `${url.pathname}${url.search}`;
    }
    function render(push = false) {
      const words = normalise(query).split(/\s+/).filter(Boolean);
      const results = cards.filter(card => (!category || card.dataset.category === category) && words.every(word => normalise(card.dataset.search).includes(word)));
      const pages = Math.max(1, Math.ceil(results.length / pageSize));
      page = Math.min(page, pages);
      const displayed = new Set(results.slice((page - 1) * pageSize, page * pageSize));
      cards.forEach(card => { card.hidden = !displayed.has(card); });
      categories.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.blogCategory === category)));
      latest.hidden = Boolean(query || category || page > 1);
      empty.hidden = results.length > 0;
      status.textContent = `${results.length} ${results.length === 1 ? 'story' : 'stories'}${results.length ? ` · ${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, results.length)}` : ''}`;
      pagination.replaceChildren();
      if (pages > 1) {
        const link = (number, label, current = false) => {
          const anchor = document.createElement('a'); anchor.href = pageURL(number); anchor.textContent = label;
          anchor.dataset.page = number;
          if (current) anchor.setAttribute('aria-current', 'page');
          pagination.append(anchor);
        };
        if (page > 1) link(page - 1, 'Previous');
        const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
        for (let number = windowStart; number <= Math.min(pages, windowStart + 4); number++) link(number, String(number), number === page);
        if (page < pages) link(page + 1, 'Next');
      }
      pagination.hidden = pages === 1;
      if (push) history.pushState(null, '', pageURL(page));
    }
    load(); render();
    let timer;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => {query = search.value; page = 1; render(true);}, 180); });
    categories.forEach(button => button.addEventListener('click', () => {category = button.dataset.blogCategory; page = 1; render(true);}));
    pagination.addEventListener('click', event => {
      const link = event.target.closest('a[data-page]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); page = Number(link.dataset.page); render(true);
      $('#blog-archive').scrollIntoView({block: 'start'});
    });
    window.addEventListener('popstate', () => {load(); render();});
    const carousel = $('[data-blog-carousel]');
    const dots = Array.from(document.querySelectorAll('[data-blog-slide]'));
    const slides = carousel ? Array.from(carousel.children) : [];
    dots.forEach(dot => dot.addEventListener('click', () => {
      const slide = slides[Number(dot.dataset.blogSlide)];
      carousel.scrollTo({left: slide.offsetLeft - slides[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }));
    if (carousel && dots.length) {
      let pending = false;
      carousel.addEventListener('scroll', () => {
        if (pending) return; pending = true;
        requestAnimationFrame(() => {
          const current = Math.min(slides.length - 1, Math.max(0, Math.round(carousel.scrollLeft / carousel.clientWidth)));
          dots.forEach((dot, index) => dot.setAttribute('aria-current', String(index === current))); pending = false;
        });
      }, {passive: true});
      carousel.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = Math.round(carousel.scrollLeft / carousel.clientWidth);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : Math.min(slides.length - 1, Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1)));
        dots[next].click();
      });
    }
  }
  const likeButtons = Array.from(document.querySelectorAll('[data-blog-like]'));
  if (likeButtons.length) {
    const disconnected = document.body.dataset.staging === 'true' || ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
    if (disconnected || likeButtons.every(button => button.disabled)) {
      likeButtons.forEach(button => {button.disabled = true; button.title = 'Likes are disconnected in staging';});
    } else {
      const article = likeButtons[0].dataset.blogLike;
      const buttons = likeButtons.filter(button => button.dataset.blogLike === article);
      const statuses = Array.from(document.querySelectorAll('[data-like-status]'));
      const storageKey = `ts-blog-like:${article}`;
      const endpoint = `/api/blog-likes/${encodeURIComponent(article)}`;
      let record = null, count = null, liked = false, busy = false, loaded = false, pendingLoad = null, pendingDesired = null;
      const say = message => statuses.forEach(status => {status.textContent = message;});
      const renderLike = () => buttons.forEach(button => {
        button.disabled = busy;
        button.setAttribute('aria-pressed', String(liked));
        button.textContent = `${liked ? '\u2665 Liked' : '\u2661 Like'}${count === null ? '' : ` \u00b7 ${count}`}`;
        button.setAttribute('aria-label', `${liked ? 'Remove your like' : 'Like this article'}${count === null ? '' : `; ${count} ${count === 1 ? 'like' : 'likes'}`}`);
      });
      function readStored() {
        try {
          const stored = JSON.parse(localStorage.getItem(storageKey));
          if (stored && /^[A-Za-z0-9_-]{43}$/.test(stored.token) && Number.isFinite(stored.expiresAt) && stored.expiresAt > Date.now()) return stored;
          if (stored) localStorage.removeItem(storageKey);
        } catch { /* No identifier is created until the reader asks to Like. */ }
        return null;
      }
      record = readStored();
      const headers = () => record ? {Authorization: `Bearer ${record.token}`} : {};
      async function requestLike(method, value) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(endpoint, {method, credentials: 'omit', cache: 'no-store',
            headers: {...headers(), ...(method === 'PUT' ? {'Content-Type': 'application/json'} : {})},
            ...(method === 'PUT' ? {body: JSON.stringify({liked: value})} : {}), signal: controller.signal});
          if (!response.ok) throw new Error(response.status === 429 ? 'Please wait a moment and try again.' : 'Likes are unavailable. Please try again.');
          const result = await response.json();
          if (result.article_id !== article || !Number.isSafeInteger(result.count) || result.count < 0 || typeof result.liked !== 'boolean') throw new Error('Likes are unavailable. Please try again.');
          count = result.count; liked = result.liked;
          if (record && result.expires_at) {
            record.expiresAt = result.expires_at * 1000;
            try {localStorage.setItem(storageKey, JSON.stringify(record));} catch { /* Memory retains this tab's retry identity. */ }
          }
          loaded = true; renderLike(); return true;
        } finally {clearTimeout(timer);}
      }
      function loadLike() {
        if (pendingLoad) return pendingLoad;
        pendingLoad = requestLike('GET').catch(() => {say('Like count unavailable. You can try again.'); return false;}).finally(() => {pendingLoad = null;});
        return pendingLoad;
      }
      buttons.forEach(button => button.addEventListener('click', async () => {
        if (busy) return;
        // Preserve the action the visible button offered, even if another tab
        // changes the shared state while this click waits for its lock/readback.
        if (pendingDesired === null) pendingDesired = !liked;
        busy = true; renderLike(); say('');
        try {
          const changeLike = async () => {
            // A completed load in this tab can predate another tab's first Like.
            // Wait for it before changing the token so its response cannot win.
            if (pendingLoad) await pendingLoad;
            record = readStored() || record;
            if (!(await loadLike())) return;
            if (!record) {
              const bytes = crypto.getRandomValues(new Uint8Array(32));
              const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
              record = {token, expiresAt: Date.now() + 180 * 86400000};
              try {localStorage.setItem(storageKey, JSON.stringify(record));} catch { /* Still idempotent within this tab. */ }
            }
            if (liked !== pendingDesired) await requestLike('PUT', pendingDesired);
            pendingDesired = null;
            say(liked ? 'Thanks for your like.' : 'Like removed.');
          };
          if (navigator.locks) await navigator.locks.request(storageKey, changeLike);
          else await changeLike();
        } catch (error) {
          // An interrupted write may have succeeded; reload before a later toggle.
          loaded = false;
          say(error.name === 'AbortError' ? 'No confirmation received. Please try again.' : error.name === 'TypeError' ? 'Likes are unavailable. Please try again.' : error.message);
        } finally {busy = false; renderLike();}
      }));
      renderLike();
      // Below-the-fold controls never add an initial network dependency.
      const observeLike = () => {
        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {observer.disconnect(); loadLike();}
          }, {rootMargin: '100px'});
          buttons.forEach(button => observer.observe(button));
        }
        // Without IntersectionObserver the explicit click performs the first read.
      };
      if (document.readyState === 'complete') observeLike();
      else window.addEventListener('load', observeLike, {once: true});
    }
  }
  document.querySelectorAll('[data-copy-article]').forEach(button => button.addEventListener('click', async () => {
    const status = $('[data-copy-status]');
    // Local previews copy their loopback route; a public article copies its clean canonical URL.
    const isLocal = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
    const url = isLocal ? `${location.origin}${location.pathname}` : button.dataset.copyArticle;
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Link copied'; button.textContent = 'Copied';
      setTimeout(() => {button.textContent = 'Copy link'; status.textContent = '';}, 2500);
    } catch {status.textContent = 'Copy is unavailable here. Copy the page address from your browser.';}
  }));
})();
