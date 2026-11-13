"""Pitch ladder: the fierce voice at five pitch levels, so the pitch can be chosen by ear.
Output: samples/REEL7_pitch_<label>.wav (one file per level)"""
import os, sys
import numpy as np, soundfile as sf
sys.stdout.reconfigure(encoding='utf-8')
import voice as V
from samples3 import arena
from samples6 import fierce_line  # noqa: E402  (samples6 also re-renders its own reel on import)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
LINES = ['うふふ…|準備はいい?|ファイト!', 'ケー・オー!|あらら…|もうおしまい?', 'うふっ…|まだまだ…|甘いわね!']
# semitone shift relative to the current fierce voice
LEVELS = [('1_much_lower', -4), ('2_lower', -2), ('3_current', 0), ('4_higher', 2), ('5_much_higher', 4)]
base = V.PRESETS['fierce']


def shifted(p, d):
    q = dict(p, semis=p['semis'] + d)
    q['buildup'] = dict(p['buildup'], semis=p['buildup']['semis'] + d)
    q['payoff'] = dict(p['payoff'], semis=p['payoff']['semis'] + d)
    q['formant'] = p['formant'] + d * 0.008  # a lower voice also sounds a little fuller
    return q


for label, d in LEVELS:
    preset = shifted(base, d)
    reel = []
    for line in LINES:
        y = fierce_line([V.render_beat(b, preset) for b in line.split('|')])
        reel += [arena(y, slap=0.07, wet_level=0.25), np.zeros(int(V.SR * 0.4))]
    reel = V.normalize(np.concatenate(reel))
    sf.write(os.path.join(OUT, f'REEL7_pitch_{label}.wav'), reel, V.SR)
    print(f'{label:14s} shift {d:+d} semitones, {len(reel) / V.SR:.1f}s')
