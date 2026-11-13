"""Flirty + edgy announcer audition: game lines plus a few new original teasing lines, arena echo on top.
Output: samples/REEL4_flirty.wav"""
import os, sys
import numpy as np, soundfile as sf
sys.stdout.reconfigure(encoding='utf-8')
import voice as V
from samples3 import line_audio, arena  # same beat timing and echo as the other reels

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
LINES = [
    'ふふっ…|準備はいい?|ファイト!',          # Fufu… ready? FIGHT!
    'ラウンド…|ワン!',
    'ちょっと…|本気出して?',                   # Hey… get serious?
    'ボッコボコ!',                              # Beaten to a pulp!
    'ケー・オー!|あらら…|もうおしまい?',       # K.O.! Oh my… finished already?
    'まだまだ…|甘いわね!',                     # Not yet… too sweet!
    'スティンキー・タビ…|ウィン!|パーフェクト!',
    '超必殺技!|ジムバッグ・ギャラクシー',
    '警告!|ボス出現!|ドライヤー・デーモン!',
    'かかってきなさい!',                        # Come at me!
]
preset = V.PRESETS['flirty']
reel = []
for line in LINES:
    y = line_audio([V.render_beat(b, preset) for b in line.split('|')])
    y = arena(y) * 0.9
    reel += [y, np.zeros(int(V.SR * 0.5))]
reel = V.normalize(np.concatenate(reel))
sf.write(os.path.join(OUT, 'REEL4_flirty.wav'), reel, V.SR)
print(f'REEL4_flirty {len(reel) / V.SR:.1f}s, peak {20 * np.log10(np.max(np.abs(reel))):.1f} dBFS')
