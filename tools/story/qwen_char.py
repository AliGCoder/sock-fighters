"""Story voices: record one character's story lines with the SAME engine and voice reference as their fight clips
(Qwen3-TTS, tools/announcer/refs/fighter_<id>.wav), so they sound exactly like they do in fights.
Re-records every line of that voice in jobs.json (replacing what vox_story.py made). Don't run with vox_story.py.
Usage: ../announcer/.venv-qwen/Scripts/python.exe qwen_char.py mismatch"""
import base64, json, os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ANN = os.path.join(HERE, '..', 'announcer')
sys.path.insert(0, ANN)
import qwen_fighters as QF
from qwen_tts import Qwen3TTSModel

QF.KBPS = 32
cid = sys.argv[1]
OUT = os.path.join(HERE, 'story_clips.json')
jobs = [j for j in json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8')) if j['voice'] == cid]
done = json.load(open(OUT, encoding='utf-8'))
base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                     dtype=torch.bfloat16, attn_implementation='sdpa')
prompt = base.create_voice_clone_prompt(ref_audio=os.path.join(ANN, 'refs', f'fighter_{cid}.wav'), ref_text=QF.ref_line(cid))


def units(say):
    return max(1, sum(2 if '一' <= c <= '鿿' else 1 for c in say if c.isalnum()))


reel = []
for n, job in enumerate(jobs):
    best = None
    for attempt in range(3):
        torch.manual_seed(zlib.crc32(f"{job['key']}|q|{attempt}".encode()))
        wavs, _ = base.generate_voice_clone(text=job['say'], language='Japanese', voice_clone_prompt=prompt)
        y = QF.finish(wavs[0], QF.CAST[cid][3])
        secs, u = len(y) / QF.SR, units(job['say'])
        if 0.05 * u <= secs <= 0.24 * u + 2.0:
            best = y
            break
        if best is None or abs(secs / u - 0.11) < abs(len(best) / QF.SR / u - 0.11):
            best = y
    done[job['key']] = base64.b64encode(QF.mp3(best)).decode('ascii')
    reel += [best * 0.89, np.zeros(int(QF.SR * 0.5))]
    print(f'[{n + 1}/{len(jobs)}] {cid} {len(best) / QF.SR:4.1f}s  {job["say"][:60]}', flush=True)
json.dump(done, open(OUT, 'w', encoding='utf-8'))
sf.write(os.path.join(HERE, 'samples', f'STORY_{cid}_fightvoice.wav'), np.concatenate(reel), QF.SR)
print('done', flush=True)
