import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {ROOT,readJson,parseOptions,inside,listProjects,loadProject,versionNames,loadVersion} from './project.mjs';
import {rendererFiles} from './renderer.mjs';
import {verifyOutputFile} from './media-retention.mjs';
const o=parseOptions(process.argv.slice(2)),digest=b=>createHash('sha256').update(b).digest('hex');let count=0,skipped=0;
if(o.project){const p=await loadProject(o.project);if(o.version)await loadVersion(o.project,o.version);}
let checkedVersions=0,removedOutputs=0;
const migration=await readJson(path.join(ROOT,'docs/migration-manifest-v001.json'));
for(const item of migration.files){if(o['source-only']&&/\.(mp4|m4a|wav)$/.test(item.path)){skipped++;continue;}const b=await readFile(inside(ROOT,item.path));if(b.subarray(0,100).toString().startsWith('version https://git-lfs.github.com/spec/v1'))throw Error(item.path+' is an LFS pointer: run git lfs pull');if(b.length!==item.size_bytes||digest(b)!==item.sha256)throw Error('Preserved input changed: '+item.path);count++;}
const ids=new Set();for(const slug of await listProjects()){const p=await loadProject(slug);if(ids.has(p.metadata.id))throw Error('Duplicate project ID');ids.add(p.metadata.id);for(const source of p.metadata.sources??[]){const file=inside(p.directory,source.path);if(!o['source-only']||!/\.(mp4|m4a|wav)$/.test(source.path)){if(digest(await readFile(file))!==source.sha256)throw Error('Registered source changed '+source.id);}}if(o.project&&o.project!==slug)continue;
 for(const version of await versionNames(p.directory)){if(o.version&&o.version!==version)continue;const v=await loadVersion(slug,version),m=v.manifest;
  checkedVersions++;
  if(!['draft','review','approved','superseded'].includes(m.status))throw Error('Invalid status '+slug+'/'+version);
  if(m.status==='approved'&&!m.review?.human_approval)throw Error('Approved versions require an explicit human approval record');
  if(m.naming_migration){
   const naming=await readJson(inside(v.directory,m.naming_migration));
   if(naming.project_id!==m.project_id||naming.to_version!==m.version||naming.to_parent_version!==m.parent_version)throw Error('Version rename lineage mismatch');
   for(const evidence of naming.preserved_files)if(digest(await readFile(inside(v.directory,evidence.path)))!==evidence.sha256)throw Error('Renamed version historical evidence changed: '+evidence.path);
   const previous=await readJson(inside(v.directory,naming.original_manifest));
   if(previous.version!==naming.from_version||previous.parent_version!==naming.from_parent_version)throw Error('Original rename identity mismatch');
   if(naming.outputs.length!==m.variants.length)throw Error('Renamed output count mismatch');
   for(const output of naming.outputs){
    const current=m.variants.find(x=>x.generation_id===output.generation_id),original=previous.variants.find(x=>x.generation_id===output.generation_id);
    if(!current?.output||current.output.path!==output.to_path||current.output.sha256!==output.sha256||original?.output?.path!==output.from_path||original.output.sha256!==output.sha256)throw Error('Renamed output identity mismatch');
   }
  }
  const code=await readFile(inside(v.directory,m.renderer.path));if(digest(code)!==m.renderer.sha256)throw Error('Renderer changed without an updated version record: '+slug+'/'+version);
  if(m.renderer.files&&JSON.stringify(await rendererFiles(v))!==JSON.stringify(m.renderer.files))throw Error('Renderer dependency changed: '+slug+'/'+version);
  if(Number.isFinite(m.settings.duration_seconds)){if(m.settings.duration_seconds<=0||m.settings.fps<=0||m.settings.target_frames!==Math.ceil(m.settings.duration_seconds*m.settings.fps))throw Error('Duration/FPS/frame count mismatch');}
  else if(m.status!=='draft')throw Error('Non-draft versions need an exact duration');
  for(const [key,file] of Object.entries(m.data??{})){const b=await readFile(inside(v.directory,file));if(!m.data_hashes?.[key]||digest(b)!==m.data_hashes[key])throw Error('Missing/changed version data hash: '+key);}
  if(m.data.audio_features){const f=await readJson(inside(v.directory,m.data.audio_features));if(f.fps!==m.settings.fps||f.frames.length!==m.settings.target_frames)throw Error('Audio features do not cover this version');}
  if(m.data.beat_analysis){const f=await readJson(inside(v.directory,m.data.beat_analysis));if(Math.abs(f.duration-m.settings.duration_seconds)>1/m.settings.fps||!Array.isArray(f.beats)||!Array.isArray(f.downbeats))throw Error('Beat analysis does not cover the source audio');}
  if(!m.variants?.length||m.status!=='draft'&&m.variants.some(x=>!x.output))throw Error('Delivered versions require nonempty variants and complete outputs');
  const variantIds=new Set();for(const variant of m.variants){if(!/^[a-z0-9-]+$/.test(variant.id)||variantIds.has(variant.id))throw Error('Variant identity mismatch');variantIds.add(variant.id);if(variant.output)inside(v.directory,variant.output.path);}
  for(const input of Object.values(m.inputs??{})){if(input.path&&input.path!=='TBD'){const source=(v.metadata.sources??[]).find(x=>x.id===input.source_id);if(!source||source.path!==input.path||source.sha256!==input.sha256)throw Error('Input source identity mismatch');}}
  const audio=m.inputs?.audio;if(audio?.path&&audio.path!=='TBD'){const file=inside(v.projectDirectory,audio.path);if(!o['source-only']&&digest(await readFile(file))!==audio.sha256)throw Error('Source audio changed');}
  for(const variant of m.variants){const output=variant.output;if(!output)continue;
   const {file,state}=await verifyOutputFile(v,variant,{sourceOnly:!!o['source-only'],requireMedia:!!o.probe});
   if(state==='removed-by-user'){removedOutputs++;continue;}
   if(o.probe){const p=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{maxBuffer:1e7}));const stream=p.streams.find(x=>x.codec_type==='video');if(!stream||stream.width!==m.settings.width||stream.height!==m.settings.height||stream.avg_frame_rate!==`${m.settings.fps}/1`||Number(stream.nb_read_frames)!==m.settings.target_frames)throw Error('Video specification mismatch '+variant.generation_id);
    const sourceAudio=inside(v.projectDirectory,audio.path),sp=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',sourceAudio],{maxBuffer:1e6})).streams.find(x=>x.codec_type==='audio');if(m.settings.target_frames!==Math.ceil(Number(sp.duration)*m.settings.fps)||Math.abs(Number(stream.duration)-Number(sp.duration))>=1/m.settings.fps)throw Error('Picture/source audio duration mismatch');
    const audioHash=f=>execFileSync('ffmpeg',['-v','error','-i',f,'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim();if(audioHash(file)!==audioHash(sourceAudio))throw Error('Audio changed '+variant.generation_id);
   }
  }
 }
}
if(!checkedVersions)throw Error('No versions matched the requested verification target');
console.log(`Verified ${count} preserved migration files, ${skipped} media files skipped, ${checkedVersions} versions checked; project/version lineage valid${o.probe?', video specs and source AAC packets verified':''}${removedOutputs?`; ${removedOutputs} output(s) intentionally removed by user, receipts verified, media not verified`:''}.`);
