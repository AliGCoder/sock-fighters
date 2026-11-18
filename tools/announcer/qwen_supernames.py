"""Every fighter SHOUTS the name of their own super in their fight voice (the narrator no longer calls it):
their own battle cry first (e.g. "くらえ!"), then the super's name, mid-fight. Names come from SUPER_NAMES_JP
in index.html. Adds the word 'supername' to fighter_clips.json (inject with: node inject.js fighter).
Usage: .venv-qwen/Scripts/python.exe qwen_supernames.py [id ...] [--sample]   (--sample: a short reel only, no save)"""
import base64, json, os, re, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF

HERE = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(HERE, '..', '..', 'index.html'), encoding='utf-8').read()
block = re.search(r'const SUPER_NAMES_JP = \{(.*?)\};', html, re.S).group(1)
NAMES = dict(re.findall(r"(\w+): '([^']+)'", block))


def line(cid):
    lead = QF.lines_for(cid)['special'][0]  # their own battle cry (already toothless for Gran)
    name = QF.toothless(NAMES[cid]) if cid in QF.TOOTHLESS else NAMES[cid]
    return f'{lead}{name}!'


def main():
    sample = '--sample' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or [c for c in QF.CAST if c in NAMES]
    base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                         dtype=torch.bfloat16, attn_implementation='sdpa')
    path = os.path.join(HERE, 'fighter_clips.json')
    clips = json.load(open(path, encoding='utf-8'))
    reel = []
    for cid in ids:
        prompt = base.create_voice_clone_prompt(ref_audio=os.path.join(HERE, 'refs', f'fighter_{cid}.wav'), ref_text=QF.ref_line(cid))
        text = line(cid)
        takes = []
        for j in range(1 if sample else 2):
            for attempt in range(4):
                torch.manual_seed(zlib.crc32(f'{cid}|supername|{j}|{attempt}'.encode()))
                wavs, _ = base.generate_voice_clone(text=text, language='Japanese', voice_clone_prompt=prompt)
                y = QF.finish(wavs[0], QF.CAST[cid][3])
                if QF.plausible(text, y):
                    break
            takes.append(base64.b64encode(QF.mp3(y)).decode('ascii'))
            if j == 0:
                reel += [y * 0.89, np.zeros(int(QF.SR * 0.8))]
        if not sample:
            clips[cid]['supername'] = takes
        print(f'{cid}: {text}', flush=True)
    sf.write(os.path.join(HERE, 'samples', 'SUPERNAMES.wav'), np.concatenate(reel), QF.SR)
    if not sample:
        json.dump(clips, open(path, 'w', encoding='utf-8'))
    print('done')


if __name__ == '__main__':
    main()
