// Story voices on PC (Chromium), iPhone (WebKit) and Android (Chromium mobile): files load, keys match, lines play.
const pw = require('../announcer/node_modules/playwright');
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
    await p.evaluate(() => { const S = window.__sock; S.resetProgress(); S.Progress.data.adv = { prologue: true, hero: 4, look: 0, cleared: {}, seen: {} }; S.startAdventure(); });
    await p.waitForFunction(() => window.__sock.StoryVoices.files.story === 'ready' && window.__sock.StoryVoices.files['hero-baby'] === 'ready', null, { timeout: 30000 }).catch(() => {});
    // every line of every scene should have a recording (except silent ones)
    const r = await p.evaluate(() => {
      const S = window.__sock, hero = S.ROSTER[4];
      const names = ['PROLOGUE','PALACE_ARRIVAL','PALACE_AFTER_CH1','PALACE_AFTER_CH2','PALACE_AFTER_CH3','PALACE_AFTER_CH4','PALACE_AFTER_CH5','CH1_INTRO','CH1_MID','CH1_BOSS','CH1_END','CH2_INTRO','CH2_MID','CH2_BOSS','CH2_END','CH2_FLASHBACK','CH2_AFTER','CH3_INTRO','CH3_MID','CH3_BOSS','CH3_END','CH4_INTRO','CH4_MID','CH4_KING_WAKE','CH4_FLASHBACK','CH4_KING_AFTER','CH4_BOSS','CH4_END','CH5_INTRO','CH5_MID','CH5_MID_END','CH5_BOSS','CH5_END'];
      let total = 0, missing = [];
      for (const n of names) for (const l of eval(n)) {
        total++;
        const key = S.storyVoiceKey(l.who === 'hero' ? hero.id : l.who, l.text.replace(/\{HERO\}/g, hero.name));
        if (!S.StoryVoices.has(key)) missing.push(l.who + ': ' + l.text.slice(0, 30));
      }
      return { files: S.StoryVoices.files, total, missing, hero: hero.id };
    });
    // play a line: the next scene line should start a voice
    await p.evaluate(() => window.__sock.storyJump(1, 0)); await p.waitForTimeout(600);
    await p.keyboard.press('Space'); await p.waitForTimeout(100); await p.keyboard.press('Space'); await p.waitForTimeout(900);
    const playing = await p.evaluate(() => !!window.__sock.StoryVoices.source);
    console.log(name.padEnd(8), JSON.stringify(r.files), '| lines', r.total, 'missing', r.missing.length, r.missing.slice(0, 2), '| voice playing:', playing, '| errors:', errs.length ? errs : 'none');
    await b.close();
  }
})();
