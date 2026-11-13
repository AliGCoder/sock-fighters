"""Bake every announcer clip in the take-2 Qwen voice -> clips.json {text: base64 mp3}, then run inject.js.
Clips: every beat in lines.json + every whole static line in lines_full.json (keys keep their "|").
Usage: .venv-qwen/Scripts/python.exe qwen_bake.py [kbps]"""
import base64, json, os, sys
import numpy as np, soundfile as sf, lameenc
sys.stdout.reconfigure(encoding='utf-8')
import qwen_voice as Q

HERE = os.path.dirname(os.path.abspath(__file__))
KBPS = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 56
WAVS = os.path.join(HERE, 'baked_wav_qwen')
os.makedirs(WAVS, exist_ok=True)
beats = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf-8'))
full = json.load(open(os.path.join(HERE, 'lines_full.json'), encoding='utf-8'))


def trim(y, db=-40, pad=0.02):
    env = np.convolve(np.abs(y), np.ones(240) / 240, mode='same')
    idx = np.where(env > env.max() * 10 ** (db / 20))[0]
    if not len(idx):
        return y
    p = int(Q.SR * pad)
    return y[max(0, idx[0] - p): idx[-1] + p]


def finish(y):
    y = trim(y)
    n = min(len(y) // 4, int(Q.SR * 0.006))
    if n > 1:
        r = np.linspace(0, 1, n)
        y[:n] *= r
        y[-n:] *= r[::-1]
    return y * (10 ** (-1 / 20) / (np.max(np.abs(y)) or 1))  # -1 dBFS


def plausible(text, y):
    """Reject clips that ramble on or cut off: rough length limits from the number of characters."""
    chars = len(text.replace('|', '').replace('・', '').replace('…', ''))
    return 0.25 <= len(y) / Q.SR <= 0.32 * chars + 1.4


def mp3(y):
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS); enc.set_in_sample_rate(Q.SR); enc.set_channels(1); enc.set_quality(2)
    return enc.encode((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush()


out, total_s, retries = {}, 0.0, 0
items = beats + full
if '--missing' in sys.argv:  # only record lines that don't have a clip yet
    out = json.load(open(os.path.join(HERE, 'clips.json'), encoding='utf-8'))
    items = [t for t in items if t not in out]
    print('missing:', items, flush=True)
for i, text in enumerate(items):
    for attempt in range(4):
        y = finish(Q.say(text, seed=100 * i + attempt))
        if plausible(text, y):
            break
        retries += 1
    sf.write(os.path.join(WAVS, f'{i:03d}.wav'), y, Q.SR)
    out[text] = base64.b64encode(mp3(y)).decode('ascii')
    total_s += len(y) / Q.SR
    print(f'{i + 1:3d}/{len(items)} {len(y) / Q.SR:5.2f}s {Q.role_for(text):5s} {text}', flush=True)

json.dump(out, open(os.path.join(HERE, 'clips.json'), 'w', encoding='utf-8'), ensure_ascii=False)
size = sum(len(v) for v in out.values())
print(f'{len(out)} clips, {total_s:.1f}s of audio, {size / 1e6:.2f} MB embedded, {retries} re-takes')
