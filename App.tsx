import { useLanguage } from './i18n/LanguageProvider';
import { LanguageSwitcher } from './components/LanguageSwitcher';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import GamePlayer from './components/GamePlayer';
import SceneTree from './components/SceneTree';
import { Header } from './components/Header';
import { StoryGenerator } from './components/StoryGenerator';
import { NovelSummaryModal } from './components/NovelSummaryModal';

import { CharacterList } from './components/CharacterList';
import { SceneEditor } from './components/SceneEditor';
import { useVisualNovel } from './hooks/useVisualNovel';
import { useAiOperations } from './hooks/useAiOperations';
import { useFileIO } from './hooks/useFileIO';
import { ProjectLobby } from './components/ProjectLobby';
import { UserIcon, RouteIcon, EditIcon, SparklesIcon, PlayIcon } from './components/icons';
import { Analytics } from './utils/analytics';
import { useQuickImages } from './hooks/useQuickImages';
import { isImageGenerationEnabled } from './services/imageGenerationPolicy';

type MobileTab = 'project' | 'characters' | 'flow' | 'editor';

const App: React.FC = () => {
  const { t } = useLanguage();
  const { 
    vn, 
    setVisualNovel, 
    actions,
    projectList,
    currentProjectId,
    isLoaded,
    loadProject,
    createNewProject,
    deleteProject,
    duplicateProject,
    registerGeneratedProject,
    saveStatus, saveDialogueLine, saveQuickImage
  } = useVisualNovel();
  useQuickImages(vn, isLoaded, saveQuickImage);
  // This private entry supports Studio/library/play only. Quick/research is not a route.
  const [mode, setMode] = useState<'lobby' | 'edit' | 'play'>('edit');
  const [currentSceneId, setCurrentSceneId] = useState<string>('');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [startFromTitle, setStartFromTitle] = useState(true);
  const [activeTab, setActiveTab] = useState<MobileTab>('project');
  const [innerWidth, setInnerWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [showNovelModal, setShowNovelModal] = useState(false);


  useEffect(() => {
    const handleResize = () => setInnerWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // 좌측 사이드바 패널 토글 상태 (기본 활성화시켜 프로젝트 설정 우선 노출)
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  
  // 패널 너비 상태 (데스크톱용)
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(400);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const lastVnTitle = useRef(vn.title);
  useEffect(() => {
    if (vn && (vn.title !== lastVnTitle.current || !selectedSceneId)) {
        setSelectedSceneId(vn.startSceneId);
        setCurrentSceneId(vn.startSceneId);
        lastVnTitle.current = vn.title;
    }
  }, [vn, selectedSceneId]);

  const aiOps = useAiOperations(vn, actions, setVisualNovel, setSelectedSceneId, registerGeneratedProject);
  const fileIO = useFileIO({ vn, setVisualNovel, setSelectedSceneId, currentProjectId });

  // 리사이징 핸들러
  const startResizingLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const startResizingRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
  }, []);

  const onResize = useCallback((e: MouseEvent) => {
    if (isResizingLeft) {
      // 왼쪽 패널: 최소 150px, 최대 전체 화면의 50%
      const newWidth = Math.max(150, Math.min(window.innerWidth * 0.5, e.clientX));
      setLeftWidth(newWidth);
    } else if (isResizingRight) {
      // 우측 에디터 패널: 최소 400px, 그리고 드래그를 통해 고해상도 좌측 화면 확장이 가능
      // 스토리 흐름도(중간 영역)가 최소 200px 확보되도록 제약조건 설정
      const actualLeftWidth = isLeftPanelOpen ? leftWidth : 0;
      const maxRight = window.innerWidth - actualLeftWidth - 200;
      const newWidth = Math.max(400, Math.min(maxRight, window.innerWidth - e.clientX));
      setRightWidth(newWidth);

      // 흐름도 연결선(WIRES)이 실시간으로 따라올 수 있도록 가상 윈도우 리사이즈 이벤트 방출
      window.dispatchEvent(new Event('resize'));
    }
  }, [isResizingLeft, isResizingRight, leftWidth, isLeftPanelOpen]);

  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingLeft, isResizingRight, onResize, stopResizing]);

  const handlePlayFromScene = (sceneId: string) => {
    Analytics.playStart(sceneId);
    setStartFromTitle(false); 
    setCurrentSceneId(sceneId);
    setMode('play');
  };

  const handleMainPlay = () => {
      Analytics.playStart(vn.startSceneId);
      setStartFromTitle(true); 
      setCurrentSceneId(vn.startSceneId); 
      setMode('play');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'play') setMode('edit');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // 재귀적 스토리 릴레이 생성 가동 시 좌측 설정 패널을 자동 오픈하여 상호작용성 극대화
  useEffect(() => {
    if (aiOps.recursiveStage) {
      setIsLeftPanelOpen(true);
      setActiveTab('project');
    }
  }, [aiOps.recursiveStage]);

  const selectedScene = vn.scenes.find(s => s.id === selectedSceneId);

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <span className="text-xs text-gray-400 font-extrabold uppercase tracking-widest animate-pulse">{t("기기 로컬 데이터를 불러오는 중...")}</span>
        </div>
      </div>
    );
  }

  if (mode === 'lobby') {
    return (
      <div className="w-screen h-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
        <ProjectLobby 
          projects={projectList}
          currentProjectId={currentProjectId}
          onSelectProject={async (id, targetMode) => {
            await loadProject(id);
            setMode(targetMode);
          }}
          onCreateProject={async (title, description, useDemo) => {
            Analytics.projectCreate(useDemo ? 'template' : 'manual');
            await createNewProject(title, description, useDemo);
            setMode('edit');
          }}
          onDeleteProject={deleteProject}
          onDuplicateProject={duplicateProject}
          onBackToEditor={() => setMode('edit')}
        />
      </div>
    );
  }

  if (mode === 'play') {
    return (
      <div className="w-screen h-screen bg-black relative">
        <div className="absolute top-4 left-4 z-50"><LanguageSwitcher /></div>
        <GamePlayer 
            vn={vn} 
            currentSceneId={currentSceneId} 
            onChoice={id => setCurrentSceneId(id)} 
            startFromTitle={startFromTitle}
            allowChat={false}
        />
        <button
          onClick={() => setMode('edit')}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/40 hover:bg-black/80 text-white rounded-full transition-all border border-white/10 backdrop-blur-md font-bold text-xs shadow-xl"
        >
          <span className="bg-white/20 px-1 py-0.5 rounded text-[11px]">ESC</span>{t("EDITOR")}</button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
      <input
        type="file"
        ref={fileIO.fileInputRef}
        onChange={fileIO.handleFileSelected}
        accept=".json"
        className="hidden"
      />
      
      <Header 
        onSave={fileIO.handleSaveToLocalStorage}
        onSaveToFile={fileIO.handleSaveToFile}
        onLoadFromFile={fileIO.handleLoadFromFileClick}
        onExportToRenpy={fileIO.handleExportToRenpy}
        onExportToHtml={fileIO.handleExportToHtml}
        onExportWebPackage={fileIO.handleExportWebPackage}
        onReset={fileIO.handleReset}
        onPlay={handleMainPlay}
        onGoToLobby={() => {
          Analytics.sessionStartLobby();
          setMode('lobby');
        }}
        isExporting={fileIO.isExporting}
        isExportingWeb={fileIO.isExportingWeb}
        isLeftPanelOpen={isLeftPanelOpen}
        onToggleLeftPanel={() => setIsLeftPanelOpen(prev => !prev)}
      />

      <div className="flex flex-grow overflow-hidden relative">
        {/* 패널 1: 프로젝트/캐릭터 설정 (토글 가능) */}
        {(innerWidth >= 768 || activeTab === 'project' || activeTab === 'characters') && (
          <aside 
            className="flex flex-col bg-gray-800 overflow-hidden border-r border-gray-700 absolute inset-0 z-20 md:relative"
            style={
              innerWidth >= 768 
                ? { 
                    width: isLeftPanelOpen ? `${leftWidth}px` : '0px', 
                    minWidth: isLeftPanelOpen ? '150px' : '0px',
                    display: isLeftPanelOpen ? 'flex' : 'none'
                  } 
                : {}
            }
          >
            <div className="flex-shrink-0 bg-gray-800/80 backdrop-blur-md border-b border-gray-700 flex p-1 m-4 rounded-xl">
              <button 
                onClick={() => setActiveTab('project')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'project' ? 'bg-indigo-600 text-gray-950 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <SparklesIcon className="w-3.5 h-3.5" />{t("프로젝트")}</button>
              <button 
                onClick={() => setActiveTab('characters')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'characters' ? 'bg-indigo-600 text-gray-950 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <UserIcon className="w-3.5 h-3.5" />{t("캐릭터")}</button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 pt-0 gap-5 flex flex-col custom-scrollbar">
              {activeTab === 'project' && (
                <div className="space-y-5 animate-fade-in">
                  <StoryGenerator manualOnly
                    contentLanguage={aiOps.contentLanguage}
                    setContentLanguage={aiOps.setContentLanguage}
                    vn={vn}
                    aiTheme={aiOps.aiTheme}
                    setAiTheme={aiOps.setAiTheme}
                    onGenerateStory={aiOps.handleGenerateStory}
                    onGenerateDemoStory={aiOps.handleGenerateDemoStory}
                    isGenerating={aiOps.isGenerating}
                    progress={aiOps.progress}
                    error={aiOps.error}
                    recursiveStage={aiOps.recursiveStage}
                    setRecursiveStage={aiOps.setRecursiveStage}
                    recursiveQuestion={aiOps.recursiveQuestion}
                    recursiveChoices={aiOps.recursiveChoices}
                    onStartRecursive={aiOps.handleStartRecursiveInitial}
                    onNextRecursive={aiOps.handleNextRecursiveStep}
                    onCancelRecursive={aiOps.handleCancelRecursive}
                    onOpenNovelCompiler={() => setShowNovelModal(true)}
                    showRelayedToast={aiOps.showRelayedToast}
                    setShowRelayedToast={aiOps.setShowRelayedToast}
                  />

                  <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-xl space-y-4">
                    <h2 className="font-black text-[11px] flex items-center gap-2 text-indigo-400 uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>{t("Project Core")}</h2>
                    <div className="space-y-3">
                        <div className="group">
                            <label className="text-gray-500 text-[11px] block mb-1 uppercase font-black tracking-widest">{t("Main Title")}</label>
                            <textarea 
                                value={vn.title} 
                                onChange={e => actions.updateTitle(e.target.value)} 
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:border-indigo-500 outline-none transition-all font-bold resize-none" 
                            />
                        </div>
                        <div className="group">
                            <label className="text-gray-500 text-[11px] block mb-1 uppercase font-black tracking-widest">{t("Entry Scene")}</label>
                            <select 
                                value={vn.startSceneId} 
                                onChange={e => actions.updateStartSceneId(e.target.value)} 
                                className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded-lg border border-gray-700 focus:border-indigo-500 outline-none"
                            >
                                {vn.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'characters' && (
                <div className="animate-fade-in">
                  <CharacterList 
                    characters={vn.characters}
                    actions={actions}
                    aiOps={aiOps}
                   />
                </div>
              )}
              <button className="md:hidden mt-4 p-3 bg-gray-700 rounded-xl text-xs font-bold" onClick={() => setActiveTab('editor')}>{t("편집기로 돌아가기")}</button>
            </div>
          </aside>
        )}

        {/* 리사이저 1: 왼쪽 패널이 활성화되어 있을 때만 드래그 리사이즈 활성화 */}
        {isLeftPanelOpen && (
          <div 
            onMouseDown={startResizingLeft}
            className="hidden md:block w-1.5 bg-gray-950 hover:bg-indigo-500/50 cursor-col-resize transition-all z-30 group"
          >
            <div className="h-full w-full opacity-0 group-hover:opacity-100 bg-indigo-500 shadow-[0_0_10px_rgba(200,241,53,0.8)]"></div>
          </div>
        )}

        {/* 패널 2: 스토리 흐름도 */}
        {(innerWidth >= 768 || activeTab === 'flow') && (
          <div 
            className="flex flex-col flex-grow md:flex-1 bg-gray-800 border-r border-gray-700 overflow-hidden absolute inset-0 z-20 md:relative"
          >
               <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-900 bg-gray-900/40 select-none">
                  <h2 className="font-black text-xs text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>{t("Story Flow")}</h2>
               </div>
               
               <SceneTree 
                  vn={vn} 
                  selectedSceneId={selectedSceneId} 
                  onSelectScene={(id) => { setSelectedSceneId(id); if(innerWidth < 768) setActiveTab('editor'); }}
                  onPlayFromScene={handlePlayFromScene} 
                  actions={actions}
               />
               <button className="md:hidden mt-auto m-4 p-3.5 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-xl text-xs font-black tracking-wider shadow-lg" onClick={() => setActiveTab('editor')}>{t("장면 편집하기")}</button>
          </div>
        )}

        {/* 리사이저 2: 우측 장면 편집 패널 너비 조율용 */}
        <div 
          onMouseDown={startResizingRight}
          className="hidden md:block w-1.5 bg-gray-950 hover:bg-indigo-500/50 cursor-col-resize transition-all z-30 group"
          title={t("장면 편집 영역 너비 조절")}
        >
          <div className="h-full w-full opacity-0 group-hover:opacity-100 bg-indigo-500 shadow-[0_0_10px_rgba(200,241,53,0.8)]"></div>
        </div>

        {/* 패널 3: 메인 편집 영역 (우측 최소 400픽셀, 좌측 방향 드래그 조율 지원) */}
        {(innerWidth >= 768 || activeTab === 'editor') && (
          <main 
            className="flex flex-col bg-gray-900 p-4 md:p-6 overflow-y-auto custom-scrollbar w-full h-full relative"
            style={innerWidth >= 768 ? { width: `${rightWidth}px`, minWidth: '400px', maxWidth: '1200px', flexGrow: 0, flexShrink: 0 } : {}}
          >
            <SceneEditor manualOnly
              selectedScene={selectedScene}
              vn={vn}
              actions={actions}
              aiOps={aiOps}
            />
            <div className="h-20 md:hidden"></div>
          </main>
        )}
      </div>

      <nav className="md:hidden flex h-16 bg-gray-800 border-t border-gray-700 shadow-2xl z-50">
        <button onClick={() => setActiveTab('project')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'project' ? 'text-indigo-400' : 'text-gray-500'}`}>
            <SparklesIcon className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase">{t("프로젝트")}</span>
        </button>
        <button onClick={() => setActiveTab('characters')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'characters' ? 'text-indigo-400' : 'text-gray-500'}`}>
            <UserIcon className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase">{t("캐릭터")}</span>
        </button>
        <button onClick={() => setActiveTab('flow')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'flow' ? 'text-indigo-400' : 'text-gray-500'}`}>
            <RouteIcon className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase">{t("흐름도")}</span>
        </button>
        <button onClick={() => setActiveTab('editor')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'editor' ? 'text-indigo-400' : 'text-gray-500'}`}>
            <EditIcon className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase">{t("편집")}</span>
        </button>
      </nav>

      {/* 성공 모달 */}
      {aiOps.showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-gray-900 border border-indigo-500/50 rounded-[2rem] p-8 shadow-[0_0_50px_rgba(200,241,53,0.3)] animate-scale-up text-center">
            <div className="mb-6 inline-flex p-4 bg-indigo-500/20 rounded-full text-indigo-400">
               <SparklesIcon className="w-10 h-10 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black mb-2 text-white italic tracking-tight">{t("게임 초안 완성!")}</h2>
            <p className="text-indigo-200/70 text-sm mb-8 leading-relaxed">{t(isImageGenerationEnabled() ? "새로운 시나리오와 비주얼이 준비되었습니다." : 'Story text ready')}<br/>
              <span className="font-bold text-white">"{vn.title}"</span><br/>{t("지금 바로 확인해 보시겠습니까?")}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { aiOps.setShowSuccessModal(false); handleMainPlay(); }}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-gray-950 rounded-full font-black text-lg shadow-lg shadow-indigo-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5" />{t("지금 플레이하기")}</button>
              <button 
                onClick={() => aiOps.setShowSuccessModal(false)}
                className="w-full py-3 bg-transparent text-gray-400 hover:text-white rounded-full font-bold text-sm transition-all"
              >{t("나중에 확인하기 (편집 유지)")}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* 소설 컴파일러 모달 */}
      <NovelSummaryModal 
        isOpen={showNovelModal} 
        onClose={() => setShowNovelModal(false)} 
        summaryText={aiOps.novelSummary} 
        isGenerating={aiOps.isGeneratingNovel} 
        onGenerate={aiOps.handleGenerateNovel} 
      />

      <style>{`

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        @keyframes scale-up { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
