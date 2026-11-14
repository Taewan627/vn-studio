import { useEffect, useMemo, useRef, useState } from 'react';
import type { VisualNovel } from '../types';
import type { QuickImageUpdate } from '../services/quickImages';
import { decodeQuickImage } from '../services/quickImageLoading';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

type SaveStatus = 'saved' | 'saving' | 'error';
type ImageTarget = { kind: 'background' | 'character'; characterId?: string; status: string | undefined; urls: string[] };

export function useQuickPlayback(vn: VisualNovel, saveStatus: SaveStatus,
  saveImage: (projectId: string, update: QuickImageUpdate) => Promise<boolean>) {
  const generationEnabled = isImageGenerationEnabled();
  const required = generationEnabled && vn.generationSource === 'ai' && !!vn.quickImages;
  const targets: ImageTarget[] = useMemo(() => required ? [
    { kind: 'background', status: vn.quickImages!.background, urls: [...new Set([vn.coverUrl, ...vn.scenes.map(s => s.backgroundUrl)])] },
    ...vn.characters.map(c => ({ kind: 'character' as const, characterId: c.id, status: vn.quickImages!.characters[c.id], urls: [...new Set(c.expressions.map(e => e.imageUrl))] })),
  ] : [], [required, vn.quickImages, vn.coverUrl, vn.scenes, vn.characters]);
  const total = targets.length;
  const completed = targets.filter(t => t.status === 'ready' || t.status === 'failed').length;
  const generating = completed !== total;
  const key = useMemo(() => JSON.stringify([vn.id, targets]), [vn.id, targets]);
  const [attempt, setAttempt] = useState(0);
  const [decoded, setDecoded] = useState<{ key: string; images: HTMLImageElement[]; error: boolean } | null>(null);
  const saver = useRef(saveImage); saver.current = saveImage;

  useEffect(() => {
    if (!required || generating) return;
    let active = true;
    const projectId = vn.id;
    // Deduplicate the common background and reused character expressions.
    const urls = [...new Set(targets.flatMap(t => t.urls))];
    const images = new Map<string, HTMLImageElement>();
    void Promise.allSettled(urls.map(async url => { images.set(url, await decodeQuickImage(url)); })).then(async () => {
      if (!active) return;
      const failed = targets.filter(t => t.urls.length === 0 || t.urls.some(url => !images.has(url)));
      const brokenRasters = failed.filter(t => t.status === 'ready' && t.urls.every(url => !url || url.startsWith('data:image/')));
      if (projectId && brokenRasters.length) {
        // A corrupt persisted/generated raster is a failure, never AI success.
        // Merge only the affected target into the latest project, then load its
        // labeled fallback on the next pass. This starts no paid image request.
        // Keep manually assigned file/remote URLs intact on a transient network
        // failure. Only unusable inline AI rasters are replaced automatically.
        for (const target of brokenRasters) {
          if (!active) return;
          await saver.current(projectId, { kind: target.kind, characterId: target.characterId, status: 'failed' });
        }
        return;
      }
      if (active) setDecoded({ key, images: [...images.values()], error: failed.length > 0 });
    }).catch(() => {
      if (active) setDecoded({ key, images: [], error: true });
    });
    return () => { active = false; };
  }, [key, required, generating, attempt]);

  const loaded = !required || (decoded?.key === key && !decoded.error);
  const loadError = required && decoded?.key === key && decoded.error;
  const ready = !generating && loaded && saveStatus === 'saved';
  const message = saveStatus === 'error' ? 'Project save error'
    : generating ? 'Preparing game images'
    : loadError ? 'Image loading error'
    : !loaded ? 'Loading game images'
    : saveStatus !== 'saved' ? 'Saving generated'
    : !generationEnabled ? ([vn.coverUrl, ...vn.scenes.map(s => s.backgroundUrl), ...vn.characters.flatMap(c => c.expressions.map(e => e.imageUrl))].some(Boolean)
        || (vn.quickImages && [vn.quickImages.background, ...Object.values(vn.quickImages.characters)].includes('failed'))
        ? 'Image generation disabled' : 'Images intentionally omitted')
    : targets.some(t => t.status === 'failed') ? 'Game ready with defaults' : 'Game images ready';
  return { ready, generating, loadError, completed, total, message,
    retry: () => { setDecoded(null); setAttempt(n => n + 1); } };
}
