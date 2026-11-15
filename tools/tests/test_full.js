// Play the whole story: chapters 1-5, credits, epilogue. Screenshots of the new effects along the way.
const { chromium } = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
const SP = require('path').join(__dirname, 'out') + '/';
require('fs').mkdirSync(SP, { recursive: true });
(async () => {
  const errors = [];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await p.goto(URL); await p.waitForTimeout(1000);
  const G = (fn, a) => p.evaluate(fn, a);
  const key = async (k, w = 80) => { await p.keyboard.press(k); await p.waitForTimeout(w); };
  const scr = () => G(() => window.__sock.game.screen);
  const shots = new Set();
  const shot = async name => { if (shots.has(name)) return; shots.add(name); await p.screenshot({ path: SP + 'full_' + name + '.png' }); };
  await G(() => { const S = window.__sock; S.resetProgress(); S.Progress.data.adv = { prologue: true, hero: 0, look: 0, cleared: {}, seen: {} }; S.startAdventure(); });
  await p.waitForTimeout(400);
  for (let ch = 1; ch <= 5; ch++) {
    // clear any palace scene, then start the chapter
    for (let i = 0; i < 30 && (await G(() => !!window.__sock.game.adv.scene)); i++) { await key('Space', 50); await key('Space', 100); }
    await G(c => { window.__sock.game.adv.hub.sel = c - 1; }, ch);
    await p.waitForTimeout(600); await key('Enter', 500);
    const log = [];
    for (let guard = 0; guard < 600; guard++) {
      const s = await scr();
      if (s === 'advTitle') { if (!log.includes('title card')) { log.push('title card'); await p.waitForTimeout(900); await shot('title_' + ch); } await key('Space', 200); continue; }
      if (s === 'advScene') {
        const st = await G(() => { const St = window.__sock.game.adv.stage; const sc = window.__sock.game.adv.scene; return { warning: St.warning, sneeze: St.sneeze ? St.sneeze.t : -1, rainbow: St.rainbow || 0, confetti: St.confetti || 0, queen: (St.allies || []).length, line: sc ? sc.i : -1, emote: sc && sc.emote ? sc.emote.mark : '' }; });
        if (st.warning > 60) await shot('warning_' + ch);
        if (st.sneeze > 20 && st.sneeze < 60) await shot('sneeze');
        if (st.rainbow > 60) await shot('rainbow');
        if (st.confetti > 50 && ch === 5) await shot('confetti');
        if (st.queen && st.line === 1) await shot('queen_scene');
        if (ch === 4 && st.line === 2) await shot('fortress_scene');
        if (st.sneeze >= 0 && st.sneeze < 200) { await p.waitForTimeout(250); continue; }
        if (st.rainbow > 0 && st.rainbow < 75) { await p.waitForTimeout(250); continue; }
        if (st.confetti > 0 && st.confetti < 60 && ch === 5) { await p.waitForTimeout(250); continue; }
        await key('Space', 40); await key('Space', 110); continue;
      }
      if (s === 'vs') { log.push('VS ' + (await G(() => window.__sock.game.p2Def.name))); await p.waitForTimeout(1400); await key('Space', 300); continue; }
      if (s === 'fight') {
        const ph = await G(() => window.__sock.game.phase);
        if (ph === 'fight') { if (ch === 3) await shot('badlands_fight'); await G(() => { const S = window.__sock; S.f2.hp = 1; S.f1.x = 400; S.f2.x = 470; }); await key('Space', 200); }
        else await p.waitForTimeout(300);
        continue;
      }
      if (s === 'result') { await p.waitForTimeout(1400); await key('Space', 400); continue; }
      if (s === 'advWalk') { if (ch === 2) { await p.waitForTimeout(700); await shot('walk_dust'); } await key('Space', 300); continue; }
      if (s === 'advCredits') { log.push('CREDITS'); await p.waitForTimeout(3500); await shot('credits'); await G(() => { window.__sock.game.adv.credits.t = 1030; }); await p.waitForTimeout(700); await shot('postcredits'); await key('Space', 400); continue; }
      if (s === 'advClear') { log.push('CLEAR'); await p.waitForTimeout(1200); await key('Space', 500); continue; }
      if (s === 'advHub') { log.push('palace'); break; }
      await p.waitForTimeout(200);
    }
    console.log('CH' + ch + ': ' + log.join(' > '));
  }
  await p.waitForTimeout(500);
  await shot('epilogue');
  console.log('cleared:', JSON.stringify(await G(() => window.__sock.Progress.data.adv.cleared)), '| epilogue scene lines:', await G(() => window.__sock.game.adv.scene ? window.__sock.game.adv.scene.lines.length : 0));
  console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
  await G(() => window.__sock.resetProgress());
  await b.close();
})();
