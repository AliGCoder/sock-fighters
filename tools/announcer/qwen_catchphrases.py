"""Each playable character's signature catchphrase (original lines), spoken in their own designed voice
(same reference + effects as qwen_fighters.py). Stored as the word 'catchphrase' in fighter_clips.json.
Usage: .venv-qwen/Scripts/python.exe qwen_catchphrases.py [id ...]   then   node inject.js fighter"""
import base64, json, os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF

HERE = os.path.dirname(os.path.abspath(__file__))
# keep in sync with CATCHPHRASES in index.html (the on-screen bubble text)
CATCHPHRASES = {
    'stinky': 'においで勝負だ!',
    'argyle': '靴下の道、いざ参る!',
    'shinobi': '…影から足元をすくうぞ。',
    'gran': 'ばあちゃんをなめるでないよ!…いたたた…',
    'baby': 'ちっちゃくても、つよいもん!',
    'kneehi': '伸びる相撲、見せてやる!',
    'robo': '圧縮率、百パーセント!',
    'ghost': '乾燥機の向こうから…来たの…',
}

base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                     dtype=torch.bfloat16, attn_implementation='sdpa')
path = os.path.join(HERE, 'fighter_clips.json')
clips = json.load(open(path, encoding='utf-8'))
reel = []
only = [a for a in sys.argv[1:] if not a.startswith('--')]  # e.g. 'gran' to redo just one
for cid, text in CATCHPHRASES.items():
    if only and cid not in only:
        continue
    prompt = base.create_voice_clone_prompt(ref_audio=os.path.join(HERE, 'refs', f'fighter_{cid}.wav'), ref_text=QF.ref_line(cid))
    for attempt in range(4):
        torch.manual_seed(zlib.crc32(f'{cid}|catchphrase|{attempt}'.encode()))
        if cid in QF.TOOTHLESS:
            text = QF.toothless(text)
        wavs, _ = base.generate_voice_clone(text=text, language='Japanese', voice_clone_prompt=prompt)
        y = QF.finish(wavs[0], QF.CAST[cid][3])
        if QF.plausible(text, y):
            break
    clips[cid]['catchphrase'] = [base64.b64encode(QF.mp3(y)).decode('ascii')]
    reel += [y * 0.89, np.zeros(int(QF.SR * 0.7))]
    print(f'{cid:8s} {len(y) / QF.SR:4.1f}s  {text}', flush=True)
json.dump(clips, open(path, 'w', encoding='utf-8'))
sf.write(os.path.join(HERE, 'samples', 'FIGHTERS_catchphrases.wav'), np.concatenate(reel), QF.SR)
print('saved; preview in samples/FIGHTERS_catchphrases.wav')
