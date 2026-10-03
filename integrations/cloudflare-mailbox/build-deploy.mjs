import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
delete config.$schema;config.main='worker.mjs';
mkdirSync('deploy',{recursive:true});
const bundle=readFileSync('.worker-build/worker.js','utf8').replace(/^\/\/# sourceMappingURL=.*$/m,'');
writeFileSync('deploy/worker.mjs',bundle);
writeFileSync('deploy/wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
console.log('Prepared standalone deploy/worker.mjs and deploy/wrangler.jsonc. No secrets included.');
