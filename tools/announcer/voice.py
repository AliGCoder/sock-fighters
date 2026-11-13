"""Kokoro-82M (Apache-2.0) Japanese TTS + "sparkle" processing chain.

raw TTS -> trim silence -> formant-preserving pitch shift + speed-up (Praat PSOLA via parselmouth)
-> gentle brightness shelf -> peak-normalize to -1 dBFS.
"""
import numpy as np
import parselmouth
from parselmouth.praat import call
from scipy.signal import lfilter

SR = 24000
_pipe = None


def pipeline():
    global _pipe
    if _pipe is None:
        # spaCy is only used by Kokoro's English G2P; its DLLs are blocked by Windows
        # Smart App Control here, so give the import a harmless stand-in (Japanese doesn't touch it).
        import sys, types
        try:
            import spacy  # noqa: F401
        except Exception:
            sys.modules['spacy'] = types.ModuleType('spacy')
        from kokoro import KPipeline
        _pipe = KPipeline(lang_code='j', repo_id='hexgrad/Kokoro-82M')
    return _pipe


READ = {'もう一回!': 'もういっかい!'}  # kana readings where the G2P misreads kanji


def tts_text(beat):
    # Kokoro reads "…" fine but a plain sentence end gives cleaner prosody; "!"/"?" kept for energy.
    t = READ.get(beat, beat).replace('…', '。').replace('!', '!').replace('?', '?')
    if not t.endswith(('!', '?', '。')):
        t += '!'
    return t


def synth(text, voice='jf_alpha', speed=1.0):
    chunks = [a.numpy() if hasattr(a, 'numpy') else np.asarray(a)
              for _, _, a in pipeline()(text, voice=voice, speed=speed)]
    return np.concatenate(chunks).astype(np.float64) if chunks else np.zeros(1)


def trim(x, db=-38, pad_ms=25):
    env = np.convolve(np.abs(x), np.ones(240) / 240, mode='same')
    thr = np.max(env) * 10 ** (db / 20)
    idx = np.where(env > thr)[0]
    if not len(idx):
        return x
    p = int(SR * pad_ms / 1000)
    return x[max(0, idx[0] - p): idx[-1] + p]


def pitch_speed(x, semis=4.0, speed=1.1, formant=1.0, range_factor=1.25):
    snd = parselmouth.Sound(x, sampling_frequency=SR)
    pitch = snd.to_pitch(0.01, 120, 600)
    f0 = call(pitch, 'Get quantile', 0, 0, 0.5, 'Hertz')
    if not np.isfinite(f0) or f0 <= 0:
        f0 = 220.0
    out = call(snd, 'Change gender', 120, 600, formant, f0 * 2 ** (semis / 12), range_factor, 1 / speed)
    y = out.values[0]
    return y


def high_shelf(x, gain_db=3.0, f0=3200.0):
    # RBJ cookbook high shelf (S=1)
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; c, s = np.cos(w), np.sin(w)
    al = s / 2 * np.sqrt(2)
    b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c),
         A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)]
    a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c),
         (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x)


def fade(x, ms=6):
    n = min(len(x) // 4, int(SR * ms / 1000))
    if n > 1:
        r = np.linspace(0, 1, n); x = x.copy(); x[:n] *= r; x[-n:] *= r[::-1]
    return x


def normalize(x, dbfs=-1.0):
    pk = np.max(np.abs(x)) or 1.0
    return x * (10 ** (dbfs / 20) / pk)


# Processing presets. "speed" here is applied by Kokoro itself (natural), "stretch" by PSOLA afterwards.
PRESETS = {
    'v1':      dict(voice='jf_alpha', kspeed=1.0,  stretch=1.1, semis=4.0, formant=1.0,  rng=1.25, bright=3.0),
    'natural': dict(voice='jf_alpha', kspeed=1.12, stretch=1.0, semis=3.0, formant=1.04, rng=1.35, bright=2.5),
    'lively':  dict(voice='jf_alpha', kspeed=1.15, stretch=1.0, semis=3.5, formant=1.05, rng=1.6,  bright=3.0),
    'blend':   dict(voice='jf_alpha,jf_alpha,jf_gongitsune', kspeed=1.15, stretch=1.0, semis=3.5, formant=1.05, rng=1.5, bright=3.0),
}


# Arcade delivery: payoff beats ("…!") shouted with stretched vowels, higher and with a wider pitch swing;
# build-up beats ("…") a little slower and steadier so the payoff lands harder.
# (spellings chosen so the G2P keeps the long vowel inside the word: ファイトオ -> "faitoo", not "faito ː")
SHOUT = {'ファイト!': 'ファイトオ!', 'ケー・オー!': 'ケーオー!', 'パーフェクト!': 'パーフェクトオ!', 'クリア!': 'クリアー!',
         'ワン!': 'ワァン!', 'ゲーム!': 'ゲーーム!', 'アウト!': 'アウトオ!', 'ウィン!': 'ウィーン!', 'チャンピオン!': 'チャンピオーン!'}
PRESETS['arcade'] = dict(roles=True, voice='jf_alpha,jf_alpha,jf_gongitsune', kspeed=1.15, stretch=1.0, semis=3.5, formant=1.05, rng=1.5, bright=3.0)


# Delivery presets for the "announcer with more attitude" audition (all pure jf_alpha).
# A preset may override settings for build-up beats (ending in "…") and payoff beats (everything else),
# and 'shout' uses the stretched-vowel spellings in SHOUT for payoffs.
V1 = PRESETS['v1']
PRESETS['theatrical'] = dict(V1, buildup=dict(kspeed=0.86, stretch=1.0, rng=1.1),
                             payoff=dict(semis=5.0, rng=1.7), shout=True)
PRESETS['confident'] = dict(V1, semis=1.5, stretch=1.05, formant=0.98, rng=1.35, bright=1.5,
                            buildup=dict(kspeed=0.94), payoff=dict(semis=2.0, rng=1.5))
PRESETS['playful'] = dict(V1, semis=5.0, kspeed=1.05, stretch=1.08, formant=1.03, rng=1.75,
                          payoff=dict(rng=1.95, semis=5.5))
# everything: theatrical delivery + playful pitch swing + smoother tone (pitch between confident and playful);
# the arena echo is added on top (samples3.py style 'mix')
PRESETS['mix'] = dict(V1, semis=4.0, kspeed=1.03, stretch=1.08, formant=1.01, rng=1.7, bright=2.0,
                      buildup=dict(kspeed=0.88, stretch=1.0, rng=1.25),
                      payoff=dict(semis=5.0, rng=1.95), shout=True)


# flirty + edgy: teasing build-ups (lower, slower, slides around, a little softer),
# then high shouted payoffs with grit (soft saturation + presence) — plus theatrical stretch and big pitch swings.
PRESETS['flirty'] = dict(V1, semis=4.0, kspeed=1.0, stretch=1.06, formant=1.02, rng=1.7, bright=2.0,
                         buildup=dict(semis=3.0, kspeed=0.86, stretch=1.0, rng=1.55), soft_buildup=True,
                         payoff=dict(semis=5.0, rng=2.0), shout=True, edge=True)


# flirty v2 (after audition): more teasing, higher & cuter, less grit, bigger & longer shouts.
# Longer shouts come from slowing the payoff (stretch < 1) plus spellings that stay one word for the G2P.
SHOUT_LONG = dict(SHOUT, **{'ケー・オー!': 'ケーオーー!', 'ウィン!': 'ウィーーン!', 'チャンピオン!': 'チャンピオーーン!', 'ゲーム!': 'ゲーーーム!'})
PRESETS['flirty2'] = dict(V1, semis=5.5, kspeed=1.0, stretch=1.06, formant=1.06, rng=1.75, bright=2.0,
                          buildup=dict(semis=4.5, kspeed=0.8, stretch=1.0, rng=1.85), soft_buildup=True, soft_db=-3.5,
                          payoff=dict(semis=6.5, rng=2.0, stretch=0.88), shout=True, shout_map=SHOUT_LONG,
                          edge=True, edge_drive=2.0, edge_mix=0.12)


# flirty v3 "fiercer": build-ups less whispery and a bit quicker (menacing rather than sultry),
# payoffs with a wider swing, more bite (between v1 and v2 grit) and "punch" (denser, louder-sounding).
PRESETS['fierce'] = dict(PRESETS['flirty2'], soft_db=-1.5,
                         buildup=dict(semis=4.5, kspeed=0.86, stretch=1.0, rng=1.85),
                         payoff=dict(semis=6.5, rng=2.25, stretch=0.88),
                         edge_drive=2.6, edge_mix=0.22, punch=0.72)


def punch(y, amount):
    """Squeeze loud and quiet parts closer together (amount < 1 = more), so the shout hits harder."""
    return normalize(np.sign(y) * np.abs(y) ** amount)


def edge(y, drive=3.0, mix=0.35):
    """Grit: blend in a soft-saturated copy and lift the 'bite' frequencies."""
    sat = np.tanh(drive * y) / np.tanh(drive)
    y = (1 - mix) * y + mix * sat
    return normalize(high_shelf(y, 2.0, 2500))


def render_beat(beat, p):
    if 'buildup' in p or 'payoff' in p:
        is_buildup = beat.endswith('…')
        q = dict(p, **(p.get('buildup', {}) if is_buildup else p.get('payoff', {})))
        text = beat if is_buildup or not p.get('shout') else p.get('shout_map', SHOUT).get(beat, beat)
        y = render(tts_text(text), q)
        if is_buildup and p.get('soft_buildup'):
            y = normalize(high_shelf(y, p.get('soft_db', -2.5), 3000))  # softer, more intimate
        if not is_buildup and p.get('edge'):
            y = edge(y, p.get('edge_drive', 3.0), p.get('edge_mix', 0.35))
        if not is_buildup and p.get('punch'):
            y = punch(y, p['punch'])
        return y
    if not p.get('roles'):  # plain presets (e.g. v1) render every beat the same way
        return render(tts_text(beat), p)
    if beat.endswith('…'):  # build-up
        q = dict(p, kspeed=p['kspeed'] - 0.08, rng=p['rng'] - 0.2)
        return render(tts_text(beat), q)
    q = dict(p, semis=p['semis'] + 0.7, rng=p['rng'] + 0.35)  # payoff
    return render(tts_text(SHOUT.get(beat, beat)), q)


def render(text, p):
    return sparkle(synth(text, p['voice'], p['kspeed']), p['semis'], p['stretch'], p['formant'], p['bright'], p['rng'])


def sparkle(raw, semis=4.0, speed=1.1, formant=1.0, bright=3.0, rng=1.25):
    y = trim(raw)
    y = pitch_speed(y, semis, speed, formant, rng)
    y = trim(y, db=-42, pad_ms=15)
    y = high_shelf(y, bright)
    return normalize(fade(y))


def mp3_bytes(x, kbps=48):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    return enc.encode(pcm) + enc.flush()
