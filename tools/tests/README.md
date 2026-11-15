# Bug check

Run before every publish, from `C:\SockFighters`:

    node tools/tests/run_all.js          # everything (about 10 minutes)
    node tools/tests/run_all.js quick    # everything except the full 5-chapter story playthrough

It plays the game in a real browser (headless Chromium and WebKit, via the Playwright install in tools/announcer) and checks:
- sound reaches the speakers: the announcer (SPARKLE) and fighter voices play,
- story mode from start to finish, story voices on PC/iPhone/Android,
- trophies, skins, accessories and the Dryer, and that every hero's items are unique,
- online play stays in step, and Quick Match pairs two random players over the internet.

Screenshots from the tests go to `tools/tests/out/` (not saved in git).
