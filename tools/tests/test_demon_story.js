// The Dryer Demon stays the villain to the end: plays every rewritten story scene line by line (no errors, the
// Demon escapes with the other half, Gran's handbag, the reunion at the very end), and the final fight is always
// Stinky's, even when your story hero is somebody else.
//   node tools/tests/test_demon_story.js            (writes pictures to tools/tests/out/demon_*.png)
const path = require('path'), fs = require('fs');
const pw = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;
const OUT = path.join(__dirname, 'out');
// [episode, step, picture at line, name]
const SCENES = [
  [5, 7, 8, 'ch5_boss'],
  [5, 9, 5, 'ch5_escape'],
  [7, 8, 7, 'ch7_handbag'],
  [17, 7, 3, 'ch17_flee'],
  [20, 7, 5, 'ch20_snatch'],
  [21, 0, 4, 'ch21_door'],
  [27, 0, 9, 'ch27_cage'],
  [27, 2, 16, 'ch27_reunion']
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(800);
  let bad = 0;
  for (const [ep, st, at, name] of SCENES) {
    await p.evaluate(([ep, st]) => {
      const S = window.__sock;
      S.Progress.data.adv = { prologue: true, hero: 1, look: 0, cleared: {}, seen: {} }; // story hero: Argyle
      S.startAdventure();
      if (S.game.screen === 'advSlots') S.continueGame();
      S.storyJump(ep, st);
    }, [ep, st]);
    let lines = 0, shot = false;
    for (let k = 0; k < 400; k++) {
      const s = await p.evaluate(() => { const g = window.__sock.game; return { screen: g.screen, i: g.adv && g.adv.scene ? g.adv.scene.i : -1, n: g.adv && g.adv.scene ? g.adv.scene.lines.length : 0 }; });
      if (s.screen !== 'advScene' || s.i < 0) break;
      lines = s.n;
      if (s.i === at && !shot) {
        await p.waitForTimeout(900); // the effect plays (the Demon flies off, the hug...)
        await p.screenshot({ path: path.join(OUT, `demon_${name}.png`) });
        shot = true;
      }
      await p.evaluate(() => { keysPressed.Space = true; keysDown.Space = true; setTimeout(() => delete keysDown.Space, 30); });
      await p.waitForTimeout(60);
    }
    const ok = shot && lines > 0;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} episode ${ep} step ${st}: ${lines} lines${shot ? '' : ' (never reached line ' + at + ')'}`);
  }
  // the final fight: you are Stinky, whoever your story hero is
  const who = await p.evaluate(() => {
    const S = window.__sock;
    S.Progress.data.adv = { prologue: true, hero: 1, look: 0, cleared: {}, seen: {} };
    S.startAdventure();
    if (S.game.screen === 'advSlots') S.continueGame();
    S.storyJump(27, 1);
    return { p1: S.game.p1Def.id, p2: S.game.p2Def.id, screen: S.game.screen };
  });
  const finalOk = who.p1 === 'stinky' && who.p2 === 'demon';
  if (!finalOk) bad++;
  console.log(`${finalOk ? 'ok  ' : 'FAIL'} final fight: ${who.p1} vs ${who.p2} (${who.screen})`);
  console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
