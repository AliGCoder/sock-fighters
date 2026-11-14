"""Story voices, step 2: record every story line in its speaker's voice with VoxCPM2 (openbmb, Apache-2.0).
Each line clones the character's ORIGINAL voice (fighters: tools/announcer/refs/fighter_<id>.wav, the same voices as
in fights; Queen / Scout / narrator: refs/story_<v>.wav designed by qwen_story.py) and adds a delivery note, e.g.
"(squeaky, bratty toddler, crying and sobbing)". The robot, ghost, demon and granny effects from the fights are applied
on top. 'fake' = the Demon pretending to be Princess Baby Bootie (Baby Bootie's voice, a bit too deep).
Reads jobs.json (prep.js); writes story_clips.json { key: base64 mp3 } (re-runnable: skips what's recorded) and
samples/STORY_<voice>.wav reels to listen to.
Usage: ../announcer/.venv-vox/Scripts/python.exe vox_story.py [--limit N] [--only voice,voice]"""
import base64, json, os, sys, zlib
import numpy as np, soundfile as sf, lameenc, torch
from scipy.signal import resample_poly
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
ANN = os.path.join(HERE, '..', 'announcer')
sys.path.insert(0, ANN)
from fighter_fx import EFFECTS  # robot / demon / ghost / old (numpy only)
from voxcpm import VoxCPM

SR = 24000  # output rate (the effects are tuned for it; plenty for speech)
KBPS = 32
OUT = os.path.join(HERE, 'story_clips.json')
SAMPLES = os.path.join(HERE, 'samples')
# the fight voices' effects (see tools/announcer/qwen_fighters.py CAST)
FX = {'robo': 'robot', 'demon': 'demon', 'ghost': 'ghost', 'gran': 'old', 'fakedeep': 'demon'}


# Queen Nylonia, the Fishnet Scout and the narrator: ORIGINAL Japanese voices designed from these descriptions
# (one reference line each, then every line clones it so the voice stays the same)
DESIGN_JA = {
    'queen': ('A grand, theatrical Japanese queen in her forties: rich, elegant, haughty and dramatic, comically '
              'self-important, like a royal proclamation',
              '我らはナイロニア女王。とっても華麗で、とっても偉いのよ。ひざがあるなら、ひざまずきなさい。'),
    'fishnet': ('A young Japanese woman, a royal scout: bright, quick and eager voice, a little nervous and cheeky, upbeat',
                '騎士様、こっちです!足元に気をつけてくださいね。このへん、ちょっと穴だらけなので!'),
    'narr': ('A warm, playful Japanese storybook narrator: a mature man with a clear, expressive, friendly voice, '
             'great comic timing',
             'むかしむかし、真夜中のコインランドリーで、靴下が一枚、消えようとしていました。'),
}


def ref_for(voice):
    if voice == 'queen':  # her own voice (option 2, picked by the player): glamorous, mature, velvety — not SPARKLE
        return os.path.join(HERE, 'refs', 'queen_option_2.wav')
    if voice in DESIGN_JA:
        # the ORIGINAL voices from the first audition (the player liked these), now speaking Japanese
        return os.path.join(HERE, 'refs', f'story_{voice}.wav')
    cid = {'fake': 'baby', 'fakedeep': 'demon'}.get(voice, voice)
    return os.path.join(ANN, 'refs', f'fighter_{cid}.wav')


def trim(y, db=-42, pad=0.02):
    env = np.convolve(np.abs(y), np.ones(240) / 240, mode='same')
    idx = np.where(env > env.max() * 10 ** (db / 20))[0]
    if not len(idx):
        return y
    p = int(SR * pad)
    return y[max(0, idx[0] - p): idx[-1] + p]


def finish(y, sr_in, voice):
    y = np.asarray(y, dtype=np.float64)
    y = resample_poly(y, SR, sr_in) if sr_in != SR else y
    if voice == 'fake':  # a baby voice... a bit too deep and slow
        y = resample_poly(y, 116, 100)
    y = trim(y)
    if voice in FX:
        y = EFFECTS[FX[voice]](y)
        y = trim(y, db=-45)
    n = min(len(y) // 4, int(SR * 0.006))
    if n > 1:
        r = np.linspace(0, 1, n)
        y[:n] *= r
        y[-n:] *= r[::-1]
    return y * (10 ** (-1 / 20) / (np.max(np.abs(y)) or 1))


def mp3(y):
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    return enc.encode((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()) + enc.flush()


def units(say):
    """Rough speaking length of Japanese text: kana count 1, kanji 2 (most have two sounds), punctuation 0."""
    n = 0
    for ch in say:
        if '一' <= ch <= '鿿':
            n += 2
        elif '぀' <= ch <= 'ヿ' or ch.isalnum():
            n += 1
    return max(1, n)


def plausible(say, y):
    secs = len(y) / SR
    return 0.05 * units(say) <= secs <= 0.24 * units(say) + 2.0


def main():
    args = sys.argv[1:]
    limit = int(args[args.index('--limit') + 1]) if '--limit' in args else None
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    os.makedirs(SAMPLES, exist_ok=True)
    jobs = json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8'))
    jobs.sort(key=lambda j: (j['file'] != 'story', j['file']))  # everyone's lines first, then hero by hero
    done = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    skip = set(args[args.index('--skip') + 1].split(',')) if '--skip' in args else set()
    todo = [j for j in jobs if j['key'] not in done and (not only or j['voice'] in only) and j['voice'] not in skip]
    if limit:
        todo = todo[:limit]
    print(f'{len(done)} already recorded, {len(todo)} to record', flush=True)
    if not todo:
        return
    model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
    sr_in = model.tts_model.sample_rate
    for v, (desc, line) in ():  # (no longer used: the original voices are kept)
        path = ref_for(v)
        if not os.path.exists(path):  # design the voice once: a description in brackets, no reference
            torch.manual_seed(4200 + len(v))
            y = model.generate(text=f'({desc}){line}', cfg_value=2.0, inference_timesteps=10)
            sf.write(path, np.asarray(y, dtype=np.float32), sr_in)
            print(f'designed {v}: {len(y) / sr_in:.1f}s', flush=True)
    reels = {}
    for n, job in enumerate(todo):
        best = None
        for attempt in range(3):
            torch.manual_seed(zlib.crc32(f"{job['key']}|{attempt}".encode()))
            y = model.generate(text=f"({job['note']}){job['say']}", reference_wav_path=ref_for(job['voice']),
                               cfg_value=2.0, inference_timesteps=10)
            y = finish(y, sr_in, job['voice'])
            if plausible(job['say'], y):
                best = y
                break
            u = units(job['say'])  # keep the take closest to a normal speaking pace
            if best is None or abs(len(y) / SR / u - 0.11) < abs(len(best) / SR / u - 0.11):
                best = y
        done[job['key']] = base64.b64encode(mp3(best)).decode('ascii')
        reel = reels.setdefault(job['voice'], [])
        if len(reel) < 10:
            reel += [best * 0.89, np.zeros(int(SR * 0.5))]
        print(f"[{n + 1}/{len(todo)}] {job['voice']:9s} {len(best) / SR:4.1f}s  {job['say'][:70]}", flush=True)
        if (n + 1) % 10 == 0:
            json.dump(done, open(OUT, 'w', encoding='utf-8'))
            for v, r in reels.items():
                sf.write(os.path.join(SAMPLES, f'STORY_{v}.wav'), np.concatenate(r), SR)
    json.dump(done, open(OUT, 'w', encoding='utf-8'))
    for v, r in reels.items():
        sf.write(os.path.join(SAMPLES, f'STORY_{v}.wav'), np.concatenate(r), SR)
    print(f'done: {len(done)} clips, {sum(len(b) for b in done.values()) / 1e6:.2f} MB of base64', flush=True)


if __name__ == '__main__':
    main()
