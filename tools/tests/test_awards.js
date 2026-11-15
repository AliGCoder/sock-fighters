// Achievements, unlocks, effect skins, the dryer customizer, trophies screen, playing a villain.
const { chromium, webkit, devices } = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
const SP = require('path').join(__dirname, 'out') + '/';
require('fs').mkdirSync(SP, { recursive: true });
(async () => {
  const errors = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.evaluate(() => window.__sock.resetProgress());
  const G = fn => p.evaluate(fn);
  const key = async k => { await p.keyboard.press(k); await p.waitForTimeout(60); };

  // 1) select screen, fresh progress: villains locked
  await G(() => { const S = window.__sock; S.game.mode = 'cpu'; S.game.selection = { c1: 0, c2: 1, k1: 0, k2: 0, done1: false, done2: false, roul: 0, wait: 0 }; S.game.screen = 'select'; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: SP + 'aw_select_locked.png' });
  await G(() => { window.__sock.game.selection.c1 = 13; }); // Dryer Demon (locked)
  await p.keyboard.press('Space'); await p.waitForTimeout(200);
  console.log('pick a locked villain ->', JSON.stringify(await G(() => { const s = window.__sock.game.selection; return { done1: s.done1, note: s.takenNote && s.takenNote.text }; })));
  await p.screenshot({ path: SP + 'aw_select_locked_panel.png' });

  // 2) the dryer: press C on Argyle-San, watch the hop-in, change things, save
  await G(() => { window.__sock.game.selection.c1 = 1; });
  await p.keyboard.press('c');
  for (const ms of [450, 500, 700]) { await p.waitForTimeout(ms); await p.screenshot({ path: SP + 'aw_dryer_enter_' + ms + '.png' }); }
  await p.waitForFunction(() => window.__sock.game.dryer.phase === 'edit', null, { timeout: 10000 });
  console.log('dryer phase:', await G(() => window.__sock.game.dryer.phase));
  await key('d'); await p.waitForTimeout(100);              // next base skin
  await key('s'); await key('d');              // effect: none unlocked yet -> note
  await key('s'); for (let i = 0; i < 4; i++) await key('d'); // colour +80
  await key('s'); await key('d'); await key('d'); // vivid
  await p.waitForTimeout(200);
  await p.screenshot({ path: SP + 'aw_dryer_edit.png' });
  console.log('look being edited:', JSON.stringify(await G(() => window.__sock.game.dryer.look)));
  await key('s'); await key('s'); await key('s'); await key('Space'); // SAVE (now below ACCESSORY + ACC. COLOUR)
  await p.waitForTimeout(700);
  await p.screenshot({ path: SP + 'aw_dryer_exit.png' });
  await p.waitForFunction(() => window.__sock.game.screen === 'select', null, { timeout: 10000 });
  console.log('after save:', JSON.stringify(await G(() => ({ screen: window.__sock.game.screen, k1: window.__sock.game.selection.k1, saved: window.__sock.Progress.data.looks.argyle, ach: Object.keys(window.__sock.Progress.data.ach) }))));
  await p.screenshot({ path: SP + 'aw_select_mystyle.png' });

  // 3) a fight: SOCK-NADO, then a win -> FIRST WASH (+ FROST skin)
  await G(() => { const S = window.__sock; S.game.mode = 'cpu'; S.game.arcade = { tier: 'easy', list: [{ id: 'lint', k: 0 }], stage: 0 }; S.game.stageId = 'beach';
    S.game.p1Def = S.look(S.ROSTER[1], 0); S.game.p2Def = S.look(S.ROSTER[8], 0); S.startMatch(); S.dummy(); });
  await p.waitForFunction(() => window.__sock.game.phase === 'fight' && window.__sock.f1.state === 'idle', null, { timeout: 15000 });
  await G(() => { const S = window.__sock; S.f1.x = 400; S.f2.x = 490; });
  for (let i = 0; i < 3; i++) {
    await p.keyboard.press('e');
    for (let k = 0; k < 20; k++) { await p.waitForTimeout(25); if (await G(() => window.__sock.f1.hasHit)) break; }
    await p.waitForTimeout(140);
  }
  await p.waitForTimeout(300);
  await p.screenshot({ path: SP + 'aw_toast.png' });
  // finish the match quickly: knock the dummy out twice
  for (let tries = 0; tries < 400 && (await G(() => window.__sock.game.screen)) === 'fight'; tries++) {
    const st = await G(() => { const S = window.__sock; return S.game.phase + ' ' + S.f1.state + ' ' + S.f2.state; });
    if (tries % 40 === 0) console.log('   KO loop:', st);
    if (st.startsWith('fight')) await G(() => { const S = window.__sock; if (!['down', 'getup', 'fall', 'ko', 'flat'].includes(S.f2.state)) { S.f2.hp = 5; S.f1.x = 400; S.f2.x = 490; } });
    await p.keyboard.press(' ');
    await p.waitForTimeout(150);
  }
  await p.waitForFunction(() => window.__sock.game.screen === 'result', null, { timeout: 20000 });
  console.log('after winning:', JSON.stringify(await G(() => { const P = window.__sock.Progress.data; return { ach: Object.keys(P.ach), skins: P.skins, wins: P.stats.wins, arenas: P.stats.arenas }; })));

  // 4) clearing EASY unlocks the Lint Gang; play as Lint Bunny vs CPU
  await G(() => window.__sock.Progress.award('easy'));
  await G(() => { const S = window.__sock; S.game.selection = { c1: 8, c2: 1, k1: 0, k2: 0, done1: false, done2: false, roul: 0, wait: 0 }; S.game.screen = 'select'; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: SP + 'aw_select_unlocked.png' });
  await G(() => { const S = window.__sock; S.game.p1Def = S.look(S.ROSTER[8], { base: 0, fx: 'frost' }); S.game.p2Def = S.look(S.ROSTER[0], 0); S.game.mode = '2p'; S.startMatch(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: SP + 'aw_villain_fight.png' });
  console.log('villain hero stats:', JSON.stringify(await G(() => ({ hp: window.__sock.f1.hp, armor: window.__sock.f1.def.armor, skin: window.__sock.f1.def.skinName }))));

  // 5) trophies screen
  await G(() => { window.__sock.game.screen = 'awards'; });
  await p.waitForTimeout(4000); // let the toasts finish
  await p.screenshot({ path: SP + 'aw_trophies.png' });

  // 6) progress survives a reload
  await p.reload(); await p.waitForTimeout(800);
  console.log('after reload:', JSON.stringify(await G(() => ({ ach: Object.keys(window.__sock.Progress.data.ach).length, lint: window.__sock.Progress.heroUnlocked('lint'), look: !!window.__sock.Progress.data.looks.argyle }))));
  await G(() => window.__sock.resetProgress());

  // 7) phone: the DRYER button is tappable
  const pb = await webkit.launch();
  const ph = await (await pb.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  ph.on('pageerror', e => errors.push('phone: ' + e.message));
  await ph.goto(URL); await ph.waitForTimeout(800);
  await ph.evaluate(() => { const S = window.__sock; S.game.mode = 'cpu'; S.game.selection = { c1: 2, c2: 1, k1: 0, k2: 0, done1: false, done2: false, roul: 0, wait: 0 }; S.game.screen = 'select'; });
  await ph.waitForTimeout(300);
  const pt = await ph.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.left + (310 / 960) * r.width, y: r.top + (485 / 540) * r.height }; });
  await ph.touchscreen.tap(pt.x, pt.y); await ph.waitForTimeout(300);
  console.log('phone tap DRYER button ->', await ph.evaluate(() => window.__sock.game.screen));
  await pb.close();
  console.log('errors:', errors.length ? errors : 'none');
  await b.close();
})();
