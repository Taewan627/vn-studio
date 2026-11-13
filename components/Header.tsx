import { useLanguage } from '../i18n/LanguageProvider';
import { LanguageSwitcher } from './LanguageSwitcher';

import React, { useState } from 'react';
import { SaveIcon, DownloadIcon, UploadIcon, ResetIcon, PlayIcon, WebIcon } from './icons';
import { Analytics } from '../utils/analytics';

interface HeaderProps {
  onSave: () => void;
  onSaveToFile: () => void;
  onLoadFromFile: () => void;
  onExportToRenpy: () => void;
  onExportToHtml: () => void;
  onExportWebPackage: () => void;
  onReset: () => void;
  onPlay: () => void;
  onGoToLobby: () => void;
  onOpenGuide?: () => void;
  isExporting?: boolean; 
  isExportingWeb?: boolean;
  isLeftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSave,
  onSaveToFile,
  onLoadFromFile,
  onExportToRenpy,
  onExportToHtml,
  onExportWebPackage,
  onReset,
  onPlay,
  onGoToLobby,
  onOpenGuide,
  isExporting = false,
  isExportingWeb = false,
  isLeftPanelOpen,
  onToggleLeftPanel
}) => {
  const { t, language } = useLanguage();
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="flex-shrink-0 bg-gray-950 p-2 md:p-3 flex flex-wrap gap-2 items-center justify-between shadow-xl z-50 border-b border-white/5">
      <div className="flex flex-wrap items-center gap-2 min-w-0 ml-1">
        {/* 데스크톱용 단독 패널 슬라이더 토글 버튼 */}
        <button
          onClick={onToggleLeftPanel}
          className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            isLeftPanelOpen 
              ? 'bg-indigo-600 border border-indigo-500 text-gray-950 shadow-lg' 
              : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
          }`}
          title={t("프로젝트 & 캐릭터 전용 사이드바 켜기/끄기")}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          {isLeftPanelOpen ? t("◀ 패널 접기") : t("⚙️ 프로젝트 & 캐릭터")}
        </button>

        <div className="flex flex-col md:flex-row md:items-center gap-0 md:gap-2">
            <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-white tracking-tighter italic">VN</h1>
                <div className="hidden sm:block h-4 w-px bg-gray-800 mx-1"></div>
                <span className="hidden sm:inline text-[11px] text-indigo-500 font-black uppercase tracking-[0.2em]">Studio</span>
            </div>
            {/* 제작자 표시 추가 */}
            <div className="text-[11px] md:text-[11px] text-gray-500 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full border border-white/5 self-start md:self-auto md:ml-2">
                CREATED BY <span className="text-indigo-400">TAEWAN KIM</span>
            </div>
        </div>

        {/* 로비 목록 바로가기 */}
        <button
          onClick={onGoToLobby}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 "
          title={t("로비로 나가서 다른 프로젝트 불러오기")}
        >{t("📁 목록 보기")}</button>

      </div>

      <div className="flex flex-wrap items-center gap-1 md:gap-2 min-w-0">
        <LanguageSwitcher />
        <div className="flex items-center gap-1 bg-gray-900/50 rounded-full p-0.5 border border-white/5 mr-2">
            <button 
              onClick={onLoadFromFile} 
              className="p-1.5 md:p-2 text-indigo-400 hover:text-white rounded-full transition-colors" 
              title={t("파일 불러오기")}
            >
              <UploadIcon className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button 
              onClick={() => { Analytics.exportAction('json'); onSaveToFile(); }} 
              className="p-1.5 md:p-2 text-indigo-400 hover:text-white rounded-full transition-colors border-l border-white/10 ml-1 pl-3" 
              title={t("JSON 파일로 내보내기")}
            >
              <DownloadIcon className="w-4 h-4 md:w-5 md:h-5" />
            </button>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)} 
            className="flex items-center gap-2 px-3 py-1.5 md:px-5 md:py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-100 rounded-full transition-all font-bold text-[11px] md:text-xs  active:scale-95"
          >
            {isExporting || isExportingWeb ? (
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t("진행 중...")}</span>
                </div>
            ) : (
                <>
                    <WebIcon className="w-3 h-3 md:w-4 md:h-4" />
                    <span>{t("게임 출시")}</span>
                    <span aria-hidden="true" className="ml-1 opacity-50">▼</span>
                </>
            )}
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-3 w-48 md:w-56 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in py-2">
              <button onClick={() => { Analytics.exportAction('html'); onExportToHtml(); setShowExportMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-gray-800 text-xs md:text-sm flex items-center gap-3 group">
                <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                    <WebIcon className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                    <div className="font-bold">{t("단일 HTML로 저장")}</div>
                    <div className="text-[11px] text-gray-500">{t("한 개의 파일로 즉시 실행")}</div>
                </div>
              </button>
              <button onClick={() => { Analytics.exportAction('zip'); onExportWebPackage(); setShowExportMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-gray-800 text-xs md:text-sm flex items-center gap-3 group">
                <div className="p-2 bg-sky-500/10 rounded-lg group-hover:bg-sky-500/20 transition-colors">
                    <DownloadIcon className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                    <div className="font-bold">{t("웹 패키지(ZIP) 내보내기")}</div>
                    <div className="text-[11px] text-gray-500">{t("완전한 오프라인 웹 앱")}</div>
                </div>
              </button>
              <div className="h-px bg-gray-800 my-1"></div>
              <button onClick={() => { Analytics.exportAction('renpy'); onExportToRenpy(); setShowExportMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-gray-800 text-xs md:text-sm flex items-center gap-3 group">
                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                    <SaveIcon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                    <div className="font-bold">{t("Ren'Py 프로젝트 파일")}</div>
                    <div className="text-[11px] text-gray-500">{t("전문 엔진용 스크립트(.rpy)")}</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={onPlay} 
          className="flex items-center gap-2 px-3 py-1.5 md:px-5 md:py-2.5 bg-indigo-500 hover:bg-indigo-400 text-gray-950 rounded-full transition-all font-black text-[11px] md:text-xs shadow-lg shadow-indigo-950/40 active:scale-95 ml-1"
        >
          <PlayIcon className="w-3 h-3 md:w-4 md:h-4" />
          <span>{t("PLAY")}</span>
        </button>

        <button 
          onClick={onReset} 
          className="p-1.5 md:p-2.5 text-gray-500 hover:text-red-400 rounded-full transition-colors ml-1" 
          title={t("완전 초기화")}
        >
          <ResetIcon className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </header>
  );
};
