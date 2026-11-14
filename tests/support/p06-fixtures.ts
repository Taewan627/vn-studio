import type { VisualNovel,Scene } from '../../src/types';
export const P06_PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
export const P06_GIF='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
export function p06Fixture():VisualNovel{
 const scene=(id:string,targets:string[]=[]):Scene=>({id,name:id,stage:targets.length?'seung':'gyeol',backgroundUrl:'',presentCharacterIds:['alice','bob'],
  dialogue:[{characterId:'alice',expressionId:'alice_neutral',text:'Synthetic '+id},{characterId:'bob',expressionId:'bob_neutral',text:'Second '+id}],
  choices:targets.map(nextSceneId=>({text:'Go '+nextSceneId,nextSceneId}))});
 return {id:'proj_synthetic_p06',title:'Synthetic editor',description:'No real user records',coverUrl:P06_PNG,startSceneId:'entry',contentLanguage:'en',
  characters:[{id:'alice',name:'Alice synthetic',expressions:[{id:'alice_neutral',name:'중립',imageUrl:P06_PNG}]},
    {id:'bob',name:'Bob synthetic',expressions:[{id:'bob_neutral',name:'중립',imageUrl:P06_GIF}]}],
  scenes:[{...scene('entry',['left','right']),stage:'ki'},scene('left',['join']),scene('right',['join']),scene('join',['end']),scene('end'),scene('unused')]};
}
