from pathlib import Path
import json, subprocess, hashlib, datetime
import numpy as np
import librosa

HERE=Path(__file__).resolve().parents[1]
PROJECT=HERE.parents[1]
SOURCE=PROJECT/'sources/audio/LLMV_002_audio_original_v001.m4a'
OUT=HERE/'data/beat-analysis.json'
if OUT.exists():raise SystemExit('Analysis already exists; never overwrite')
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()=='45383f70955fb4b416ffb07687f4c4247865dbc54eaa2b1bcdc89c8e28192c99'
SR=22050;HOP=256
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(SOURCE),'-map','0:a:0','-ac','1','-ar',str(SR),'-f','f32le','-'])
y=np.frombuffer(raw,dtype='<f4').copy()
tempo,frames=librosa.beat.beat_track(y=y,sr=SR,hop_length=HOP,trim=False)
beats=librosa.frames_to_time(frames,sr=SR,hop_length=HOP)
onsets=librosa.onset.onset_detect(y=y,sr=SR,hop_length=HOP,units='time')
rms=librosa.feature.rms(y=y,frame_length=2048,hop_length=HOP)[0]
rms=np.clip(rms/max(1e-9,float(np.percentile(rms,95))),0,1.4)
data={'project_id':'LLMV_002','duration':306.480181,'decoded_analysis_duration':len(y)/SR,
 'bpm':float(np.asarray(tempo).flat[0]),'beats':[round(float(b),4) for b in beats if b<306.480181],
 'downbeats':[],'downbeat_status':'not inferred from beat index; not used by this companion layout',
 'onsets':[round(float(t),4) for t in onsets if t<306.480181],
 'rms':np.round(rms,4).tolist(),'rms_hop_seconds':HOP/SR,
 'timing_status':'machine beat/onset candidates; perceptual musical review pending',
 'clock':{'analysis_to_audio_offset_seconds':0,'audio_to_video_offset_seconds':0,'basis':'decode registered AAC from its beginning; output copies this AAC; source video PTS preserved by direct FFmpeg input'},
 'source_audio_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'tools':{'numpy':np.__version__,'librosa':librosa.__version__,'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0]},
 'parameters':{'sr':SR,'hop_length':HOP,'beat_trim':False,'channels':1,'analysis_only':True},
 'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'bpm':data['bpm'],'beats':len(data['beats']),'onsets':len(data['onsets']),'path':str(OUT)}))
