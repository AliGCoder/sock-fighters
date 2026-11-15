// Skill tree balance: stats, perks, charms, the XP curve over the whole story, and villain scaling.
// Run on its own (node tools/tests/test_skills.js) or as part of run_all.js. Prints "BALANCE OK" or the problems.
const pw = require('C:/SockFighters/tools/announcer/node_modules/playwright');
(async () => {
  const b = await pw.chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(require('url').pathToFileURL('C:/SockFighters/index.html').href);
  await p.waitForTimeout(800);
  const B = await p.evaluate(() => {
    const x = window.__sock.balance();
    return Object.assign({}, x, { heroPerks: Object.fromEntries(Object.keys(window.__sock.HERO_PERK_LIST).map(id => [id, window.__sock.heroPerks(id)])), storyHeroes: window.__sock.ROSTER.slice(0, -1).map(d => d.id), scale: Array.from({ length: 30 }, (_, i) => x.storyScale(i + 1)), xpTable: Array.from({ length: 40 }, (_, i) => x.xp(i + 1)) });
  });
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };

  // 1. every stat point is worth about the same (5% each; stamina's super meter counts double)
  for (const s of B.SKILL_STATS) {
    const per = +((s.desc.match(/(\d+)%/) || [])[1] || 0);
    const worth = s.id === 'stamina' ? per / 2 : per;
    ok(worth >= 4 && worth <= 6, `stat ${s.name}: ${per}% a level is out of line with the others`);
  }
  ok(B.SKILL_MAX === 5, 'stats should go to level 5');
  // 2. perks: higher tiers cost at least as much
  const tiers = {};
  for (const k of B.SKILL_PERKS) (tiers[k.tier] = tiers[k.tier] || []).push(k.cost);
  ok(Math.max(...tiers[1]) <= Math.min(...tiers[2]) && Math.max(...tiers[2]) <= Math.min(...tiers[3]), 'perk costs should rise with their tier');
  // every story hero has their own two HERO ONLY perks, each with a real effect
  for (const id of B.storyHeroes) {
    const hp = B.heroPerks[id] || [];
    ok(hp.length === 2 && hp.every(k => k.cost === 2 && ['super', 'special', 'cool', 'tough', 'meter'].includes(k.fx)), 'hero ' + id + ' needs exactly 2 HERO ONLY perks with a real effect');
  }
  const treeCost = B.SKILL_STATS.length * B.SKILL_MAX + B.SKILL_PERKS.reduce((n, k) => n + k.cost, 0) + 4; // + the 2 hero perks
  // 3. the XP curve: play every episode once (bosses give x1.5) and see how many points you earn
  let lvl = 1, xp = 0, sp = 0;
  for (const ep of B.episodes) {
    ep.fights.forEach((f, i) => {
      let g = 60 + 10 * ep.n;
      if (ep.boss && i === ep.fights.length - 1) g = Math.round(g * 1.5);
      xp += g;
      while (xp >= B.xpTable[lvl - 1] && lvl < 40) { xp -= B.xpTable[lvl - 1]; lvl++; sp++; }
    });
  }
  ok(sp >= treeCost * 0.5, `the whole story only earns ${sp} skill points; the tree costs ${treeCost} (need at least half)`);
  ok(sp <= treeCost * 1.2, `the story earns ${sp} skill points, far more than the tree's ${treeCost}: nothing left to aim for`);
  // 4. damage never stacks past the cap, and the best defence still lets some damage through
  const maxCharmDmg = Math.max(...Object.values(B.CHARMS).map(c => c.dmg || 1));
  const rawMax = (1 + 0.05 * B.SKILL_MAX) * 1.15 * 1.25 * maxCharmDmg; // power + combo + last stand + charm
  ok(B.MAX_DMG_MUL <= 1.6 && B.MAX_DMG_MUL < rawMax, `damage cap ${B.MAX_DMG_MUL} should be below the raw stack ${rawMax.toFixed(2)} and at most 1.6`);
  const minGuard = Math.min(...Object.values(B.CHARMS).map(c => c.guard || 1));
  ok((1 - 0.05 * B.SKILL_MAX) * minGuard >= 0.6, 'guard + charm let you take less than 60% damage: too tanky');
  // 5. villains grow with the story, but never past +40%
  ok(B.scale.every((v, i) => i === 0 || v >= B.scale[i - 1]), 'villain scaling should never go down');
  ok(Math.max(...B.scale) <= 1 + B.STORY_SCALE_MAX + 1e-9 && B.STORY_SCALE_MAX <= 0.4, 'villain scaling went past +40%');
  // 6. charms: real targets, sensible sizes
  for (const [id, c] of Object.entries(B.CHARMS)) {
    ok(!!(c.dmg || c.guard), `charm ${id} does nothing`);
    if (c.dmg) ok(c.dmg <= 1.2, `charm ${id} damage x${c.dmg} is too strong`);
    if (c.guard) ok(c.guard >= 0.8, `charm ${id} guard x${c.guard} is too strong`);
    for (const v of c.vs || []) ok(B.ids.includes(v), `charm ${id} lists "${v}", who doesn't exist`);
  }
  // 7. every story fight is against a real character
  for (const ep of B.episodes) for (const f of ep.fights) ok(B.ids.includes(f), `episode ${ep.n} fights "${f}", who doesn't exist`);
  console.log(`skill points from the whole story: ${sp} (tree costs ${treeCost}), final level ${lvl}; villain scaling max x${Math.max(...B.scale).toFixed(2)}; damage cap x${B.MAX_DMG_MUL}`);
  if (errs.length) bad.push('page errors: ' + errs.join(' | '));
  console.log(bad.length ? 'BALANCE PROBLEMS:\n  ' + bad.join('\n  ') : 'BALANCE OK');
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
