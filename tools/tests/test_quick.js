// Two separate browsers press QUICK MATCH (no code) and should be paired over the internet, then fight in step.
const { chromium } = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
(async () => {
  const b = await chromium.launch();
  const open = async () => {
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    const p = await ctx.newPage();
    p.errs = [];
    p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(900);
    await p.evaluate(() => { window.__sock.resetProgress(); game.screen = 'online'; showOnlinePanel('menu'); });
    return p;
  };
  const A = await open(), B = await open();
  const state = p => p.evaluate(() => ({ screen: game.screen, mode: game.mode, role: Net.role, quick: Net.quick, slot: Net.quickSlot, panel: onlinePanelState }));
  await A.click('#online button[data-on="quick"]');
  await A.waitForTimeout(4000);
  console.log('A alone (should be waiting):', JSON.stringify(await state(A)), '|', (await A.textContent('#online')).replace(/\s+/g, ' ').slice(0, 120));
  const t0 = Date.now();
  await B.click('#online button[data-on="quick"]');
  await Promise.all([A, B].map(p => p.waitForFunction(() => game.screen === 'select', null, { timeout: 30000 }).catch(() => {})));
  console.log('paired in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('A:', JSON.stringify(await state(A)));
  console.log('B:', JSON.stringify(await state(B)));
  // both pick and play a little: are they in step?
  for (const p of [A, B]) await p.evaluate(() => { const s = game.selection; s.c1 = Net.role === 'host' ? 0 : 1; });
  await A.keyboard.press('Enter'); await B.keyboard.press('Enter');
  await Promise.all([A, B].map(p => p.waitForFunction(() => game.screen === 'fight' || game.screen === 'vs', null, { timeout: 20000 }).catch(() => {})));
  await A.waitForTimeout(6000);
  const st = p => p.evaluate(() => ({ screen: game.screen, desyncs: Net.desyncs, p1: game.p1Def && game.p1Def.name, p2: game.p2Def && game.p2Def.name }));
  console.log('A fight:', JSON.stringify(await st(A)), '| B fight:', JSON.stringify(await st(B)));
  // a third player arrives while those two are busy: they must not join the busy match, but wait in another spot
  const C = await open();
  await C.click('#online button[data-on="quick"]');
  await C.waitForTimeout(9000);
  console.log('C (others busy):', JSON.stringify(await state(C)));
  for (const p of [A, B, C]) await p.evaluate(() => netClose());
  console.log('errors:', [...A.errs, ...B.errs, ...C.errs].length ? [...A.errs, ...B.errs, ...C.errs] : 'none');
  await b.close();
})();
