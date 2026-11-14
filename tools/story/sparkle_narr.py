"""Story voices: the NARRATOR speaks in SPARKLE, the game's own announcer voice (Qwen3-TTS, the same take-2
reference as tools/announcer/qwen_voice.py), so the story is told by the voice you hear in every fight.
Records every 'narr' job in jobs.json that isn't in story_clips.json yet. Run it BEFORE vox_story.py (they share
story_clips.json, so don't run both at once).
Usage: ../announcer/.venv-qwen/Scripts/python.exe sparkle_narr.py"""
import base64, json, os, sys, zlib
import numpy as np, lameenc
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ANN = os.path.join(HERE, '..', 'announcer')
sys.path.insert(0, ANN)
os.chdir(ANN)  # qwen_voice's reference paths are relative to tools/announcer
import qwen_voice as Q

OUT = os.path.join(HERE, 'story_clips.json')
SR = Q.SR


def trim(y, db=-40, pad=0.02):
    env = np.convolve(np.abs(y), np.ones(240) / 240, mode='same')
    idx = np.where(env > env.max() * 10 ** (db / 20))[0]
    if not len(idx):
        return y
    p = int(SR * pad)
    return y[max(0, idx[0] - p): idx[-1] + p]


def finish(y):
    y = trim(np.asarray(y, dtype=np.float64))
    n = min(len(y) // 4, int(SR * 0.006))
    if n > 1:
        r = np.linspace(0, 1, n)
        y[:n] *= r
        y[-n:] *= r[::-1]
    return y * (10 ** (-1 / 20) / (np.max(np.abs(y)) or 1))


def mp3(y):
    enc = lameenc.Encoder()
    enc.set_bit_rate(32); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    return enc.encode((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush()


def units(say):
    return max(1, sum(2 if '一' <= c <= '鿿' else 1 for c in say if c.isalnum()))


jobs = json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8'))
done = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
todo = [j for j in jobs if j['voice'] == 'narr' and j['key'] not in done]
print(f'{len(todo)} narrator lines to record in the SPARKLE voice', flush=True)
for n, job in enumerate(todo):
    best = None
    for attempt in range(3):
        y = finish(Q.say(job['say'], seed=zlib.crc32(f"{job['key']}|{attempt}".encode()), role='hype'))
        secs, u = len(y) / SR, units(job['say'])
        if 0.05 * u <= secs <= 0.24 * u + 2.0:
            best = y
            break
        if best is None or abs(secs / u - 0.11) < abs(len(best) / SR / u - 0.11):
            best = y
    done[job['key']] = base64.b64encode(mp3(best)).decode('ascii')
    print(f'[{n + 1}/{len(todo)}] narr {len(best) / SR:4.1f}s  {job["say"][:60]}', flush=True)
json.dump(done, open(OUT, 'w', encoding='utf-8'))
print('done', flush=True)
