// Super moves: Stinky Tabi's GYM BAG GALAXY cinematic (launch into space, punches, GALAXY SLAM back into the arena)
// hits, does the same damage as a normal super, and leaves both fighters standing on the floor ready to carry on.
// A super fills nobody's SUPER bar (it used to refill most of its own). Another hero's normal super is checked too. SHOTS=prefix saves pictures of each stage of the cinematic.
const pw = require('../announcer/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL(path.join(__dirname, '../../index.html')).href);
  await p.waitForTimeout(1000);
  const shot = process.env.SHOTS;
  const checks = {};
  const superOf = async (hero, pics) => {
    await p.evaluate(hero => {
      const S = window.__sock;
      S.game.story = null;
      S.game.mf = null;
      S.game.mode = '2p';
      S.game.p1Def = S.look(S.findCharacter(hero), 0);
      S.game.p2Def = S.look(S.findCharacter('argyle'), 0);
      S.game.stageId = 'laundry';
      S.startMatch();
      for (let i = 0; i < 300 && S.game.phase !== 'fight'; i++) updateGame();
      S.f1.x = 380;
      S.f2.x = 520;
      S.f1.meter = 100;
      keysPressed.KeyR = true;
      keysDown.KeyR = true;
      updateGame();
      delete keysDown.KeyR;
      window.__hp0 = S.f2.hp;
    }, hero);
    const seen = new Set();
    let lockT = -1;
    for (let i = 0; i < 400; i++) {
      const st = await p.evaluate(() => { updateGame(); const S = window.__sock; return { s: S.f1.state, t: S.f1.t, y1: S.f1.y, y2: S.f2.y }; });
      seen.add(st.s);
      if (st.s === 'superlock') lockT = st.t;
      if (pics && st.s === 'superlock' && pics.includes(st.t)) {
        await p.evaluate(() => renderGame());
        await p.screenshot({ path: shot + '_' + hero + '_' + st.t + '.png' });
      }
      if (seen.has('superlock') && st.s !== 'superlock' && st.s !== 'superdash') break;
    }
    for (let i = 0; i < 120; i++) await p.evaluate(() => updateGame());
    return p.evaluate(lockT => {
      const S = window.__sock;
      return { m1: Math.round(S.f1.meter), m2: Math.round(S.f2.meter), lockFrames: lockT, dmg: window.__hp0 - S.f2.hp, y1: S.f1.y, y2: S.f2.y, ground: S.f1.ground && S.f2.ground, s1: S.f1.state, s2: S.f2.state, x1: Math.round(S.f1.x), x2: Math.round(S.f2.x) };
    }, lockT);
  };
  const stinky = await superOf('stinky', shot ? [5, 9, 12, 17, 22, 50, 104, 124] : null);
  const argyle = await superOf('argyle');
  console.log('stinky', JSON.stringify(stinky));
  console.log('argyle', JSON.stringify(argyle));
  const GROUND = await p.evaluate(() => GROUND);
  // EVERY hero's cinematic super (one scene each): same damage, nobody's bar refilled, both back on the floor, in the arena
  const all = await p.evaluate(() => {
    const S = window.__sock, out = {};
    for (const hero of Object.keys(SUPER_SCENES).filter(k => k !== 'mysock')) {
      S.game.story = null; S.game.mf = null; S.game.mode = '2p';
      S.game.p1Def = S.look(S.findCharacter(hero), 0);
      S.game.p2Def = S.look(S.findCharacter(hero === 'argyle' ? 'stinky' : 'argyle'), 0);
      S.game.stageId = 'laundry';
      S.startMatch();
      for (let i = 0; i < 300 && S.game.phase !== 'fight'; i++) updateGame();
      S.f1.x = 380; S.f2.x = 520; S.f1.meter = 100;
      keysPressed.KeyR = true; keysDown.KeyR = true; updateGame(); delete keysDown.KeyR;
      const hp0 = S.f2.hp;
      let seen = false, lock = 0, out2 = false;
      for (let i = 0; i < 500; i++) {
        updateGame();
        if (S.f1.state === 'superlock') { seen = true; lock = S.f1.t; if (S.f1.x < 40 || S.f1.x > 920 || S.f2.x < 40 || S.f2.x > 920) out2 = true; renderGame(); }
        else if (seen && S.f1.state !== 'superdash') break;
      }
      for (let i = 0; i < 120; i++) updateGame();
      out[hero] = seen && lock >= (SUPER_SCENES[hero].tpl ? 120 : 55) && Math.abs(hp0 - S.f2.hp - 404) <= 5 && S.f1.meter === 0 && S.f2.meter === 0 && S.f1.y === GROUND && S.f2.y === GROUND && !out2 && S.f2.state !== 'hit';
    }
    return out;
  });
  const failed = Object.keys(all).filter(k => !all[k]);
  console.log('every hero: ' + Object.keys(all).length + ' supers, failed: ' + (failed.join(', ') || 'none'));
  checks.everyHeroCinematic = Object.keys(all).length >= 28 && !failed.length;
  checks.superDoesNotRefillAnyBar = stinky.m1 === 0 && stinky.m2 === 0 && argyle.m1 === 0 && argyle.m2 === 0;
  checks.galaxyRuns = stinky.lockFrames >= 140;
  checks.sameDamage = Math.abs(stinky.dmg - argyle.dmg) <= 5 && stinky.dmg > 300;
  checks.bothBackOnTheFloor = stinky.y1 === GROUND && stinky.y2 === GROUND && stinky.ground;
  checks.carryOn = ['idle', 'walk', 'crouch', 'land'].includes(stinky.s1) && stinky.s2 !== 'hit';
  checks.inArena = stinky.x1 >= 45 && stinky.x1 <= 915 && stinky.x2 >= 45 && stinky.x2 <= 915;
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(checks));
  console.log('supers work: ' + ok);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await b.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
