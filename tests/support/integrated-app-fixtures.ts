import type{VisualNovel,Scene}from '../../src/types';
export const APP_PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
export const APP_GIF='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
export function integratedFixture():VisualNovel{
 const scene=(id:string,name:string,text:string,targets:[string,string][]=[],empty=false):Scene=>({id,name,stage:targets.length?'seung':'gyeol',backgroundUrl:empty?'':APP_PNG,
  presentCharacterIds:empty?[]:['actor'],dialogue:[{characterId:empty?null:'actor',expressionId:empty?null:'neutral',text}],choices:targets.map(([text,nextSceneId])=>({text,nextSceneId}))});
 const entry=scene('entry','Entry','E2E opening original',[['Left path','left'],['Right path','right']]);entry.stage='ki';entry.dialogue.push({characterId:'actor',expressionId:'happy',text:'Choose route.'});
 return{id:'foreign-synthetic-source',title:'Integrated synthetic novel',description:'Independent deterministic graph only',contentLanguage:'en',coverUrl:APP_PNG,startSceneId:'entry',
  characters:[{id:'actor',name:'Synthetic actor',expressions:[{id:'neutral',name:'중립',imageUrl:APP_PNG},{id:'happy',name:'Happy',imageUrl:APP_PNG}]}],
  scenes:[entry,scene('left','Left route','Route L.',[['Rejoin','join']],true),scene('right','Right route','Route R.',[['Rejoin','join']]),
   {...scene('join','Reunion','Reunion.',[['End A','ending_a'],['End B','ending_b']]),stage:'jeon'},scene('ending_a','Ending A','Ending A.',[],true),scene('ending_b','Ending B','Ending B.'),
   {...scene('unused','Unused','Unused draft.',[],true),stage:'jeon'}]};
}
export function baselineFixture():VisualNovel{return{id:'proj_e2e_baseline',title:'Existing synthetic baseline',description:'Must never be overwritten',coverUrl:APP_PNG,contentLanguage:'en',startSceneId:'baseline',characters:[],
 scenes:[{id:'baseline',name:'Baseline',stage:'ki',backgroundUrl:'',presentCharacterIds:[],dialogue:[{characterId:null,expressionId:null,text:'Baseline untouched.'}],choices:[]}]};}
