#!/usr/bin/env bash
# Lefty, the Lost Glove: every story line in his approved voice (refs/fighter_lefty.wav), then pack the story voices
# and put his (and everyone's) fight shouts into the game.
#   bash tools/story/record_lefty.sh
set -e
cd "$(dirname "$0")"
QWEN=../announcer/.venv-qwen/Scripts/python.exe
export PYTHONIOENCODING=utf-8
echo "== 1. Lefty's story lines"
node -e "
const fs = require('fs');
const jobs = JSON.parse(fs.readFileSync('jobs.json', 'utf8'));
const clips = JSON.parse(fs.readFileSync('story_clips.json', 'utf8'));
let n = 0;
for (const j of jobs) if (j.voice === 'lefty' && clips[j.key]) { delete clips[j.key]; n++; } // (any from an old sample)
fs.writeFileSync('story_clips.json', JSON.stringify(clips));
console.log('cleared ' + n + ' old Lefty lines');
"
$QWEN qwen_char.py lefty
echo "== 2. pack"
node pack.js
cd ../announcer
node inject.js fighter
echo "== Lefty recorded"
