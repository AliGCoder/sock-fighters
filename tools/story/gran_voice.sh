#!/usr/bin/env bash
# Stocking Gran is 98: redesign her fight voice (a very, very old woman), redo her catchphrase, then re-record every story
# line she speaks (plus the lines about her age) and pack it all into the game.
#   bash tools/story/gran_voice.sh
set -e
cd "$(dirname "$0")"
QWEN=../announcer/.venv-qwen/Scripts/python.exe
VOX=../announcer/.venv-vox/Scripts/python.exe
echo "== 1. Gran's fight voice (98 years old)"
cd ../announcer
$QWEN qwen_fighters.py gran  # her voice: refs/fighter_gran.wav (pick a new one with --redesign: 10 designs, the oldest-sounding wins)
$QWEN qwen_catchphrases.py gran
cd ../story
echo "== 2. story lines"
node extract.js
node prep.js
node -e "
const fs = require('fs');
const jobs = JSON.parse(fs.readFileSync('jobs.json', 'utf8'));
const clips = JSON.parse(fs.readFileSync('story_clips.json', 'utf8'));
let n = 0;
for (const j of jobs) if (j.voice === 'gran' && clips[j.key]) { delete clips[j.key]; n++; }
fs.writeFileSync('story_clips.json', JSON.stringify(clips));
console.log('cleared ' + n + ' old Gran lines');
"
$QWEN qwen_char.py gran  # every Gran line, cloned from her approved voice (the same engine as GRAN_SAMPLE.wav)
echo "== 3. pack"
node pack.js
cd ../announcer
node inject.js fighter
echo "== Gran recorded"
