import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';import{build}from'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.resolve(process.env.VN_TEST_OUTPUT||path.join(root,'.local-validation/regression'));
fs.mkdirSync(out,{recursive:true});
const stages=[['P01A','p01-validation.test.ts',null],['P01B','p01-import.test.ts',"const output = path.join(root, '.phase1-local', 'p01b', 'hook-tests');"],['P02','p02-web-package.test.ts',"const directory = path.join(process.cwd(), '.phase1-local', 'p02', 'hook-tests');"],['P03','p03-renpy.test.ts',"const directory=path.join(process.cwd(),'.phase1-local','p03','hook-tests');"],['P04','p04-html.test.ts',null],['P05','p05-image-policy.test.ts',"const directory = path.join(root, '.phase1-local', 'phase2b', 'p05-tests');"],['P06','p06-editor.test.ts',null],['P07','p07-genre-image.browser.test.ts',null]];
const results=[];
for(const[label,name,old]of stages){
 let source=fs.readFileSync(path.join(root,'tests',name),'utf8');
 if(old){if(source.split(old).length!==2)throw Error('Artifact relocation anchor changed: '+label);source=source.replace(old,`const ${label==='P01B'?'output':'directory'} = ${JSON.stringify(path.join(out,label))};`);}
 const compiled=path.join(out,label+'.test.mjs');
 await build({stdin:{contents:source,sourcefile:name,loader:'ts',resolveDir:path.join(root,'tests')},bundle:true,platform:'node',format:'esm',packages:'external',outfile:compiled});
 const env={...process.env,P06_ARTIFACTS:path.join(out,'P06'),P07_ARTIFACTS:path.join(out,'P07'),APP_WORKSPACE:root,APP_E2E_ALLOW_LISTEN:'true'};
 const p=spawnSync(process.execPath,['--test','--experimental-test-isolation=none','--test-concurrency=1',compiled],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:240000});
 fs.writeFileSync(path.join(out,label+'-stdout.txt'),p.stdout||'');fs.writeFileSync(path.join(out,label+'-stderr.txt'),p.stderr||'');
 const match=(p.stdout||'').match(new RegExp(label+'_ASSERTION_SUMMARY (\\{[^\\r\\n]+\\})'));
 const result={label,exit_code:p.status,error:p.error?.message||null,result:match?JSON.parse(match[1]):null};results.push(result);
 console.log(label+' '+JSON.stringify(result));
 if(p.status!==0||!match){fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(results,null,2));process.exitCode=1;break;}
}
fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(results,null,2)+'\n');
