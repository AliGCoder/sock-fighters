// Story SAVE GAMES: each is its own playthrough (hero, episodes, skill tree). Old progress becomes Save 1; a new
// game starts fresh; carrying on an old save brings its progress back — also after a reload.
const pw = require('C:/SockFighters/tools/announcer/node_modules/playwright');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL('C:/SockFighters/index.html').href);
  await p.waitForTimeout(800);
  const G = (fn, a) => p.evaluate(fn, a);
  const state = () => G(() => { const d = window.__sock.Progress.data; return { screen: window.__sock.game.screen, slots: (d.storySlots || []).length, active: d.activeSlot, hero: d.adv.hero, eps: Object.keys(d.adv.cleared || {}).length, lvl: (d.skills && d.skills.lvl) || 1, power: ((d.skills && d.skills.stats) || {}).power || 0 }; });
  // an older save: Stinky, 5 episodes, level 5
  await G(() => {
    const S = window.__sock;
    S.resetProgress();
    const d = S.Progress.data;
    d.adv = { prologue: true, hero: 0, look: 0, cleared: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, seen: {} };
    d.skills = { xp: 10, lvl: 5, sp: 3, stats: { power: 2 }, perks: { starter: true }, charms: {}, charm: null, bounties: [], spars: 0 };
    S.startAdventure();
  });
  await p.waitForTimeout(300);
  const opened = await state();
  console.log('story mode opens on:', JSON.stringify(opened));
  await p.screenshot({ path: process.env.TEMP + '/saves_screen.png' });
  await G(() => window.__sock.startNewGame());
  await p.waitForTimeout(300);
  const fresh = await state();
  console.log('new game:', JSON.stringify(fresh));
  await G(() => { const S = window.__sock; S.game.adv = { scene: null }; S.openSlots(); S.game.adv.slots.sel = 0; });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  const back = await state();
  console.log('carry on save 1:', JSON.stringify(back));
  const reloaded = await G(() => { const S = window.__sock; S.Progress.save(); S.Progress.load(); const d = S.Progress.data; return { slots: d.storySlots.length, eps: Object.keys(d.adv.cleared).length, lvl: d.skills.lvl }; });
  console.log('after reload:', JSON.stringify(reloaded));
  const ok = opened.screen === 'advSlots' && opened.slots === 1 && fresh.slots === 2 && fresh.active === 1 && fresh.eps === 0 && fresh.lvl === 1 && back.screen === 'advHub' && back.active === 0 && back.eps === 5 && back.lvl === 5 && back.power === 2 && reloaded.slots === 2 && reloaded.eps === 5;
  console.log(ok ? 'saves: same result on both: true' : 'saves: WRONG — a save game got mixed up');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
