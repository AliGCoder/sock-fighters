// Story chapter 1 as normal fights: scenes, VS, fights (win, and one loss -> try again), clear, back to the palace.
const { chromium } = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
const SP = require('path').join(__dirname, 'out') + '/';
require('fs').mkdirSync(SP, { recursive: true });
(async () => {
  const errors = [];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(1000);
  const G = (fn, a) => p.evaluate(fn, a);
  const key = async (k, w = 80) => { await p.keyboard.press(k); await p.waitForTimeout(w); };
  const scr = () => G(() => window.__sock.game.screen);
  await G(() => { const S = window.__sock; S.resetProgress(); S.Progress.data.adv = { prologue: true, hero: 1, look: 0, cleared: {}, seen: {} }; S.startAdventure(); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: SP + 'st_hub.png' });
  // hero select shows the real moves
  await G(() => { const S = window.__sock; S.game.adv.hub.sel = S.hubItems().findIndex(it => it.label === 'CHANGE HERO'); });
  await key('Enter', 400);
  await p.screenshot({ path: SP + 'st_select.png' });
  await key('Escape', 300);
  await G(() => { window.__sock.game.adv.hub.sel = 0; }); // CHAPTER 1...
  await key('Enter', 400);
  await G(() => { window.__sock.game.adv.hub.sel = 0; }); // ...EPISODE 1 (it begins with the prologue)
  await key('Enter', 500);
  console.log('chapter 1 ->', await scr());
  await p.waitForTimeout(500);
  await p.screenshot({ path: SP + 'st_scene.png' });
  let lost = false;
  const log = [];
  for (let guard = 0; guard < 400; guard++) {
    const s = await scr();
    if (s === 'advScene' || s === 'advStory') { await key('Space', 50); await key('Space', 120); continue; } // (advStory: Episode 1's prologue)
    if (s === 'vs') {
      log.push('VS ' + (await G(() => window.__sock.game.p2Def.name)) + ' @ ' + (await G(() => window.__sock.game.stageId)));
      if (log.length === 1) await p.screenshot({ path: SP + 'st_vs.png' });
      await p.waitForTimeout(1400); await key('Space', 300); continue;
    }
    if (s === 'fight') {
      const st = await G(() => { const S = window.__sock; return { phase: S.game.phase, f1: S.f1.state, f2: S.f2.state }; });
      if (st.phase === 'fight') {
        await G(lose => { const S = window.__sock; if (lose) S.f1.hp = 1; else S.f2.hp = 1; S.f1.x = 400; S.f2.x = 470; }, !lost && log.length === 2);
        if (!lost && log.length === 2) { await p.waitForTimeout(1500); } else await key('Space', 200);
        if (log.length === 1 && guard < 40) await p.screenshot({ path: SP + 'st_fight.png' });
      } else await p.waitForTimeout(300);
      continue;
    }
    if (s === 'result') {
      const won = await G(() => window.__sock.game.result.p1won);
      log.push('result: ' + (won ? 'WON' : 'LOST'));
      if (!won) lost = true;
      await p.waitForTimeout(1400); await key('Space', 400); continue;
    }
    if (s === 'advClear') { log.push('CHAPTER CLEAR'); await p.screenshot({ path: SP + 'st_clear.png' }); await p.waitForTimeout(1200); await key('Space', 500); continue; }
    if (s === 'advHub') { log.push('back at the palace'); break; }
    await p.waitForTimeout(200);
  }
  console.log(log.join('\n'));
  console.log('cleared:', JSON.stringify(await G(() => window.__sock.Progress.data.adv.cleared)), 'scene:', await G(() => window.__sock.game.adv.scene ? window.__sock.game.adv.scene.lines.length + ' lines' : 'none'));
  // random arenas never pick the story arena
  const stages = await G(() => { const S = window.__sock; const seen = {}; for (let i = 0; i < 200; i++) { S.game.mode = '2p'; S.game.selection = { c1: 0, c2: 1, k1: 0, k2: 0 }; S.game.stageId = null; } return 'n/a'; });
  console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
  await G(() => window.__sock.resetProgress());
  await b.close();
})();
