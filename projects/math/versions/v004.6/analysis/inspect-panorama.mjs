import {chromium} from 'playwright';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';
import {buildRenderer,rendererURL} from '../../../../../scripts/renderer.mjs';

const v=await loadVersion('math','v004.6'),m=v.manifest;
const s=JSON.parse(await readFile(path.join(v.directory,m.data.storyboard),'utf8'));
const capture=JSON.parse(await readFile(path.join(v.directory,m.data.github_capture),'utf8'));
const reference=JSON.parse(await readFile(path.join(v.directory,m.data.screenshot_layout),'utf8'));
const e=s.ending_panorama,dt=1/m.settings.fps;
const build=await buildRenderer(v),server=createProjectServer(v.projectDirectory,{rendererBuild:build});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:m.settings.width,height:m.settings.height}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(rendererURL(v,server.address().port,{exportMode:true}).href);
 await page.evaluate(async()=>await window.ready);
 const facts=JSON.parse(await readFile(path.join(v.projectDirectory,m.inputs.cyber_milestones.path),'utf8'));
 const fact=facts.facts.find(f=>f.id==='F11'),cyber=s.timeline.find(n=>n.id==='TL_CYBER_2026_04'),math=s.timeline.find(n=>n.id==='TL_722');
 if(!fact||cyber.title!==fact.name||cyber.date_display!==fact.date.replaceAll('-','.')||cyber.fact_ids.join()!=='F11'||cyber.summary!=='Anthropic 报告：发现数千个高危漏洞')throw Error('Mythos milestone does not match the chosen official source');
 if(math.title!=='AI 正在攻克前沿数学难题'||math.count!==722||math.count_unit!=='篇数学论文'||!math.summary.startsWith('372 组相关成果'))throw Error('Mathematics opening copy/count mismatch');
 if(s.ending_statistics.items.map(x=>`${x.count}${x.unit}`).join('|')!=='722篇数学论文|372组相关成果')throw Error('Closing statistics count/unit mismatch');
 const typography=await page.evaluate(nodes=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),font='-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';return nodes.map(n=>{ctx.font='600 '+(n.count!==undefined?48:n.id==='TL_2025'?99:112)+'px '+font;const titleWidth=ctx.measureText(n.title).width;ctx.font=(n.count!==undefined?32:39)+'px '+font;return {id:n.id,title:n.title,date:n.date_display,title_right_px:106+titleWidth,summary_right_px:114+ctx.measureText(n.summary).width};});},s.timeline);
 if(typography.some(t=>t.title_right_px>1808||t.summary_right_px>1808))throw Error('Opening copy exceeds the safe frame');
 const states=await page.evaluate(({e,dt})=>Array.from({length:Math.round((e.fade_end-e.start)/dt)+1},(_,i)=>({seconds:e.start+i*dt,...window.endingDesign.state(e.start+i*dt)})),{e,dt});
 const picture=await page.evaluate(({e,dt})=>[0,dt,20,20+dt,20+2*dt,e.start,e.zoom_end,56.75,e.hold_end,e.fade_end-dt].map(seconds=>({seconds,...window.sourcePicture.state(seconds)})),{e,dt});
 const at=t=>picture.find(p=>Math.abs(p.seconds-t)<1e-8);
 if(!(at(dt).scroll_offset_px>at(0).scroll_offset_px))throw Error('Scroll did not start immediately');
 const step=at(20+dt).scroll_offset_px-at(20).scroll_offset_px;
 if(Math.abs(step-(at(20+2*dt).scroll_offset_px-at(20+dt).scroll_offset_px))>1e-8)throw Error('Nonuniform directory scroll');
 if(at(e.start).visible_rows[1]!==721)throw Error('Last row not reached before zoom');
 const start=states[0],imageScale=1920/capture.width,headerHeight=reference.header_height_px*1920/reference.width;
 const pageHeight=headerHeight+capture.body_height_px*imageScale;
 if(Math.abs(start.page_x)>1e-8||Math.abs(start.scale-1)>1e-8||Math.abs(start.page_y+at(e.start).scroll_offset_px*imageScale)>1e-8)throw Error('Zoom does not join the last-row viewport');
 for(let i=0;i<states.length;i++){
  const q=states[i];
  if(q.document_alpha<0||q.document_alpha>1||q.scale<=0)throw Error('Invalid ending state');
  if(Math.abs(q.page_width/q.page_height-1920/pageHeight)>1e-8)throw Error('Long-page aspect ratio changed');
  if(i&&(q.scale>states[i-1].scale+1e-10||q.document_alpha>states[i-1].document_alpha+1e-10))throw Error('Zoom or fade reversed');
 }
 for(const time of [e.zoom_end,56.75,e.hold_end]){
  const q=await page.evaluate(t=>window.endingDesign.state(t),time),p=at(time);
  if(!q.whole_document_visible||Math.abs(q.page_y-60)>1e-8||Math.abs(q.page_height-960)>1e-8||p.visible_rows[0]!==0||p.visible_rows[1]!==721||p.annotated_visible_rows.length!==722||p.source_segments.length!==8)throw Error('Full overview missing original rows or notes');
 }
 for(const q of states.filter(q=>q.statistics_alpha>0)){
  if(q.statistics_alpha>q.document_alpha+1e-10||q.page_x<850||q.page_x+q.page_width>1070)throw Error('Closing statistics overlap the original panorama or fail to share its fade');
 }
 if(states.find(q=>Math.abs(q.seconds-56.75)<1e-8).statistics_alpha!==1||states.at(-1).statistics_alpha!==0)throw Error('Statistics hold/fade failed');
 if(states.at(-1).document_alpha!==0||states.at(-1).sticky_header_alpha!==0)throw Error('Ending does not fade completely');
 const intro=await page.evaluate(({intro,dt})=>Array.from({length:Math.round(intro/dt)+1},(_,i)=>({seconds:i*dt,...window.timelineDesign.transitionState(i*dt)})),{intro:s.intro_end,dt});
 if(intro.at(-1).overlay_alpha!==0)throw Error('Opening does not end at 12 seconds');
 let maximumAlphaStep=0;
 for(let i=1;i<intro.length;i++)maximumAlphaStep=Math.max(maximumAlphaStep,Math.abs(intro[i].content_alpha-intro[i-1].content_alpha),Math.abs(intro[i].year_alpha-intro[i-1].year_alpha));
 if(maximumAlphaStep>.16)throw Error('Opening transition discontinuity');
 for(const node of s.timeline.slice(5)){const q=intro.find(t=>Math.abs(t.seconds-node.start)<1e-8);if(q.year_alpha!==1||q.year_translate_y!==0)throw Error('Repeated 2026 year moved');}
 await mkdir(path.join(v.directory,'provenance/design-frames'),{recursive:true});
 const times=[...s.timeline.map(n=>(n.start+n.end)/2),12,20,20+dt,52.75,e.start-dt,e.start,53.3,54,55,55.75,55.95,56.2,e.zoom_end,56.75,e.hold_end,57.6,58-dt,58];
 const images=[];
 for(const [i,t]of times.entries()){
  const started=performance.now(),png=await page.evaluate(({t,id})=>window.renderDesignPng(t,id),{t,id:m.variants[0].id});
  const bytes=Buffer.from(png,'base64');if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG');
  const relative='provenance/design-frames/frame-'+String(i+1).padStart(2,'0')+'.png';await writeFile(path.join(v.directory,relative),bytes);
  images.push({path:relative,seconds:t,sha256:createHash('sha256').update(bytes).digest('hex'),render_and_transport_ms:performance.now()-started});
 }
 const again=await page.evaluate(({t,id})=>window.renderDesignPng(t,id),{t:56.75,id:m.variants[0].id});
 if(createHash('sha256').update(Buffer.from(again,'base64')).digest('hex')!==images.find(i=>i.seconds===56.75).sha256)throw Error('Ending arbitrary-time rendering is not deterministic');
 const white=await page.evaluate(id=>{window.renderFrame(58,id,false);const c=document.querySelector('canvas'),b=document.createElement('canvas');b.width=c.width;b.height=c.height;const ctx=b.getContext('2d');ctx.drawImage(c,0,0);const values=ctx.getImageData(0,0,b.width,b.height).data;let error=0;for(let i=0;i<values.length;i++)if(i%4!==3)error=Math.max(error,255-values[i]);return error;},m.variants[0].id);
 if(white>1)throw Error('White fade endpoint has residual pixels');
 if(errors.length)throw Error(errors.join('\n'));
 await saveJson(path.join(v.directory,'provenance/copy-layout-preflight.json'),{project_id:m.project_id,version:m.version,recorded_at:new Date().toISOString(),status:'passed',scope:'Chosen official-source identity/date and approved copy direction, canvas font widths and safe frame, statistics separation from the original page and shared fade; human subject-matter/music/aesthetic approval is pending.',cyber_source:{source_id:m.inputs.cyber_milestones.source_id,sha256:m.inputs.cyber_milestones.sha256,fact_id:fact.id,date:fact.date,name:fact.name,url:fact.url},opening_math:math,ending_statistics:s.ending_statistics,typography});
 await saveJson(path.join(v.directory,'provenance/panorama-preflight.json'),{project_id:m.project_id,version:m.version,recorded_at:new Date().toISOString(),status:'passed',scope:'Directory coverage, continuous last-row camera join, all 301 ending frame-time states, aspect ratio, all 722 bilingual rows and eight original segments at overview, white fade pixels, deterministic reverse seek and representative native design frames; not a full render or human approval',settings:m.settings,source_page_height_px:pageHeight,overview_width_px:1920*960/pageHeight,opening_maximum_alpha_step_per_frame:maximumAlphaStep,white_endpoint_maximum_rgb_deviation:white,source_picture_samples:picture,ending_states:states,images,errors});
 console.log(JSON.stringify({status:'passed',ending_states:states.length,overview_rows:722,overview_width_px:1920*960/pageHeight,images:images.length,maximum_sample_ms:Math.max(...images.map(i=>i.render_and_transport_ms))}));
}finally{if(browser)await browser.close();server.close();}
