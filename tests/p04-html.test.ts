import assert from 'node:assert/strict';
import { test,after } from 'node:test';
import { Script } from 'node:vm';
import { exportToHtml } from '../services/exportService';
import { prepareWebPackageAssets,WebPackageAssetError } from '../services/webPackageAssets';
import { p04Fixture,P04_INJECTION } from './support/p04-fixtures';

// Generation/static tests only: runtime behavior is tested by the real browser suite.
let assertions=0;
const records:{id:string;status:string}[]=[];
function equal(a:unknown,b:unknown){assertions++;assert.deepEqual(a,b)}
function ok(value:unknown){assertions++;assert.ok(value)}
function regression(id:string,body:()=>void){const record={id,status:'NOT RUN'};records.push(record);
  test(id,()=>{try{body();record.status='PASS'}catch(error){record.status='FAIL';throw error}})}
function embedded(html:string){return JSON.parse(html.match(/const vn = ([^\r\n]+);/m)![1])}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
after(()=>console.log('P04_ASSERTION_SUMMARY '+JSON.stringify({cases:records,assertions_executed:assertions,
  passed:records.filter(r=>r.status==='PASS').length,failed:records.filter(r=>r.status==='FAIL').length,not_run:records.filter(r=>r.status==='NOT RUN').length,
  scope:'Generation/static inspection; no mocked or real playback counted here'})));

regression('S01 T01 minimal HTML generation preserves an empty VN representation',()=>{
  const vn=p04Fixture(false);vn.characters=[];vn.scenes=[];
  const html=exportToHtml(vn);ok(html.includes('<!DOCTYPE html>'));equal(embedded(html),vn);
});
regression('S02 T02 complete local runtime is syntactically valid JavaScript',()=>{
  const html=exportToHtml(p04Fixture());const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];equal(scripts.length,1);
  new Script(scripts[0][1]);assertions++;
  for(const name of ['startGame','render','typeText','handleScreenClick','returnToTitle'])ok(scripts[0][1].includes('function '+name+'('));
});
regression('S03 T03 no external script or stylesheet dependencies',()=>{
  const html=exportToHtml(p04Fixture());ok(!/<script[^>]+src\s*=/i.test(html));ok(!/<link\b/i.test(html));
  ok(!/cdn\.tailwindcss\.com|@import|https?:\/\//i.test(html));
});
regression('S04 T04 local CSS and system font fallbacks are explicit',()=>{
  const html=exportToHtml(p04Fixture());ok(html.includes('font-family: system-ui'));ok(!/fonts\.google|@font-face/.test(html));
  for(const selector of ['#title-screen','#game-ui','#dialogue-text','.player-panel','.hidden'])ok(html.includes(selector));
});
regression('S05 T12 IDs, scene order, branches, dialogue and metadata are unchanged',()=>{
  const vn=p04Fixture();(vn.scenes[0].choices[0] as any).id='choice_ID_日本';(vn.scenes[4] as any).endingId='end-A';
  equal(embedded(exportToHtml(vn)),vn);
});
regression('S06 T13 narrative and title strings cannot close a script or create markup',()=>{
  const vn=p04Fixture();vn.title=P04_INJECTION;vn.description=P04_INJECTION;vn.characters[0].name=P04_INJECTION;
  vn.scenes[0].dialogue[0].text=P04_INJECTION;vn.scenes[0].choices[0].text=P04_INJECTION;
  const html=exportToHtml(vn);equal(embedded(html),vn);equal((html.match(/<script>/g)||[]).length,1);
  ok(!html.includes('<img src="https://synthetic.invalid/probe"'));ok(html.includes('&lt;/script&gt;'));
});
regression('S07 T13 unsupported cover and asset sources fail before HTML output',()=>{
  for(const source of ['https://synthetic.invalid/image.png',"x'); background-image:url(https://synthetic.invalid)",'javascript:alert(1)','data:image/svg+xml,%3Csvg/%3E','./assets/images/cover.png']){
    const vn=p04Fixture();vn.coverUrl=source;assertions++;assert.throws(()=>exportToHtml(vn),WebPackageAssetError);
  }
});
regression('S08 T14 deeply frozen input is unchanged in standalone and ZIP modes',()=>{
  const vn=freeze(p04Fixture());const before=structuredClone(vn);exportToHtml(vn);equal(vn,before);
  const packaged=freeze(prepareWebPackageAssets(vn).data);const prior=structuredClone(packaged);exportToHtml(packaged,true);equal(packaged,prior);
});
regression('S09 T15 only P02-shaped package paths are accepted in package mode',()=>{
  const vn=p04Fixture();const packaged=prepareWebPackageAssets(vn).data;equal(embedded(exportToHtml(packaged,true)),packaged);
  for(const source of ['../escape.png','./assets/images/../escape.png','//synthetic.invalid/a.png','./assets/images/%2e%2e/escape.png']){
    const invalid=structuredClone(packaged);invalid.coverUrl=source;assertions++;assert.throws(()=>exportToHtml(invalid,true),WebPackageAssetError);
  }
});
regression('S10 T16 existing API, language, IDs and inline data remain compatible',()=>{
  const vn=p04Fixture();vn.contentLanguage='ja';const before=structuredClone(vn);
  ok(exportToHtml(vn).includes('<html lang="ja">'));ok(exportToHtml(vn,true,'en').includes('<html lang="en">'));
  equal(embedded(exportToHtml(vn)),vn);equal(vn,before);ok(exportToHtml(vn).includes('data:image/png;base64,'));
});
