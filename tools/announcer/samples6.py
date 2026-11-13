"""Fierce flirty audition (v3): same lines as v2, just a fiercer voice (less whispery build-ups, harder-hitting shouts).
Output: samples/REEL6_fierce.wav"""
import os, sys
import numpy as np, soundfile as sf
sys.stdout.reconfigure(encoding='utf-8')
import voice as V
from samples3 import arena

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


def fierce_line(beats):
    """Like the game's beat joining, but the payoff is pushed harder over the build-up."""
    parts, n = [], len(beats)
    for i, y in enumerate(beats):
        last = i == n - 1
        parts.append(y * (1.2 if n == 1 or last else 0.82))
        if not last:
            parts.append(np.zeros(int(V.SR * (0.12 if i == n - 2 else 0.05))))
    return np.concatenate(parts)


if __name__ == "__main__":
    preset = V.PRESETS['fierce']
    reel = []
    for line in LINES:
        y = fierce_line([V.render_beat(b, preset) for b in line.split('|')])
        y = arena(y, slap=0.07, wet_level=0.25)
        reel += [y, np.zeros(int(V.SR * 0.4))]
    reel = V.normalize(np.concatenate(reel))
    sf.write(os.path.join(OUT, 'REEL6_fierce.wav'), reel, V.SR)
    print(f'REEL6_fierce {len(reel) / V.SR:.1f}s, peak {20 * np.log10(np.max(np.abs(reel))):.1f} dBFS')
