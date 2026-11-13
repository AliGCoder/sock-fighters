"""Record extra takes for one character's word, in their designed voice (same reference + effect as qwen_fighters.py).
Usage: .venv-qwen/Scripts/python.exe qwen_line.py <id> <word> "<text 1>" ["<text 2>" ...]
Replaces that word's takes in fighter_clips.json and writes samples/LINE_<id>_<word>.wav to listen to."""
import base64, json, os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF

HERE = os.path.dirname(os.path.abspath(__file__))
cid, word, texts = sys.argv[1], sys.argv[2], sys.argv[3:]
base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                     dtype=torch.bfloat16, attn_implementation='sdpa')
prompt = base.create_voice_clone_prompt(ref_audio=os.path.join(HERE, 'refs', f'fighter_{cid}.wav'), ref_text=QF.ref_line(cid))
path = os.path.join(HERE, 'fighter_clips.json')
clips = json.load(open(path, encoding='utf-8'))
takes, reel = [], []
for j, text in enumerate(texts):
    for attempt in range(4):
        torch.manual_seed(zlib.crc32(f'{cid}|{word}|extra|{j}|{attempt}'.encode()))
        wavs, _ = base.generate_voice_clone(text=text, language='Japanese', voice_clone_prompt=prompt)
        y = QF.finish(wavs[0], QF.CAST[cid][3])
        if QF.plausible(text, y):
            break
    takes.append(base64.b64encode(QF.mp3(y)).decode('ascii'))
    reel += [y * 0.89, np.zeros(int(QF.SR * 0.6))]
    print(f'{cid} {word} take {j + 1}: {len(y) / QF.SR:.1f}s  {text}', flush=True)
clips[cid][word] = takes
json.dump(clips, open(path, 'w', encoding='utf-8'))
sf.write(os.path.join(HERE, 'samples', f'LINE_{cid}_{word}.wav'), np.concatenate(reel), QF.SR)
