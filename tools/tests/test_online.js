// Online lockstep test: Chromium (host) vs WebKit (guest) linked directly; both mash buttons for whole matches.
// Passes if the two games never disagree (checksums) and end with the same result.
const { chromium, webkit } = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
const SP = require('path').join(__dirname, 'out') + '/';
require('fs').mkdirSync(SP, { recursive: true });
const KEYS = ['a', 'd', 'w', 's', ' ', 'e', 'f', 'r', 'q', 'a', 'd', 'e', ' ', 'e', 'e'];
(async () => {
  const cb = await chromium.launch(), wb = await webkit.launch();
  const host = await (await cb.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const guest = await (await wb.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  for (const [p, n] of [[host, 'host'], [guest, 'guest']]) {
    p.on('pageerror', e => errors.push(n + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') errors.push(n + ' console: ' + m.text()); });
  }
  await host.exposeFunction('__netOut', s => { guest.evaluate(m => window.__netIn && window.__netIn(m), s).catch(() => {}); });
  await guest.exposeFunction('__netOut', s => { host.evaluate(m => window.__netIn && window.__netIn(m), s).catch(() => {}); });
  await Promise.all([host.goto(URL), guest.goto(URL)]);
  await host.waitForTimeout(1200);
  await host.evaluate(() => window.__sock.netTestConnect('host'));
  await guest.evaluate(() => window.__sock.netTestConnect('guest'));
  const state = p => p.evaluate(() => {
    const S = window.__sock, g = S.game;
    return { screen: g.screen, desyncs: S.Net.desyncs, frame: S.Net.ls && S.Net.ls.frame,
      hp: S.f1 ? [Math.round(S.f1.hp), Math.round(S.f2.hp)] : null, pips: S.f1 ? [S.f1.pips, S.f2.pips] : null,
      stage: g.stageId, p1: g.p1Def && g.p1Def.name, p2: g.p2Def && g.p2Def.name };
  });

  for (let match = 0; match < 2; match++) {
    // pick: host takes the highlighted sock, guest moves 2 right (or picks RANDOM on the rematch)
    await host.keyboard.press('Space');
    if (match === 0) { await guest.keyboard.press('d'); await guest.keyboard.press('d'); }
    else for (let i = 0; i < 8; i++) await guest.keyboard.press('d');
    await guest.keyboard.press('Space');
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const [a, b] = [await state(host), await state(guest)];
      if (a.screen === 'fight' && b.screen === 'fight') break;
      await host.waitForTimeout(200);
    }
    console.log('match', match + 1, 'started:', JSON.stringify(await state(host)), '|', JSON.stringify(await state(guest)));
    // mash on both devices until both reach the result screen
    const t1 = Date.now();
    let shot = false;
    while (Date.now() - t1 < 150000) {
      await Promise.all([host, guest].map(async p => {
        const k = KEYS[(Math.random() * KEYS.length) | 0];
        await p.keyboard.down(k); await p.waitForTimeout(30 + Math.random() * 60); await p.keyboard.up(k);
      }));
      if (!shot && Date.now() - t1 > 8000) { await host.screenshot({ path: SP + 'online_host.png' }); await guest.screenshot({ path: SP + 'online_guest.png' }); shot = true; }
      const [a, b] = [await state(host), await state(guest)];
      if (a.screen === 'result' && b.screen === 'result') break;
    }
    const [a, b] = [await state(host), await state(guest)];
    console.log('match', match + 1, 'end   host :', JSON.stringify(a));
    console.log('match', match + 1, 'end   guest:', JSON.stringify(b));
    console.log('   same result on both:', JSON.stringify(a.hp) === JSON.stringify(b.hp) && JSON.stringify(a.pips) === JSON.stringify(b.pips));
    if (match === 0) {
      await host.waitForTimeout(1500);
      await host.keyboard.press('Enter'); await guest.keyboard.press('Enter');
      await host.waitForTimeout(800);
    }
  }
  // guest leaves: host should be told
  await guest.keyboard.press('Escape');
  await host.waitForTimeout(800);
  console.log('after guest leaves, host sees:', await host.evaluate(() => window.__sock.game.screen + ' / ' + document.getElementById('online').innerText.replace(/\s+/g, ' ')));
  console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
  await cb.close(); await wb.close();
})();
