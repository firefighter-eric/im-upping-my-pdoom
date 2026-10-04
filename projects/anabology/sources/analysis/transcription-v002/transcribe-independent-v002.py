"""Independent-window MLX Whisper crosscheck for the local reference audio."""
import argparse,json
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--input',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--model',required=True)
args=parser.parse_args()
if args.output.exists():raise SystemExit('Refusing to overwrite a transcript')
import mlx_whisper
result=mlx_whisper.transcribe(str(args.input),path_or_hf_repo=args.model,language='en',temperature=(0.0,0.2,0.4,0.6,0.8,1.0),compression_ratio_threshold=2.4,condition_on_previous_text=False,word_timestamps=True,verbose=False,initial_prompt='AGI, CGI, CSI Miami, Jensen, Waymo, Presidio, Hugging Face, longevity escape velocity, Sora, Stargate, force majeure, Slopacolypse.')
with args.output.open('x') as stream:json.dump(result,stream,ensure_ascii=False,indent=2);stream.write('\n')
print(args.output)
