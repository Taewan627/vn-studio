import React, { useEffect, useRef, useState } from 'react';
import type { ProjectMetadata, VisualNovel } from '../types';
import { StoryLanguageProvider, useLanguage } from '../i18n/LanguageProvider';
import { resolveContentLanguage, type ContentLanguage } from '../i18n/locales';
import { BUNDLED_STORIES } from '../data/bundledStories';
import { DEMO_VN, DEMO_VN_EN } from '../constants';
import { loadVisualNovelData } from '../utils/db';
import { decodeQuickImage } from '../services/quickImageLoading';
import { matchesBundledSource, validateBundledStory } from '../services/bundledStories';
import GamePlayer from './GamePlayer';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

export type BackgroundGeneration = {
  active: boolean; ready: boolean; error: boolean; elapsed: number;
  language: ContentLanguage; message: string; onOpen: () => void;
};
const labels = { en: 'English', ja: '日本語', ko: '한국어' };
const action = 'min-h-12 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-gray-950 disabled:opacity-40 font-bold';
const secondary = 'min-h-12 px-4 py-3 rounded-xl border border-slate-600 hover:bg-slate-800 disabled:opacity-40';

export function BackgroundGenerationNotice({ job }: { job: BackgroundGeneration }) {
  const { t } = useLanguage();
  if (!job.active && !job.ready && !job.error) return null;
  return <aside data-testid="library-generation-status" className="p-3 bg-slate-900 text-white border-b border-slate-700 space-y-2 text-sm">
    <p role="status" aria-live="polite" data-testid={job.ready ? 'library-new-ready' : undefined}>
      {t(job.ready ? 'New story ready' : job.error ? 'Quick error' : 'Generation in background')} · {labels[job.language]}
    </p>
    {job.active && <p>{t(job.message)} · {t('Generation elapsed', { seconds: job.elapsed })}</p>}
    {job.ready && <button className={action} onClick={job.onOpen}>{t('Open new story')}</button>}
  </aside>;
}

const LibraryPlayer: React.FC<{ story: VisualNovel; job: BackgroundGeneration; onBack: () => void; onCompleted?: (story:VisualNovel,id:string)=>void; renderSurvey?:(story:VisualNovel)=>React.ReactNode }> = ({ story, job, onBack, onCompleted, renderSurvey }) => {
  const { t } = useLanguage();
  const [sceneId, setSceneId] = useState(story.startSceneId);
  const [ending, setEnding] = useState('');
  return <div className="h-[100dvh] flex flex-col bg-black text-white" data-testid="library-player">
    <header className="shrink-0 flex items-center justify-between gap-2 p-2 bg-slate-950 text-sm">
      <div className="min-w-0 text-xs"><p>{labels[resolveContentLanguage(story.contentLanguage)]}</p>
        {story.generationSource === 'demo' && <p className="text-indigo-200">{t('Quick demo label')}</p>}
        {story.id?.startsWith('builtin-demo-') && story.generationSource === 'ai' && <p className="text-indigo-200">{t('Public AI demo')}</p>}
      </div>
      <button className={secondary} onClick={onBack}>{t('Library player back')}</button>
    </header>
    <BackgroundGenerationNotice job={job} />
    <div className="relative flex-1 min-h-0">
      {ending ? <section className="h-full overflow-y-auto flex flex-col justify-center items-center gap-5 p-5 text-center" data-testid="library-completion">
        <h1 className="text-2xl font-bold">{t('Quick completed')}</h1>
        <p>{t('Quick ending')}: {story.scenes.find(s => s.id === ending)?.name}</p>
        {renderSurvey?.(story)}
        <button className={action} onClick={() => { setEnding(''); setSceneId(story.startSceneId); }}>{t('Library play')}</button>
        <button className={secondary} onClick={onBack}>{t('Library player back')}</button>
      </section> : <GamePlayer vn={story} currentSceneId={sceneId} onChoice={setSceneId} startFromTitle
        allowChat={false} onFinish={id=>{onCompleted?.(story,id);setEnding(id);}} />}
    </div>
  </div>;
};

interface Props {
  projects: ProjectMetadata[]; unavailableProjectId?: string; job: BackgroundGeneration;
  onBack: () => void; onEdit: (id: string) => Promise<void>; onDelete: (id: string) => Promise<unknown>;
  onCompleted?: (story:VisualNovel,id:string)=>void; renderSurvey?:(story:VisualNovel)=>React.ReactNode;
}

// This is a read-only projection of the existing Studio lobby data. Opening or
// playing never changes vn_active_project_id, saves a demo, or calls an AI API.
export function QuickStoryLibrary({ projects, unavailableProjectId, job, onBack, onEdit, onDelete, onCompleted, renderSurvey }: Props) {
  const { t, language } = useLanguage();
  const [story, setStory] = useState<VisualNovel | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [error, setError] = useState(false);
  const [languages, setLanguages] = useState<Record<string, ContentLanguage>>({});
  const [publishedSources, setPublishedSources] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    void Promise.all(projects.map(async project => await matchesBundledSource(project, BUNDLED_STORIES) ? project.id : null))
      .then(ids => { if (active) setPublishedSources(new Set(ids.filter((id): id is string => !!id))); })
      .catch(() => { if (active) setPublishedSources(new Set()); });
    return () => { active = false; };
  }, [projects]);
  // Retain decoded images throughout this playback, without placing the game
  // into the active editable project or the automatic image generation queue.
  const decoded = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(projects.filter(p => !p.contentLanguage).map(async p => {
      const saved = await loadVisualNovelData('vn_proj_' + p.id);
      return [p.id, resolveContentLanguage(saved?.contentLanguage)] as const;
    })).then(entries => { if (active) setLanguages(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [projects]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (story) setStory(null); else onBack(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [story, onBack]);

  async function open(id: string, url?: string) {
    if (loadingRef.current) return;
    loadingRef.current = true; setLoading(true); setError(false);
    try {
      let value: VisualNovel;
      if (url) {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('Sample unavailable');
        value = await response.json();
        const entry = BUNDLED_STORIES.find(e => e.id === id && e.url === url);
        if (!entry || !validateBundledStory(value, entry)) throw Error('Invalid sample');
      } else value = await loadVisualNovelData('vn_proj_' + id);
      if (!value?.scenes?.some(scene => scene.id === value.startSceneId)) throw Error('Project unavailable');
      if (isImageGenerationEnabled() && value.quickImages && [value.quickImages.background, ...Object.values(value.quickImages.characters)].some(s => s === 'queued' || s === 'generating')) throw Error('Project still preparing');
      const urls = [...new Set([value.coverUrl, ...value.scenes.map(s => s.backgroundUrl), ...value.characters.flatMap(c => c.expressions.map(e => e.imageUrl))].filter(Boolean))];
      decoded.current = await Promise.all(urls.map(decodeQuickImage));
      setStory(structuredClone(value));
    } catch { setError(true); }
    finally { loadingRef.current = false; setLoading(false); }
  }
  if (story) return <StoryLanguageProvider language={resolveContentLanguage(story.contentLanguage)}>
    <LibraryPlayer key={story.id} story={story} job={job} onCompleted={onCompleted} renderSurvey={renderSurvey} onBack={() => { setStory(null); decoded.current = []; }} />
  </StoryLanguageProvider>;

  const personal = [...projects].filter(p => !publishedSources.has(p.id) && !(p.id === 'proj_demo' && (p.title === DEMO_VN.title || p.title === DEMO_VN_EN.title) && !p.generationProfile))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return <div className="h-[100dvh] overflow-y-auto bg-slate-950 text-slate-100" data-testid="quick-library" aria-busy={loading}>
    <header className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
      <h1 className="text-2xl font-bold">{t('My stories')}</h1><button className={secondary} onClick={onBack}>{t('Library back')}</button>
    </header>
    <BackgroundGenerationNotice job={job} />
    <main className="max-w-3xl mx-auto p-4 space-y-5">
      <p className="text-sm text-slate-300">{t('Library local')}</p>
      {job.active && <><p className="text-sm text-indigo-200">{t('Library read only')}</p><p className="text-xs text-slate-400">{t('Background limitation')}</p></>}
      {loading && <p role="status">{t('Library loading')}</p>}
      {error && <p role="alert" className="text-amber-200">{t('Library error')}</p>}
      <section className="space-y-4" data-testid="library-personal">
        {personal.map(project => <article key={project.id} data-project-id={project.id} className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
          <div className="flex gap-3 min-w-0">
            {project.coverUrl ? <img src={project.coverUrl} alt="" loading="lazy" className="w-24 h-20 rounded-lg object-cover shrink-0" /> : <div className="w-24 h-20 bg-indigo-950 rounded-lg shrink-0 flex items-center justify-center">VN</div>}
            <div className="min-w-0"><h2 className="text-lg font-bold break-words">{project.title}</h2>
              <p className="text-sm text-indigo-200">{project.contentLanguage || languages[project.id] ? labels[project.contentLanguage ?? languages[project.id]] : '…'}</p>
              <p className="text-xs text-slate-400">{t('Library modified')}: <time dateTime={new Date(project.updatedAt || 0).toISOString()}>{new Date(project.updatedAt || 0).toLocaleString(language)}</time></p>
            </div>
          </div>
          {project.id === unavailableProjectId && <p className="text-sm">{t('Library pending')}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={action + ' grow'} disabled={loading || project.id === unavailableProjectId} onClick={() => void open(project.id)}>{t('Library play')}</button>
            <button className={secondary} disabled={loading || job.active} onClick={() => void onEdit(project.id)}>{t('Library edit')}</button>
            <button className={secondary} disabled={loading || job.active} onClick={async () => {
              if (!window.confirm(t('Library delete confirm', { title: project.title }))) return;
              setLoading(true); setError(false);
              try { if (await onDelete(project.id) === false) setError(true); } catch { setError(true); } finally { setLoading(false); }
            }}>{t('Library delete')}</button>
          </div>
        </article>)}
      </section>
      <section className="space-y-4 border-t border-slate-700 pt-5" data-testid="library-builtin">
        <h2 className="text-xl font-bold">{t('Built-in stories')}</h2><p className="text-sm text-slate-300">{t('Built-in note')}</p>
        {BUNDLED_STORIES.map(entry => <article key={entry.id} data-project-id={entry.id} className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
          <div className="flex gap-3"><img src={entry.coverUrl} alt="" loading="lazy" className="w-24 h-20 rounded-lg object-cover shrink-0" />
            <div className="min-w-0"><h3 className="text-lg font-bold break-words">{entry.title}</h3><p className="text-indigo-200">{labels[entry.language]}</p></div>
          </div>
          <button className={action + ' w-full'} disabled={loading} onClick={() => void open(entry.id, entry.url)}>{t('Library play')}</button>
        </article>)}
      </section>
    </main>
  </div>;
}
