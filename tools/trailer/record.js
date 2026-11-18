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
  await p.evaluate(async () => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Bangers&display=swap';
    document.head.appendChild(l);
    await new Promise(r => (l.onload = r, setTimeout(r, 4000)));
    await Promise.all([document.fonts.load("30px 'Press Start 2P'"), document.fonts.load("60px 'Bangers'")]).catch(() => {});
  });
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
      const T = (window.__trailer = { cap: '', sub: '', capT: 0, end: false, chunks: [], fade: 0, marks: [], zoom0: 1, zoom1: 1, punch: 0 });
      // ---- trailer titles: the game's comic font in metallic gold that SLAMS in (shake, colour split, sparks, a lens
      // streak, a light sweep), and an elegant typewriter wipe for the quiet cold-open lines ----
      const DISPLAY = "'Bangers', Impact, sans-serif", PIXEL = "'Press Start 2P', monospace";
      const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
      const tc = document.createElement('canvas');
      tc.width = 1280; tc.height = 720;
      const tg = tc.getContext('2d');
      const gold = size => {
        const gr = g.createLinearGradient(0, -size / 2, 0, size / 2);
        gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.42, '#ffd23f'); gr.addColorStop(0.58, '#e0870c'); gr.addColorStop(1, '#fff1a8');
        return gr;
      };
      const cardBackground = t => {
        const gr = g.createRadialGradient(640, 360, 40, 640, 360, 760);
        gr.addColorStop(0, '#22123d'); gr.addColorStop(0.6, '#0b0614'); gr.addColorStop(1, '#000');
        g.fillStyle = gr;
        g.fillRect(0, 0, 1280, 720);
        // embers drifting up
        for (let i = 0; i < 60; i++) {
          const x = hash(i) * 1280 + Math.sin(t * 0.8 + i) * 14;
          const y = 720 - ((hash(i + 99) * 720 + t * (25 + hash(i + 7) * 50)) % 720);
          g.fillStyle = 'rgba(255,' + (140 + ((hash(i + 3) * 90) | 0)) + ',60,' + (0.25 + hash(i + 5) * 0.5) + ')';
          g.beginPath(); g.arc(x, y, 1 + hash(i + 11) * 2.2, 0, 7); g.fill();
        }
      };
      const sparks = (cx, cy, t, n, seed) => {
        if (t < 0 || t > 0.9) return;
        for (let i = 0; i < n; i++) {
          const a = hash(seed + i) * Math.PI * 2, v = 380 + hash(seed + i + 50) * 900;
          const x = cx + Math.cos(a) * v * t, y = cy + Math.sin(a) * v * t * 0.6 + 420 * t * t;
          const al = Math.max(0, 1 - t / 0.9);
          g.strokeStyle = i % 3 ? 'rgba(255,210,63,' + al + ')' : 'rgba(255,255,255,' + al + ')';
          g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 18, y - Math.sin(a) * 11); g.stroke();
        }
      };
      const streak = (cy, t) => {
        if (t < 0 || t > 0.6) return;
        const al = 1 - t / 0.6;
        const gr = g.createLinearGradient(0, 0, 1280, 0);
        gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(0.5, 'rgba(220,240,255,' + 0.85 * al + ')'); gr.addColorStop(1, 'rgba(120,200,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, cy - 3, 1280, 6);
        g.fillStyle = 'rgba(160,210,255,' + 0.25 * al + ')';
        g.fillRect(0, cy - 14, 1280, 28);
      };
      const sweep = (text, cx, cy, size, sc, k, font) => {
        if (k < 0 || k > 1) return;
        tg.clearRect(0, 0, 1280, 720);
        tg.save(); tg.translate(cx, cy); tg.scale(sc, sc);
        tg.font = size + 'px ' + font; tg.textAlign = 'center'; tg.textBaseline = 'middle';
        tg.fillStyle = '#fff'; tg.fillText(text, 0, 0); tg.restore();
        tg.globalCompositeOperation = 'source-in';
        const x = -200 + k * 1700;
        const gr = tg.createLinearGradient(x - 110, 0, x + 110, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        tg.fillStyle = gr; tg.fillRect(0, 0, 1280, 720);
        tg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = 'lighter'; g.drawImage(tc, 0, 0); g.globalCompositeOperation = 'source-over';
      };
      /** a big title that slams onto the screen; t = seconds since it started */
      const slam = (text, cx, cy, size, t, glow, seed) => {
        if (t < 0) return;
        const IN = 0.18, p = Math.min(1, t / IN), e = 1 - Math.pow(1 - p, 3);
        const after = Math.max(0, t - IN);
        const sc = (1 + (1 - e) * 2.2) * (1 + 0.035 * after);
        const shake = t > IN ? Math.max(0, 1 - after / 0.45) * 16 : 0;
        const dx = (hash(Math.floor(t * 60) + seed) - 0.5) * shake, dy = (hash(Math.floor(t * 60) + seed + 9) - 0.5) * shake;
        g.save();
        g.translate(cx + dx, cy + dy);
        g.scale(sc, sc);
        g.font = size + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.globalAlpha = Math.min(1, p * 1.6);
        const split = t > IN ? Math.max(0, 1 - after / 0.35) : 0.5;
        if (split > 0) {
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = 'rgba(255,40,70,' + 0.75 * split + ')'; g.fillText(text, -12 * split, 0);
          g.fillStyle = 'rgba(40,200,255,' + 0.75 * split + ')'; g.fillText(text, 12 * split, 0);
          g.globalCompositeOperation = 'source-over';
        }
        g.lineWidth = size * 0.15; g.strokeStyle = '#120a20'; g.strokeText(text, 0, 0);
        g.shadowColor = glow; g.shadowBlur = 34;
        g.fillStyle = gold(size); g.fillText(text, 0, 0);
        g.shadowBlur = 0;
        g.restore();
        if (t > IN) { streak(cy, after); sparks(cx, cy, after, 46, seed); }
        sweep(text, cx + dx, cy + dy, size, sc, (after - 0.35) / 0.7, DISPLAY);
      };
      /** a quiet line typed out letter by letter in the arcade pixel font, with a blinking block cursor */
      const whisper = (text, cx, cy, t, dur) => {
        g.save();
        g.font = '30px ' + PIXEL; g.textAlign = 'left'; g.textBaseline = 'middle';
        const w = g.measureText(text).width;
        const n = Math.min(text.length, Math.floor(Math.max(0, t - 0.15) * 22));
        const out = Math.max(0, Math.min(1, (dur - t) * 3));
        const flick = 0.88 + 0.12 * hash(Math.floor(t * 30));
        const x0 = cx - w / 2, shown = text.slice(0, n);
        g.globalAlpha = out * flick;
        g.shadowColor = '#3fff8a'; g.shadowBlur = 18;
        g.fillStyle = '#c8ffd8';
        g.fillText(shown, x0, cy);
        if (Math.floor(t * 3) % 2 === 0 || n < text.length) {
          const cw = g.measureText(shown).width;
          g.fillStyle = '#3fff8a'; g.fillRect(x0 + cw + 6, cy - 15, 24, 30);
        }
        g.restore();
      };
      // the old arcade-cabinet screen: scanlines, a faint flicker and dark curved corners, over every frame
      const crtC = document.createElement('canvas');
      crtC.width = 1280; crtC.height = 720;
      {
        const c = crtC.getContext('2d');
        for (let y = 0; y < 720; y += 3) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, y, 1280, 1); }
        const v = c.createRadialGradient(640, 360, 300, 640, 360, 820);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.75, 'rgba(0,0,0,0.25)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
        c.fillStyle = v; c.fillRect(0, 0, 1280, 720);
      }
      const crt = () => {
        g.drawImage(crtC, 0, 0);
        const f = hash(Math.floor(performance.now() / 33));
        if (f > 0.85) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(0, 0, 1280, 720); }
        // a slow rolling bright band, like an old tube
        const ry = (performance.now() / 9) % 900 - 90;
        const gr = g.createLinearGradient(0, ry - 60, 0, ry + 60);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.035)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, ry - 60, 1280, 120);
      };
      const draw = () => {
        g.imageSmoothingEnabled = true;
        {
          // camera: a slow push-in through every shot, and a quick punch-in when a super starts
          const st = Math.max(0, (performance.now() - T.capT) / 1000 - (T.card ? T.cardSecs : 0));
          const k = Math.min(1, st / Math.max(0.5, T.shotSecs || 4));
          let z = T.zoom0 + (T.zoom1 - T.zoom0) * (k * k * (3 - 2 * k));
          if (T.punch) z *= 1 + 0.12 * Math.max(0, Math.sin(Math.min(Math.PI, st * 2.2)));
          const w = 1280 * z, h = 720 * z;
          g.drawImage(game, (1280 - w) / 2, (720 - h) / 2 - (z - 1) * 120, w, h);
        }
        const t0 = (performance.now() - T.capT) / 1000;
        const cs = T.card ? T.cardSecs : 0;
        const t = t0 - cs; // captions start after the card
        if (T.card && t0 < cs) {
          // a title card: a slow push on embers, the line slams (big) or writes itself on (quiet), white flash out
          cardBackground(t0);
          const k = 1 + 0.05 * (t0 / cs);
          g.save(); g.translate(640, 360); g.scale(k, k); g.translate(-640, -360);
          if (T.cardBig) slam(T.card, 640, 372, 150, t0 - 0.05, '#ff9d2e', T.card.length * 17);
          else whisper(T.card, 640, 360, t0, cs);
          g.restore();
          if (T.cardBig && cs - t0 < 0.2) { g.fillStyle = 'rgba(0,0,0,' + (1 - (cs - t0) / 0.2) * 0.6 + ')'; g.fillRect(0, 0, 1280, 720); }
          crt();
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
          // the end card: darkness, the logo slams in, TURBO RINSE right behind it, then where to play
          g.fillStyle = 'rgba(0,0,0,' + Math.min(0.88, t * 1.6) + ')';
          g.fillRect(0, 0, 1280, 720);
          slam('SOCK FIGHTERS', 640, 280, 170, t - 0.25, '#ff9d2e', 7);
          slam('TURBO RINSE', 640, 400, 84, t - 0.75, '#3ff0ff', 31);
          const a = Math.max(0, Math.min(1, (t - 1.4) * 2));
          g.save();
          g.globalAlpha = a;
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
          g.font = '56px ' + DISPLAY;
          g.lineWidth = 9; g.strokeStyle = '#120a20'; g.strokeText('PLAY FREE NOW', 640, 500);
          g.fillStyle = '#3fff8a'; g.fillText('PLAY FREE NOW', 640, 500);
          g.font = '18px ' + PIXEL;
          g.lineWidth = 6; g.strokeText('aligcoder.github.io/sock-fighters', 640, 556);
          g.fillStyle = '#ff7ac0'; g.fillText('aligcoder.github.io/sock-fighters', 640, 556);
          if (Math.floor(t * 2.2) % 2 === 0) {
            g.font = '24px ' + PIXEL;
            g.shadowColor = '#ffd23f'; g.shadowBlur = 14;
            g.fillStyle = '#ffd23f'; g.fillText('INSERT COIN', 640, 622);
          }
          g.shadowBlur = 0;
          g.font = '14px ' + PIXEL; g.fillStyle = '#9fd8ff';
          g.fillText('1P START    CREDIT 00', 640, 664);
          g.restore();
        } else if (T.cap) {
          // caption: the comic font in gold, whips in from the left with a slant, a gold bar draws under it
          const k = Math.min(1, Math.max(0, t) / 0.28), e = 1 - Math.pow(1 - k, 3);
          const x = 48 - (1 - e) * 700;
          const y0 = T.top ? 116 : 606;
          g.save();
          g.translate(x, y0);
          g.transform(1, 0, -0.12 * (1 - e) - 0.04, 1, 0, 0);
          g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
          g.font = '58px ' + DISPLAY;
          g.lineWidth = 10; g.strokeStyle = '#120a20'; g.strokeText(T.cap, 0, 0);
          g.shadowColor = '#ff9d2e'; g.shadowBlur = 16;
          g.fillStyle = gold(58); g.translate(0, -20); g.fillText(T.cap, 0, 20); g.translate(0, 20);
          g.shadowBlur = 0;
          const bw = g.measureText(T.cap).width * Math.min(1, Math.max(0, t - 0.15) / 0.35);
          g.fillStyle = '#ffd23f'; g.fillRect(0, 10, bw, 4);
          if (T.sub) {
            g.font = '18px ' + PIXEL;
            g.globalAlpha = Math.min(1, Math.max(0, t - 0.25) * 4);
            g.lineWidth = 6; g.strokeText(T.sub, 2, 44);
            g.fillStyle = '#ffffff'; g.fillText(T.sub, 2, 44);
          }
          g.restore();
        }
        crt();
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
      T.recAt = performance.now();
    });
  }
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    await p.evaluate(s.setup);
    await p.evaluate(([cap, sub, end, top, card, cardSecs, cardBig, shotSecs, zoom, punch, say]) => { const T = window.__trailer; if (T) { Object.assign(T, { cap, sub, end: !!end, top: !!top, card, cardSecs, cardBig, capT: performance.now(), fade: 0.5, shotSecs, zoom0: zoom[0], zoom1: zoom[1], punch: !!punch }); T.marks.push({ at: (performance.now() - T.recAt) / 1000, card, cardSecs, cardBig, end: !!end, punch: !!punch, say }); } }, [s.cap, s.sub, s.end, s.top, s.card || '', s.cardSecs || (s.card ? 1.6 : 0), !!s.cardBig, s.secs, s.zoom || [1.0, 1.06], !!s.punch, s.say || '']);
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
      return { type: T.type, b64: btoa(s), marks: T.marks };
    });
    const file = path.join(OUT, 'sock-fighters-trailer.' + (parts.type.includes('mp4') ? 'mp4' : 'webm'));
    fs.writeFileSync(file, Buffer.from(parts.b64, 'base64'));
    fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(parts.marks, null, 1));
    console.log('saved', file, (fs.statSync(file).size / 1e6).toFixed(1), 'MB');
  }
  console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
