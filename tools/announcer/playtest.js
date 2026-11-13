// Headless play-test: title -> arcade -> Easy -> full 3-stage ladder -> ending, checking baked announcer clips.
// Usage: node playtest.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); else logs.push(m.text()); });
  await page.goto('file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(800);
  // count what the announcer actually plays
  await page.evaluate(() => {
    window.__t = { baked: [], speech: [], missing: [], speechMuteCheck: 0 };
    const play = AnnouncerClips.play.bind(AnnouncerClips);
    AnnouncerClips.play = beats => { __t.baked.push(beats.join('|')); return play(beats); };
    try { const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { __t.speech.push(u.text); sp(u); }; } catch (e) {}
    const r = AnnouncerClips.ready.bind(AnnouncerClips);
    AnnouncerClips.ready = b => { const ok = r(b); if (!ok && AnnouncerClips.decoded + AnnouncerClips.failed === AnnouncerClips.total()) __t.missing.push(b.filter(x => !AnnouncerClips.buffers[x]).join(',')); return ok; };
  });
  const S = () => page.evaluate(() => ({ screen: __sock.game.screen, phase: __sock.game.phase, ann: announcerStyle, n: AnnouncerClips.decoded }));
  await page.mouse.click(400, 300); // user gesture -> AudioContext
  let last = '', stages = new Set(), t0 = Date.now(), fights = 0;
  while (Date.now() - t0 < 240000) {
    const s = await S();
    const tag = s.screen + '/' + s.phase;
    if (tag !== last) { console.log('  ->', tag); last = tag; }
    if (s.screen === 'ending') { await page.waitForTimeout(3500); break; }
    if (s.screen === 'title' || s.screen === 'mode') await page.keyboard.press('Space');
    else if (s.screen === 'diff') { await page.evaluate(d => { __sock.game.difficultyMenu = d; }, Number(process.env.DIFF || 0)); await page.keyboard.press('Space'); }
    else if (s.screen === 'select') await page.keyboard.press('Space');
    else if (s.screen === 'ladder' || s.screen === 'vs' || s.screen === 'result') {
      if (s.screen === 'ladder') stages.add(await page.evaluate(() => __sock.game.arcade.stage));
      await page.waitForTimeout(700); await page.keyboard.press('Space');
    } else if (s.screen === 'cont') throw new Error('lost a match on Easy?');
    else if (s.screen === 'fight') {
      if (s.phase === 'fight') {
        // passive CPU, walk in and throw some real attacks, then finish with a K.O.
        await page.evaluate(() => { __sock.dummy(); });
        await page.keyboard.down('KeyD'); await page.keyboard.press('Space'); await page.keyboard.press('KeyE'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
        if (++fights % 4 === 0) await page.evaluate(() => { const v = __sock.f2; v.hp = 0; onKnockout(v); });
      }
    }
    await page.waitForTimeout(150);
  }
  const noclip = logs.filter(l => l.includes('no clip'));
  const res = await page.evaluate(() => ({ screen: __sock.game.screen, decoded: AnnouncerClips.decoded, failed: AnnouncerClips.failed, total: AnnouncerClips.total(), ...__t }));
  // V / N keys + mute still work
  await page.evaluate(() => { __sock.game.screen = 'title'; });
  const modes = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyV'); await page.waitForTimeout(80); modes.push(await page.evaluate(() => announcerStyle)); }
  await page.keyboard.press('KeyN'); await page.waitForTimeout(80);
  await page.keyboard.press('KeyM'); await page.waitForTimeout(80);
  const muted = await page.evaluate(() => ({ muted: Sound.muted, live: AnnouncerClips.playing.length, master: Sound.master.gain.value }));
  console.log('\nstages seen:', [...stages], 'final screen:', res.screen);
  console.log('decode log:', logs.filter(l => (l.includes('[announcer]') || l.includes('[fighters]'))));
  console.log(`decoded ${res.decoded}/${res.total}, failed ${res.failed}`);
  console.log(`baked lines played: ${res.baked.length}`); res.baked.forEach(b => console.log('   ♪', b));
  console.log('speech fallback lines:', res.speech.length, res.speech, 'missing beats:', res.missing);
  console.log('V cycles:', modes.join(' > '), '| after M:', muted);
  console.log('lines with no clip:', noclip.length ? noclip : 'none', '| speechSynthesis present in code:', await page.evaluate(() => document.documentElement.innerHTML.includes('speechSynthesis')));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length || res.screen !== 'ending' || res.decoded !== res.total ? 1 : 0);
})();
