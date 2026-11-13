import { useLanguage } from '../i18n/LanguageProvider';

import React, { useState, ChangeEvent } from 'react';
import { Scene, VisualNovel, VisualNovelActions, AiOperations } from '../types';
import { TrashIcon, SparklesIcon, PlusIcon, PhotoIcon } from './icons';
import { ImagePreviewModal } from './ImagePreviewModal';
import { AssetGallery } from './AssetGallery';
import { fileToBase64, resizeAndCompressImage } from '../utils/imageProcessing';
import { Analytics } from '../utils/analytics';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

export const SceneEditor: React.FC<{ selectedScene: Scene | undefined; vn: VisualNovel; actions: VisualNovelActions; aiOps: AiOperations; manualOnly?: boolean }> = ({
  selectedScene, vn, actions, aiOps, manualOnly = false
}) => {
  const { t, language } = useLanguage();
  const [previewImage, setPreviewImage] = useState<{ url: string, name: string } | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  if (!selectedScene) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50 space-y-4">
        <div className="w-16 h-16 border-2 border-dashed border-gray-600 rounded-full flex items-center justify-center">?</div>
        <p className="font-medium">{t("편집할 장면을 선택하세요.")}</p>
      </div>
    );
  }

  const handleBgUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      const compressed = await resizeAndCompressImage(base64, 1024, 0.4);
      Analytics.sceneEdit('background_change');
      actions.updateScene(selectedScene.id, 'backgroundUrl', compressed);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex items-center justify-between sticky top-0 bg-gray-900/80 backdrop-blur-md z-10 py-2 border-b border-gray-700">
        <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-white">{t("장면 편집")}</h2>
            <span className="text-[11px] text-indigo-400 font-mono font-bold uppercase tracking-tighter">ID: {selectedScene.id}</span>
        </div>
        <button onClick={() => actions.deleteScene(selectedScene.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-white hover:bg-red-600 rounded-lg transition-all flex items-center gap-1.5 border border-red-900/30">
          <TrashIcon className="w-4 h-4"/>{t("삭제")}</button>
      </div>

      <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t("장면 이름")}</label>
                <input type="text" value={selectedScene.name} onChange={e => actions.updateScene(selectedScene.id, 'name', e.target.value)} className="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t("서사 단계")}</label>
                <div className="flex flex-wrap gap-1">
                    {['ki', 'seung', 'jeon', 'gyeol'].map(s => (
                        <button key={s} onClick={() => actions.updateScene(selectedScene.id, 'stage', s)} className={`flex-1 min-w-[72px] px-1 py-1.5 text-[11px] leading-tight whitespace-normal font-bold rounded-lg border transition-all ${selectedScene.stage === s ? 'bg-indigo-600 border-indigo-400 text-gray-950 shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'}`}>
                            {language === 'ko' ? s.toUpperCase() : t('stage.' + s)}
                        </button>
                    ))}
                </div>
              </div>
          </div>
      </section>

      {/* 에셋 보관함 섹션 추가 */}
      <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t("프로젝트 이미지 보관함")}</label>
            <button 
              onClick={() => setShowGallery(!showGallery)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
            >
              {showGallery ? t("숨기기") : t("보여주기")}
            </button>
          </div>
          {showGallery && (
            <AssetGallery 
              vn={vn} 
              currentUrl={selectedScene.backgroundUrl}
              onSelect={(url) => {
                Analytics.sceneEdit('background_change');
                actions.updateScene(selectedScene.id, 'backgroundUrl', url);
              }} 
            />
          )}
      </section>

      {(isImageGenerationEnabled() || !manualOnly) && (
      <section className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30 space-y-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-indigo-200 uppercase tracking-widest">{t("AI 자동 완성")}</h3>
          </div>
          <textarea
              rows={3}
              value={selectedScene.aiPrompt || ''}
              onChange={e => actions.updateScene(selectedScene.id, 'aiPrompt', e.target.value)}
              placeholder={t("예: 네온 불빛이 가득한 거실에서 캐릭터들이 미래에 대해 논쟁하는 장면")}
              className="w-full p-3 bg-black/40 text-sm text-white rounded-xl border border-indigo-900/50 focus:border-indigo-500 outline-none resize-none placeholder-gray-600"
          />
          <div className="flex gap-2">
              {isImageGenerationEnabled() && (
              <button 
                onClick={() => {
                  Analytics.imageGenerate();
                  aiOps.handleGenerateSceneBackground(selectedScene.id, selectedScene.aiPrompt || '');
                }} 
                disabled={aiOps.isGeneratingBg} 
                className="flex-1 p-2 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                  {aiOps.isGeneratingBg ? t("배경 생성 중...") : t("배경 AI 생성")}
              </button>
              )}
              {!manualOnly && (
              <button onClick={() => aiOps.handleGenerateSceneDialogue(selectedScene.id, selectedScene.aiPrompt || '', selectedScene.presentCharacterIds)} disabled={aiOps.isGeneratingDialogue || selectedScene.presentCharacterIds.length === 0} className="flex-1 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                  {aiOps.isGeneratingDialogue ? t("대화 생성 중...") : t("대화 AI 생성")}
              </button>
              )}
          </div>
      </section>
      )}
      
      <section className="space-y-3">
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t("배경 이미지 개별 설정")}</label>
        <div className="flex gap-4">
            <div className="w-40 aspect-video bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group relative cursor-pointer shadow-inner" onClick={() => selectedScene.backgroundUrl && setPreviewImage({ url: selectedScene.backgroundUrl, name: selectedScene.name })}>
                {selectedScene.backgroundUrl ? <img src={selectedScene.backgroundUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-30"><PhotoIcon className="w-8 h-8" /></div>}
            </div>
            <div className="flex-grow space-y-2">
                <input 
                  type="text" 
                  placeholder={t("배경 이미지 URL 직접 입력")}
                  value={selectedScene.backgroundUrl} 
                  onChange={e => actions.updateScene(selectedScene.id, 'backgroundUrl', e.target.value)} 
                  onBlur={() => Analytics.sceneEdit('background_change')}
                  className="w-full p-2 text-xs bg-gray-800 text-white rounded-lg border border-gray-700 outline-none" 
                />
                <label className="block p-2 border border-dashed border-gray-600 rounded-lg text-[11px] text-gray-400 text-center cursor-pointer hover:border-indigo-500 hover:text-indigo-400 transition-all">{t("로컬 파일 업로드")}<input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                </label>
            </div>
        </div>
        <div className="p-3.5 bg-gray-800 rounded-xl border border-gray-700">
            <div className="text-[11px] font-bold text-gray-500 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                <span>{t("등장 캐릭터 선별")}</span>
                <span className="text-[11px] text-indigo-400 font-mono normal-case">{selectedScene.presentCharacterIds.length}{t("명 대기중")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {vn.characters.map(char => {
                  const isPresent = selectedScene.presentCharacterIds.includes(char.id);
                  const displayExpr = char.expressions.find(e => e.imageUrl) || char.expressions[0];
                  const charImage = displayExpr?.imageUrl;

                  return (
                    <label 
                      key={char.id} 
                      className={`pl-2 pr-4 py-2.5 rounded-2xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-3.5 select-none ${
                        isPresent 
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_2px_12px_rgba(200,241,53,0.2)] ring-1 ring-indigo-500/30' 
                          : 'bg-gray-900 border-gray-700/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isPresent} 
                        onChange={e => actions.toggleCharacterInScene(selectedScene.id, char.id, e.target.checked)} 
                        className="hidden" 
                      />
                      {/* Avatar / Thumbnail */}
                      <div className={`w-24 h-24 rounded-xl overflow-hidden flex items-center justify-center bg-gray-850 border flex-shrink-0 transition-colors ${
                        isPresent ? 'border-indigo-400 bg-indigo-950/40' : 'border-gray-700'
                      }`}>
                        {charImage ? (
                          <img 
                            src={charImage} 
                            alt={char.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          <span className="text-xl font-black text-indigo-400 font-mono">
                            {char.name[0] || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-start min-w-[70px]">
                        <span className="truncate max-w-[100px] text-sm">{char.name}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full transition-transform duration-300 ${
                            isPresent ? 'bg-indigo-400 scale-110 shadow-[0_0_6px_rgba(129,140,248,0.8)]' : 'bg-gray-600'
                          }`} />
                          <span className={`text-[11px] font-medium ${isPresent ? 'text-indigo-300' : 'text-gray-500'}`}>
                            {isPresent ? t("등장중") : t("대기")}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
            </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
            <h3 className="font-bold text-white">{t("대화 시나리오")}</h3>
            <button onClick={() => actions.addDialogueLine(selectedScene.id)} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded transition-all"><PlusIcon className="w-5 h-5"/></button>
        </div>
        <div className="space-y-3">
          {selectedScene.dialogue.map((line, idx) => {
               const speakingChar = vn.characters.find(c => c.id === line.characterId);
               return (
                <div key={idx} className="flex gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-xl group hover:border-gray-500 transition-all">
                    <div className="w-32 space-y-2 flex-shrink-0">
                        <select value={line.characterId || ''} onChange={e => actions.updateDialogueLine(selectedScene.id, idx, 'characterId', e.target.value || null)} className="w-full p-1.5 bg-gray-700 text-[11px] text-white rounded-lg outline-none">
                            <option value="">{t("내레이터")}</option>
                            {vn.characters.filter(c => selectedScene.presentCharacterIds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {speakingChar && (
                             <select value={line.expressionId || ''} onChange={e => actions.updateDialogueLine(selectedScene.id, idx, 'expressionId', e.target.value || null)} className="w-full p-1.5 bg-gray-700 text-[11px] text-indigo-300 rounded-lg outline-none">
                                <option value="">{language === 'ko' ? '기본 표정' : language === 'ja' ? '既定の表情' : 'Default expression'}</option>
                                {speakingChar.expressions.map(ex => <option key={ex.id} value={ex.id}>{t(ex.name)}</option>)}
                            </select>
                        )}
                    </div>
                    <textarea 
                      value={line.text} 
                      onChange={e => actions.updateDialogueLine(selectedScene.id, idx, 'text', e.target.value)} 
                      onBlur={() => Analytics.sceneEdit('dialogue_edit')}
                      rows={2} 
                      className="flex-grow p-2 bg-transparent text-sm text-white resize-none outline-none placeholder-gray-700" 
                      placeholder={t("대사 입력...")}
                    />
                    <button onClick={() => actions.deleteDialogueLine(selectedScene.id, idx)} className="opacity-0 group-hover:opacity-100 p-2 text-red-500 transition-all"><TrashIcon className="w-4 h-4"/></button>
                </div>
               );
          })}
        </div>
      </section>

      <section className="space-y-4 bg-gray-800 p-4 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">{t("분기점 (선택지)")}</h3>
            <button onClick={() => actions.addChoice(selectedScene.id, '')} className="p-1 text-emerald-400 rounded transition-all"><PlusIcon className="w-5 h-5"/></button>
        </div>
        <div className="space-y-2">
          {selectedScene.choices.map((choice, idx) => {
            const isChoiceConnected = choice.nextSceneId && vn.scenes.some(s => s.id === choice.nextSceneId);
            return (
              <div 
                key={idx} 
                className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-all ${
                  isChoiceConnected 
                    ? 'bg-black/30 border-gray-700/80 hover:border-gray-650' 
                    : 'bg-red-950/15 border-red-500/85 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={choice.text} 
                    onChange={e => actions.updateChoice(selectedScene.id, idx, 'text', e.target.value)} 
                    className="flex-grow p-1.5 text-xs bg-transparent text-white outline-none" 
                    placeholder={t("선택지 내용")}
                  />
                  <div className="h-4 w-px bg-gray-700"></div>
                  <select 
                    value={choice.nextSceneId} 
                    onChange={e => actions.updateChoice(selectedScene.id, idx, 'nextSceneId', e.target.value)} 
                    className={`p-1.5 text-[11px] rounded-lg outline-none max-w-[120px] transition-colors ${
                      isChoiceConnected 
                        ? 'bg-gray-700 text-indigo-200' 
                        : 'bg-red-900/90 text-red-100 border border-red-500/30'
                    }`}
                  >
                    <option value="">{t("다음 장면 선택 ⚠️")}</option>
                    {vn.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button 
                    onClick={() => actions.deleteChoice(selectedScene.id, idx)} 
                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4"/>
                  </button>
                </div>
                {!isChoiceConnected && (
                  <div className="text-[11px] text-red-400 font-bold px-1.5 flex items-center gap-1">
                    <span>{t("⚠️ 다음 장면이 아직 연결되지 않았습니다. 플레이 모드에서 비활성화됩니다.")}</span>
                  </div>
                )}
              </div>
            );
          })}
          {selectedScene.choices.length === 0 && <p className="text-gray-500 text-[11px] text-center italic py-2">{t("장면이 종료되면 게임이 끝납니다.")}</p>}
        </div>
      </section>

      <ImagePreviewModal imageUrl={previewImage?.url || null} altText={previewImage?.name || ''} onClose={() => setPreviewImage(null)} character={null} initialExpressionId={null} />
    </div>
  );
};
