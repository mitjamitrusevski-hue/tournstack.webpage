// Generate immutable public assets and update HTML. Keep canonical source files.
// Run after editing an asset: node scripts/version-assets.cjs
// Verify before publishing: node scripts/version-assets.cjs --check
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),check=process.argv.includes('--check');
const manifestPath=path.join(root,'assets/asset-manifest.json');
const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{assets:[]};
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const canonical=(b,ext)=>['.css','.js','.svg'].includes(ext)?Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n')):b;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const originals=walk(path.join(root,'assets')).filter(f=>!f.includes(path.sep+'versioned'+path.sep)&&/\.(css|js|svg|png|webp|avif|woff2?)$/.test(f)).sort();
const mapping=new Map(),outputs=new Map(),assets=[];
function compile(file){
 const source=path.relative(root,file).split(path.sep).join('/'),ext=path.extname(file);
 const original=canonical(fs.readFileSync(file),ext);let bytes=original;
 if(source==='assets/css/styles.css')bytes=Buffer.concat([original,Buffer.from('\n/* Bundled Coach Niko frame shell. */\n'),canonical(fs.readFileSync(path.join(root,'assets/css/chatbot.css')),'.css')]);
 if(ext==='.css'){
  let css=bytes.toString('utf8');
  for(const [dependency,url] of mapping){
   const from=path.posix.relative(path.posix.dirname(source),dependency);
   const to=path.posix.relative('assets/versioned/css',url.slice(1));
   css=css.split(from).join(to);
  }
  bytes=Buffer.from(css);
 }
 const hash=digest(bytes),url='/assets/versioned/'+source.slice('assets/'.length,-ext.length)+'.'+hash.slice(0,16)+ext;
 mapping.set(source,url);outputs.set(url,bytes);
 assets.push({source,url,sha256:hash,source_sha256:digest(original),size_bytes:bytes.length});
}
// CSS depends on font/image URLs; hash those first.
originals.filter(f=>path.extname(f)!=='.css').forEach(compile);
originals.filter(f=>path.extname(f)==='.css').forEach(compile);
let problems=[];
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
 const filename=path.join(root,file),before=fs.readFileSync(filename,'utf8');let html=before;
 // Restore the last manifest's URLs so changed source assets get new URLs.
 for(const asset of previous.assets)html=html.split(asset.url.slice(1)).join(asset.source);
 for(const [source,url] of mapping){
  const pattern=new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?v=[A-Za-z0-9_-]+)?','g');
  html=html.replace(pattern,url.slice(1));
 }
 if(html!==before){if(check)problems.push(file+' references stale/unversioned assets');else fs.writeFileSync(filename,html);}
}
for(const [url,bytes] of outputs){
 const file=path.join(root,url.slice(1));
 if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(bytes))throw Error('Refusing to overwrite immutable asset '+url);}
 else if(check)problems.push('Missing generated asset '+url);
 else {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
}
// Historical URLs stay available for previously cached HTML and shared images.
const generated=path.join(root,'assets/versioned');
if(fs.existsSync(generated))for(const file of walk(generated)){
 if(path.basename(file).toLowerCase()==='desktop.ini')continue; // Drive/Windows metadata is not published.
 const match=path.basename(file).match(/\.([a-f0-9]{16})\.[a-z0-9]+$/);
 if(!match||digest(fs.readFileSync(file)).slice(0,16)!==match[1])throw Error('Invalid immutable asset '+path.relative(root,file));
}
const manifest=JSON.stringify({format_version:1,hash_algorithm:'sha256',hash_prefix_length:16,assets:assets.sort((a,b)=>a.source<b.source?-1:a.source>b.source?1:0)},null,2)+'\n';
if(check){if(!fs.existsSync(manifestPath)||fs.readFileSync(manifestPath,'utf8')!==manifest)problems.push('Asset manifest is stale');}
else fs.writeFileSync(manifestPath,manifest);
if(problems.length)throw Error(problems.join('\n')+'\nRun node scripts/version-assets.cjs and commit the generated files.');
console.log(JSON.stringify({mode:check?'check':'generate',assets:assets.length,status:'passed'}));
