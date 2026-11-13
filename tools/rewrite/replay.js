// Deterministic replay checker: plays identical scripted input on a game file and records a fingerprint
// of the canvas every 15 frames. Two versions of the game behave identically if all fingerprints match.
//   node replay.js record <file.html> <out.json>
//   node replay.js compare <a.json> <b.json>
const { chromium } = require('../announcer/node_modules/playwright');
const fs = require('fs'), path = require('path');

// Runs in the page before the game: makes everything deterministic.
const INIT = () => {
  let s = 12345; // seeded Math.random (mulberry32)
  Math.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let now = 1000; // manual clock + manual animation frames
  performance.now = () => now;
  Date.now = () => now;
  window.__rafs = [];
  window.requestAnimationFrame = cb => { window.__rafs.push(cb); return 1; };
  window.__step = () => { now += 1000 / 60; const cbs = window.__rafs; window.__rafs = []; cbs.forEach(cb => cb(now)); };
  // no audio: async decoding would make the random-number order nondeterministic
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  try { localStorage.clear(); } catch (e) {}
};

// The scripted session. Waits on real screens, so it adapts to how long fights take.
async function session(T) {
  const { tap, run, mash, until, act } = T;
  await run(30);
  await tap('KeyV'); await tap('KeyV'); await tap('KeyN');      // announcer style + voice keys on title
  await tap('Space', 40);                                        // -> mode menu
  await tap('KeyS'); await tap('KeyS'); await tap('Space', 60);  // -> moves list
  await tap('Escape', 30); await tap('KeyW'); await tap('KeyW');  // back, cursor to arcade
  await tap('Space', 30);                                        // -> difficulty
  await tap('KeyD'); await tap('KeyD'); await tap('KeyA'); await tap('KeyA');
  await tap('Space', 30);                                        // easy -> select
  for (let i = 0; i < 8; i++) await tap('KeyD', 14);            // every character
  await tap('KeyS', 14); await tap('KeyW', 14);                  // skins
  await tap('Space', 30); await until('ladder');
  for (let stage = 0; stage < 3; stage++) {                      // whole Easy ladder -> ending
    await until('ladder'); await run(90); await tap('Space', 10);
    await until('vs'); await run(90); await tap('Space', 10);
    await until('fight');
    for (let round = 0; round < 6 && T.screen() === 'fight'; round++) {
      await act('healP1'); await mash(360, false);
      if (stage === 0 && round === 0) { await tap('Escape', 40); await tap('Escape', 20); } // pause + resume
      await act('winP1'); await mash(60, false); await run(300);
    }
    await until('result'); await run(90); await tap('Space', 10);
  }
  await until('ending'); await run(700); await act('unprotect');
  // 2 player fights for every character
  for (let c = 0; c < 8; c++) {
    await act('toTitle'); await run(10);
    await tap('Space', 30); await tap('KeyS'); await tap('Space', 40);
    for (let i = 0; i < c; i++) await tap('KeyD', 6);
    await tap('Space', 30);
    for (let i = 0; i < (c + 3) % 8; i++) await tap('ArrowRight', 6);
    await tap('ArrowDown', 6); await tap('KeyK', 10);
    await until('vs'); await run(90); await tap('Space', 10); await until('fight');
    await mash(900, true); await act(c % 2 ? 'winP1' : 'winP2'); await run(400);
  }
  // hard ladder: lose on purpose -> continue countdown -> game over
  await act('toTitle'); await run(10);
  await tap('Space', 30); await tap('Space', 30); await tap('KeyD'); await tap('KeyD'); await tap('Space', 30);
  await tap('Space', 10); await until('ladder'); await run(90); await tap('Space', 10);
  await until('vs'); await run(90); await tap('Space', 10); await until('fight');
  for (let round = 0; round < 4 && T.screen() === 'fight'; round++) { await mash(300, false); await act('winP2'); await run(300); }
  await until('result'); await run(90); await tap('Space', 10);
  await until('cont'); await run(700);
}

// deterministic "button masher" for fights
function masher(seed) {
  let r = seed;
  const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const P1 = ['Space', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'KeyT'], P2 = ['KeyK', 'KeyL', 'Semicolon', 'Quote', 'KeyO', 'KeyP'];
  const D1 = ['KeyA', 'KeyD', 'KeyW', 'KeyS'], D2 = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  return async (T, frames, two) => {
    for (let f = 0; f < frames; f += 6) {
      const d = D1[(rnd() * 4) | 0];
      await T.key('+' + d);
      if (rnd() < 0.15) await T.key('+KeyS');
      if (rnd() < 0.6) await T.key(P1[(rnd() * P1.length) | 0]);
      if (rnd() < 0.12) { await T.key('KeyS'); await T.key('KeyF'); }
      let d2;
      if (two) { d2 = D2[(rnd() * 4) | 0]; await T.key('+' + d2); if (rnd() < 0.6) await T.key(P2[(rnd() * P2.length) | 0]); }
      await T.run(6);
      await T.key('-' + d); await T.key('-KeyS');
      if (two) await T.key('-' + d2);
    }
  };
}

async function record(file, out) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // same fallback fonts every run
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto('file:///' + path.resolve(file).replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  const shots = [];
  let frame = 0, screen = 'title';
  const snap = async () => shots.push(await page.evaluate(f => {
    const c = document.getElementById('c'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h1 = 2166136261 >>> 0, h2 = 0;
    for (let i = 0; i < x.length; i++) { h1 = Math.imul(h1 ^ x[i], 16777619) >>> 0; h2 = (h2 + x[i] * ((i % 251) + 1)) >>> 0; }
    const g = __sock.game;
    return { f, h: h1.toString(16) + h2.toString(16), screen: g.screen, hp: __sock.f1 ? [__sock.f1.hp, __sock.f2.hp] : null };
  }, frame));
  const T = {
    screen: () => screen,
    key: a => page.evaluate(a => {
      const ev = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
      if (a[0] === '+') ev('keydown', a.slice(1));
      else if (a[0] === '-') ev('keyup', a.slice(1));
      else { ev('keydown', a); ev('keyup', a); }
    }, a),
    run: async n => {
      for (let i = 0; i < n; i++) {
        screen = await page.evaluate(() => { window.__step(); if (window.__protectP1 && __sock.f1 && __sock.f1.hp < 400) __sock.f1.hp = 400; return __sock.game.screen; });
        if (++frame % 15 === 0) await snap();
      }
    },
    tap: async (k, wait = 12) => { await T.key(k); await T.run(wait); },
    until: async (want, max = 4000) => {
      let n = 0;
      while (screen !== want && n++ < max) await T.run(1);
      if (screen !== want) throw new Error('never reached ' + want + ' (at ' + screen + ', frame ' + frame + ')');
    },
    act: a => page.evaluate(a => {
      const g = __sock.game;
      if (a === 'toTitle') { g.screen = 'title'; g.paused = false; return; }
      if (a === 'healP1') { window.__protectP1 = true; return; } // test player can't be knocked out on the Easy ladder
      if (a === 'unprotect') { window.__protectP1 = false; return; }
      // end the round on the clock with the chosen player ahead
      if ((a === 'winP1' || a === 'winP2') && g.screen === 'fight' && g.phase === 'fight') {
        const loser = a === 'winP1' ? __sock.f2 : __sock.f1, winner = a === 'winP1' ? __sock.f1 : __sock.f2;
        if (winner.hp < 2) winner.hp = 2;
        loser.hp = 1;
        g.timer = 1;
      }
    }, a)
  };
  const m = masher(7);
  T.mash = (n, two) => m(T, n, two);
  try { await session(T); } catch (e) { errors.push('SCRIPT: ' + e.message); }
  await snap();
  fs.writeFileSync(out, JSON.stringify({ frames: frame, errors, shots }));
  console.log(file + ': ' + frame + ' frames, ' + shots.length + ' fingerprints, ' + errors.length + ' errors', errors.slice(0, 5));
  const screens = {};
  shots.forEach(s => (screens[s.screen] = (screens[s.screen] || 0) + 1));
  console.log('screens covered:', JSON.stringify(screens));
  await browser.close();
}

function compare(a, b) {
  const A = JSON.parse(fs.readFileSync(a)), B = JSON.parse(fs.readFileSync(b));
  if (B.errors.length) console.log('errors in', b, B.errors);
  const n = Math.min(A.shots.length, B.shots.length);
  for (let i = 0; i < n; i++)
    if (A.shots[i].h !== B.shots[i].h) {
      console.log('FIRST DIFFERENCE at frame ' + A.shots[i].f + ': ' + JSON.stringify(A.shots[i]) + ' vs ' + JSON.stringify(B.shots[i]));
      process.exit(1);
    }
  if (A.shots.length !== B.shots.length) { console.log('different lengths', A.shots.length, B.shots.length); process.exit(1); }
  console.log('IDENTICAL: all ' + n + ' fingerprints match over ' + A.frames + ' frames');
}

const [cmd, x, y] = process.argv.slice(2);
if (cmd === 'record') record(x, y);
else if (cmd === 'compare') compare(x, y);
else console.log('usage: node replay.js record <file.html> <out.json> | compare <a.json> <b.json>');
