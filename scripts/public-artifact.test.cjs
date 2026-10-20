'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {ROOT_FILES, allowed, selected, verifyReferences, build} = require('./public-artifact.cjs');
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
