import React from 'react';
import { ProjectMetadata } from '../types';
import { PlayIcon, EditIcon } from './icons';
import { Analytics } from '../utils/analytics';
import { useLanguage } from '../i18n/LanguageProvider';

interface ProjectLobbyProps {
  projects: ProjectMetadata[];
  currentProjectId: string;
  onSelectProject: (id: string, mode: 'edit' | 'play') => void;
  onCreateProject: (title?: string, description?: string, useDemo?: boolean) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onBackToEditor: () => void;
  onOpenGuide?: () => void;
}

export const ProjectLobby: React.FC<ProjectLobbyProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onDeleteProject,
  onDuplicateProject,
  onBackToEditor,
  onCreateProject,
  onOpenGuide
}) => {
  const { t } = useLanguage();
  // Format timestamp into relative Korean string
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return t('방금 전');
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return t('{minutes}분 전', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('{hours}시간 전', { hours });
    
    const date = new Date(timestamp);
    return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleDelete = async (proj: ProjectMetadata) => {
    if (window.confirm(t('"{title}" 프로젝트를 정말 삭제하시겠습니까?\n모든 에피소드 장면과 인물 정보가 기기 내 DB에서 영구 소멸되어 복구할 수 없습니다.', { title: proj.title }))) {
      await onDeleteProject(proj.id);
      alert(t('프로젝트가 무사히 삭제되었습니다.'));
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-950 text-white p-4 md:p-12 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
        
        {/* Lobby Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5 md:pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] md:text-[11px] text-indigo-400 font-bold uppercase tracking-[0.25em] bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Local Storage Engine
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
              {t('📂 프로젝트 목록')}
              <span className="text-gray-500 text-sm md:text-base font-normal">Lobby</span>
            </h1>
            <p className="text-gray-400 text-[11px] md:text-xs mt-1 font-medium">
              {t('기기 내 브라우저 데이터베이스에 저장된 비주얼 노벨 소설 리스트입니다.')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="px-4 py-2.5 md:px-5 md:py-3 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white rounded-xl md:rounded-full font-black text-xs md:text-sm tracking-wider uppercase border border-indigo-500/40 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
                title={t("초보자를 위한 사용법 가이드 및 PDF 저장")}
              >
                <span>{t('📖 사용법 가이드 (PDF)')}</span>
              </button>
            )}
            <button 
              onClick={onBackToEditor}
              className="px-5 py-2.5 md:px-6 md:py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl md:rounded-full font-black text-xs md:text-sm tracking-wider uppercase border border-white/10 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>{t('← 편집화면 돌아가기')}</span>
            </button>
          </div>
        </div>

        {/* --- [1] MOBILE-ONLY CARD LIST (md 미만 모바일 친화적 뷰) --- */}
        <div className="block md:hidden space-y-4">
          {projects.map((proj, idx) => {
            const isCurrentlySelected = proj.id === currentProjectId;
            return (
              <div 
                key={proj.id}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrentlySelected 
                    ? 'bg-indigo-950/20 border-indigo-500/40 shadow-md' 
                    : 'bg-gray-900/60 border-gray-850'
                }`}
              >
                {/* 상단 뱃지 및 메타 */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-gray-500">
                    #{projects.length - idx}
                  </span>
                  <div className="flex items-center gap-2">
                    {isCurrentlySelected && (
                      <span className="px-2 py-0.5 text-[11px] font-extrabold tracking-tight bg-indigo-600 text-gray-950 rounded-full">
                        {t('현재 편집 중')}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400 font-semibold bg-gray-805 px-2 py-0.5 rounded">
                      🕒 {formatTime(proj.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* 제목 및 설명 */}
                <div className="space-y-1.5 mb-4">
                  <h3 
                    onClick={() => onSelectProject(proj.id, 'edit')}
                    className="font-bold text-white text-base hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    {proj.title}
                  </h3>
                  
                  {/* 등장인물 및 장면 수 요약 배지 */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 font-semibold bg-gray-900/50 px-2 py-1 rounded border border-gray-800 w-max">
                    <span className="flex items-center gap-1 text-indigo-400">
                      👥 {t('등장인물:')} <strong className="text-white">{proj.characterCount ?? 0}</strong>{t('명')}
                    </span>
                    <span className="w-px h-2 bg-gray-800"></span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      🎬 {t('장면 수:')} <strong className="text-white">{proj.sceneCount ?? 0}</strong>{t('개')}
                    </span>
                  </div>

                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                    {proj.description || t('작성된 요약 설명이 없습니다.')}
                  </p>
                </div>

                {/* 모바일 하단 터치 친화적 액션 버튼 모음 - 플레이 버튼 맨 왼쪽 */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => onSelectProject(proj.id, 'play')}
                    className="col-span-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-black tracking-tight transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
                    title={t("플레이 재생")}
                  >
                    <span className="text-xs">▶</span>
                    <span>{t('플레이')}</span>
                  </button>

                  <button
                    onClick={() => onSelectProject(proj.id, 'edit')}
                    className="col-span-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-[11px] font-extrabold tracking-tight transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border border-white/5"
                    title={t("편집하기")}
                  >
                    <span className="text-xs">✍</span>
                    <span>{t('수정')}</span>
                  </button>

                  <button
                    onClick={() => onDuplicateProject(proj.id)}
                    className="col-span-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[11px] font-bold tracking-tight transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border border-white/5"
                    title={t("복사하기")}
                  >
                    <span className="text-xs">📂</span>
                    <span>{t('복제')}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(proj)}
                    className="col-span-1 py-2.5 bg-red-955/20 hover:bg-red-800 text-red-400 rounded-lg text-[11px] font-bold tracking-tight transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 border border-red-900/10"
                    title={t("삭제하기")}
                  >
                    <span className="text-xs">🗑️</span>
                    <span>{t('삭제')}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {projects.length === 0 && (
            <div className="p-12 text-center text-gray-500 text-xs bg-gray-900/30 rounded-xl border border-dashed border-gray-800">
              {t('보관함이 비어있습니다.')}
            </div>
          )}
        </div>


        {/* --- [2] DESKTOP TABLE/BULLETIN LIST (md 이상 게시판 뷰) --- */}
        <div className="hidden md:block bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-20 text-center">{t('번호')}</th>
                  <th className="py-4 px-4 w-28 text-center">{t('작업 상태')}</th>
                  <th className="py-4 px-5">{t('스토리 제목 및 시놉시스')}</th>
                  <th className="py-4 px-4 w-36 text-center">{t('프로젝트 규모')}</th>
                  <th className="py-4 px-4 w-32">{t('수정 일정')}</th>
                  <th className="py-4 px-6 w-80 text-right">{t('관리 제어')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850">
                {projects.map((proj, idx) => {
                  const isCurrentlySelected = proj.id === currentProjectId;
                  return (
                    <tr 
                      key={proj.id}
                      className={`transition-colors hover:bg-gray-900/80 ${isCurrentlySelected ? 'bg-indigo-500/5' : ''}`}
                    >
                      {/* 상태/순번 */}
                      <td className="py-5 px-6 text-center text-xs font-mono text-gray-500">
                        #{projects.length - idx}
                      </td>

                      {/* 작업 상태 뱃지 */}
                      <td className="py-5 px-4 text-center">
                        {isCurrentlySelected ? (
                          <span className="inline-block px-3 py-1 text-[11px] font-black tracking-wider bg-indigo-600 text-gray-950 rounded-full uppercase">
                            {t('수정 상주')}
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 text-[11px] font-extrabold tracking-wider bg-gray-800 text-gray-400 rounded-full">
                            {t('대기 중')}
                          </span>
                        )}
                      </td>

                      {/* 게임 제목 및 상세 정보 */}
                      <td className="py-5 px-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={() => onSelectProject(proj.id, 'edit')}
                              className="font-extrabold text-white hover:text-indigo-400 cursor-pointer text-sm transition-colors text-ellipsis overflow-hidden"
                            >
                              {proj.title}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs font-medium max-w-xl line-clamp-1">
                            {proj.description || t('상세 시놉시스가 존재하지 않습니다.')}
                          </p>
                        </div>
                      </td>

                      {/* 프로젝트 규모 배지 정보 */}
                      <td className="py-5 px-4 text-center">
                        <div className="inline-flex gap-2 text-[11px] font-bold">
                          <span className="px-2 py-1 bg-indigo-950/40 text-indigo-300 rounded border border-indigo-900/30 flex items-center gap-1">
                            👥 {t('인물')} <strong className="text-white font-black">{proj.characterCount ?? 0}</strong>
                          </span>
                          <span className="px-2 py-1 bg-emerald-950/40 text-emerald-300 rounded border border-emerald-900/30 flex items-center gap-1">
                            🎬 {t('장면')} <strong className="text-white font-black">{proj.sceneCount ?? 0}</strong>
                          </span>
                        </div>
                      </td>

                      {/* 수정일 */}
                      <td className="py-5 px-4 text-xs font-semibold text-gray-400">
                        {formatTime(proj.updatedAt)}
                      </td>

                      {/* Actions: 수정/플레이/복제/삭제 순서 - 플레이 버튼 가장 중요하게 왼쪽으로 당김 */}
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <button 
                            onClick={() => onSelectProject(proj.id, 'play')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-extrabold transition-all shadow-md shadow-emerald-950/20 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1"
                            title={t("게임 바로 시작")}
                          >
                            <span>▶</span>
                            <span>{t('플레이')}</span>
                          </button>

                          <button 
                            onClick={() => onSelectProject(proj.id, 'edit')}
                            className="px-3 py-1.5 bg-gray-850 hover:bg-indigo-600 hover:text-white text-gray-300 rounded-lg font-bold transition-all border border-gray-800 flex items-center gap-1"
                            title={t("시나리오 에디터 켜기")}
                          >
                            <span>✍</span>
                            <span>{t('수정')}</span>
                          </button>
                          
                          <button 
                            onClick={() => onDuplicateProject(proj.id)}
                            className="px-2.5 py-1.5 bg-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg font-bold transition-all border border-gray-800 flex items-center gap-1"
                            title={t("동일 사본 생성")}
                          >
                            <span>📂</span>
                            <span>{t('복제')}</span>
                          </button>

                          <button 
                            onClick={() => handleDelete(proj)}
                            className="px-2.5 py-1.5 hover:bg-red-950 hover:text-red-400 text-gray-600 rounded-lg font-bold transition-all border border-transparent hover:border-red-900/35 flex items-center gap-1"
                            title={t("영구 삭제")}
                          >
                            <span>🗑️</span>
                            <span>{t('삭제')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {projects.length === 0 && (
            <div className="p-16 text-center text-gray-500 text-xs">
              {t('등록된 비주얼 노벨 소설 프로젝트 코드가 존재하지 않습니다.')}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
