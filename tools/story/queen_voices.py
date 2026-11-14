"""Three ORIGINAL voice options for Queen Nylonia (designed from written descriptions with VoxCPM2, nobody real).
Each option: refs/queen_option_<n>.wav (its reference line) + samples/QUEEN_option_<n>.wav (two story lines).
Usage: ../announcer/.venv-vox/Scripts/python.exe queen_voices.py"""
import os, sys
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from voxcpm import VoxCPM

HERE = os.path.dirname(os.path.abspath(__file__))
OPTIONS = [
    'A beautiful, elegant Japanese woman in her late twenties: soft, silky, very feminine voice, warm and graceful, '
    'a gentle smile in her voice, a refined lady',
    'A glamorous, mature Japanese queen in her thirties: smooth, rich, velvety and feminine, poised and classy, '
    'slightly sultry and confident',
    'A bright, charming Japanese noblewoman in her twenties: clear, sweet, lilting feminine voice, '
    'graceful and lovely, with impeccable manners',
]
REF_LINE = 'ごきげんよう。わたくしどもはナイロニア女王。どうぞ、お見知りおきくださいませ。'
TRY = [
    ('calm, measured and gracious', 'よくお聞きなさいませ。一度しか申しませんわ。…お察しの悪い方には、二度。'),
    ('gently tearful, still graceful', '泣きすぎて…わたくしどものストッキングが、伝線してしまいましたわ。'),
]
model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
sr = model.tts_model.sample_rate
for n, desc in enumerate(OPTIONS, 1):
    torch.manual_seed(500 + n)
    ref = np.asarray(model.generate(text=f'({desc}){REF_LINE}', cfg_value=2.0, inference_timesteps=10), dtype=np.float32)
    ref_path = os.path.join(HERE, 'refs', f'queen_option_{n}.wav')
    sf.write(ref_path, ref, sr)
    reel = [ref * 0.89, np.zeros(int(sr * 0.7), dtype=np.float32)]
    for mood, line in TRY:
        torch.manual_seed(600 + n)
        y = model.generate(text=f'(elegant, feminine queen, {mood}){line}', reference_wav_path=ref_path,
                           cfg_value=2.0, inference_timesteps=10)
        reel += [np.asarray(y, dtype=np.float32) * 0.89, np.zeros(int(sr * 0.7), dtype=np.float32)]
    sf.write(os.path.join(HERE, 'samples', f'QUEEN_option_{n}.wav'), np.concatenate(reel), sr)
    print(f'option {n} done', flush=True)
