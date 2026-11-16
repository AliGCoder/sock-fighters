#!/usr/bin/env bash
# Record the new and changed Episode 1 lines (only lines with no voice yet), pack every story voice (Lefty's too),
# and put the fight shouts (Lefty's) and announcer names into the game.
#   bash tools/story/record_ep1.sh
set -e
cd "$(dirname "$0")"
QWEN=../announcer/.venv-qwen/Scripts/python.exe
VOX=../announcer/.venv-vox/Scripts/python.exe
export PYTHONIOENCODING=utf-8
echo "== 1. lines and jobs"
node extract.js
node prep.js
echo "== 2. narrator"
$QWEN sparkle_narr.py
echo "== 3. everyone else (VoxCPM2)"
$VOX vox_story.py
echo "== 4. pack voices/*.js"
for i in 1 2 3 4 5; do node pack.js && break; sleep 5; done
echo "== 5. fight shouts and announcer"
cd ../announcer
for i in 1 2 3 4 5; do node inject.js fighter && break; sleep 5; done
echo "== all recorded"
