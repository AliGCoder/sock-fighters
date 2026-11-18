"""Sample: Toe-Shinobi as a MAN with a mysterious voice: three designed takes (A, B, C)
mysterious takes (A, B, C), each saying the same lines, so the user can pick one before anything is re-recorded.
Writes samples/SHINOBI_male.wav and refs/shinobi_try_<A|B|C>.wav (the candidate reference voices)."""
import os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF

HERE = os.path.dirname(os.path.abspath(__file__))
DESC = ('A Japanese man in his twenties, a mysterious ninja (shinobi) who lives in the shadows. Low, hushed, smoky and '
        'enigmatic voice, speaks slowly and quietly with knowing pauses, as if sharing a secret, a faint amused '
        'half-smile in his voice, calm and unreadable, never loud. Close-mic studio recording, completely dry, no '
        'reverb or echo.')
REF = '…影は語らぬ。俺はどこにでもいて…どこにもいない。…ふっ。'
LINES = [('Japanese', '影分身の術!'), ('Japanese', 'ふっ…'), ('Japanese', '任務完了。'),
         ('Japanese', '女王陛下…リント団に仲間をさらわれました。魔王のところへ連れていかれます。'),
         ('Japanese', '…背後に気をつけろ。影はいつも、おまえを見ている。')]

# 1) design three mysterious candidates
design = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0',
                                       dtype=torch.bfloat16, attn_implementation='sdpa')
refs = {}
for n, tag in enumerate('ABC'):
    best, best_tail = None, 9.0
    for take in range(3):
        torch.manual_seed(9400 + 37 * n + take)
        wavs, _ = design.generate_voice_design(text=REF, language='Japanese', instruct=DESC)
        y = np.asarray(wavs[0], dtype=np.float32)
        tail = QF.echo_tail(y)
        if tail < best_tail:
            best, best_tail = y, tail
    path = os.path.join(HERE, 'refs', f'shinobi_male_{tag}.wav')
    sf.write(path, best, QF.SR)
    refs[tag] = (path, REF)
    print(f'designed {tag} (echo tail {best_tail * 1000:.0f} ms)', flush=True)
del design
torch.cuda.empty_cache()

# 2) every voice (current one first) says the same lines
base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                     dtype=torch.bfloat16, attn_implementation='sdpa')
voices = list(refs.items())
reel = []
for tag, (path, text0) in voices:
    prompt = base.create_voice_clone_prompt(ref_audio=path, ref_text=text0)
    for j, (lang, text) in enumerate(LINES):
        for attempt in range(4):
            torch.manual_seed(zlib.crc32(f'shin|{tag}|{j}|{attempt}'.encode()))
            wavs, _ = base.generate_voice_clone(text=text, language=lang, voice_clone_prompt=prompt)
            y = QF.finish(wavs[0], None)
            if QF.plausible(text, y):
                break
        reel += [y * 0.89, np.zeros(int(QF.SR * 0.5))]
    print(f'{tag}: done', flush=True)
    reel.append(np.zeros(int(QF.SR * 1.5)))
sf.write(os.path.join(HERE, 'samples', 'SHINOBI_male.wav'), np.concatenate(reel), QF.SR)
print('done')
