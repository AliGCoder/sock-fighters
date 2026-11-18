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
        const t = (performance.now() - T.capT) / 1000;
        if (T.end) {
          // the end card: dark, the game's name, where to play
          g.fillStyle = `rgba(14,6,40,${Math.min(0.82, t * 1.6)})`;
          g.fillRect(0, 0, 1280, 720);
          const a = Math.min(1, t * 1.5);
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.lineJoin = 'round';
          g.font = '900 104px Impact, "Arial Black", sans-serif';
          g.lineWidth = 16; g.strokeStyle = '#1a0f2e'; g.strokeText('SOCK FIGHTERS', 640, 300);
          g.fillStyle = '#ffe234'; g.fillText('SOCK FIGHTERS', 640, 300);
          g.font = '900 60px Impact, "Arial Black", sans-serif';
          g.lineWidth = 12; g.strokeText('TURBO RINSE', 640, 375);
          g.fillStyle = '#3ff0ff'; g.fillText('TURBO RINSE', 640, 375);
          g.font = '800 34px "Segoe UI", Arial, sans-serif';
          g.fillStyle = '#ffffff'; g.fillText('PLAY FREE IN YOUR BROWSER', 640, 470);
          g.fillStyle = '#ff4fa3'; g.fillText('aligcoder.github.io/sock-fighters', 640, 518);
          g.globalAlpha = 1;
        } else if (T.cap) {
          // caption: slides in from the left, bottom-left corner
          const x = 48 - Math.max(0, 1 - t * 4) * 500;
          g.textAlign = 'left';
          g.lineJoin = 'round';
          g.font = '900 56px Impact, "Arial Black", sans-serif';
          g.lineWidth = 12; g.strokeStyle = '#1a0f2e'; g.strokeText(T.cap, x, 640);
          g.fillStyle = '#ffe234'; g.fillText(T.cap, x, 640);
          if (T.sub) {
            g.font = '800 28px "Segoe UI", Arial, sans-serif';
            g.lineWidth = 8; g.strokeText(T.sub, x + 4, 684);
            g.fillStyle = '#ffffff'; g.fillText(T.sub, x + 4, 684);
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
    await p.evaluate(([cap, sub, end]) => { if (window.__trailer) Object.assign(window.__trailer, { cap, sub, end: !!end, capT: performance.now(), fade: 0.5 }); }, [s.cap, s.sub, s.end]);
    const steps = Math.round(s.secs * 10);
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
