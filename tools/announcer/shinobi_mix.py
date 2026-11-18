"""Sample: Toe-Shinobi as a cold, brooding, aloof young rival ninja (our own original voice, nobody real).
Three designed voices (A, B, C), each says the same lines: quiet ones and fight shouts. samples/SHINOBI_mix.wav"""
import os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF
HERE = os.path.dirname(os.path.abspath(__file__))
DESC = ('A young Japanese man of about twenty, a lone ninja: a low, quiet, cool voice that is cold and brooding like an aloof rival '
        'and flat and deadpan like a bored assassin: calm monotone, curt and blunt, a dismissive "hmph", says very few words, '
        'very mysterious and unreadable; in battle his shouts are short, sharp and fierce. Close-mic studio '
        'recording, completely dry, no reverb or echo.')
REF = 'ふん…くだらない。俺の邪魔をするな。…はあっ!'
LINES = ['ふん…', '…遅い。', 'はっ!', 'せいっ!', 'くらえ!', '影分身の術!', '…弱すぎる。',
         '女王陛下…リント団に仲間をさらわれました。魔王のところへ連れていかれます。']
design = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
refs = {}
for n, tag in enumerate('E'):
    best, best_tail = None, 9.0
    for take in range(3):
        torch.manual_seed(9950 + 41 * n + take)
        wavs, _ = design.generate_voice_design(text=REF, language='Japanese', instruct=DESC)
        y = np.asarray(wavs[0], dtype=np.float32)
        tail = QF.echo_tail(y)
        if tail < best_tail:
            best, best_tail = y, tail
    refs[tag] = os.path.join(HERE, 'refs', f'shinobi_cold_{tag}.wav')
    sf.write(refs[tag], best, QF.SR)
    print('designed', tag, flush=True)
del design
torch.cuda.empty_cache()
base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
reel = []
for tag, path in refs.items():
    prompt = base.create_voice_clone_prompt(ref_audio=path, ref_text=REF)
    for j, text in enumerate(LINES):
        for attempt in range(4):
            torch.manual_seed(zlib.crc32(f'cold|{tag}|{j}|{attempt}'.encode()))
            wavs, _ = base.generate_voice_clone(text=text, language='Japanese', voice_clone_prompt=prompt)
            y = QF.finish(wavs[0], None)
            if QF.plausible(text, y):
                break
        reel += [y * 0.89, np.zeros(int(QF.SR * 0.4))]
    reel.append(np.zeros(int(QF.SR * 1.5)))
    print(tag, 'done', flush=True)
sf.write(os.path.join(HERE, 'samples', 'SHINOBI_mix.wav'), np.concatenate(reel), QF.SR)
print('done')
