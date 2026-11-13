"""Comparison reels for each processing preset -> samples/REEL2_<preset>.wav"""
import os, sys, numpy as np, soundfile as sf, parselmouth
sys.stdout.reconfigure(encoding='utf-8')
import voice as V
OUT = os.path.join(os.path.dirname(__file__), 'samples')
LINES = ['ファイト!', 'ケー・オー!', 'ラウンド…', 'ワン!', 'パーフェクト!', '超必殺技!', 'スティンキー・タビ!', 'ニュー・チャレンジャー!', 'おめでとう!']
gap = np.zeros(int(V.SR * 0.45))
for name in (sys.argv[1:] or V.PRESETS):
    p = V.PRESETS[name]; parts = []; sd = []
    for t in LINES:
        y = V.render(V.tts_text(t), p); parts += [y, gap]
        f = parselmouth.Sound(y, V.SR).to_pitch(0.01, 120, 900).selected_array['frequency']; f = f[f > 0]
        sd.append((12 * np.log2(f / np.median(f))).std())
    sf.write(f'{OUT}/REEL2_{name}.wav', np.concatenate(parts), V.SR)
    print(f'{name:8s} pitch variation {np.mean(sd):.2f} st, reel {sum(len(x) for x in parts)/V.SR:.1f}s')
