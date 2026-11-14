# Story voices

Every story-mode line is spoken in its character's own voice. The recordings live outside `index.html`, in
`voices/story.js` (everyone) and `voices/hero-<id>.js` (the lines your chosen hero says), so the game stays small and
a phone only downloads what it needs. The game loads them with `StoryVoices` in `index.html`; a line without a
recording falls back to a short grunt or catchphrase.

## Re-recording after the story changes

Run from `C:\SockFighters`:

1. `node tools/story/extract.js` reads every scene's lines out of the game into `lines_raw.json`.
2. `node tools/story/prep.js` turns them into recording jobs (`jobs.json`). The lines are spoken in **Japanese**: `ja.js` has one translation per line of `to_translate.txt` (`node tools/story/prep.js --list` rewrites that list after the story changes, then add the new translations to `ja.js` in the same order). prep.js also:
   - adds a delivery note per line (the voice's personality plus the line's mood);
   - makes one copy of every hero line for each of the 17 heroes.
3. The narrator is SPARKLE, the fight announcer: `cd tools/story`, then `../announcer/.venv-qwen/Scripts/python.exe sparkle_narr.py` records the narrator lines first. Then `../announcer/.venv-vox/Scripts/python.exe vox_story.py` records with
   [VoxCPM2](https://huggingface.co/openbmb/VoxCPM2) (Apache-2.0). It takes about an hour for everything on an RTX 5080.
   It only records lines that are new or changed, so after a small script edit it takes a minute.
4. `node tools/story/pack.js` writes the `voices/*.js` files.

Each character's voice is cloned from their fight voice (`tools/announcer/refs/fighter_<id>.wav`). Queen Nylonia has her own voice (`refs/queen_option_2.wav`, picked from three designed by `queen_voices.py`), and the Fishnet Scout's was designed by `qwen_story.py` (`refs/story_fishnet.wav`). All voices are original, and none is based on a real person.

Listen to `samples/STORY_<voice>.wav` to check a voice.
