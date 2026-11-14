import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { VisualNovel } from '../src/types';
import { createQuickDemo } from '../src/data/quickDemo';
import type { useVisualNovel } from '../src/hooks/useVisualNovel';
import type { useFileIO } from '../src/hooks/useFileIO';

// Compile-check the same setter wiring used by App; the runtime host below uses doubles.
function wiring(model: ReturnType<typeof useVisualNovel>): Parameters<typeof useFileIO>[0] {
  return { vn: model.vn, currentProjectId: model.currentProjectId, setVisualNovel: model.setVisualNovel, setSelectedSceneId: () => {} };
}
void wiring;

// Actual hooks + validator, with deterministic React-hook, FileReader and
// persistence contract doubles. This is NOT a browser/React DOM/IndexedDB test.
const root = process.cwd();
const output = path.join(root, '.phase1-local', 'p01b', 'hook-tests');
let hooks: any;
let context: any;
const globalState = globalThis as any;
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let assertions = 0;
const records: { id: string; status: string }[] = [];
function equal(actual: unknown, expected: unknown) { assertions++; assert.deepEqual(actual, expected); }
function same(actual: unknown, expected: unknown) { assertions++; assert.strictEqual(actual, expected); }
function ok(value: unknown) { assertions++; assert.ok(value); }
function regression(id: string, body: () => Promise<void>) {
  const record = { id, status: 'NOT RUN' }; records.push(record);
  test(id, async () => {
    try { await body(); record.status = 'PASS'; }
    catch (error) { record.status = 'FAIL'; throw error; }
    finally { context?.host?.dispose(); }
  });
}

before(async () => {
  mkdirSync(output, { recursive: true });
  const shims: Record<string, string> = {
    react: `export const useState = (...a) => globalThis.__P01B_TEST__.host.state(...a);
      export const useRef = (...a) => globalThis.__P01B_TEST__.host.ref(...a);
      export const useEffect = (...a) => globalThis.__P01B_TEST__.host.effect(...a);`,
    language: `export const useLanguage = () => ({language: globalThis.__P01B_TEST__.language,
      t: s => s, restoreProjectLanguage: l => globalThis.__P01B_TEST__.restoredLanguages.push(l)});`,
    db: `export const loadVisualNovelData = (...a) => globalThis.__P01B_TEST__.db.load(...a);
      export const saveVisualNovelData = (...a) => globalThis.__P01B_TEST__.db.save(...a);
      export const saveProjectAndList = (...a) => globalThis.__P01B_TEST__.db.atomic(...a);
      export const removeFromDB = (...a) => globalThis.__P01B_TEST__.db.remove(...a);`,
    exports: `const unused = () => {throw Error('Export outside P01B test scope');};
      export const exportToRenpy=unused, exportToHtml=unused, prepareWebPackageData=unused;`,
  };
  const result = await build({
    stdin: { contents: `export {useVisualNovel} from './src/hooks/useVisualNovel'; export {useFileIO} from './src/hooks/useFileIO';`,
      resolveDir: root, sourcefile: 'p01b-hook-entry.ts', loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, metafile: true,
    define: { setTimeout: 'globalThis.__P01B_TEST__.setTimeout', clearTimeout: 'globalThis.__P01B_TEST__.clearTimeout' },
    plugins: [{ name: 'p01b-hook-contract-doubles', setup(builder) {
      builder.onResolve({ filter: /^react$|^\.\.\/i18n\/LanguageProvider$|^\.\.\/utils\/db$|^\.\.\/services\/exportService$/ }, args => ({
        path: args.path === 'react' ? 'react' : args.path.endsWith('LanguageProvider') ? 'language'
          : args.path.endsWith('/db') ? 'db' : 'exports', namespace: 'p01b-double',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'p01b-double' }, args => ({ contents: shims[args.path], loader: 'js' }));
    } }],
  });
  const inputs = Object.keys(result.metafile!.inputs);
  if (inputs.some(input => /(?:^|\/)research\/|geminiService|server\/|^App\./.test(input))) {
    throw new Error('Forbidden runtime module in hook-test bundle');
  }
  writeFileSync(path.join(output, 'METAFILE.json'), JSON.stringify(result.metafile, null, 2));
  const file = path.join(output, 'hooks.cjs'); writeFileSync(file, result.outputFiles[0].text);
  hooks = createRequire(import.meta.url)(file);
  for (const name of ['window', 'localStorage', 'FileReader', 'alert', 'crypto', '__P01B_TEST__']) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
});

after(() => {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalState[name];
  }
  console.log('P01B_ASSERTION_SUMMARY ' + JSON.stringify({
    cases: records, assertions_executed: assertions,
    passed: records.filter(r => r.status === 'PASS').length,
    failed: records.filter(r => r.status === 'FAIL').length,
    not_run: records.filter(r => r.status === 'NOT RUN').length,
    scope: 'Hook contract doubles; browser and real IndexedDB NOT RUN',
  }));
});

function fixture(): VisualNovel {
  return { id: 'foreign-root', updatedAt: 42, title: 'Synthetic import', description: 'Synthetic only', coverUrl: '', contentLanguage: 'ja',
    characters: [{ id: 'actor', name: 'Synthetic actor', expressions: [{ id: 'neutral', name: 'Neutral', imageUrl: '' }] }],
    startSceneId: 'start', scenes: [
      { id: 'start', name: 'Start', stage: 'ki', backgroundUrl: '', presentCharacterIds: ['actor'],
        dialogue: [{ characterId: 'actor', expressionId: 'neutral', text: 'Synthetic line' }], choices: [{ text: 'Continue', nextSceneId: 'end' }] },
      { id: 'end', name: 'End', stage: 'gyeol', backgroundUrl: '', presentCharacterIds: [],
        dialogue: [{ characterId: null, expressionId: null, text: 'Synthetic ending' }], choices: [] },
    ] };
}
function legacy(): VisualNovel {
  const value: any = createQuickDemo('ko');
  const ids = ['ki_1', 'seung_1', 'jeon_1', 'gyeol_1', 'gyeol_2'];
  const targets = [['seung_1'], ['jeon_1'], ['gyeol_1', 'gyeol_2'], [], []];
  value.scenes = ids.map((id, i) => ({ ...value.scenes.find((s: any) => s.id === id), choices: targets[i].map(nextSceneId => ({ text: 'Continue', nextSceneId })) }));
  for (const key of ['id', 'updatedAt', 'generationProfile', 'generationSource', 'contentLanguage', 'quickImages']) delete value[key];
  return clone(value);
}
function narrative(value: VisualNovel) {
  const { id: _id, updatedAt: _updatedAt, ...rest } = clone(value);
  return rest;
}

class Host {
  slots: any[] = [];
  cursor = 0;
  dirty = true;
  effects: (() => void)[] = [];
  value: any;
  disposed = false;
  state(initial: any) {
    const i = this.cursor++;
    if (!this.slots[i]) this.slots[i] = { value: typeof initial === 'function' ? initial() : initial };
    const slot = this.slots[i];
    return [slot.value, (next: any) => {
      if (this.disposed) return;
      const value = typeof next === 'function' ? next(slot.value) : next;
      if (!Object.is(value, slot.value)) { slot.value = value; this.dirty = true; }
    }];
  }
  ref(initial: any) {
    const i = this.cursor++;
    if (!this.slots[i]) this.slots[i] = { ref: { current: initial } };
    return this.slots[i].ref;
  }
  effect(callback: () => any, dependencies: unknown[]) {
    const i = this.cursor++;
    const previous = this.slots[i];
    if (!previous || dependencies.some((v, index) => !Object.is(v, previous.dependencies[index]))) {
      this.slots[i] = { dependencies, cleanup: previous?.cleanup };
      this.effects.push(() => {
        this.slots[i].cleanup?.();
        this.slots[i].cleanup = callback();
      });
    }
  }
  render() {
    context.host = this; this.cursor = 0; this.dirty = false;
    const model = hooks.useVisualNovel();
    const io = hooks.useFileIO({ vn: model.vn, currentProjectId: model.currentProjectId, setVisualNovel: model.setVisualNovel,
      setSelectedSceneId: (id: string) => { context.selected = id; } });
    this.value = { model, io };
    for (const effect of this.effects.splice(0)) effect();
  }
  async flush() {
    let quiet = 0;
    for (let i = 0; i < 80; i++) {
      if (this.dirty) { this.render(); quiet = 0; }
      await new Promise<void>(resolve => setImmediate(resolve));
      if (!this.dirty && ++quiet >= 2) return;
    }
    throw new Error('Synthetic hook host did not settle');
  }
  async timers() {
    const callbacks = [...context.timers.values()]; context.timers.clear();
    for (const callback of callbacks) callback();
    await this.flush();
  }
  startImport(value: unknown, raw = false) {
    const event = { target: { files: [{ content: raw ? value : JSON.stringify(value) }], value: 'synthetic.json' } };
    const before = context.readers.length;
    this.value.io.handleFileSelected(event);
    const completed = Promise.all(context.readers.slice(before));
    return { event, completed };
  }
  async import(value: unknown, raw = false) {
    const pending = this.startImport(value, raw);
    await pending.completed; await this.flush();
    return pending.event;
  }
  dispose() {
    if (this.disposed) return;
    for (const slot of this.slots) slot?.cleanup?.();
    this.disposed = true;
  }
}

async function setup(language = 'en') {
  context?.host?.dispose();
  const original = { ...fixture(), id: 'proj_original', title: 'Original project', updatedAt: 1 };
  const data = new Map<string, any>([
    ['vn_proj_proj_original', clone(original)],
    ['vn_project_list', [{ id: original.id, title: original.title, updatedAt: 1 }]],
  ]);
  const local = new Map<string, string>([['vn_active_project_id', original.id]]);
  context = {
    language, data, local, original, alerts: [] as string[], confirmations: [] as string[], confirmed: true,
    restoredLanguages: [] as unknown[], readers: [] as Promise<unknown>[], selected: '',
    timers: new Map<number, () => void>(), nextTimer: 0, uuid: 0, forcedUUID: undefined,
    failAtomic: undefined, beforeAtomic: undefined, writes: [] as string[],
  };
  context.db = {
    async load(key: string) { return data.has(key) ? clone(data.get(key)) : null; },
    async save(key: string, value: any) { data.set(key, clone(value)); context.writes.push(key); return true; },
    async atomic(id: string, project: any, list: any) {
      if (context.beforeAtomic) await context.beforeAtomic(id);
      if (context.failAtomic?.(id)) return false;
      data.set('vn_proj_' + id, clone(project)); data.set('vn_project_list', clone(list));
      context.writes.push(id); return true;
    },
    async remove(key: string) { data.delete(key); return true; },
  };
  context.setTimeout = (callback: () => void) => { const id = ++context.nextTimer; context.timers.set(id, callback); return id; };
  context.clearTimeout = (id: number) => context.timers.delete(id);
  Object.defineProperty(globalThis, '__P01B_TEST__', { configurable: true, value: context });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    confirm(message: string) { context.confirmations.push(message); return context.confirmed; },
    addEventListener() {}, removeEventListener() {},
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => local.get(key) ?? null, setItem: (key: string, value: string) => local.set(key, value), removeItem: (key: string) => local.delete(key),
  } });
  Object.defineProperty(globalThis, 'alert', { configurable: true, value: (message: string) => context.alerts.push(message) });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => context.forcedUUID ?? ('synthetic-' + (++context.uuid)) } });
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
    onload: any;
    readAsText(file: { content: string }) {
      const pending = Promise.resolve().then(() => this.onload({ target: { result: file.content } }));
      context.readers.push(pending);
    }
  } });
  const host = new Host(); context.host = host; await host.flush();
  same(host.value.model.currentProjectId, original.id);
  same(host.value.model.isLoaded, true);
  return host;
}

regression('B01 valid Studio imports into a fresh slot', async () => {
  const host = await setup(); const source = fixture(); const before = clone(source);
  const event = await host.import(source); const model = host.value.model;
  ok(model.currentProjectId !== source.id && model.currentProjectId !== 'proj_original');
  same(model.vn.id, model.currentProjectId); equal(narrative(model.vn), narrative(source));
  same(context.selected, source.startSceneId); same(event.target.value, ''); equal(source, before);
  ok(context.confirmations[0].includes('new project'));
});
regression('B02 valid Quick JSON preserves profile and content', async () => {
  const host = await setup(); const source = clone(createQuickDemo('ja'));
  await host.import(source); equal(narrative(host.value.model.vn), narrative(source));
  same(host.value.model.vn.scenes.length, 8); same(host.value.model.vn.generationProfile, 'quick');
});
regression('B03 supported five-scene legacy imports without stage inference', async () => {
  const host = await setup(); const source = legacy(); const restoredBefore = [...context.restoredLanguages]; await host.import(source);
  equal(narrative(host.value.model.vn), narrative(source)); same(host.value.model.vn.scenes.length, 5);
  same(Object.hasOwn(host.value.model.vn, 'contentLanguage'), false);
  equal(context.restoredLanguages, restoredBefore);
});
regression('B04 invalid JSON never replaces the active project', async () => {
  const host = await setup(); const before = clone(host.value.model.vn); const stored = clone(context.data.get('vn_project_list'));
  await host.import('{invalid', true); equal(host.value.model.vn, before);
  equal(context.data.get('vn_project_list'), stored); ok(context.alerts.at(-1).includes('Invalid JSON syntax'));
});
regression('B05 broken references are rejected before persistence', async () => {
  const host = await setup(); const source = fixture(); source.scenes[0].choices[0].nextSceneId = 'missing';
  const before = clone(host.value.model.vn); await host.import(source);
  equal(host.value.model.vn, before); same(context.writes.length, 0);
  ok(context.alerts.at(-1).includes('BROKEN_SCENE_REFERENCE at /scenes/0/choices/0/nextSceneId'));
});
regression('B06 foreign root ID saves under the fresh local slot', async () => {
  const host = await setup(); const source = fixture(); source.id = 'proj_original';
  await host.import(source); const id = host.value.model.currentProjectId;
  await host.value.io.handleSaveToLocalStorage(); await host.flush();
  same(context.data.get('vn_proj_' + id).id, id); equal(narrative(context.data.get('vn_proj_' + id)), narrative(source));
  same(context.data.has('vn_proj_foreign-root'), false);
});
regression('B07 synthetic reload preserves all narrative relationships', async () => {
  const host = await setup(); const source = fixture(); await host.import(source);
  const id = host.value.model.currentProjectId; host.dispose();
  const reloaded = new Host(); context.host = reloaded; await reloaded.flush();
  same(reloaded.value.model.currentProjectId, id); equal(narrative(reloaded.value.model.vn), narrative(source));
  equal(reloaded.value.model.vn.characters, source.characters); equal(reloaded.value.model.vn.scenes, source.scenes);
});
regression('B08 existing project is not overwritten', async () => {
  const host = await setup(); const original = clone(context.data.get('vn_proj_proj_original'));
  const source = fixture(); source.id = 'proj_original'; await host.import(source);
  equal(context.data.get('vn_proj_proj_original'), original); same(context.data.get('vn_project_list').length, 2);
});
regression('B09 repeated imports create distinct slots', async () => {
  const host = await setup(); const source = fixture(); await host.import(source);
  const first = host.value.model.currentProjectId; await host.import(source); const second = host.value.model.currentProjectId;
  ok(first !== second); equal(narrative(context.data.get('vn_proj_' + first)), narrative(source));
  equal(narrative(context.data.get('vn_proj_' + second)), narrative(source)); same(context.data.get('vn_project_list').length, 3);
});
regression('B10 missing-stage legacy is held with a precise nonmutating error', async () => {
  const host = await setup(); const source: any = legacy(); delete source.scenes[0].stage;
  const before = clone(source); const active = clone(host.value.model.vn); await host.import(source);
  equal(source, before); equal(host.value.model.vn, active); same(context.writes.length, 0);
  ok(context.alerts.at(-1).includes('MISSING_FIELD at /scenes/0/stage'));
});
regression('B11 cancelled import makes no changes', async () => {
  const host = await setup(); context.confirmed = false; const active = clone(host.value.model.vn);
  await host.import(fixture()); equal(host.value.model.vn, active); same(context.writes.length, 0);
});
regression('B12 pending edits in the old slot are flushed before switching', async () => {
  const host = await setup(); host.value.model.actions.updateTitle('Unsubmitted synthetic edit'); await host.flush();
  await host.import(fixture()); same(context.data.get('vn_proj_proj_original').title, 'Unsubmitted synthetic edit');
  same(context.writes[0], 'proj_original'); ok(host.value.model.currentProjectId !== 'proj_original');
});
regression('B13 old-slot save failure aborts import without losing active edits', async () => {
  const host = await setup(); host.value.model.actions.updateTitle('Retained edit'); await host.flush();
  context.failAtomic = (id: string) => id === 'proj_original'; await host.import(fixture());
  same(host.value.model.currentProjectId, 'proj_original'); same(host.value.model.vn.title, 'Retained edit');
  same(context.data.get('vn_project_list').length, 1); ok(context.alerts.at(-1).includes('Could not save the active project'));
});
regression('B14 new-slot save failure keeps the active project', async () => {
  const host = await setup(); context.failAtomic = (id: string) => id !== 'proj_original';
  const before = clone(host.value.model.vn); await host.import(fixture());
  equal(host.value.model.vn, before); same(context.data.get('vn_project_list').length, 1);
});
regression('B15 generated local ID collision cannot overwrite an existing slot', async () => {
  const host = await setup(); context.forcedUUID = 'original'; const before = clone(context.data.get('vn_proj_proj_original'));
  await host.import(fixture()); equal(context.data.get('vn_proj_proj_original'), before);
  same(context.writes.length, 0); ok(context.alerts.at(-1).includes('Local project ID collision'));
});
regression('B16 concurrent imports are serialized into separate slots', async () => {
  const host = await setup(); const first = fixture(); first.title = 'First import'; const second = fixture(); second.title = 'Second import';
  const a = host.startImport(first); const b = host.startImport(second);
  await Promise.all([a.completed, b.completed]); await host.flush();
  same(context.data.get('vn_project_list').length, 3);
  const imported = context.data.get('vn_project_list').filter((p: any) => p.id !== 'proj_original');
  equal(imported.map((p: any) => p.title).sort(), ['First import', 'Second import']);
});
regression('B17 edits during import commit are not overwritten by activation', async () => {
  const host = await setup(); let release!: () => void; let entered = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  context.beforeAtomic = async (id: string) => { if (id !== 'proj_original') { entered = true; await gate; } };
  const pending = host.startImport(fixture());
  for (let i = 0; i < 30 && !entered; i++) await host.flush();
  ok(entered); host.value.model.actions.updateTitle('Edit during import'); await host.flush();
  release(); await pending.completed; await host.flush();
  same(host.value.model.currentProjectId, 'proj_original'); same(host.value.model.vn.title, 'Edit during import');
  same(context.data.get('vn_project_list').length, 2); ok(context.alerts.at(-1).includes('Import saved in a new slot'));
});
regression('B18 valid metadata, extensions and supplied asset strings are preserved', async () => {
  const host = await setup(); const source: any = fixture(); source.extension = { text: 'Synthetic extension' };
  source.generationSource = 'demo'; source.coverUrl = 'data:image/png;base64,synthetic';
  await host.import(source); equal(narrative(host.value.model.vn), narrative(source));
  same(host.value.model.vn.updatedAt, source.updatedAt);
});
regression('B19 import confirmation preserves the three UI language choices', async () => {
  for (const [language, expected] of [['ko', '새 프로젝트'], ['en', 'new project'], ['ja', '新しいプロジェクト']]) {
    const host = await setup(language); await host.import(fixture());
    ok(context.confirmations[0].includes(expected));
  }
});
regression('B20 ordinary setters retain their existing in-slot behavior', async () => {
  const host = await setup(); const replacement = { ...host.value.model.vn, title: 'Ordinary setter' };
  host.value.model.setVisualNovel(replacement); await host.flush();
  same(host.value.model.currentProjectId, 'proj_original'); same(host.value.model.vn.title, 'Ordinary setter');
  same(context.data.get('vn_project_list').length, 1);
});
