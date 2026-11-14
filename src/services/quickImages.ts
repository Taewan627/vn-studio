import type { VisualNovel } from '../types';

export type QuickImageUpdate = {
  kind: 'background' | 'character';
  characterId?: string;
  status: 'generating' | 'ready' | 'failed';
  url?: string;
};
export const QUICK_IMAGE_MAX_LENGTH = 1_000_000;
export const isQuickImage = (url: unknown): url is string => typeof url === 'string' &&
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= QUICK_IMAGE_MAX_LENGTH;

// Merge only image fields into the latest project; never replace edited dialogue.
export function applyQuickImage(vn: VisualNovel, update: QuickImageUpdate): VisualNovel {
  if (!vn.quickImages || (update.status === 'ready' && !isQuickImage(update.url))) throw new Error('Invalid Quick image update');
  const images = { ...vn.quickImages, characters: { ...vn.quickImages.characters } };
  if (update.kind === 'background') {
    images.background = update.status;
    if (update.status === 'generating') return { ...vn, quickImages: images };
    const url = update.status === 'ready' ? update.url! : '/quick-room.svg';
    return { ...vn, quickImages: images, coverUrl: url, scenes: vn.scenes.map(scene => ({ ...scene, backgroundUrl: url })) };
  }
  const index = vn.characters.findIndex(c => c.id === update.characterId);
  if (index < 0 || !Object.hasOwn(images.characters, update.characterId!)) throw new Error('Missing Quick character');
  images.characters[update.characterId!] = update.status;
  const url = update.status === 'ready' ? update.url! : `/quick-character-${index + 1}.svg`;
  return { ...vn, quickImages: images, characters: vn.characters.map(c => c.id !== update.characterId || update.status === 'generating'
    ? c : { ...c, expressions: c.expressions.map(e => ({ ...e, imageUrl: url })) }) };
}
