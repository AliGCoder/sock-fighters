"""The take-2 announcer voice (designed with Qwen3-TTS VoiceDesign from a written description), reproduced
consistently with the Qwen3-TTS Base model: every clip continues from a reference line of take 2, so the
voice stays the same. Teasing beats use a teasing reference, shouts use an explosive one."""
import os
import numpy as np, torch
from qwen_tts import Qwen3TTSModel

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 24000

REFS = {  # role -> (take-2 reference clip, its exact text)
    'shout': ('refs/take2_line07.wav', 'スティンキー・タビ…ウィン!パーフェクト!'),
    'tease': ('refs/take2_line06.wav', 'うふっ…まだまだ…甘いわね!'),
    'hype': ('refs/take2_line01.wav', 'うふふ…準備はいい?ファイト!'),
}
TEASE_WORDS = ('ふふ', 'うふ', 'あらら', 'はぁ', 'ちょっと', 'まだまだ', 'かわいい', 'もうおしまい', '本気出して', 'あはっ')

_model, _prompts = None, {}


def model():
    global _model
    if _model is None:
        _model = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0',
                                               dtype=torch.bfloat16, attn_implementation='sdpa')
    return _model


def prompt(role):
    if role not in _prompts:
        path, text = REFS[role]
        _prompts[role] = model().create_voice_clone_prompt(ref_audio=os.path.join(HERE, path), ref_text=text)
    return _prompts[role]


def role_for(text):
    if any(w in text for w in TEASE_WORDS) or text.endswith('?'):
        return 'tease'
    if '|' in text or text.endswith('!'):
        return 'shout'
    return 'hype'  # build-ups ("ラウンド…") and super-move names


def say(text, seed=0, role=None):
    """Synthesize one clip (beats joined with a short pause). Returns float32 mono at 24 kHz."""
    torch.manual_seed(seed)
    spoken = text.replace('|', '')
    wavs, sr = model().generate_voice_clone(text=spoken, language='Japanese', voice_clone_prompt=prompt(role or role_for(text)))
    assert sr == SR
    return np.asarray(wavs[0], dtype=np.float32)
