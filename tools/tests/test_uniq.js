// Screenshots: Cling Queen's new look; every hero with their own accessory and their 2 hero skins; unlock flow.
const { chromium } = require('../announcer/node_modules/playwright');
const SP = require('path').join(__dirname, 'out') + '/';
require('fs').mkdirSync(SP, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href);
  await p.waitForTimeout(1000);
  // stop the normal screens drawing, so we can draw our own test sheet
  await p.evaluate(() => { window.__sock.game.screen = 'none'; });
  const sheet = async (name, fn) => {
    const data = await p.evaluate(fn0 => { (0, eval)('(' + fn0 + ')')(); return document.querySelector('canvas').toDataURL('image/png'); }, fn.toString());
    require('fs').writeFileSync(SP + name + '.png', Buffer.from(data.split(',')[1], 'base64'));
  };
  // 1) Cling Queen: SWAMP DIVA and THUNDER, on the swamp
  await sheet('uniq_cling', () => {
    const c = document.querySelector('canvas').getContext('2d');
    const S = window.__sock;
    window.__draw = () => {
      c.setTransform(c.canvas.width / 960, 0, 0, c.canvas.height / 540, 0, 0);
      c.fillStyle = '#2a1a40';
      c.fillRect(0, 0, 960, 540);
      const cling = S.ROSTER.find(d => d.id === 'cling');
      [0, 1].forEach((k, i) => {
        const d = S.look(cling, k);
        const pose = { bodyH: 118, lean: 0.04, bend: 4, footLen: 64, footAng: -0.08, sx: 1, sy: 1, rot: 0, yOff: 0, pivot: 60, front: { x: 30, y: -18 }, back: { x: 20, y: -30 }, eyes: 'normal', mouth: 'smile', alpha: 1, spinX: 1 };
        window.__sock.drawSockForTest(c, d, pose, 260 + i * 440, 470, 1, 1.9);
      });
    };
    window.__draw();
  });
  // 2) every hero wearing their own accessory (with acc unlocked), 6 per row
  await sheet('uniq_accs', () => {
    const c = document.querySelector('canvas').getContext('2d');
    const S = window.__sock;
    c.setTransform(c.canvas.width / 960, 0, 0, c.canvas.height / 540, 0, 0);
    c.fillStyle = '#3a2a5a';
    c.fillRect(0, 0, 960, 540);
    S.ROSTER.forEach((d0, i) => {
      const d = S.look(d0, { base: 0, fx: null, hue: 0, sat: 1, light: 0, acc: d0.id, accColor: null });
      const pose = { bodyH: 118, lean: 0.04, bend: 4, footLen: 64, footAng: -0.08, sx: 1, sy: 1, rot: 0, yOff: 0, pivot: 60, front: { x: 30, y: -18 }, back: { x: 20, y: -30 }, eyes: 'normal', mouth: 'smile', alpha: 1, spinX: 1 };
      S.drawSockForTest(c, d, pose, 70 + (i % 6) * 160, 170 + Math.floor(i / 6) * 180, 1, 0.62);
    });
  });
  // 3) every hero's two hero skins side by side
  await sheet('uniq_skins', () => {
    const c = document.querySelector('canvas').getContext('2d');
    const S = window.__sock;
    c.setTransform(c.canvas.width / 960, 0, 0, c.canvas.height / 540, 0, 0);
    c.fillStyle = '#3a2a5a';
    c.fillRect(0, 0, 960, 540);
    S.ROSTER.forEach((d0, i) => {
      [1, 2].forEach(n => {
        const d = S.look(d0, { base: 0, fx: d0.id + n, hue: 0, sat: 1, light: 0 });
        const pose = { bodyH: 118, lean: 0.04, bend: 4, footLen: 64, footAng: -0.08, sx: 1, sy: 1, rot: 0, yOff: 0, pivot: 60, front: { x: 30, y: -18 }, back: { x: 20, y: -30 }, eyes: 'normal', mouth: 'smile', alpha: 1, spinX: 1 };
        S.drawSockForTest(c, d, pose, 30 + (i % 9) * 104 + (n - 1) * 46, 140 + Math.floor(i / 9) * 250, 1, 0.42);
      });
    });
  });
  // 4) unlocking: Stinky with 3 wins -> skin 1; 8 wins -> accessory; options on the select screen
  const res = await p.evaluate(() => {
    const S = window.__sock;
    S.resetProgress();
    const st = S.Progress.data.stats;
    const stinky = S.ROSTER[0];
    const out = {};
    out.before = { skin1: S.Progress.hasSkin('stinky1'), acc: S.Progress.hasAcc('stinky'), options: S.skinOptionsFor(stinky).length };
    st.winsBy.stinky = 3;
    S.Progress.checkHeroUnlocks(stinky);
    out.after3 = { skin1: S.Progress.hasSkin('stinky1'), skin2: S.Progress.hasSkin('stinky2'), acc: S.Progress.hasAcc('stinky'), options: S.skinOptionsFor(stinky).length };
    st.winsBy.stinky = 8;
    st.clearedBy.stinky = true;
    S.Progress.checkHeroUnlocks(stinky);
    out.after8 = { skin2: S.Progress.hasSkin('stinky2'), acc: S.Progress.hasAcc('stinky'), options: S.skinOptionsFor(stinky).length };
    out.argyleStillLocked = S.Progress.hasSkin('argyle1');
    out.wrongHeroAcc = S.look(S.ROSTER[1], { base: 0, acc: 'stinky' }).acc; // argyle wearing stinky's freshener -> must be null
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  // 5) the Dryer for Argyle (nothing unlocked): shows what's locked
  await p.evaluate(() => {
    const S = window.__sock;
    S.game.mode = 'cpu';
    S.game.selection = { c1: 1, c2: 0, k1: 0, k2: 0, done1: false, done2: false, wait: 0 };
    S.game.screen = 'select';
  });
  await p.waitForTimeout(200);
  await p.keyboard.press('c');
  await p.waitForFunction(() => window.__sock.game.dryer && window.__sock.game.dryer.t > 5);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__sock.game.dryer.phase === 'edit');
  for (let i = 0; i < 4; i++) { await p.keyboard.press('s'); await p.waitForTimeout(60); }
  await p.keyboard.press('d');
  await p.waitForTimeout(300);
  await p.screenshot({ path: SP + 'uniq_dryer_locked.png' });
  console.log('errors:', errors.length ? errors : 'none');
  await p.evaluate(() => window.__sock.resetProgress());
  await b.close();
})();
