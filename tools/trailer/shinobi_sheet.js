// Preview sheet: Toe-Shinobi in every skin, and wearing each of his accessories.
const pw = require('../announcer/node_modules/playwright'), path = require('path');
const URL = require('url').pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(1000);
  await p.evaluate(() => { window.__sock.game.screen = 'none'; });
  const data = await p.evaluate(() => {
    const S = window.__sock, c = document.querySelector('canvas').getContext('2d');
    c.setTransform(c.canvas.width / 960, 0, 0, c.canvas.height / 540, 0, 0);
    c.fillStyle = '#5a4a8a';
    c.fillRect(0, 0, 960, 540);
    const base = S.findCharacter('shinobi');
    const looks = base.skins.map((s, i) => [S.look(base, i), s.name]);
    const accs = ['shinobi', 'shinobi2', 'shinobi3', 'shinobi4', 'shinobi5', 'shinobi6'].map(a => [styledSkin(base, { base: 0, fx: null, hue: 0, sat: 1, light: 0, acc: a, accColor: ACCESSORIES[a].color }), ACCESSORIES[a].name]);
    const pose = { bodyH: 118, lean: 0.04, bend: 4, footLen: 64, footAng: -0.08, sx: 1, sy: 1, rot: 0, yOff: 0, pivot: 60, front: { x: 30, y: -18 }, back: { x: 20, y: -30 }, eyes: 'normal', mouth: 'smile', alpha: 1, spinX: 1 };
    [...looks, ...accs].forEach(([d, name], i) => {
      const x = 110 + (i % 5) * 185, y = 240 + Math.floor(i / 5) * 260;
      S.drawSockForTest(c, d, pose, x, y, 1, 1.05);
      c.setTransform(c.canvas.width / 960, 0, 0, c.canvas.height / 540, 0, 0);
      c.fillStyle = '#fff';
      c.font = 'bold 13px monospace';
      c.fillText(name, x - 50, y + 24);
    });
    return document.querySelector('canvas').toDataURL('image/png');
  });
  require('fs').writeFileSync(path.join(__dirname, 'out', 'shinobi_sheet.png'), Buffer.from(data.split(',')[1], 'base64'));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
