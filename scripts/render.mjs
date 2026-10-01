import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile,access,link,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import path from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import {ROOT,parseOptions,loadVersion,inside,outputIdentity,saveJson} from './project.mjs';
import {createProjectServer} from './server.mjs';
import {buildRenderer,rendererFiles,rendererURL} from './renderer.mjs';
import {createEncoder} from './encoder.mjs';
const o=parseOptions(process.argv.slice(2)),v=await loadVersion(o.project,o.version),m=v.manifest;
const selected=o.variant?o.variant.split(','):m.variants.map(x=>x.id);
if(!selected.length||selected.some(x=>!m.variants.some(y=>y.id===x))||new Set(selected).size!==selected.length)throw Error('Select variants listed in the version manifest');
if(!o.smoke&&(!Number.isFinite(m.settings.duration_seconds)||m.settings.duration_seconds<=0||m.settings.target_frames!==Math.ceil(m.settings.duration_seconds*m.settings.fps)))throw Error('Set exact duration and target_frames before rendering');
if(!Number.isInteger(m.settings.fps)||m.settings.fps<=0)throw Error('FPS must be a positive integer');
if(!o.smoke&&!o.stills&&m.status!=='draft')throw Error('Full render requires a draft; create a new version');
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const rendererHash=await hash(inside(v.directory,m.renderer.path)),files=await rendererFiles(v);
if(m.status!=='draft'&&rendererHash!==m.renderer.sha256)throw Error('Reviewed renderer is immutable; create a new version');
for(const [file,digest] of Object.entries(m.renderer.files??{}))if(files[file]!==digest)throw Error('Bound renderer source changed: '+file);
const runId='RUN_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID().slice(0,8);
const outRoot=o.smoke?path.join(ROOT,'.cache/smoke',runId):v.directory;
const targets=selected.map(id=>{const variant=m.variants.find(x=>x.id===id);return {...outputIdentity(m,variant),variant};});
for(const target of targets)if(!o.stills&&existsSync(inside(outRoot,target.path)))throw Error('Output already exists: '+target.path+'; create a new version');
let audio=null;
if(!o.smoke&&!o.stills){
 if(!m.inputs?.audio?.path||m.inputs.audio.path==='TBD')throw Error('A source audio mapping is required');
 audio=inside(v.projectDirectory,m.inputs.audio.path);await access(audio);if(await hash(audio)!==m.inputs.audio.sha256)throw Error('Source audio hash mismatch');
 const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','a','-show_streams','-of','json',audio],{maxBuffer:1e6})).streams;
 if(streams[0]?.codec_name!=='aac')throw Error('This path preserves AAC; use a documented version exporter for other codecs');
 const duration=Number(streams[0].duration);
 if(!Number.isFinite(duration)||m.settings.target_frames!==Math.ceil(duration*m.settings.fps))throw Error('Target frames must cover the actual full source audio');
}
const ffmpegVersion=execFileSync('ffmpeg',['-version'],{encoding:'utf8'}).split('\n')[0];
await mkdir(outRoot,{recursive:true});const runs=path.join(outRoot,'runs');await mkdir(runs,{recursive:true});
const receipt={id:runId,project_id:m.project_id,version:m.version,status:'preparing',started_at:new Date().toISOString(),purpose:o.smoke?'smoke':o.stills?'stills':'full-render',renderer_sha256:rendererHash,renderer_files:files,audio_sha256:audio?await hash(audio):null,data_hashes:{},settings:m.settings,request:m.request,treatment_sha256:await hash(path.join(v.directory,'TREATMENT.md')),tools:{ffmpeg:ffmpegVersion},variants:selected,outputs:[]};
for(const [key,file] of Object.entries(m.data??{}))receipt.data_hashes[key]=await hash(inside(v.directory,file));
const record=path.join(runs,runId+'.json'),lock=path.join(v.directory,'.render.lock');
await saveJson(record,receipt);let owned=false,server,browser,encoder;
try{
 await writeFile(lock,runId,{flag:'wx'});owned=true;
 const rendererBuild=await buildRenderer(v);receipt.build_key=rendererBuild?.key??null;
 server=createProjectServer(v.projectDirectory,{rendererBuild});server.listen(0,'127.0.0.1');await once(server,'listening');
 const browserOptions={headless:true,args:['--disable-background-timer-throttling']};
 if(o.browser==='chrome'||(!o.browser&&process.platform==='darwin'&&existsSync('/Applications/Google Chrome.app')))browserOptions.channel='chrome';
 browser=await chromium.launch(browserOptions);receipt.tools.browser=browser.version();
 const page=await browser.newPage({viewport:{width:m.settings.width,height:m.settings.height}}),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')pageErrors.push(msg.text());});
 await page.goto(rendererURL(v,server.address().port,{exportMode:true}).href);
 await page.evaluate(async()=>{if(window.ready)await window.ready;if(typeof window.renderFrame!=='function')throw Error('Missing renderFrame(seconds, variant)');});
 const dimensions=await page.locator('canvas').evaluate(c=>[c.width,c.height]);
 if(dimensions[0]!==m.settings.width||dimensions[1]!==m.settings.height)throw Error('Canvas dimensions do not match settings');
 if(pageErrors.length)throw Error(pageErrors.join('\n'));receipt.status='running';await saveJson(record,receipt);
 for(const target of targets){
  if(o.stills){
   const dir=path.join(v.directory,'stills',runId);await mkdir(dir,{recursive:true});
   for(const fraction of [.03,.17,.3,.41,.53,.64,.79,.93]){
    const t=m.settings.duration_seconds*fraction;
    const frame=await page.evaluate(({t,id})=>window.renderFrame(t,id),{t,id:target.variant.id});
    const file=path.join(dir,`${target.variant.id}-${t.toFixed(3)}.jpg`);await writeFile(file,Buffer.from(frame,'base64'));
    receipt.outputs.push({variant:target.variant.id,path:path.relative(v.directory,file),sha256:await hash(file)});
   }continue;
  }
  const file=inside(outRoot,target.path);await mkdir(path.dirname(file),{recursive:true});const partial=file.replace(/\.mp4$/,'.partial.mp4');
  const frames=o.smoke?m.settings.fps:m.settings.target_frames,raw=m.settings.frame_transport==='rgba-websocket';
  const args=['-hide_banner','-loglevel','error','-n'];
  if(raw)args.push('-f','rawvideo','-pix_fmt','rgba','-s',`${m.settings.width}x${m.settings.height}`,'-r',String(m.settings.fps),'-i','pipe:0');
  else args.push('-f','image2pipe','-vcodec','mjpeg','-framerate',String(m.settings.fps),'-i','pipe:0');
  if(audio)args.push('-i',audio,'-map','0:v:0','-map','1:a:0');
  if(raw)args.push('-vf','vflip');
  args.push('-c:v','libx264','-preset',m.settings.preset??'fast','-crf',String(m.settings.crf??19),'-pix_fmt','yuv420p');
  args.push(...(audio?['-c:a','copy']:['-an']),'-movflags','+faststart',partial);
  encoder=createEncoder(args);
  if(raw){
   const socketPath='/render/'+runId,wss=new WebSocketServer({server,path:socketPath,maxPayload:m.settings.width*m.settings.height*4+1});
   let received=0,chain=Promise.resolve(),rejectReceive;
   const receiveFailure=new Promise((_,reject)=>rejectReceive=reject);receiveFailure.catch(()=>{});
   wss.once('connection',socket=>{
    socket.on('error',rejectReceive);
    socket.on('message',(data,binary)=>{
     chain=chain.then(async()=>{
      if(!binary||data.length!==m.settings.width*m.settings.height*4||received>=frames)throw Error('Invalid raw frame');
      await encoder.write(data);received++;
      if(socket.readyState===WebSocket.OPEN)socket.send(String(received));
     });chain.catch(rejectReceive);
    });
   });
   try{
    const sampling=m.settings.sampling,samples=sampling?.mode==='auto'?{min:sampling.min,max:sampling.max,tol:sampling.tolerance}:sampling?.samples??1;
    await Promise.race([page.evaluate(opts=>{if(typeof window.streamFrames!=='function')throw Error('Raw renderer needs streamFrames');return window.streamFrames(opts);},{from:0,to:frames/m.settings.fps,fps:m.settings.fps,variant:target.variant.id,ws:`ws://127.0.0.1:${server.address().port}${socketPath}`,samples,shutter:sampling?.shutter??.2,inflight:2}),encoder.failed,receiveFailure]);
    await Promise.race([chain,encoder.failed]);if(received!==frames)throw Error(`Raw frame count mismatch: ${received}/${frames}`);
    receipt.transport={format:'rgba-bottom-up',inflight:2,frames:received};
   }finally{for(const socket of wss.clients)socket.terminate();await new Promise(resolve=>wss.close(resolve));}
  }else{
   for(let i=0;i<frames;i++){
    const frame=await Promise.race([page.evaluate(({t,id})=>window.renderFrame(t,id),{t:i/m.settings.fps,id:target.variant.id}),encoder.failed]);
    if(typeof frame!=='string')throw Error('Renderer did not return JPEG base64');await encoder.write(Buffer.from(frame,'base64'));
    if(i%240===0)console.log(target.variant.id,Math.round(i/frames*100)+'%');
   }
  }
  if(pageErrors.length)throw Error(pageErrors.join('\n'));await encoder.finish();encoder=null;
  await link(partial,file);await unlink(partial);receipt.outputs.push({variant:target.variant.id,generation_id:target.id,path:target.path,sha256:await hash(file)});
  await saveJson(record,receipt);console.log('Rendered',path.relative(ROOT,file));
 }
 receipt.status='completed';receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);
 if(!o.smoke&&!o.stills&&m.status==='draft'){m.renderer.sha256=rendererHash;m.renderer.files=files;m.data_hashes=receipt.data_hashes;await saveJson(path.join(v.directory,'manifest.json'),m);}
}catch(error){receipt.status='failed';receipt.error=error.message;receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);throw error;}
finally{if(encoder)await encoder.stop();if(browser)await browser.close();if(server)server.close();if(owned)await unlink(lock);}
