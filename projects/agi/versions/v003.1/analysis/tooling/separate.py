"""Separate this exact WAV decode; preserve time zero and use no random shifts."""
import common
import os
import numpy as np
import soundfile as sf
import torch
from demucs.api import Separator

device = os.environ.get('VIDEO_AUDIO_DEVICE', 'cpu')
model = os.environ.get('VIDEO_DEMUCS_MODEL', 'htdemucs_ft')
sep = Separator(model=model, device=device, shifts=0, progress=True)
origin, stems = sep.separate_audio_file(common.AUDIO)
common.STEMS.mkdir(parents=True, exist_ok=False)
for name, audio in stems.items():
    sf.write(common.STEMS / (name+'.wav'), audio.cpu().numpy().T, sep.samplerate, subtype='FLOAT')
    print(name, audio.shape, sep.samplerate, flush=True)
vocal, sr = common.load_stem('vocals', sr=16000)
sf.write(common.WORK / 'vocals16k.wav', vocal, sr, subtype='PCM_16')

