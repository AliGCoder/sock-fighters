// Story voices on PC (Chromium), iPhone (WebKit) and Android (Chromium mobile): files load, keys match, lines play.
const pw = require('../announcer/node_modules/playwright');
// every story scene in the game (const NAME = [ { who: ...)
const SCENES = [...require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8').matchAll(/const ([A-Z0-9_]+) = \[\n\s+\{ who: /g)].map(m => m[1]);
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
(async () => {
  for (const [name, type, device] of [['PC', 'chromium', null], ['iPhone', 'webkit', 'iPhone 13'], ['Android', 'chromium', 'Pixel 5']]) {
    const b = await pw[type].launch(type === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : {});
    const ctx = await b.newContext(device ? { ...pw.devices[device] } : { viewport: { width: 960, height: 540 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(1200);
    await p.mouse.click(200, 200);
    await p.evaluate(() => { const S = window.__sock; S.resetProgress(); S.Progress.data.adv = { prologue: true, hero: 4, look: 0, cleared: {}, seen: {} }; S.startAdventure(); if (S.game.screen === 'advSlots') S.playSlot(0); /* (story mode opens on the save games) */ });
    await p.waitForFunction(() => window.__sock.StoryVoices.files.story === 'ready' && window.__sock.StoryVoices.files['hero-baby'] === 'ready', null, { timeout: 30000 }).catch(() => {});
    // every line of every scene should have a recording (except silent ones)
    const r = await p.evaluate(sceneNames => {
      const S = window.__sock, hero = S.ROSTER[4];
      const names = sceneNames;
      let total = 0, missing = [];
      for (const n of names) for (const l of eval(n)) {
        total++;
        const key = S.storyVoiceKey(l.who === 'hero' ? hero.id : l.who, l.text.replace(/\{HERO\}/g, hero.name));
        if (!S.StoryVoices.has(key)) missing.push(l.who + ': ' + l.text.slice(0, 30));
      }
      return { files: S.StoryVoices.files, total, missing, hero: hero.id };
    }, SCENES);
    // play a line: the next scene line should start a voice
    await p.evaluate(() => window.__sock.storyJump(1, 0)); await p.waitForTimeout(600);
    await p.keyboard.press('Space'); await p.waitForTimeout(100); await p.keyboard.press('Space'); await p.waitForTimeout(900);
    const playing = await p.evaluate(() => !!window.__sock.StoryVoices.source);
    console.log(name.padEnd(8), JSON.stringify(r.files), '| lines', r.total, 'missing', r.missing.length, r.missing.slice(0, 2), '| voice playing:', playing, '| errors:', errs.length ? errs : 'none');
    await b.close();
  }
})();
