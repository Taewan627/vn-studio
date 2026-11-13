import assert from'node:assert/strict';
import{test,before,after}from'node:test';
import{chromium,expect,type Browser,type Page}from'@playwright/test';
import{createServer,type Server}from'node:http';
import{build}from'esbuild';
import{mkdirSync,readFileSync,writeFileSync}from'node:fs';
import path from'node:path';
import{APP_PNG,APP_GIF}from'./support/integrated-app-fixtures';

const root=process.env.APP_WORKSPACE||process.cwd(),directory=path.join(process.env.P07_ARTIFACTS||path.join(root,'.phase1-local/p07'),'focused-browser');
let browser:Browser,server:Server,origin:string;let assertions=0;
const records:{id:string;status:string;assertions:number}[]=[];const sessions:any[]=[];
function equal(a:unknown,b:unknown){assertions++;assert.deepEqual(a,b)}
function ok(v:unknown){assertions++;assert.ok(v)}
async function check(callback:()=>Promise<unknown>){assertions++;await callback()}
function regression(id:string,body:()=>Promise<void>){const record={id,status:'NOT RUN',assertions:0};records.push(record);test(id,async()=>{const before=assertions;try{await body();record.status='PASS'}catch(error){record.status='FAIL';throw error}finally{record.assertions=assertions-before}})}
before(async()=>{
 mkdirSync(directory,{recursive:true});
 const built=await build({absWorkingDir:root,entryPoints:['tests/support/p07-image-harness.tsx'],bundle:true,platform:'browser',format:'iife',write:false,metafile:true,
  define:{'process.env.NODE_ENV':'"development"',__VN_AI_IMAGE_GENERATION_ENABLED__:'false'}});
 writeFileSync(path.join(directory,'harness.js'),built.outputFiles[0].text);writeFileSync(path.join(directory,'METAFILE.json'),JSON.stringify(built.metafile,null,2));
 const html='<!doctype html><meta charset="utf-8"><title>Synthetic P07</title><style>.genre-image{display:block;width:240px;height:160px}[data-genre-image="placeholder"]{background:linear-gradient(135deg,#1e293b,#020617,#1e1b4b)}button{margin:4px}</style><div id="root"></div><script src="/harness.js"></script>';
 const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'none'; connect-src 'self'; frame-src 'none'; form-action 'none'; base-uri 'none'";
 server=createServer((req,res)=>{res.setHeader('Content-Security-Policy',csp);res.setHeader('Cache-Control','no-store');
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html)}
  else if(req.url==='/harness.js'){res.setHeader('Content-Type','text/javascript');res.end(built.outputFiles[0].text)}
  else if(req.url==='/available.jpg'||req.url==='/alternative.png'){res.setHeader('Content-Type','image/png');res.end(Buffer.from(APP_PNG.split(',')[1],'base64'))}
  else if(req.url==='/favicon.ico'){res.statusCode=204;res.end()}
  else{res.statusCode=404;res.end('Synthetic missing image')}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address()as any;equal(address.address,'127.0.0.1');origin='http://127.0.0.1:'+address.port;
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
  args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=127.0.0.1']});
 writeFileSync(path.join(directory,'ENVIRONMENT.json'),JSON.stringify({browser:browser.version(),node:process.version,playwright:JSON.parse(readFileSync(path.join(root,'node_modules/@playwright/test/package.json'),'utf8')).version,
  component:'Actual GenreImage + React development Profiler',CSP:csp,syntheticHTTP:true,localOnly:true,expectedMissingImages:'HTTP 404 diagnostics retained'},null,2));
});
after(async()=>{if(browser)await browser.close();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));writeFileSync(path.join(directory,'NETWORK_AND_RUNTIME.json'),JSON.stringify(sessions,null,2));
 console.log('P07_ASSERTION_SUMMARY '+JSON.stringify({cases:records,assertions_executed:assertions,passed:records.filter(r=>r.status==='PASS').length,failed:records.filter(r=>r.status==='FAIL').length,not_run:records.filter(r=>r.status==='NOT RUN').length,
  external_requests:sessions.reduce((sum,s)=>sum+s.external.length,0),page_errors:sessions.reduce((sum,s)=>sum+s.errors.length,0),scope:'Actual Edge/React GenreImage component with synthetic local HTTP fixtures; not full app. Full actual app replay is separate.'}));
});
async function session(body:(page:Page,record:any)=>Promise<void>){
 const context=await browser.newContext({serviceWorkers:'block'}),record={requests:[]as string[],external:[]as string[],errors:[]as string[],console:[]as any[]};sessions.push(record);
 context.on('request',request=>{record.requests.push(request.url());if(!request.url().startsWith(origin+'/')&&!/^(?:data:|blob:)/.test(request.url()))record.external.push(request.url())});
 await context.route('**/*',route=>route.request().url().startsWith(origin+'/')||/^(?:data:|blob:)/.test(route.request().url())?route.continue():route.abort('blockedbyclient'));
 await context.routeWebSocket('**/*',socket=>{record.external.push(socket.url());socket.close()});
 const page=await context.newPage();page.on('pageerror',error=>record.errors.push(error.message));page.on('console',message=>{if(['error','warning'].includes(message.type()))record.console.push({type:message.type(),text:message.text()})});
 try{await page.goto(origin);await body(page,record);equal(record.external,[]);equal(record.errors,[])}finally{await context.close()}
}
const placeholder=(page:Page)=>check(()=>expect(page.locator('[data-genre-image="placeholder"]')).toBeVisible());
const loaded=(page:Page)=>check(()=>expect.poll(()=>page.locator('img[data-genre-image]').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true));
const wait=(page:Page)=>page.waitForTimeout(200);
regression('T01 available local genre source remains a visible raster image',async()=>session(async(page,r)=>{await loaded(page);equal(await page.locator('img[data-genre-image]').getAttribute('src'),'/available.jpg');equal(r.requests.filter((u:string)=>u.endsWith('/available.jpg')).length,1)}));
regression('T02 missing local genre exhausts only the bounded local candidates',async()=>session(async(page,r)=>{await page.locator('#missing').click();await placeholder(page);for(const name of['missing.jpg','missing.png','missing.jpeg'])equal(r.requests.filter((u:string)=>u.endsWith('/'+name)).length,1)}));
regression('T03 a single-source image failure is attempted exactly once',async()=>session(async(page,r)=>{await page.locator('#single').click();await placeholder(page);await wait(page);equal(r.requests.filter((u:string)=>u.endsWith('/single-failure.png')).length,1)}));
regression('T04 terminal placeholder stays stable after load failure and idle time',async()=>session(async(page,r)=>{await page.locator('#missing').click();await placeholder(page);const count=r.requests.length;await wait(page);equal(r.requests.length,count);await check(()=>expect(page.locator('img[data-genre-image]')).toHaveCount(0));ok((await page.locator('[data-genre-image="placeholder"]').evaluate(element=>getComputedStyle(element).backgroundImage)).includes('linear-gradient'))}));
regression('T05 no external placeholder URL is requested, even for an unsupported controlled genre source',async()=>session(async(page,r)=>{await page.locator('#remote').click();await placeholder(page);await wait(page);equal(r.external,[]);await check(()=>expect(page.locator('img[data-genre-image]')).toHaveCount(0))}));
regression('T06 duplicate error events cannot cause an infinite React commit loop',async()=>session(async page=>{await loaded(page);await page.locator('img[data-genre-image]').evaluate(image=>{for(let i=0;i<20;i++)image.dispatchEvent(new Event('error'))});await placeholder(page);
 const commits=await page.evaluate(()=>Number((window as any).__P07_STATE__.commits));await wait(page);equal(await page.evaluate(()=>Number((window as any).__P07_STATE__.commits)),commits);ok(commits<=4)}));
regression('T07 missing artwork leaves genre controls and surrounding UI usable',async()=>session(async page=>{await page.locator('#missing').click();await placeholder(page);await page.locator('#still-usable').click();await check(()=>expect(page.locator('#version')).toHaveText('1'));await placeholder(page)}));
regression('T08 existing raster Data URI remains visible without rewriting',async()=>session(async page=>{await page.locator('#data').click();await loaded(page);equal(await page.locator('img[data-genre-image]').getAttribute('src'),APP_PNG)}));
regression('T09 native manual GIF upload remains visible; actual editor upload is replayed separately',async()=>session(async page=>{await page.locator('#upload').setInputFiles({name:'synthetic.gif',mimeType:'image/gif',buffer:Buffer.from(APP_GIF.split(',')[1],'base64')});await loaded(page);equal(await page.locator('img[data-genre-image]').getAttribute('src'),APP_GIF)}));
regression('T10 existing image generation default remains OFF with no provider call',async()=>session(async(page,r)=>{await check(()=>expect(page.locator('#image-policy')).toHaveText('false'));equal(r.requests.filter((u:string)=>u.includes('/api/')).length,0)}));
regression('T11 repeated component mounts produce finite local attempts and no external requests',async()=>session(async(page,r)=>{await page.locator('#missing').click();await placeholder(page);for(let i=0;i<3;i++){await page.locator('#remount').click();await placeholder(page)}
 for(const name of['missing.jpg','missing.png','missing.jpeg'])equal(r.requests.filter((u:string)=>u.endsWith('/'+name)).length,4);equal(r.external,[])}));
regression('T12 valid state, local PNG alternative and source recovery survive rerenders',async()=>session(async(page,r)=>{await page.locator('#alternative').click();await loaded(page);equal(await page.locator('img[data-genre-image]').getAttribute('src'),'/alternative.png');
 const attempts=r.requests.length;for(let i=0;i<3;i++)await page.locator('#rerender').click();equal(r.requests.length,attempts);await loaded(page);
 await page.locator('#empty').click();await placeholder(page);await page.locator('#data').click();await loaded(page);equal(await page.locator('#source').textContent(),APP_PNG)}));
