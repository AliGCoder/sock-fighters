// The bug check: run every test against the game and report anything wrong. Run before every publish:
//   node tools/tests/run_all.js            (all of them, about 10 minutes)
//   node tools/tests/run_all.js quick      (skip the long full-story playthrough)
// A test fails if it crashes, prints an error, falls out of step online, or a check in it says so.
const { spawnSync } = require('child_process');
const path = require('path');
const quick = process.argv.includes('quick');
const TESTS = [
  ['test_sound', 'Sound: announcer and fighter voices actually play'],
  ['test_story', 'Story mode: chapter 1 start to finish'],
  ['test_awards', 'Trophies, skins, accessories, the Dryer, phones'],
  ['test_uniq', 'Every hero has their own unique items'],
  ['test_voices', 'Story voices on PC, iPhone and Android'],
  ['test_online', 'Online play stays in step (iPhone + Android)'],
  ['test_quick', 'Quick Match pairs random players over the internet'],
  ['test_features', 'MY SOCK, Sock Maker, Bag, Skill Tree, Bounties, Daily'],
  ['test_skills', 'Skill tree balance: stats, perks, charms, XP and villain scaling'],
  ['test_saves', 'Story save games: each has its own hero, episodes and skill tree'],
  ['test_escape', 'Escape in story mode pauses (never skips a fight)'],
  ['test_gamepad', 'Xbox and PS5 controllers: menus, both players, attack, pause'],
  ['test_install', 'Installs as an app: icons, offline copy, INSTALL button, opens offline'],
  ['test_friends', 'Friends list: codes, add, online status, invite, accept into a match'],
  ['test_profile', 'My profile: avatar, photo, trophies, friends tab, kept after reload'],
  ...(quick ? [] : [['test_full', 'Story mode: all 3 chapters (27 episodes), credits, palace scenes']])
];
const problems = [];
for (const [name, what] of TESTS) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, name + '.js')], { encoding: 'utf8', timeout: (name === 'test_full' ? 100 : 9) * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = [];
  if (r.status !== 0) bad.push('exited with code ' + r.status);
  for (const line of out.split('\n')) {
    if (/^errors?:/i.test(line.trim()) && !/none/.test(line)) bad.push(line.trim());
    if (/desyncs":[1-9]/.test(line)) bad.push('online fell out of step: ' + line.trim().slice(0, 100));
    if (/same result on both: false/.test(line)) bad.push(line.trim());
    if (/"peak":0[,}]/.test(line)) bad.push('no sound reached the speakers');
    if (/"ann":0[,}]/.test(line) && /VS \+ fight/.test(line)) bad.push('the announcer never spoke');
  }
  if (/paired in/.test(out) === false && name === 'test_quick') bad.push('Quick Match did not pair the two players');
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log((bad.length ? '✗ ' : '✓ ') + what + '  (' + secs + 's)');
  for (const b of bad) console.log('    ' + b);
  // story lines still waiting for their voices (new episodes are recorded once their voices are approved): a note, not a bug
  const wait = (out.match(/missing (\d+)/) || [])[1];
  if (wait && +wait > 0) console.log('    note: ' + wait + ' story lines are still waiting to be recorded (they show as text until then)');
  if (bad.length) problems.push([name, bad, out]);
}
console.log(problems.length ? '\n' + problems.length + ' test(s) found problems.' : '\nAll clear: no bugs found.');
for (const [name, , out] of problems) console.log('\n--- ' + name + ' output ---\n' + out.slice(-2500));
process.exit(problems.length ? 1 : 0);
