/* Local presentation only: no network, analytics, shared likes or vendor calls. */
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
