// MY PROFILE: the avatar in the corner opens the side panel; PROFILE (photo upload, name, favourite hero, stats,
// gamer code), TROPHIES (every achievement, with progress), FRIENDS (gamer code, add a friend); Escape closes it;
// the avatar hides during fights; the photo survives a reload.
const pw = require('../announcer/node_modules/playwright');
const path = require('path');
const zlib = require('zlib');
// a tiny 64x48 PNG to upload as a photo
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x * 4; raw[i + 1] = 120; raw[i + 2] = y * 5; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const b = await pw.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const URL = require('url').pathToFileURL(path.join(__dirname, '../../index.html')).href;
  await p.goto(URL);
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.__sock.resetProgress());
  await p.reload();
  await p.waitForTimeout(1200);
  const checks = {};
  const shot = process.env.SHOTS;
  checks.avatarShown = await p.isVisible('#avatar');
  await p.click('#avatar');
  await p.waitForTimeout(400);
  checks.paneOpens = await p.evaluate(() => window.__sock.Pane.open && document.getElementById('profile-pane').classList.contains('open'));
  // upload a photo
  await p.setInputFiles('#pp-file', { name: 'me.png', mimeType: 'image/png', buffer: png(64, 48) });
  checks.photoSaved = await (async () => {
    for (let i = 0; i < 20; i++) {
      if (await p.evaluate(() => /^data:image\/jpeg/.test(window.__sock.Progress.data.avatarPhoto || '') && /^data:image\/jpeg/.test(document.getElementById('avatar-img').src))) return true;
      await p.waitForTimeout(200);
    }
    return false;
  })();
  if (shot) await p.screenshot({ path: shot + '_profile.png' });
  // trophies tab
  await p.click('#profile-pane button[data-tab="trophies"]');
  checks.trophies = await p.evaluate(() => document.querySelectorAll('#profile-pane .tro').length === window.__sock.ACHIEVEMENTS_N);
  if (shot) await p.screenshot({ path: shot + '_trophies.png' });
  // friends tab: gamer code and adding
  await p.click('#profile-pane button[data-tab="friends"]');
  checks.friendsTab = await p.evaluate(() => /^[A-Z2-9]{6}$/.test(document.querySelector('#profile-pane .code').textContent) && !!document.getElementById('pp-add'));
  await p.fill('#pp-add', 'XX');
  await p.click('#profile-pane button[data-pp="add"]');
  checks.badCodeWarns = await p.evaluate(() => /6 letters/.test(document.querySelector('#profile-pane p.err') ? document.querySelector('#profile-pane p.err').textContent : ''));
  await p.fill('#pp-add', 'ABC234');
  await p.click('#profile-pane button[data-pp="add"]');
  checks.friendAdded = await p.evaluate(() => window.__sock.Progress.data.friends.some(f => f.code === 'ABC234') && !!document.querySelector('#pp-friend-rows button[data-code="ABC234"]'));
  if (shot) await p.screenshot({ path: shot + '_friends.png' });
  // Escape closes it (the game was frozen behind it)
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  checks.escapeCloses = await p.evaluate(() => !window.__sock.Pane.open);
  // hidden during a fight
  await p.evaluate(() => { const S = window.__sock; S.game.mode = '2p'; S.game.p1Def = S.look(S.ROSTER[0], 0); S.game.p2Def = S.look(S.ROSTER[1], 0); S.startMatch(); });
  await p.waitForTimeout(600);
  checks.hiddenInFight = !(await p.isVisible('#avatar'));
  // the photo and friend survive a reload
  await p.reload();
  await p.waitForTimeout(1200);
  checks.keptAfterReload = await p.evaluate(() => /^data:image\/jpeg/.test(window.__sock.Progress.data.avatarPhoto || '') && window.__sock.Progress.data.friends.some(f => f.code === 'ABC234'));
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(checks));
  console.log('profile works: ' + ok);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await b.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
