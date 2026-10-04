from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys,os,importlib.metadata as metadata
root=Path(__file__).resolve().parents[5]
project=root/'projects/anabology'
folder=Path(__file__).resolve().parent
audio=project/'sources/audio/LLMV_002_audio_original_v001.m4a'
output=folder/'transcript-drop-asr-v003.json'
if output.exists():raise SystemExit('Refusing to overwrite a transcript')
model_root=Path.home()/'.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo-q4'
revision=(model_root/'refs/main').read_text().strip()
model=model_root/'snapshots'/revision
def sha(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
run_id='ASR_'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
record_file=project/('sources/provenance/'+run_id+'.json')
parameters={'language':'en','temperature':[0.0,0.2,0.4,0.6,0.8,1.0],'compression_ratio_threshold':2.4,'condition_on_previous_text':False,'word_timestamps':True,'clip_timestamps':[216.0,253.0],'initial_prompt':'AGI, data center, Lean proofs, phages, enzymes, kidneys, Sora, Stargate, force majeure, Slopacolypse.'}
record={'schema_version':1,'run_id':run_id,'project_id':'LLMV_002','source_id':'LLMV_002_AUDIO_001','source_version':'v001','analysis_version':'v003','purpose':'supplement_missing_dense_vocals','status':'running','started_at':datetime.now(timezone.utc).isoformat(),'input':{'path':'sources/audio/LLMV_002_audio_original_v001.m4a','sha256':sha(audio)},'parent_analysis':'v002','model':{'name':'mlx-community/whisper-large-v3-turbo-q4','revision':revision},'tool':{'path':'sources/analysis/transcription-v003/transcribe-drop-v003.py','sha256':sha(Path(__file__)),'packages':{name:metadata.version(name) for name in ['mlx-whisper','mlx','numpy']}},'parameters':parameters,'output':{'path':'sources/analysis/transcription-v003/transcript-drop-asr-v003.json'},'review_status':'machine','human_approval':None}
with record_file.open('x') as stream:json.dump(record,stream,ensure_ascii=False,indent=2);stream.write('\n')
print(json.dumps({'run_id':run_id,'status':'running','clip':[216,253]}),flush=True)
try:
    os.environ['HF_HUB_OFFLINE']='1'
    import mlx_whisper
    result=mlx_whisper.transcribe(str(audio),path_or_hf_repo=str(model),verbose=False,**parameters)
    with output.open('x') as stream:json.dump(result,stream,ensure_ascii=False,indent=2);stream.write('\n')
    record['status']='completed';record['output'].update(sha256=sha(output),size_bytes=output.stat().st_size)
except Exception as error:
    record['status']='failed';record['error']=str(error);raise
finally:
    record['finished_at']=datetime.now(timezone.utc).isoformat()
    with record_file.open('w') as stream:json.dump(record,stream,ensure_ascii=False,indent=2);stream.write('\n')
print(json.dumps({'run_id':run_id,'status':record['status']}),flush=True)
