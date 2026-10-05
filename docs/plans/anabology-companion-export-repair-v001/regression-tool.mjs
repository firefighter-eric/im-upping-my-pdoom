import {execFileSync,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('.cache/anabology-explainer-v001/tail-regression');await mkdir(dir,{recursive:true});
const source=path.join(dir,'synthetic-source.mp4'),audio=path.join(dir,'synthetic-audio.m4a'),jpeg=path.join(dir,'synthetic-layout.jpg');
const ff=args=>execFileSync('ffmpeg',['-v','error','-n',...args],{maxBuffer:1e6});
ff(['-f','lavfi','-i','color=c=green:s=160x90:r=24','-frames:v','12','-an','-c:v','libx264','-pix_fmt','yuv420p',source]);
ff(['-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t','0.55','-c:a','aac',audio]);
ff(['-f','lavfi','-i','color=c=navy:s=160x90:r=1','-frames:v','1','-q:v','2',jpeg]);
const probe=f=>JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',f]));
const duration=Number(probe(audio).streams[0].duration),frame=await readFile(jpeg);
const packets=f=>execFileSync('ffmpeg',['-v','error','-i',f,'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim();
const results=[];
for(const fps of [30,60])for(const fixed of [false,true]){
 const frames=Math.ceil(duration*fps),file=path.join(dir,`${fps}-${fixed?'fixed':'old'}.mp4`);
 const filter=`[0:v]format=yuv420p[base];[1:v]fps=fps=${fps}:round=near:start_time=0,scale=80:44:flags=lanczos[src];[base][src]overlay=x=10:y=10:eof_action=repeat:shortest=${fixed?0:1}:format=yuv420[v]`;
 const args=['-v','error','-n','-filter_complex_threads','2','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-i',source,'-i',audio,'-filter_complex',filter,'-map','[v]','-map','2:a:0'];
 if(fixed)args.push('-frames:v',String(frames));
 args.push('-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-r',String(fps),'-fps_mode','cfr','-c:a','copy',file);
 const run=spawnSync('ffmpeg',args,{input:Buffer.concat(Array.from({length:frames},()=>frame)),maxBuffer:1e6});if(run.status!==0)throw Error(run.stderr.toString());
 const video=probe(file).streams.find(s=>s.codec_type==='video'),actual=Number(video.nb_read_frames),aac=packets(file)===packets(audio);
 if(fixed&&actual!==frames||!fixed&&actual>=frames||!aac)throw Error('Endpoint regression did not match expected behavior.');
 ff(['-i',file,'-f','null','-']);
 results.push({fps,fix:fixed,target_frames:frames,decoded_frames:actual,video_duration:Number(video.duration),audio_duration:duration,aac_packets_identical:aac,complete_decode:'passed'});
}
const report={status:'passed',purpose:'isolated exporter endpoint regression on generated color and silent AAC fixtures; no LLMV inputs, not a production rerender',results};
await writeFile(path.join(dir,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
