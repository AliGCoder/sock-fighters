// Story SAVE GAMES: nothing is saved until you press SAVE GAME. Story Mode starts with START A NEW GAME; a new game
// is choose-a-hero then Episode 1; SAVE GAME makes a save; LOAD GAME brings it back exactly — also after a reload.
const pw = require('C:/SockFighters/tools/announcer/node_modules/playwright');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL('C:/SockFighters/index.html').href);
  await p.waitForTimeout(800);
  const G = (fn, a) => p.evaluate(fn, a);
  const state = () => G(() => { const d = window.__sock.Progress.data; return { screen: window.__sock.game.screen, slots: (d.storySlots || []).length, active: d.activeSlot, hero: d.adv.hero, eps: Object.keys(d.adv.cleared || {}).length, lvl: (d.skills && d.skills.lvl) || 1 }; });
  await G(() => { const S = window.__sock; S.resetProgress(); S.startAdventure(); });
  await p.waitForTimeout(300);
  const first = await state();
  console.log('story mode, first time:', JSON.stringify(first));
  // new game: choose Argyle, then Episode 1 starts
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const choosing = await state();
  await G(() => { const S = window.__sock; S.game.adv.sel.c = 1; S.game.adv.sel.locked = 70; });
  await p.waitForTimeout(500);
  const ep1 = await state();
  console.log('choose a hero ->', choosing.screen, '; then ->', ep1.screen, 'hero', ep1.hero, 'slots', ep1.slots);
  // play a bit: 2 episodes, level 3 — then SAVE GAME
  await G(() => { const S = window.__sock, d = S.Progress.data; d.adv.prologue = true; d.adv.cleared = { 1: 1, 2: 1 }; d.skills = { lvl: 3, xp: 0, sp: 1, stats: { guard: 1 }, perks: {}, charms: {}, charm: null, bounties: [], spars: 0 }; S.saveGame(); });
  const saved = await state();
  console.log('after SAVE GAME:', JSON.stringify(saved));
  // more play that is NOT saved, then a brand-new game, then LOAD GAME save 1
  await G(() => { const d = window.__sock.Progress.data; d.adv.cleared[3] = 1; });
  await G(() => { const S = window.__sock; S.game.adv = { scene: null }; S.openSlots(); });
  const cards = await G(() => window.__sock.game.screen);
  await G(() => { const S = window.__sock; S.startNewGame(); });
  await G(() => { const S = window.__sock; S.game.adv = { scene: null }; S.openSlots(); S.game.adv.slots.sel = 0; });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  const loaded = await state();
  console.log('LOAD GAME save 1:', JSON.stringify(loaded));
  const reloaded = await G(() => { const S = window.__sock; S.Progress.save(); S.Progress.load(); const d = S.Progress.data; return { slots: d.storySlots.length, savedEps: Object.keys(d.storySlots[0].cleared).length }; });
  console.log('after reload:', JSON.stringify(reloaded));
  const ok = first.screen === 'advSlots' && first.slots === 0 && choosing.screen === 'advSelect' && (ep1.screen === 'advStory' || ep1.screen === 'advTitle') && ep1.slots === 0 &&
    saved.slots === 1 && saved.active === 0 && cards === 'advSlots' && loaded.screen === 'advHub' && loaded.hero === 1 && loaded.eps === 2 && loaded.lvl === 3 && reloaded.slots === 1 && reloaded.savedEps === 2;
  console.log(ok ? 'saves: same result on both: true' : 'saves: WRONG — saving or loading went wrong');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
