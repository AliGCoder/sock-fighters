"""Toe-Shinobi's FIGHT voice: voice B (his mysterious voice) but sharp, edgy and in a hurry. VoxCPM2 clones voice B
and follows a delivery note; makes two candidates, tools/announcer/refs/shinobi_edge_<1|2>.wav."""
import os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from voxcpm import VoxCPM
HERE = os.path.dirname(os.path.abspath(__file__))
ANN = os.path.join(HERE, '..', 'announcer')
B = os.path.join(ANN, 'refs', 'shinobi_male_B.wav')
TEXT = 'はっ!遅い!そこだ!影分身の術!'
NOTES = {'1': 'a young man in his twenties, a ninja mid-fight: fast, sharp, edgy, clipped battle shouts, urgent and in a hurry, breathless',
         '2': 'a young man in his twenties, a ninja striking at full speed: very quick, intense, edgy and impatient, rapid sharp shouts, rushing'}
model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
sr = model.tts_model.sample_rate
for tag, note in NOTES.items():
    torch.manual_seed(zlib.crc32(f'edge|{tag}'.encode()))
    y = model.generate(text=f'({note}){TEXT}', reference_wav_path=B, cfg_value=2.0, inference_timesteps=10)
    sf.write(os.path.join(ANN, 'refs', f'shinobi_edge_{tag}.wav'), np.asarray(y, dtype=np.float32), sr)
    print(f'edge {tag}: {len(y) / sr:.1f}s', flush=True)
