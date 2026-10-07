import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';

const v=await loadVersion('math','v004.5'),m=v.manifest,output=m.variants[0].output;
if(!output||m.status!=='review')throw Error('Registered output required');
const video=path.join(v.directory,output.path),fps=m.settings.fps;
const timestamps=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',video],{maxBuffer:2e7})).frames.map(f=>Number(f.best_effort_timestamp_time));
const error=Math.max(...timestamps.map((t,i)=>Math.abs(t-i/fps)));
if(timestamps.length!==m.settings.target_frames||error>1e-5)throw Error('Encoded CFR timestamps mismatch');
await saveJson(path.join(v.directory,'provenance/frame-timestamps.json'),{project_id:m.project_id,version:m.version,status:'passed',frames:timestamps.length,expected_fps:fps,maximum_timestamp_error_seconds:error,first_timestamp:timestamps[0],last_timestamp:timestamps.at(-1)});

// Measure actual decoded image motion, independently of the renderer's state function.
const crop={width:720,height:780,x:0,y:180},firstFrame=20*fps,count=16,bytesPerFrame=crop.width*crop.height;
const raw=execFileSync('ffmpeg',['-v','error','-i',video,'-vf',`select='between(n,${firstFrame},${firstFrame+count-1})',crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},format=gray`,'-fps_mode','passthrough','-frames:v',String(count),'-f','rawvideo','-'],{maxBuffer:2e7});
if(raw.length!==count*bytesPerFrame)throw Error('Decoded motion sample frame count mismatch');
const shifts=[];
for(let frame=0;frame<count-1;frame++){
 const a=raw.subarray(frame*bytesPerFrame,(frame+1)*bytesPerFrame),b=raw.subarray((frame+1)*bytesPerFrame,(frame+2)*bytesPerFrame);
 const costs=[];
 for(let shift=0;shift<=24;shift++){
  let errorSum=0,samples=0;
  for(let y=30;y<crop.height-35;y+=3)for(let x=14;x<crop.width-10;x+=4){errorSum+=Math.abs(a[(y+shift)*crop.width+x]-b[y*crop.width+x]);samples++;}
  costs.push(errorSum/samples);
 }
 const shift=costs.indexOf(Math.min(...costs));
 shifts.push({from_frame:firstFrame+frame,to_frame:firstFrame+frame+1,upward_shift_px:shift,mean_absolute_error:costs[shift],stationary_error:costs[0]});
}
if(shifts.some(s=>s.upward_shift_px<10||s.upward_shift_px>12||s.mean_absolute_error>s.stationary_error*.65))throw Error('Decoded source pixels show uneven or duplicated motion');
const motion={project_id:m.project_id,version:m.version,source_sha256:output.sha256,status:'passed',method:'Vertical pixel matching on sixteen actual decoded consecutive frames; source-English column only, no header or opening overlay.',crop,first_frame:firstFrame,frames:count,shifts,minimum_upward_shift_px:Math.min(...shifts.map(s=>s.upward_shift_px)),maximum_upward_shift_px:Math.max(...shifts.map(s=>s.upward_shift_px)),unique_frame_hashes:new Set(Array.from({length:count},(_,i)=>createHash('sha256').update(raw.subarray(i*bytesPerFrame,(i+1)*bytesPerFrame)).digest('hex'))).size};
if(motion.unique_frame_hashes!==count)throw Error('Duplicated encoded frame');
await saveJson(path.join(v.directory,'provenance/encoded-motion.json'),motion);

const storyboard=JSON.parse(await readFile(path.join(v.directory,m.data.storyboard),'utf8'));
const indices=[0,...storyboard.timeline.map(s=>Math.round((s.start+s.end)/2*fps)),...storyboard.timeline.slice(1).flatMap(s=>[-.09,0,.09].map(d=>Math.round((s.start+d)*fps))),Math.round((storyboard.intro_end-.6)*fps),Math.round((storyboard.intro_end-.3)*fps),Math.round(storyboard.intro_end*fps),20*fps,20*fps+1,32*fps,Math.round(storyboard.ending_panorama.start*fps)-1,Math.round(storyboard.ending_panorama.start*fps),Math.round(53.3*fps),54*fps,55*fps,56*fps,Math.round(storyboard.ending_panorama.zoom_end*fps),Math.round(56.75*fps),Math.round(storyboard.ending_panorama.hold_end*fps),Math.round(57.6*fps),m.settings.target_frames-1];
const frames=[...new Set(indices)].sort((a,b)=>a-b);
await mkdir(path.join(v.directory,'provenance/encoded-frames'),{recursive:true});
execFileSync('ffmpeg',['-v','error','-n','-i',video,'-vf',`select='${frames.map(n=>`eq(n,${n})`).join('+')}'`,'-fps_mode','passthrough',path.join(v.directory,'provenance/encoded-frames/frame-%02d.png')],{maxBuffer:1e7});
const images=[];
for(const [i,frame]of frames.entries()){const p='provenance/encoded-frames/frame-'+String(i+1).padStart(2,'0')+'.png';images.push({path:p,frame,seconds:frame/fps,sha256:createHash('sha256').update(await readFile(path.join(v.directory,p))).digest('hex')});}
await saveJson(path.join(v.directory,'provenance/encoded-frame-index.json'),{project_id:m.project_id,version:m.version,source_sha256:output.sha256,method:'Unmodified encoded MP4 frames extracted with ffmpeg',images});
console.log(JSON.stringify({status:'passed',fps,frames:timestamps.length,unique_motion_frames:motion.unique_frame_hashes,step_range:[motion.minimum_upward_shift_px,motion.maximum_upward_shift_px],encoded_stills:images.length}));
