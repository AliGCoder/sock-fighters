"""AI-composed trailer score with ACE-Step 1.5 (MIT licence, runs locally): three instrumental takes as long as the
trailer, then the one whose loudness best follows the trailer's story (quiet cold open, big fights and supers, a
calmer story part, the biggest finish) is copied to out/ace_score.wav.
Run with ACE-Step's own Python:  ACE-Step-1.5/.venv/Scripts/python.exe ace_score.py"""
import glob, json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ACE = os.path.join(HERE, 'ACE-Step-1.5')
OUT = os.path.join(HERE, 'out')
sys.path.insert(0, ACE)
os.chdir(ACE)
import numpy as np, soundfile as sf
from acestep.model_downloader import ensure_main_model, ensure_lm_model
from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

marks = json.load(open(os.path.join(OUT, 'timeline.json')))
END = [m for m in marks if m['end']][0]['at']
LEN = round(END + 7.0)
CKPT = os.path.join(ACE, 'checkpoints')
print('models:', ensure_main_model(), flush=True)
print('lm:', ensure_lm_model('acestep-5Hz-lm-0.6B'), flush=True)
dit = AceStepHandler()
msg, ok = dit.initialize_service(project_root=ACE, config_path='acestep-v15-turbo', device='cuda', offload_to_cpu=False)
print('dit', ok, msg, flush=True)
llm = LLMHandler()
msg, ok = llm.initialize(checkpoint_dir=CKPT, lm_model_path='acestep-5Hz-lm-0.6B', backend='pt', device='cuda', offload_to_cpu=False, dtype=None)
print('lm', ok, msg, flush=True)

CAPTION = ('epic cinematic hybrid orchestral trailer music, instrumental, huge brass braams, thundering taiko drums, '
           'driving staccato string ostinato, heroic choir, rising tension and risers, a quiet mysterious intro with '
           'low piano, dark tension, a heroic theme, explosive drop, relentless action build, then a massive heroic '
           'finale, blockbuster video game trailer, D minor')
takes = []
for seed in (11, 23, 37):
    params = GenerationParams(caption=CAPTION, lyrics='[Instrumental]', instrumental=True, duration=LEN, bpm=128,
                              seed=seed, inference_steps=8, shift=3.0)
    cfg = GenerationConfig(batch_size=1, use_random_seed=False, audio_format='wav')
    save = os.path.join(OUT, f'ace_take_{seed}')
    os.makedirs(save, exist_ok=True)
    r = generate_music(dit, llm, params, cfg, save_dir=save)
    if not r.success:
        print('take failed', seed, r.error, flush=True)
        continue
    path = r.audios[0]['path']
    takes.append((seed, path))
    print('take', seed, path, flush=True)

# which take follows the trailer best: compare its loudness (per second) with the shape the trailer wants
cards = {m['card']: m['at'] for m in marks if m['card']}
want = np.zeros(LEN)
for s in range(LEN):
    if s < cards['A SHINOBI APPEARS.']: want[s] = 0.25
    elif s < cards['FIND HIS OTHER HALF.']: want[s] = 0.45
    elif s < cards['FIGHT.']: want[s] = 0.55
    elif s < cards['UNLEASH YOUR SUPER.']: want[s] = 0.75
    elif s < cards['PLAY YOUR WAY.']: want[s] = 0.9
    elif s < cards['TOGETHER.']: want[s] = 0.7
    else: want[s] = 1.0
best = None
for seed, path in takes:
    y, sr = sf.read(path)
    y = y.mean(1) if y.ndim > 1 else y
    loud = np.array([np.sqrt(np.mean(y[int(s * sr):int((s + 1) * sr)] ** 2) + 1e-9) for s in range(min(LEN, len(y) // sr))])
    loud = loud / (loud.max() + 1e-9)
    score = np.corrcoef(loud, want[:len(loud)])[0, 1]
    print(f'take {seed}: follows the trailer {score:.2f}', flush=True)
    if best is None or score > best[0]:
        best = (score, seed, path)
shutil.copy(best[2], os.path.join(OUT, 'ace_score.wav'))
print('picked take', best[1], flush=True)
