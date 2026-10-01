"""Optional local MLX Whisper transcription for any audio/version."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--input',required=True,type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--model',default='mlx-community/whisper-large-v3-turbo-q4');p.add_argument('--language',default='en');p.add_argument('--initial-prompt');a=p.parse_args()
if a.output.exists():raise SystemExit('Output already exists; choose a new versioned file')
try:import mlx_whisper
except ImportError:raise SystemExit('Optional macOS Apple Silicon dependency: pip install mlx-whisper')
result=mlx_whisper.transcribe(str(a.input),path_or_hf_repo=a.model,language=a.language,temperature=0,word_timestamps=True,verbose=False,initial_prompt=a.initial_prompt)
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x') as f:json.dump(result,f,ensure_ascii=False,indent=2)
print(a.output)
