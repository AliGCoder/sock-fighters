// The trailer's shots: each one sets the game up (inside the page) for a few seconds of footage.
// Used by record.js. Every shot: { cap: caption, sub: small caption, secs, setup: page function, tick?: page function every 100 ms }
const SELECT = {
    cap: '31 SOCK FIGHTERS', sub: 'heroes, villains and one very old granny', secs: 3.4,
    setup: () => { const S = window.__sock; S.game.story = null; S.game.mode = '2p'; S.game.selection = { c1: 0, c2: 1, k1: 0, k2: 0, done1: false, done2: false, wait: 0 }; S.game.screen = 'select'; },
    tick: (k) => { if (k % 4 === 0) { keysPressed.KeyD = true; keysDown.KeyD = true; setTimeout(() => delete keysDown.KeyD, 50); } }
  };
const STORY = {
    cap: 'AN EPIC ADVENTURE', sub: 'save the palace... and bring everyone home', secs: 5, top: true,
    setup: () => { const S = window.__sock; S.Progress.data.adv = { prologue: true, hero: 0, look: 0, cleared: {}, seen: {} }; S.startAdventure(); if (S.game.screen === 'advSlots') S.continueGame(); S.storyJump(1, 0); },
    tick: (k) => { if (k % 22 === 0) { keysPressed.Space = true; keysDown.Space = true; setTimeout(() => delete keysDown.Space, 50); } }
  };
const MAKER = {
    cap: 'BUILD YOUR OWN SOCK', sub: 'colours, hats, skins, accessories', secs: 3.6,
    setup: () => { window.__sock.openMaker(() => {}); },
    tick: (k) => { const key = k % 6 < 3 ? 'KeyD' : 'KeyS'; if (k % 3 === 0) { keysPressed[key] = true; keysDown[key] = true; setTimeout(() => delete keysDown[key], 50); } }
  };
const VOICE = {
    cap: 'RECORD YOUR OWN VOICE', sub: 'your sock shouts what you shout', secs: 2.6,
    setup: () => { window.__sock.openVoiceRec(() => {}); }
  };
const SKILLS = {
    cap: 'UNLOCK EVERYTHING', sub: 'trophies, skills and daily bounties', secs: 3,
    setup: () => { window.__sock.openSkills && window.__sock.openSkills(() => {}); }
  };
const ONLINE_LOBBY = {
    cap: 'PLAY ONLINE WITH FRIENDS', sub: 'phone, tablet or PC', secs: 2.2, top: true,
    setup: () => { window.__sock.openOnlineLobbyForTest(); }
  };
const PROLOGUE = i => new Function(`const S = window.__sock; S.game.story = null; S.game.mf = null;
      S.Progress.data.adv = { prologue: false, hero: 0, look: 0, cleared: {}, seen: {} }; S.prologueAt(${i});`);
const PORTAL = {
    cap: 'THROUGH THE DRYER', sub: 'Stinky, Argyle and Gran go after his other half', secs: 3.2,
    setup: () => { const S = window.__sock; S.Progress.data.adv = { prologue: true, hero: 0, look: 0, cleared: {}, seen: {} }; S.portalForTest(); }
  };
const DEMON_THRONE = {
    cap: 'AN EPIC ADVENTURE', sub: 'all the way to the Tumble Throne', secs: 5, top: true,
    setup: () => { const S = window.__sock; S.Progress.data.adv = { prologue: true, hero: 0, look: 0, cleared: {}, seen: {} }; S.startAdventure(); if (S.game.screen === 'advSlots') S.continueGame(); S.storyJump(5, 7); }
  };
const FIGHT_STINKY = fight('stinky', 'argyle', 'laundry', 'FAST ARCADE FIGHTING', 'combos, throws, specials', 4.2);
module.exports = [
  // ACT 0: the story first. The laundromat at midnight, a sock vanishes into Dryer No. 7, the Dryer Demon, the portal
  { card: 'IN A LAUNDROMAT AT MIDNIGHT...', cardSecs: 3.0, say: 'In a laundromat... at midnight...', cap: '', secs: 2.6, setup: PROLOGUE(8) },
  { card: "STINKY'S OTHER HALF... GONE.", cardSecs: 2.6, say: "Stinky Tabi's other half... sucked into the dryer.", cap: '', secs: 3.4, setup: PROLOGUE(13) },
  { card: 'A SHINOBI APPEARS.', cardBig: true, cardSecs: 2.0, say: 'Then... out of the dryer... came a secret shinobi.', cap: 'A FULLY VOICED STORY', sub: 'Agent Fishnet, shinobi of the Royal Court', secs: 3.6, top: true, setup: PROLOGUE(18) },
  Object.assign(superShot('demon', 'stinky', 'THE DRYER DEMON', "he took Stinky's other half... and he is not sorry"), { say: 'The Dryer Demon... is stealing socks... from every world.', secs: 4.6 }),
  PORTAL,
  { card: 'FIND HIS OTHER HALF.', cardBig: true, cardSecs: 2.0, say: 'Find his other half... save the palace from the Dryer Demon... and bring everyone home.', cap: '', secs: 0, setup: () => {} },
  DEMON_THRONE,
  // ACT 1: fighting
  { card: 'FIGHT.', cardBig: true, cardSecs: 1.6, say: 'To get home... the socks must fight.', cap: '', secs: 0, setup: () => {} },
  FIGHT_STINKY,
  SELECT,
  // ACT 2: supers
  { card: 'UNLEASH YOUR SUPER.', cardBig: true, cardSecs: 1.8, say: 'Every hero... has a super.', cap: '', secs: 0, setup: () => {} },
  superShot('stinky', 'kneehi', 'EVERY HERO HAS THEIR OWN SUPER', '30 one-of-a-kind cinematic supers'),
  superShot('shinobi', 'argyle', 'TOE-SHINOBI', 'Hidden Toe Tempest'),
  superShot('gran', 'stinky', 'STOCKING GRAN', 'yes, those are dentures'),
  superShot('robo', 'baby', 'MECHA-SOCK X', 'Overclock Overdrive'),
  // ACT 4: everything else
  { card: 'PLAY YOUR WAY.', cardBig: true, cardSecs: 1.6, say: 'Build your own legend.', cap: '', secs: 0, setup: () => {} },
  mini('siege', 'MINI GAMES', 'starring the real fighters'),
  mini('bossrush', 'MINI GAMES', 'boss rush, sumo, surfing, disco and more'),
  MAKER,
  VOICE,
  SKILLS,
  // ACT 5: online
  { card: 'TOGETHER.', cardBig: true, cardSecs: 1.5, say: 'Challenge your friends.', cap: '', secs: 0, setup: () => {} },
  ONLINE_LOBBY,
  fight('ghost', 'demon', null, 'PLAY ONLINE WITH FRIENDS', 'phone, tablet or PC', 2.6),
  { end: true, cap: 'SOCK FIGHTERS', sub: 'TURBO RINSE', secs: 6, say: 'Sock Fighters... Turbo Rinse. Play free... now.', setup: () => { const S = window.__sock; S.game.screen = 'title'; } }
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
    cap, sub, secs: 3.8, punch: true, zoom: [1.04, 1.1],
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
