const pw = require('../announcer/node_modules/playwright'), path = require('path');
const URL = require('url').pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;
(async () => {
  for (const [name, opt] of [['headless', {}], ['headless+gpu', { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader=false'] }], ['window+gpu', { headless: false, args: ['--ignore-gpu-blocklist'] }]]) {
    const b = await pw.chromium.launch(opt);
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.goto(URL); await p.waitForTimeout(1500);
    await p.evaluate(() => { const S = window.__sock; S.game.mode = '2p'; S.game.p1Def = S.look(S.findCharacter('stinky'), 0); S.game.p2Def = S.look(S.findCharacter('argyle'), 0); S.startMatch(); controller1 = new CpuController('hard', 1); controller2 = new CpuController('hard', 1); });
    const fps = await p.evaluate(() => new Promise(ok => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(f) : ok(n / 3); }; requestAnimationFrame(f); }));
    console.log(name, fps.toFixed(0), 'fps');
    await b.close();
  }
})();
