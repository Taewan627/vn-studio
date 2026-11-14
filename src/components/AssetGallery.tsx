
import React, { useMemo } from 'react';
import { VisualNovel } from '../types';
import { PhotoIcon } from './icons';
import { useLanguage } from '../i18n/LanguageProvider';

interface AssetGalleryProps {
  vn: VisualNovel;
  onSelect: (url: string) => void;
  currentUrl?: string;
}

export const AssetGallery: React.FC<AssetGalleryProps> = ({ vn, onSelect, currentUrl }) => {
  const { t } = useLanguage();
  // 프로젝트 내의 모든 고유 배경 이미지 수집 (커버 이미지 포함)
  const backgroundAssets = useMemo(() => {
    const urls = new Set<string>();
    if (vn.coverUrl) urls.add(vn.coverUrl);
    vn.scenes.forEach(s => {
      if (s.backgroundUrl) urls.add(s.backgroundUrl);
    });
    return Array.from(urls).filter(url => url && url.trim() !== "");
  }, [vn]);

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-black/20">
        <PhotoIcon className="w-3 h-3 text-indigo-400" />
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          {t('사용된 배경 라이브러리 ({count})', { count: backgroundAssets.length })}
        </span>
      </div>

      <div className="p-3">
        {backgroundAssets.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 custom-scrollbar">
            {backgroundAssets.map((url, i) => (
              <div 
                key={i}
                onClick={() => onSelect(url)}
                className={`flex-shrink-0 w-28 aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 active:scale-95 ${currentUrl === url ? 'border-indigo-500 shadow-[0_0_15px_rgba(200,241,53,0.4)]' : 'border-gray-700 hover:border-gray-500'}`}
              >
                <img src={url} className="w-full h-full object-cover" alt="background asset" />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-gray-600 opacity-50">
            <PhotoIcon className="w-6 h-6 mb-1"/>
            <span className="text-[11px] font-medium">{t('아직 생성된 배경이 없습니다.')}</span>
          </div>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
};
