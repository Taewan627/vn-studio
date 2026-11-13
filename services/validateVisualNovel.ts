import type { VisualNovel } from '../types';

export type VisualNovelValidationCode =
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_VALUE'
  | 'DUPLICATE_SCENE_ID'
  | 'DUPLICATE_CHARACTER_ID'
  | 'DUPLICATE_EXPRESSION_ID'
  | 'INVALID_START_SCENE'
  | 'BROKEN_SCENE_REFERENCE'
  | 'INVALID_CHARACTER_REFERENCE'
  | 'INVALID_EXPRESSION_REFERENCE';

export interface VisualNovelValidationError {
  code: VisualNovelValidationCode;
  /** JSON Pointer; the empty string denotes the root. No input values are echoed. */
  path: string;
  expected?: string;
}

export type VisualNovelValidationResult =
  | { valid: true; data: VisualNovel; errors: readonly VisualNovelValidationError[] }
  | { valid: false; errors: readonly VisualNovelValidationError[] };

type RecordValue = Record<string, unknown>;
type FieldType = 'string' | 'array' | 'object' | 'number' | 'string | null';
type Reference = { value: string; path: string };
type ExpressionReference = Reference & { characterId: string | null };

const own = (value: RecordValue, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const pointer = (parent: string, key: string | number) =>
  `${parent}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

/**
 * Validate the current shared VisualNovel shape and referential integrity.
 * Intended for parsed JSON, not as a sandbox for JS getters/proxies.
 * No cloning, coercion, migration, ID rebasing, asset loading, or repair occurs.
 * Success returns the original object; it does not sanitize extensions or freeze it.
 * Studio cycles/unreachable scenes, empty prose/assets, and any scene count are allowed.
 * Missing scene.stage is reported, not migrated; legacy migration policy is unresolved.
 */
export function validateVisualNovel(input: unknown): VisualNovelValidationResult {
  const errors: VisualNovelValidationError[] = [];
  const issue = (code: VisualNovelValidationCode, path: string, expected?: string) => {
    errors.push(expected === undefined ? { code, path } : { code, path, expected });
  };
  const object = (value: unknown, path: string): RecordValue | undefined => {
    if (isRecord(value)) return value;
    issue('INVALID_TYPE', path, 'object');
    return undefined;
  };
  const field = (value: RecordValue, key: string, parent: string, type: FieldType, optional = false): unknown => {
    const path = pointer(parent, key);
    if (!own(value, key)) {
      if (!optional) issue('MISSING_FIELD', path);
      return undefined;
    }
    const found = value[key];
    // Optional undefined is omitted by the existing JSON exporter; Quick fixtures use it.
    if (optional && found === undefined) return undefined;
    const matches = type === 'array' ? Array.isArray(found)
      : type === 'object' ? isRecord(found)
      : type === 'number' ? typeof found === 'number' && Number.isFinite(found)
      : type === 'string | null' ? found === null || typeof found === 'string'
      : typeof found === 'string';
    if (!matches) { issue('INVALID_TYPE', path, type); return undefined; }
    return found;
  };
  const string = (value: RecordValue, key: string, parent: string, optional = false) =>
    field(value, key, parent, 'string', optional) as string | undefined;
  const array = (value: RecordValue, key: string, parent: string) =>
    field(value, key, parent, 'array') as unknown[] | undefined;
  const id = (value: RecordValue, parent: string) => {
    const found = string(value, 'id', parent);
    if (found === '') { issue('INVALID_VALUE', pointer(parent, 'id'), 'nonempty identifier'); return undefined; }
    return found;
  };
  const enumeration = (value: RecordValue, key: string, parent: string, values: readonly string[], optional = false) => {
    const found = string(value, key, parent, optional);
    if (found !== undefined && !values.includes(found)) issue('INVALID_VALUE', pointer(parent, key), values.join(' | '));
  };

  const root = object(input, '');
  if (!root) return { valid: false, errors };
  string(root, 'title', '');
  string(root, 'description', '');
  string(root, 'coverUrl', '');
  const startSceneId = string(root, 'startSceneId', '');
  const characters = array(root, 'characters', '');
  const scenes = array(root, 'scenes', '');
  string(root, 'id', '', true);
  field(root, 'updatedAt', '', 'number', true);
  enumeration(root, 'contentLanguage', '', ['ko', 'ja', 'en'], true);
  enumeration(root, 'generationProfile', '', ['quick'], true);
  enumeration(root, 'generationSource', '', ['ai', 'demo'], true);

  const characterExpressions = new Map<string, Set<string>>();
  const sceneIds = new Set<string>();
  const characterReferences: Reference[] = [];
  const sceneReferences: Reference[] = [];
  const expressionReferences: ExpressionReference[] = [];

  for (let i = 0; i < (characters?.length ?? 0); i++) {
    const path = `/characters/${i}`;
    const character = object(characters![i], path);
    if (!character) continue;
    const characterId = id(character, path);
    string(character, 'name', path);
    string(character, 'aiPrompt', path, true);
    string(character, 'description', path, true);
    const expressions = array(character, 'expressions', path);
    const expressionIds = new Set<string>();
    for (let j = 0; j < (expressions?.length ?? 0); j++) {
      const expressionPath = `${path}/expressions/${j}`;
      const expression = object(expressions![j], expressionPath);
      if (!expression) continue;
      const expressionId = id(expression, expressionPath);
      string(expression, 'name', expressionPath);
      string(expression, 'imageUrl', expressionPath);
      if (expressionId !== undefined) {
        if (expressionIds.has(expressionId)) issue('DUPLICATE_EXPRESSION_ID', `${expressionPath}/id`);
        expressionIds.add(expressionId);
      }
    }
    if (characterId !== undefined) {
      if (characterExpressions.has(characterId)) issue('DUPLICATE_CHARACTER_ID', `${path}/id`);
      else characterExpressions.set(characterId, expressionIds);
    }
  }

  for (let i = 0; i < (scenes?.length ?? 0); i++) {
    const path = `/scenes/${i}`;
    const scene = object(scenes![i], path);
    if (!scene) continue;
    const sceneId = id(scene, path);
    if (sceneId !== undefined) {
      if (sceneIds.has(sceneId)) issue('DUPLICATE_SCENE_ID', `${path}/id`);
      sceneIds.add(sceneId);
    }
    string(scene, 'name', path);
    enumeration(scene, 'stage', path, ['ki', 'seung', 'jeon', 'gyeol']);
    string(scene, 'backgroundUrl', path);
    string(scene, 'aiPrompt', path, true);
    const present = array(scene, 'presentCharacterIds', path);
    for (let j = 0; j < (present?.length ?? 0); j++) {
      const referencePath = `${path}/presentCharacterIds/${j}`;
      if (typeof present![j] === 'string') characterReferences.push({ value: present![j] as string, path: referencePath });
      else issue('INVALID_TYPE', referencePath, 'string');
    }
    const dialogue = array(scene, 'dialogue', path);
    for (let j = 0; j < (dialogue?.length ?? 0); j++) {
      const linePath = `${path}/dialogue/${j}`;
      const line = object(dialogue![j], linePath);
      if (!line) continue;
      string(line, 'text', linePath);
      const characterId = field(line, 'characterId', linePath, 'string | null');
      const expressionId = field(line, 'expressionId', linePath, 'string | null');
      if (typeof characterId === 'string') characterReferences.push({ value: characterId, path: `${linePath}/characterId` });
      if (typeof expressionId === 'string' && (characterId === null || typeof characterId === 'string')) {
        expressionReferences.push({ value: expressionId, characterId: characterId as string | null, path: `${linePath}/expressionId` });
      }
    }
    const choices = array(scene, 'choices', path);
    for (let j = 0; j < (choices?.length ?? 0); j++) {
      const choicePath = `${path}/choices/${j}`;
      const choice = object(choices![j], choicePath);
      if (!choice) continue;
      string(choice, 'text', choicePath);
      const nextSceneId = string(choice, 'nextSceneId', choicePath);
      if (nextSceneId !== undefined) sceneReferences.push({ value: nextSceneId, path: `${choicePath}/nextSceneId` });
    }
  }

  // Optional state is type-checked, not treated as a Quick topology certificate.
  const quickImages = field(root, 'quickImages', '', 'object', true) as RecordValue | undefined;
  if (quickImages) {
    const imagePath = '/quickImages';
    const version = field(quickImages, 'version', imagePath, 'number');
    if (version !== undefined && version !== 1) issue('INVALID_VALUE', `${imagePath}/version`, '1');
    const statuses = ['queued', 'generating', 'ready', 'failed'];
    enumeration(quickImages, 'background', imagePath, statuses);
    const states = field(quickImages, 'characters', imagePath, 'object') as RecordValue | undefined;
    if (states) for (const key of Object.keys(states).sort()) {
      const statePath = pointer(`${imagePath}/characters`, key);
      if (typeof states[key] !== 'string') issue('INVALID_TYPE', statePath, 'string');
      else if (!statuses.includes(states[key] as string)) issue('INVALID_VALUE', statePath, statuses.join(' | '));
    }
  }

  // References are checked after declarations, allowing forward edges and cycles.
  if (startSceneId !== undefined && !sceneIds.has(startSceneId)) issue('INVALID_START_SCENE', '/startSceneId');
  for (const ref of sceneReferences) if (!sceneIds.has(ref.value)) issue('BROKEN_SCENE_REFERENCE', ref.path);
  for (const ref of characterReferences) if (!characterExpressions.has(ref.value)) issue('INVALID_CHARACTER_REFERENCE', ref.path);
  for (const ref of expressionReferences) {
    if (ref.characterId === null) issue('INVALID_EXPRESSION_REFERENCE', ref.path);
    else {
      const expressions = characterExpressions.get(ref.characterId);
      // An unknown speaker already has its own diagnostic; avoid a cascading expression error.
      if (expressions && !expressions.has(ref.value)) issue('INVALID_EXPRESSION_REFERENCE', ref.path);
    }
  }

  return errors.length ? { valid: false, errors } : { valid: true, data: input as VisualNovel, errors: [] };
}
