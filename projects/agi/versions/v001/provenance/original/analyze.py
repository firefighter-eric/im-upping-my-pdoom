import wave,json,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parent
with wave.open(str(root.parents[1]/'audio/LLMV_001_audio_pcm_v001.wav')) as f:
 rate=f.getframerate(); x=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,f.getnchannels()).mean(1)/32768
fps=24; n=int(np.ceil(len(x)/rate*fps)); feats=[]
for i in range(n):
 a=x[int(i*rate/fps):int((i+1)*rate/fps)]; fft=np.abs(np.fft.rfft(a*np.hanning(len(a)),n=2048)); freqs=np.fft.rfftfreq(2048,1/rate)
 feats.append([np.sqrt(np.mean(a*a)),np.sqrt(np.mean(fft[(freqs>35)&(freqs<220)]**2)),np.sqrt(np.mean(fft[(freqs>2000)&(freqs<9000)]**2))])
a=np.array(feats)
for c in range(3): a[:,c]=np.clip(a[:,c]/np.percentile(a[:,c],95),0,1.4)
(root/'audio-features-v001.json').write_text(json.dumps({'fps':fps,'duration':len(x)/rate,'frames':np.round(a,4).tolist()}))
print(n,len(x)/rate)
