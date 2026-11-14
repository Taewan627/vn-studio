import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type { VisualNovel } from '../src/types';
import { prepareWebPackageAssets, WebPackageAssetError } from '../src/services/webPackageAssets';
import { prepareWebPackageData } from '../src/services/exportService';
import { fileToBase64 } from '../src/utils/imageProcessing';

// Authored synthetic fixtures only. Exercise the actual Web ZIP download handler,
// then independently reopen its bytes with JSZip. DOM/FileReader/storage are
// explicit contract doubles; no browser, IndexedDB, canvas, or provider execution.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
const directory = path.join(process.cwd(), '.phase1-local', 'p02', 'hook-tests');
let useFileIO: any;
let assertions = 0;
const records: { id: string; status: string }[] = [];
const originals = new Map<string, PropertyDescriptor | undefined>();
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')!;
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')!;
const originalError = console.error;
const clone = <T>(value: T): T => structuredClone(value);
function equal(a: unknown,b: unknown) { assertions++; assert.deepEqual(a,b); }
function same(a: unknown,b: unknown) { assertions++; assert.strictEqual(a,b); }
function ok(a: unknown) { assertions++; assert.ok(a); }
function regression(id: string, body: () => Promise<void> | void) {
  const record={id,status:'NOT RUN'};records.push(record);
  test(id,async()=>{try{await body();record.status='PASS'}catch(error){record.status='FAIL';throw error}});
}
function fixture(images = false): VisualNovel {
  return { id:'synthetic-local-project',title:'합성 ZIP / Synthetic',description:'Unicode 日本語',coverUrl:images?png:'',startSceneId:'start',
    characters:[{id:'char',name:'Synthetic',expressions:[{id:'neutral',name:'중립',imageUrl:images?png:''}]}],
    scenes:[{id:'start',name:'Start',stage:'ki',backgroundUrl:images?png:'',presentCharacterIds:['char'],
      dialogue:[{characterId:'char',expressionId:'neutral',text:'한글 日本語 <script> & "dialogue"'}],
      choices:[{text:'Left',nextSceneId:'left'},{text:'Right',nextSceneId:'right'}]},
      ...['left','right'].map(id=>({id,name:id,stage:'gyeol' as const,backgroundUrl:'',presentCharacterIds:[],
        dialogue:[{characterId:null,expressionId:null,text:'Ending '+id}],choices:[]}))]};
}
function imageUrls(vn: VisualNovel) {
  return [vn.coverUrl,...vn.characters.flatMap(c=>c.expressions.map(e=>e.imageUrl)),...vn.scenes.map(s=>s.backgroundUrl)];
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value;
}

before(async()=>{
  for(const name of ['document','alert','FileReader']) originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
  mkdirSync(directory,{recursive:true});
  const shims:Record<string,string>={
    react:`export const useRef=()=>({current:null});export const useState=v=>[v,()=>{}];`,
    language:`export const useLanguage=()=>({language:'en',t:s=>s});`,
    db:`const forbidden=()=>{throw Error('Storage outside Web ZIP test scope')};export const saveVisualNovelData=forbidden,removeFromDB=forbidden;`,
  };
  const result=await build({stdin:{contents:`export {useFileIO} from './src/hooks/useFileIO';`,resolveDir:process.cwd(),loader:'ts',sourcefile:'p02-hook-entry.ts'},
    bundle:true,platform:'node',format:'cjs',packages:'external',write:false,metafile:true,
    plugins:[{name:'p02-ui-boundaries',setup(builder){
      builder.onResolve({filter:/^react$|^\.\.\/i18n\/LanguageProvider$|^\.\.\/utils\/db$/},args=>({
        path:args.path==='react'?'react':args.path.endsWith('LanguageProvider')?'language':'db',namespace:'p02-double'}));
      builder.onLoad({filter:/.*/,namespace:'p02-double'},args=>({contents:shims[args.path],loader:'js'}));
    }}]});
  const inputs=Object.keys(result.metafile!.inputs);
  if(inputs.some(input=>/(?:^|\/)research\/|geminiService|server\/|^App\./.test(input))) throw Error('Forbidden runtime module');
  writeFileSync(path.join(directory,'METAFILE.json'),JSON.stringify(result.metafile,null,2));
  const file=path.join(directory,'hooks.cjs');writeFileSync(file,result.outputFiles[0].text);
  useFileIO=createRequire(import.meta.url)(file).useFileIO;
});
after(()=>{
  for(const [name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete (globalThis as any)[name]}
  Object.defineProperty(URL,'createObjectURL',originalCreate);Object.defineProperty(URL,'revokeObjectURL',originalRevoke);
  console.error=originalError;
  console.log('P02_ASSERTION_SUMMARY '+JSON.stringify({cases:records,assertions_executed:assertions,
    passed:records.filter(r=>r.status==='PASS').length,failed:records.filter(r=>r.status==='FAIL').length,
    not_run:records.filter(r=>r.status==='NOT RUN').length,scope:'Actual hook and JSZip reopen; synthetic DOM/FileReader/storage contracts, browser E2E NOT RUN'}));
});

async function download(vn:VisualNovel) {
  const blobs:Blob[]=[];const alerts:string[]=[];const names:string[]=[];const revoked:string[]=[];
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:(blob:Blob)=>{blobs.push(blob);return 'blob:synthetic-download'}});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:(url:string)=>revoked.push(url)});
  Object.defineProperty(globalThis,'alert',{configurable:true,value:(message:string)=>alerts.push(message)});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{
    createElement:(tag:string)=>{same(tag,'a');const a={href:'',download:'',click:()=>names.push(a.download)};return a},
    body:{appendChild:()=>{},removeChild:()=>{}},
  }});
  console.error=()=>{}; // Expected rejection diagnostics are asserted through the user alert.
  try{
    const io=useFileIO({vn,setVisualNovel:()=>{throw Error('Unexpected state change')},setSelectedSceneId:()=>{throw Error('Unexpected selection change')}});
    await io.handleExportWebPackage();
  }finally{console.error=originalError}
  let zip:JSZip|undefined;let data:VisualNovel|undefined;let html:string|undefined;
  if(blobs.length){
    same(blobs.length,1);zip=await JSZip.loadAsync(await blobs[0].arrayBuffer(),{checkCRC32:true});
    data=JSON.parse(await zip.file('project.json')!.async('string'));
    html=await zip.file('index.html')!.async('string');
  }
  return {zip,data,html,alerts,names,revoked};
}
function members(zip:JSZip){return Object.keys(zip.files).filter(name=>!zip.files[name].dir).sort()}
async function assertClosure(zip:JSZip,data:VisualNovel,html:string){
  const embedded=JSON.parse(html.match(/const vn = ([^\r\n]+);/m)![1]);equal(embedded,data);
  const references=imageUrls(data).filter(Boolean);
  for(const url of references){ok(url.startsWith('./assets/images/'));const member=url.slice(2);ok(zip.file(member));ok((await zip.file(member)!.async('uint8array')).length>0)}
  equal(members(zip).filter(name=>name.startsWith('assets/')),references.map(url=>url.slice(2)).sort());
}
function rejected(vn:VisualNovel,code:string,field:string){
  let caught:unknown;try{prepareWebPackageAssets(vn)}catch(error){caught=error}
  ok(caught instanceof WebPackageAssetError);
  ok((caught as WebPackageAssetError).issues.some(issue=>issue.code===code&&issue.path===field));
  return caught as WebPackageAssetError;
}

regression('Z01 minimal VN produces a real ZIP with JSON and HTML',async()=>{
  const vn=fixture();vn.characters=[];vn.scenes=vn.scenes.slice(1);vn.startSceneId='left';
  const result=await download(vn);ok(result.zip);equal(members(result.zip!),['index.html','project.json']);equal(result.data,vn);
  same(result.names.length,1);ok(result.names[0].endsWith('_web_package.zip'));equal(result.revoked,['blob:synthetic-download']);
});
regression('Z02 HTML embedded JSON and standalone JSON agree',async()=>{
  const result=await download(fixture(true));await assertClosure(result.zip!,result.data!,result.html!);
  ok(result.html!.includes('<html lang="en">'));ok(!result.html!.includes('data:image/png;base64,'));
});
regression('Z03 PNG Data URI bytes and MIME extension survive ZIP roundtrip',async()=>{
  const result=await download(fixture(true));
  const expected=new Uint8Array(Buffer.from(png.split(',')[1],'base64'));
  for(const url of imageUrls(result.data!).filter(Boolean)){ok(url.endsWith('.png'));equal(await result.zip!.file(url.slice(2))!.async('uint8array'),expected)}
});
regression('Z04 FileReader upload and persisted project string remain byte exact',async()=>{
  Object.defineProperty(globalThis,'FileReader',{configurable:true,value:class{result:any;onload:any;readAsDataURL(file:any){this.result=file.data;queueMicrotask(()=>this.onload({target:{result:file.data}}))}}});
  const uploaded=await fileToBase64({data:png} as any);same(uploaded,png);
  const vn=fixture();vn.characters[0].expressions[0].imageUrl=uploaded;
  const restored=clone(vn);const result=await download(restored);
  equal(await result.zip!.file(result.data!.characters[0].expressions[0].imageUrl.slice(2))!.async('uint8array'),new Uint8Array(Buffer.from(png.split(',')[1],'base64')));
  equal(restored,vn);
});
regression('Z05 cover, expressions and backgrounds have complete member closure',async()=>{
  const vn=fixture(true);vn.scenes[1].backgroundUrl=png;vn.characters[0].expressions.push({id:'happy',name:'Happy',imageUrl:png});
  const result=await download(vn);await assertClosure(result.zip!,result.data!,result.html!);ok(result.zip!.file('assets/images/cover.png'));
});
regression('Z06 normalized ID and case collisions cannot overwrite image files',async()=>{
  const vn=fixture(true);vn.characters=[{id:'A-B',name:'One',expressions:[{id:'C',name:'One',imageUrl:png},{id:'c',name:'Two',imageUrl:png}]},
    {id:'a_b',name:'Two',expressions:[{id:'c',name:'Three',imageUrl:png}]}];
  vn.scenes[0].presentCharacterIds=[];vn.scenes[0].dialogue=[{characterId:null,expressionId:null,text:'Narration'}];
  vn.scenes[1].id='START';vn.scenes[1].backgroundUrl=png;
  const result=await download(vn);await assertClosure(result.zip!,result.data!,result.html!);
  const paths=imageUrls(result.data!).filter(Boolean);same(new Set(paths.map(p=>p.toLowerCase())).size,paths.length);
  ok(paths.some(p=>p.includes('__2')));ok(paths.some(p=>p.includes('__3')));
});
regression('Z07 external and protocol-relative URLs fail explicitly without a ZIP',async()=>{
  const vn=fixture();vn.coverUrl='https://synthetic.invalid/private?token=DO_NOT_ECHO';vn.scenes[0].backgroundUrl='//synthetic.invalid/image.png';
  const error=rejected(vn,'EXTERNAL_IMAGE','/coverUrl');same(error.issues.length,2);ok(!error.message.includes('DO_NOT_ECHO'));
  const result=await download(vn);same(result.zip,undefined);same(result.names.length,0);ok(result.alerts[0].includes('EXTERNAL_IMAGE at /coverUrl'));
});
regression('Z08 unresolved relative, bundled, blob and IndexedDB pseudo URLs reject',async()=>{
  for(const [url,code]of [['./missing.png','UNRESOLVED_LOCAL_IMAGE'],['/quick-room.svg','UNRESOLVED_LOCAL_IMAGE'],['blob:synthetic','UNSUPPORTED_IMAGE_SOURCE'],['indexeddb:synthetic','UNSUPPORTED_IMAGE_SOURCE'],['file:///C:/image.png','UNSUPPORTED_IMAGE_SOURCE']]){
    const vn=fixture();vn.coverUrl=url;rejected(vn,code,'/coverUrl');const result=await download(vn);same(result.zip,undefined);
  }
});
regression('Z09 empty images never acquire invented paths or members',async()=>{
  const vn=fixture();const result=await download(vn);equal(imageUrls(result.data!),imageUrls(vn));
  equal(members(result.zip!),['index.html','project.json']);await assertClosure(result.zip!,result.data!,result.html!);
});
regression('Z10 traversal-like IDs cannot become ZIP paths; source paths reject',async()=>{
  const vn=fixture(true);vn.characters[0].id='../../C:\\outside';vn.characters[0].expressions[0].id='../%2e%2e/evil';vn.scenes[0].id='../../end';
  const result=await download(vn);
  for(const member of members(result.zip!)){ok(!member.includes('..'));ok(!member.includes('\\'));ok(!member.includes(':'));ok(!member.startsWith('/'))}
  same(result.data!.characters[0].id,vn.characters[0].id);same(result.data!.scenes[0].id,vn.scenes[0].id);
  for(const source of ['../../secret.png','/%2e%2e/secret.png','C:\\secret.png']){const bad=fixture();bad.coverUrl=source;const failed=await download(bad);same(failed.zip,undefined)}
});
regression('Z11 narrative IDs, Unicode, branches, dialogue and ending metadata survive',async()=>{
  const vn=fixture(true);(vn.scenes[0].choices[0] as any).id='choice-한국어';(vn.scenes[1] as any).endingId='ending-left';(vn as any).custom={extension:'preserved'};
  const before=clone(vn);const result=await download(vn);const restored=clone(result.data!);
  restored.coverUrl=vn.coverUrl;restored.characters.forEach((c,ci)=>c.expressions.forEach((e,ei)=>e.imageUrl=vn.characters[ci].expressions[ei].imageUrl));
  restored.scenes.forEach((s,i)=>s.backgroundUrl=vn.scenes[i].backgroundUrl);equal(restored,before);
});
regression('Z12 deeply frozen success and failure inputs remain unchanged',async()=>{
  const vn=freeze(fixture(true));const before=clone(vn);await download(vn);equal(vn,before);
  const failed=fixture();failed.coverUrl='https://synthetic.invalid/image.png';const frozen=freeze(failed);const previous=clone(frozen);
  rejected(frozen,'EXTERNAL_IMAGE','/coverUrl');equal(frozen,previous);
});
regression('Z13 previous PNG paths and stable expression IDs remain compatible',async()=>{
  const vn=fixture(true);vn.characters[0].id='stable_char';vn.characters[0].expressions=Array.from({length:5},(_,i)=>({id:'stable_expr_'+i,name:'Expression '+i,imageUrl:png}));
  const result=await download(vn);const legacy=prepareWebPackageData(vn);equal(legacy,result.data);
  for(let i=0;i<5;i++)same(legacy.characters[0].expressions[i].imageUrl,`./assets/images/characters/stable_char_stable_expr_${i}.png`);
  same(legacy.scenes[0].backgroundUrl,'./assets/images/backgrounds/bg_start.png');
});
regression('Z14 supported raster MIME types retain extensions and original bytes',async()=>{
  // Signature fixtures test MIME mapping and byte preservation, not visual decoding.
  for(const [mime,extension,bytes]of [
    ['image/jpeg','jpg',new Uint8Array([255,216,255,224,0,2,255,217])],
    ['image/gif','gif',new Uint8Array(Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64'))],
    ['image/webp','webp',new Uint8Array(Buffer.from('RIFF\u0004\u0000\u0000\u0000WEBP','binary'))],
  ] as const){
    const vn=fixture();vn.coverUrl=`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;const result=await download(vn);
    same(result.data!.coverUrl,`./assets/images/cover.${extension}`);equal(await result.zip!.file(`assets/images/cover.${extension}`)!.async('uint8array'),bytes);
  }
});
regression('Z15 percent-encoded PNG bytes are supported without UTF-8 corruption',async()=>{
  const bytes=Buffer.from(png.split(',')[1],'base64');const vn=fixture();vn.coverUrl='data:image/png,'+Array.from(bytes,b=>'%'+b.toString(16).padStart(2,'0')).join('');
  const result=await download(vn);equal(await result.zip!.file('assets/images/cover.png')!.async('uint8array'),new Uint8Array(bytes));
});
regression('Z16 malformed and unsupported Data URIs fail without phantom files',async()=>{
  for(const [url,code]of [['data:image/png;base64,%%%','INVALID_DATA_URI'],['data:image/png;base64,','INVALID_DATA_URI'],['data:image/png,%GG','INVALID_DATA_URI'],
    ['data:image/svg+xml,%3Csvg/%3E','UNSUPPORTED_IMAGE_MIME'],['data:text/html;base64,SGVsbG8=','UNSUPPORTED_IMAGE_MIME'],['data:image/jpeg;base64,'+png.split(',')[1],'IMAGE_MIME_MISMATCH']]){
    const vn=fixture();vn.coverUrl=url;rejected(vn,code,'/coverUrl');const result=await download(vn);same(result.zip,undefined);
  }
});
regression('Z17 repeated exports use deterministic mappings and preserve the cover',async()=>{
  const vn=fixture(true);const first=await download(vn);const second=await download(vn);
  equal(first.data,second.data);equal(members(first.zip!),members(second.zip!));
  for(const name of members(first.zip!))equal(await first.zip!.file(name)!.async('uint8array'),await second.zip!.file(name)!.async('uint8array'));
});
regression('Z18 asset rejection aggregates all field locations and leaves no download',async()=>{
  const vn=fixture();vn.coverUrl='http://synthetic.invalid/a';vn.characters[0].expressions[0].imageUrl='./missing.png';vn.scenes[0].backgroundUrl='blob:synthetic';
  const error=rejected(vn,'EXTERNAL_IMAGE','/coverUrl');equal(error.issues.map(i=>i.path),['/coverUrl','/characters/0/expressions/0/imageUrl','/scenes/0/backgroundUrl']);
  const result=await download(vn);same(result.zip,undefined);same(result.revoked.length,0);ok(result.alerts[0].includes('/characters/0/expressions/0/imageUrl'));
});
