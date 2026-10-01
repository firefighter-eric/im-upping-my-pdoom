import json
from pathlib import Path
import mlx_whisper
root=Path(__file__).resolve().parent
result=mlx_whisper.transcribe(str(root.parents[1]/'audio/LLMV_001_audio_pcm_v001.wav'),path_or_hf_repo='/Users/eric/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo-q4/snapshots/660c343bbf4e52ac257f0b7d952e5388e6f93bef',language='en',temperature=0,word_timestamps=True,verbose=False,initial_prompt='AGI, p(doom), shoggoth, Ilya, paperclips, spacetime')
(root/'transcript-asr-v001.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('Transcribed',len(result['segments']),'segments')
