import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from '../../../../../apps/story-studio/node_modules/yaml/dist/index.js';
const root=path.dirname(fileURLToPath(import.meta.url)),assetRoot=path.resolve(root,'../..');
const hash=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
const probe=f=>JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',f],{maxBuffer:1e7}));
const audioHash=f=>execFileSync('ffmpeg',['-v','error','-i',f,'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim();
const audio=path.join(assetRoot,'audio/LLMV_001_audio_original_v001.m4a'),expectedAudio=audioHash(audio);
const descriptors=[];
for(const [index,kind,label,description] of [
 ['001','abstract','科幻抽象版','信号球体、数据隧道、波场与事件视界，随原音轨变化。'],
 ['002','narrative','AGI 觉醒叙事版','从实验室启动到网络扩张、失控与余波的八段几何动画。'],
 ['003','lyrics','歌词视觉版','保留原英文歌词，逐词高亮与副歌强调，完整保留尾奏。']]){
 const relative=`generations/LLMV_001_MV_${index}_${kind}_1080p24_v001.mp4`,file=path.join(assetRoot,relative);
 const p=probe(file),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
 if(!v||!a||v.width!==1920||v.height!==1080||v.avg_frame_rate!=='24/1'||Number(v.nb_read_frames)!==3760)throw new Error('Invalid media '+file);
 const currentAudio=audioHash(file);if(currentAudio!==expectedAudio)throw new Error('Audio was changed '+file);
 execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
 const poster=`analysis/LLMV_001_MV_${index}_poster_v001.jpg`;
 execFileSync('ffmpeg',['-v','error','-n','-ss',kind==='abstract'?'46':kind==='narrative'?'27':'64','-i',file,'-frames:v','1','-q:v','2',path.join(assetRoot,poster)]);
 await writeFile(path.join(root,`mv-${index}-ffprobe-v001.json`),JSON.stringify(p,null,2)+'\n');
 descriptors.push({id:`LLMV_001_MV_${index}`,label,path:relative,version:'v001',status:'review',description,poster,sha256:await hash(file),size_bytes:Number(p.format.size),duration_seconds:Number(v.duration),codec:v.codec_name,width:v.width,height:v.height,frame_rate:v.avg_frame_rate,frame_count:Number(v.nb_read_frames),audio_source_id:'LLMV_001_AUDIO_001',audio_packet_hash:currentAudio,generation_date:'2026-10-01',rights_status:'TBD',model:'Codex (GPT-6) code-authored Canvas 2D; no video diffusion model',production_record:'production/mv-v001/delivery-v001.json',known_issues:kind==='lyrics'?['歌词逐词时间来自来源项目，个别发音与高亮需人工审看']:[]});
 console.log('Verified',index,v.nb_read_frames,'frames / audio unchanged');
}
const assetFile=path.join(assetRoot,'asset.yaml'),metadata=YAML.parse(await readFile(assetFile,'utf8'));metadata.generations=[...(metadata.generations??[]),...descriptors];
await writeFile(assetFile,YAML.stringify(metadata,{lineWidth:120}));
const sourceFiles=['renderer.html','render.mjs','analyze.py','audio-features-v001.json','transcribe.py','transcript-asr-v001.json','reference-lyric-timing-v001.json','lyric-alignment-check-v001.json'];
const sourceHashes={};for(let file of sourceFiles)sourceHashes[file]=await hash(path.join(root,file));
const delivery={id:'LLMV_001_MV_DELIVERY_001',version:'v001',status:'review',date:'2026-10-01',timezone:'Asia/Shanghai',user_requests:['根据AGI视频拿出来的音频，制作一个MV视频','3个版本都做'],model:'Codex (GPT-6)',method:'Original deterministic Canvas 2D animation -> Chrome JPEG frames -> ffmpeg H.264; source AAC stream-copy',seed_policy:'Deterministic procedural hash function; no random model sampling',tools:{ffmpeg:execFileSync('ffmpeg',['-version'],{encoding:'utf8'}).split('\n')[0],node:process.version},inputs:{audio_id:'LLMV_001_AUDIO_001',audio_sha256:await hash(audio),wav_sha256:await hash(path.join(assetRoot,'audio/LLMV_001_audio_pcm_v001.wav')),reference_lyric_timing_url:'https://raw.githubusercontent.com/mexicat/pdoom-video/main/data/lyrics.json'},source_hashes:sourceHashes,outputs:descriptors,rights:{visuals:'Original code authored for this request',audio_and_lyrics:'TBD, inherited from LLMV_001'},validation:{full_decode:'passed',frame_count:3760,cfr:'24/1',audio_packet_copy:'identical for all three',story_studio:'pending'}};
await writeFile(path.join(root,'delivery-v001.json'),JSON.stringify(delivery,null,2)+'\n');
