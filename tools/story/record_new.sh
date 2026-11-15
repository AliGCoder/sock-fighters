#!/usr/bin/env bash
# Record every new story line (and the new villains' announcer names), then pack them into the game.
# Run from C:\SockFighters after the fight voices exist (tools/announcer/qwen_fighters.py <ids>).
#   bash tools/story/record_new.sh [villain ids recorded with their fight voice...]
set -e
cd "$(dirname "$0")"
QWEN=../announcer/.venv-qwen/Scripts/python.exe
VOX=../announcer/.venv-vox/Scripts/python.exe
echo "== 1. lines and jobs"
node extract.js
node prep.js
echo "== 2. narrator (SPARKLE)"
$QWEN sparkle_narr.py
echo "== 3. new villains in their own fight voices"
for id in "$@"; do $QWEN qwen_char.py "$id"; done
echo "== 4. everyone else (VoxCPM2)"
$VOX vox_story.py
echo "== 5. pack voices/*.js"
node pack.js
echo "== 6. announcer: new names and super moves"
cd ../announcer
node extract_lines.js
$QWEN qwen_bake.py --missing
node inject.js
node inject.js fighter
echo "== all recorded"
