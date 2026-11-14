"""A quick listen: a few of Queen Nylonia's lines in her chosen voice, with their delivery notes (no game files touched)."""
import json, os, sys
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from voxcpm import VoxCPM
HERE = os.path.dirname(os.path.abspath(__file__))
jobs = [j for j in json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8')) if j['voice'] == 'queen']
pick = [jobs[i] for i in (2, 5, 6, 10)]
model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
sr = model.tts_model.sample_rate
reel = []
for j in pick:
    torch.manual_seed(77)
    y = model.generate(text=f"({j['note']}){j['say']}", reference_wav_path=os.path.join(HERE, 'refs', 'queen_option_2.wav'),
                       cfg_value=2.0, inference_timesteps=10)
    reel += [np.asarray(y, dtype=np.float32) * 0.89, np.zeros(int(sr * 0.7), dtype=np.float32)]
    print(j['note'].split('sass, ')[-1], '|', j['say'], flush=True)
sf.write(os.path.join(HERE, 'samples', 'QUEEN_sassy_preview.wav'), np.concatenate(reel), sr)
