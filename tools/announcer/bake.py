"""Generate every announcer beat (lines.json) with Kokoro + sparkle chain -> clips.json {beat: base64 mp3}.
Usage: python bake.py [preset] [kbps]   (presets in voice.PRESETS; default 'v1' = the approved REEL_jf_alpha_sparkle sound)"""
import base64, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
import soundfile as sf
import voice as V

HERE = os.path.dirname(os.path.abspath(__file__))
preset = V.PRESETS[sys.argv[1] if len(sys.argv) > 1 else 'v1']
kbps = int(sys.argv[2]) if len(sys.argv) > 2 else 48
lines = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf-8'))
wavdir = os.path.join(HERE, 'baked_wav'); os.makedirs(wavdir, exist_ok=True)
out, total, secs = {}, 0, 0.0
for i, beat in enumerate(lines):
    y = V.render_beat(beat, preset)
    sf.write(os.path.join(wavdir, f'{i:03d}.wav'), y, V.SR)
    mp3 = V.mp3_bytes(y, kbps)
    out[beat] = base64.b64encode(mp3).decode('ascii')
    total += len(out[beat]); secs += len(y) / V.SR
    print(f'{i:3d} {len(y)/V.SR:5.2f}s {beat}')
json.dump(out, open(os.path.join(HERE, 'clips.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(f'{len(out)} clips, {secs:.1f}s audio, {total/1e6:.2f} MB base64')
