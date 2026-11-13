
import React, { useState, ChangeEvent } from 'react';
import { Character, VisualNovelActions, AiOperations } from '../types';
import { PlusIcon, TrashIcon, SparklesIcon, DownloadIcon, MagicWandIcon, UserIcon } from './icons';
import { ImagePreviewModal } from './ImagePreviewModal';
import { fileToBase64 } from '../utils/imageProcessing';
import { Analytics } from '../utils/analytics';
import { useLanguage } from '../i18n/LanguageProvider';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

interface CharacterListProps {
  characters: Character[];
  actions: VisualNovelActions;
  aiOps: AiOperations;
}

export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  actions,
  aiOps,
}) => {
  const { t } = useLanguage();
  const [activeExpressionTabs, setActiveExpressionTabs] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<{ char: Character, initialExprId: string } | null>(null);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, charId: string, expressionId: string) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      actions.updateCharacterExpressionUrl(charId, expressionId, base64);
    }
  };

  const handleDownload = (url: string, charName: string, exprName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${charName}_${exprName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold text-lg text-white">{t('캐릭터')}</h2>
        <button 
          onClick={() => {
            Analytics.characterAdd();
            actions.addCharacter();
          }} 
          className="p-1 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
        >
          <PlusIcon className="w-5 h-5"/>
        </button>
      </div>
      <div className="space-y-4">
        {characters.map(char => {
          const activeExpressionId = activeExpressionTabs[char.id] || char.expressions[0]?.id;
          const activeExpression = char.expressions.find(e => e.id === activeExpressionId);
          const isGeneratingThisChar = aiOps.generatingExpressionsForCharId === char.id;

          return (
            <div key={char.id} className="bg-gray-700 p-3 rounded-lg border border-gray-600">
              <div className="flex items-center gap-2 mb-3">
                <input 
                  type="text" 
                  placeholder={t("캐릭터 이름")} 
                  value={char.name} 
                  onChange={e => actions.updateCharacterName(char.id, e.target.value)} 
                  className="w-full p-2 bg-gray-600 text-white rounded font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm" 
                />
                <button onClick={() => actions.deleteCharacter(char.id)} className="p-2 text-red-400 hover:text-red-300 flex-shrink-0 transition-colors"><TrashIcon className="w-5 h-5"/></button>
              </div>
              
              {char.description && <p className="text-xs text-gray-200 mb-3">{char.description}</p>}
              {isImageGenerationEnabled() && (
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-gray-400 block uppercase font-bold tracking-wider">{t('AI 이미지 프롬프트')}</label>
                  <button
                    onClick={() => aiOps.handleRegenerateCharacterAndExpressions(char.id)}
                    disabled={!isImageGenerationEnabled() || aiOps.generatingExpressionsForCharId !== null}
                    className="flex items-center gap-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-gray-950 px-2 py-0.5 rounded transition-all font-bold cursor-pointer disabled:cursor-not-allowed"
                    title={t("캐릭터 및 5종 표정 전체 다시 생성")}
                  >
                    <SparklesIcon className="w-3 h-3" />
                    {t('캐릭터 새로 재생성')}
                  </button>
                </div>
                <textarea
                    placeholder={t("예: 푸른 눈의 전사, 은색 갑옷")}
                    value={char.aiPrompt || ''}
                    onChange={e => actions.updateCharacterAiPrompt(char.id, e.target.value)}
                    className="w-full p-2 text-xs bg-gray-600 text-white rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-gray-500"
                    rows={2}
                />
              </div>
              )}

              {isImageGenerationEnabled() && (
              <div className="mb-4">
                <button
                  onClick={() => aiOps.handleGenerateAllCharacterExpressions(char.id)}
                  disabled={!isImageGenerationEnabled() || aiOps.generatingExpressionsForCharId !== null}
                  className="w-full p-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-bold shadow-lg shadow-indigo-900/20"
                >
                  <SparklesIcon className="w-4 h-4" />
                  {isGeneratingThisChar ? t('전체 표정 생성 중...') : t('AI로 5종 표정 일괄 생성')}
                </button>

                {/* 캐릭터 생성 전용 프로그레스 바 */}
                {isGeneratingThisChar && (
                  <div className="mt-2 px-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] text-indigo-300 font-bold animate-pulse">
                        {aiOps.progress < 25 ? t('기본 모델 생성 중...') : aiOps.progress < 90 ? t('표정 변화 연산 중...') : t('마무리 작업 중...')}
                      </span>
                      <span className="text-[11px] text-indigo-400 font-mono font-bold">{aiOps.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-600">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${aiOps.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              )}
              
              {/* Expression Tabs - 2 Row Grid for 5 Expressions */}
              <div className="grid grid-cols-3 gap-1 mb-px">
                {char.expressions.map(expr => (
                  <button
                    key={expr.id}
                    onClick={() => setActiveExpressionTabs(prev => ({ ...prev, [char.id]: expr.id }))}
                    className={`px-2 py-1.5 text-[11px] font-bold rounded-t-md transition-all border-x border-t ${
                      activeExpressionId === expr.id 
                        ? 'bg-gray-600 text-white border-gray-500' 
                        : 'bg-gray-800/50 text-gray-500 border-transparent hover:text-gray-300'
                    }`}
                  >
                    {t(expr.name)}
                    {expr.imageUrl && <span className="ml-1 text-[11px] text-green-400">●</span>}
                  </button>
                ))}
              </div>
              
              {/* Expression Content */}
              <div className="bg-gray-600 p-3 rounded-b-md border border-gray-500">
                  {activeExpression && (
                    <div key={activeExpression.id}>
                      <div className="flex gap-3">
                        <div 
                            className="w-1/3 aspect-[3/4] bg-gray-800 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden group border border-gray-400 shadow-inner cursor-zoom-in"
                            onClick={() => activeExpression.imageUrl && setPreviewData({ char, initialExprId: activeExpression.id })}
                        >
                          {isGeneratingThisChar && !activeExpression.imageUrl ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
                                    <span className="text-[11px] text-gray-400">{t('대기 중')}</span>
                                </div>
                          ) : activeExpression.imageUrl ? (
                                <>
                                    <img 
                                    src={activeExpression.imageUrl} 
                                    alt={`${char.name} ${t(activeExpression.name)}`} 
                                    className="w-full h-full object-contain animate-fade-in"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-[11px] text-white font-bold bg-black/60 px-2 py-1 rounded">{t('확대')}</span>
                                    </div>
                                </>
                          ) : isImageGenerationEnabled() ? (
                                <div 
                                  className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center p-2 text-center opacity-75 hover:opacity-100 hover:bg-gray-700/80 transition-all cursor-pointer group"
                                  onClick={() => isImageGenerationEnabled() && aiOps.generatingExpressionsForCharId === null && aiOps.handleGenerateSingleExpression(char.id, activeExpression.id)}
                                  title={t("클릭하여 AI로 '{expression}' 표정 생성 (중립 캐릭터 고정)", { expression: t(activeExpression.name) })}
                                >
                                    <SparklesIcon className="w-5 h-5 text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
                                    <span className='text-[11px] text-indigo-300 font-bold leading-tight'>{t('AI 표정 생성')}</span>
                                    <span className='text-[11px] text-gray-400 leading-tight'>{t('중립 기준 고정')}</span>
                                </div>
                          ) : null}
                        </div>
                        <div className="w-2/3 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] text-gray-400 font-bold uppercase">{t('이미지 제어')}</label>
                              <div className="flex items-center gap-1.5">
                                {isImageGenerationEnabled() && (isGeneratingThisChar ? (
                                  <div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full" title={t("생성 중...")}></div>
                                ) : (
                                  <button
                                    onClick={() => aiOps.handleGenerateSingleExpression(char.id, activeExpression.id)}
                                    disabled={!isImageGenerationEnabled() || aiOps.generatingExpressionsForCharId !== null}
                                    className="p-1 text-indigo-400 hover:bg-indigo-400/20 rounded transition-all disabled:opacity-30"
                                    title={activeExpression.name === '중립' ? t('AI로 기본 중립 이미지 생성') : t("AI로 '{expression}' 표정 생성 (중립 캐릭터 기반 고정)", { expression: t(activeExpression.name) })}
                                  >
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                  </button>
                                ))}
                                <button
                                  onClick={() => handleDownload(activeExpression.imageUrl, char.name, activeExpression.name)}
                                  disabled={!activeExpression.imageUrl}
                                  className="p-1 text-sky-400 hover:bg-sky-400/10 rounded transition-all disabled:opacity-30"
                                  title={t("다운로드")}
                                >
                                  <DownloadIcon className="w-3.5 h-3.5" />
                                </button>
                                {aiOps.isRemovingBgForExprId === activeExpression.id ? (
                                  <div className="animate-spin h-3.5 w-3.5 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                                ) : (
                                  <button
                                    onClick={() => aiOps.handleRemoveBackground(char.id, activeExpression.id)}
                                    disabled={!activeExpression.imageUrl}
                                    className="p-1 text-purple-400 hover:bg-purple-400/10 rounded transition-all disabled:opacity-30"
                                    title={t("배경 제거")}
                                  >
                                    <MagicWandIcon className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <input 
                              type="text" 
                              placeholder={t("직접 이미지 URL 입력")} 
                              value={activeExpression.imageUrl} 
                              onChange={e => actions.updateCharacterExpressionUrl(char.id, activeExpression.id, e.target.value)} 
                              className="w-full p-1.5 text-[11px] bg-gray-800 text-gray-300 rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                            />
                          </div>
                          <div className="relative">
                            <input 
                                type="file" 
                                id={`file-${activeExpression.id}`}
                                accept="image/*" 
                                onChange={(e) => handleImageUpload(e, char.id, activeExpression.id)} 
                                className="hidden" 
                            />
                            <label 
                                htmlFor={`file-${activeExpression.id}`}
                                className="w-full py-1.5 px-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-[11px] font-bold text-center cursor-pointer border border-gray-500 transition-colors block"
                            >
                                {t('로컬 이미지 업로드')}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      <ImagePreviewModal 
        character={previewData?.char || null}
        initialExpressionId={previewData?.initialExprId || null}
        onClose={() => setPreviewData(null)} 
      />
    </div>
  );
};
