// The trailer's shots: each one sets the game up (inside the page) for a few seconds of footage.
// Used by record.js. Every shot: { cap: caption, sub: small caption, secs, setup: page function, tick?: page function every 100 ms }
module.exports = [
  {
    cap: '', sub: '', secs: 3.2,
    setup: () => { const S = window.__sock; S.game.screen = 'title'; S.game.story = null; }
  },
  {
    cap: '31 SOCK FIGHTERS', sub: 'heroes, villains and one very old granny', secs: 3.4,
    setup: () => { const S = window.__sock; S.game.story = null; S.game.mode = '2p'; S.game.selection = { c1: 0, c2: 1, k1: 0, k2: 0, done1: false, done2: false, wait: 0 }; S.game.screen = 'select'; },
    tick: (k) => { if (k % 4 === 0) { keysPressed.KeyD = true; keysDown.KeyD = true; setTimeout(() => delete keysDown.KeyD, 50); } }
  },
  fight('stinky', 'argyle', 'laundry', 'FAST ARCADE FIGHTING', 'combos, throws, specials', 5),
  superShot('stinky', 'kneehi', 'EVERY HERO HAS THEIR OWN SUPER', '30 one-of-a-kind cinematic supers'),
  superShot('shinobi', 'argyle', 'EVERY HERO HAS THEIR OWN SUPER', 'shouted in their own voice'),
  superShot('gran', 'stinky', 'EVERY HERO HAS THEIR OWN SUPER', 'yes, those are dentures'),
  superShot('robo', 'baby', 'EVERY HERO HAS THEIR OWN SUPER', ''),
  {
    cap: 'A FULLY VOICED STORY', sub: '27 chapters to rescue the Queen', secs: 6,
    setup: () => { const S = window.__sock; S.Progress.data.adv = { prologue: true, hero: 0, look: 0, cleared: {}, seen: {} }; S.startAdventure(); if (S.game.screen === 'advSlots') S.continueGame(); S.storyJump(1, 0); },
    tick: (k) => { if (k % 22 === 0) { keysPressed.Space = true; keysDown.Space = true; setTimeout(() => delete keysDown.Space, 50); } }
  },
  mini('siege', 'MINI GAMES', 'starring the real fighters'),
  mini('bossrush', 'MINI GAMES', 'boss rush, sumo, surfing, disco and more'),
  {
    cap: 'BUILD YOUR OWN SOCK', sub: 'colours, hats, skins, accessories', secs: 3.6,
    setup: () => { window.__sock.openMaker(() => {}); },
    tick: (k) => { const key = k % 6 < 3 ? 'KeyD' : 'KeyS'; if (k % 3 === 0) { keysPressed[key] = true; keysDown[key] = true; setTimeout(() => delete keysDown[key], 50); } }
  },
  {
    cap: 'RECORD YOUR OWN VOICE', sub: 'your sock shouts what you shout', secs: 2.6,
    setup: () => { window.__sock.openVoiceRec(() => {}); }
  },
  fight('ghost', 'demon', null, 'PLAY ONLINE WITH FRIENDS', 'phone, tablet or PC', 4),
  {
    cap: 'UNLOCK EVERYTHING', sub: 'trophies, skills and daily bounties', secs: 3,
    setup: () => { window.__sock.openSkills && window.__sock.openSkills(() => {}); }
  },
  { end: true, cap: 'SOCK FIGHTERS', sub: 'TURBO RINSE', secs: 4.5, setup: () => { const S = window.__sock; S.game.screen = 'title'; } }
];

function fight(a, b, stage, cap, sub, secs) {
  return {
    cap, sub, secs,
    setup: new Function(`const S = window.__sock;
      S.game.story = null; S.game.mf = null; S.game.mode = '2p';
      S.game.p1Def = S.look(S.findCharacter('${a}'), 0);
      S.game.p2Def = S.look(S.findCharacter('${b}'), 0);
      ${stage ? `S.game.stageId = '${stage}';` : ''}
      S.startMatch();
      for (let i = 0; i < 300 && S.game.phase !== 'fight'; i++) updateGame();
      controller1 = new CpuController('hard', 1);
      controller2 = new CpuController('hard', 1);`)
  };
}
function superShot(a, b, cap, sub) {
  return {
    cap, sub, secs: 3.8,
    setup: new Function(`const S = window.__sock;
      S.game.story = null; S.game.mf = null; S.game.mode = '2p';
      S.game.p1Def = S.look(S.findCharacter('${a}'), 0);
      S.game.p2Def = S.look(S.findCharacter('${b}'), 0);
      S.startMatch();
      for (let i = 0; i < 300 && S.game.phase !== 'fight'; i++) updateGame();
      S.f1.x = 380; S.f2.x = 520; S.f1.meter = 100;
      controller2 = new CpuController('easy', 0);
      keysPressed.KeyR = true; keysDown.KeyR = true;
      setTimeout(() => delete keysDown.KeyR, 50);`)
  };
}
function mini(id, cap, sub) {
  return {
    cap, sub, secs: 3.6,
    setup: new Function(`const S = window.__sock; S.game.story = null; S.startMini('${id}'); S.miniBegin();
      if (S.game.screen === 'fight') { controller1 = new CpuController('hard', 1); }`)
  };
}
