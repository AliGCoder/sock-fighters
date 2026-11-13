"""Qwen3-TTS VoiceDesign (Apache-2.0): an ORIGINAL announcer voice designed from a written description
(no reference recording, no real performer). Renders audition reels to samples/QWEN_*.wav
Usage: .venv-qwen/Scripts/python.exe qwen_design.py [take_count]"""
import os, sys
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'samples')

# Our own description of the character (not based on anyone real or any existing game).
VOICE = ("A young adult Japanese woman, the announcer of a flashy 1990s-style arcade fighting game. "
         "Bright, fairly high, clear voice with a cute but fierce, confident attitude. "
         "Playful and flirty, teasing the players, then explosive and powerful on the big words. "
         "Very energetic and theatrical, studio-quality recording.")

# (line, delivery direction)
LINES = [
    ('うふふ…準備はいい?ファイト!', 'Starts with a sly, teasing giggle, then shouts FIGHT with huge energy, stretching the vowel.'),
    ('ラウンド…ワン!', 'Dramatic: a slow, drawn-out build-up on "round", then a loud, punchy "one!"'),
    ('ふふっ…ちょっと…本気出して?', 'Teasing and flirty, a little mocking, playful pout.'),
    ('ボッコボコ!あはっ!', 'Fierce and gleeful, then a short laugh.'),
    ('ケー・オー!あらら…もうおしまい?', 'Shouts K.O. at full power, then switches to a teasing, mock-disappointed tone.'),
    ('うふっ…まだまだ…甘いわね!', 'Smug and confident, ending sharp and fierce.'),
    ('スティンキー・タビ…ウィン!パーフェクト!', 'Hyped victory call, getting louder, "perfect" is the biggest shout.'),
    ('超必殺技!ジムバッグ・ギャラクシー!', 'Explosive, intense super-move call.'),
    ('警告!ボス出現!ドライヤー・デーモン!', 'Urgent and dramatic warning, rising tension.'),
    ('はぁ…かわいいね…かかってきなさい!', 'A soft flirty sigh, then a fierce, confident challenge.'),
]

model = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0',
                                      dtype=torch.bfloat16, attn_implementation='sdpa')
takes = int(sys.argv[1]) if len(sys.argv) > 1 else 2
for take in range(takes):
    reel, sr = [], None
    for i, (text, direction) in enumerate(LINES):
        torch.manual_seed(1000 * take + i)
        wavs, sr = model.generate_voice_design(text=text, language='Japanese', instruct=VOICE + ' Delivery: ' + direction)
        y = np.asarray(wavs[0], dtype=np.float32)
        reel += [y / (np.max(np.abs(y)) or 1) * 0.89, np.zeros(int(sr * 0.5), dtype=np.float32)]
        print(f'take {take + 1} line {i + 1}: {len(y) / sr:.2f}s', flush=True)
    sf.write(os.path.join(OUT, f'QWEN_design_take{take + 1}.wav'), np.concatenate(reel), sr)
print('sample rate', sr)
