import * as THREE from 'three';

type Word={text:string;character_start:number;character_end:number;start:number;end:number;confidence:number|null};
type Lyric={line_id:string;en:string;zh:string;start_seconds:number;end_seconds:number;display_start_seconds:number;display_end_seconds:number;source_physical_line:number|null;words:Word[];timing_status:string};
type Unit={id:string;category:string;title:string;en:string;zh:string;body:string;source_note:string;source_physical_lines:number[]};
type Cue={event_id:number;unit_id:string;start:number;end:number};
type Card={layer:HTMLCanvasElement;height:number;y:number};
declare global{interface Window{ready:Promise<void>;renderFrame:(t:number,variant?:string,source?:boolean)=>Promise<string>;getLayoutReport:()=>unknown;getFrameState:(t:number)=>unknown;drawFrame:(t:number)=>void;}}

const W=1920,H=1080,DURATION=306.480181;
const params=new URLSearchParams(location.search),PREVIEW=params.has('preview'),S=PREVIEW?1:2,FPS=PREVIEW?30:60,SAMPLES=PREVIEW?4:1,SHUTTER=PREVIEW?.2:0;
const BG='#101613',FG='#e9eee8',MUTED='#c6cec4',ACCENT='#c4eea8';
const R={x:1380,w:500,top:110,bottom:1036,gap:26,rail:1350};
const VIDEO={x:40,y:110,w:1248,h:702},SUB={x:40,y:834,w:1248};
const stage=document.querySelector<HTMLCanvasElement>('#stage')!;
const renderer=new THREE.WebGLRenderer({canvas:stage,antialias:false,preserveDrawingBuffer:true,alpha:false,powerPreference:'high-performance'});
renderer.setSize(W*S,H*S,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const paint=document.createElement('canvas');paint.width=W*S;paint.height=H*S;
const ctx=paint.getContext('2d',{alpha:false})!;
const measure=document.createElement('canvas').getContext('2d')!;
const base=document.createElement('canvas');base.width=W*S;base.height=H*S;
const bc=base.getContext('2d',{alpha:false})!;
const texture=new THREE.CanvasTexture(paint);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene();
scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));
const targets=Array.from({length:SAMPLES},()=>new THREE.WebGLRenderTarget(W*S,H*S,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false}));
const outScene=new THREE.Scene();
outScene.add(new THREE.Mesh(geometry,new THREE.ShaderMaterial({uniforms:{a:{value:targets[0].texture},b:{value:targets[1]?.texture??targets[0].texture},c:{value:targets[2]?.texture??targets[0].texture},d:{value:targets[3]?.texture??targets[0].texture}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position,1.0);}',fragmentShader:'uniform sampler2D a,b,c,d;varying vec2 uv0;void main(){gl_FragColor=(texture2D(a,uv0)+texture2D(b,uv0)+texture2D(c,uv0)+texture2D(d,uv0))*.25;\n#include <colorspace_fragment>\n}',depthTest:false,depthWrite:false,toneMapped:false})));
let units:Unit[]=[],cues:Cue[]=[],lines:Lyric[]=[],beats:number[]=[],cards:Card[]=[];
let sourceReady:Promise<void>|null=null;const original=document.createElement('video');original.muted=true;original.preload='auto';original.playsInline=true;

function font(c:CanvasRenderingContext2D,px:number,weight=400,en=false){c.font=`${weight} ${px}px ${en?'"Archivo",':''}"Noto SC"`;c.textBaseline='top';}
function wrap(text:string,px:number,width:number,weight=400,en=false){
 font(measure,px,weight,en);const chunks=text.match(/[A-Za-z0-9’'\-]+|\s+|[^\s]/gu)??[];const a:string[]=[];let line='';
 for(const part of chunks){if(line&&measure.measureText((line+part).trimEnd()).width>width){if(/^[，。；：？！、）》”]$/.test(part)&&line.length>1){const last=Array.from(line).pop()!;a.push(line.slice(0,-last.length).trimEnd());line=last+part;}else{a.push(line.trimEnd());line=part.trimStart();}}else line+=part;}
 if(line.trim())a.push(line.trimEnd());return a;
}
function block(c:CanvasRenderingContext2D,text:string,x:number,y:number,px:number,lh:number,width:number,color=FG,weight=400,en=false){font(c,px,weight,en);c.fillStyle=color;for(const l of wrap(text,px,width,weight,en)){c.fillText(l,x,y);y+=lh;}return y;}
function time(t:number){const n=Math.floor(Math.max(0,t));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function smooth(x:number){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function unitFor(c:Cue){return units.find(u=>u.id===c.unit_id)!;}
const kind:Record<string,string>={reference:'典故与出处',term:'术语',wordplay:'双关',narrative:'叙事解读'};
function prepare(){
 let y=0;cards=cues.map(c=>{const u=unitFor(c);const layer=document.createElement('canvas');layer.width=R.w*S;layer.height=900*S;const g=layer.getContext('2d')!;g.scale(S,S);
 let cy=32;cy=block(g,u.en,0,cy,24,30,R.w,FG,700,true)+7;cy=block(g,u.zh,0,cy,21,29,R.w,MUTED)+18;
 cy=block(g,u.title,0,cy,24,32,R.w,FG,700)+9;cy=block(g,u.source_note,0,cy,17,25,R.w,'#9db097')+10;
 cy=block(g,u.body,0,cy,21,32,R.w,MUTED)+23;
 g.fillStyle='#425141';g.fillRect(0,cy-2,R.w,.7);
 const cropped=document.createElement('canvas');cropped.width=layer.width;cropped.height=Math.ceil(cy*S);cropped.getContext('2d')!.drawImage(layer,0,0);
 const item={layer:cropped,height:cy,y};y+=cy+R.gap;return item;});
 bc.setTransform(S,0,0,S,0,0);bc.fillStyle=BG;bc.fillRect(0,0,W,H);
 font(bc,50,700,true);bc.fillStyle=FG;bc.fillText('Escape Velocity',40,25);
 bc.fillStyle='#060a07';bc.fillRect(VIDEO.x,VIDEO.y,VIDEO.w,VIDEO.h);bc.strokeStyle='#52654b';bc.lineWidth=.65;bc.strokeRect(VIDEO.x-.3,VIDEO.y-.3,VIDEO.w+.6,VIDEO.h+.6);
 bc.fillStyle='#364831';bc.fillRect(1318,R.top,.7,R.bottom-R.top);bc.fillRect(R.rail,R.top,.7,R.bottom-R.top);
 bc.fillStyle='#33442f';bc.fillRect(0,H-4,W,4);
}
function visibleStart(i:number){let j=i,height=cards[i].height;while(j>0&&height+R.gap+cards[j-1].height<=R.bottom-R.top){j--;height+=R.gap+cards[j].height;}return j;}
function state(t:number){let i=0;for(let j=0;j<cues.length;j++)if(t>=cues[j].start)i=j;
 let offset=cards[visibleStart(i)].y;
 const progress=smooth((t-cues[i].start)/.35);
 if(i>0){const old=cards[visibleStart(i-1)].y;offset=old+(offset-old)*progress;}
 let li=-1;for(let j=0;j<lines.length;j++)if(t>=lines[j].display_start_seconds&&t<=lines[j].display_end_seconds)li=j;
 return {i,offset,li};}
function pulse(t:number){let b=-10;for(const beat of beats){if(beat>t)break;b=beat;}return Math.exp(-(t-b)*14);}
function subtitle(l:Lyric,t:number){
 let y=SUB.y;
 if(l.source_physical_line!==null&&[57,58,59,60].includes(l.source_physical_line)){font(ctx,16);ctx.fillStyle='#ddad82';ctx.fillText('作者原稿 · 此段唱词尚待核对',SUB.x,y-24);}
 y=block(ctx,l.zh,SUB.x,y,34,44,SUB.w,FG,700)+12;
 const enLines=wrap(l.en,28,SUB.w,500,true);font(ctx,28,500,true);let at=0;
 for(const row of enLines){const start=l.en.indexOf(row,at);ctx.fillStyle=FG;ctx.fillText(row,SUB.x,y);
  for(const w of l.words){if(t<w.start||w.end<=w.start)continue;const a=Math.max(w.character_start,start)-start,b=Math.min(w.character_end,start+row.length)-start;if(b<=a)continue;
   const left=ctx.measureText(row.slice(0,a)).width,right=ctx.measureText(row.slice(0,b)).width;ctx.save();ctx.beginPath();ctx.rect(SUB.x+left,y-2,right-left,39);ctx.clip();ctx.fillStyle=ACCENT;ctx.fillText(row,SUB.x,y);ctx.restore();}
  at=start+row.length;y+=36;}
}
function draw(t:number,withSource=false){
 t=Math.max(0,Math.min(DURATION,t));const s=state(t);ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(base,0,0);ctx.setTransform(S,0,0,S,0,0);
 if(withSource&&original.readyState>=2)ctx.drawImage(original,VIDEO.x,VIDEO.y,VIDEO.w,VIDEO.h);
 if(s.li>=0)subtitle(lines[s.li],t);
 ctx.fillStyle=ACCENT;ctx.fillRect(0,H-4,W*t/DURATION,4);font(ctx,19,500,true);ctx.fillStyle='#a7b1a1';ctx.fillText(`${time(t)} / 05:06`,40,1028);
 const chapter=t<73.7?'旧金山的 11 套造型':t<112.78?'掉队倒计时':t<153.28?'安全、信任与延寿':t<184.66?'刹车与油门':t<216.52?'三种逃逸':t<252.32?'希望清单与现实阻力':t<273.54?'倒计时翻面':'乐观面料，末日内衬';
 font(ctx,18);ctx.fillText('·  '+chapter,224,1029);
 ctx.save();ctx.beginPath();ctx.rect(1335,R.top,570,R.bottom-R.top);ctx.clip();
 for(let k=visibleStart(Math.max(0,s.i-1));k<=s.i;k++){const card=cards[k],u=unitFor(cues[k]);const y=R.top+card.y-s.offset;if(y+card.height<R.top||y>R.bottom)continue;
  ctx.drawImage(card.layer,R.x,y,R.w,card.height);font(ctx,17,k===s.i?700:400);ctx.fillStyle=k===s.i?ACCENT:'#a2aea0';
  const raw=u.source_physical_lines.every(n=>[57,58,59,60].includes(n));ctx.fillText((k===s.i?(t<cues[0].start?'即将开始':'正在解释'):'继续阅读')+' · '+(raw?'原稿背景':kind[u.category]),R.x,y+1);
  ctx.fillStyle=k===s.i?ACCENT:'#8ba081';ctx.beginPath();ctx.arc(R.rail,y+11,k===s.i?6.5:4.5,0,Math.PI*2);ctx.fill();
  if(k===s.i){ctx.fillStyle=`rgba(196,238,168,${.03+.07*pulse(t)})`;ctx.beginPath();ctx.arc(R.rail,y+11,13+2*pulse(t),0,Math.PI*2);ctx.fill();}}
 ctx.restore();
}
async function sourceAt(t:number){if(!sourceReady){sourceReady=new Promise((resolve,reject)=>{original.addEventListener('loadeddata',()=>resolve(),{once:true});original.addEventListener('error',()=>reject(Error(original.error?.message??'Source video failed')),{once:true});});original.src='/sources/references/LLMV_002_source_v001.mp4';document.body.append(original);}await sourceReady;
 const at=Math.min(t,original.duration-.05);if(Math.abs(original.currentTime-at)>.002)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Source seek timeout')),15000);original.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});original.currentTime=at;});}
function gpu(t:number,withSource=false){for(let i=0;i<SAMPLES;i++){draw(t+(i-(SAMPLES-1)/2)*SHUTTER/FPS/(SAMPLES-1||1),withSource);texture.needsUpdate=true;renderer.setRenderTarget(targets[i]);renderer.render(scene,camera);}renderer.setRenderTarget(null);renderer.render(outScene,camera);}
function report(){const pairs=cards.map((c,i)=>({event:i,unit_id:cues[i].unit_id,height:c.height,previous_and_current:i?cards[i-1].height+R.gap+c.height:c.height}));
 const subs=lines.map(l=>({line:l.line_id,height:wrap(l.zh,34,SUB.w,700).length*44+12+wrap(l.en,28,SUB.w,500,true).length*36}));
 return {canvas:[stage.width,stage.height],all_pairs_fit:pairs.every(c=>c.previous_and_current<=R.bottom-R.top),all_subtitles_fit:subs.every(l=>SUB.y+l.height<=1008),fonts_loaded:document.fonts.check('21px "Noto SC"')&&document.fonts.check('700 24px Archivo'),pairHeights:pairs,subtitleHeights:subs,viewport_height:R.bottom-R.top,body_size_at_1080p:21,semantic_unit_count:units.length,target_count:null,sampling:{samples:SAMPLES,shutter:SHUTTER,space:'linear WebGL render targets'},reading:cues.map((c,i)=>{let next=i+1;while(next<cues.length&&visibleStart(next)<=i)next++;return {unit_id:c.unit_id,first:c.start,fully_visible_until:cues[next]?.start??DURATION,full_visible_seconds:(cues[next]?.start??DURATION)-c.start};})};}
window.ready=(async()=>{const root=new URL('.',document.baseURI);for(const face of [new FontFace('Noto SC',`url('${new URL('fonts/NotoSansCJKsc-Regular.otf',root)}')`),new FontFace('Archivo',`url('${new URL('fonts/Archivo-500.ttf',root)}')`,{weight:'500'}),new FontFace('Archivo',`url('${new URL('fonts/Archivo-700.ttf',root)}')`,{weight:'700'})])document.fonts.add(await face.load());await document.fonts.ready;
 const dataRoot=new URL('../data/',root);const [copy,timing,audio]=await Promise.all([fetch(new URL('screen-copy.json',dataRoot)).then(r=>r.json()),fetch(new URL('lyric-timing.json',dataRoot)).then(r=>r.json()),fetch(new URL('beat-analysis.json',dataRoot)).then(r=>r.json())]);units=copy.units;cues=copy.events;lines=timing.lines;beats=audio.beats;prepare();gpu(0);})();
window.renderFrame=async(t,_variant='companion',withSource=false)=>{await window.ready;if(withSource)await sourceAt(t);gpu(t,withSource);return stage.toDataURL('image/jpeg',.96).split(',')[1];};
window.drawFrame=t=>gpu(t);window.getLayoutReport=report;window.getFrameState=t=>{const s=state(t);return {time:t,unit:cues[s.i].unit_id,previous:s.i?cues[s.i-1].unit_id:null,lyric:s.li>=0?lines[s.li].line_id:null,scroll_offset:s.offset};};
