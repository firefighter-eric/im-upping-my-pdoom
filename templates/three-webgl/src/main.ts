import * as THREE from 'three';
declare global {interface Window {ready:Promise<void>;renderFrame:(seconds:number,variant:string,capture?:boolean)=>string|null;streamFrames:(options:any)=>Promise<void>}}
// Interface scaffold. Creative treatment, audio analysis and scene design remain TBD.
const canvas=document.querySelector('canvas')!;
window.ready=(async()=>{
 const manifest=await (await fetch('../manifest.json')).json();
 const {width,height,fps}=manifest.settings;
 const renderer=new THREE.WebGLRenderer({canvas,preserveDrawingBuffer:true,antialias:true});renderer.setSize(width,height,false);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#050910');
 const camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,10);camera.position.z=1;
 const label=document.createElement('canvas');label.width=1024;label.height=256;const ctx=label.getContext('2d')!;ctx.fillStyle='#b6cbd1';ctx.font='80px monospace';ctx.textAlign='center';ctx.fillText('TBD',512,160);
 scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1024,256),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(label),transparent:true})));
 window.renderFrame=(_seconds,variant,capture=true)=>{if(!manifest.variants.some((v:any)=>v.id===variant))throw Error('Unknown variant');renderer.render(scene,camera);return capture?canvas.toDataURL('image/jpeg',.97).split(',')[1]!:null;};
 window.streamFrames=async options=>{
  const ws=new WebSocket(options.ws);let acknowledged=0;ws.onmessage=e=>{if(typeof e.data==='string')acknowledged=Number(e.data);};
  await new Promise<void>((resolve,reject)=>{ws.onopen=()=>resolve();ws.onerror=()=>reject(Error('Frame socket unavailable'));});
  const gl=renderer.getContext(),buffer=new Uint8Array(width*height*4),start=Math.round(options.from*options.fps),end=Math.round(options.to*options.fps);
  for(let i=start;i<end;i++){window.renderFrame(i/options.fps,options.variant,false);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,buffer);while(i-start-acknowledged>=(options.inflight??2)){if(ws.readyState!==WebSocket.OPEN)throw Error('Frame socket closed');await new Promise(resolve=>setTimeout(resolve,2));}ws.send(buffer);await new Promise(resolve=>setTimeout(resolve,0));}
  while(ws.bufferedAmount>0)await new Promise(resolve=>setTimeout(resolve,2));ws.close();
 };
 window.renderFrame(0,manifest.variants[0].id,false);
})();
