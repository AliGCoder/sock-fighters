// The things the ChatGPT review could not test (its browser was blocked), run for real on the LIVE website
// (or a URL given:  node tools/tests/test_review.js http://localhost:8766/ ):
//  boots with no errors (Chrome and Safari's engine), every announcer + fighter clip decodes IN THE BROWSER and how
//  long that takes, the story voice files download, a failed voice file is retried, ALL SAVED / NOT SAVED YET is
//  right, a refused save says COULD NOT SAVE, the online-play library loads, and the game opens with the internet OFF.
const pw = require('../announcer/node_modules/playwright');
const URL = process.argv[2] || 'https://aligcoder.github.io/sock-fighters/';
const checks = {}, notes = {}, errs = [];
async function boot(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(label + ': ' + e.message));
  const t0 = Date.now(), log = {};
  p.on('console', m => {
    const t = m.text();
    const a = t.match(/\[announcer\] decoded (\d+)\/(\d+)/), f = t.match(/\[fighters\] decoded (\d+)\/(\d+)/);
    if (a) log.ann = { ok: +a[1], of: +a[2], ms: Date.now() - log.tap };
    if (f) log.fig = { ok: +f[1], of: +f[2], ms: Date.now() - log.tap };
  });
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
  notes[label + ' page load'] = ((Date.now() - t0) / 1000).toFixed(1) + 's';
  await p.waitForTimeout(1500);
  checks[label + ': game boots'] = await p.evaluate(() => !!(window.__sock && document.querySelector('canvas') && window.__sock.game.screen));
  log.tap = Date.now();
  await p.mouse.click(480, 270); // the first tap starts sound, which decodes every clip
  for (let i = 0; i < 120 && !(log.ann && log.fig); i++) await p.waitForTimeout(250);
  // (the WebKit test browser on Windows has no Web Audio at all; real Safari on iPhone / Mac does)
  const audio = await p.evaluate(() => !!(window.AudioContext || window.webkitAudioContext));
  if (!audio) notes[label + ' sound'] = 'this test browser has no Web Audio: skipped';
  else {
    checks[label + ': all announcer clips decode'] = !!log.ann && log.ann.ok === log.ann.of && log.ann.of > 200;
    checks[label + ': all fighter voice clips decode'] = !!log.fig && log.fig.ok === log.fig.of && log.fig.of > 600;
  }
  notes[label + ' audio decode time'] = log.ann && log.fig ? 'announcer ' + log.ann.ms + 'ms, fighters ' + log.fig.ms + 'ms (' + log.ann.of + ' + ' + log.fig.of + ' clips)' : 'did not finish';
  notes[label + ' memory'] = await p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a'));
  return { ctx, p };
}
(async () => {
  // ---- Chrome ----
  const cr = await pw.chromium.launch();
  const { ctx, p } = await boot(cr, 'Chrome');
  // story voices: story.js and a hero file actually download from the site
  const got = {};
  p.on('response', r => { const m = r.url().match(/voices\/([\w-]+)\.js/); if (m) got[m[1]] = r.status(); });
  await p.evaluate(() => { StoryVoices.load('story'); StoryVoices.load('hero-argyle'); });
  for (let i = 0, StoryReady = false; i < 240 && !(StoryReady = await p.evaluate(() => StoryVoices.files.story === 'ready' && StoryVoices.files['hero-argyle'] === 'ready')); i++) await p.waitForTimeout(250);
  checks['story voice file downloads'] = (got.story === 200 || got.story === 304) && (await p.evaluate(() => StoryVoices.files.story === 'ready'));
  checks['hero voice file downloads'] = await p.evaluate(() => StoryVoices.files['hero-argyle'] === 'ready');
  // a voice file that fails once (a network hiccup) is tried again
  // (in a window without the offline copy, so the test can make the download fail)
  const ctx2 = await cr.newContext({ serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errs.push('retry: ' + e.message));
  await p2.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await p2.waitForTimeout(1500);
  let block = true;
  await p2.route('**/voices/hero-baby.js*', r => (block ? r.abort() : r.continue()));
  await p2.evaluate(() => StoryVoices.load('hero-baby'));
  await p.waitForTimeout(1500);
  const firstTry = await p2.evaluate(() => StoryVoices.files['hero-baby']);
  block = false;
  await p2.evaluate(() => { StoryVoices.fails['hero-baby'].at -= 16000; StoryVoices.load('hero-baby'); }); // 15 seconds later
  for (let i = 0; i < 120 && (await p2.evaluate(() => StoryVoices.files['hero-baby'])) !== 'ready'; i++) await p2.waitForTimeout(250);
  checks['failed voice file is retried'] = firstTry === 'failed' && (await p2.evaluate(() => StoryVoices.files['hero-baby'] === 'ready'));
  await ctx2.close();
  // save status and a refused save (on a throwaway save, then the save is cleared)
  const save = await p.evaluate(() => {
    const S = window.__sock;
    S.resetProgress();
    S.startNewGame();
    S.saveGame();
    const r = { afterSave: unsavedChanges() };
    const look = (advData().look | 0) + 1;
    advData().look = look; // a new hero look only
    r.afterLookChange = unsavedChanges();
    S.saveGame();
    r.afterSaveAgain = unsavedChanges();
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    Toasts.queue.length = 0;
    S.saveGame();
    Storage.prototype.setItem = real;
    r.toast = Toasts.queue.map(t => t.a.head).join(',');
    S.resetProgress();
    return r;
  });
  checks['ALL SAVED after saving'] = save.afterSave === false;
  checks['NOT SAVED YET after a new look'] = save.afterLookChange === true && save.afterSaveAgain === false;
  checks['refused save says COULD NOT SAVE'] = save.toast === 'COULD NOT SAVE';
  // online play's library (PeerJS) loads
  checks['online library loads'] = await p.evaluate(async () => (await fetch(PEERJS_URL)).ok);
  // the internet OFF: the game still opens (website only: it needs the offline copy)
  if (/^https?:/.test(URL)) {
    const ready = await p.evaluate(async () => !!(await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 20000))])));
    await p.waitForTimeout(4000); // let the offline copy finish caching
    await ctx.setOffline(true);
    await p.reload({ waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(2500);
    checks['opens with the internet off'] = ready && (await p.evaluate(() => !!(window.__sock && document.querySelector('canvas')))).valueOf();
    await ctx.setOffline(false);
  }
  await cr.close();
  // ---- Safari's engine (WebKit) ----
  const wk = await pw.webkit.launch();
  await boot(wk, 'Safari');
  await wk.close();
  console.log(JSON.stringify(checks, null, 1));
  console.log('measurements: ' + JSON.stringify(notes, null, 1));
  const ok = Object.values(checks).every(Boolean);
  console.log('review checks pass: ' + ok);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  process.exit(ok && !errs.length ? 0 : 1);
})();
