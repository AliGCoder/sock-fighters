"""Audition reels for announcer delivery styles. Each reel plays the same full lines with in-game beat timing.
Output: samples/REEL3_<style>.wav"""
import os, sys
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, lfilter
sys.stdout.reconfigure(encoding='utf-8')
import voice as V

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
LINES = ['ラウンド…|ワン!', 'レディー…|ファイト!', 'ケー・オー!|勝負あり!', 'スティンキー・タビ…|ウィン!|パーフェクト!',
         '超必殺技!|ジムバッグ・ギャラクシー', '警告!|ボス出現!|ドライヤー・デーモン!']
STYLES = ['v1', 'theatrical', 'confident', 'playful', 'arena']
SR = V.SR


def line_audio(beats_audio):
    """Join beats like the game does: build-ups softer, payoff louder, short gaps, longer breath before payoff."""
    parts = []
    n = len(beats_audio)
    for i, y in enumerate(beats_audio):
        last = i == n - 1
        parts.append(y * (1.12 if n == 1 or last else 0.9))
        if not last:
            parts.append(np.zeros(int(SR * (0.13 if i == n - 2 else 0.06))))
    return np.concatenate(parts)


def arena(x, slap=0.16, wet_level=0.6):
    """Slapback echo + short hall reverb (the same idea as a live effect in the game)."""
    rng = np.random.default_rng(1)
    n, pre = int(SR * 1.8), int(SR * 0.03)
    ir = np.zeros(n)
    ir[pre:] = rng.uniform(-1, 1, n - pre) * np.exp(-np.arange(n - pre) / (SR * 0.36))
    b, a = butter(2, 320 / (SR / 2), 'high')
    wet = fftconvolve(lfilter(b, a, x), ir)[: len(x) + n]
    wet = wet / (np.max(np.abs(wet)) or 1) * 0.35
    out = np.zeros(len(x) + n)
    out[: len(x)] += x
    d = int(SR * 0.11)
    out[d: d + len(x)] += x * slap
    out[: len(wet)] += wet * wet_level
    return out


if __name__ != "__main__":
    STYLES = []  # imported for its helpers only
for style in (sys.argv[1:] or STYLES) if __name__ == "__main__" else []:
    preset = V.PRESETS['v1' if style == 'arena' else style]  # 'mix' = mix preset + arena echo
    reel = []
    for line in LINES:
        y = line_audio([V.render_beat(b, preset) for b in line.split('|')])
        if style in ('arena', 'mix'):
            y = arena(y)
        reel += [y, np.zeros(int(SR * 0.6))]
    reel = V.normalize(np.concatenate(reel))
    sf.write(os.path.join(OUT, f'REEL3_{style}.wav'), reel, SR)
    print(f'{style:11s} {len(reel) / SR:5.1f}s')
