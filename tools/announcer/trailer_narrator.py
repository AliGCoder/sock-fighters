"""The promo trailer's narrator: an ORIGINAL deep, gravelly movie-trailer voice (designed with Qwen3-TTS VoiceDesign,
nobody real), then every line cloned from it so the voice stays the same. Writes ../trailer/out/narr_<n>.wav and a
reel samples/TRAILER_narrator.wav."""
import os, sys, zlib, json
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'trailer', 'out')
DESC = ('A deep, gravelly, booming male movie-trailer narrator in his fifties: a huge, resonant bass voice, slow and '
        'dramatic with weighty pauses, epic and deadly serious, theatrical, like announcing a blockbuster. Close-mic '
        'studio recording, completely dry, no reverb or echo.')
REF = 'In a world... where nothing is what it seems... one hero... will rise.'
LINES = json.loads(sys.argv[1])
ref = os.path.join(HERE, 'refs', 'trailer_narrator.wav')
if not os.path.exists(ref):  # design his voice once; after that every line keeps the same voice
    design = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
    best, best_tail = None, 9
    for take in range(4):
        torch.manual_seed(5150 + take)
        wavs, _ = design.generate_voice_design(text=REF, language='English', instruct=DESC)
        y = np.asarray(wavs[0], dtype=np.float32)
        tail = QF.echo_tail(y)
        if tail < best_tail:
            best, best_tail = y, tail
    sf.write(ref, best, QF.SR)
    del design
    torch.cuda.empty_cache()
base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
prompt = base.create_voice_clone_prompt(ref_audio=ref, ref_text=REF)
reel = []
for i, text in enumerate(LINES):
    torch.manual_seed(zlib.crc32(f'narr|{i}'.encode()))
    wavs, _ = base.generate_voice_clone(text=text, language='English', voice_clone_prompt=prompt)
    y = QF.trim(np.asarray(wavs[0], dtype=np.float32))
    y = y / (np.abs(y).max() + 1e-6) * 0.9
    sf.write(os.path.join(OUT, f'narr_{i}.wav'), y, QF.SR)
    reel += [y, np.zeros(int(QF.SR * 0.6))]
    print(f'{i}: {len(y) / QF.SR:.1f}s  {text}', flush=True)
sf.write(os.path.join(HERE, 'samples', 'TRAILER_narrator.wav'), np.concatenate(reel), QF.SR)
