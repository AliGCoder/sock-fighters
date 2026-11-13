// Balance check: CPU heroes vs CPU bosses at the same AI skill, many matches, win rate per boss.
// Runs the real game logic headless (no drawing, no audio).   node balance.js [matchesPerPair]
const { chromium } = require('../announcer/node_modules/playwright');
const path = require('path');
const PER_PAIR = Number(process.argv[2] || 3);
const BOSSES = ['steel', 'king', 'demon', 'bleach', 'cling', 'iron'];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.requestAnimationFrame = () => 0; });
  await page.goto('file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  const results = {};
  for (const boss of BOSSES) {
    results[boss] = await page.evaluate(([boss, perPair]) => {
      let bossWins = 0, heroWins = 0, draws = 0, hpLeft = 0, frames = 0;
      for (let h = 0; h < CHARS.length; h++) {
        for (let n = 0; n < perPair; n++) {
          game.mode = 'cpu';
          game.arcade = { tier: 'hard', list: [{ id: boss, k: 0 }], stage: 0 };
          game.p1Def = withSkin(CHARS[h], 0);
          game.p2Def = withSkin(findCharacter(boss), 0);
          startMatch();
          controller1 = new CpuController('hard'); // the hero is played by the same AI as the boss
          let f = 0;
          while (game.screen === 'fight' && f < 40000) { updateGame(); f++; }
          frames += f;
          const r = game.result;
          if (!r || !r.w) draws++;
          else if (r.p1won) heroWins++;
          else bossWins++;
          hpLeft += f2.hp / f2.hpMax;
        }
      }
      const total = bossWins + heroWins + draws;
      return { bossWinRate: +(bossWins / total).toFixed(2), avgBossHealthLeft: Math.round((hpLeft / total) * 100) + '%', bossWins, heroWins, draws, avgMatchSeconds: +(frames / total / 60).toFixed(0) };
    }, [boss, PER_PAIR]);
    console.log(boss.padEnd(7), JSON.stringify(results[boss]));
  }
  await browser.close();
})();
