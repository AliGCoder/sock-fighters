// Story mode: Escape opens the PAUSE menu (RESUME / QUIT TO PALACE) — it never skips a scene, a fight or an episode.
const pw = require('C:/SockFighters/tools/announcer/node_modules/playwright');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL('C:/SockFighters/index.html').href);
  await p.waitForTimeout(800);
  const st = () => p.evaluate(() => { const S = window.__sock, g = S.game; return { screen: g.screen, step: g.story ? g.story.step : null, paused: !!g.storyPause, cleared: Object.keys(S.Progress.data.adv.cleared || {}).length }; });
  await p.evaluate(() => { const S = window.__sock; S.resetProgress(); S.Progress.data.adv = { prologue: true, hero: 0, look: 0, cleared: {}, seen: { proFresh: true } }; S.startAdventure(); S.continueGame(); S.game.adv.hub.book = 1; S.game.adv.hub.sel = 0; });
  await p.keyboard.press('Enter'); await p.waitForTimeout(2800);
  const before = await st();
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const onEsc = await st();
  await p.screenshot({ path: process.env.TEMP + '/pause.png' });
  for (let i = 0; i < 5; i++) { await p.waitForTimeout(100); }
  const frozen = await st();
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const resumed = await st();
  // in a fight: jump to the first fight, Escape, QUIT TO PALACE
  await p.evaluate(() => { const S = window.__sock; S.storyJump(1, 2); });
  await p.waitForTimeout(600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const fightPause = await st();
  await p.keyboard.press('KeyS'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const quit = await st();
  console.log(JSON.stringify({ before, onEsc, frozen, resumed, fightPause, quit }, null, 0));
  const ok = onEsc.paused && onEsc.screen === before.screen && onEsc.step === before.step && frozen.step === before.step && !resumed.paused && resumed.step === before.step && fightPause.paused && quit.screen === 'advHub' && quit.cleared === 0;
  console.log(ok ? 'escape: same result on both: true' : 'escape: same result on both: false (Escape skipped something!)');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
