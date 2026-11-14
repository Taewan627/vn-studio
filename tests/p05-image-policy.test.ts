import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import { createQuickDemo } from '../src/data/quickDemo';
import { prepareQuickStory } from '../src/services/quickStory';
import { isImageGenerationEnabled } from '../src/services/imageGenerationPolicy';
import { validateVisualNovel } from '../src/services/validateVisualNovel';

// No listening socket or browser. Actual hooks/components, actual service code and
// in-process Express dispatch; provider/storage/DOM I/O are explicit synthetic doubles.
const root = process.cwd();
const directory = path.join(root, '.phase1-local', 'phase2b', 'p05-tests');
const g = globalThis as any;
const original = new Map<string, PropertyDescriptor | undefined>();
const originalFetch = globalThis.fetch;
let ui: any, serverService: any, clientService: any, appModule: any, context: any;
const clone = <T>(value: T): T => structuredClone(value);
let assertions = 0;
const results: { id: string; status: string }[] = [];
function same(actual: unknown, expected: unknown) { assertions++; assert.strictEqual(actual, expected); }
function equal(actual: unknown, expected: unknown) { assertions++; assert.deepEqual(actual, expected); }
function ok(value: unknown) { assertions++; assert.ok(value); }
async function rejects(action: () => Promise<unknown>, pattern: RegExp) { assertions++; await assert.rejects(action, pattern); }
function regression(id: string, fn: () => Promise<void> | void) {
  const result = { id, status: 'NOT RUN' }; results.push(result);
  test(id, async () => {
    reset();
    try { await fn(); result.status = 'PASS'; }
    catch (error) { result.status = 'FAIL'; throw error; }
    finally { context?.host?.dispose(); globalThis.fetch = originalFetch; delete process.env.AI_IMAGE_GENERATION_ENABLED; }
  });
}
function put(name: string, value: any) { Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
function reset() {
  delete g.window; delete g.__VN_AI_IMAGE_GENERATION_ENABLED__;
  delete process.env.AI_IMAGE_GENERATION_ENABLED;
  process.env.OPENROUTER_API_KEY = 'synthetic-test-only';
  globalThis.fetch = originalFetch;
  context = { react: React, language: 'en', calls: { text: 0, images: 0, protection: 0, local: 0, decode: 0 },
    registered: [], changes: [], timers: new Map(), nextTimer: 0 };
  context.setTimeout = (fn: any) => { const id = ++context.nextTimer; context.timers.set(id, fn); return id; };
  context.clearTimeout = (id: number) => context.timers.delete(id);
  context.story = () => {
    const value = clone(createQuickDemo('en'));
    value.generationSource = 'ai'; value.coverUrl = '';
    value.scenes.forEach(s => { s.backgroundUrl = ''; });
    value.characters.forEach(c => c.expressions.forEach(e => { e.imageUrl = ''; }));
    delete value.quickImages;
    return value;
  };
  put('__P05_TEST__', context);
}

before(async () => {
  for (const name of ['window', '__P05_TEST__', '__VN_AI_IMAGE_GENERATION_ENABLED__', 'FileReader', 'alert']) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  reset(); mkdirSync(directory, { recursive: true });
  const stubs: Record<string, string> = {
    react: `export default globalThis.__P05_TEST__.react;
      export const useState=(...a)=>globalThis.__P05_TEST__.host.state(...a);
      export const useRef=(...a)=>globalThis.__P05_TEST__.host.ref(...a);
      export const useEffect=(...a)=>globalThis.__P05_TEST__.host.effect(...a);
      export const useMemo=(f)=>f();`,
    language: `export const useLanguage=()=>({language:globalThis.__P05_TEST__.language,t:s=>s});`,
    catalog: `export const translate=(language,s)=>s;`,
    service: `const c=()=>globalThis.__P05_TEST__;
      export const generateStory=async()=>{c().calls.text++;return c().story()};
      export const generateRecursiveInitial=async()=>{c().calls.text++;return {vn:c().story(),nextQuestion:'Synthetic next',nextChoices:['Continue']}};
      export const generateRecursiveNextStep=async()=>{c().calls.text++;return {newScenes:[{...c().story().scenes[0],id:'relay-new',choices:[]}],nextQuestion:'Next',nextChoices:[]}};
      const image=async()=>{c().calls.images++;throw Error('Unexpected image request')};
      export const generateCharacterImage=image,editCharacterImageExpression=image,generateSceneBackground=image;
      export const generateSceneDialogue=async()=>{c().calls.text++;return []};
      export const generateStoryProposals=async()=>{c().calls.text++;return []};
      export const summarizeStoryToNovel=async()=>{c().calls.text++;return 'Synthetic summary'};
      export const chatWithCharacter=async()=>{c().calls.text++;return {text:'Synthetic response'}};`,
    processing: `export {fileToBase64} from ${JSON.stringify(path.join(root, 'src/utils/imageProcessing.ts').replaceAll('\\', '/'))};
      export const removeCharacterImageBackground=async()=>{globalThis.__P05_TEST__.calls.local++;return 'data:image/png;base64,LOCAL'};
      export const resizeAndCompressImage=async u=>u;`,
    loading: `export const decodeQuickImage=async u=>{globalThis.__P05_TEST__.calls.decode++;return {src:u}};
      export const withQuickImageTimeout=p=>p;export const QUICK_IMAGE_JOB_TIMEOUT_MS=1000;`,
    modal: `export const ImagePreviewModal=()=>null;`,
    research: `export const getResearchConfig=()=>({enabled:false,firebase:null});`,
    protection: `export const installApiProtection=app=>app.use('/api/gemini',(_q,_s,next)=>{globalThis.__P05_TEST__.calls.protection++;next()});`,
  };
  async function compile(name: string, entry: string, aliases: Record<string, string> = {}, define: Record<string,string> = {}) {
    const result = await build({ stdin: { contents: entry, resolveDir: root, sourcefile: name + '-entry.ts', loader: 'ts' },
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, metafile: true, define,
      plugins: [{ name: 'p05-synthetic-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => aliases[args.path] ? { path: aliases[args.path], namespace: 'p05-double' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'p05-double' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: root }));
      } }],
    });
    const file = path.join(directory, name + '.cjs'); writeFileSync(file, result.outputFiles[0].text);
    writeFileSync(path.join(directory, name + '.meta.json'), JSON.stringify(result.metafile, null, 2));
    return createRequire(import.meta.url)(file);
  }
  ui = await compile('ui', `export {useAiOperations} from './src/hooks/useAiOperations';
    export {useQuickImages} from './src/hooks/useQuickImages'; export {useQuickPlayback} from './src/hooks/useQuickPlayback';
    export {CharacterList} from './src/components/CharacterList'; export {SceneEditor} from './src/components/SceneEditor';
    export {QuickImageStatus} from './src/components/QuickImageStatus'; export {default as GamePlayer} from './src/components/GamePlayer';`,
    { react: 'react', '../i18n/LanguageProvider': 'language', '../i18n/catalog': 'catalog',
      '../services/geminiService': 'service', '../utils/imageProcessing': 'processing',
      '../services/quickImageLoading': 'loading', './ImagePreviewModal': 'modal' },
    { setTimeout: 'globalThis.__P05_TEST__.setTimeout', clearTimeout: 'globalThis.__P05_TEST__.clearTimeout', clearInterval: 'globalThis.__P05_TEST__.clearTimeout' });
  delete g.window;
  serverService = await compile('server-service', `export * from './src/services/geminiService';`, { './i18n/catalog.js': 'catalog', '../i18n/catalog.js': 'catalog' });
  clientService = await compile('client-service', `export * from './src/services/geminiService';`,
    { '../i18n/catalog.js': 'catalog' }, { window: '{}', __VN_AI_IMAGE_GENERATION_ENABLED__: 'false' });
  appModule = await compile('app', `export {createApiApp} from './src/server/app';`,
    { '../services/geminiService.js': 'service', '../research/config.js': 'research', './protection.js': 'protection' });
});

after(() => {
  globalThis.fetch = originalFetch; delete process.env.OPENROUTER_API_KEY; delete process.env.AI_IMAGE_GENERATION_ENABLED;
  for (const [name, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete g[name];
  }
  console.log('P05_ASSERTION_SUMMARY ' + JSON.stringify({ cases: results, assertions_executed: assertions,
    passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length,
    not_run: results.filter(r => r.status === 'NOT RUN').length,
    scope: 'Mocked providers, hook doubles, static React markup, socket-free Express dispatch; browser E2E NOT RUN' }));
});

class Host {
  slots: any[] = []; cursor = 0; dirty = true; effects: (() => void)[] = []; value: any; renderFn: () => any;
  constructor(fn: () => any, readonly enableEffects = true) { this.renderFn = fn; }
  state(initial: any) {
    const i = this.cursor++; if (!this.slots[i]) this.slots[i] = {value:typeof initial==='function'?initial():initial};
    const s=this.slots[i]; return [s.value,(v:any)=>{const next=typeof v==='function'?v(s.value):v;if(!Object.is(next,s.value)){s.value=next;this.dirty=true}}];
  }
  ref(initial: any) { const i=this.cursor++;if(!this.slots[i])this.slots[i]={ref:{current:initial}};return this.slots[i].ref; }
  effect(fn: () => any, deps?: any[]) {
    const i=this.cursor++;if(!this.enableEffects)return;
    const old=this.slots[i];if(!old||!deps||deps.some((v,j)=>!Object.is(v,old.deps?.[j]))){
      this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{this.slots[i].cleanup?.();this.slots[i].cleanup=fn()});
    }
  }
  render() { context.host=this;this.cursor=0;this.dirty=false;this.value=this.renderFn();for(const fn of this.effects.splice(0))fn();return this.value; }
  async flush() { for(let i=0;i<30;i++){if(this.dirty)this.render();await new Promise<void>(resolve=>setImmediate(resolve));if(!this.dirty)return;}throw Error('Host did not settle'); }
  dispose() { for(const s of this.slots)s?.cleanup?.(); }
}
function windowForHooks() { put('window',{innerWidth:1440,addEventListener(){},removeEventListener(){},setInterval:context.setTimeout,clearInterval:context.clearTimeout,setTimeout:context.setTimeout,clearTimeout:context.clearTimeout});put('alert',()=>{}); }
function aiHost(value = context.story()) {
  windowForHooks(); context.vn=value;
  const actions:any={ updateCharacterExpressionUrl:(id:string,eid:string,url:string)=>{context.changes.push([id,eid,url]);value.characters.find((c:any)=>c.id===id)!.expressions.find((e:any)=>e.id===eid)!.imageUrl=url},
    updateScene:(id:string,key:string,next:any)=>{context.changes.push([id,key,next]);(value.scenes.find((s:any)=>s.id===id) as any)[key]=next} };
  const host=new Host(()=>ui.useAiOperations(value,actions,(next:any)=>context.registered.push(clone(next)),()=>{},async(next:any)=>{context.registered.push(clone(next));return next}));
  context.host=host;host.render();return host;
}
function find(element:any,predicate:(e:any)=>boolean):any {
  if(!element||typeof element!=='object')return undefined;if(predicate(element))return element;
  const children=React.Children.toArray(element.props?.children);for(const child of children){const match=find(child,predicate);if(match)return match;}
}
function markup(value:any) {
  windowForHooks(); const host=new Host(()=>null,false);context.host=host;
  return renderToStaticMarkup(React.createElement(ui.GamePlayer,{vn:value,currentSceneId:value.startSceneId,onChoice:()=>{},startFromTitle:false,allowChat:false}));
}
async function dispatch(url:string,body:any) {
  delete g.window;
  const app=appModule.createApiApp(true);
  const request:any=new IncomingMessage(new PassThrough() as any);request.method='POST';request.url=url;
  request.headers={'content-type':'application/json',host:'synthetic.local'};request.body=body;request.push(null);
  return await new Promise<{status:number;body:any}>((resolve,reject)=>{
    const response:any=new ServerResponse(request);
    response.end=(data:any)=>{resolve({status:response.statusCode,body:JSON.parse(String(data))});return response};
    app.handle(request,response,(error:any)=>reject(error||Error('Route not handled')));
  });
}

regression('T01 Quick text generation omits image jobs',async()=>{
  let textRequests=0;
  globalThis.fetch=async(input:any)=>{same(String(input),'https://openrouter.ai/api/v1/chat/completions');textRequests++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(createQuickDemo('en'))}}]}))};
  const value=await serverService.generateStory('Synthetic idea',{generationProfile:'quick',contentLanguage:'en'});
  same(textRequests,1);same(value.generationSource,'ai');same(value.quickImages,undefined);same(value.coverUrl,'');
  ok(value.scenes.every((s:any)=>s.backgroundUrl===''));ok(value.characters.every((c:any)=>c.expressions.every((e:any)=>e.imageUrl==='')));
});
regression('T02 Full Studio text remains available without automatic visuals',async()=>{
  const host=aiHost();host.value.setAiTheme('Synthetic theme');await host.flush();await host.value.handleGenerateStory();await host.flush();
  same(context.calls.text,1);same(context.calls.images,0);same(context.registered.length,1);same(context.registered[0].coverUrl,'');same(host.value.isGenerating,false);
});
regression('T03 restored automatic Quick jobs remain blocked and unchanged',async()=>{
  windowForHooks();const value=context.story();value.id='synthetic-restored';value.quickImages={version:1,background:'queued',characters:{char_1:'generating'}};
  const before=clone(value);let saves=0;const host=new Host(()=>ui.useQuickImages(value,true,async()=>{saves++;return true}));await host.flush();
  same(context.calls.images,0);same(saves,0);equal(value,before);
});
regression('T04 manual character upload remains usable by the player',async()=>{
  windowForHooks();const value=context.story();const url='data:image/png;base64,UPLOADED';
  put('FileReader',class{onload:any;result:any;readAsDataURL(file:any){this.result=file.data;queueMicrotask(()=>this.onload({target:{result:file.data}}))}});
  const actions:any={updateCharacterExpressionUrl:(id:string,eid:string,image:string)=>{value.characters.find((c:any)=>c.id===id)!.expressions.find((e:any)=>e.id===eid)!.imageUrl=image}};
  const host=new Host(()=>ui.CharacterList({characters:value.characters,actions,aiOps:{generatingExpressionsForCharId:null}}));const tree=host.render();
  const input=find(tree,e=>e.type==='input'&&e.props.type==='file');ok(input);ok(!input.props.disabled);
  await input.props.onChange({target:{files:[{data:url}]}});same(value.characters[0].expressions[0].imageUrl,url);
  ok(markup(value).includes(url));same(context.calls.images,0);
});
regression('T05 existing static images remain in player markup',()=>{
  const value=createQuickDemo('en');const html=markup(value);ok(html.includes('/quick-character-1.svg'));ok(html.includes(value.scenes[0].backgroundUrl));
});
regression('T06 empty images support markup and immediate saved playback readiness',async()=>{
  const value=context.story();ok(markup(value).includes('data-testid="player-dialogue"'));ok(markup(value).includes('role="img"'));
  const host=new Host(()=>ui.useQuickPlayback(value,'saved',async()=>true));await host.flush();same(host.value.ready,true);same(host.value.message,'Images intentionally omitted');
});
regression('T07 disabled retries and direct client helpers issue no requests',async()=>{
  let requests=0;globalThis.fetch=async()=>{requests++;throw Error('Unexpected transport')};
  for(let i=0;i<2;i++){
    await rejects(()=>clientService.generateCharacterImage('Synthetic','Synthetic','neutral'),/IMAGE_GENERATION_DISABLED/);
    await rejects(()=>clientService.editCharacterImageExpression('data:image/png;base64,X','happy'),/IMAGE_GENERATION_DISABLED/);
    await rejects(()=>clientService.generateSceneBackground('Synthetic background'),/IMAGE_GENERATION_DISABLED/);
  }
  windowForHooks();const value=context.story();const host=new Host(()=>ui.useQuickPlayback(value,'saved',async()=>true));await host.flush();host.value.retry();await host.flush();
  same(requests,0);same(context.calls.images,0);same(context.calls.decode,0);same(host.value.ready,true);
});
regression('T08 direct image routes reject before protection or provider dispatch',async()=>{
  for(const route of ['generateCharacterImage','editCharacterImageExpression','generateSceneBackground']){
    for(const suffix of [route,route.toUpperCase()+'/']){
      const response=await dispatch('/api/gemini/'+suffix,{prompt:'Synthetic'});
      same(response.status,403);same(response.body.code,'IMAGE_GENERATION_DISABLED');
    }
  }
  same(context.calls.images,0);same(context.calls.protection,0);
});
regression('T09 text endpoint and client text proxy remain unblocked',async()=>{
  const response=await dispatch('/api/gemini/generateStory',{theme:'Synthetic',generationProfile:'quick',contentLanguage:'en'});
  same(response.status,200);same(context.calls.text,1);same(context.calls.protection,1);same(context.calls.images,0);
  let requests=0;globalThis.fetch=async(input:any)=>{same(String(input),'/api/gemini/generateStory');requests++;return Response.json(context.story())};
  await clientService.generateStory('Synthetic',{generationProfile:'quick',contentLanguage:'en'});same(requests,1);
});
regression('T10 text-only and demo Quick data retain P01 validator compatibility',()=>{
  const original=createQuickDemo('en');const before=clone(original);
  const textOnly=prepareQuickStory(original,'en','ai');
  same(validateVisualNovel(textOnly).valid,true);same(validateVisualNovel(original).valid,true);
  equal(original,before);same(textOnly.quickImages,undefined);
});
regression('T11 Studio relay and all manual image-generation handlers remain blocked',async()=>{
  const host=aiHost();await host.value.handleStartRecursiveInitial('Synthetic relay');await host.flush();
  await host.value.handleNextRecursiveStep('Continue');await host.flush();same(context.calls.text,2);same(context.calls.images,0);
  const value=context.vn;const before=clone(value);const char=value.characters[0];
  await host.value.handleGenerateAllCharacterExpressions(char.id);await host.value.handleGenerateSingleExpression(char.id,char.expressions[0].id);
  await host.value.handleRegenerateCharacterAndExpressions(char.id);await host.value.handleGenerateSceneBackground(value.scenes[0].id,'Synthetic');await host.flush();
  same(context.calls.images,0);same(context.changes.length,0);equal(value,before);same(host.value.error,'Image generation disabled');
});
regression('T12 local background removal remains available',async()=>{
  const value=context.story();value.characters[0].expressions[0].imageUrl='data:image/png;base64,EXISTING';const host=aiHost(value);
  await host.value.handleRemoveBackground(value.characters[0].id,value.characters[0].expressions[0].id);
  same(context.calls.local,1);same(context.calls.images,0);same(value.characters[0].expressions[0].imageUrl,'data:image/png;base64,LOCAL');
});
regression('T13 default-off and explicit opt-in are separate from omitted/failed status',async()=>{
  same(isImageGenerationEnabled(),false);process.env.AI_IMAGE_GENERATION_ENABLED='false';same(isImageGenerationEnabled(),false);
  process.env.AI_IMAGE_GENERATION_ENABLED='TRUE';same(isImageGenerationEnabled(),false);process.env.AI_IMAGE_GENERATION_ENABLED='true';same(isImageGenerationEnabled(),true);
  delete process.env.AI_IMAGE_GENERATION_ENABLED;
  windowForHooks();const value=context.story();value.quickImages={version:1,background:'failed',characters:{char_1:'failed'}};
  const before=clone(value);const host=new Host(()=>ui.QuickImageStatus({vn:value}));const tree=host.render();
  const text=JSON.stringify(tree);ok(text.includes('Image generation disabled'));ok(text.includes('Previous image generation failed'));
  ok(!text.includes('Images intentionally omitted'));ok(!text.includes('Image fallback'));equal(value,before);

  // No image and no previous failure is intentionally omitted, a separate state.
  const omitted=context.story();const omittedBefore=clone(omitted);
  const omittedHost=new Host(()=>ui.QuickImageStatus({vn:omitted}));
  const omittedText=JSON.stringify(omittedHost.render());
  ok(omittedText.includes('Image generation disabled'));ok(omittedText.includes('Images intentionally omitted'));
  ok(!omittedText.includes('Previous image generation failed'));ok(!omittedText.includes('Image fallback'));
  equal(omitted,omittedBefore);

  // A supplied image takes precedence over retained failure metadata.
  const existing=clone(value);const image='data:image/png;base64,EXISTING';existing.coverUrl=image;
  existing.characters[0].expressions[0].imageUrl=image;const existingBefore=clone(existing);
  const existingHost=new Host(()=>ui.QuickImageStatus({vn:existing}));const existingTree=existingHost.render();
  const existingText=JSON.stringify(existingTree);
  ok(existingText.includes('Image generation disabled'));ok(existingText.includes('Existing image'));
  ok(!existingText.includes('Previous image generation failed'));ok(!existingText.includes('Images intentionally omitted'));
  ok(find(existingTree,e=>e.type==='img'&&e.props.src===image));equal(existing,existingBefore);
});
regression('T14 server image helpers block before any mocked provider call',async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected provider')};
  await rejects(()=>serverService.generateCharacterImage('Synthetic','Synthetic','neutral'),/IMAGE_GENERATION_DISABLED/);
  await rejects(()=>serverService.editCharacterImageExpression('data:image/png;base64,X','happy'),/IMAGE_GENERATION_DISABLED/);
  await rejects(()=>serverService.generateSceneBackground('Synthetic'),/IMAGE_GENERATION_DISABLED/);same(calls,0);
});
