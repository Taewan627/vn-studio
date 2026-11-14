import assert from 'node:assert/strict';
import {test,before,after}from 'node:test';
import {incomingSceneChoices,characterReferences,editorSafetyMessage}from '../src/services/editorReferences';
import {validateVisualNovel}from '../src/services/validateVisualNovel';
import {compileP06Hook,setupP06,cleanupP06}from './support/p06-hook-host';
import {p06Fixture}from './support/p06-fixtures';

let assertions=0;
const records:{id:string;kind:'unit'|'hook';status:string;assertions:number}[]=[];
function equal(a:unknown,b:unknown){assertions++;assert.deepEqual(a,b)}
function same(a:unknown,b:unknown){assertions++;assert.strictEqual(a,b)}
function ok(v:unknown){assertions++;assert.ok(v)}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
function regression(id:string,body:()=>Promise<void>|void,kind:'unit'|'hook'='hook'){
 const record={id,kind,status:'NOT RUN',assertions:0};records.push(record);
 test(id,async()=>{const count=assertions;try{await body();record.status='PASS'}catch(error){record.status='FAIL';throw error}finally{record.assertions=assertions-count}});
}
before(async()=>{await compileP06Hook(process.env.P06_ORIGINAL==='1')});
after(()=>{cleanupP06();console.log('P06_ASSERTION_SUMMARY '+JSON.stringify({cases:records,assertions_executed:assertions,passed:records.filter(r=>r.status==='PASS').length,
 failed:records.filter(r=>r.status==='FAIL').length,not_run:records.filter(r=>r.status==='NOT RUN').length,
 unit_passed:records.filter(r=>r.kind==='unit'&&r.status==='PASS').length,hook_passed:records.filter(r=>r.kind==='hook'&&r.status==='PASS').length,
 scope:'Pure reference analysis + actual hook with React/storage/timer doubles; browser/IndexedDB reported separately'}))});

regression('U01 incoming references are enumerated without counting self-loops',()=>{
 const vn=p06Fixture();vn.scenes[3].choices.push({text:'self',nextSceneId:'join'});
 equal(incomingSceneChoices(vn,'join'),[{sceneId:'left',index:0},{sceneId:'right',index:0}]);equal(incomingSceneChoices(vn,'entry'),[]);
},'unit');
regression('U02 character consequences contain exact scene and line locations',()=>{
 equal(characterReferences(p06Fixture(),'alice'),{sceneIds:['entry','left','right','join','end','unused'],lines:['entry','left','right','join','end','unused'].map(sceneId=>({sceneId,index:0}))});
 equal(characterReferences(p06Fixture(),'absent'),{sceneIds:[],lines:[]});
},'unit');
regression('U03 reference analysis leaves a deeply frozen project unchanged',()=>{
 const vn=freeze(p06Fixture());const before=structuredClone(vn);incomingSceneChoices(vn,'join');characterReferences(vn,'alice');equal(vn,before);
},'unit');
regression('U04 destructive messages state counts, narration conversion and manual retargeting',()=>{
 const message=editorSafetyMessage('en','character',2,3);ok(message.includes('2 dialogue lines'));ok(message.includes('narration'));ok(message.includes('3 scene cast lists'));
 ok(editorSafetyMessage('en','incoming',2).includes('Remove or retarget'));ok(editorSafetyMessage('ko','entry').includes('시작 장면'));ok(editorSafetyMessage('ja','entry').includes('開始シーン'));
},'unit');
regression('Q01 T01 normal scene addition preserves existing scenes and stage policy',async()=>{
 const{host}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.addScene('new_scene','jeon');await host.flush();
 equal(host.value.vn.scenes.slice(0,6),before.scenes);same(host.value.vn.scenes[6].id,'new_scene');same(host.value.vn.scenes[6].stage,'jeon');same(host.value.vn.startSceneId,'entry');
});
regression('Q02 T02 ordinary unreferenced deletion removes only the selected scene',async()=>{
 const{host,context}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.deleteScene('unused');await host.flush();
 equal(host.value.vn.scenes,before.scenes.slice(0,5));equal(host.value.vn.characters,before.characters);same(context.confirmations.length,1);
});
regression('Q03 T03 referenced scene deletion cannot silently remove another branch',async()=>{
 const{host,context}=await setupP06();const before=host.value.vn;host.value.actions.deleteScene('left');await host.flush();await host.timers();
 same(host.value.vn,before);same(context.alerts.length,1);ok(context.alerts[0].includes('1 choices'));same(context.confirmations.length,0);same(context.writes.length,0);
});
regression('Q04 T04 start-scene deletion leaves entry, state and autosave untouched',async()=>{
 const{host,context}=await setupP06();const before=host.value.vn;host.value.actions.deleteScene('entry');await host.flush();await host.timers();
 same(host.value.vn,before);same(context.alerts.length,1);ok(context.alerts[0].includes('start scene'));same(context.writes.length,0);
});
regression('Q05 T05 changing one target preserves the other branch and every dialogue',async()=>{
 const{host}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.updateChoice('entry',0,'nextSceneId','end');await host.flush();
 same(host.value.vn.scenes[0].choices[0].nextSceneId,'end');equal(host.value.vn.scenes[0].choices[1],before.scenes[0].choices[1]);equal(host.value.vn.scenes.slice(1),before.scenes.slice(1));
 equal(host.value.vn.scenes[0].dialogue,before.scenes[0].dialogue);
});
regression('Q06 T06 changing speaker atomically clears the previous owners expression',async()=>{
 const{host}=await setupP06();const text=host.value.vn.scenes[0].dialogue[0].text;host.value.actions.updateDialogueLine('entry',0,'characterId','bob');await host.flush();
 equal(host.value.vn.scenes[0].dialogue[0],{characterId:'bob',expressionId:null,text});same(validateVisualNovel(host.value.vn).valid,true);
});
regression('Q07 narrator selection clears speaker and expression together',async()=>{
 const{host}=await setupP06();host.value.actions.updateDialogueLine('entry',0,'characterId',null);await host.flush();
 same(host.value.vn.scenes[0].dialogue[0].characterId,null);same(host.value.vn.scenes[0].dialogue[0].expressionId,null);
});
regression('Q08 selecting an existing expression and unchanged speaker remains valid',async()=>{
 const{host}=await setupP06();host.value.actions.updateDialogueLine('entry',0,'characterId','bob');await host.flush();
 host.value.actions.updateDialogueLine('entry',0,'expressionId','bob_neutral');await host.flush();host.value.actions.updateDialogueLine('entry',0,'characterId','bob');await host.flush();
 same(host.value.vn.scenes[0].dialogue[0].expressionId,'bob_neutral');same(validateVisualNovel(host.value.vn).valid,true);
});
regression('Q09 T09 cancelled character deletion preserves state and causes no save',async()=>{
 const{host,context}=await setupP06();context.confirmed=false;const before=host.value.vn;host.value.actions.deleteCharacter('alice');await host.flush();await host.timers();
 same(host.value.vn,before);same(context.confirmations.length,1);ok(context.confirmations[0].includes('6 dialogue lines'));same(context.writes.length,0);
});
regression('Q10 accepted character deletion narrates only that characters lines with explicit consent',async()=>{
 const{host,context}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.deleteCharacter('alice');await host.flush();
 equal(host.value.vn.characters,[before.characters[1]]);same(context.confirmations.length,1);
 host.value.vn.scenes.forEach((scene:any,i:number)=>{equal(scene.presentCharacterIds,['bob']);equal(scene.dialogue[0],{characterId:null,expressionId:null,text:before.scenes[i].dialogue[0].text});equal(scene.dialogue[1],before.scenes[i].dialogue[1]);equal(scene.choices,before.scenes[i].choices)});
});
regression('Q11 cancelled cast removal cannot silently change a speaker to narration',async()=>{
 const{host,context}=await setupP06();context.confirmed=false;const before=host.value.vn;host.value.actions.toggleCharacterInScene('entry','alice',false);await host.flush();await host.timers();
 same(host.value.vn,before);same(context.confirmations.length,1);ok(context.confirmations[0].includes('1 dialogue lines'));same(context.writes.length,0);
});
regression('Q12 accepted cast removal affects only the selected scene and retains text',async()=>{
 const{host,context}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.toggleCharacterInScene('entry','alice',false);await host.flush();
 same(context.confirmations.length,1);equal(host.value.vn.scenes[0].presentCharacterIds,['bob']);equal(host.value.vn.scenes[0].dialogue[0],{characterId:null,expressionId:null,text:before.scenes[0].dialogue[0].text});
 equal(host.value.vn.scenes.slice(1),before.scenes.slice(1));equal(host.value.vn.scenes[0].dialogue[1],before.scenes[0].dialogue[1]);
});
regression('Q13 T10 colliding composite image keys cannot corrupt an unrelated edit',async()=>{
 const vn=p06Fixture();vn.characters[0].id='actor_expr_mid';vn.characters[0].expressions[0].id='end';vn.characters[1].id='actor';vn.characters[1].expressions[0].id='mid_expr_end';
 vn.scenes.forEach(s=>{s.presentCharacterIds=['actor_expr_mid','actor'];s.dialogue[0].characterId='actor_expr_mid';s.dialogue[0].expressionId='end';s.dialogue[1].characterId='actor';s.dialogue[1].expressionId='mid_expr_end'});
 same(validateVisualNovel(vn).valid,true);const{host}=await setupP06(vn);const original=host.value.vn;const before=structuredClone(original);host.value.actions.updateTitle('Only title changed');await host.flush();
 equal(host.value.vn.characters,before.characters);equal(original,before);same(host.value.vn.coverUrl,before.coverUrl);
});
regression('Q14 T11 editing a frozen previous snapshot never writes into it',async()=>{
 const{host}=await setupP06();const previous=freeze(host.value.vn);const before=structuredClone(previous);host.value.actions.updateTitle('Changed');await host.flush();
 equal(previous,before);same(host.value.vn.title,'Changed');equal(host.value.vn.characters,before.characters);
});
regression('Q15 T12 autosave sees the final structural edit and paired speaker atomically',async()=>{
 const{host,context}=await setupP06();host.value.actions.updateDialogueLine('entry',0,'characterId','bob');host.value.actions.updateChoice('entry',0,'nextSceneId','end');await host.flush();await host.timers();
 same(context.writes.length,1);const saved=context.data.get('vn_proj_proj_synthetic_p06');equal(saved.scenes[0].dialogue[0],{characterId:'bob',expressionId:null,text:'Synthetic entry'});
 same(saved.scenes[0].choices[0].nextSceneId,'end');same(host.value.saveStatus,'saved');same(context.data.get('vn_project_list')[0].sceneCount,6);
});
regression('Q16 cancelled scene deletion preserves object identity, choices and autosave',async()=>{
 const{host,context}=await setupP06();context.confirmed=false;const before=host.value.vn;host.value.actions.deleteScene('unused');await host.flush();await host.timers();
 same(host.value.vn,before);same(context.confirmations.length,1);same(context.writes.length,0);
});
regression('Q17 T13 incomplete drafts with blank targets and dialogue stay editable and saveable',async()=>{
 const{host,context}=await setupP06();host.value.actions.addChoice('entry','');host.value.actions.addDialogueLine('entry');host.value.actions.addScene('draft','jeon');await host.flush();await host.timers();
 const vn=context.data.get('vn_proj_proj_synthetic_p06');same(vn.scenes.length,7);same(vn.scenes[0].choices.at(-1).nextSceneId,'');same(vn.scenes[0].dialogue.at(-1).text,'');same(vn.scenes[6].stage,'jeon');same(context.alerts.length,0);
});
regression('Q18 scene duplication keeps stage and intentionally disconnected draft choices',async()=>{
 const{host}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.duplicateScene('left');await host.flush();
 const copy=host.value.vn.scenes[2];ok(copy.id!=='left');same(copy.stage,before.scenes[1].stage);equal(copy.dialogue,before.scenes[1].dialogue);same(copy.choices[0].nextSceneId,'');equal(host.value.vn.scenes[0],before.scenes[0]);
});
regression('Q19 T14 normal character addition and unreferenced deletion preserve others',async()=>{
 const{host,context}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.addCharacter();await host.flush();const added=host.value.vn.characters[2];
 ok(added.expressions.length>0);host.value.actions.deleteCharacter(added.id);await host.flush();equal(host.value.vn.characters,before.characters);equal(host.value.vn.scenes,before.scenes);ok(context.confirmations[0].includes('0 dialogue lines'));
});
regression('Q20 deleting an unreferenced self-loop needs no unrelated branch deletion',async()=>{
 const{host}=await setupP06();host.value.actions.addChoice('unused','unused');await host.flush();const before=structuredClone(host.value.vn);
 host.value.actions.deleteScene('unused');await host.flush();equal(host.value.vn.scenes,before.scenes.slice(0,5));
});
regression('Q21 explicitly selecting another start enables safe old-entry deletion',async()=>{
 const{host}=await setupP06();host.value.actions.updateStartSceneId('unused');await host.flush();const before=structuredClone(host.value.vn);host.value.actions.deleteScene('entry');await host.flush();
 same(host.value.vn.startSceneId,'unused');equal(host.value.vn.scenes,before.scenes.slice(1));
});
regression('Q22 ordinary text, names and manual image edits preserve all other fields',async()=>{
 const{host}=await setupP06();const before=structuredClone(host.value.vn);host.value.actions.updateDialogueLine('entry',0,'text','');host.value.actions.updateScene('left','name','Edited');host.value.actions.updateCharacterExpressionUrl('bob','bob_neutral','');await host.flush();
 same(host.value.vn.scenes[0].dialogue[0].text,'');same(host.value.vn.scenes[1].name,'Edited');same(host.value.vn.characters[1].expressions[0].imageUrl,'');equal(host.value.vn.scenes.slice(2),before.scenes.slice(2));equal(host.value.vn.characters[0],before.characters[0]);
});
