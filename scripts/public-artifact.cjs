// Public Pages output only. This module never publishes or changes the Git index.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT_FILES = Object.freeze([
  'index.html', 'vision.html', 'faq.html', 'contact.html', 'privacy.html',
  'author-mitja-mitrusevski.html', 'inquiry-received.html', 'unsubscribe.html',
  'sitemap.xml', 'robots.txt', 'CNAME', '.nojekyll'
]);
const extensions = Object.freeze({
  brand: new Set(['.svg', '.png', '.webp']),
  images: new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']),
  fonts: new Set(['.woff', '.woff2', '.ttf', '.otf']),
  css: new Set(['.css']),
  js: new Set(['.js'])
});
function allowed(name) {
  if (ROOT_FILES.includes(name) || name === 'assets/fonts/OFL.txt') return true;
  const match = /^assets\/(versioned\/)?(brand|images|fonts|css|js)\/([^/]+)$/.exec(name);
  if (!match || match[3].startsWith('.') || !extensions[match[2]].has(path.posix.extname(match[3]))) return false;
  return !match[1] || /\.[a-f0-9]{16}\.[a-z0-9]+$/.test(match[3]);
}
function trackedEntries(root) {
  return cp.execFileSync('git', ['ls-files', '--stage', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean).map(record => {
    const match = /^(\d+) [a-f0-9]+ ([0-3])\t([\s\S]+)$/.exec(record);
    if (!match || match[2] !== '0') throw Error('Unmerged or invalid Git entry; resolve before publishing.');
    return {mode: match[1], name: match[3]};
  });
}
function selected(root, entries = trackedEntries(root)) {
  const names = [];
  for (const entry of entries) {
    if (!allowed(entry.name)) continue;
    if (!['100644', '100755'].includes(entry.mode)) throw Error('Public symlink or non-regular Git file: ' + entry.name);
    const file = path.resolve(root, entry.name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Public path must be a regular file: ' + entry.name);
    const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Public file escaped source root: ' + entry.name);
    names.push(entry.name);
  }
  for (const required of ROOT_FILES) if (!names.includes(required)) throw Error('Required public file missing or untracked: ' + required);
  return names.sort();
}
function verifyReferences(root, names) {
  const selectedNames = new Set(names);
  const check = (from, value) => {
    value = value.trim().replace(/&amp;/g, '&');
    if (!value || value.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(value)) return;
    const url = new URL(value, 'https://tournstack.com/' + from);
    if (url.origin !== 'https://tournstack.com') throw Error('Unsupported resource URL in ' + from);
    let target = decodeURIComponent(url.pathname).slice(1);
    if (!target || target.endsWith('/')) target += 'index.html';
    if (!selectedNames.has(target)) throw Error('Public reference excluded or untracked: ' + from + ' -> ' + target);
  };
  for (const name of names) {
    if (!/\.(?:html|css)$/.test(name)) continue;
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    if (name.endsWith('.html')) {
      for (const match of text.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) check(name, match[1]);
      for (const match of text.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
        for (const candidate of match[1].split(',')) check(name, candidate.trim().split(/\s+/)[0]);
      }
    } else {
      for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) check(name, match[1]);
    }
  }
}
function build(root, out, entries) {
  root = path.resolve(root);
  out = path.resolve(out);
  const names = selected(root, entries);
  verifyReferences(root, names);
  // A fresh directory avoids carrying stale operational files into the new artifact.
  if (fs.existsSync(out)) throw Error('Output already exists; use a new empty destination: ' + out);
  if (out === root || root.startsWith(out + path.sep)) throw Error('Output cannot contain the source tree.');
  fs.mkdirSync(out, {recursive: true});
  for (const name of names) {
    const destination = path.join(out, name);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(root, name), destination, fs.constants.COPYFILE_EXCL);
  }
  return names;
}
module.exports = {ROOT_FILES, allowed, trackedEntries, selected, verifyReferences, build};
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    const names = selected(root);
    verifyReferences(root, names);
    console.log('Public artifact check passed: ' + names.length + ' files.');
  } else if (args.length === 1) {
    console.log('Prepared ' + build(root, args[0]).length + ' public files.');
  } else throw Error('Usage: node scripts/public-artifact.cjs --check | <new-output-directory>');
}
