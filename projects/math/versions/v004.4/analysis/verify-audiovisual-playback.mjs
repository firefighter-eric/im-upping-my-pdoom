import {chromium} from 'playwright';
import {once} from 'node:events';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';
import {createProjectServer} from '../../../../../scripts/server.mjs';

const v=await loadVersion('math','v004.4'),m=v.manifest;
if(m.status!=='review'||!m.variants[0].output)throw Error('Registered preview required');
const server=createProjectServer(v.projectDirectory);
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try {
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1920,height:1200}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/versions/v004.4/watch.html');
 const player=page.locator('video');
 await player.evaluate(async video=>{video.muted=false;video.volume=1;video.playbackRate=1;await video.play();});
 const inspect=()=>player.evaluate(video=>({
  time:video.currentTime,duration:video.duration,width:video.videoWidth,height:video.videoHeight,
  readyState:video.readyState,paused:video.paused,ended:video.ended,
  muted:video.muted,volume:video.volume,playbackRate:video.playbackRate,
  error:video.error?.message??null,
  decodedAudioBytes:video.webkitAudioDecodedByteCount??null,
  audioTracks:typeof video.captureStream==='function'?video.captureStream().getAudioTracks().length:null,
  playbackQuality:(()=>{const q=video.getVideoPlaybackQuality?.();return q?{totalVideoFrames:q.totalVideoFrames,droppedVideoFrames:q.droppedVideoFrames,corruptedVideoFrames:q.corruptedVideoFrames}:null;})(),
 }));
 const samples=[];
 for(let i=0;i<13;i++){
  await page.waitForTimeout(i===0?600:5000);
  const state=await inspect();samples.push(state);
  if(state.error||state.readyState<3||state.muted||state.volume!==1||state.playbackRate!==1)throw Error('Audiovisual playback state invalid');
  if(i===0&&(state.time<=0||state.width!==1920||state.height!==1080||Math.abs(state.duration-58)>.001))throw Error('Initial audiovisual playback failed');
  if(i>0&&!state.ended&&state.time<=samples[i-1].time)throw Error('Playback did not advance');
  if(state.ended)break;
 }
 const ending=await inspect();
 if(!ending.ended||Math.abs(ending.time-58)>.05)throw Error('Complete playback did not reach the end');
 if(!(ending.decodedAudioBytes>0||ending.audioTracks>0))throw Error('No decoded audio evidence');
 const seeks=[];
 for(const seconds of [9.4,11.1,29,53.94]){
  await player.evaluate((video,t)=>new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=t;}),seconds);
  await player.evaluate(async video=>{await video.play();});
  await page.waitForTimeout(450);
  const state=await inspect();
  if(state.time<=seconds||state.readyState<3||state.error)throw Error('Seek/playback failed');
  seeks.push({target_seconds:seconds,...state});
 }
 await player.evaluate(video=>video.pause());
 await page.getByRole('button',{name:'全屏观看',exact:true}).click();
 await page.waitForFunction(()=>document.fullscreenElement===document.querySelector('video'));
 const fullscreen=await page.evaluate(()=>({element:document.fullscreenElement?.tagName,width:document.fullscreenElement?.getBoundingClientRect().width,height:document.fullscreenElement?.getBoundingClientRect().height}));
 await page.screenshot({path:path.join(v.directory,'provenance/player-fullscreen.png')});
 await page.evaluate(()=>document.exitFullscreen());
 if(errors.length)throw Error(errors.join('\n'));
 const record={
  project_id:m.project_id,version:m.version,generation_id:m.variants[0].generation_id,
  output_sha256:m.variants[0].output.sha256,recorded_at:new Date().toISOString(),
  status:'passed',scope:'Full 58-second normal-speed unmuted technical playback and four resumed seeks',
  browser:browser.version(),samples,ending,seeks,fullscreen,errors,
  perceptual_audio_sync:'pending; unmuted state and decoded audio are not human listening evidence',
  human_approval:'pending',
 };
 await saveJson(path.join(v.directory,'provenance/audiovisual-playback.json'),record);
 console.log(JSON.stringify({status:record.status,full_duration:ending.time,decoded_audio_bytes:ending.decodedAudioBytes,seeks:seeks.map(s=>s.time),dropped_frames:ending.playbackQuality?.droppedVideoFrames??null}));
}finally{
 if(browser)await browser.close();
 server.close();
}
