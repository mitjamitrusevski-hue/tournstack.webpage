const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'tournstack-asset-check-'));
const write=(name,bytes)=>{const file=path.join(fixture,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
const run=(...args)=>cp.spawnSync(process.execPath,[path.join(fixture,'scripts/version-assets.cjs'),...args],{encoding:'utf8'});
try{
 write('scripts/version-assets.cjs',fs.readFileSync(path.join(__dirname,'version-assets.cjs')));
 write('assets/fonts/font.woff',Buffer.from([1,2,3]));write('assets/css/styles.css',"@font-face{src:url('../fonts/font.woff')}\r\nbody{color:red}");
 write('assets/js/app.js','window.fixture=true;\r\n');
 write('index.html','<h1>Unchanged content</h1><link href="assets/css/styles.css?v=1"><script src="assets/js/app.js?v=1"></script>');
 assert.notEqual(run('--check').status,0);assert.equal(run().status,0);assert.equal(run('--check').status,0);
 const first=JSON.parse(fs.readFileSync(path.join(fixture,'assets/asset-manifest.json')));
 write('assets/fonts/font.woff',Buffer.from([4,5,6]));assert.notEqual(run('--check').status,0);assert.equal(run().status,0);
 const second=JSON.parse(fs.readFileSync(path.join(fixture,'assets/asset-manifest.json')));
 for(const source of ['assets/fonts/font.woff','assets/css/styles.css']){
  const a=first.assets.find(x=>x.source===source),b=second.assets.find(x=>x.source===source);assert.notEqual(a.url,b.url);assert(fs.existsSync(path.join(fixture,a.url)));assert(fs.existsSync(path.join(fixture,b.url)));
 }
 const js=first.assets.find(x=>x.source==='assets/js/app.js');assert.equal(second.assets.find(x=>x.source===js.source).url,js.url);
 assert(fs.readFileSync(path.join(fixture,'index.html'),'utf8').includes('<h1>Unchanged content</h1>'));
 write(js.url,'tampered');assert.notEqual(run('--check').status,0,'historical immutable corruption must fail');
 console.log('Asset checks pass: stale references rejected, dependent CSS invalidated, unchanged URLs stable, older versions retained and tampering rejected.');
}finally{
 const resolved=path.resolve(fixture);assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('tournstack-asset-check-'));
 fs.rmSync(resolved,{recursive:true,force:true});
}
