// Xbox / PS5 controllers: a fake controller (the browser's Gamepad API) starts the game from the title,
// moves through a menu, and in a 2-player fight controller 1 moves and attacks Player 1 while controller 2
// moves Player 2. Start pauses. The keyboard still works with a controller plugged in.
const pw = require('../announcer/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    const mk = (i, id) => ({ id, index: i, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
    window.__pads = [mk(0, 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), mk(1, 'Xbox Wireless Controller (STANDARD GAMEPAD)')];
    navigator.getGamepads = () => window.__pads;
  });
  await p.goto(require('url').pathToFileURL(path.join(__dirname, '../../index.html')).href);
  await p.waitForTimeout(900);
  const btn = async (pad, i, frames = 4) => {
    await p.evaluate(([pad, i]) => { window.__pads[pad].buttons[i].pressed = true; window.__pads[pad].buttons[i].value = 1; }, [pad, i]);
    await p.waitForTimeout(frames * 17 + 30);
    await p.evaluate(([pad, i]) => { window.__pads[pad].buttons[i].pressed = false; window.__pads[pad].buttons[i].value = 0; }, [pad, i]);
    await p.waitForTimeout(80);
  };
  const G = f => p.evaluate(f);
  const checks = {};
  // the title: PRESS ✕ (it is a PlayStation pad)
  const t0 = await G(() => window.__sock.game.screen);
  await btn(0, 0);
  const t1 = await G(() => window.__sock.game.screen);
  checks.titleStarts = t0 !== t1;
  // a menu: d-pad down moves the selection
  const snap = () => G(() => JSON.stringify([window.__sock.game.screen, window.__sock.game.menuIndex]));
  const m0 = await snap();
  await btn(0, 13);
  const m1 = await snap();
  checks.dpadMovesMenu = m0 !== m1;
  // a 2-player fight
  await G(() => { const S = window.__sock; S.game.mode = '2p'; S.game.p1Def = S.look(S.ROSTER[0], 0); S.game.p2Def = S.look(S.ROSTER[1], 0); S.startMatch(); });
  await p.waitForTimeout(3500); // past ROUND 1 ... FIGHT!
  const x0 = await G(() => [window.__sock.f1.x, window.__sock.f2.x]);
  await G(() => { window.__pads[0].axes[0] = 1; window.__pads[1].axes[0] = 1; });
  await p.waitForTimeout(500);
  await G(() => { window.__pads[0].axes[0] = 0; window.__pads[1].axes[0] = 0; });
  const x1 = await G(() => [window.__sock.f1.x, window.__sock.f2.x]);
  checks.pad1MovesP1 = x1[0] > x0[0] + 20;
  checks.pad2MovesP2 = x1[1] > x0[1] + 20;
  await G(() => { const S = window.__sock; S.f1.x = S.f2.x - 80; });
  const hp0 = await G(() => window.__sock.f2.hp);
  for (let i = 0; i < 4; i++) await btn(0, 0, 3);
  await p.waitForTimeout(400);
  const hp1 = await G(() => window.__sock.f2.hp);
  checks.pad1Attacks = hp1 < hp0;
  // START pauses, START again resumes
  await btn(0, 9);
  const paused = await G(() => !!window.__sock.game.paused);
  await btn(0, 9);
  const resumed = await G(() => !window.__sock.game.paused);
  checks.startPauses = paused && resumed;
  // keyboard still works with controllers plugged in
  const kx0 = await G(() => window.__sock.f1.x);
  await p.keyboard.down('KeyA');
  await p.waitForTimeout(400);
  await p.keyboard.up('KeyA');
  const kx1 = await G(() => window.__sock.f1.x);
  checks.keyboardStillWorks = kx1 < kx0 - 20;
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(checks));
  console.log('controllers work: ' + ok);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await b.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
