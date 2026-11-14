"""Trial: the same story lines with VoxCPM2 (Apache-2.0), cloning each character's existing voice and adding a
delivery note per line. Writes samples/TRIAL_vox.wav (and TRIAL_qwen.wav from what qwen_story.py already recorded).
Usage: ../announcer/.venv-vox/Scripts/python.exe vox_trial.py"""
import base64, io, json, os, sys, time
import numpy as np, soundfile as sf
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ANN = os.path.join(HERE, '..', 'announcer')
from voxcpm import VoxCPM

LINES = [  # (voice, delivery note, words)
    ('narr', 'warm, playful storybook narrator, building suspense', 'The coin laundry. Midnight. Somewhere, a sock is about to go missing...'),
    ('queen', 'grand, posh, haughty queen making a royal proclamation', 'Greetings, single-leggers. We are Queen Nylonia, ruler of the Hosiery and of the beautiful Island of Nylonia.'),
    ('baby', 'toddler bawling and sobbing loudly', "Waaaah! I was blue! I was so blue! Now I'm... sniff... eggshell!"),
    ('lint', 'tiny squeaky creature, sniffly and sad', 'Sniff, sniff... Nobody ever says bless you.'),
    ('demon', 'furious demon lord roaring, then cracking with sadness', 'I am not sad! I am furious! And also a little bit sad! Look into my spiral and fight me!'),
    ('gran', 'very old grandmother, dry and unimpressed', 'I took the stairs.'),
    ('cling', 'sultry, smug villainess, drawling', "There's only room for one queen, sweetie. And she's wearing last season's sheen."),
    ('stinky', 'cocky young brawler, outraged', "I'm a sock! I'm supposed to be wrinkly!"),
]


def ref_for(v):
    if v in ('queen', 'fishnet', 'narr'):
        return os.path.join(HERE, 'refs', f'story_{v}.wav')
    return os.path.join(ANN, 'refs', f'fighter_{v}.wav')


model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
sr = model.tts_model.sample_rate
reel, total_audio, total_time = [], 0.0, 0.0
for v, note, words in LINES:
    t0 = time.time()
    y = model.generate(text=f'({note}){words}', reference_wav_path=ref_for(v), cfg_value=2.0, inference_timesteps=10)
    dt = time.time() - t0
    total_audio += len(y) / sr
    total_time += dt
    reel += [np.asarray(y, dtype=np.float32) * 0.89, np.zeros(int(sr * 0.6), dtype=np.float32)]
    print(f'{v:7s} {len(y) / sr:4.1f}s audio in {dt:4.1f}s  {words[:60]}', flush=True)
sf.write(os.path.join(HERE, 'samples', 'TRIAL_vox.wav'), np.concatenate(reel), sr)
print(f'speed: {total_time / total_audio:.2f} s of work per s of audio', flush=True)
