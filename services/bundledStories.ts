import type { ProjectMetadata, VisualNovel } from '../types';
import type { BundledStory } from '../data/bundledStories';
import { validateQuickStory } from './quickStory';

// Published exports may contain unused editor slots and the older five-scene
// profile. Never weaken validation of newly generated eight-scene stories.
export function validateBundledStory(value: VisualNovel, entry: BundledStory): boolean {
  if (value.id !== entry.id || value.title !== entry.title || value.contentLanguage !== entry.language || value.generationSource !== 'ai') return false;
  const used = new Set(value.scenes.flatMap(s => [...s.presentCharacterIds, ...s.dialogue.map(d => d.characterId).filter(Boolean)]));
  const playable = { ...value, characters: value.characters.filter(c => used.has(c.id)) };
  if (validateQuickStory(playable, true).length) return false;
  const urls = [value.coverUrl, ...value.scenes.map(s => s.backgroundUrl), ...playable.characters.flatMap(c => c.expressions.map(e => e.imageUrl))];
  return urls.every(url => typeof url === 'string' && url.startsWith('/demos/ai/' + entry.language + '/') && /\.(png|jpg|webp)$/.test(url));
}

// Suppress only the exact published source version, never a title match or an
// edited copy. The original remains in IndexedDB and the Full Studio lobby.
export async function matchesBundledSource(project: ProjectMetadata, entries: BundledStory[]): Promise<boolean> {
  const candidates = entries.filter(e => e.title === project.title && e.sourceUpdatedAt === project.updatedAt
    && (!project.contentLanguage || project.contentLanguage === e.language));
  if (!candidates.length || !globalThis.crypto?.subtle) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(project.id));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return candidates.some(entry => entry.sourceProjectHash === hash);
}
