// What makes the Dryer Demon unbeatable for a human-paced player? Try one change at a time (as the final
// boss of the Hard ladder) and measure the player's win rate for each.
const { chromium } = require('../announcer/node_modules/playwright');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'stage_fairness.js'), 'utf8');
const BOT = src.slice(src.indexOf('    class HumanPacedBot {'), src.indexOf('    const res = {};'));
const N = Number(process.argv[2] || 24);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.requestAnimationFrame = () => 0; });
  await page.goto('file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  const variants = {
    'as now': () => {},
    'health 1250': d => { d.hp = 1250; },
    'no armour': d => { d.armor = false; },
    'fireball 75 dmg': () => { SPECIALS.fire.dmg = 75; },
    'fireball no knockdown': () => { SPECIALS.fire.kd = false; SPECIALS.fire.stun = 20; },
    'health 1250 + fireball 80': d => { d.hp = 1250; SPECIALS.fire.dmg = 80; }
  };
  for (const name of Object.keys(variants)) {
    const rate = await page.evaluate(([BOT, name, N, fnSrc]) => {
      eval(BOT.replace('class HumanPacedBot', 'window.HumanPacedBot = class'));
      const demon = findCharacter('demon');
      const saved = { hp: demon.hp, armor: demon.armor, fire: Object.assign({}, SPECIALS.fire) };
      (0, eval)('(' + fnSrc + ')')(demon);
      let wins = 0;
      const ladder = LADDERS.hard.build(0);
      for (let n = 0; n < N; n++) {
        game.mode = 'cpu';
        game.arcade = { tier: 'hard', list: ladder, stage: 2 };
        game.p1Def = withSkin(CHARS[n % CHARS.length], 0);
        game.p2Def = withSkin(demon, 0);
        startMatch();
        controller1 = new HumanPacedBot();
        let f = 0;
        while (game.screen === 'fight' && f < 40000) { updateGame(); f++; }
        if (game.result && game.result.p1won) wins++;
      }
      demon.hp = saved.hp; demon.armor = saved.armor; Object.assign(SPECIALS.fire, saved.fire);
      if (!saved.fire.kd) delete SPECIALS.fire.kd;
      return Math.round((wins / N) * 100);
    }, [BOT, name, N, variants[name].toString()]);
    console.log(name.padEnd(28), 'player wins', rate + '%');
  }
  await browser.close();
})();
