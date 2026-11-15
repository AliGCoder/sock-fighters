// MY SOCK + Sock Maker (design, save, fight with every fighting style), MY BAG (icons), story portraits,
// Skill Tree (buy a stat and a perk), Bounty Board (win a bounty), Daily Challenges (progress + chest).
const pw = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
const SP = require('path').join(__dirname, 'out') + '/';
require('fs').mkdirSync(SP, { recursive: true });
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  const fail = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await p.goto(URL);
  await p.waitForTimeout(1000);
  const G = (fn, a) => p.evaluate(fn, a);
  await G(() => {
    const S = window.__sock;
    S.resetProgress();
    for (const a of ['firstwin', 'socknado', 'superko']) S.Progress.data.ach[a] = 1;
  });
  // 1. Sock Maker: design and save, then it's the MY SOCK skin on select
  await G(() => {
    const S = window.__sock;
    S.game.mode = 'cpu';
    S.game.selection = { c1: S.ROSTER.length - 1, c2: 1, k1: 0, k2: 0, done1: false, done2: false, wait: 0 };
    S.game.screen = 'select';
  });
  await p.waitForTimeout(200);
  await p.keyboard.press('KeyC');
  await p.waitForTimeout(300);
  if ((await G(() => window.__sock.game.screen)) !== 'maker') fail('C on MY SOCK did not open the Sock Maker');
  await G(() => Object.assign(window.__sock.game.maker.my, { body: 13, pattern: 4, eyes: 6, iris: 2, head: 'mysock1', face: 'mysock2', bod: 'mysock5', style: 2 }));
  await p.keyboard.press('KeyR'); // surprise me
  await p.keyboard.press('Enter'); // save & wear
  await p.waitForTimeout(300);
  const saved = await G(() => ({ s: window.__sock.game.screen, n: (window.__sock.Progress.data.mysocks || []).length }));
  console.log('sock maker:', JSON.stringify(saved));
  if (saved.s !== 'select' || saved.n !== 1) fail('Sock Maker did not save the design');
  await p.screenshot({ path: SP + 'feat_select.png' });
  // 2. every fighting style fires its specials without errors
  for (let st = 0; st < 6; st++) {
    const r = await G(st => {
      const S = window.__sock;
      S.game.mode = '2p';
      S.game.p1Def = S.look(S.ROSTER[S.ROSTER.length - 1], { my: { style: st, pattern: st + 2, eyes: st + 1 } });
      S.game.p2Def = S.look(S.ROSTER[1], 0);
      S.startMatch();
      S.game.phase = 'fight';
      S.dummy();
      S.f1.x = 300;
      S.f2.x = 560;
      S.f1.state = 'idle';
      S.f1.startSpecial(S.f2, false);
      return S.f1.state;
    }, st);
    await p.waitForTimeout(700);
    await G(() => { const S = window.__sock; S.f1.state = 'idle'; S.f1.cool = 0; S.f1.startSpecial(S.f2, true); });
    await p.waitForTimeout(700);
    const hp = await G(() => window.__sock.f2.hp);
    console.log('style', st, 'special:', r, 'opponent hp', hp);
  }
  // 3. the bag draws every icon
  for (const tab of [0, 1, 2]) {
    await G(t => { const S = window.__sock; S.openBag(); S.game.bag.tab = t; }, tab);
    await p.waitForTimeout(300);
  }
  await p.screenshot({ path: SP + 'feat_bag.png' });
  const icons = await G(() => Object.keys(window.__sock.MY_ITEMS).filter(id => !window.__sock.accIcon(id)).length);
  if (icons) fail(icons + ' MY SOCK items have no icon');
  // 4. skill tree, bounty, daily
  await G(() => {
    const S = window.__sock;
    S.Progress.data.adv = { prologue: true, hero: 1, look: 0, cleared: { 1: true, 2: true }, seen: { afterCh1: true, afterCh2: true } };
    const K = S.skillData();
    K.sp = 3;
    S.startAdventure(); if (S.game.screen === 'advSlots') S.continueGame(); /* (story mode opens on the save games) */
    S.openSkills();
  });
  await p.waitForTimeout(400);
  await p.keyboard.press('Enter'); // STRIKE POWER +1
  await p.waitForTimeout(150);
  await p.keyboard.press('KeyD'); // to perks
  await p.keyboard.press('Enter'); // SUPER STARTER (2 points)
  await p.waitForTimeout(200);
  const K1 = await G(() => window.__sock.skillData());
  console.log('skill tree: power', K1.stats.power, 'starter', !!K1.perks.starter, 'points left', K1.sp);
  if (K1.stats.power !== 1 || !K1.perks.starter || K1.sp !== 0) fail('skill tree purchase failed');
  await p.screenshot({ path: SP + 'feat_skills.png' });
  await G(() => window.__sock.openBounty());
  await p.waitForTimeout(300);
  await G(() => window.__sock.startBounty(0));
  for (let i = 0; i < 200; i++) {
    const s = await G(() => window.__sock.game.screen);
    if (s === 'bounty') break;
    if (s === 'advScene') await G(() => { const S = window.__sock.game.adv.scene; if (S) S.shown = 9999; });
    if (s === 'fight') {
      const st = await G(() => { const S = window.__sock; return { meter: S.f1.meter, phase: S.game.phase }; });
      if (st.phase === 'fight' && st.meter < 50) fail('SUPER STARTER did not give half a meter');
      await G(() => { const S = window.__sock; if (S.game.phase === 'fight') S.f2.hp = 1; S.f1.x = 400; S.f2.x = 470; });
    }
    await p.keyboard.press('Space');
    await p.waitForTimeout(220);
  }
  const K2 = await G(() => ({ screen: window.__sock.game.screen, xp: window.__sock.skillData().xp, lvl: window.__sock.skillData().lvl }));
  console.log('bounty:', JSON.stringify(K2));
  if (K2.screen !== 'bounty') fail('bounty did not return to the board');
  await G(() => { const S = window.__sock; const D = S.dailyData(); for (const id of D.ids) for (let i = 0; i < 6; i++) S.dailyEvent(id); S.openDaily(); });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const D = await G(() => window.__sock.dailyData());
  console.log('daily:', JSON.stringify({ done: D.done, chest: D.chest, streak: D.streak }));
  if (!D.chest) fail('daily chest did not open');
  await p.screenshot({ path: SP + 'feat_daily.png' });
  console.log('errors:', errs.length ? errs.slice(0, 6) : 'none');
  await G(() => window.__sock.resetProgress());
  await b.close();
})();
