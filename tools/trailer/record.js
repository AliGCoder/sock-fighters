// Promo trailer: plays the game's highlights (shots.js) and records them WITH the game's own sound, straight from
// the page: the game canvas + captions are drawn onto a 1280x720 video canvas, and the game's master sound output
// is recorded alongside. Writes tools/trailer/out/sock-fighters-trailer.mp4 (or .webm).
//   node tools/trailer/record.js           the full trailer
//   node tools/trailer/record.js --shots   just a screenshot from the middle of every shot (quick check)
const fs = require('fs'), path = require('path');
const pw = require('../announcer/node_modules/playwright');
const SHOTS = require('./shots');
const URL = require('url').pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;
const OUT = path.join(__dirname, 'out');
const onlyShots = process.argv.includes('--shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(1500);
  await p.mouse.click(5, 5); // wakes the sound up
  // wait until every fighter voice is ready (they decode a few at a time)
  await p.waitForFunction(() => window.__sock.ROSTER.filter(x => !x.mysock).every(x => FighterClips.get(x.id, 'supername')), null, { timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => window.__sock && window.Sound !== undefined || true);
  await p.evaluate(() => {
    const S = window.__sock;
    S.resetProgress();
    // everything unlocked so the menus look full
    S.ROSTER.forEach(r => (S.Progress.data.heroes[r.id] = true));
    document.querySelectorAll('#avatar,#fullscreen,#mute,#fullscreen-tip').forEach(e => (e.style.display = 'none'));
  });
  if (!onlyShots) {
    await p.evaluate(() => {
      const game = document.querySelector('canvas');
      const v = document.createElement('canvas');
      v.width = 1280; v.height = 720;
      const g = v.getContext('2d');
      const T = (window.__trailer = { cap: '', sub: '', capT: 0, end: false, chunks: [], fade: 0 });
      const draw = () => {
        g.imageSmoothingEnabled = true;
        g.drawImage(game, 0, 0, 1280, 720);
        const t0 = (performance.now() - T.capT) / 1000;
        const cs = T.card ? T.cardSecs : 0;
        const t = t0 - cs; // captions start after the card
        if (T.card && t0 < cs) {
          // a black title card: the line fades in and slowly grows, then a white flash cuts to the game
          g.fillStyle = '#000';
          g.fillRect(0, 0, 1280, 720);
          const a = Math.min(1, t0 * 2.2, (cs - t0) * 5);
          const k = 1 + 0.06 * (t0 / cs);
          g.save();
          g.translate(640, 372);
          g.scale(k, k);
          g.globalAlpha = Math.max(0, a);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          const big = T.cardBig;
          g.font = big ? '900 112px Impact, "Arial Black", sans-serif' : '600 44px "Segoe UI", Arial, sans-serif';
          if (big) { g.shadowColor = '#3fff8a'; g.shadowBlur = 40; }
          g.fillStyle = big ? '#ffffff' : '#e8e8e8';
          if (!big) g.letterSpacing = '8px';
          g.fillText(T.card, 0, 0);
          g.restore();
          T.flashed = false;
          requestAnimationFrame(draw);
          return;
        }
        if (T.card && !T.flashed) { T.flashed = true; T.fade = 0.9; }
        if (!T.end) {
          g.fillStyle = '#000';
          g.fillRect(0, 0, 1280, 58);
          g.fillRect(0, 662, 1280, 58);
        }
        if (T.end) {
          // the end card: dark, the game's name, where to play
          g.fillStyle = `rgba(0,0,0,${Math.min(0.86, t * 1.6)})`;
          g.fillRect(0, 0, 1280, 720);
          const a = Math.min(1, t * 1.5);
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.lineJoin = 'round';
          const slam = 1 + Math.max(0, 0.5 - t) * 1.2;
          g.save(); g.translate(640, 300); g.scale(slam, slam); g.translate(-640, -300);
          g.font = '900 104px Impact, "Arial Black", sans-serif';
          g.shadowColor = '#3fff8a'; g.shadowBlur = 36;
          g.lineWidth = 16; g.strokeStyle = '#1a0f2e'; g.strokeText('SOCK FIGHTERS', 640, 300);
          g.shadowBlur = 0;
          g.fillStyle = '#ffe234'; g.fillText('SOCK FIGHTERS', 640, 300);
          g.restore();
          g.font = '900 60px Impact, "Arial Black", sans-serif';
          g.lineWidth = 12; g.strokeText('TURBO RINSE', 640, 375);
          g.fillStyle = '#3ff0ff'; g.fillText('TURBO RINSE', 640, 375);
          g.font = '800 34px "Segoe UI", Arial, sans-serif';
          g.fillStyle = '#3fff8a'; g.fillText('PLAY FREE NOW', 640, 470);
          g.fillStyle = '#ff4fa3'; g.fillText('aligcoder.github.io/sock-fighters', 640, 518);
          g.globalAlpha = 1;
        } else if (T.cap) {
          // caption: slides in from the left, bottom-left corner
          const x = 48 - Math.max(0, 1 - t * 4) * 500;
          g.textAlign = 'left';
          g.lineJoin = 'round';
          g.font = '900 46px Impact, "Arial Black", sans-serif';
          const y0 = T.top ? 112 : 604;
          g.lineWidth = 12; g.strokeStyle = '#1a0f2e'; g.strokeText(T.cap, x, y0);
          g.fillStyle = '#ffe234'; g.fillText(T.cap, x, y0);
          if (T.sub) {
            g.font = '800 24px "Segoe UI", Arial, sans-serif';
            g.lineWidth = 8; g.strokeText(T.sub, x + 4, y0 + 38);
            g.fillStyle = '#ffffff'; g.fillText(T.sub, x + 4, y0 + 38);
          }
        }
        if (T.fade > 0) { g.fillStyle = `rgba(255,255,255,${T.fade})`; g.fillRect(0, 0, 1280, 720); T.fade = Math.max(0, T.fade - 0.12); }
        requestAnimationFrame(draw);
      };
      draw();
      const stream = v.captureStream(30);
      const ac = Sound.context;
      const dest = ac.createMediaStreamDestination();
      Sound.master.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      const type = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      T.type = type;
      T.rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6, audioBitsPerSecond: 160000 });
      T.rec.ondataavailable = e => e.data.size && T.chunks.push(e.data);
      T.rec.start(1000);
    });
  }
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    await p.evaluate(s.setup);
    await p.evaluate(([cap, sub, end, top, card, cardSecs, cardBig]) => { if (window.__trailer) Object.assign(window.__trailer, { cap, sub, end: !!end, top: !!top, card, cardSecs, cardBig, capT: performance.now(), fade: 0.5 }); }, [s.cap, s.sub, s.end, s.top, s.card || '', s.cardSecs || (s.card ? 1.6 : 0), !!s.cardBig]);
    const steps = Math.round((s.secs + (s.card ? s.cardSecs || 1.6 : 0)) * 10);
    for (let k = 0; k < steps; k++) {
      if (s.tick) await p.evaluate(s.tick, k);
      await p.waitForTimeout(100);
      if (onlyShots && k === Math.floor(steps / 2)) await p.screenshot({ path: path.join(OUT, `shot_${String(i).padStart(2, '0')}.png`) });
    }
    console.log(`shot ${i + 1}/${SHOTS.length}: ${s.cap || '(title)'}  screen=${await p.evaluate(() => window.__sock.game.screen)}`);
  }
  if (!onlyShots) {
    const parts = await p.evaluate(async () => {
      const T = window.__trailer;
      await new Promise(ok => { T.rec.onstop = ok; T.rec.stop(); });
      const blob = new Blob(T.chunks, { type: T.type });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { type: T.type, b64: btoa(s) };
    });
    const file = path.join(OUT, 'sock-fighters-trailer.' + (parts.type.includes('mp4') ? 'mp4' : 'webm'));
    fs.writeFileSync(file, Buffer.from(parts.b64, 'base64'));
    console.log('saved', file, (fs.statSync(file).size / 1e6).toFixed(1), 'MB');
  }
  console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
