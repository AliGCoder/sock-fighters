// MINI GAMES: the card on the main menu opens the challenge list; every challenge starts, plays, ends with a score,
// keeps its best score after a reload. Fight challenges (real fights): winning a fight leads to the next one (health
// carried over where the rules say so), losing ends the run with the results screen, QUIT from pause ends it too.
// Other challenges: a robot "monkey" plays them with random taps and keys without errors.
// SHOTS=prefix saves pictures.
const pw = require('../announcer/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(require('url').pathToFileURL(path.join(__dirname, '../../index.html')).href);
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.__sock.resetProgress());
  const shot = process.env.SHOTS;
  const checks = {};
  await p.evaluate(() => { window.__sock.game.screen = 'mode'; });
  await p.waitForTimeout(300);
  checks.menuCard = await p.evaluate(() => modeMenuList().some(x => x[2] === 'minis') && !modeMenuList().some(x => x[2] === 'friends' || x[2] === 'awards'));
  if (shot) await p.screenshot({ path: shot + '_menu.png' });
  await p.evaluate(() => window.__sock.openMiniGames());
  await p.waitForTimeout(500);
  if (shot) await p.screenshot({ path: shot + '_list.png' });
  const games = await p.evaluate(() => window.__sock.MINI_GAMES.map(m => ({ id: m.id, fight: !!m.fight })));
  const res = {};
  const step = n => p.evaluate(n => { for (let i = 0; i < n; i++) updateGame(); renderGame(); }, n);
  for (const { id, fight } of games) {
    if (id === 'combos') {
      // COMBO TRIALS: land JAB > KICK on the dummy, and trial 1 clears
      const r = await p.evaluate(() => {
        const S = window.__sock;
        S.startMini('combos');
        S.miniBegin();
        for (let i = 0; i < 120; i++) updateGame();
        S.f1.x = 400;
        S.f2.x = 500;
        keysPressed.Space = true; keysDown.Space = true; updateGame(); delete keysDown.Space;
        for (let i = 0; i < 9; i++) updateGame();
        keysPressed.KeyE = true; keysDown.KeyE = true; updateGame(); delete keysDown.KeyE;
        for (let i = 0; i < 60; i++) updateGame();
        const n = S.game.mini.g.n, score = S.game.mini.g.score;
        renderGame();
        return { n, score };
      });
      if (shot) { await p.waitForTimeout(600); await p.screenshot({ path: shot + '_combos.png' }); }
      await p.evaluate(() => window.__sock.game.mini.g.end());
      res[id] = r;
      checks['plays combos'] = r.n === 1 && r.score > 0;
    } else if (fight) {
      // the READY screen, then the first fight
      await p.evaluate(id => window.__sock.startMini(id), id);
      if (shot) { await p.waitForTimeout(400); await p.screenshot({ path: shot + '_' + id + '_ready.png' }); }
      await p.evaluate(() => window.__sock.miniBegin());
      const r = { firstFight: await p.evaluate(() => window.__sock.game.screen === 'fight' && !!window.__sock.game.mf) };
      await step(90);
      if (shot) { await p.waitForTimeout(600); await p.screenshot({ path: shot + '_' + id + '_fight.png' }); }
      // win twice: each time the next fight starts
      for (let k = 0; k < 2; k++) {
        await p.evaluate(() => { const S = window.__sock; S.game.phase = 'fight'; S.f1.hp = Math.round(S.f1.hpMax * 0.5); S.f2.hp = 0; onKnockout(S.f2); });
        await step(200);
        r['win' + (k + 1)] = await p.evaluate(() => ({ screen: window.__sock.game.screen, score: window.__sock.game.mini.g.score, p2: window.__sock.f2.def.id, hp1: window.__sock.f1.hp, hpMax1: window.__sock.f1.hpMax }));
      }
      if (shot) { await p.waitForTimeout(500); await p.screenshot({ path: shot + '_' + id + '_next.png' }); }
      // lose: the results screen
      await p.evaluate(() => { const S = window.__sock; S.game.phase = 'fight'; S.f1.hp = 0; onKnockout(S.f1); });
      await step(200);
      r.lost = await p.evaluate(() => ({ screen: window.__sock.game.screen, phase: window.__sock.game.mini.phase, mf: window.__sock.game.mf, best: window.__sock.Progress.data.mini[window.__sock.game.mini.id] }));
      if (shot) { await p.waitForTimeout(900); await p.screenshot({ path: shot + '_' + id + '_over.png' }); }
      // QUIT from the pause menu also ends the run
      await p.evaluate(id => { const S = window.__sock; S.startMini(id); S.miniBegin(); }, id);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(200);
      await p.keyboard.press('KeyQ');
      await p.waitForTimeout(300);
      r.quit = await p.evaluate(() => window.__sock.game.screen === 'mini' && window.__sock.game.mini.phase === 'over' && !window.__sock.game.mf);
      res[id] = r;
      checks['plays ' + id] = r.firstFight && r.win1.screen === 'fight' && r.win2.screen === 'fight' && r.win2.score > 0 && r.lost.screen === 'mini' && r.lost.phase === 'over' && !r.lost.mf && r.lost.best > 0 && r.quit;
    } else {
      const r = await p.evaluate(id => {
        const S = window.__sock;
        S.startMini(id);
        S.miniBegin();
        const keys = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyE', 'KeyS', 'KeyF'];
        let err = null, frames = 0;
        try {
          for (let f = 0; f < 2000 && S.game.mini.phase === 'play'; f++) {
            if (f % 9 === 0) S.game.click = { x: Math.random() * 960, y: 60 + Math.random() * 470 };
            if (f % 13 === 0) keysPressed[keys[(Math.random() * keys.length) | 0]] = true;
            keysDown.Space = f % 40 < 6;
            updateGame();
            if (f % 5 === 0) renderGame();
            frames = f;
          }
        } catch (e) {
          err = e.message + ' ' + (e.stack || '').split('\n')[1];
        }
        keysDown.Space = false;
        if (S.game.mini.phase === 'play') S.game.mini.g.end();
        renderGame();
        return { err, frames, over: S.game.mini.phase === 'over', score: S.game.mini.g.score };
      }, id);
      res[id] = r;
      checks['plays ' + id] = !r.err && r.over;
      if (shot) {
        await p.evaluate(id => { const S = window.__sock; S.startMini(id); S.miniBegin(); }, id);
        await p.waitForTimeout(1500);
        await p.mouse.click(480, 300);
        await p.waitForTimeout(700);
        await p.screenshot({ path: shot + '_' + id + '.png' });
      }
    }
  }
  // best scores survive a reload
  const before = await p.evaluate(() => JSON.stringify(window.__sock.Progress.data.mini));
  await p.reload();
  await p.waitForTimeout(1000);
  checks.bestKept = (await p.evaluate(() => JSON.stringify(window.__sock.Progress.data.mini))) === before && before.length > 5;
  for (const [id, r] of Object.entries(res)) console.log(id.padEnd(9) + JSON.stringify(r));
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(checks));
  console.log('mini games work: ' + ok);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await b.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
