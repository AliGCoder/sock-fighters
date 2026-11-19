// A video of the story mode's big moments (the Dryer Demon's story), played in the game with every voice:
// each line waits for its speaker to finish, gold title cards between the chapters, and a short bit of the final
// fight (Stinky vs the Demon). Writes tools/trailer/out/story-video.mp4 (or .webm).
//   node tools/trailer/story_video.js
const fs = require('fs'), path = require('path');
const pw = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;
const OUT = path.join(__dirname, 'out');
const HERO = 'shinobi'; // the story hero you play as (Stinky, Argyle and Gran come along anyway)

// [card title, card subtitle, how to start, from line]
const PARTS = [
  ['LAUNDRY NIGHT', 'Dryer No. 7 is hungry', ['prologue', 13]],
  ['CHAPTER 1', 'THE TUMBLE THRONE', ['ep', 5, 7]],
  [null, null, ['ep', 5, 9]],
  ['THE MITTEN PEAKS', "Gran's handbag", ['ep', 7, 8]],
  ['CHAPTER 2', 'THE SHOE WARS', ['ep', 17, 7]],
  [null, null, ['ep', 20, 7]],
  ['CHAPTER 3', 'THE WAY HOME', ['ep', 21, 0]],
  ['THE FINAL BATTLE', 'Dryer No. 7', ['ep', 27, 0]],
  [null, null, ['fight', 27, 1]],
  [null, null, ['ep', 27, 2]]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(1200);
  await p.mouse.click(5, 5); // wakes the sound up
  await p.evaluate(async hero => {
    const S = window.__sock;
    document.querySelectorAll('#avatar,#fullscreen,#mute,#fullscreen-tip').forEach(e => (e.style.display = 'none'));
    S.ROSTER.forEach(r => (S.Progress.data.heroes[r.id] = true));
    S.StoryVoices.loadFor(hero);
    // when does the line that is playing now end? (every voice clip remembers its end time)
    const ac = Sound.context;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset) {
      this._endsAt = (when || ac.currentTime) + (this.buffer ? this.buffer.duration - (offset || 0) : 0);
      return start.apply(this, arguments);
    };
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Bangers&display=swap';
    document.head.appendChild(l);
    await new Promise(r => (l.onload = r, setTimeout(r, 4000)));
    await Promise.all([document.fonts.load("20px 'Press Start 2P'"), document.fonts.load("60px 'Bangers'")]).catch(() => {});
  }, HERO);
  await p.waitForFunction(h => window.__sock.StoryVoices.files.story === 'ready' && window.__sock.StoryVoices.files['hero-' + h] === 'ready', HERO, { timeout: 90000 });

  // the recorder: the game picture, the chapter cards on top, and the game's sound
  await p.evaluate(() => {
    const game = document.querySelector('canvas');
    const v = document.createElement('canvas');
    v.width = 1280; v.height = 720;
    const g = v.getContext('2d');
    const T = (window.__sv = { card: null, sub: '', at: 0, chunks: [] });
    const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const draw = () => {
      g.drawImage(game, 0, 0, 1280, 720);
      const t = (performance.now() - T.at) / 1000;
      if (T.card) {
        const gr = g.createRadialGradient(640, 360, 40, 640, 360, 760);
        gr.addColorStop(0, '#22123d'); gr.addColorStop(0.6, '#0b0614'); gr.addColorStop(1, '#000');
        g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
        for (let i = 0; i < 50; i++) {
          const x = hash(i) * 1280, y = 720 - ((hash(i + 99) * 720 + t * (25 + hash(i + 7) * 50)) % 720);
          g.fillStyle = 'rgba(255,170,60,' + (0.25 + hash(i + 5) * 0.5) + ')';
          g.beginPath(); g.arc(x, y, 1 + hash(i + 11) * 2, 0, 7); g.fill();
        }
        const k = Math.min(1, t / 0.18), sc = 1 + (1 - (1 - Math.pow(1 - k, 3))) * 2;
        const shake = t > 0.18 ? Math.max(0, 1 - (t - 0.18) / 0.4) * 12 : 0;
        g.save();
        g.translate(640 + (hash(Math.floor(t * 60)) - 0.5) * shake, 330 + (hash(Math.floor(t * 60) + 9) - 0.5) * shake);
        g.scale(sc, sc);
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.font = "130px 'Bangers', Impact, sans-serif";
        g.lineWidth = 18; g.strokeStyle = '#120a20'; g.strokeText(T.card, 0, 0);
        const gold = g.createLinearGradient(0, -65, 0, 65);
        gold.addColorStop(0, '#fffbe0'); gold.addColorStop(0.42, '#ffd23f'); gold.addColorStop(0.58, '#e0870c'); gold.addColorStop(1, '#fff1a8');
        g.shadowColor = '#ff9d2e'; g.shadowBlur = 30;
        g.fillStyle = gold; g.fillText(T.card, 0, 0);
        g.restore();
        const n = Math.min(T.sub.length, Math.floor(Math.max(0, t - 0.5) * 22));
        g.font = "28px 'Press Start 2P', monospace"; g.textAlign = 'center';
        g.shadowColor = '#3fff8a'; g.shadowBlur = 16; g.fillStyle = '#c8ffd8';
        g.fillText(T.sub.slice(0, n), 640, 450);
        g.shadowBlur = 0;
      }
      for (let y = 0; y < 720; y += 3) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y, 1280, 1); }
      requestAnimationFrame(draw);
    };
    draw();
    const stream = v.captureStream(30);
    const dest = Sound.context.createMediaStreamDestination();
    Sound.master.connect(dest);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    T.type = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    T.rec = new MediaRecorder(stream, { mimeType: T.type, videoBitsPerSecond: 5e6, audioBitsPerSecond: 160000 });
    T.rec.ondataavailable = e => e.data.size && T.chunks.push(e.data);
    T.rec.start(1000);
  });

  const state = () => p.evaluate(() => {
    const g = window.__sock.game, sc = g.adv && g.adv.scene;
    const src = window.__sock.StoryVoices.source;
    return { screen: g.screen, i: sc ? sc.i : -1, len: sc && sc.lines[sc.i] ? sc.lines[sc.i].text.length : 0, shown: sc ? sc.shown : 0,
      talking: !!(src && src._endsAt && Sound.context.currentTime < src._endsAt) };
  });
  const press = () => p.evaluate(() => { keysPressed.Space = true; keysDown.Space = true; setTimeout(() => delete keysDown.Space, 30); });

  for (const [card, sub, how] of PARTS) {
    if (card) {
      await p.evaluate(([c, s]) => Object.assign(window.__sv, { card: c, sub: s, at: performance.now() }), [card, sub]);
      await p.waitForTimeout(2600);
    }
    await p.evaluate(([how, hero]) => {
      const S = window.__sock;
      const idx = S.ROSTER.findIndex(r => r.id === hero);
      S.Progress.data.adv = { prologue: how[0] !== 'prologue', hero: idx, look: 0, cleared: {}, seen: {} };
      if (how[0] === 'prologue') { S.game.story = null; S.prologueAt(how[1]); return; }
      S.startAdventure();
      if (S.game.screen === 'advSlots') S.continueGame();
      S.storyJump(how[1], how[2]);
    }, [how, HERO]);
    await p.evaluate(() => (window.__sv.card = null));
    if (how[0] === 'fight') {
      // a few seconds of the final fight: Stinky (you) against the Dryer Demon
      for (let k = 0; k < 200 && (await p.evaluate(() => window.__sock.game.screen)) !== 'fight'; k++) await p.waitForTimeout(100);
      await p.evaluate(() => { controller1 = new CpuController('hard', 1); controller2 = new CpuController('hard', 1); });
      await p.waitForTimeout(9000);
      continue;
    }
    console.log(`${card || '...'}: ${JSON.stringify(how)}`);
    let lastI = -2, lineAt = Date.now(), heard = false;
    for (let k = 0; k < 3000; k++) {
      const s = await state();
      if (s.screen !== 'advScene' && s.screen !== 'advStory') break;
      if (s.i !== lastI) { lastI = s.i; lineAt = Date.now(); heard = false; }
      if (s.talking) heard = true;
      const age = (Date.now() - lineAt) / 1000;
      const typed = s.shown >= s.len || age > 5; // ({HERO} can make the shown line shorter than the raw one)
      // move on when the speaker has finished (or, with no recording, after a reading pause)
      const done = heard ? !s.talking && age > 0.6 : age > Math.max(2.2, s.len * 0.045);
      if (typed && done) {
        await p.waitForTimeout(350);
        await press();
        await p.waitForTimeout(120);
      } else await p.waitForTimeout(80);
    }
  }
  await p.evaluate(() => Object.assign(window.__sv, { card: 'THE END', sub: '...for now', at: performance.now() }));
  await p.waitForTimeout(3500);
  // the finished video comes out of the page in pieces (one big string is too long for the browser)
  const info = await p.evaluate(async () => {
    const T = window.__sv;
    await new Promise(ok => { T.rec.onstop = ok; T.rec.stop(); });
    T.blob = new Blob(T.chunks, { type: T.type });
    return { type: T.type, size: T.blob.size };
  });
  const file = path.join(OUT, 'story-video.' + (info.type.includes('mp4') ? 'mp4' : 'webm'));
  const fd = fs.openSync(file, 'w');
  const PIECE = 16 * 1024 * 1024;
  for (let at = 0; at < info.size; at += PIECE) {
    const b64 = await p.evaluate(async ([at, n]) => {
      const buf = new Uint8Array(await window.__sv.blob.slice(at, at + n).arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, [at, PIECE]);
    fs.writeSync(fd, Buffer.from(b64, 'base64'));
  }
  fs.closeSync(fd);
  console.log('saved', file, (fs.statSync(file).size / 1e6).toFixed(1), 'MB');
  console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
