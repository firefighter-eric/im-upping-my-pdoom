import {chromium} from 'playwright';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';
import {buildRenderer,rendererURL} from '../../../../../scripts/renderer.mjs';

const v=await loadVersion('math','v004.4'),m=v.manifest;
const storyboard=JSON.parse(await readFile(path.join(v.directory,m.data.storyboard),'utf8'));
const intro=storyboard.intro_end,dt=1/m.settings.fps,last=m.settings.duration_seconds-dt;
const build=await buildRenderer(v);
const server=createProjectServer(v.projectDirectory,{rendererBuild:build});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:m.settings.width,height:m.settings.height}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(rendererURL(v,server.address().port,{exportMode:true}).href);
 await page.evaluate(async()=>{await window.ready;});
 const samples=await page.evaluate(({intro,dt,last})=>{
  const times=[0,dt,5,intro-dt,intro,intro+dt,20,20+dt,20+2*dt,last];
  return times.map(seconds=>({seconds,...window.sourcePicture.state(seconds)}));
 },{intro,dt,last});
 const at=t=>samples.find(s=>s.seconds===t);
 if(!(at(1/60).scroll_offset_px>at(0).scroll_offset_px))throw Error('Scroll does not start immediately');
 if(at(intro).overlay_alpha!==0)throw Error('Intro still present at its declared end');
 const a=at(20+1/60).scroll_offset_px-at(20).scroll_offset_px;
 const b=at(20+2/60).scroll_offset_px-at(20+1/60).scroll_offset_px;
 if(Math.abs(a-b)>1e-8)throw Error('Uneven scroll increments');
 const expected=m.settings.duration_seconds-1/m.settings.fps;
 const end=at(last);
 if(Math.abs(end.seconds-expected)>1e-8||end.visible_rows[1]!==721)throw Error('Last row not covered');
 await mkdir(path.join(v.directory,'provenance/design-frames'),{recursive:true});
 const transitionSamples=await page.evaluate(({intro,dt})=>Array.from({length:Math.round(intro/dt)+1},(_,i)=>({seconds:i*dt,...window.timelineDesign.transitionState(i*dt)})),{intro,dt});
 let maximumAlphaStep=0;
 for(let i=0;i<transitionSamples.length;i++){const t=transitionSamples[i];
  if(t.content_alpha<0||t.content_alpha>1||t.year_alpha<0||t.year_alpha>1)throw Error('Opening alpha outside range');
  if(i)maximumAlphaStep=Math.max(maximumAlphaStep,Math.abs(t.content_alpha-transitionSamples[i-1].content_alpha),Math.abs(t.year_alpha-transitionSamples[i-1].year_alpha));
 }
 if(maximumAlphaStep>.16)throw Error('Abrupt opening alpha step at 60fps');
 for(const node of storyboard.timeline.slice(5)){const t=transitionSamples.find(t=>Math.abs(t.seconds-node.start)<1e-8);if(t.year!=='2026'||t.year_alpha!==1||t.year_translate_y!==0)throw Error('Repeated year anchor moved or faded at an event boundary');}
 const ns=storyboard.timeline.find(s=>s.id==='TL_NS'),count=storyboard.timeline.find(s=>s.id==='TL_722');
 if(ns.date_display!=='2026.09.08'||count.suffix!=='10.07'||count.date_role!=='editorial-as-of')throw Error('Requested dated milestone missing');
 await saveJson(path.join(v.directory,'provenance/opening-transitions-preflight.json'),{project_id:m.project_id,version:m.version,status:'passed',intro_seconds:intro,maximum_alpha_step_per_60fps_frame:maximumAlphaStep,year_anchor:'stable across all same-year boundaries',dates:{ns:ns.date_display,preprints:count.date_display},samples:transitionSamples});
 const times=[...storyboard.timeline.map(s=>(s.start+s.end)/2),...storyboard.timeline.slice(1).flatMap(s=>[s.start-.09,s.start,s.start+.09]),intro-.6,intro-.3,intro,20,20+dt,32,last];
 const images=[];
 for(const [i,t]of times.entries()){
  const png=await page.evaluate(({t,id})=>window.renderDesignPng(t,id),{t,id:m.variants[0].id});
  const bytes=Buffer.from(png.includes(',')?png.split(',')[1]:png,'base64');
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG signature from renderer');
  const relative='provenance/design-frames/frame-'+String(i+1).padStart(2,'0')+'.png';
  await writeFile(path.join(v.directory,relative),bytes);
  images.push({path:relative,seconds:t,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 if(images.find(i=>i.seconds===20).sha256===images.find(i=>i.seconds===20+dt).sha256)throw Error('Adjacent 60fps frames are duplicated');
 const again=await page.evaluate(({t,id})=>window.renderDesignPng(t,id),{t:(storyboard.timeline[6].start+storyboard.timeline[6].end)/2,id:m.variants[0].id});
 const againHash=createHash('sha256').update(Buffer.from(again.includes(',')?again.split(',')[1]:again,'base64')).digest('hex');
 if(againHash!==images[6].sha256)throw Error('Arbitrary-time rendering is not deterministic');
 if(errors.length)throw Error(errors.join('\n'));
 await saveJson(path.join(v.directory,'provenance/motion-preflight.json'),{project_id:m.project_id,version:m.version,recorded_at:new Date().toISOString(),status:'passed',scope:'Deterministic source geometry, twelve-second intro removal, continuous opening curves, stable same-year anchor, explicit NS/as-of dates, distinct native-time 60fps frames and representative layout samples; not a full video or human approval',settings:m.settings,samples,images,errors});
 console.log(JSON.stringify({status:'passed',fps:m.settings.fps,distinct_adjacent_frames:true,first_frame_scroll:true,last_row:721,images:images.length}));
}finally{if(browser)await browser.close();server.close();}
