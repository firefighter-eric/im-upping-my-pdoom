import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';

const v=await loadVersion('math','v004.7'),m=v.manifest,output=m.variants[0].output;
if(!output||m.status!=='review')throw Error('Registered output required');
const width=m.settings.width,height=m.settings.height,frames=[3405,3456,3479],frameBytes=width*height*3;
const raw=execFileSync('ffmpeg',['-v','error','-i',path.join(v.directory,output.path),'-vf',`select='${frames.map(n=>`eq(n,${n})`).join('+')}',format=rgb24`,'-fps_mode','passthrough','-frames:v','3','-f','rawvideo','-'],{maxBuffer:2e7});
if(raw.length!==3*frameBytes)throw Error('Encoded ending frame count mismatch');
const samples=frames.map((frame,index)=>{
 const pixels=raw.subarray(index*frameBytes,(index+1)*frameBytes);
 let energy=0,maxDeviation=0,minX=width,minY=height,maxX=-1,maxY=-1,nonWhite=0,leftStatistic=0,rightStatistic=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*3,gray=(pixels[i]+pixels[i+1]+pixels[i+2])/3,deviation=255-gray;
  energy+=deviation;maxDeviation=Math.max(maxDeviation,deviation);
  if(gray<245){
   nonWhite++;
   if(x>=920&&x<=1000){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   if(y>=400&&y<=660&&x>=280&&x<=840)leftStatistic++;
   if(y>=400&&y<=660&&x>=1080&&x<=1640)rightStatistic++;
  }
 }
 return {frame,seconds:frame/m.settings.fps,mean_white_deviation:energy/(width*height),maximum_white_deviation:maxDeviation,nonwhite_pixels_below_245:nonWhite,nonwhite_bounds:maxX>=0?[minX,minY,maxX,maxY]:null,statistics_nonwhite_pixels:{left:leftStatistic,right:rightStatistic}};
});
const pre=JSON.parse(await readFile(path.join(v.directory,'provenance/panorama-preflight.json'),'utf8'));
const x=(width-pre.overview_width_px)/2,b=samples[0].nonwhite_bounds;
if(!b||b[0]<x-24||b[2]>x+pre.overview_width_px+24||b[1]<36||b[3]>1044||b[3]-b[1]<900)throw Error('Encoded full-page overview bounds do not match the native-aspect panorama');
if(samples[0].statistics_nonwhite_pixels.left<3000||samples[0].statistics_nonwhite_pixels.right<3000)throw Error('Encoded closing statements are missing');
if(samples[1].mean_white_deviation>=samples[0].mean_white_deviation*.75)throw Error('Encoded ending did not fade');
if(samples[2].maximum_white_deviation>5||samples[2].mean_white_deviation>samples[0].mean_white_deviation*.01+.001)throw Error('Encoded final frame is not white');
await saveJson(path.join(v.directory,'provenance/encoded-panorama.json'),{project_id:m.project_id,version:m.version,output_sha256:output.sha256,recorded_at:new Date().toISOString(),status:'passed',method:'Independent RGB analysis of three decoded MP4 frames: centered full-height overview in the original-page strip, both flanking numeric statements, partial fade contrast reduction and white last frame.',expected_overview_bounds:[x,60,x+pre.overview_width_px,1020],samples,human_approval:'pending'});
console.log(JSON.stringify({status:'passed',overview_bounds:b,fade_energy_ratio:samples[1].mean_white_deviation/samples[0].mean_white_deviation,last_frame_rgb_error:samples[2].maximum_white_deviation}));
