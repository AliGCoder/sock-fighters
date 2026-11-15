#!/usr/bin/env bash
# A SAMPLE of Stocking Gran's voice to approve BEFORE recording everything (tools/story/gran_voice.sh):
# her fight shouts + catchphrase, and 6 story lines (3 about her back, 3 normal), into one listening file.
#   bash tools/story/gran_sample.sh [--redesign]      ->  tools/story/samples/GRAN_SAMPLE.wav
set -e
cd "$(dirname "$0")"
QWEN=../announcer/.venv-qwen/Scripts/python.exe
VOX=../announcer/.venv-vox/Scripts/python.exe
export PYTHONIOENCODING=utf-8
cd ../announcer
$QWEN qwen_fighters.py gran "$@" 2>&1 | grep -E "take|designed|clips|rror" || true
$QWEN qwen_catchphrases.py gran 2>&1 | grep -E "saved|rror" || true
cd ../story
node extract.js > /dev/null
node prep.js > /dev/null
cp jobs.json jobs_all.json
node -e "
const fs = require('fs');
const gran = require('./jobs.json').filter(j => j.voice === 'gran');
const pick = [...gran.filter(j => /いったぁ/.test(j.say)).slice(0, 3), ...gran.filter(j => !/いったぁ/.test(j.say) && /sassy/.test(j.note)).slice(0, 7)];
const clips = JSON.parse(fs.readFileSync('story_clips.json', 'utf8'));
for (const j of pick) delete clips[j.key];
fs.writeFileSync('story_clips.json', JSON.stringify(clips));
fs.writeFileSync('jobs.json', JSON.stringify(pick));
fs.writeFileSync('sample_keys.json', JSON.stringify(pick.map(j => j.key)));
"
$QWEN qwen_char.py gran 2>&1 | grep -E "^\[|rror" || true  # Qwen, cloned from her (angry) fight voice
mv jobs_all.json jobs.json
$QWEN -c "
import json, base64, io, numpy as np, soundfile as sf, librosa
SR = 24000
dec = lambda b: librosa.load(io.BytesIO(base64.b64decode(b)), sr=SR, mono=True)[0]
fc = json.load(open('../announcer/fighter_clips.json', encoding='utf-8'))['gran']
gap = np.zeros(int(SR * 0.6)); reel = []
for c in fc['nag']: reel += [dec(c), gap]
reel.append(np.zeros(SR))
for w, i in [('heavy', 0), ('special', 0), ('superv', 0), ('hurtBig', 1), ('ko', 0), ('win', 0), ('catchphrase', 0)]:
    reel += [dec(fc[w][i]), gap]
reel.append(np.zeros(SR))
clips = json.load(open('story_clips.json', encoding='utf-8'))
for k in json.load(open('sample_keys.json')): reel += [dec(clips[k]), gap]
y = np.concatenate(reel); y = y / np.max(np.abs(y)) * 0.9
sf.write('samples/GRAN_SAMPLE.wav', y, SR); print('sample:', round(len(y) / SR), 'seconds')
" 2>&1 | grep -v -i warn
rm -f sample_keys.json
