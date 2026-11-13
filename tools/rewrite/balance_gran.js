// Gran with vs without her walking stick: CPU Gran vs every boss and every other hero, same AI skill.
const { chromium } = require('../announcer/node_modules/playwright');
const path = require('path');
const PER = Number(process.argv[2] || 6);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.requestAnimationFrame = () => 0; });
  await page.goto('file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  for (const cane of [false, true]) {
    const r = await page.evaluate(([cane, PER]) => {
      const gran = CHARS.find(c => c.id === 'gran');
      gran.cane = cane;
      const opponents = ['steel', 'king', 'demon', 'bleach', 'cling', 'iron', ...CHARS.filter(c => c.id !== 'gran').map(c => c.id)];
      let wins = 0, total = 0, damage = 0;
      for (const id of opponents) {
        for (let n = 0; n < PER; n++) {
          game.mode = 'cpu';
          game.arcade = { tier: 'hard', list: [{ id, k: 0 }], stage: 0 };
          game.p1Def = withSkin(gran, 0);
          game.p2Def = withSkin(findCharacter(id), 0);
          startMatch();
          controller1 = new CpuController('hard');
          let f = 0;
          while (game.screen === 'fight' && f < 40000) { updateGame(); f++; }
          total++;
          if (game.result && game.result.p1won) wins++;
          damage += 1 - f2.hp / f2.hpMax;
        }
      }
      gran.cane = true;
      return { winRate: +(wins / total).toFixed(2), avgDamageDealt: Math.round((damage / total) * 100) + '%', matches: total };
    }, [cane, PER]);
    console.log((cane ? 'WITH stick   ' : 'without stick'), JSON.stringify(r));
  }
  await browser.close();
})();
