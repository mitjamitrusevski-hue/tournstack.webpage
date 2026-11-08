'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {ROOT_FILES, allowed, selected, verifyReferences, build} = require('./public-artifact.cjs');
// Existing trusted CI invokes this suite; include metadata regressions without
// changing the pinned deployment workflows.
require('./article-metadata.test.cjs');
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tournstack-artifact-'));
  const root = path.join(base, 'source');
  fs.mkdirSync(root);
  const entries = [];
  const write = (name, content = '', mode = '100644') => {
    fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
    fs.writeFileSync(path.join(root, name), content);
    entries.push({name, mode});
  };
  for (const name of ROOT_FILES) write(name, name.endsWith('.html') ? '<!doctype html><h1>Fixture</h1>' : '');
  t.after(() => fs.rmSync(base, {recursive: true, force: true}));
  return {base, root, entries, write};
}
test('publish boundary excludes operational sources, credentials and unexpected asset types', () => {
  for (const name of ['README.md', 'CONSENT_SETUP.md', '.env', '.git/config', '.github/workflows/pages.yml',
    'integrations/google-apps-script/Code.gs', 'integrations/mailbox-smtp/.env.example', 'scripts/private.js',
    'assets/asset-manifest.json', 'assets/js/private.json', 'assets/js/.private.js', 'assets/images/private.pdf',
    'assets/images/desktop.ini', 'assets/versioned/js/arbitrary.js', 'assets/../secrets.js', 'new-unreviewed-page.html']) {
    assert.equal(allowed(name), false, name);
  }
  for (const name of [...ROOT_FILES, 'assets/fonts/OFL.txt', 'assets/images/mitja-mitrusevski.webp',
    'assets/brand/TS_Primary_H_FullColor_LightBG_RGB.svg', 'assets/js/chatbot.js',
    'assets/versioned/js/chatbot.a25299db8e2ec084.js']) assert.equal(allowed(name), true, name);
});
test('clean artifact retains public links, stable assets, historical hashed files and font license', t => {
  const f = fixture(t);
  f.write('assets/js/app.js', '/* source */');
  f.write('assets/versioned/js/app.0123456789abcdef.js', '/* retained */');
  f.write('assets/fonts/OFL.txt', 'Font license');
  f.write('integrations/private.json', '{"private":true}');
  fs.writeFileSync(path.join(f.root, 'index.html'), '<script src="assets/js/app.js"></script><a href="contact.html#contact-form">Contact</a>');
  const names = build(f.root, path.join(f.base, 'public'), f.entries);
  assert(names.includes('assets/versioned/js/app.0123456789abcdef.js'));
  assert(fs.existsSync(path.join(f.base, 'public/assets/fonts/OFL.txt')));
  assert(!fs.existsSync(path.join(f.base, 'public/integrations')));
  assert.throws(() => build(f.root, path.join(f.base, 'public'), f.entries), /already exists/);
});
test('symlink mode, missing required page and excluded linked resource fail closed', t => {
  const f = fixture(t);
  f.write('assets/js/bad.js', 'not a real symlink fixture', '120000');
  assert.throws(() => selected(f.root, f.entries), /symlink/);
  assert.throws(() => selected(f.root, f.entries.filter(x => !['assets/js/bad.js', 'contact.html'].includes(x.name))), /Required public file/);
  const names = selected(f.root, f.entries.filter(x => x.name !== 'assets/js/bad.js'));
  fs.writeFileSync(path.join(f.root, 'index.html'), '<script src="integrations/private.js"></script>');
  assert.throws(() => verifyReferences(f.root, names), /excluded or untracked/);
});
test('srcset and CSS font dependencies must remain public', t => {
  const f = fixture(t);
  f.write('assets/images/a.webp', 'image');
  f.write('assets/css/styles.css', 'body{background:url(../images/a.webp)}');
  fs.writeFileSync(path.join(f.root, 'index.html'), '<img srcset="assets/images/a.webp 1x, assets/images/missing.webp 2x">');
  assert.throws(() => verifyReferences(f.root, selected(f.root, f.entries)), /missing.webp/);
});

function blogFixture(f, review = true) {
  const manifest = {format_version: 1, routes: ['blog.html', 'first-story.html'], preview_only: review ? ['TS-BLOG-0001'] : [],
    articles: [{content_id: 'TS-BLOG-0001', route: 'first-story.html', source_sha256: 'a'.repeat(64), review_only: review, publication_time: review ? null : '2026-11-06T09:00:00+01:00'}]};
  f.write('blog-build-manifest.json', JSON.stringify(manifest));
  f.write('blog.html', '<h1>Stories</h1><a href="first-story.html">First story</a>');
  f.write('first-story.html', '<html' + (review ? ' data-blog-preview="true"' : '') + '><h1>Story</h1></html>');
  return manifest;
}

test('draft Blog candidate requires explicit preview and keeps its manifest private', t => {
  const f = fixture(t); blogFixture(f);
  assert.throws(() => selected(f.root, f.entries), /Review-only/);
  const names = selected(f.root, f.entries, {preview: true});
  assert(names.includes('first-story.html'));
  assert(!names.includes('blog-build-manifest.json'));
  const built = build(f.root, path.join(f.base, 'preview'), f.entries, {preview: true});
  assert(built.includes('blog.html'));
  assert(!fs.existsSync(path.join(f.base, 'preview/blog-build-manifest.json')));
});

test('eligible Blog routes must be tracked, declared and contain no preview marker', t => {
  const f = fixture(t); const manifest = blogFixture(f, false);
  assert(selected(f.root, f.entries).includes('first-story.html'));
  assert.throws(() => selected(f.root, f.entries.filter(x => x.name !== 'first-story.html')), /missing or untracked/);
  fs.writeFileSync(path.join(f.root, 'first-story.html'), '<html data-blog-preview="true">Draft</html>');
  assert.throws(() => selected(f.root, f.entries), /Review-only HTML/);
  fs.writeFileSync(path.join(f.root, 'first-story.html'), '<button disabled title="Shared likes are inactive in this staging build">Like</button>');
  assert.throws(() => selected(f.root, f.entries), /Review-only HTML/);
  fs.writeFileSync(path.join(f.root, 'first-story.html'), '<time datetime="2026-11-06" data-preview-date="true">6 Nov 2026</time>');
  assert.throws(() => selected(f.root, f.entries), /Review-only HTML/);
  fs.writeFileSync(path.join(f.root, 'first-story.html'), '<time datetime="2026-11-06T09:00:00+01:00">6 Nov 2026</time>');
  assert(selected(f.root, f.entries).includes('first-story.html'));
  manifest.routes.push('private.html');
  fs.writeFileSync(path.join(f.root, 'blog-build-manifest.json'), JSON.stringify(manifest));
  assert.throws(() => selected(f.root, f.entries, {preview: true}), /Undeclared/);
});
