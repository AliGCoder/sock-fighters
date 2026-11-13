"""Audition samples: a few lines x 3 voices, raw and processed. Output: ./samples/*.wav"""
import os, sys, soundfile as sf
sys.stdout.reconfigure(encoding='utf-8')
import voice as V

OUT = os.path.join(os.path.dirname(__file__), 'samples'); os.makedirs(OUT, exist_ok=True)
LINES = [('fight', 'ファイト!'), ('ko', 'ケー・オー!'), ('round', 'ラウンド…'), ('perfect', 'パーフェクト!'),
         ('super', '超必殺技!'), ('stinky', 'スティンキー・タビ!'), ('challenger', 'ニュー・チャレンジャー!')]
VOICES = sys.argv[1:] or ['jf_alpha', 'jf_gongitsune', 'jf_nezumi']
for v in VOICES:
    for key, text in LINES:
        raw = V.synth(V.tts_text(text), v)
        sf.write(f'{OUT}/{v}_{key}_raw.wav', raw, V.SR)
        sf.write(f'{OUT}/{v}_{key}_sparkle.wav', V.sparkle(raw), V.SR)
        print(v, key, f'{len(raw)/V.SR:.2f}s')
