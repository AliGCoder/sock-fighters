// "Record your own voice" on phones: a real TAP on a RECORD button opens the microphone, records, and keeps the clip.
// Android (Chromium mobile, fake microphone) and PC. Also checks the message shown when the microphone is refused.
const pw = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
const FAKE = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
(async () => {
  let fails = 0;
  for (const [name, device, allow] of [['Android', 'Pixel 5', true], ['PC', null, true], ['Android, mic refused', 'Pixel 5', false]]) {
    const b = await pw.chromium.launch({ args: allow ? FAKE : ['--autoplay-policy=no-user-gesture-required'] });
    const ctx = await b.newContext(device ? { ...pw.devices[device] } : { viewport: { width: 960, height: 540 } });
    if (allow) await ctx.grantPermissions(['microphone']);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL);
    await p.waitForTimeout(1200);
    await p.evaluate(() => window.__sock.openVoiceRec(() => {}));
    await p.waitForTimeout(300);
    // where the first RECORD button is on the screen
    const at = await p.evaluate(() => {
      const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
      const g = { x: 560 + 75, y: 0 };
      const S = window.__sock;
      // the row's button: ask the game for row 0's y by scanning the draw rectangle helper through a tap test
      return { left: r.left, top: r.top, sx: r.width / 960, sy: r.height / 540 };
    });
    // find the row 0 RECORD button by trying taps down the RECORD column until recording starts
    let started = false;
    for (let gy = 60; gy < 480 && !started; gy += 10) {
      const x = at.left + 635 * at.sx, y = at.top + gy * at.sy;
      if (device) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
      await p.waitForTimeout(150);
      started = await p.evaluate(() => !!window.__sock.OwnVoice.rec || !!window.__sock.OwnVoice.error);
    }
    await p.waitForTimeout(4200); // records for 3 seconds, then decodes
    const r = await p.evaluate(() => {
      const O = window.__sock.OwnVoice;
      return { kept: Object.keys(O.buffers), error: O.error, recording: !!O.rec };
    });
    const ok = allow ? r.kept.length === 1 && !r.error : r.kept.length === 0 && /MICROPHONE|MIC/.test(r.error);
    if (!ok || errs.length) fails++;
    console.log(name.padEnd(22), ok ? 'ok  ' : 'FAIL', JSON.stringify(r), '| errors:', errs.length ? errs : 'none');
    await b.close();
  }
  console.log(fails ? `FAILED ${fails}` : 'all recording checks pass');
  process.exit(fails ? 1 : 0);
})();
