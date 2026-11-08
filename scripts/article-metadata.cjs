'use strict';
// Offline article contract gate. Reads only reviewed source/artifact files;
// never fetches URLs, edits metadata, approves content or publishes anything.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ORIGIN = 'https://tournstack.com';
const fail = message => { throw Error('Article metadata: ' + message); };
const decode = value => String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, code) => {
  if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : +code.slice(1));
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[code.toLowerCase()];
});
function attrs(tag) {
  const result = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (Object.hasOwn(result, m[1])) fail('duplicate attribute ' + m[1]);
    result[m[1]] = decode(m[2] ?? m[3]);
  }
  return result;
}
const tags = (html, name) => [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(m => attrs(m[0]));
const text = html => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
function jsonld(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => attrs(m[1]).type === 'application/ld+json')
    .map(m => JSON.parse(m[2]));
}
function read(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) fail('path outside artifact');
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('not a regular file: ' + relative);
  if (!fs.realpathSync(target).startsWith(fs.realpathSync(root) + path.sep)) fail('linked parent outside artifact');
  return fs.readFileSync(target);
}
function resource(root, value) {
  const url = new URL(value, ORIGIN + '/');
  if (url.origin !== ORIGIN || url.search || url.username || url.password) fail('image must be a clean first-party HTTPS URL: ' + value);
  const relative = decodeURIComponent(url.pathname).slice(1);
  return {url: url.href, bytes: read(root, relative), relative};
}
function imageInfo(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return {type:'image/png', width:bytes.readUInt32BE(16), height:bytes.readUInt32BE(20)};
  }
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 4 <= bytes.length) {
      if (bytes[p++] !== 255) break;
      while (bytes[p] === 255) p++;
      const marker = bytes[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = bytes.readUInt16BE(p);
      if (length < 2 || p + length > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8)
        return {type:'image/jpeg', width:bytes.readUInt16BE(p+5), height:bytes.readUInt16BE(p+3)};
      p += length;
    }
  }
  if (bytes.length >= 30 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') {
    const kind = bytes.toString('ascii',12,16);
    if (kind === 'VP8X') return {type:'image/webp',width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
    if (kind === 'VP8 ' && bytes.subarray(23,26).equals(Buffer.from([157,1,42]))) return {type:'image/webp',width:bytes.readUInt16LE(26)&16383,height:bytes.readUInt16LE(28)&16383};
    if (kind === 'VP8L' && bytes[20] === 47) { const bits=bytes.readUInt32LE(21); return {type:'image/webp',width:1+(bits&16383),height:1+((bits>>>14)&16383)}; }
  }
  fail('unsupported or invalid image bytes');
}
function iso(value, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value || '');
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > new Date(Date.UTC(+m[1],+m[2],0)).getUTCDate() || +m[4] > 23 || +m[5] > 59 || +m[6] > 59 || !Number.isFinite(Date.parse(value)) || Date.parse(value) > now) fail('invalid or future publication/update timestamp');
  return Date.parse(value);
}
function visibleDate(value) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Ljubljana',day:'numeric',month:'numeric',year:'numeric'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(parts.month)-1];
  return `${Number(parts.day)} ${month} ${parts.year}`;
}
// Small structural reader for our generated cards. Raw script/style contents
// cannot masquerade as visible disclosure text. No network or browser needed.
function cardTree(html) {
  const root={name:'#root',children:[]}, stack=[root], nodes=[];
  const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-z][^>]*>|[^<]+/gi)) {
    const raw=m[0];
    if (raw.startsWith('<!--') || m[1]) continue;
    if (!raw.startsWith('<')) {stack.at(-1).children.push(raw);continue;}
    const name=/^<\/?([a-z][\w:-]*)/i.exec(raw)[1].toLowerCase();
    if (raw.startsWith('</')) {
      const at=stack.findLastIndex(n=>n.name===name);
      if (at>0) stack.length=at;
      continue;
    }
    const a=attrs(raw), node={name,attrs:a,raw,parent:stack.at(-1),children:[]};
    node.parent.children.push(node);nodes.push(node);
    if (!voids.has(name) && !raw.endsWith('/>')) stack.push(node);
  }
  return nodes;
}
const hasClass=(n,value)=>(n.attrs.class || '').split(/\s+/).includes(value);
const childrenOf=n=>n.children.filter(x=>typeof x!=='string');
const descendants=n=>childrenOf(n).flatMap(x=>[x,...descendants(x)]);
function hiddenDisclosure(n) {
  return /\s(?:hidden|inert)(?:\s|=|\/?>)/i.test(n.raw) || n.attrs['aria-hidden']?.toLowerCase()==='true' ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\.0*)?)\s*(?:!important\s*)?(?:;|$)/i.test(n.attrs.style || '') ||
    ['sr-only','visually-hidden'].some(c=>hasClass(n,c));
}
function disclosureText(n) {
  if (hiddenDisclosure(n)) return '';
  return n.children.map(x=>typeof x==='string'?decode(x):disclosureText(x)).join('');
}
function checkCardDisclosures(publicRoot, contracts, publicNames) {
  const pages=publicNames ? publicNames.filter(n=>n.endsWith('.html')) : fs.readdirSync(publicRoot).filter(n=>n.endsWith('.html'));
  for (const route of pages) {
    const cards=cardTree(read(publicRoot,route).toString('utf8')).filter(n=>n.name==='article' && (hasClass(n,'blog-feature') || hasClass(n,'blog-card')));
    for (const card of cards) {
      const images=descendants(card).filter(n=>n.name==='img');
      if (images.length!==1) fail(route+': listing card must contain one cover image');
      let imageLink=images[0].parent;
      while (imageLink && imageLink!==card && imageLink.name!=='a') imageLink=imageLink.parent;
      const destination=imageLink?.name==='a' ? new URL(imageLink.attrs.href || '',ORIGIN+'/'+route).href : null;
      const c=contracts.get(destination);
      if (!c) fail(route+': listing image has no matching article source contract');
      const graph=c.structured_data['@graph'], page=graph.find(n=>n['@type']==='WebPage' && n.url===destination);
      const primary=graph.find(n=>n['@id']===page?.primaryImageOfPage?.['@id']);
      const expected=primary?.caption;
      if (!expected) continue;
      const figure=images[0].parent?.name==='figure'?images[0].parent:imageLink.parent;
      const captions=figure?.name==='figure' ? childrenOf(figure).filter(n=>n.name==='figcaption') : [];
      if (captions.length!==1) fail(route+': visible adjacent listing image disclosure missing');
      const caption=captions[0];
      // Pagination intentionally hides whole cards until selected. The caption
      // must remain visible/accessibly available whenever its own card is shown.
      for (let n=caption;n && n!==card;n=n.parent) if (hiddenDisclosure(n)) fail(route+': listing image disclosure is hidden');
      if (disclosureText(caption).replace(/\s+/g,' ').trim()!==String(expected).replace(/\s+/g,' ').trim()) fail(route+': listing image disclosure differs from source caption');
    }
  }
}
function check(root, {now=Date.now(), publicRoot=root, publicNames=null} = {}) {
  root=path.resolve(root); publicRoot=path.resolve(publicRoot);
  const manifestFile=path.join(root,'blog-build-manifest.json');
  if (!fs.existsSync(manifestFile)) return {result:'PASS',articles:0};
  const manifest=JSON.parse(read(root,'blog-build-manifest.json'));
  if (!Array.isArray(manifest.articles)) fail('missing article register');
  const assetsFile=path.join(root,'assets/asset-manifest.json');
  const assets=fs.existsSync(assetsFile) ? JSON.parse(read(root,'assets/asset-manifest.json')).assets : [];
  const normalize = v => {
    if (typeof v === 'string') {
      const found=assets.find(a => v === ORIGIN+'/'+a.source || v === '/'+a.source || v === a.source);
      return found ? ORIGIN+found.url : v;
    }
    if (Array.isArray(v)) return v.map(normalize);
    return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x)])) : v;
  };
  const primaryGraph=jsonld(read(publicRoot,'index.html').toString('utf8')).flatMap(x=>x['@graph'] || [x]);
  const identity=primaryGraph.find(x=>x['@id']===ORIGIN+'/#organization');
  const contracts=new Map();
  for (const row of manifest.articles) {
    if (row.review_only) fail('preview article in production check');
    const c=normalize(row.metadata_contract);
    if (!c || c.format_version !== 1) fail(row.route+': missing source metadata contract; regenerate the article');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(row.route)) fail('invalid article route');
    const html=read(publicRoot,row.route).toString('utf8'), url=ORIGIN+'/'+row.route;
    contracts.set(url,c);
    const canonical=tags(html,'link').filter(a=>a.rel==='canonical');
    if (canonical.length!==1 || canonical[0].href!==url || c.canonical_url!==url) fail(row.route+': canonical mismatch');
    const titles=[...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
    if (titles.length!==1 || text(titles[0][1])!==c.title) fail(row.route+': title differs from source');
    if (tags(html,'html')[0]?.lang!==c.language) fail('HTML language differs from source');
    const meta={};
    for (const a of tags(html,'meta')) { const key=a.property || a.name; if (!key) continue; if (Object.hasOwn(meta,key)) fail('duplicate metadata '+key); meta[key]=a.content; }
    for (const [key,value] of Object.entries(c.meta || {})) if (meta[key]!==value) fail(row.route+': source metadata mismatch '+key);
    for (const key of ['description','robots','og:title','og:description','og:type','og:url','og:site_name','og:image','og:image:type','og:image:width','og:image:height','og:image:alt','twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt','article:published_time']) if (!meta[key]?.trim()) fail('missing required metadata '+key);
    for (const key of ['og:locale','article:modified_time']) if (!Object.hasOwn(c.meta,key) && Object.hasOwn(meta,key)) fail('unsupported inherited metadata '+key);
    if (meta['og:type']!=='article' || meta['og:url']!==url || meta['twitter:card']!=='summary_large_image' || /noindex|nofollow/i.test(meta.robots)) fail('incorrect article discovery/share policy');
    const graphs=jsonld(html);
    try { assert.deepEqual(graphs,[c.structured_data]); } catch { fail(row.route+': JSON-LD differs from source contract'); }
    const graph=graphs[0]?.['@graph'];
    if (!Array.isArray(graph)) fail('resolved article graph required');
    const ids=new Map();
    for (const n of graph) { if (!n['@id'] || ids.has(n['@id'])) fail('missing/duplicate entity ID'); ids.set(n['@id'],n); }
    const article=graph.find(n=>['BlogPosting','Article','NewsArticle'].includes(n['@type']));
    if (!article || article.url!==url || !article.headline || !article.description || article.inLanguage!==c.language) fail('article identity or language missing');
    const resolve=(v,type)=>{const n=ids.get(v?.['@id']);if (!n || n['@type']!==type) fail('unresolved '+type+' entity');return n;};
    const page=resolve(article.mainEntityOfPage,'WebPage'), website=resolve(page.isPartOf,'WebSite');
    if (page.url!==url || page.mainEntity?.['@id']!==article['@id']) fail('article/page relationships incomplete');
    const image=resolve(page.primaryImageOfPage,'ImageObject');
    if (article.image?.['@id']!==image['@id'] || !image.url || !image.width || !image.height) fail('primary article image incomplete');
    const publisher=resolve(article.publisher,'Organization'); resolve(publisher.logo,'ImageObject');
    if (!publisher.name || !publisher.url || website.publisher?.['@id']!==publisher['@id']) fail('publisher identity incomplete');
    if (!identity || JSON.stringify(publisher.sameAs)!==JSON.stringify(identity.sameAs) || !publisher.sameAs?.length) fail('publisher social identities differ from canonical site identity');
    for (const social of publisher.sameAs) if (new URL(social).protocol!=='https:') fail('social identity must use HTTPS');
    const authors=Array.isArray(article.author)?article.author:[article.author];
    if (!authors.length || authors.length!==c.authors.length) fail('author list incomplete');
    const byline=html.match(/<span\b[^>]*class="article-authors"[^>]*>([\s\S]*?)<\/span>/i);
    const authorLinks=byline ? [...byline[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)] : [];
    if (authorLinks.length!==c.authors.length) fail('visible author list incomplete');
    for (let i=0;i<authors.length;i++) {
      const a=resolve(authors[i],'Person'), expected=c.authors[i], link=authorLinks[i];
      if (a.name!==expected.name || a.url!==expected.url || a['@id']!==expected.id || text(link[2])!==expected.name || new URL(attrs(link[1]).href || '',url).href!==expected.url) fail('visible linked author differs from source');
    }
    const breadcrumbs=resolve(page.breadcrumb,'BreadcrumbList');
    if (!Array.isArray(breadcrumbs.itemListElement) || breadcrumbs.itemListElement.length!==c.breadcrumbs.length) fail('breadcrumbs incomplete');
    const nav=[...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)].find(m=>/breadcrumb/i.test(attrs(m[1])['aria-label'] || ''));
    if (!nav) fail('visible breadcrumb navigation missing');
    const visibleCrumbs=[...nav[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
    if (visibleCrumbs.length!==c.breadcrumbs.length) fail('visible breadcrumb count differs');
    for (let i=0;i<c.breadcrumbs.length;i++) {
      const bc=c.breadcrumbs[i], item=breadcrumbs.itemListElement[i];
      if (item.position!==i+1 || item.name!==bc.name || item.item!==bc.url || text(visibleCrumbs[i][1])!==bc.name) fail('breadcrumb source/schema/visible mismatch');
      const link=tags(visibleCrumbs[i][1],'a');
      if (i<c.breadcrumbs.length-1 ? link.length!==1 || new URL(link[0].href || '',url).href!==bc.url : !tags(visibleCrumbs[i][1],'span').some(x=>x['aria-current']==='page')) fail('visible breadcrumb destination differs');
      const target=new URL(bc.url);if (target.origin!==ORIGIN) fail('breadcrumb parent must be a real site page');read(publicRoot,target.pathname==='/'?'index.html':target.pathname.slice(1));
    }
    const publisherMarkup=html.match(/<[^>]*class="[^"]*article-publisher[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span|div)>/i);
    if (!publisherMarkup || !text(publisherMarkup[1]).includes(c.publisher.name)) fail('visible publisher attribution missing');
    const published=iso(article.datePublished,now);
    if (article.datePublished!==c.dates.published || meta['article:published_time']!==article.datePublished) fail('publication fields differ');
    if (article.dateModified) {if (iso(article.dateModified,now)<published || article.dateModified!==c.dates.modified || meta['article:modified_time']!==article.dateModified) fail('modification fields differ');}
    else if (c.dates.modified || meta['article:modified_time']) fail('unsupported modification time');
    const times=[...html.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time>/gi)];
    for (const stamp of [article.datePublished,article.dateModified].filter(Boolean)) {
      if (!times.some(t=>attrs(t[1]).datetime===stamp && text(t[2])===visibleDate(stamp))) fail('visible date must match Europe/Ljubljana publication/update date');
    }
    const headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    if (headings.length!==1 || text(headings[0][1])!==article.headline) fail('article H1 differs from source headline');
    if (!Array.isArray(c.image_assets) || !c.image_assets.length) fail('missing decoded source image evidence');
    const decodedAssets=new Map();
    for (const entry of c.image_assets) {
      const media=resource(publicRoot,entry.url);
      if (!/^[a-f0-9]{64}$/.test(entry.sha256) || crypto.createHash('sha256').update(media.bytes).digest('hex')!==entry.sha256) fail('artifact image differs from fully decoded source bytes');
      if (publicNames && !publicNames.includes(media.relative)) fail('metadata image excluded from public artifact');
      decodedAssets.set(media.url,entry);
    }
    const share=resource(publicRoot,meta['og:image']), dimensions=imageInfo(share.bytes);
    if (dimensions.type!==meta['og:image:type'] || dimensions.width!==+meta['og:image:width'] || dimensions.height!==+meta['og:image:height']) fail('sharing image bytes/type/dimensions mismatch');
    if (meta['twitter:image']!==meta['og:image'] || !['image/jpeg','image/png'].includes(dimensions.type)) fail('sharing image compatibility mismatch');
    const primary=resource(publicRoot,image.url), decodedPrimary=decodedAssets.get(primary.url);
    // AVIF decoding was completed by Pillow before this exact SHA-256 entered
    // the reviewed source contract. Do not infer dimensions from its filename.
    const primaryDimensions=decodedPrimary?.type==='image/avif' ? decodedPrimary : imageInfo(primary.bytes);
    if (primaryDimensions.width!==image.width || primaryDimensions.height!==image.height) fail('article image dimensions differ from bytes');
    for (const media of [share,primary]) if (publicNames && !publicNames.includes(media.relative)) fail('metadata image excluded from public artifact');
    const cover=tags(html,'img').find(img=>img.alt===c.lead_image.alt && img.srcset);
    if (!cover || cover.loading==='lazy' || !cover.width || !cover.height || cover.fetchpriority!=='high') fail('responsive lead image or priority missing');
    const candidates=[cover.src, ...cover.srcset.split(',').map(x=>x.trim().split(/\s+/)[0])].filter(Boolean).map(x=>new URL(x,url).href);
    if ([...candidates,meta['og:image'],image.url].some(x=>!decodedAssets.has(x))) fail('rendered image lacks decoded source evidence');
    if (!candidates.includes(image.url) || image.url!==c.lead_image.url || image.width!==c.lead_image.width || image.height!==c.lead_image.height) fail('schema primary image absent from responsive cover');
    const sitemap=read(publicRoot,'sitemap.xml').toString('utf8');
    if (!sitemap.includes('<loc>'+url+'</loc>')) fail('published article missing from sitemap');
  }
  checkCardDisclosures(publicRoot,contracts,publicNames);
  return {result:'PASS',articles:manifest.articles.length};
}
module.exports={check,imageInfo,attrs,jsonld,visibleDate};
if (require.main===module) {
  try {console.log(JSON.stringify(check(process.argv[2] || path.resolve(__dirname,'..'))));}
  catch(error) {console.error(error.message);process.exitCode=1;}
}
