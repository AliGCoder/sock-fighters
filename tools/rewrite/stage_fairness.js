// Fairness check: a "human-paced" test player (one decision every ~20 frames, like a person) fights the CPU
// at each difficulty. Measures how often the CPU blocks, how often it attacks, and who wins.
//   node fairness.js [matchesPerOpponent]
const { chromium } = require('../announcer/node_modules/playwright');
const path = require('path');
const PER = Number(process.argv[2] || 4);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(t => { if (t) window.ONLY_TIER = t; }, process.env.TIER || '');
  await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.requestAnimationFrame = () => 0; });
  await page.goto('file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  const out = await page.evaluate(PER => {
    // a human-paced bot: every 18-26 frames it picks walk in / attack / jump / block, nothing in between
    class HumanPacedBot {
      constructor() { this.left = this.right = this.up = this.down = false; this.buf = {}; this.next = 0; this.hold = null; }
      take(a) { if (this.buf[a]) { this.buf[a] = 0; return true; } return false; }
      step(me, o) {
        if (--this.next > 0) return;
        this.next = 18 + ((Math.random() * 9) | 0);
        const dist = Math.abs(o.x - me.x), toward = o.x > me.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
        this.left = this.right = this.up = this.down = false;
        const r = Math.random();
        // basic defence a person would do (still only at human decision speed)
        const projectile = game.projectiles.find(p => p.owner !== me && Math.abs(p.x - me.x) < 280);
        if (projectile) {
          if (r < 0.5) { this.up = true; this[toward] = true; } else this[away] = true; // jump it or block it
          return;
        }
        if (o.isThreat() && dist < 200 && r < 0.6) { this[away] = true; this.down = o.isLow(); return; } // block
        if (dist > 160) { this[toward] = true; if (r < 0.15) this.buf.special = 1; }
        else if (r < 0.45) this.buf.punch = 1;
        else if (r < 0.7) this.buf.kick = 1;
        else if (r < 0.8) this.buf.throw = 1;
        else if (r < 0.9) this[away] = true; // back off / block
        else if (r < 0.95) this.buf.special = 1;
        else this.up = true;
        if (me.meter >= 100 && Math.random() < 0.5) this.buf.super = 1;
      }
    }
    const res = {};
    const ladders = {};
    for (const tier of DIFFICULTY_ORDER) ladders[tier] = LADDERS[tier].build(0);
    for (const tier in ladders) for (let stage = 0; stage < ladders[tier].length; stage++) {
      const key = tier + ' stage ' + (stage + 1) + ' (' + ladders[tier][stage].id + ')';
      let wins = 0, total = 0, landed = 0, blocked = 0, cpuAttacks = 0, frames = 0;
      { const id = ladders[tier][stage].id;
        for (let n = 0; n < PER; n++) {
          game.mode = 'cpu';
          game.arcade = { tier, list: ladders[tier], stage };
          game.p1Def = withSkin(CHARS[n % CHARS.length], 0);
          game.p2Def = withSkin(findCharacter(id), 0);
          startMatch();
          controller1 = new HumanPacedBot();
          const takeHit = f2.takeHit.bind(f2); // count each of the player's hits once: blocked or landed
          f2.takeHit = (attacker, ...rest) => { const r = takeHit(attacker, ...rest); if (attacker === f1) r === 'block' ? blocked++ : landed++; return r; };
          let f = 0, lastP1 = '', lastP2 = '';
          while (game.screen === 'fight' && f < 40000) {
            updateGame(); f++;
            if (game.phase !== 'fight') continue;
            if (f2.state === 'atk' && f2.t === 1) cpuAttacks++;
          }
          frames += f; total++;
          if (game.result && game.result.p1won) wins++;
        }
      }
      res[key] = { playerWinRate: +(wins / total).toFixed(2), cpuBlocksPercent: Math.round((blocked / Math.max(1, blocked + landed)) * 100) + '%', cpuAttacksPerSecond: +(cpuAttacks / (frames / 60)).toFixed(2) };
    }
    return res;
  }, PER);
  for (const k in out) console.log(k.padEnd(34), 'player wins', String(Math.round(out[k].playerWinRate * 100)).padStart(3) + '%', '| CPU blocks', out[k].cpuBlocksPercent);
  await browser.close();
})();
