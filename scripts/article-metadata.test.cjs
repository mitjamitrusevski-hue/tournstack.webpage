'use strict';
// Exercise the actual generated article, then inject regressions found in the
// SEO audit. Temporary fixtures never touch the checkout or contact services.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {check, imageInfo, visibleDate} = require('./article-metadata.cjs');
const {build, ROOT_FILES} = require('./public-artifact.cjs');
const source = path.resolve(__dirname, '..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-article-metadata-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const manifest = JSON.parse(fs.readFileSync(path.join(source,'blog-build-manifest.json')));
  const row = manifest.articles.find(a=>!a.review_only && a.metadata_contract);
  assert(row, 'A generated published article is required as the regression fixture');
  // Keep every published contract: real listings/related cards can reference
  // other published articles as the catalogue grows.
  manifest.articles=manifest.articles.filter(a=>!a.review_only);
  manifest.routes=manifest.routes.filter(route=>!manifest.preview_only.includes(route));manifest.preview_only=[];
  for (const name of fs.readdirSync(source).filter(x=>x.endsWith('.html') || x==='sitemap.xml')) fs.copyFileSync(path.join(source,name),path.join(root,name));
  fs.cpSync(path.join(source,'assets'),path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'blog-build-manifest.json'), JSON.stringify(manifest));
  const filename=path.join(root,row.route);
  const change = f => fs.writeFileSync(filename,f(fs.readFileSync(filename,'utf8')));
  const changeMeta = (key,value) => change(html=>html.replace(new RegExp('(<meta (?:name|property)="'+key+'" content=")[^"]*'), '$1'+value));
  return {root,row,manifest,filename,change,changeMeta,now:Date.parse('2099-01-01T00:00:00Z')};
}
test('current generated contract passes independently of generator',t=>{
  const f=fixture(t);assert.deepEqual(check(f.root,{now:f.now}),{result:'PASS',articles:f.manifest.articles.length});
});
for (const [name,key,value] of [
  ['wrong JPEG MIME','og:image:type','image/webp'],
  ['wrong image dimensions','og:image:width','999'],
  ['lost approved social title','og:title','Unreviewed title'],
  ['wrong social description','twitter:description','Unreviewed description'],
  ['inherited website type','og:type','website'],
  ['wrong locale','og:locale','en_US'],
  ['indexing disabled','robots','noindex,nofollow']
]) test(name+' blocks release',t=>{
  const f=fixture(t);f.changeMeta(key,value);assert.throws(()=>check(f.root,{now:f.now}),/Article metadata/);
});
test('missing source contract blocks production artifact build before output exists',t=>{
  const f=fixture(t);delete f.row.metadata_contract;
  fs.writeFileSync(path.join(f.root,'blog-build-manifest.json'),JSON.stringify(f.manifest));
  // Keep this integration fixture minimal so the contract is the first failure.
  for (const name of ROOT_FILES) fs.writeFileSync(path.join(f.root,name),name.endsWith('.html')?'<h1>Fixture</h1>':'');
  fs.writeFileSync(f.filename,'<h1>Fixture</h1>');fs.writeFileSync(path.join(f.root,'blog.html'),'<h1>Stories</h1>');
  const entries=[...ROOT_FILES,'blog.html',f.row.route,'blog-build-manifest.json'].map(name=>({name,mode:'100644'}));
  const out=path.join(f.root,'public');
  assert.throws(()=>build(f.root,out,entries),/missing source metadata contract/);assert(!fs.existsSync(out));
});
test('unresolved author or missing social identity cannot silently pass',t=>{
  const f=fixture(t);f.change(html=>html.replace('"@type": "Person"','"@type": "Thing"'));
  assert.throws(()=>check(f.root,{now:f.now}),/JSON-LD differs/);
});
test('visible publisher and breadcrumbs are required, not only JSON-LD',t=>{
  const f=fixture(t);f.change(html=>html.replace(/class="article-publisher"/,'class="removed-publisher"'));
  assert.throws(()=>check(f.root,{now:f.now}),/publisher attribution/);
});
test('future publication date is rejected even when source and HTML agree',t=>{
  const f=fixture(t);assert.throws(()=>check(f.root,{now:Date.parse('2000-01-01T00:00:00Z')}),/future publication/);
});
test('sharing image bytes are checked even when all declarations agree',t=>{
  const f=fixture(t);const image=new URL(f.row.metadata_contract.meta['og:image']);
  fs.writeFileSync(path.join(f.root,decodeURIComponent(image.pathname).slice(1)),'not an image');
  assert.throws(()=>check(f.root,{now:f.now}),/decoded source bytes/);
});
test('truncated JPEG retaining its dimension header fails decoded-source binding',t=>{
  const f=fixture(t);const image=new URL(f.row.metadata_contract.meta['og:image']);
  const file=path.join(f.root,decodeURIComponent(image.pathname).slice(1));const raw=fs.readFileSync(file);
  fs.writeFileSync(file,raw.subarray(0,raw.length-100));
  assert.throws(()=>check(f.root,{now:f.now}),/decoded source bytes/);
});
for (const [name,mutation,reason] of [
  ['visible date',h=>h.replace(/(<time[^>]*>)[^<]+/,'$11 Jan 2000'),/visible date/],
  ['visible headline',h=>h.replace(/(<h1[^>]*>)[\s\S]*?<\/h1>/,'$1Different article</h1>'),/H1 differs/],
  ['visible author',h=>h.replace(/(<span class="article-authors"><a[^>]*>)[^<]+/,'$1Different Author'),/linked author differs/],
  ['breadcrumb destination',h=>h.replace(/(<nav class="article-breadcrumbs"[\s\S]*?href=")\/("[^>]*>)/,'$1/faq.html$2'),/breadcrumb destination/]
]) test(name+' must agree with approved source',t=>{
  const f=fixture(t);f.change(mutation);assert.throws(()=>check(f.root,{now:f.now}),reason);
});
test('published article must remain in sitemap',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.root,'sitemap.xml'),'<urlset/>');
  assert.throws(()=>check(f.root,{now:f.now}),/missing from sitemap/);
});
test('metadata image must be included in public artifact',t=>{
  const f=fixture(t);assert.throws(()=>check(f.root,{now:f.now,publicNames:[]}),/excluded from public artifact/);
});
test('unsupported image headers fail closed',()=>assert.throws(()=>imageInfo(Buffer.from('GIF89a')),/invalid image bytes/));
test('visible dates use fixed English labels and Ljubljana calendar boundaries',()=>{
  assert.equal(visibleDate('2026-09-06T12:00:00Z'),'6 Sep 2026');
  assert.equal(visibleDate('2026-11-06T23:30:00Z'),'7 Nov 2026');
  assert.equal(visibleDate('2026-06-30T22:30:00Z'),'1 Jul 2026');
});

function changeCard(f, route, kind, mutate) {
  const filename=path.join(f.root,route), before=fs.readFileSync(filename,'utf8');
  const pattern=new RegExp('<article\\b[^>]*class="'+kind+'"[^>]*>[\\s\\S]*?<\\/article>');
  assert(pattern.test(before),'Actual generated '+kind+' fixture is required');
  const after=before.replace(pattern,mutate);
  assert.notEqual(after,before,'Listing mutation must change the actual fixture');
  fs.writeFileSync(filename,after);
}
const removeCaption=html=>html.replace(/<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/,'');

for (const kind of ['blog-feature','blog-card']) test(kind+' needs its own adjacent visible source disclosure',t=>{
  const f=fixture(t);changeCard(f,'blog.html',kind,removeCaption);
  // The article itself and its JSON-LD caption remain intact.
  assert.throws(()=>check(f.root,{now:f.now}),/visible adjacent listing image disclosure missing/);
});

for (const attribute of ['aria-hidden="true"','hidden','style="display:none"']) test('listing caption hidden with '+attribute+' blocks release',t=>{
  const f=fixture(t);changeCard(f,'blog.html','blog-feature',h=>h.replace('<figcaption ','<figcaption '+attribute+' '));
  assert.throws(()=>check(f.root,{now:f.now}),/listing image disclosure is hidden/);
});

test('listing caption inside the inaccessible duplicate image link is rejected',t=>{
  const f=fixture(t);changeCard(f,'blog.html','blog-feature',h=>h.replace(/<\/a>(<figcaption\b[^>]*>[\s\S]*?<\/figcaption>)/,'$1</a>'));
  assert.throws(()=>check(f.root,{now:f.now}),/visible adjacent listing image disclosure missing/);
});

test('listing caption must use the exact source wording, not metadata or hidden text',t=>{
  const f=fixture(t);changeCard(f,'blog.html','blog-card',h=>h.replace(/(<figcaption\b[^>]*>)([\s\S]*?)(<\/figcaption>)/,'$1<span aria-hidden="true">$2</span>Concept image.$3'));
  assert.throws(()=>check(f.root,{now:f.now}),/listing image disclosure differs from source caption/);
});

test('related cards also require adjacent disclosure and do not inherit article disclosure',t=>{
  const f=fixture(t), listing=fs.readFileSync(path.join(f.root,'blog.html'),'utf8');
  const card=listing.match(/<article\b[^>]*class="blog-card"[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert(card,'Actual generated archive card fixture is required');
  f.change(h=>h.replace('</main>','<section class="article-related">'+card+'</section></main>'));
  assert.equal(check(f.root,{now:f.now}).result,'PASS');
  changeCard(f,f.row.route,'blog-card',removeCaption);
  assert.throws(()=>check(f.root,{now:f.now}),/visible adjacent listing image disclosure missing/);
});

test('intentional pagination hiding preserves the disclosure when a whole card is revealed',t=>{
  const f=fixture(t);changeCard(f,'blog.html','blog-card',h=>h.replace('<article ','<article hidden '));
  assert.equal(check(f.root,{now:f.now}).result,'PASS');
});

test('production artifact construction rejects stripped listing disclosure before writing output',t=>{
  const f=fixture(t);
  for (const name of ROOT_FILES) if (!fs.existsSync(path.join(f.root,name))) fs.copyFileSync(path.join(source,name),path.join(f.root,name));
  const walk=(dir,prefix='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);
  const entries=walk(f.root).map(name=>({name,mode:'100644'}));
  changeCard(f,'blog.html','blog-feature',removeCaption);
  const out=path.join(f.root,'public');
  assert.throws(()=>build(f.root,out,entries),/visible adjacent listing image disclosure missing/);
  assert(!fs.existsSync(out),'Invalid artifact must not be written');
});
