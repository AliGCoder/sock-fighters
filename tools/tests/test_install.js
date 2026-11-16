// Installing the game as an app: the manifest and icons load, the offline copy (service worker) installs,
// the game still opens with the internet OFF, and the INSTALL GAME button appears when the browser offers it.
const pw = require('../announcer/node_modules/playwright');
const http = require('http');
const fsx = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
// a tiny local web server for the game folder (an installed app needs a web address, not a file)
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fsx.existsSync(file) || fsx.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fsx.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(8766, '127.0.0.1', r));
  const URL = 'http://localhost:8766/';
  const b = await pw.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  const checks = {};
  const man = await p.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    const m = await (await fetch(href)).json();
    const icons = await Promise.all(m.icons.map(async i => (await fetch(new URL(i.src, href))).ok));
    return { name: m.name, display: m.display, icons: icons.every(Boolean), n: m.icons.length };
  });
  checks.manifest = man.name === 'Sock Fighters: Turbo Rinse' && man.icons && man.n >= 2;
  checks.offlineCopyInstalled = await p.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 15000))]);
    if (!reg) return false;
    await new Promise(r => setTimeout(r, 1500));
    return !!(await caches.match('index.html'));
  });
  // the install button: hidden until the browser offers to install, then shown
  const hidden = await p.evaluate(() => getComputedStyle(document.getElementById('install')).display === 'none');
  await p.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); dispatchEvent(e); });
  const shown = await p.evaluate(() => getComputedStyle(document.getElementById('install')).display !== 'none');
  checks.installButton = hidden && shown;
  // internet off: the game still opens
  await p.reload();
  await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForTimeout(2500);
  checks.opensOffline = await p.evaluate(() => !!(window.__sock && window.__sock.game && window.__sock.game.screen));
  await ctx.setOffline(false);
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(checks));
  console.log('installable app works: ' + ok);
  console.log('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await b.close();
  server.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
