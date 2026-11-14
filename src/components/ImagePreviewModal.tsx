import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Character, Expression } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from './icons';
import { useLanguage } from '../i18n/LanguageProvider';

interface ImagePreviewModalProps {
  character: Character | null;
  initialExpressionId: string | null;
  onClose: () => void;
  // Fallback for background images which don't have a full character context
  imageUrl?: string | null;
  altText?: string;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ 
    character, 
    initialExpressionId, 
    onClose,
    imageUrl: directImageUrl,
    altText: directAltText
}) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter out expressions that don't have an image URL
  const validExpressions = useMemo(() => {
    if (!character) return [];
    return character.expressions.filter(e => !!e.imageUrl);
  }, [character]);

  // Set initial index based on provided expression ID
  useEffect(() => {
    if (initialExpressionId && validExpressions.length > 0) {
      const idx = validExpressions.findIndex(e => e.id === initialExpressionId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [initialExpressionId, validExpressions]);

  const goToPrev = () => {
    if (validExpressions.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + validExpressions.length) % validExpressions.length);
  };

  const goToNext = () => {
    if (validExpressions.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % validExpressions.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, validExpressions.length]);

  const currentExpr = validExpressions[currentIndex];
  const displayUrl = character ? currentExpr?.imageUrl : directImageUrl;
  const displayTitle = character ? `${character.name} - ${currentExpr ? t(currentExpr.name) : currentExpr?.name}` : directAltText;
  const downloadTitle = character ? `${character.name} - ${currentExpr?.name}` : directAltText;

  if (!displayUrl) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
      onClick={onClose}
    >
      {/* Header Info */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h3 className="text-white text-xl font-bold drop-shadow-lg">{displayTitle}</h3>
        {character && validExpressions.length > 1 && (
            <p className="text-gray-400 text-sm mt-1">{t('{current} / {total} 표정', { current: currentIndex + 1, total: validExpressions.length })}</p>
        )}
      </div>

      <div className="relative max-w-full max-h-full flex items-center justify-center group" onClick={(e) => e.stopPropagation()}>
        
        {/* Navigation Buttons */}
        {character && validExpressions.length > 1 && (
            <>
                <button 
                    onClick={goToPrev}
                    className="absolute left-[-60px] p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all hidden md:block"
                >
                    <ChevronLeftIcon className="w-10 h-10" />
                </button>
                <button 
                    onClick={goToNext}
                    className="absolute right-[-60px] p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all hidden md:block"
                >
                    <ChevronRightIcon className="w-10 h-10" />
                </button>
            </>
        )}

        {/* Main Image */}
        <div className="relative">
            <img 
                key={displayUrl} // Key forces animation on change
                src={displayUrl} 
                alt={displayTitle} 
                className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg shadow-2xl border border-white/10 animate-fade-in"
            />
        </div>

        {/* Action Controls */}
        <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-center gap-4">
             <button 
                className="px-6 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors border border-gray-600 font-medium text-sm flex items-center gap-2"
                onClick={onClose}
            >
                <span className="text-xs border border-gray-500 px-1 rounded">ESC</span> {t('닫기')}
            </button>
             <a 
                href={displayUrl} 
                download={`${downloadTitle}.png`}
                className="px-6 py-2 bg-indigo-600 text-gray-950 rounded-full hover:bg-indigo-500 transition-colors font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
                <DownloadIcon className="w-4 h-4" />
                {t('다운로드')}
            </a>
        </div>

        {/* Mobile Swipe Simulation for buttons */}
        <div className="absolute inset-x-0 h-full flex md:hidden pointer-events-none">
            <div className="w-1/2 h-full cursor-pointer pointer-events-auto" onClick={goToPrev}></div>
            <div className="w-1/2 h-full cursor-pointer pointer-events-auto" onClick={goToNext}></div>
        </div>
      </div>
    </div>,
    document.body
  );
};
