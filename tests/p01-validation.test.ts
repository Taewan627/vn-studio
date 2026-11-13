import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import type { VisualNovel } from '../types';
import { createQuickDemo } from '../data/quickDemo';
import { validateVisualNovel, type VisualNovelValidationCode, type VisualNovelValidationResult } from '../services/validateVisualNovel';

// Authored synthetic data only. No app/server/browser, private exports, or provider mocks.
function studio(): VisualNovel {
  return {
    title: 'Synthetic Studio', description: '', coverUrl: '', startSceneId: 'start',
    characters: [], scenes: [{
      id: 'start', name: '', stage: 'ki', backgroundUrl: '', presentCharacterIds: [],
      dialogue: [{ characterId: null, expressionId: null, text: '' }], choices: [],
    }],
  };
}
function speaking(): VisualNovel {
  const value = studio();
  value.characters = [{ id: 'speaker', name: '', expressions: [{ id: 'neutral', name: '', imageUrl: '' }] }];
  value.scenes[0].presentCharacterIds = ['speaker'];
  value.scenes[0].dialogue[0] = { characterId: 'speaker', expressionId: 'neutral', text: 'Synthetic line' };
  return value;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

let assertions = 0;
const results: { id: string; status: 'PASS' | 'FAIL' | 'NOT RUN' }[] = [];
function equal(actual: unknown, expected: unknown) { assertions++; assert.deepEqual(actual, expected); }
function same(actual: unknown, expected: unknown) { assertions++; assert.strictEqual(actual, expected); }
function ok(value: unknown) { assertions++; assert.ok(value); }
function issue(result: VisualNovelValidationResult, code: VisualNovelValidationCode, path: string) {
  same(result.valid, false);
  ok(result.errors.some(error => error.code === code && error.path === path));
}
function regression(id: string, body: () => void) {
  const result: typeof results[number] = { id, status: 'NOT RUN' };
  results.push(result);
  test(id, () => {
    try { body(); result.status = 'PASS'; }
    catch (error) { result.status = 'FAIL'; throw error; }
  });
}
after(() => {
  console.log('P01A_ASSERTION_SUMMARY ' + JSON.stringify({
    cases: results, assertions_executed: assertions,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    not_run: results.filter(r => r.status === 'NOT RUN').length,
  }));
});

regression('T01 valid minimal Studio VN', () => {
  const value = studio();
  const result = validateVisualNovel(value);
  same(result.valid, true);
  equal(result.errors, []);
  if (result.valid) same(result.data, value);
});

regression('T02 existing authored Quick fixtures in ko/en/ja', () => {
  for (const language of ['ko', 'en', 'ja'] as const) {
    const value = createQuickDemo(language);
    const result = validateVisualNovel(value);
    same(result.valid, true);
    equal(result.errors, []);
    if (result.valid) same(result.data, value);
  }
});

regression('T03 missing required root fields', () => {
  for (const key of ['title', 'description', 'coverUrl', 'startSceneId', 'characters', 'scenes']) {
    const value: any = studio();
    delete value[key];
    issue(validateVisualNovel(value), 'MISSING_FIELD', '/' + key);
  }
});

regression('T04 incorrect root and nested field types', () => {
  const corruptions: [string, (value: any) => void][] = [
    ['/title', value => { value.title = 7; }],
    ['/description', value => { value.description = null; }],
    ['/coverUrl', value => { value.coverUrl = {}; }],
    ['/characters', value => { value.characters = {}; }],
    ['/scenes', value => { value.scenes = 'invalid'; }],
    ['/scenes/0/name', value => { value.scenes[0].name = []; }],
    ['/scenes/0/backgroundUrl', value => { value.scenes[0].backgroundUrl = false; }],
    ['/scenes/0/presentCharacterIds/0', value => { value.scenes[0].presentCharacterIds = [null]; }],
  ];
  for (const [path, corrupt] of corruptions) {
    const value = studio(); corrupt(value);
    issue(validateVisualNovel(value), 'INVALID_TYPE', path);
  }
});

regression('T05 duplicate scene IDs', () => {
  const value = studio();
  value.scenes.push(structuredClone(value.scenes[0]));
  issue(validateVisualNovel(value), 'DUPLICATE_SCENE_ID', '/scenes/1/id');
});

regression('T06 duplicate character IDs', () => {
  const value = speaking();
  value.characters.push(structuredClone(value.characters[0]));
  issue(validateVisualNovel(value), 'DUPLICATE_CHARACTER_ID', '/characters/1/id');
});

regression('T07 missing start-scene identity', () => {
  const value = studio(); value.startSceneId = 'missing';
  issue(validateVisualNovel(value), 'INVALID_START_SCENE', '/startSceneId');
  value.scenes = []; value.startSceneId = '';
  issue(validateVisualNovel(value), 'INVALID_START_SCENE', '/startSceneId');
});

regression('T08 broken and disconnected choice targets', () => {
  for (const nextSceneId of ['missing', '']) {
    const value = studio(); value.scenes[0].choices = [{ text: '', nextSceneId }];
    issue(validateVisualNovel(value), 'BROKEN_SCENE_REFERENCE', '/scenes/0/choices/0/nextSceneId');
  }
});

regression('T09 invalid speaker reference', () => {
  const value = studio(); value.scenes[0].dialogue[0].characterId = 'missing';
  issue(validateVisualNovel(value), 'INVALID_CHARACTER_REFERENCE', '/scenes/0/dialogue/0/characterId');
});

regression('T10 invalid expression reference', () => {
  const value = speaking(); value.scenes[0].dialogue[0].expressionId = 'missing';
  issue(validateVisualNovel(value), 'INVALID_EXPRESSION_REFERENCE', '/scenes/0/dialogue/0/expressionId');
});

regression('T11 malformed nested dialogue returns controlled diagnostics', () => {
  for (const line of [null, 12, 'line', [], {}, { characterId: {}, expressionId: null, text: 'x' },
    { characterId: null, expressionId: [], text: false }]) {
    const value: any = studio(); value.scenes[0].dialogue = [line];
    const result = validateVisualNovel(value);
    same(result.valid, false);
    ok(result.errors.every(error => error.path.startsWith('/scenes/0/dialogue/0')));
  }
});

regression('T12 deeply frozen valid and invalid input remains unchanged', () => {
  const valid = freeze(speaking());
  const before = structuredClone(valid);
  const result = validateVisualNovel(valid);
  same(result.valid, true);
  if (result.valid) same(result.data, valid);
  equal(valid, before);
  const invalid = speaking(); invalid.scenes[0].choices = [{ text: '', nextSceneId: 'missing' }];
  const invalidBefore = structuredClone(invalid);
  same(validateVisualNovel(freeze(invalid)).valid, false);
  equal(invalid, invalidBefore);
});

regression('T13 deterministic diagnostics independent of object key insertion order', () => {
  const value: any = studio();
  value.title = 7;
  value.scenes[0].stage = 'unknown';
  value.scenes[0].choices = [{ text: '', nextSceneId: 'missing' }];
  value.quickImages = { version: 2, background: 'unknown', characters: { z: 'invalid', a: 8 } };
  const reordered = Object.fromEntries(Object.entries(structuredClone(value)).reverse()) as any;
  reordered.quickImages.characters = Object.fromEntries(Object.entries(reordered.quickImages.characters).reverse());
  const before = structuredClone(value);
  const result = validateVisualNovel(value);
  same(result.valid, false);
  equal(validateVisualNovel(value), result);
  equal(validateVisualNovel(reordered), result);
  equal(value, before);
});

regression('T14 synthetic five-scene legacy JSON without optional metadata', () => {
  const value: any = createQuickDemo('ko');
  const ids = ['ki_1', 'seung_1', 'jeon_1', 'gyeol_1', 'gyeol_2'];
  const targets = [['seung_1'], ['jeon_1'], ['gyeol_1', 'gyeol_2'], [], []];
  value.scenes = ids.map((id, i) => ({ ...value.scenes.find((scene: any) => scene.id === id),
    choices: targets[i].map(nextSceneId => ({ text: 'Synthetic continuation', nextSceneId })) }));
  for (const key of ['id', 'updatedAt', 'contentLanguage', 'generationProfile', 'generationSource', 'quickImages']) delete value[key];
  for (const character of value.characters) { delete character.description; delete character.aiPrompt; }
  for (const scene of value.scenes) delete scene.aiPrompt;
  const exported = JSON.parse(JSON.stringify(value));
  const result = validateVisualNovel(exported);
  same(result.valid, true);
  if (result.valid) equal(result.data, exported);
  same(exported.scenes.length, 5);
  same(Object.hasOwn(exported, 'contentLanguage'), false);
});

regression('T15 missing legacy stage is reported without migration', () => {
  const value: any = studio(); delete value.scenes[0].stage;
  const before = structuredClone(value);
  issue(validateVisualNovel(value), 'MISSING_FIELD', '/scenes/0/stage');
  equal(value, before);
  same(Object.hasOwn(value.scenes[0], 'stage'), false);
});

regression('T16 duplicate expression IDs within one character', () => {
  const value = speaking(); value.characters[0].expressions.push(structuredClone(value.characters[0].expressions[0]));
  issue(validateVisualNovel(value), 'DUPLICATE_EXPRESSION_ID', '/characters/0/expressions/1/id');
});

regression('T17 expression IDs are scoped to their owning character', () => {
  const value = speaking(); value.characters.push({ ...structuredClone(value.characters[0]), id: 'second' });
  same(validateVisualNovel(value).valid, true);
  value.characters[1].expressions[0].id = 'second-only';
  value.scenes[0].dialogue[0].expressionId = 'second-only';
  issue(validateVisualNovel(value), 'INVALID_EXPRESSION_REFERENCE', '/scenes/0/dialogue/0/expressionId');
});

regression('T18 known speaker may have null default expression and no expression images', () => {
  const value = speaking(); value.characters[0].expressions = []; value.scenes[0].dialogue[0].expressionId = null;
  same(validateVisualNovel(value).valid, true);
  value.scenes[0].presentCharacterIds = [];
  same(validateVisualNovel(value).valid, true);
});

regression('T19 narration cannot reference an unowned expression', () => {
  const value = speaking(); value.scenes[0].dialogue[0].characterId = null;
  issue(validateVisualNovel(value), 'INVALID_EXPRESSION_REFERENCE', '/scenes/0/dialogue/0/expressionId');
});

regression('T20 present-character references must exist', () => {
  const value = studio(); value.scenes[0].presentCharacterIds = ['missing'];
  issue(validateVisualNovel(value), 'INVALID_CHARACTER_REFERENCE', '/scenes/0/presentCharacterIds/0');
});

regression('T21 non-object root values are rejected without throwing', () => {
  for (const value of [null, undefined, [], 0, false, 'json', () => studio()]) {
    issue(validateVisualNovel(value), 'INVALID_TYPE', '');
  }
});

regression('T22 malformed nested arrays and objects never become successful data', () => {
  const corruptions: ((value: any) => void)[] = [
    v => { v.characters = [null]; }, v => { v.scenes = [null]; },
    v => { v.characters[0].expressions = null; }, v => { v.characters[0].expressions = [null]; },
    v => { v.characters[0].expressions[0].imageUrl = {}; }, v => { v.characters[0].name = null; },
    v => { v.scenes[0].dialogue = {}; }, v => { v.scenes[0].choices = {}; },
    v => { v.scenes[0].choices = [null]; }, v => { v.scenes[0].choices = [{ text: [], nextSceneId: 'start' }]; },
    v => { v.scenes[0].presentCharacterIds = null; }, v => { v.scenes[0].dialogue = [{ text: 'x' }]; },
  ];
  for (const corrupt of corruptions) {
    const value = speaking(); corrupt(value);
    same(validateVisualNovel(value).valid, false);
  }
});

regression('T23 general Studio topology allows loops, unreachable drafts and empty dialogue', () => {
  const value = studio(); value.scenes[0].choices = [{ text: '', nextSceneId: 'start' }];
  value.scenes.push({ ...structuredClone(value.scenes[0]), id: 'unused', dialogue: [], choices: [] });
  same(validateVisualNovel(value).valid, true);
  value.scenes[1].stage = 'gyeol';
  same(validateVisualNovel(value).valid, true);
});

regression('T24 current optional export metadata is preserved exactly', () => {
  const value: any = speaking();
  Object.assign(value, { id: 'foreign-project', updatedAt: 0, contentLanguage: 'ja', generationProfile: 'quick', generationSource: 'ai',
    quickImages: { version: 1, background: 'queued', characters: { speaker: 'failed' } } });
  const exported = JSON.parse(JSON.stringify(value)); const before = JSON.stringify(exported);
  const result = validateVisualNovel(exported);
  same(result.valid, true);
  if (result.valid) same(result.data.id, 'foreign-project');
  same(JSON.stringify(exported), before);
});

regression('T25 malformed optional metadata is rejected', () => {
  for (const [key, invalid] of [['id', null], ['updatedAt', '0'], ['updatedAt', Infinity],
    ['contentLanguage', 'invalid'], ['generationProfile', 'invalid'], ['generationSource', 'invalid'],
    ['quickImages', null], ['quickImages', { version: 2, background: 'ready', characters: {} }],
    ['quickImages', { version: 1, background: false, characters: [] }]] as const) {
    const value: any = studio(); value[key] = invalid;
    const result = validateVisualNovel(value);
    same(result.valid, false);
    ok(result.errors.some(error => error.path.startsWith('/' + key)));
  }
});

regression('T26 Unicode and prototype-like IDs use exact identity without repair', () => {
  const value = speaking();
  value.scenes[0].id = ' 시작/~ '; value.startSceneId = value.scenes[0].id;
  value.scenes[0].choices = [{ text: '', nextSceneId: value.startSceneId }];
  value.characters[0].id = '__proto__'; value.characters[0].expressions[0].id = 'constructor';
  value.scenes[0].presentCharacterIds = ['__proto__'];
  value.scenes[0].dialogue[0].characterId = '__proto__'; value.scenes[0].dialogue[0].expressionId = 'constructor';
  const before = structuredClone(value);
  same(validateVisualNovel(value).valid, true);
  equal(value, before);
  value.scenes[0].choices[0].nextSceneId = value.startSceneId.trim();
  issue(validateVisualNovel(value), 'BROKEN_SCENE_REFERENCE', '/scenes/0/choices/0/nextSceneId');
});

regression('T27 optional undefined fields remain compatible with JSON export omission', () => {
  const value: any = speaking();
  for (const key of ['id', 'updatedAt', 'contentLanguage', 'generationProfile', 'generationSource', 'quickImages']) value[key] = undefined;
  value.characters[0].description = undefined; value.characters[0].aiPrompt = undefined; value.scenes[0].aiPrompt = undefined;
  same(validateVisualNovel(value).valid, true);
  same(validateVisualNovel(JSON.parse(JSON.stringify(value))).valid, true);
});

regression('T28 unknown JSON extensions and visible text are not discarded or normalized', () => {
  const value: any = studio();
  value.extension = { arbitrary: ['한국어', '日本語', 'English', '\n', '"', '😀'] };
  value.title = ''; const before = JSON.stringify(value);
  const result = validateVisualNovel(value);
  same(result.valid, true);
  if (result.valid) same(result.data, value);
  same(JSON.stringify(value), before);
});

regression('T29 sparse arrays and inherited required fields do not bypass validation', () => {
  const value: any = speaking(); value.scenes = new Array(1);
  issue(validateVisualNovel(value), 'INVALID_TYPE', '/scenes/0');
  const inherited = Object.create(studio());
  issue(validateVisualNovel(inherited), 'MISSING_FIELD', '/title');
});

regression('T30 stage enum and empty declared IDs are checked without profile counts', () => {
  const value: any = studio(); value.scenes[0].stage = 'unknown';
  issue(validateVisualNovel(value), 'INVALID_VALUE', '/scenes/0/stage');
  value.scenes[0].stage = 'ki'; value.scenes[0].id = '';
  issue(validateVisualNovel(value), 'INVALID_VALUE', '/scenes/0/id');
});

regression('T31 diagnostics use escaped JSON Pointers and do not echo input values', () => {
  const value: any = studio(); value.quickImages = { version: 1, background: 'ready', characters: { '/~': 'synthetic-invalid-status' } };
  const result = validateVisualNovel(value);
  issue(result, 'INVALID_VALUE', '/quickImages/characters/~1~0');
  same(JSON.stringify(result).includes('synthetic-invalid-status'), false);
});
