#!/usr/bin/env bash
# Record every story line that has no voice yet, in the voices that are already approved (Lefty waits for his OK),
# then pack them into the game and teach the announcer the new names (Lefty and his super move).
#   bash tools/story/record_ch3.sh
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
echo "== 3. characters recorded in their fight voices (only lines with no voice yet)"
for id in gran tapper skate galosh studs mismatch mitten bigboot lace slipper flipflop stiletto puppet; do $QWEN qwen_char.py "$id"; done
echo "== 4. everyone else (VoxCPM2)"
$VOX vox_story.py
echo "== 5. pack voices/*.js"
node pack.js
echo "== 6. announcer: new names and super moves"
cd ../announcer
node extract_lines.js
$QWEN qwen_bake.py --missing
node inject.js
echo "== all recorded"
