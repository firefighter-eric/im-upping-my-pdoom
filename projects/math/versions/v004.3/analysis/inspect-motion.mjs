import {chromium} from 'playwright';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';
import {buildRenderer,rendererURL} from '../../../../../scripts/renderer.mjs';

const v=await loadVersion('math','v004.3'),m=v.manifest;
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
 const samples=await page.evaluate(()=>{
  const times=[0,1/60,5,9.99,10,10.01,20,20+1/60,20+2/60,57.98333333333333];
  return times.map(seconds=>({seconds,...window.sourcePicture.state(seconds)}));
 });
 const at=t=>samples.find(s=>s.seconds===t);
 if(!(at(1/60).scroll_offset_px>at(0).scroll_offset_px))throw Error('Scroll does not start immediately');
 if(at(10).overlay_alpha!==0)throw Error('Intro still present at ten seconds');
 const a=at(20+1/60).scroll_offset_px-at(20).scroll_offset_px;
 const b=at(20+2/60).scroll_offset_px-at(20+1/60).scroll_offset_px;
 if(Math.abs(a-b)>1e-8)throw Error('Uneven scroll increments');
 const expected=m.settings.duration_seconds-1/m.settings.fps;
 const end=at(57.98333333333333);
 if(Math.abs(end.seconds-expected)>1e-8||end.visible_rows[1]!==721)throw Error('Last row not covered');
 await mkdir(path.join(v.directory,'provenance/design-frames'),{recursive:true});
 const storyboard=JSON.parse(await readFile(path.join(v.directory,m.data.storyboard),'utf8'));
 const times=[...storyboard.timeline.map(s=>(s.start+s.end)/2),9.68,10,20,20+1/60,32,57.98333333333333];
 const images=[];
 for(const [i,t]of times.entries()){
  const png=await page.evaluate(({t,id})=>window.renderDesignPng(t,id),{t,id:m.variants[0].id});
  const bytes=Buffer.from(png.includes(',')?png.split(',')[1]:png,'base64');
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG signature from renderer');
  const relative='provenance/design-frames/frame-'+String(i+1).padStart(2,'0')+'.png';
  await writeFile(path.join(v.directory,relative),bytes);
  images.push({path:relative,seconds:t,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 if(images.find(i=>i.seconds===20).sha256===images.find(i=>i.seconds===20+1/60).sha256)throw Error('Adjacent 60fps frames are duplicated');
 if(errors.length)throw Error(errors.join('\n'));
 await saveJson(path.join(v.directory,'provenance/motion-preflight.json'),{project_id:m.project_id,version:m.version,recorded_at:new Date().toISOString(),status:'passed',scope:'Deterministic source geometry, ten-second intro removal, distinct native-time 60fps frames and representative layout samples; not a full video or human approval',settings:m.settings,samples,images,errors});
 console.log(JSON.stringify({status:'passed',fps:m.settings.fps,distinct_adjacent_frames:true,first_frame_scroll:true,last_row:721,images:images.length}));
}finally{if(browser)await browser.close();server.close();}
