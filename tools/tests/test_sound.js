// Is sound actually reaching the speakers? Counts announcer + fighter voice plays and measures the output level.
const { chromium } = require('../announcer/node_modules/playwright');
const URL = process.argv[2] || require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const logs = [];
  p.on('pageerror', e => logs.push('ERROR ' + e.message));
  p.on('console', m => { if (/announcer|fighter|voice/i.test(m.text())) logs.push(m.type() + ': ' + m.text().slice(0, 120)); });
  await p.goto(URL);
  await p.waitForTimeout(1200);
  await p.mouse.click(480, 270); // a tap: sound starts
  await p.waitForTimeout(3500);
  await p.evaluate(() => {
    window.__count = { ann: 0, voice: 0, peak: 0 };
    const a = AnnouncerClips.play.bind(AnnouncerClips);
    AnnouncerClips.play = (...x) => { window.__count.ann++; return a(...x); };
    const f = FighterVoice.playClip.bind(FighterVoice);
    FighterVoice.playClip = (...x) => { window.__count.voice++; return f(...x); };
    const an = Sound.context.createAnalyser();
    an.fftSize = 1024;
    Sound.master.connect(an);
    const buf = new Float32Array(an.fftSize);
    setInterval(() => { an.getFloatTimeDomainData(buf); for (const v of buf) window.__count.peak = Math.max(window.__count.peak, Math.abs(v)); }, 30);
  });
  // title -> menu: the announcer should speak; then a VS screen and a fight
  await p.evaluate(() => { testVoice(); });
  await p.waitForTimeout(2500);
  console.log('after the N-key test line:', JSON.stringify(await p.evaluate(() => window.__count)));
  await p.evaluate(() => {
    const S = window.__sock;
    game.mode = 'cpu'; game.arcade = { tier: 'easy', list: [{ id: 'lint', k: 0 }], stage: 0 };
    game.p1Def = S.ROSTER[0]; game.p2Def = S.ROSTER[9]; game.stageId = 'beach'; game.screen = 'vs'; game.versusTime = 0;
    Announcer.versus(game.p1Def, game.p2Def);
  });
  await p.waitForTimeout(3000);
  await p.keyboard.press('Space');
  await p.waitForTimeout(5500);
  for (let i = 0; i < 8; i++) { await p.evaluate(() => { const S = window.__sock; S.f1.x = S.f2.x - 90; }); await p.keyboard.press('KeyJ'); await p.waitForTimeout(250); }
  console.log('after VS + fight:', JSON.stringify(await p.evaluate(() => window.__count)), '| style', await p.evaluate(() => announcerStyle), '| muted', await p.evaluate(() => Sound.muted));
  console.log(logs.slice(0, 10).join('\n') || 'no logs');
  await b.close();
})();
