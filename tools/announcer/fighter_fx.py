"""Post-processing effects for special fighter voices (applied after the Qwen voice is recorded)."""
import numpy as np
from scipy.signal import resample, butter, lfilter

SR = 24000


def _peak1(y):
    return y / (np.max(np.abs(y)) or 1)


def robot(y):
    """Strongly robotic: full ring modulation (metallic buzz), a tin-can comb resonance and a low-fi crunch."""
    y = _peak1(y)
    t = np.arange(len(y)) / SR
    y = 0.2 * y + 0.8 * y * np.sin(2 * np.pi * 48 * t)  # ring modulator
    out = y.copy()  # comb filter: short feedback echo = metallic resonance
    d = int(SR * 0.0045)
    for i in range(d, len(out)):
        out[i] += 0.62 * out[i - d]
    y = _peak1(out)
    hold = 3  # sample-and-hold: lower sample rate, "computer chip" sound
    y = np.repeat(y[::hold], hold)[: len(y)]
    y = np.round(y * 20) / 20  # bit-crush
    b, a = butter(2, [250 / (SR / 2), 5000 / (SR / 2)], 'band')
    return lfilter(b, a, y)


def demon(y):
    """Scary: lowered and slowed, an octave-down growl underneath, distortion and a dark cavern echo."""
    y = _peak1(y)
    low = resample(y, int(len(y) * 1.35))  # about 5 semitones lower, slower
    sub = resample(y, int(len(y) * 2.0))[: len(low)]  # an octave lower again, for the growl
    sub = np.pad(sub, (0, len(low) - len(sub)))
    y = np.tanh(2.6 * _peak1(low + 0.55 * sub))
    b, a = butter(2, 2600 / (SR / 2))  # dark
    y = lfilter(b, a, y)
    out = np.zeros(len(y) + int(SR * 0.9))  # cavern echo
    out[: len(y)] += y
    for k, g in ((0.09, 0.4), (0.19, 0.28), (0.31, 0.18), (0.47, 0.1)):
        s = int(SR * k)
        out[s: s + len(y)] += y * g
    return out


def demon_gritty(y):
    """Gritty: slightly lower, crunchy distortion, a raspy breath layer that follows the voice, short tight echo."""
    y = _peak1(y)
    y = _peak1(resample(y, int(len(y) * 1.15)))  # a little lower and heavier
    env = np.convolve(np.abs(y), np.ones(200) / 200, mode='same')
    rng = np.random.default_rng(3)
    b, a = butter(2, [900 / (SR / 2), 4500 / (SR / 2)], 'band')
    rasp = lfilter(b, a, rng.uniform(-1, 1, len(y))) * env * 2.2  # throat rasp
    crunch = np.tanh(3.2 * (y + 0.15 * y ** 2))  # asymmetric = rough, gravelly distortion
    y = _peak1(crunch + rasp)
    b, a = butter(2, 5200 / (SR / 2))
    y = lfilter(b, a, y)
    out = np.zeros(len(y) + int(SR * 0.15))  # short, tight room
    out[: len(y)] += y
    d = int(SR * 0.045)
    out[d: d + len(y)] += y * 0.22
    return out


def pitch_shift(y, semitones, formant=1.0):
    """Change pitch without changing length (Praat PSOLA)."""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(y, sampling_frequency=SR)
    f0 = call(snd.to_pitch(0.01, 60, 500), 'Get quantile', 0, 0, 0.5, 'Hertz')
    if not np.isfinite(f0) or f0 <= 0:
        f0 = 120.0
    out = call(snd, 'Change gender', 60, 500, formant, f0 * 2 ** (semitones / 12), 1.0, 1.0).values[0]
    return out[: len(y)] if len(out) >= len(y) else np.pad(out, (0, len(y) - len(out)))


def gate(y, floor_db=-26, release=0.03):
    """Cut lingering room echo: anything well below the voice's level fades out quickly."""
    env = np.convolve(np.abs(y), np.ones(160) / 160, mode='same')
    level = np.clip(env / (env.max() * 10 ** (floor_db / 20)), 0, 1) ** 2
    smooth = np.convolve(level, np.ones(int(SR * release)) / int(SR * release), mode='same')
    return y * smooth


def demon_dry(y):
    """Demon with attitude, completely dry: echo gated off, lower voice + an octave-down double + light grit."""
    y = gate(_peak1(y))
    main = pitch_shift(y, -3, formant=0.9)  # lower and bigger
    double = pitch_shift(y, -15, formant=0.8)  # the classic demon double, an octave below, perfectly in time
    y = _peak1(main + 0.35 * _peak1(double))
    env = np.convolve(np.abs(y), np.ones(200) / 200, mode='same')
    rng = np.random.default_rng(5)
    b, a = butter(2, [1000 / (SR / 2), 4000 / (SR / 2)], 'band')
    rasp = lfilter(b, a, rng.uniform(-1, 1, len(y))) * env * 0.9  # a little throat rasp
    y = np.tanh(2.0 * (y + 0.12 * y ** 2)) + rasp  # light, rough distortion
    b, a = butter(2, 5000 / (SR / 2))
    return lfilter(b, a, y)


def ghost(y):
    """Airy echo."""
    out = np.zeros(len(y) + int(SR * 0.5))
    out[: len(y)] += y
    for k, g in ((0.12, 0.35), (0.24, 0.18), (0.36, 0.08)):
        d = int(SR * k)
        out[d: d + len(y)] += y * g
    b, a = butter(1, 3500 / (SR / 2))
    return lfilter(b, a, out)


def old(y):
    """98 years old: slower, a quavering pitch wobble, a shaky volume tremble and a thin, fragile tone."""
    y = _peak1(y)
    y = resample(y, int(len(y) * 1.08))  # a touch slower (and slightly lower, as very old voices drop)
    n = np.arange(len(y))
    rate, depth = 5.5 / SR, 0.035  # quaver: about +/- 60 cents, 5.5 times a second
    pos = n + depth / (2 * np.pi * rate) * np.sin(2 * np.pi * rate * n)  # read faster/slower = pitch wobble
    y = np.interp(np.clip(pos, 0, len(y) - 1), n, y)
    t = n / SR
    y = y * (1 - 0.3 * (0.5 + 0.5 * np.sin(2 * np.pi * 7.0 * t + 1.0)))  # shaky tremble
    b, a = butter(2, [260 / (SR / 2), 3800 / (SR / 2)], 'band')  # thin and fragile
    return lfilter(b, a, y)


EFFECTS = {'robot': robot, 'demon': demon_dry, 'demon_gritty': demon_gritty, 'demon_big': demon, 'ghost': ghost, 'old': old}
