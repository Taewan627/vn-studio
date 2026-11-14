import React, { useState } from 'react';
import { SparklesIcon } from './icons';
import { useLanguage } from '../i18n/LanguageProvider';

interface NovelSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryText: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const NovelSummaryModal: React.FC<NovelSummaryModalProps> = ({
  isOpen,
  onClose,
  summaryText,
  isGenerating,
  onGenerate,
}) => {
  const { t } = useLanguage();
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = summaryText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-indigo-500/40 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(200,241,53,0.25)] flex flex-col max-h-[85vh] animate-scale-up">
        
        {/* 헤더 섹션 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <h3 className="text-base font-black text-white tracking-tight uppercase">{t('AI 복장 장편 소설 컴파일러')}</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* 본문/전환 구역 */}
        <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar bg-gray-900/40">
          {!summaryText && !isGenerating ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-5xl">✍️</div>
              <h4 className="text-white font-extrabold text-sm">{t('소설이 아직 집필되지 않았습니다')}</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                {t('지금까지 구상한 모든 씬들의 분기 대본, 인물 표정, 흐름도의 선택지 연결 정보를 실시간 수집하여, 하나의 유기적이고 완성도 높은 베스트셀러 소설 글로 다시 엮어 드립니다.')}
              </p>
              <button
                onClick={onGenerate}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-full font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 inline-flex items-center gap-2"
              >
                <SparklesIcon className="w-4 h-4 text-yellow-300 animate-spin" /> {t('AI 소설 컴파일 개시')}
              </button>
            </div>
          ) : isGenerating ? (
            <div className="text-center py-16 space-y-6">
              <div className="inline-block relative">
                <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-xl">✒️</div>
              </div>
              <div>
                <h4 className="text-white font-extrabold text-sm animate-pulse tracking-wide uppercase">{t('AI 작가가 온 정성을 다해 소설을 집필하는 중...')}</h4>
                <p className="text-[11px] text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                  {t('스토리 세계관의 모든 대화와 씬 배경의 무드를 정밀 분석하여 최고의 문체로 연결하고 있습니다. 약 5~10초 정도 소요됩니다.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-950/40 p-3 rounded-xl border border-gray-800">
                <span className="text-[11px] text-indigo-300 font-extrabold uppercase tracking-widest">
                  {t('🖋️ 집필 완료된 소설 본문 (복사 가능)')}
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {t('분량: {count} 자', { count: summaryText.length.toLocaleString() })}
                </span>
              </div>
              
              {/* 소설 텍스트 뷰어 */}
              <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 font-serif text-[13px] sm:text-sm text-gray-100 leading-relaxed whitespace-pre-wrap select-text max-h-[45vh] overflow-y-auto custom-scrollbar shadow-inner">
                {summaryText}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 영역 */}
        {summaryText && !isGenerating && (
          <div className="flex gap-3 p-5 border-t border-gray-800 bg-gray-950/60 justify-end">
            <button
              onClick={onGenerate}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              {t('🔄 다시 집필하기')}
            </button>
            <button
              onClick={handleCopy}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                isCopied 
                  ? 'bg-green-600 hover:bg-green-500 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-gray-950 shadow-indigo-900/50'
              }`}
            >
              {isCopied ? t('✅ 복사 완료 !') : t('📋 전체 복사하기')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
