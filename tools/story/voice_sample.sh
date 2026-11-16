#!/usr/bin/env bash
# A SAMPLE of a character's voice, to approve BEFORE recording all of their lines: their fight shouts, then N of
# their story lines, in one listening file. It uses its own files (jobs_sample.json, clips_sample.json), so it is
# safe to run while a big recording is going.
#   REDESIGN=--redesign bash tools/story/voice_sample.sh lefty [lines=6]   ->  tools/story/samples/<ID>_SAMPLE.wav
set -e
cd "$(dirname "$0")"
ID=$1
N=${2:-6}
QWEN=../announcer/.venv-qwen/Scripts/python.exe
export PYTHONIOENCODING=utf-8
cd ../announcer
$QWEN qwen_fighters.py "$ID" $REDESIGN 2>&1 | grep -E "take|designed|clips|rror" || true
cd ../story
node -e "
const fs = require('fs');
const mine = require('./jobs.json').filter(j => j.voice === '$ID').slice(0, $N);
fs.writeFileSync('jobs_sample.json', JSON.stringify(mine));
fs.writeFileSync('clips_sample.json', '{}');
"
$QWEN qwen_char.py "$ID" --jobs jobs_sample.json --out clips_sample.json 2>&1 | grep -E "^\[|rror" || true
$QWEN -c "
import json, base64, io, numpy as np, soundfile as sf, librosa
SR = 24000
dec = lambda b: librosa.load(io.BytesIO(base64.b64decode(b)), sr=SR, mono=True)[0]
fc = json.load(open('../announcer/fighter_clips.json', encoding='utf-8'))['$ID']
gap = np.zeros(int(SR * 0.6)); reel = []
for w in ['light', 'heavy', 'special', 'superv', 'hurtBig', 'ko', 'laugh', 'win']:
    if w in fc: reel += [dec(fc[w][0]), gap]
reel.append(np.zeros(SR))
clips = json.load(open('clips_sample.json', encoding='utf-8'))
for j in json.load(open('jobs_sample.json', encoding='utf-8')):
    if j['key'] in clips: reel += [dec(clips[j['key']]), gap]
y = np.concatenate(reel); y = y / np.max(np.abs(y)) * 0.9
sf.write('samples/$(echo $ID | tr a-z A-Z)_SAMPLE.wav', y, SR); print('sample:', round(len(y) / SR), 'seconds')
" 2>&1 | grep -v -i warn
rm -f jobs_sample.json clips_sample.json
