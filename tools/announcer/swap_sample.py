"""Sample: Stinky and Argyle with their voices swapped (Stinky's lines in the voice that was Argyle's, and the other
way round), so the user can approve before everything is re-recorded. Writes samples/SWAP_stinky_argyle.wav."""
import os, sys, zlib
import numpy as np, soundfile as sf, torch
sys.stdout.reconfigure(encoding='utf-8')
from qwen_tts import Qwen3TTSModel
import qwen_fighters as QF

HERE = os.path.dirname(os.path.abspath(__file__))
base = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                     dtype=torch.bfloat16, attn_implementation='sdpa')
LINES = {
    'stinky': [('Japanese', 'においで勝負だ!'), ('Japanese', 'これがオレの全力だあっ!'), ('Japanese', 'よっしゃあ!'),
               ('English', "I'm a sock! I'm supposed to be wrinkly!")],
    'argyle': [('Japanese', '靴下の道、いざ参る!'), ('Japanese', '一刀両断!'), ('Japanese', '成敗!'),
               ('English', 'The way of the sock... here I come!')],
}
reel = []
for who, voice in [('stinky', 'argyle'), ('argyle', 'stinky')]:
    prompt = base.create_voice_clone_prompt(ref_audio=os.path.join(HERE, 'refs', f'fighter_{voice}.wav'), ref_text=QF.ref_line(voice))
    for j, (lang, text) in enumerate(LINES[who]):
        for attempt in range(4):
            torch.manual_seed(zlib.crc32(f'swap|{who}|{j}|{attempt}'.encode()))
            wavs, _ = base.generate_voice_clone(text=text, language=lang, voice_clone_prompt=prompt)
            y = QF.finish(wavs[0], None)
            if lang != 'Japanese' or QF.plausible(text, y):
                break
        reel += [y * 0.89, np.zeros(int(QF.SR * 0.5))]
        print(f'{who} (in {voice} voice): {text}', flush=True)
    reel.append(np.zeros(int(QF.SR * 1.0)))
sf.write(os.path.join(HERE, 'samples', 'SWAP_stinky_argyle.wav'), np.concatenate(reel), QF.SR)
print('done')
