import type { VisualNovel } from '../types';

/** References in other scenes only: a scene's own choices disappear with it. */
export function incomingSceneChoices(vn: VisualNovel, targetId: string) {
  return vn.scenes.flatMap(scene => scene.id === targetId ? [] : scene.choices.flatMap((choice,index) =>
    choice.nextSceneId === targetId ? [{ sceneId: scene.id, index }] : []));
}
export function characterReferences(vn: VisualNovel, characterId: string) {
  return {
    sceneIds: vn.scenes.filter(scene => scene.presentCharacterIds.includes(characterId)).map(scene => scene.id),
    lines: vn.scenes.flatMap(scene => scene.dialogue.flatMap((line,index) =>
      line.characterId === characterId ? [{ sceneId: scene.id, index }] : [])),
  };
}
export function editorSafetyMessage(language: string, kind: 'entry'|'incoming'|'scene'|'character'|'unstage', count=0, scenes=0): string {
  const messages = language === 'ko' ? {
    entry: '시작 장면은 삭제할 수 없습니다. 먼저 다른 시작 장면을 선택하세요.',
    incoming: `이 장면을 가리키는 선택지가 ${count}개 있습니다. 먼저 해당 선택지를 제거하거나 대상 장면을 변경하세요.`,
    scene: '이 장면과 포함된 대사·선택지를 삭제할까요? 다른 장면의 내용은 유지됩니다.',
    character: `캐릭터를 삭제할까요? ${count}개 대사는 텍스트를 유지한 채 내레이션으로 바뀌고 표정 참조가 해제됩니다. ${scenes}개 장면의 등장 목록에서도 제거됩니다.`,
    unstage: `장면에서 캐릭터를 제외할까요? ${count}개 대사는 텍스트를 유지한 채 내레이션으로 바뀌고 표정 참조가 해제됩니다.`,
  } : language === 'ja' ? {
    entry: '開始シーンは削除できません。先に別の開始シーンを選択してください。',
    incoming: `このシーンを参照する選択肢が${count}個あります。先に選択肢を削除するか移動先を変更してください。`,
    scene: 'このシーンと含まれる台詞・選択肢を削除しますか？他のシーンの内容は保持されます。',
    character: `キャラクターを削除しますか？${count}行の台詞は文章を保持したナレーションになり、表情参照は解除されます。${scenes}個のシーンの登場一覧からも除外されます。`,
    unstage: `シーンからキャラクターを除外しますか？${count}行の台詞は文章を保持したナレーションになり、表情参照は解除されます。`,
  } : {
    entry: 'The start scene cannot be deleted. Select another start scene first.',
    incoming: `${count} choices in other scenes refer to this scene. Remove or retarget those choices first.`,
    scene: 'Delete this scene and its dialogue and choices? Content in other scenes will be kept.',
    character: `Delete this character? ${count} dialogue lines will keep their text but become narration with expression references cleared. The character will also be removed from ${scenes} scene cast lists.`,
    unstage: `Remove this character from the scene? ${count} dialogue lines will keep their text but become narration with expression references cleared.`,
  };
  return messages[kind];
}
