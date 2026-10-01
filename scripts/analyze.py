"""Compute RMS/low/high features for any version's local WAV; never overwrite."""
import argparse,json,wave
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--input',required=True,type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--fps',type=int,default=24);a=p.parse_args()
if a.output.exists():raise SystemExit('Output already exists; choose a new versioned file')
if a.fps<=0:p.error('FPS must be positive')
with wave.open(str(a.input)) as f:
 if f.getsampwidth()!=2:p.error('Expected 16-bit PCM WAV')
 rate=f.getframerate();x=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,f.getnchannels()).mean(1)/32768
feats=[]
for i in range(int(np.ceil(len(x)/rate*a.fps))):
 segment=x[int(i*rate/a.fps):int((i+1)*rate/a.fps)];fft=np.abs(np.fft.rfft(segment*np.hanning(len(segment)),n=2048));freqs=np.fft.rfftfreq(2048,1/rate)
 feats.append([np.sqrt(np.mean(segment*segment)),np.sqrt(np.mean(fft[(freqs>35)&(freqs<220)]**2)),np.sqrt(np.mean(fft[(freqs>2000)&(freqs<9000)]**2))])
arr=np.array(feats)
for c in range(3):arr[:,c]=np.clip(arr[:,c]/max(1e-8,np.percentile(arr[:,c],95)),0,1.4)
a.output.parent.mkdir(parents=True,exist_ok=True)
with a.output.open('x') as f:json.dump({'fps':a.fps,'duration':len(x)/rate,'frames':np.round(arr,4).tolist()},f)
print(a.output)
