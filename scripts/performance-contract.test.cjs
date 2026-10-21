'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const pages=['index.html','vision.html','faq.html','contact.html','privacy.html','author-mitja-mitrusevski.html'];
test('public chat pages use one blocking CSS bundle and bounded required connection hints',()=>{
 for(const name of pages){const html=read(name),links=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]);
 const styles=links.filter(s=>/rel="stylesheet"/.test(s));assert.equal(styles.length,1,name);assert.match(styles[0],/assets\/versioned\/css\/styles\.[a-f0-9]{16}\.css/);
 const hints=links.filter(s=>/rel="preconnect"/.test(s));assert.equal(hints.length,2,name);
 for(const host of ['https://cdn-cookieyes.com','https://tournstack-public-chat.tournstack.workers.dev'])assert(hints.some(s=>s.includes('href="'+host+'"')),name+' required hint');
 const cmp=/<script\b[^>]*id="cookieyes"[^>]*>/i.exec(html)?.[0];assert(cmp,name+' hosted CMP');assert(!/\s(?:async|defer)(?:\s|>|=)/.test(cmp),'CMP ordering must not be changed for a score');
 }
 const manifest=JSON.parse(read('assets/asset-manifest.json')),bundle=manifest.assets.find(a=>a.source==='assets/css/styles.css');assert(bundle);
 assert(read(bundle.url.slice(1)).includes(read('assets/css/chatbot.css').replace(/\r\n/g,'\n').trim()),'frame CSS belongs in compiled main CSS');
});
test('mobile hero retains responsive density, format fallback, eager discovery and reviewed byte budgets',()=>{
 const html=read('index.html'),source=/<source type="image\/avif"[^>]+>/.exec(html)?.[0];assert(source);assert.match(source,/sizes="100vw"/);assert.match(source,/media="\(max-width: 760px\)"/);
 const candidates=[...source.matchAll(/(assets\/versioned\/images\/[^\s,"]+\.avif) (\d+)w/g)];assert.deepEqual(candidates.map(x=>Number(x[2])),[420,600,750,900]);
 const limits={420:14000,600:23000,750:31000,900:42000};for(const [,url,width]of candidates)assert(fs.statSync(path.join(root,url)).size<=limits[width],url+' exceeds reviewed delivery budget; review image quality and density before updating this bound');
 assert.match(html,/<source type="image\/webp" media="\(max-width: 760px\)"/);const hero=/<img src="[^\"]*TS_Hero_Tennis_Lifestyle_RGB[^>]+>/.exec(html)?.[0];assert(hero);assert.match(hero,/fetchpriority="high"/);assert(!/loading="lazy"/.test(hero));
});
