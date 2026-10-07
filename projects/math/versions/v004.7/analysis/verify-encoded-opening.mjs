import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadVersion,saveJson} from '../../../../../scripts/project.mjs';

const v=await loadVersion('math','v004.7'),m=v.manifest,out=m.variants[0].output;
if(m.status!=='review'||!out)throw Error('Registered video required');
const video=path.join(v.directory,out.path),fps=m.settings.fps;
// Stable old title, old-left halfway exit, new-right halfway entry, stable new title.
const seconds=[13.2,13.35,13.65,13.8],frames=seconds.map(t=>Math.round(t*fps));
const filter=`select='${frames.map(n=>`eq(n,${n})`).join('+')}'`;
const raw=execFileSync('ffmpeg',['-v','error','-i',video,'-vf',filter+',format=gray','-fps_mode','passthrough','-frames:v','4','-f','rawvideo','-'],{maxBuffer:1e7});
const width=1920,height=1080,frameBytes=width*height;
if(raw.length!==frameBytes*4)throw Error('Opening decoded samples missing');
function mask(image,roi,threshold){
 const [x,y,w,h]=roi,points=new Uint8Array(w*h);let n=0,left=w,right=-1,top=h,bottom=-1;
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(image[(y+yy)*width+x+xx]<threshold){points[yy*w+xx]=1;n++;left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy);}
 if(n<1000)throw Error('Insufficient foreground title/year pixels');
 return {points,count:n,bounds:[x+left,y+top,x+right,y+bottom]};
}
const titleRoi=[40,620,1350,103],yearRoi=[90,280,890,245];
const samples=frames.map((frame,i)=>{const image=raw.subarray(i*frameBytes,(i+1)*frameBytes);return {frame,seconds:frame/fps,title:mask(image,titleRoi,144),year:mask(image,yearRoi,70)};});
const oldShift=samples[1].title.bounds[0]-samples[0].title.bounds[0],newShift=samples[3].title.bounds[0]-samples[2].title.bounds[0];
if(oldShift>-15||oldShift<-35||newShift>-15||newShift<-35)throw Error('Encoded text does not move left through exit and entry');
const similarities=samples.slice(1).map(s=>{let intersection=0,union=0;for(let i=0;i<s.year.points.length;i++){intersection+=s.year.points[i]&samples[0].year.points[i];union+=s.year.points[i]|samples[0].year.points[i];}return intersection/union;});
if(Math.min(...similarities)<.98||samples.some(s=>s.year.bounds.some((x,i)=>Math.abs(x-samples[0].year.bounds[i])>1)))throw Error('Encoded 2026 year moved during its internal exchange');
await mkdir(path.join(v.directory,'provenance/encoded-opening-frames'),{recursive:true});
execFileSync('ffmpeg',['-v','error','-n','-i',video,'-vf',filter,'-fps_mode','passthrough',path.join(v.directory,'provenance/encoded-opening-frames/frame-%02d.png')],{maxBuffer:1e7});
const images=[];for(let i=0;i<4;i++){const relative='provenance/encoded-opening-frames/frame-'+String(i+1).padStart(2,'0')+'.png';images.push({path:relative,frame:frames[i],seconds:seconds[i],sha256:createHash('sha256').update(await readFile(path.join(v.directory,relative))).digest('hex')});}
await saveJson(path.join(v.directory,'provenance/encoded-opening.json'),{project_id:m.project_id,version:m.version,output_sha256:out.sha256,recorded_at:new Date().toISOString(),status:'passed',scope:'Four unmodified decoded frames around the Mythos-to-Astra exchange: independent foreground bounds measure leftward old-title exit/new-title entry; opaque 2026 glyph masks remain fixed. Complete 24s timing states and settled reading windows are separately recorded in opening-transition-preflight. Human pacing/music perception pending.',title_roi:titleRoi,title_gray_threshold:144,year_roi:yearRoi,year_gray_threshold:70,samples:samples.map(s=>({frame:s.frame,seconds:s.seconds,title_bounds:s.title.bounds,title_pixels:s.title.count,year_bounds:s.year.bounds,year_pixels:s.year.count})),old_title_exit_shift_px:oldShift,new_title_entry_shift_px:newShift,year_mask_jaccard:similarities,images,human_approval:'pending'});
console.log(JSON.stringify({status:'passed',old_exit_dx:oldShift,new_entry_dx:newShift,minimum_fixed_year_mask_match:Math.min(...similarities)}));
