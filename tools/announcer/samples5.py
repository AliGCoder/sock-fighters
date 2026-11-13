"""Flirty v2 audition: more teasing (slower sultry build-ups, more giggles), higher & cuter, less grit,
less echo, bigger & longer shouts. Output: samples/REEL5_flirty2.wav"""
import os, sys
import numpy as np, soundfile as sf
sys.stdout.reconfigure(encoding='utf-8')
import voice as V
from samples3 import line_audio, arena

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
LINES = [
    'うふふ…|準備はいい?|ファイト!',            # Ufufu… ready? FIGHT!
    'ラウンド…|ワン!',
    'ふふっ…|ちょっと…|本気出して?',            # Fufu… hey… get serious?
    'ボッコボコ!|あはっ!',                       # Totally pummelled! Ahah!
    'ケー・オー!|あらら…|もうおしまい?',         # K.O.! Oh my… finished already?
    'うふっ…|まだまだ…|甘いわね!',              # Ufu… not yet… too soft!
    'スティンキー・タビ…|ウィン!|パーフェクト!',
    '超必殺技!|ジムバッグ・ギャラクシー',
    '警告!|ボス出現!|ドライヤー・デーモン!',
    'はぁ…|かわいいね…|かかってきなさい!',      # Haah… so cute… come at me!
]
preset = V.PRESETS['flirty2']
reel = []
for line in LINES:
    y = line_audio([V.render_beat(b, preset) for b in line.split('|')])
    y = arena(y, slap=0.07, wet_level=0.25)  # much less echo than before
    reel += [y, np.zeros(int(V.SR * 0.45))]
reel = V.normalize(np.concatenate(reel))
sf.write(os.path.join(OUT, 'REEL5_flirty2.wav'), reel, V.SR)
print(f'REEL5_flirty2 {len(reel) / V.SR:.1f}s, peak {20 * np.log10(np.max(np.abs(reel))):.1f} dBFS')
