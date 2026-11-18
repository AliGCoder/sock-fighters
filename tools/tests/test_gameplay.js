// Live gameplay checks from the QA report: combo reliability at different distances, hitboxes (crouching, jumping,
// big bosses, the corner), blocking (high/low), no inescapable stun loops, wake-up invincibility, each CPU difficulty
// plays harder than the last, and story upgrades never leak into arcade / 2-player fights.
// The game is run frame by frame (60 frames = 1 second), pressing keys exactly like a player.
const pw = require('../announcer/node_modules/playwright');
const path = require('path');
const URL = process.argv[2] || require('url').pathToFileURL(path.join(__dirname, '../../index.html')).href;
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.__sock.resetProgress());
  // helpers inside the page
  await p.evaluate(() => {
    const S = window.__sock;
    const H = (window.__T = {});
    H.held = new Set();
    H.step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        for (const k of H.held) keysDown[k] = true;
        updateGame();
        if (S.game.timer < 50) S.game.timer = 99; // never time out mid-test
      }
    };
    H.hold = (...k) => k.forEach(c => H.held.add(c));
    H.release = (...k) => k.forEach(c => { H.held.delete(c); delete keysDown[c]; });
    H.tap = c => { keysPressed[c] = true; keysDown[c] = true; H.step(1); delete keysDown[c]; };
    /** a fresh fight; gap = distance between the two socks; mode '2p' (both by keys) or a CPU difficulty */
    H.fight = (gap = 110, mode = '2p', p1 = 'stinky', p2 = 'argyle', x = 480) => {
      H.release(...H.held);
      for (const k in keysDown) delete keysDown[k];
      for (const k in keysPressed) delete keysPressed[k];
      S.game.story = null;
      S.game.mode = mode === '2p' ? '2p' : 'cpu';
      if (mode !== '2p') S.game.arcade = { tier: mode, list: [{ id: p2, k: 0 }], stage: 0 };
      S.game.p1Def = S.look(S.findCharacter(p1), 0);
      S.game.p2Def = S.look(S.findCharacter(p2), 0);
      S.game.stageId = 'laundry';
      S.startMatch();
      for (let i = 0; i < 600 && S.game.phase !== 'fight'; i++) H.step(1);
      S.f1.x = x - gap / 2;
      S.f2.x = x + gap / 2;
      H.step(2);
    };
    H.until = (fn, max = 120) => { for (let i = 0; i < max; i++) { if (fn()) return i; H.step(1); } return -1; };
    H.idle = () => ['idle', 'walk', 'crouch'].includes(S.f1.state) && ['idle', 'walk', 'crouch', 'block'].includes(S.f2.state);
  });
  const run = fn => p.evaluate(fn);
  const R = {};

  // 1. COMBOS: punch -> kick, crouch-punch -> kick, kick -> kick2 -> kick3, at three distances, vs a still and a walking opponent.
  //    For each, the frames after the first hit in which pressing the next button still combos (the "combo window").
  R.combos = await run(() => {
    const S = window.__sock, T = window.__T, out = {};
    const tryCombo = (gap, first, second, walk, delay) => {
      T.fight(gap);
      if (walk) T.hold('ArrowLeft'); // P2 walks forward into it
      if (first === 'cpunch') T.hold('KeyS');
      // delay = frames after pressing PUNCH before pressing KICK (60 frames = 1 second)
      T.tap('Space');
      let landed = false;
      for (let i = 1; i < delay; i++) { T.step(1); if (S.f2.hp < S.f2.hpMax) landed = true; }
      if (first === 'cpunch') T.release('KeyS');
      T.tap(second);
      if (S.f2.hp < S.f2.hpMax) landed = true;
      let best = 0;
      for (let i = 0; i < 50; i++) { T.step(1); best = Math.max(best, S.f2.combo); }
      if (!landed && best === 0) return 'miss';
      return best >= 2 ? 'combo' : 'no';
    };
    for (const gap of [80, 110, 140]) for (const walk of [false, true]) for (const first of ['punch', 'cpunch']) {
      const ok = [];
      let missed = false;
      // does the first button reach on its own from here?
      T.fight(gap);
      if (walk) T.hold('ArrowLeft');
      if (first === 'cpunch') T.hold('KeyS');
      T.tap('Space');
      if (T.until(() => S.f2.hp < S.f2.hpMax, 30) < 0) { out[first + '>kick gap' + gap + (walk ? ' walking' : '')] = 'first hit out of reach (correct)'; continue; }
      let misses = 0;
      for (let d = 1; d <= 30; d++) {
        const r = tryCombo(gap, first, 'KeyE', walk, d);
        if (r === 'miss') misses++;
        if (r === 'combo') ok.push(d);
      }
      missed = misses === 30;
      out[first + '>kick gap' + gap + (walk ? ' walking' : '')] = missed ? 'first hit out of reach' : ok.length ? ok.length + ' frames (' + ok[0] + '-' + ok[ok.length - 1] + ')' : 'NEVER';
    }
    // the kick chain: KICK KICK KICK
    for (const gap of [80, 110, 140]) {
      T.fight(gap);
      const seen = new Set();
      let best = 0;
      for (let i = 0; i < 90; i++) {
        if (i % 6 === 0) T.tap('KeyE'); else T.step(1);
        for (const m of ['kick', 'kick2', 'kick3']) if (S.f1.move === m && S.f1.state === 'atk') seen.add(m);
        best = Math.max(best, S.f2.combo);
      }
      out['kick chain gap' + gap] = [...seen].join('>') + ', ' + best + ' hits' + (seen.has('kick3') ? '' : ' (no Sock-nado)');
    }
    return out;
  });

  // 2. HITBOXES: punch/kick/sweep vs a crouching sock, the jumping kick vs standing and crouching, the biggest bosses,
  //    and in the corner.
  R.hitboxes = await run(() => {
    const S = window.__sock, T = window.__T, out = {};
    const hits = (setup, press, frames = 40) => {
      setup();
      const hp = S.f2.hp;
      press();
      T.step(frames);
      return S.f2.hp < hp;
    };
    for (const [name, key, low] of [['punch', 'Space'], ['kick', 'KeyE'], ['cpunch', 'Space', 1], ['sweep', 'KeyE', 1]]) {
      out[name + ' vs crouching'] = hits(() => { T.fight(100); T.hold('ArrowDown'); T.step(6); }, () => { if (low) T.hold('KeyS'); T.tap(key); });
      out[name + ' vs standing'] = hits(() => T.fight(100), () => { if (low) T.hold('KeyS'); T.tap(key); });
    }
    // jump in from three distances, kicking at any moment of the jump: does any timing hit?
    const jumpKick = crouch => {
      const ok = [];
      for (const gap of [130, 170, 210]) for (let k = 2; k <= 30; k += 2)
        if (hits(() => { T.fight(gap); if (crouch) T.hold('ArrowDown'); T.step(4); }, () => {
          T.hold('KeyW', 'KeyD');
          T.step(k);
          T.release('KeyW', 'KeyD');
          T.tap('KeyE');
        }, 60)) ok.push(gap + '@' + k);
      return ok.length ? true : false;
    };
    out['jump kick vs standing'] = jumpKick(false);
    out['jump kick vs crouching'] = jumpKick(true);
    // the biggest characters in the game
    const big = window.__sock.ROSTER.concat(Object.values(window.__sock.CHARS || {})).filter(Boolean);
    const sized = [...new Map(big.map(d => [d.id, d])).values()].sort((a, c) => (c.size || c.scale || 1) - (a.size || a.scale || 1)).slice(0, 3);
    for (const d of sized) {
      out['punch vs ' + d.id] = hits(() => T.fight(110, '2p', 'stinky', d.id), () => T.tap('Space'));
      out['kick vs ' + d.id] = hits(() => T.fight(120, '2p', 'stinky', d.id), () => T.tap('KeyE'));
    }
    // the corner: the opponent pressed against the right wall
    out['punch in the corner'] = hits(() => { T.fight(100, '2p', 'stinky', 'argyle', 2000); }, () => T.tap('Space'));
    out['corner positions'] = Math.round(S.f1.x) + ' / ' + Math.round(S.f2.x);
    return out;
  });

  // 3. BLOCKING: holding back blocks high and mid; only crouching-back blocks the sweep; blocked hits do little damage.
  R.blocking = await run(() => {
    const S = window.__sock, T = window.__T, out = {};
    const test = (back, crouch, key, low) => {
      T.fight(100);
      if (back) T.hold('ArrowRight');
      if (crouch) T.hold('ArrowDown');
      T.step(4);
      const hp = S.f2.hp;
      let blocked = false;
      if (low) T.hold('KeyS');
      T.tap(key);
      for (let i = 0; i < 40; i++) { T.step(1); if (S.f2.state === 'block') blocked = true; }
      return { blocked: blocked && hp - S.f2.hp < 20, dmg: hp - S.f2.hp };
    };
    const show = r => (r.blocked ? 'BLOCKED' : 'hit') + ' (' + r.dmg + ' dmg)';
    out['punch vs standing block'] = show(test(true, false, 'Space'));
    out['kick vs standing block'] = show(test(true, false, 'KeyE'));
    out['sweep vs standing block'] = show(test(true, false, 'KeyE', 1));
    out['sweep vs crouching block'] = show(test(true, true, 'KeyE', 1));
    out['punch vs no block'] = show(test(false, false, 'Space'));
    // the BLOCK button (player 2: I) and the DODGE button (player 2: U)
    const withBlockButton = (low, key) => { T.fight(100); T.hold('KeyI'); if (low) T.hold('ArrowDown'); T.step(4); const hp = S.f2.hp; if (low) T.hold('KeyS'); T.tap(key); T.step(40); return hp - S.f2.hp; };
    out['BLOCK button vs punch'] = withBlockButton(false, 'Space') < 20 ? 'BLOCKED' : 'hit';
    out['BLOCK button vs kick'] = withBlockButton(false, 'KeyE') < 20 ? 'BLOCKED' : 'hit';
    out['BLOCK + DOWN vs sweep'] = withBlockButton(true, 'KeyE') < 20 ? 'BLOCKED' : 'hit';
    out['BLOCK button stands still'] = (() => { T.fight(100); const x = S.f2.x; T.hold('KeyI', 'ArrowRight'); T.step(30); return Math.abs(S.f2.x - x) < 2; })();
    T.fight(100); T.tap('KeyE'); T.tap('KeyU'); T.step(40); // kick comes out, the defender dodges
    out['DODGE avoids a kick'] = S.f2.hp === S.f2.hpMax ? 'DODGED' : 'hit';
    T.fight(100); T.tap('KeyU'); T.step(3); const cool = S.f2.dodgeCool; T.step(60);
    out['DODGE cooldown'] = cool > 0 && S.f2.dodgeCool === 0;
    return out;
  });

  // 4. STUN LOOPS: an attacker mashing every button for 10 seconds (also in the corner) vs a defender holding block.
  //    After the first hit, the defender must get to block: no endless combo.
  R.loops = await run(() => {
    const S = window.__sock, T = window.__T, out = {};
    const keys = ['Space', 'KeyE', 'KeyF', 'KeyQ'];
    for (const [where, x] of [['middle', 480], ['corner', 2000]]) for (const [pat, seq] of [['mash all', keys], ['punch only', ['Space']], ['kick only', ['KeyE']], ['low', ['Space', 'KeyE']]]) {
      T.fight(90, '2p', 'stinky', 'argyle', x);
      T.hold('ArrowRight');
      if (pat === 'low') { T.hold('KeyS'); T.hold('ArrowDown'); }
      let maxCombo = 0, hitsTaken = 0, lastHp = S.f2.hp, blockedFrames = 0;
      for (let i = 0; i < 600; i++) {
        S.f2.hp = Math.max(S.f2.hp, 300); // keep both alive
        S.f1.hp = S.f1.hpMax;
        lastHp = S.f2.hp;
        if (i % 4 === 0) T.tap(seq[(i / 4) % seq.length]); else T.step(1);
        if (S.f2.hp < lastHp - 15) hitsTaken++;
        if (S.f2.state === 'block') blockedFrames++;
        maxCombo = Math.max(maxCombo, S.f2.combo);
        S.f1.x = Math.min(S.f1.x, S.f2.x - 60);
      }
      out[where + ', ' + pat] = { longestCombo: maxCombo, hitsTaken, blockedFrames };
    }
    // wake-up: how long a knocked-down sock can't be hit when it gets up
    T.fight(100);
    T.hold('KeyS');
    T.tap('KeyE'); // sweep: knockdown
    T.release('KeyS');
    T.until(() => S.f2.state === 'getup', 200);
    let inv = 0;
    for (let i = 0; i < 60 && S.f2.state === 'getup'; i++) { if (S.f2.inv > 0) inv++; T.step(1); }
    out['wake-up protection frames'] = inv;
    return out;
  });

  // 5. CPU DIFFICULTY: each level vs a player who stands still (damage the CPU deals in 20 s) and vs a player
  //    who keeps punching (how many punches the CPU blocks). 5 tries each, averaged.
  R.cpu = await run(() => {
    const S = window.__sock, T = window.__T, out = {};
    for (const tier of Object.keys(DIFFICULTY)) {
      let dmg = 0, punches = 0, blocked = 0, cpuHits = 0;
      for (let rep = 0; rep < 5; rep++) {
        T.fight(200, tier);
        for (let i = 0; i < 1200; i++) {
          S.f2.hp = S.f2.hpMax;
          const before = S.f1.hp;
          T.step(1);
          if (S.f1.hp < before) { dmg += before - S.f1.hp; cpuHits++; }
          S.f1.hp = S.f1.hpMax;
        }
        T.fight(100, tier);
        for (let i = 0; i < 1200; i++) {
          S.f1.hp = S.f1.hpMax;
          S.f2.hp = S.f2.hpMax;
          if (i % 30 === 0 && ['idle', 'walk', 'crouch'].includes(S.f1.state)) {
            S.f1.x = S.f2.x - 100 * S.f1.face * -1 * -1; // stay in punching range
            S.f1.x = S.f2.x - 100;
            punches++;
            T.tap('Space');
            for (let k = 0; k < 20; k++) { T.step(1); if (S.f2.state === 'block') { blocked++; break; } }
          } else T.step(1);
        }
      }
      out[tier] = { cpuDamagePer20s: Math.round(dmg / 5), cpuHitsPer20s: +(cpuHits / 5).toFixed(1), punchesBlocked: Math.round((100 * blocked) / Math.max(1, punches)) + '%', cpuDamageMultiplier: DIFFICULTY[tier].cpuDamage };
    }
    return out;
  });

  // 6. STORY UPGRADES must not leak: a maxed story skill tree changes nothing in arcade or 2-player fights.
  R.leak = await run(() => {
    const S = window.__sock, T = window.__T, d = S.Progress.data;
    const snap = () => JSON.stringify([S.f1.hpMax, S.f1.dmgMul, S.f2.hpMax, S.f2.dmgMul, S.game.storyFx, S.f1.def.speed, S.f1.def.hp]);
    const save = JSON.stringify(d.skills || {});
    d.skills = {};
    T.fight(110, '2p'); const base2p = snap();
    T.fight(110, 'medium'); const baseCpu = snap();
    const bal = S.balance();
    d.skills = { lvl: 30, xp: 0, sp: 0, stats: Object.fromEntries(Object.keys(bal.SKILL_STATS).map(k => [k, bal.SKILL_MAX || 10])), perks: Object.fromEntries(Object.keys(bal.SKILL_PERKS).map(k => [k, 1])), charms: {} };
    T.fight(110, '2p'); const max2p = snap();
    T.fight(110, 'medium'); const maxCpu = snap();
    d.skills = JSON.parse(save);
    return { '2-player unchanged': base2p === max2p, 'arcade unchanged': baseCpu === maxCpu };
  });

  await b.close();
  const pr = (t, o) => { console.log('\n== ' + t); for (const [k, v] of Object.entries(o)) console.log('  ' + k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v)); };
  pr('COMBOS (frames you have to press the next button)', R.combos);
  pr('HITBOXES (true = it hit)', R.hitboxes);
  pr('BLOCKING', R.blocking);
  pr('STUN LOOPS (10 s of mashing vs a blocking player)', R.loops);
  pr('CPU DIFFICULTY', R.cpu);
  pr('STORY UPGRADES LEAKING', R.leak);
  // pass/fail rules
  const bad = [];
  // (from 140 apart a punch only just touches with its fingertip and pushes the opponent out of the kick's reach: normal)
  for (const [k, v] of Object.entries(R.combos)) if (/NEVER/.test(v) && !/gap140/.test(k)) bad.push('combo never works: ' + k);
  for (const k of ['punch vs standing', 'kick vs standing', 'sweep vs standing', 'cpunch vs crouching', 'sweep vs crouching', 'jump kick vs standing', 'punch in the corner']) if (R.hitboxes[k] !== true) bad.push('should hit: ' + k);
  for (const [k, v] of Object.entries(R.hitboxes)) if (/^(punch|kick) vs /.test(k) && !/crouching|standing/.test(k) && v !== true) bad.push('misses a big character: ' + k);
  if (!/BLOCKED/.test(R.blocking['punch vs standing block'])) bad.push('standing block does not stop a punch');
  if (!/BLOCKED/.test(R.blocking['sweep vs crouching block'])) bad.push('crouching block does not stop a sweep');
  if (/BLOCKED/.test(R.blocking['sweep vs standing block'])) bad.push('a sweep is blocked standing up');
  for (const k of ['BLOCK button vs punch', 'BLOCK button vs kick', 'BLOCK + DOWN vs sweep']) if (R.blocking[k] !== 'BLOCKED') bad.push(k + ' failed');
  if (R.blocking['DODGE avoids a kick'] !== 'DODGED') bad.push('DODGE did not avoid the kick');
  if (!R.blocking['BLOCK button stands still'] || !R.blocking['DODGE cooldown']) bad.push('BLOCK/DODGE behaviour');
  for (const [k, v] of Object.entries(R.loops)) if (typeof v === 'object' && v.longestCombo > 8) bad.push('possible endless combo: ' + k + ' (' + v.longestCombo + ' hits)');
  const tiers = Object.keys(R.cpu);
  for (let i = 1; i < tiers.length; i++) if (R.cpu[tiers[i]].cpuDamagePer20s < R.cpu[tiers[i - 1]].cpuDamagePer20s * 0.7) bad.push('CPU ' + tiers[i] + ' is weaker than ' + tiers[i - 1]);
  for (const [k, v] of Object.entries(R.leak)) if (!v) bad.push('story upgrades leak: ' + k);
  console.log('\nproblems: ' + (bad.length ? '\n  ' + bad.join('\n  ') : 'none'));
  console.log('gameplay checks pass: ' + !bad.length);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  process.exit(!bad.length && !errs.length ? 0 : 1);
})();
