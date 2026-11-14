import type { VisualNovel, Scene } from '../../src/types';

export const P04_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
export const P04_INJECTION = '</script><script>globalThis.__p04Injection=1</script><img src="https://synthetic.invalid/probe" onerror="globalThis.__p04Injection=2"> & 日本語';
export function p04Fixture(images = true): VisualNovel {
  const image = images ? P04_PIXEL : '';
  const scene = (id: string,text: string,targets: [string,string][]=[]): Scene => ({
    id,name:id,stage:targets.length?'seung':'gyeol',backgroundUrl:image,presentCharacterIds:['hero_日本'],
    dialogue:[{characterId:'hero_日本',expressionId:'neutral',text}],choices:targets.map(([text,nextSceneId])=>({text,nextSceneId})),
  });
  const entry=scene('entry','First narrative line.',[['Left','left'],['Right','right']]);
  entry.stage='ki';entry.dialogue.push({characterId:'hero_日本',expressionId:'smile',text:'Choose a branch.'});
  return {id:'synthetic-p04',title:'Offline synthetic VN',description:'Two branches, one join, two endings.',contentLanguage:'en',coverUrl:image,startSceneId:'entry',
    characters:[{id:'hero_日本',name:'Synthetic hero',expressions:[{id:'neutral',name:'중립',imageUrl:image},
      {id:'smile',name:'Smile',imageUrl:images?P04_PIXEL.replace('data:image/png;','data:IMAGE/PNG;'):''}]}],
    scenes:[entry,scene('left','Left route.',[['Rejoin','join']]),scene('right','Right route.',[['Rejoin','join']]),
      scene('join','Rejoined route.',[['End A','ending_a'],['End B','ending_b']]),scene('ending_a','Ending A.'),scene('ending_b','Ending B.')]};
}
