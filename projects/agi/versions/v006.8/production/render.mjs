import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,link,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import path from 'node:path';
import {ROOT,loadVersion,inside,outputIdentity,saveJson} from '../../../../../scripts/project.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';
import {buildRenderer,rendererFiles,rendererURL} from '../../../../../scripts/renderer.mjs';
import {createEncoder} from '../../../../../scripts/encoder.mjs';

// Version-local exporter: the browser draws only the new companion layout.
// FFmpeg decodes, scales and places the registered original video without recreating its scenes.
const smoke=process.argv.includes('--smoke');
if(process.argv.slice(2).some(a=>a!=='--smoke'))throw Error('Only --smoke is supported; omission performs one full render.');
const v=await loadVersion('agi','v006.8'),m=v.manifest;
if(m.status!=='draft'||m.variants.length!==1)throw Error('Use a fresh, single-variant draft.');
const hash=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
const source=inside(v.projectDirectory,m.inputs.video.path),audio=inside(v.projectDirectory,m.inputs.audio.path);
for(const [key,file] of [['video',source],['audio',audio]])if(await hash(file)!==m.inputs[key].sha256)throw Error('Registered input changed: '+key);
const a=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',audio])).streams.find(s=>s.codec_type==='audio');
if(a.codec_name!=='aac'||m.settings.target_frames!==Math.ceil(Number(a.duration)*m.settings.fps))throw Error('Full-audio frame count mismatch.');
const rendererHash=await hash(inside(v.directory,m.renderer.path)),files=await rendererFiles(v);
if(rendererHash!==m.renderer.sha256||JSON.stringify(files)!==JSON.stringify(m.renderer.files))throw Error('Renderer is not frozen in the manifest.');
const dataHashes={};for(const [key,file] of Object.entries(m.data)){dataHashes[key]=await hash(inside(v.directory,file));if(dataHashes[key]!==m.data_hashes[key])throw Error('Unrecorded data edit: '+key);}
const runId='RUN_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID().slice(0,8);
const target=outputIdentity(m,m.variants[0]);
const root=smoke?path.join(ROOT,'.cache/v0068-pipeline-smoke',runId):v.directory;
const file=inside(root,target.path),partial=file.replace(/\.mp4$/,'.partial.mp4');
if(existsSync(file)||existsSync(partial))throw Error('Output exists. Never overwrite or retry a render in place.');
await mkdir(path.dirname(file),{recursive:true});await mkdir(path.join(root,'runs'),{recursive:true});
const record=path.join(root,'runs',runId+'.json'),lock=path.join(v.directory,'.render.lock');
const receipt={id:runId,project_id:m.project_id,version:m.version,status:'preparing',started_at:new Date().toISOString(),purpose:smoke?'smoke':'full-render',renderer_sha256:rendererHash,renderer_files:files,audio_sha256:m.inputs.audio.sha256,source_video_sha256:m.inputs.video.sha256,data_hashes:dataHashes,settings:m.settings,request:m.request,treatment_sha256:await hash(path.join(v.directory,'TREATMENT.md')),tools:{ffmpeg:execFileSync('ffmpeg',['-version'],{encoding:'utf8'}).split('\n')[0],node:process.version,exporter_sha256:await hash(new URL(import.meta.url))},variants:[m.variants[0].id],outputs:[],compositing:{original_scene_rendering:false,source_video_direct_decode:true,source_pts:'preserved; rounded to 60fps grid; first frame padded to t=0',picture_upscale:'1280x720 -> 2464x1386 Lanczos',audio:'full registered AAC packet copy',native_text_canvas:[3840,2160]}};
await saveJson(record,receipt);
let owned=false,server,browser,encoder;
try{
 await writeFile(lock,runId,{flag:'wx'});owned=true;
 const build=await buildRenderer(v);receipt.build_key=build.key;
 server=createProjectServer(v.projectDirectory,{rendererBuild:build});server.listen(0,'127.0.0.1');await once(server,'listening');
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling']});receipt.tools.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 await page.goto(rendererURL(v,server.address().port,{exportMode:true}).href);await page.evaluate(()=>window.ready);
 const layout=await page.evaluate(()=>window.getLayoutReport());
 if(!layout.all_pairs_fit||!layout.all_subtitles_fit||!layout.fonts_loaded||layout.canvas[0]!==m.settings.width||layout.canvas[1]!==m.settings.height)throw Error('Layout preflight failed.');
 receipt.layout_preflight={all_pairs_fit:true,all_subtitles_fit:true,fonts_loaded:true,max_pair_height:Math.max(...layout.pairHeights.map(p=>p.previous_and_current)),viewport_height:layout.viewport_height};
 const fps=m.settings.fps,frames=smoke?30:m.settings.target_frames,start=smoke?118.25:0;
 const filter='[0:v:0]scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p[base];[1:v:0]fps=fps=60:round=near:start_time=0,scale=2464:1386:flags=lanczos,setsar=1[src];[base][src]overlay=x=96:y=208:eof_action=repeat:shortest=1:format=yuv420,setsar=1[v]';
 const args=['-hide_banner','-loglevel','error','-n','-filter_complex_threads','2','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0'];
 if(smoke)args.push('-ss',String(start));args.push('-i',source);
 if(!smoke)args.push('-i',audio);
 args.push('-filter_complex',filter,'-map','[v]');if(!smoke)args.push('-map','2:a:0');
 args.push('-c:v','libx264','-preset',m.settings.preset,'-crf',String(m.settings.crf),'-pix_fmt','yuv420p','-r',String(fps),'-fps_mode','cfr','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709');
 args.push(...(smoke?['-an']:['-c:a','copy']),'-movflags','+faststart',partial);
 receipt.encoder_arguments=args.map(s=>s.startsWith(ROOT)?path.relative(ROOT,s):s);receipt.segment=smoke?{start,frames,purpose:'technical pipeline smoke only'}:null;
 receipt.status='running';await saveJson(record,receipt);encoder=createEncoder(args);
 for(let i=0;i<frames;i++){
  const jpg=await Promise.race([page.evaluate(t=>window.renderFrame(t,'companion',false),start+i/fps),encoder.failed]);
  if(typeof jpg!=='string'||jpg.length<1000)throw Error('Invalid companion frame.');
  await encoder.write(Buffer.from(jpg,'base64'));
  if(i%240===0)console.log(JSON.stringify({run_id:runId,frames:i,total:frames,percent:Math.round(i/frames*100),elapsed_seconds:Math.round((Date.now()-Date.parse(receipt.started_at))/1000)}));
 }
 if(errors.length)throw Error(errors.join('\n'));
 await encoder.finish();encoder=null;
 if(await hash(source)!==m.inputs.video.sha256||await hash(audio)!==m.inputs.audio.sha256)throw Error('An input changed during render.');
 await link(partial,file);await unlink(partial);
 receipt.outputs.push({variant:m.variants[0].id,generation_id:target.id,path:target.path,sha256:await hash(file)});
 receipt.transport={format:'jpeg-new-layout-plus-direct-source-composite',frames};receipt.status='completed';receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);
 console.log(JSON.stringify({status:'completed',path:path.relative(ROOT,file),record:path.relative(ROOT,record)}));
}catch(error){receipt.status='failed';receipt.error=error.message;receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);throw error;}
finally{if(encoder)await encoder.stop();if(browser)await browser.close();if(server)server.close();if(owned)await unlink(lock);}
