// Supers: the HERO shouts the super's name in their own voice; the narrator stays quiet (custom socks keep the narrator).
const pw = require('../announcer/node_modules/playwright');
const URL = require('url').pathToFileURL(require('path').join(__dirname, '..', '..', 'index.html')).href;
(async () => {
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(1200);
  await p.mouse.click(200, 200);
  // the voices decode a few at a time: wait for every super shout
  await p.waitForFunction(() => window.__sock.ROSTER.filter(x => !x.mysock).every(x => FighterClips.get(x.id, 'supername')), null, { timeout: 60000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const S = window.__sock, out = {};
    const said = [];
    const origPlay = S.FighterVoice.play.bind(S.FighterVoice);
    S.FighterVoice.play = (f, w, force) => { said.push(f.def.id + ':' + w); return origPlay(f, w, force); };
    const origSuper = Announcer.superMove;
    let narr = 0;
    Announcer.superMove = d => { narr++; return origSuper.call(Announcer, d); };
    const ids = S.ROSTER.filter(x => !x.mysock).map(x => x.id);
    out.missing = [];
    for (const id of ids) {
      said.length = 0; narr = 0;
      S.game.story = null; S.game.mf = null; S.game.mode = '2p';
      S.game.p1Def = S.look(S.findCharacter(id), 0);
      S.game.p2Def = S.look(S.findCharacter(id === 'argyle' ? 'stinky' : 'argyle'), 0);
      S.startMatch();
      for (let i = 0; i < 300 && S.game.phase !== 'fight'; i++) updateGame();
      S.f1.startSuper(S.f2);
      if (!said.includes(id + ':supername') || narr) out.missing.push(id + (narr ? '(narrator spoke)' : '(no shout)'));
    }
    out.heroes = ids.length;
    return out;
  });
  console.log('heroes:', r.heroes, '| without their own super shout:', r.missing.length ? r.missing : 'none', '| errors:', errs.length ? errs : 'none');
  await b.close();
  process.exit(r.missing.length || errs.length ? 1 : 0);
})();
