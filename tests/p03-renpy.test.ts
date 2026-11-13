import assert from 'node:assert/strict';
import { test,before,after } from 'node:test';
import { build } from 'esbuild';
import { mkdirSync,writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import JSZip from 'jszip';
import type { VisualNovel,Scene } from '../types';
import { exportToRenpy } from '../services/exportService';
import { prepareRenpyExportData } from '../services/renpyExportData';
import { inspectRenpy } from './support/inspectRenpy';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
const directory=path.join(process.cwd(),'.phase1-local','p03','hook-tests');
let useFileIO:any;let assertions=0;
const records:{id:string;status:string}[]=[];
const originals=new Map<string,PropertyDescriptor|undefined>();
const originalCreate=Object.getOwnPropertyDescriptor(URL,'createObjectURL')!;
const originalRevoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL')!;
const originalError=console.error;
function equal(a:unknown,b:unknown){assertions++;assert.deepEqual(a,b)}
function same(a:unknown,b:unknown){assertions++;assert.strictEqual(a,b)}
function ok(v:unknown){assertions++;assert.ok(v)}
function regression(id:string,body:()=>Promise<void>|void){const record={id,status:'NOT RUN'};records.push(record);
  test(id,async()=>{try{await body();record.status='PASS'}catch(error){record.status='FAIL';throw error}})}
function scene(id:string,text:string,targets:string[]=[]):Scene{return {id,name:id,stage:targets.length?'ki':'gyeol',backgroundUrl:'',presentCharacterIds:[],
  dialogue:[{characterId:null,expressionId:null,text}],choices:targets.map(target=>({text:target,nextSceneId:target}))}}
function fixture(images=false):VisualNovel{return {id:'synthetic-P03',title:'Synthetic RenPy',description:'',coverUrl:'',startSceneId:'start',
  characters:[{id:'hero',name:'Synthetic hero',expressions:[{id:'neutral',name:'중립',imageUrl:images?png:''},{id:'smile',name:'Smile',imageUrl:images?png:''}]}],
  scenes:[scene('start','Opening',['left','right']),scene('left','Left',['join']),scene('right','Right',['join']),scene('join','Rejoin',['end_a','end_b']),scene('end_a','Ending A'),scene('end_b','Ending B')]
    .map(s=>({...s,backgroundUrl:images?png:'',presentCharacterIds:['hero'],dialogue:[{characterId:'hero',expressionId:'neutral',text:s.dialogue[0].text}]}))}}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
function inspected(vn:VisualNovel){const script=exportToRenpy(vn);return {script,plan:prepareRenpyExportData(vn),parsed:inspectRenpy(script)}}
function rejects(vn:VisualNovel,pattern:RegExp){assertions++;assert.throws(()=>exportToRenpy(vn),pattern)}
before(async()=>{
  mkdirSync(directory,{recursive:true});for(const name of ['document','alert'])originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
  const shims:Record<string,string>={react:`export const useRef=()=>({current:null});export const useState=v=>[v,()=>{}];`,language:`export const useLanguage=()=>({language:'en',t:s=>s});`,
    db:`const no=()=>{throw Error('Unexpected storage')};export const saveVisualNovelData=no,removeFromDB=no;`};
  const built=await build({stdin:{contents:`export {useFileIO} from './hooks/useFileIO';`,resolveDir:process.cwd(),loader:'ts',sourcefile:'p03-hook-entry.ts'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,metafile:true,
    plugins:[{name:'p03-ui-boundaries',setup(builder){
      builder.onResolve({filter:/^react$|^\.\.\/i18n\/LanguageProvider$|^\.\.\/utils\/db$/},args=>({path:args.path==='react'?'react':args.path.endsWith('LanguageProvider')?'language':'db',namespace:'p03-double'}));
      builder.onLoad({filter:/.*/,namespace:'p03-double'},args=>({contents:shims[args.path],loader:'js'}));
    }}]});
  if(Object.keys(built.metafile!.inputs).some(input=>/(?:^|\/)research\/|geminiService|server\/|^App\./.test(input)))throw Error('Forbidden runtime module');
  const file=path.join(directory,'hooks.cjs');writeFileSync(file,built.outputFiles[0].text);writeFileSync(path.join(directory,'METAFILE.json'),JSON.stringify(built.metafile,null,2));
  useFileIO=createRequire(import.meta.url)(file).useFileIO;
});
after(()=>{
  for(const [name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete(globalThis as any)[name]}
  Object.defineProperty(URL,'createObjectURL',originalCreate);Object.defineProperty(URL,'revokeObjectURL',originalRevoke);console.error=originalError;
  console.log('P03_ASSERTION_SUMMARY '+JSON.stringify({cases:records,assertions_executed:assertions,passed:records.filter(r=>r.status==='PASS').length,
    failed:records.filter(r=>r.status==='FAIL').length,not_run:records.filter(r=>r.status==='NOT RUN').length,
    scope:'Independent generated-subset inspector and actual hook ZIP reopening; NOT RenPy engine lint or playback'}));
});
async function download(vn:VisualNovel){
  const blobs:Blob[]=[];const alerts:string[]=[];
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:(blob:Blob)=>{blobs.push(blob);return'blob:synthetic'}});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:()=>{}});
  Object.defineProperty(globalThis,'alert',{configurable:true,value:(text:string)=>alerts.push(text)});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({click:()=>{}}),body:{appendChild:()=>{},removeChild:()=>{}}}});
  console.error=()=>{};
  try{await useFileIO({vn,setVisualNovel:()=>{throw Error('Unexpected mutation')},setSelectedSceneId:()=>{}}).handleExportToRenpy()}finally{console.error=originalError}
  const bytes=blobs[0]?new Uint8Array(await blobs[0].arrayBuffer()):undefined;
  const zip=bytes?await JSZip.loadAsync(bytes,{checkCRC32:true}):undefined;
  return {zip,bytes,alerts};
}
regression('R01 T01 minimal valid entry has unique labels and no phantom images',()=>{
  const vn=fixture();vn.characters=[];vn.scenes=[scene('start','Minimal')];const {parsed,plan}=inspected(vn);
  same(parsed.labels.size,2);same(plan.scenes[0].id,'start');ok(plan.scenes[0].label!=='start');same(parsed.images.size,0);
  equal(parsed.labels.get('start'),[{kind:'jump',target:plan.scenes[0].label}]);
});
regression('R02 T02 linear dialogue preserves exact order',()=>{
  const vn=fixture();vn.scenes[0].dialogue=Array.from({length:3},(_,i)=>({characterId:null,expressionId:null,text:'Line '+i}));
  const {parsed,plan}=inspected(vn);equal(parsed.labels.get(plan.scenes[0].label)!.filter(s=>s.kind==='say').map(s=>s.text),['Line 0','Line 1','Line 2']);
});
regression('R03 T03 multiple speakers reference the correct Character declarations',()=>{
  const vn=fixture();vn.characters.push({id:'other',name:'Other speaker',expressions:[]});
  vn.scenes[0].dialogue.push({characterId:'other',expressionId:null,text:'Second speaker'});
  const {parsed,plan}=inspected(vn);same(parsed.characters.size,2);
  const lines=parsed.labels.get(plan.scenes[0].label)!.filter(s=>s.kind==='say');same(parsed.characters.get(lines[0].speaker!),'Synthetic hero');same(parsed.characters.get(lines[1].speaker!),'Other speaker');
});
regression('R04 T04 simple menu choices retain target relationships',()=>{
  const vn=fixture();const {parsed,plan}=inspected(vn);const choices=parsed.labels.get(plan.scenes[0].label)!.filter(s=>s.kind==='choice');
  equal(choices.map(c=>c.target),vn.scenes[0].choices.map(c=>plan.scenes.find(s=>s.id===c.nextSceneId)!.label));
});
regression('R05 T05 both terminal endings have distinct labels, text and return',()=>{
  const {parsed,plan}=inspected(fixture());
  for(const [id,text]of [['end_a','Ending A'],['end_b','Ending B']]){const body=parsed.labels.get(plan.scenes.find(s=>s.id===id)!.label)!;
    equal(body.filter(s=>s.kind==='say').map(s=>s.text),[text]);same(body.at(-1)!.kind,'return')}
});
regression('R06 T06 both branches reconverge to the same mapped scene',()=>{
  const {parsed,plan}=inspected(fixture());const join=plan.scenes.find(s=>s.id==='join')!.label;
  for(const id of ['left','right'])equal(parsed.labels.get(plan.scenes.find(s=>s.id===id)!.label)!.filter(s=>s.kind==='choice').map(s=>s.target),[join]);
});
regression('R07 T07 normalized, numeric, keyword and Unicode IDs stay unique',()=>{
  const vn=fixture();const ids=['start','A-B','a_b','123','menu','場面'];
  const mapping=new Map(vn.scenes.map((s,i)=>[s.id,ids[i]]));vn.startSceneId=ids[0];
  vn.scenes.forEach((s,i)=>{s.id=ids[i];s.choices.forEach(c=>c.nextSceneId=mapping.get(c.nextSceneId)!)});
  const {parsed,plan}=inspected(vn);same(parsed.labels.size,ids.length+1);equal(plan.scenes.map(s=>s.id),ids);
  for(const label of parsed.labels.keys())ok(/^[a-z][a-z0-9_]*$/.test(label));
});
regression('R08 T08 malformed IDs, entry, choice, speaker and expression references reject',()=>{
  const base=fixture();let vn=structuredClone(base);vn.startSceneId='absent';rejects(vn,/INVALID_START_SCENE/);
  vn=structuredClone(base);vn.scenes[0].choices[0].nextSceneId='absent';rejects(vn,/BROKEN_SCENE_REFERENCE/);
  vn=structuredClone(base);vn.scenes[0].dialogue[0].characterId='absent';rejects(vn,/INVALID_CHARACTER_REFERENCE/);
  vn=structuredClone(base);vn.scenes[0].dialogue[0].expressionId='absent';rejects(vn,/INVALID_EXPRESSION_REFERENCE/);
  vn=structuredClone(base);vn.scenes[1].id=vn.scenes[0].id;rejects(vn,/DUPLICATE_SCENE_ID/);
});
regression('R09 T09 quotes, backslashes, CRLF and newlines are quoted as one statement',()=>{
  const vn=fixture();const text='"quoted" \\ path\nnew line\r\nnext\tend';vn.characters[0].name=text;vn.scenes[0].dialogue[0].text=text;vn.scenes[0].choices[0].text=text;
  const {parsed,plan}=inspected(vn);same(parsed.characters.get(plan.characters[0].variable),text);
  const body=parsed.labels.get(plan.scenes[0].label)!;same(body.find(s=>s.kind==='say')!.text,text);same(body.find(s=>s.kind==='choice')!.text,text);
});
regression('R10 T10 Korean English Japanese and JS line separators survive UTF-8',()=>{
  const vn=fixture();const text='한국어 English 日本語 🦊\u2028next\u2029line';vn.scenes[0].dialogue[0].text=text;
  const script=Buffer.from(exportToRenpy(vn),'utf8').toString('utf8');const parsed=inspectRenpy(script);
  same([...parsed.labels.values()].flat().find(s=>s.kind==='say')!.text,text);ok(script.includes('한국어 English 日本語'));
});
regression('R11 T11 empty and absent image properties produce no image file references',async()=>{
  const vn=fixture();delete(vn.characters[0].expressions[0]as any).imageUrl;delete(vn.scenes[0]as any).backgroundUrl;
  // Missing required image properties are rejected by the existing P01 contract.
  rejects(vn,/MISSING_FIELD/);const empty=fixture();const result=await download(empty);ok(result.zip);
  equal(Object.keys(result.zip!.files).filter(n=>!result.zip!.files[n].dir).sort(),['README.txt','id-map.json','script.rpy']);
  const parsed=inspectRenpy(await result.zip!.file('script.rpy')!.async('string'));same(parsed.images.size,0);
});
regression('R12 T12 actual ZIP includes Data URI bytes; unresolved local/remote assets reject',async()=>{
  const result=await download(fixture(true));ok(result.zip);writeFileSync(path.join(directory,'synthetic-renpy.zip'),result.bytes!);
  const script=await result.zip!.file('script.rpy')!.async('string');writeFileSync(path.join(directory,'synthetic-script.rpy'),script);
  const parsed=inspectRenpy(script);const expected=new Uint8Array(Buffer.from(png.split(',')[1],'base64'));
  for(const file of parsed.images.values()){ok(result.zip!.file(file));equal(await result.zip!.file(file)!.async('uint8array'),expected)}
  equal(Object.keys(result.zip!.files).filter(n=>!result.zip!.files[n].dir&&n.startsWith('images/')).sort(),[...parsed.images.values()].sort());
  for(const source of ['./missing.png','https://synthetic.invalid/a.png','blob:synthetic','data:image/svg+xml,%3Csvg/%3E']){
    const vn=fixture();vn.scenes[0].backgroundUrl=source;const failed=await download(vn);same(failed.zip,undefined);ok(failed.alerts[0].includes('Ren\'Py image export blocked'));
  }
});
regression('R13 T13 traversal-like IDs never become unsafe ZIP entries',async()=>{
  const vn=fixture(true);vn.characters[0].id='../../x';vn.characters[0].expressions[0].id='../evil';
  vn.scenes.forEach(s=>{s.presentCharacterIds=['../../x'];s.dialogue[0].characterId='../../x';s.dialogue[0].expressionId='../evil'});
  const result=await download(vn);ok(result.zip);
  for(const name of Object.keys(result.zip!.files)){ok(!name.includes('..'));ok(!name.includes('\\'));ok(!name.includes(':'));ok(!name.startsWith('/'))}
  const bad=fixture();bad.scenes[0].backgroundUrl='../../secret.png';rejects(bad,/UNRESOLVED_LOCAL_IMAGE/);
});
regression('R14 T14 script/interpolation/tag payloads remain inert literal text',()=>{
  const vn=fixture();const payload='"\ninit python:\n    synthetic = True\n[__import__("os")] {b}literal{/b}';
  vn.characters[0].name=payload;vn.scenes[0].dialogue[0].text=payload;vn.scenes[0].choices[0].text=payload;
  const {script,parsed,plan}=inspected(vn);ok(!/^\s*(?:init python:|\$ synthetic)/m.test(script));ok(script.includes('[[__import__'));ok(script.includes('{{b}'));
  same(parsed.characters.get(plan.characters[0].variable),payload);same(parsed.labels.get(plan.scenes[0].label)!.find(s=>s.kind==='say')!.text,payload);
});
regression('R15 T15 deeply frozen input survives success and rejection unchanged',()=>{
  const vn=freeze(fixture(true));const before=structuredClone(vn);inspected(vn);equal(vn,before);
  const bad=fixture();bad.scenes[0].choices[0].nextSceneId='missing';const frozen=freeze(bad);const prior=structuredClone(frozen);rejects(frozen,/BROKEN_SCENE_REFERENCE/);equal(frozen,prior);
});
regression('R16 T16 ordinary PNG output retains stable expression file names',()=>{
  const vn=fixture(true);vn.characters[0].id='stable_char';vn.characters[0].expressions=Array.from({length:5},(_,i)=>({id:'stable_expr_'+i,name:'Expression',imageUrl:png}));
  vn.scenes.forEach(s=>{s.presentCharacterIds=['stable_char'];s.dialogue[0].characterId='stable_char';s.dialogue[0].expressionId='stable_expr_1'});
  const {script,parsed}=inspected(vn);for(const e of vn.characters[0].expressions)ok(script.includes(`stable_char_${e.id}.png`));same(parsed.characters.get('stable_char'),'Synthetic hero');
});
regression('R17 shared image-tag namespaces and expression collisions cannot overwrite',()=>{
  const vn=fixture(true);vn.characters[0].id='bg_start';vn.characters[0].expressions[1].id='NEUTRAL';
  vn.scenes.forEach(s=>{s.presentCharacterIds=['bg_start'];s.dialogue[0].characterId='bg_start'});
  const {plan,parsed}=inspected(vn);same(new Set([...plan.characters.map(c=>c.imageTag),...plan.scenes.map(s=>s.imageTag)]).size,plan.characters.length+plan.scenes.length);
  same(plan.characters[0].expressions.length,2);same(parsed.images.size,8);
});
regression('R18 empty dialogue ending is structurally complete without invented text',()=>{
  const vn=fixture();vn.scenes[4].dialogue=[];const {plan,parsed}=inspected(vn);const body=parsed.labels.get(plan.scenes[4].label)!;
  equal(body.filter(s=>s.kind==='say'),[]);same(body.at(-1)!.kind,'return');
});
regression('R19 id-map preserves original IDs and choice target relationships',async()=>{
  const vn=fixture();const result=await download(vn);const map=JSON.parse(await result.zip!.file('id-map.json')!.async('string'));
  same(map.startSceneId,vn.startSceneId);equal(map.scenes.map((s:any)=>({id:s.id,targets:s.choiceTargets})),vn.scenes.map(s=>({id:s.id,targets:s.choices.map(c=>c.nextSceneId)})));
  equal(map.characters.map((c:any)=>({id:c.id,expressions:c.expressions.map((e:any)=>e.id)})),vn.characters.map(c=>({id:c.id,expressions:c.expressions.map(e=>e.id)})));
});
regression('R20 repeat exports are deterministic payloads and explicitly exclude unused cover',async()=>{
  const vn=fixture(true);vn.coverUrl='https://synthetic.invalid/unused-cover';const first=await download(vn);const second=await download(vn);ok(first.zip);ok(second.zip);
  for(const name of ['script.rpy','id-map.json'])same(await first.zip!.file(name)!.async('string'),await second.zip!.file(name)!.async('string'));
  ok((await first.zip!.file('README.txt')!.async('string')).includes('not a complete SDK or standalone executable'));
  ok(!Object.keys(first.zip!.files).some(n=>n.includes('cover')));
});
