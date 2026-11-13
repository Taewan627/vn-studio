import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import type { VisualNovel } from '../../types';
import { p06Fixture } from './p06-fixtures';

const root=process.cwd();let hooks:any;let context:any;
export async function compileP06Hook(original=false){
 const directory=path.join(process.env.P06_ARTIFACTS||path.join(root,'.phase1-local/p06'),'hook-tests');mkdirSync(directory,{recursive:true});
 const shims:Record<string,string>={
  react:`export const useState=(...a)=>globalThis.__P06_TEST__.host.state(...a);export const useRef=(...a)=>globalThis.__P06_TEST__.host.ref(...a);export const useEffect=(...a)=>globalThis.__P06_TEST__.host.effect(...a);`,
  language:`export const useLanguage=()=>({language:'en',t:s=>s,restoreProjectLanguage:()=>{}});`,
  db:`export const loadVisualNovelData=(...a)=>globalThis.__P06_TEST__.db.load(...a);export const saveVisualNovelData=(...a)=>globalThis.__P06_TEST__.db.save(...a);export const saveProjectAndList=(...a)=>globalThis.__P06_TEST__.db.atomic(...a);export const removeFromDB=(...a)=>globalThis.__P06_TEST__.db.remove(...a);`,
 };
 const contents=original?readFileSync(path.join(root,'.phase1-local/p06/useVisualNovel.ts.BEFORE'),'utf8'):`export {useVisualNovel} from './useVisualNovel';`;
 const result=await build({stdin:{contents,resolveDir:path.join(root,'hooks'),sourcefile:original?'p06-original.ts':'p06-current.ts',loader:'ts'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,metafile:true,
  define:{setTimeout:'globalThis.__P06_TEST__.setTimeout',clearTimeout:'globalThis.__P06_TEST__.clearTimeout'},plugins:[{name:'p06-hook-doubles',setup(builder){
   builder.onResolve({filter:/^react$|^\.\.\/i18n\/LanguageProvider$|^\.\.\/utils\/db$/},args=>({path:args.path==='react'?'react':args.path.endsWith('LanguageProvider')?'language':'db',namespace:'p06-double'}));
   builder.onLoad({filter:/.*/,namespace:'p06-double'},args=>({contents:shims[args.path],loader:'js'}));
  }}]});
 if(Object.keys(result.metafile!.inputs).some(input=>/(?:^|\/)research\/|geminiService|server\/|^App\./.test(input)))throw Error('Forbidden runtime module');
 const file=path.join(directory,original?'original.cjs':'current.cjs');writeFileSync(file,result.outputFiles[0].text);writeFileSync(file+'.meta.json',JSON.stringify(result.metafile,null,2));
 hooks=createRequire(import.meta.url)(file);return hooks;
}
export class P06Host{
 slots:any[]=[];cursor=0;dirty=true;effects:(()=>void)[]=[];value:any;disposed=false;
 state(initial:any){const i=this.cursor++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};const slot=this.slots[i];
  return[slot.value,(next:any)=>{if(this.disposed)return;const value=typeof next==='function'?next(slot.value):next;if(!Object.is(value,slot.value)){slot.value=value;this.dirty=true}}]}
 ref(initial:any){const i=this.cursor++;if(!this.slots[i])this.slots[i]={ref:{current:initial}};return this.slots[i].ref}
 effect(callback:()=>any,dependencies:unknown[]){const i=this.cursor++;const previous=this.slots[i];
  if(!previous||dependencies.some((v,index)=>!Object.is(v,previous.dependencies[index]))){this.slots[i]={dependencies,cleanup:previous?.cleanup};this.effects.push(()=>{this.slots[i].cleanup?.();this.slots[i].cleanup=callback()})}}
 render(){context.host=this;this.cursor=0;this.dirty=false;this.value=hooks.useVisualNovel();for(const effect of this.effects.splice(0))effect()}
 async flush(){let quiet=0;for(let i=0;i<100;i++){if(this.dirty){this.render();quiet=0}await new Promise<void>(resolve=>setImmediate(resolve));if(!this.dirty&&++quiet>=2)return}throw Error('Hook did not settle')}
 async timers(){const callbacks=[...context.timers.values()]as(()=>void)[];context.timers.clear();for(const callback of callbacks)callback();await this.flush()}
 dispose(){for(const slot of this.slots)slot?.cleanup?.();this.disposed=true}
}
const descriptors=new Map<string,PropertyDescriptor|undefined>();
export async function setupP06(vn:VisualNovel=p06Fixture()){
 context?.host?.dispose();
 for(const name of['window','localStorage','alert','__P06_TEST__'])if(!descriptors.has(name))descriptors.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
 const data=new Map<string,any>([['vn_proj_'+vn.id,structuredClone(vn)],['vn_project_list',[{id:vn.id,title:vn.title,updatedAt:1}]]]);
 const local=new Map<string,string>([['vn_active_project_id',vn.id!]]);
 context={data,local,writes:[]as any[],confirmations:[]as string[],alerts:[]as string[],confirmed:true,timers:new Map(),nextTimer:0};
 context.db={load:async(key:string)=>data.has(key)?structuredClone(data.get(key)):null,
  save:async(key:string,value:any)=>{data.set(key,structuredClone(value));context.writes.push({key,value:structuredClone(value)});return true},
  atomic:async(id:string,project:any,list:any)=>{data.set('vn_proj_'+id,structuredClone(project));data.set('vn_project_list',structuredClone(list));context.writes.push({id,project:structuredClone(project),list:structuredClone(list)});return true},
  remove:async(key:string)=>{data.delete(key);return true}};
 context.setTimeout=(fn:()=>void)=>{const id=++context.nextTimer;context.timers.set(id,fn);return id};context.clearTimeout=(id:number)=>context.timers.delete(id);
 Object.defineProperty(globalThis,'__P06_TEST__',{configurable:true,value:context});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){},confirm:(message:string)=>{context.confirmations.push(message);return context.confirmed}}});
 Object.defineProperty(globalThis,'alert',{configurable:true,value:(message:string)=>context.alerts.push(message)});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>local.get(key)??null,setItem:(key:string,value:string)=>local.set(key,value),removeItem:(key:string)=>local.delete(key)}});
 const host=new P06Host();context.host=host;await host.flush();return{host,context};
}
export function cleanupP06(){context?.host?.dispose();for(const[name,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete(globalThis as any)[name]}descriptors.clear()}
