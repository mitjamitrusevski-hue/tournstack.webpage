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
function allowed(name, blogRoutes = []) {
  if (ROOT_FILES.includes(name) || blogRoutes.includes(name) || name === 'assets/fonts/OFL.txt') return true;
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
function blogManifest(root, entries, options = {}) {
  const filename = path.join(root, 'blog-build-manifest.json');
  if (!fs.existsSync(filename)) return {routes: []};
  const entry = entries.find(item => item.name === 'blog-build-manifest.json');
  if (!entry || !['100644', '100755'].includes(entry.mode) || !fs.lstatSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()) {
    throw Error('Blog build manifest must be a tracked regular file.');
  }
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (manifest.format_version !== 1 || !Array.isArray(manifest.routes) || !Array.isArray(manifest.articles) || !Array.isArray(manifest.preview_only)) {
    throw Error('Invalid Blog build manifest.');
  }
  const articleRoutes = manifest.articles.map(article => article.route);
  if (new Set(manifest.routes).size !== manifest.routes.length || new Set(articleRoutes).size !== articleRoutes.length) throw Error('Duplicate Blog routes.');
  for (const article of manifest.articles) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(article.route) || ROOT_FILES.includes(article.route) || article.route === 'blog.html' || article.route.startsWith('blog-page-') ||
      !/^[a-f0-9]{64}$/.test(article.source_sha256) || typeof article.review_only !== 'boolean') throw Error('Invalid Blog article identity or route.');
    if (!manifest.routes.includes(article.route)) throw Error('Blog article route omitted from catalogue.');
    if (!options.preview && (article.review_only || !article.publication_time)) throw Error('Review-only Blog article is not eligible for production: ' + article.route);
  }
  for (const route of manifest.routes) {
    if (typeof route !== 'string' || (!/^blog(?:-page-[2-9][0-9]*|-page-1[0-9]+)?\.html$/.test(route) && !articleRoutes.includes(route))) throw Error('Undeclared public Blog route.');
  }
  if (!options.preview && manifest.preview_only.length) throw Error('Review-only Blog build requires explicit --preview; it cannot be published.');
  if (!manifest.routes.includes('blog.html')) throw Error('Blog catalogue route is missing.');
  return manifest;
}
function selected(root, entries = trackedEntries(root), options = {}) {
  const blog = blogManifest(root, entries, options);
  const names = [];
  for (const entry of entries) {
    if (!allowed(entry.name, blog.routes)) continue;
    if (!['100644', '100755'].includes(entry.mode)) throw Error('Public symlink or non-regular Git file: ' + entry.name);
    const file = path.resolve(root, entry.name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Public path must be a regular file: ' + entry.name);
    const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Public file escaped source root: ' + entry.name);
    names.push(entry.name);
  }
  for (const required of [...ROOT_FILES, ...blog.routes]) if (!names.includes(required)) throw Error('Required public file missing or untracked: ' + required);
  if (!options.preview) for (const name of names.filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    if (/data-blog-preview\s*=\s*["']true["']/.test(html) || /\bdata-preview-date\s*=/.test(html) || html.includes('Shared likes are inactive in this staging build')) throw Error('Review-only HTML cannot enter a production artifact: ' + name);
  }
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
function build(root, out, entries, options = {}) {
  root = path.resolve(root);
  out = path.resolve(out);
  const names = selected(root, entries, options);
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
module.exports = {ROOT_FILES, allowed, trackedEntries, blogManifest, selected, verifyReferences, build};
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  const preview = args[0] === '--preview';
  if (preview) args.shift();
  if (args.length === 1 && args[0] === '--check') {
    const names = selected(root, undefined, {preview});
    verifyReferences(root, names);
    console.log('Public artifact check passed: ' + names.length + ' files.');
  } else if (args.length === 1) {
    console.log('Prepared ' + build(root, args[0], undefined, {preview}).length + (preview ? ' preview candidate files.' : ' public files.'));
  } else throw Error('Usage: node scripts/public-artifact.cjs [--preview] --check | <new-output-directory>');
}
