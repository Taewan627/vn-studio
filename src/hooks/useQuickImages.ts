import { useEffect, useRef } from 'react';
import type { VisualNovel } from '../types';
import { generateCharacterImage, generateSceneBackground } from '../services/geminiService';
import { isQuickImage, type QuickImageUpdate } from '../services/quickImages';
import { removeCharacterImageBackground } from '../utils/imageProcessing';
import { decodeQuickImage, withQuickImageTimeout, QUICK_IMAGE_JOB_TIMEOUT_MS } from '../services/quickImageLoading';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

// App-level lifetime: editing, playing or opening Studio does not stop image saves.
// One background + one image per character (at most two); one request at a time.
export function useQuickImages(vn: VisualNovel, loaded: boolean, save: (projectId: string, update: QuickImageUpdate) => Promise<boolean>) {
  const saver = useRef(save); saver.current = save;
  const started = useRef(new Set<string>());
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    if (!isImageGenerationEnabled()) return;
    if (!loaded || !vn.id || vn.generationSource !== 'ai' || !vn.quickImages || started.current.has(vn.id)) return;
    const images = vn.quickImages;
    if (![images.background, ...Object.values(images.characters)].some(s => s === 'queued' || s === 'generating')) return;
    const projectId = vn.id;
    started.current.add(projectId); pending.current++;
    const options = { generationProfile: 'quick' as const, contentLanguage: vn.contentLanguage };
    const firstScene = vn.scenes.find(s => s.id === vn.startSceneId) || vn.scenes[0];
    const tasks = [
      { kind: 'background' as const, characterId: undefined, status: images.background,
        run: () => generateSceneBackground(`Create an empty environment background plate. Use ONLY the location, architecture, furniture, objects and lighting from the scene notes below. Ignore all people, character descriptions, poses, actions and facial expressions in these notes; show the setting after everyone has left. Scene notes: ${firstScene.aiPrompt || firstScene.name}. No text or lettering.`.slice(0, 2000), options) },
      ...vn.characters.slice(0, 2).map(c => ({ kind: 'character' as const, characterId: c.id, status: images.characters[c.id],
        run: async () => {
          const raw = await generateCharacterImage(c.name.slice(0, 2000), `${c.aiPrompt || c.description || c.name}. Solid magenta #FF00FF backdrop for chroma key.`.slice(0, 2000), 'neutral', options);
          if (!isQuickImage(raw)) throw new Error('No generated character image');
          return removeCharacterImageBackground(raw);
        } })),
    ];
    queue.current = queue.current.then(async () => {
      for (const task of tasks) {
        if (!isImageGenerationEnabled()) break;
        const target = { kind: task.kind, characterId: task.characterId };
        // A refreshed page cannot recover an already-sent request. Do not bill a
        // duplicate automatic retry; retain completed images and label fallback.
        if (task.status === 'generating') {
          await saver.current(projectId, { ...target, status: 'failed' }); continue;
        }
        if (task.status !== 'queued') continue;
        if (!await saver.current(projectId, { ...target, status: 'generating' })) break;
        try {
          const url = await withQuickImageTimeout((async () => {
            const result = await task.run();
            if (!isQuickImage(result)) throw new Error('Invalid generated image');
            await decodeQuickImage(result);
            return result;
          })(), QUICK_IMAGE_JOB_TIMEOUT_MS);
          if (!isQuickImage(url)) throw new Error('Invalid generated image');
          await saver.current(projectId, { ...target, status: 'ready', url });
        } catch {
          await saver.current(projectId, { ...target, status: 'failed' });
        }
      }
    }).catch(() => { /* Storage failure must never interrupt the game. */ }).finally(() => { pending.current--; });
  }, [vn.id, vn.quickImages, loaded]);
}
