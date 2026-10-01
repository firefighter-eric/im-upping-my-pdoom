import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,copyFile,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {ROOT,parseOptions,loadVersion,inside,saveJson} from './project.mjs';
const o=parseOptions(process.argv.slice(2)),v=await loadVersion(o.project,o.version),m=v.manifest;
if(m.status!=='draft'||m.variants.some(x=>x.output))throw Error('Audio preparation requires a draft with no delivered outputs');
if(!m.audio_pipeline?.tool_directory)throw Error('Version has no declared audio pipeline');
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const input=m.inputs.wav,source=v.metadata.sources.find(x=>x.id===input?.source_id);
if(!source||source.path!==input.path||source.sha256!==input.sha256)throw Error('WAV source identity mismatch');
const audio=inside(v.projectDirectory,input.path);if(await hash(audio)!==input.sha256)throw Error('WAV source changed');
const lyrics=inside(v.directory,m.data.lyrics_source),toolDir=inside(v.directory,m.audio_pipeline.tool_directory);
const python=o.python??path.join(ROOT,'.venv/bin/python'),stage=o.stage??'all';
const leadModel=o['lead-model']??(m.audio_pipeline.lead_model?.startsWith('TBD')?null:m.audio_pipeline.lead_model);
if(!['all','separate','lead','emissions','whisper','vocal-features','align','features','qa'].includes(stage))throw Error('Unknown analysis stage');
const id='AUDIO_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+randomUUID().slice(0,8),work=path.join(ROOT,'.cache/audio',o.project,o.version,id);
await mkdir(work,{recursive:true});await mkdir(path.join(v.directory,'runs'),{recursive:true});
const receipt={id,project_id:m.project_id,version:m.version,purpose:'audio-analysis',stage,status:'preparing',started_at:new Date().toISOString(),input_sha256:input.sha256,lyrics_sha256:await hash(lyrics),tools:{},parameters:{device:o.device??'cpu',demucs_model:o['separation-model']??m.audio_pipeline.separation_model,lead_model:leadModel??null,stem_offset_seconds:0},steps:[],outputs:[]};
for(const file of (await readdir(toolDir)).filter(x=>x.endsWith('.py')).sort())receipt.tools[file]=await hash(path.join(toolDir,file));
receipt.packages=JSON.parse(execFileSync(python,['-c','import importlib.metadata as m,json; print(json.dumps({p:m.version(p) for p in ["demucs","torch","torchaudio","librosa","numpy","mlx-whisper","audio-separator"]}))'],{encoding:'utf8'}));
const record=path.join(v.directory,'runs',id+'.json'),lock=path.join(v.directory,'.audio.lock');let owned=false;
const env={...process.env,VIDEO_AUDIO_RUN:work,VIDEO_AUDIO_INPUT:audio,VIDEO_LYRICS_INPUT:lyrics,VIDEO_MODEL_CACHE:path.join(ROOT,'.cache/audio-models'),VIDEO_AUDIO_DEVICE:receipt.parameters.device,VIDEO_DEMUCS_MODEL:receipt.parameters.demucs_model};
if(leadModel)env.VIDEO_LEAD_MODEL=leadModel;
const run=async(name,args=[])=>{
 receipt.status='running';receipt.steps.push({name,status:'running',started_at:new Date().toISOString()});await saveJson(record,receipt);
 await new Promise((resolve,reject)=>{const child=spawn(python,[path.join(toolDir,name+'.py'),...args],{env,cwd:work,stdio:'inherit'});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${name} failed (${signal??code}); stopped without retry`)));});
 Object.assign(receipt.steps.at(-1),{status:'completed',finished_at:new Date().toISOString()});await saveJson(record,receipt);
};
try{
 await writeFile(lock,id,{flag:'wx'});owned=true;
 if(o.from){const prior=JSON.parse(await readFile(inside(v.directory,'runs/'+o.from+'.json'),'utf8'));if(prior.project_id!==m.project_id||prior.version!==m.version||prior.status!=='completed'||prior.input_sha256!==input.sha256)throw Error('Invalid prior analysis run');
  const previous=path.join(ROOT,'.cache/audio',o.project,o.version,o.from);const {cp}=await import('node:fs/promises');for(const dir of ['stems','work','karaoke']){try{await cp(path.join(previous,dir),path.join(work,dir),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}receipt.parent_run_id=o.from;
 }
 if(stage==='all'||stage==='separate')await run('separate');
 if(stage==='lead'||(stage==='all'&&leadModel))await run('lead');
 if(stage==='all'||stage==='emissions')await run('ctc_emissions',leadModel?['vocals','vocL','vocR','lead']:['vocals','vocL','vocR']);
 if(stage==='all'||stage==='whisper')await run('whisper_run',['turbo']);
 if(stage==='all'||stage==='vocal-features')await run('vocal_feats');
 if(stage==='all'||stage==='align')await run(leadModel?'align_lead':'align',['--plots']);
 if(stage==='all'||stage==='features')await run('analyze',['--plots']);
 if(stage==='qa')await run('qa_plot');
 const collect=async dir=>{for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await collect(file);else receipt.outputs.push({path:path.relative(ROOT,file),sha256:await hash(file)});}};await collect(work);
 if(stage==='all'){
  const audioDoc=JSON.parse(await readFile(path.join(work,'data/audio.json'),'utf8')),lyricDoc=JSON.parse(await readFile(path.join(work,'data/lyrics.json'),'utf8'));
  if(Math.abs(audioDoc.duration-m.settings.duration_seconds)>1/m.settings.fps||!lyricDoc.lines?.length)throw Error('Analysis duration/lyrics do not match version');
  for(const [key,name] of [['beat_analysis','audio'],['lyrics','lyrics']]){const destination=`data/${name}-${id}.json`;await copyFile(path.join(work,'data',name+'.json'),inside(v.directory,destination));m.data[key]=destination;m.data_hashes[key]=await hash(inside(v.directory,destination));}
  m.analysis={run_id:id,status:'completed',human_review:'pending',stem_offset_seconds:0};await saveJson(path.join(v.directory,'manifest.json'),m);
 }
 receipt.status='completed';receipt.finished_at=new Date().toISOString();await saveJson(record,receipt);console.log('Audio analysis completed:',id);
}catch(error){receipt.status='failed';receipt.error=error.message;receipt.finished_at=new Date().toISOString();if(receipt.steps.at(-1)?.status==='running')receipt.steps.at(-1).status='failed';await saveJson(record,receipt);throw error;}
finally{if(owned)await unlink(lock);}
