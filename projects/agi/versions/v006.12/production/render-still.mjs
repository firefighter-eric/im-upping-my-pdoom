import {chromium} from 'playwright';
import {once} from 'node:events';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,unlink,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {loadVersion,saveJson,inside} from '../../../../../scripts/project.mjs';
import {buildRenderer,rendererFiles,rendererURL} from '../../../../../scripts/renderer.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';

const v=await loadVersion('agi','v006.12'),m=v.manifest,t=8.5;
const output='stills/LLMV_001_V006_R012_001_balanced-bottom_008.500.jpg';
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
if(m.status!=='draft'||m.production_authorization?.scope!=='one-still')throw Error('This exporter is restricted to the authorized single-frame review.');
try{await access(inside(v.directory,output));throw Error('Review still exists; do not overwrite or automatically retry.');}catch(e){if(e.code!=='ENOENT')throw e;}
for(const input of Object.values(m.inputs))if(await hash(inside(v.projectDirectory,input.path))!==input.sha256)throw Error('Registered input changed.');
const files=await rendererFiles(v),dataHashes={};
for(const [key,file] of Object.entries(m.data))dataHashes[key]=await hash(inside(v.directory,file));
const runId='RUN_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID().slice(0,8);
const receipt={id:runId,project_id:m.project_id,version:m.version,status:'preparing',purpose:'single-frame-review',started_at:new Date().toISOString(),time_seconds:t,frame_count:1,full_video_rendered:false,settings:m.settings,request:m.request,inputs:m.inputs,renderer_files:files,data_hashes:dataHashes,treatment_sha256:await hash(path.join(v.directory,'TREATMENT.md')),tools:{node:process.version},outputs:[]};
await mkdir(path.join(v.directory,'runs'),{recursive:true});
const record=path.join(v.directory,'runs',runId+'.json'),lock=path.join(v.directory,'.render.lock');
await saveJson(record,receipt);
let server,browser,owned=false;
try{
  await writeFile(lock,runId,{flag:'wx'});owned=true;
  const build=await buildRenderer(v);receipt.build_key=build.key;
  server=createProjectServer(v.projectDirectory,{rendererBuild:build});server.listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({channel:'chrome',headless:true});receipt.tools.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto(rendererURL(v,server.address().port,{exportMode:true}).href);await page.evaluate(()=>window.ready);
  const layout=await page.evaluate(()=>window.getLayoutReport());
  if(!layout.all_pairs_fit||!layout.all_subtitles_fit||!layout.fonts_loaded||!layout.progress.full_width||!layout.progress.bottom_flush)throw Error('Single-frame layout preflight failed.');
  receipt.status='running';await saveJson(record,receipt);
  const frame=await page.evaluate(t=>window.renderFrame(t,'companion',true),t);
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile(inside(v.directory,output),Buffer.from(frame,'base64'),{flag:'wx'});
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height,codec_name','-of','json',inside(v.directory,output)],{encoding:'utf8'})).streams[0];
  if(probe.width!==3840||probe.height!==2160)throw Error('Still dimensions do not match the native 4K target.');
  const preserved=JSON.parse(await readFile(path.join(v.directory,'provenance/parent-preservation.json'),'utf8'));
  for(const item of preserved.files)if(await hash(path.join(v.directory,'..','v006.11',item.path))!==item.sha256)throw Error('Parent file changed: '+item.path);
  const result={path:output,sha256:await hash(inside(v.directory,output)),size_bytes:Buffer.from(frame,'base64').length,width:probe.width,height:probe.height,time_seconds:t,kind:'single-rendered-frame',status:'review',run_id:runId};
  await saveJson(path.join(v.directory,'provenance/still-validation.json'),{status:'passed',scope:'one still plus layout measurements; no full-video playback or motion validation',layout,sampled_time_seconds:t,state:await page.evaluate(t=>window.getFrameState(t),t),parent_files_preserved:preserved.files.length,errors});
  receipt.outputs=[result];receipt.status='completed';receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);
  m.renderer.files=files;m.renderer.sha256=files[m.renderer.path];m.data_hashes=dataHashes;m.variants[0].design_output=result;m.variants[0].poster=output;
  m.validation.single_frame_rendered=true;m.validation.layout_measurements='passed';m.validation.parent_files_preserved=preserved.files.length;
  await saveJson(path.join(v.directory,'manifest.json'),m);
  console.log(JSON.stringify({status:'completed',run_id:runId,...result,max_pair_height:Math.max(...layout.pairHeights.map(p=>p.previous_and_current)),viewport_height:layout.viewport_height,full_video_rendered:false}));
}catch(error){receipt.status='failed';receipt.error=error.message;receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);throw error;}
finally{if(browser)await browser.close();if(server)server.close();if(owned)await unlink(lock);}
