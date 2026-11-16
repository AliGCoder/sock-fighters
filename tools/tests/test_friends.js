// FRIENDS LIST, with two players over the real matchmaking server: each gets a friend code, A adds B by code,
// B sees "ADDED YOU" and adds A back, both show each other ONLINE, A presses FIGHT, B gets the invite pop-up,
// ACCEPT puts both into the same online match (hero select).
const pw = require('../announcer/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await pw.chromium.launch();
  const URL = require('url').pathToFileURL(path.join(__dirname, '../../index.html')).href;
  const errs = [];
  const open = async tag => {
    const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.goto(URL);
    await p.waitForTimeout(800);
    await p.evaluate(() => { window.__sock.resetProgress && window.__sock.resetProgress(); window.__sock.game.screen = 'online'; });
    return p;
  };
  const A = await open('A'), B = await open('B');
  const click = (p, sel) => p.click('#online button[data-on="' + sel + '"]');
  const waitFor = async (p, fn, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await p.evaluate(fn).catch(() => false)) return true;
      await p.waitForTimeout(400);
    }
    return false;
  };
  const checks = {};
  // A opens FRIENDS from the main menu card; B from the online lobby
  await A.evaluate(() => window.__sock.openFriendsScreen());
  checks.menuScreen = await A.evaluate(() => window.__sock.game.screen === 'friends' && !!document.getElementById('my-profile'));
  await B.evaluate(() => window.__sock.openOnlineLobbyForTest());
  await click(B, 'friends');
  const codeA = await A.evaluate(() => window.__sock.myFriendCode());
  const codeB = await B.evaluate(() => window.__sock.myFriendCode());
  checks.codes = /^[A-Z2-9]{6}$/.test(codeA) && /^[A-Z2-9]{6}$/.test(codeB) && codeA !== codeB;
  await waitFor(A, () => window.__sock.Friends.ready);
  await waitFor(B, () => window.__sock.Friends.ready);
  // A adds B by code
  await A.fill('#friend-add', codeB);
  await click(A, 'fadd');
  checks.aSeesBOnline = await waitFor(A, () => Object.values(window.__sock.Friends.status).includes('on'));
  // B is told A added them, and adds back
  checks.bSeesRequest = await waitFor(B, () => !!document.querySelector('#online button[data-on="fback"]'));
  if (checks.bSeesRequest) await click(B, 'fback');
  checks.bSeesAOnline = await waitFor(B, () => Object.values(window.__sock.Friends.status).includes('on'));
  // A looks at B's profile
  await A.evaluate(c => document.querySelector('#online button[data-on="fview"][data-code="' + c + '"]').click(), codeB);
  checks.profile = await waitFor(A, () => /WINS/.test(document.querySelector('#online .pcard') ? document.querySelector('#online .pcard').textContent : '') && !!document.querySelector('#online .pcard img'));
  await click(A, 'fopen');
  // B walks away from the game: A sees AWAY
  await B.evaluate(() => { window.__sock.Friends.lastInput = -1e9; });
  await A.evaluate(() => window.__sock.friendsPollNow());
  checks.away = await waitFor(A, () => Object.values(window.__sock.Friends.status).includes('away'));
  await B.evaluate(() => { window.__sock.Friends.lastInput = performance.now(); });
  await A.evaluate(() => window.__sock.friendsPollNow());
  await waitFor(A, () => Object.values(window.__sock.Friends.status).includes('on'));
  // A: FIGHT! -> B gets the invite -> ACCEPT
  await waitFor(A, () => !!document.querySelector('#online button[data-on="ffight"]'));
  await A.click('#online button[data-on="ffight"]');
  checks.bGetsInvite = await waitFor(B, () => getComputedStyle(document.getElementById('friend-invite')).display !== 'none');
  if (checks.bGetsInvite) await B.click('#friend-invite button[data-on="iaccept"]');
  checks.matchStarts =
    (await waitFor(A, () => window.__sock.game.mode === 'online' && window.__sock.game.screen === 'select', 40000)) &&
    (await waitFor(B, () => window.__sock.game.mode === 'online' && window.__sock.game.screen === 'select', 10000));
  // the friend list and gamer code survive closing and reopening the game
  await A.reload();
  await A.waitForTimeout(1200);
  checks.savedAfterReload = await A.evaluate(([a, c]) => window.__sock.myFriendCode() === a && (window.__sock.Progress.data.friends || []).some(f => f.code === c), [codeA, codeB]);
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(checks));
  console.log('friends list works: ' + ok);
  const real = errs.filter(e => !/Access-Control|Failed to load resource/.test(e));
  console.log('errors: ' + (real.length ? real.join(' | ') : 'none'));
  await b.close();
  process.exit(ok && !real.length ? 0 : 1);
})();
