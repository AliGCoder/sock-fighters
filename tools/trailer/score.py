"""The trailer's sound: an ORIGINAL epic score made in code (drone, braaams, taiko drums, string ostinato, risers,
impacts, whooshes), timed to the cuts in out/timeline.json, plus the narrator (out/narr_<n>.wav) and the game's own
sound mixed underneath. Writes out/trailer_mix.wav (48 kHz stereo).
Run with the announcer's Python (numpy + scipy + soundfile):  ../announcer/.venv-qwen/Scripts/python.exe score.py"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SR = 48000
rng = np.random.default_rng(7)  # the score is the same every run
marks = json.load(open(os.path.join(OUT, 'timeline.json')))
END = [m for m in marks if m['end']][0]['at']
LEN = END + 7.0
N = int(LEN * SR)
mus = np.zeros((N, 2))  # the score
sfx = np.zeros((N, 2))  # whooshes and hits


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def lp(x, hz, order=4):
    return sosfilt(butter(order, hz, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def add(buf, at, x, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    buf[i:i + len(x)] += x * gain


def env(n, a, d, sustain=1.0):
    """attack seconds a, then exponential decay with time constant d"""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    return e * (sustain * np.exp(-np.maximum(0, t - a) / d))


def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)


def saw(freq, sec, detune=0.0):
    t = t_(sec)
    out = 0
    for d in (-detune, 0, detune):
        ph = (t * freq * (1 + d)) % 1.0
        out = out + (2 * ph - 1)
    return out / 3


# ---- instruments ----
def braam(sec=3.2, root=38):
    """a huge low brass blast: detuned saws on D, opened then closing filter"""
    x = sum(saw(note(m), sec, 0.006) * g for m, g in [(root - 12, 1.0), (root, 0.9), (root + 7, 0.6), (root + 12, 0.5), (root + 15, 0.3)])
    n = len(x)
    out = np.zeros(n)
    # the filter opens fast then closes slowly: do it in blocks
    blk = 1024
    for i in range(0, n, blk):
        tt = i / SR
        cut = 300 + 2600 * np.exp(-tt / 0.8) * min(1, tt / 0.06 + 0.05)
        out[i:i + blk] = lp(x[max(0, i - 4096):i + blk], cut, 2)[-len(x[i:i + blk]):]
    e = env(n, 0.05, sec * 0.45)
    return np.tanh(out * e * 1.6)


def taiko(big=1.0):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 52 + 70 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.32 * big))
    skin = lp(rng.standard_normal(n), 1800) * np.exp(-t / 0.025) * 0.6
    return np.tanh((body + skin) * 1.8) * big


def tom(pitch=110):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = pitch + 80 * np.exp(-t / 0.02)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) + lp(rng.standard_normal(n), 3000) * np.exp(-t / 0.01) * 0.3


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 1500) * np.exp(-t / 0.07) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4


def pluck(m, sec=0.5, bright=2500):
    x = saw(note(m), sec, 0.003)
    return lp(x, bright, 2) * env(len(x), 0.004, sec * 0.35)


def pad(chord, sec):
    x = sum(saw(note(m), sec, 0.004) for m in chord) / len(chord)
    e = np.minimum(1, t_(sec) / 1.2) * np.minimum(1, (sec - t_(sec)) / 1.0)
    return lp(x, 1400, 2) * e


def riser(sec):
    n = int(sec * SR)
    t = np.arange(n) / SR
    k = t / sec
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 2048
    for i in range(0, n, blk):
        c = 300 + 7000 * k[i] ** 2
        out[i:i + blk] = bp(noise[max(0, i - 4096):i + blk], c * 0.7, c * 1.3)[-len(noise[i:i + blk]):]
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * k ** 2) / SR) * 0.25
    return (out * 1.4 + tone) * k ** 1.6


def impact(big=1.0):
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 1.1)
    crack = lp(rng.standard_normal(n), 5000) * np.exp(-t / 0.05)
    boom = lp(rng.standard_normal(n), 220) * np.exp(-t / 0.6) * 1.5
    return np.tanh((sub * 1.4 + crack * 0.8 + boom) * big)


def whoosh(sec=0.55):
    n = int(sec * SR)
    t = np.arange(n) / SR
    k = t / sec
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        c = 400 + 4000 * np.sin(np.pi * k[i]) ** 2
        out[i:i + blk] = bp(noise[max(0, i - 4096):i + blk], c * 0.6, c * 1.5)[-len(noise[i:i + blk]):]
    return out * np.sin(np.pi * k) ** 1.5


def drone(sec):
    t = t_(sec)
    x = np.sin(2 * np.pi * note(26) * t) + 0.5 * np.sin(2 * np.pi * note(38) * t * 1.001) + 0.3 * lp(rng.standard_normal(len(t)), 120)
    return x * np.minimum(1, t / 2.0) * np.minimum(1, (sec - t) / 0.6)


# ---- the arrangement, following the cuts ----
cards = [m for m in marks if m['card']]
by_card = {m['card']: m['at'] for m in cards}
A_FIGHT = by_card['FIGHT.']
A_SUPER = by_card['UNLEASH YOUR SUPER.']
A_STORY = by_card['FIND HIS OTHER HALF.']
A_DEMON = by_card['A SHINOBI APPEARS.']
A_PLAY = by_card['PLAY YOUR WAY.']
A_TOGETHER = by_card['TOGETHER.']

# the story opens it: a mysterious drone, braaams and a lonely piano-ish motif (D minor)
add(mus, 0, drone(A_STORY + 0.5), 0.55)
add(mus, 0.05, braam(3.0), 0.7)
add(mus, by_card["STINKY'S OTHER HALF... GONE."], braam(2.8, 36), 0.75)
for i, m in enumerate([62, 65, 69, 67, 65, 62, 60, 62, 62, 65, 69, 72, 70, 69]):
    add(mus, 0.8 + i * 0.62, pluck(m, 0.9, 1800), 0.18, pan=-0.3 + 0.1 * (i % 3))
add(sfx, A_DEMON - 1.6, riser(1.6), 0.55)
add(sfx, A_DEMON, impact(1.0), 0.9)
add(mus, A_DEMON, braam(3.0, 38), 0.8)
add(mus, A_DEMON, braam(3.0, 26), 0.5)

BPM = 128
beat = 60 / BPM


def heartbeat(a, b):
    # the Dryer Demon: a slow, heavy double heartbeat on the big drum
    t = a
    while t < b - 0.1:
        add(mus, t, taiko(1.1), 0.5)
        add(mus, t + beat * 0.5, taiko(0.8), 0.35)
        t += beat * 2


def drums(a, b, heavy=1.0, double=False):
    t = a
    i = 0
    step = beat / 2
    while t < b - 0.05:
        pos = i % 8
        if pos in (0, 3, 6) or (double and pos in (1, 5)):
            add(mus, t, taiko(heavy), 0.55, pan=0.0)
        if pos in (2, 6):
            add(mus, t, snare(), 0.32 * heavy, pan=0.15)
        if pos in (5, 7):
            add(mus, t, tom(130 if pos == 5 else 95), 0.3, pan=-0.35 if pos == 5 else 0.35)
        t += step
        i += 1


def ostinato(a, b, notes, gain=0.16, bright=2600):
    t = a
    i = 0
    while t < b - 0.05:
        add(mus, t, pluck(notes[i % len(notes)], 0.25, bright), gain, pan=(-0.4 if i % 2 else 0.4))
        t += beat / 4
        i += 1


def chords(a, b, prog, gain=0.22):
    span = (b - a) / len(prog)
    for k, ch in enumerate(prog):
        add(mus, a + k * span, pad(ch, span + 0.8), gain)


DM = [50, 53, 57, 62]
BB = [46, 50, 53, 58]
FM = [53, 57, 60, 65]
CM = [48, 52, 55, 60]
# the Dryer Demon and the portal: dark chords over a heartbeat, building
heartbeat(A_DEMON + 1.8, A_STORY - 0.3)
chords(A_DEMON + 0.4, A_STORY, [DM, BB, DM, [49, 52, 56, 61]], 0.24)
add(sfx, A_STORY - 1.6, riser(1.6), 0.55)
# SAVE THE PALACE: the heroic theme, warm chords and a slow melody, then a riser into the fights
add(mus, A_STORY, braam(3.2, 38), 0.7)
add(sfx, A_STORY, impact(1.0), 0.8)
chords(A_STORY + 0.2, A_FIGHT, [FM, CM, DM, BB], 0.3)
for i, m in enumerate([69, 72, 70, 69, 67, 65, 64, 65]):
    add(mus, A_STORY + 1.6 + i * 0.85, pluck(m, 1.4, 2000), 0.2)
add(sfx, A_FIGHT - 1.4, riser(1.4), 0.5)
add(mus, A_FIGHT, braam(3.0, 38), 0.75)
# ACT 1 fight: drums + ostinato
fight_go = A_FIGHT + 1.7
drums(fight_go, A_SUPER - 1.5, 1.0)
ostinato(fight_go, A_SUPER - 1.5, [62, 65, 69, 65, 62, 65, 70, 65])
chords(fight_go, A_SUPER, [DM, BB, FM, CM], 0.16)
add(sfx, A_SUPER - 1.8, riser(1.8), 0.6)
add(mus, A_SUPER, braam(3.4, 38), 0.8)
add(sfx, A_SUPER, impact(1.1), 0.8)
# ACT 2 supers: heavier, double-time drums, an impact on every super
supers_go = A_SUPER + 1.9
drums(supers_go, A_PLAY - 0.4, 1.25, double=True)
ostinato(supers_go, A_PLAY - 0.4, [62, 69, 74, 69, 65, 69, 72, 69], 0.2, 3400)
chords(supers_go, A_PLAY, [DM, BB, CM, DM], 0.2)
for m in marks:
    if m['punch']:
        add(sfx, m['at'] + 0.15, impact(0.8), 0.55)
add(sfx, A_PLAY - 1.4, riser(1.4), 0.45)
# ACT 4 play your way: brighter (F major), lighter drums
play_go = A_PLAY + 1.7
drums(play_go, A_TOGETHER - 0.3, 0.85)
ostinato(play_go, A_TOGETHER - 0.3, [65, 69, 72, 77, 72, 69, 67, 72], 0.15, 3200)
chords(play_go, A_TOGETHER, [FM, CM, DM, BB, FM, CM], 0.18)
# ACT 5 together: everything, building into the finale
tog_go = A_TOGETHER + 1.5
drums(tog_go, END - 0.1, 1.3, double=True)
ostinato(tog_go, END - 0.1, [62, 69, 74, 77, 74, 69, 74, 81], 0.2, 4000)
add(sfx, END - (END - A_TOGETHER), riser(END - A_TOGETHER), 0.6)
# THE END: the biggest braaam and impact, then the room rings out
add(mus, END, braam(5.5, 38), 1.0)
add(mus, END, braam(5.5, 26), 0.6)
add(sfx, END, impact(1.3), 1.0)
add(mus, END + 0.3, pad(DM + [69], 6.0), 0.25)

# a whoosh into every cut
for m in marks[1:]:
    add(sfx, max(0, m['at'] - 0.45), whoosh(0.6), 0.4, pan=0.0)

# reverb: a hall made of decaying noise
ir_n = int(2.2 * SR)
ir = rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / SR / 0.55)[:, None]
ir[:, 0] = lp(ir[:, 0], 6000)
ir[:, 1] = lp(ir[:, 1], 6000)
ir /= np.abs(ir).sum(0).max() / 30
wet = np.stack([fftconvolve(mus[:, c], ir[:, c])[:N] for c in range(2)], 1)
mus = mus * 0.8 + wet * 0.35
wet2 = np.stack([fftconvolve(sfx[:, c], ir[:, c])[:N] for c in range(2)], 1)
sfx = sfx + wet2 * 0.2

# ---- the AI-composed score (ACE-Step, see ace_score.py) replaces the coded music when asked for ----
if '--ace' in sys.argv:
    from scipy.signal import resample_poly
    a, asr = sf.read(os.path.join(OUT, 'ace_score.wav'))
    if a.ndim == 1:
        a = np.stack([a, a], 1)
    if asr != SR:
        a = resample_poly(a, SR, asr, axis=0)
    a = np.pad(a, ((0, max(0, N - len(a))), (0, 0)))[:N]
    a = a / (np.abs(a).max() + 1e-9)
    # quieter under the cold-open cards, full from the first FIGHT
    shape = np.ones(N) * 1.0
    shape[: int(A_FIGHT * SR)] = 0.6
    mus = a * lp(shape, 3)[:, None] * 0.9

# ---- the narrator: placed on each card (the end line just after the logo slam) ----
narr = np.zeros((N, 2))
says = [m for m in marks if m['say']]
for i, m in enumerate(says):
    y, sr = sf.read(os.path.join(OUT, f'narr_{i}.wav'))
    if sr != SR:
        from scipy.signal import resample_poly
        y = resample_poly(y, SR, sr)
    at = m['at'] + (0.9 if m['end'] else 0.25)
    add(narr, at, y, 1.0)
nwet = np.stack([fftconvolve(narr[:, c], ir[:, c] * 0.5)[:N] for c in range(2)], 1)
narr = narr + nwet * 0.12
talking = lp(np.abs(narr).max(1), 6) > 0.02  # where he speaks, the music dips

# ---- the game's own sound, underneath (silent on the black cards) ----
ff = sys.argv[1]
gw = os.path.join(OUT, 'game_audio.wav')
subprocess.run([ff, '-loglevel', 'error', '-y', '-i', os.path.join(OUT, 'sock-fighters-trailer.mp4'), '-vn', '-ar', str(SR), '-ac', '2', gw], check=True)
game, _ = sf.read(gw)
game = np.pad(game, ((0, max(0, N - len(game))), (0, 0)))[:N]
gmask = np.ones(N)
for m in marks:
    if m['card']:
        a, b = int(m['at'] * SR), int((m['at'] + m['cardSecs']) * SR)
        gmask[a:b] = 0
gmask = lp(gmask, 8)

duck = 1 - 0.45 * lp(talking.astype(float), 4)
mix = mus[:, :] * 0.5 * duck[:, None] + sfx * 0.55 + narr * 0.95 + game * (0.42 * gmask * (1 - 0.5 * lp(talking.astype(float), 4)))[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 1.25
mix = np.tanh(mix) * 0.95
fade = np.minimum(1, (LEN - np.arange(N) / SR) / 2.5)
mix *= np.clip(fade, 0, 1)[:, None]
sf.write(os.path.join(OUT, 'trailer_mix_ace.wav' if '--ace' in sys.argv else 'trailer_mix.wav'), mix.astype(np.float32), SR)
print(f'mix {LEN:.1f}s written')
