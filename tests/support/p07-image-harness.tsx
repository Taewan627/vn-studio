import React,{Profiler,useState}from 'react';
import{createRoot}from 'react-dom/client';
import{GenreImage}from '../../components/GenreImage';
import{isImageGenerationEnabled}from '../../services/imageGenerationPolicy';
import{APP_PNG}from './integrated-app-fixtures';
const state={commits:0};(window as any).__P07_STATE__=state;
function Harness(){
 const[src,setSource]=useState('/available.jpg');const[version,setVersion]=useState(0);const[nonce,setNonce]=useState(0);const[visible,setVisible]=useState(true);
 return <main>
  <p id="version">{version}</p><p id="source">{src}</p><p id="image-policy">{String(isImageGenerationEnabled())}</p>
  <nav>{[['available','/available.jpg'],['alternative','/alternative.jpg'],['missing','/missing.jpg'],['single','/single-failure.png'],['data',APP_PNG],['empty',''],['remote','https://synthetic.invalid/never-fetch.png']].map(([id,url])=><button key={id}id={id}onClick={()=>setSource(url)}>{id}</button>)}
   <button id="rerender"onClick={()=>setVersion(value=>value+1)}>Rerender</button><button id="remount"onClick={()=>setNonce(value=>value+1)}>Remount</button>
   <button id="toggle"onClick={()=>setVisible(value=>!value)}>Toggle</button>
   <input id="upload"type="file"accept="image/*"onChange={event=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setSource(String(reader.result));reader.readAsDataURL(file)}}/>
  </nav>
  <button id="still-usable"onClick={()=>setVersion(value=>value+1)}>Choose genre</button>
  <Profiler id="genre"onRender={()=>state.commits++}><div key={nonce}>{visible&&<GenreImage src={src}alt="Synthetic genre"className="genre-image"/>}</div></Profiler>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
