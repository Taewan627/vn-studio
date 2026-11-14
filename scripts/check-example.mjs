import fs from'node:fs';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import assert from'node:assert/strict';import{build}from'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.resolve(process.env.VN_EXAMPLE_OUTPUT||path.join(root,'.local-validation/example'));
fs.mkdirSync(out,{recursive:true});
const compiled=path.join(out,'example-code.mjs');await build({stdin:{contents:"export {validateVisualNovel}from'./src/services/validateVisualNovel';export{exportToHtml}from'./src/services/exportService';export{prepareWebPackageAssets}from'./src/services/webPackageAssets';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',packages:'external',outfile:compiled});
const{validateVisualNovel,exportToHtml,prepareWebPackageAssets}=await import(pathToFileURL(compiled).href);
const vn=JSON.parse(fs.readFileSync(path.join(root,'examples/beacon.json'),'utf8'));const before=JSON.stringify(vn);let assertions=0;
function equal(a,b){assertions++;assert.deepStrictEqual(a,b)}function ok(v){assertions++;assert.ok(v)}
ok(validateVisualNovel(vn).valid);equal(vn.scenes.length,8);equal(vn.characters.length,2);
const prepared=prepareWebPackageAssets(vn);ok(prepared);
const html=exportToHtml(vn,false,'en');ok(html.includes('The Beacon Ledger'));ok(html.includes('ending-blue'));ok(html.includes('ending-amber'));equal(JSON.stringify(vn),before);
fs.writeFileSync(path.join(out,'example.html'),html);fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify({passed:1,failed:0,assertions_executed:assertions,scope:'Real validator and HTML exporter; browser replay is test:browser'},null,2)+'\n');
console.log('EXAMPLE_ASSERTION_SUMMARY '+JSON.stringify({passed:1,failed:0,assertions_executed:assertions}));
