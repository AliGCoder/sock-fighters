// Story voices, step 1: turn every story line into a recording job.
//   node tools/story/prep.js      (reads lines_raw.json, writes jobs.json)
// lines_raw.json comes from the game itself (see extract.js). Each job:
//   { key, voice, say, file }
//   key   = storyVoiceKey(speaker, shown text) — the game computes the same key to find the clip
//   voice = whose voice records it (a fighter id, 'queen', 'fishnet', 'narr', 'fake', 'fakedeep')
//   say   = the words actually spoken (stage directions removed, sounds kept)
//   file  = which file it goes in: 'story' (everyone) or 'hero-<id>' (only loaded for that hero)
const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'lines_raw.json'), 'utf8'));

/** Same hash as storyVoiceKey() in index.html: FNV-1a 32-bit over "speaker|text", as 8 hex digits. */
function storyVoiceKey(speaker, text) {
  const s = speaker + '|' + text;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

// *stage directions* that are sounds get spoken; everything else in *stars* is silent
const SPOKEN = {
  '*sniff*': 'sniff...',
  '*sniffles*': 'sniff, sniff...',
  '*ACHOO!*': 'ACHOO!',
  '*Ah... AH...*': 'Ah... AH...',
  '*Ah... AHH... AHHHHHH...*': 'Ah... Ahh... AHHHHHH...',
  '*breathable*': 'breathable',
  '*beep*': 'beep.',
  '*sigh*': 'haaah...',
  '*hiccup*': 'hic!',
  '*CRACK*': 'crack!',
  '*hisssss*': 'hissss...',
  '*growls*': 'grrrr...',
  '*Darling?*': 'Darling?',
  '*gasp*': 'ah!'
};

const titleCase = name => name.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

function spoken(who, text) {
  let t = text;
  if (who === 'narr') t = t.replace(/\*/g, '');
  else t = t.replace(/\*[^*]+\*/g, f => (SPOKEN[f] !== undefined ? SPOKEN[f] : ' '));
  // ALL-CAPS words read as words, not spelled out
  t = t.replace(/\b[A-Z][A-Z']+\b/g, w => w[0] + w.slice(1).toLowerCase()); // KNEEL -> Kneel, I'M -> I'm
  t = t.replace(/\s+/g, ' ').replace(/^[\s.…,]+(?=\w)/, '').trim();
  if (!/[A-Za-z]/.test(t)) return '';
  return t.replace(/^([^A-Za-z]*)([a-z])/, (m, a, c) => a + c.toUpperCase()); // capital at the start
}

// How each voice sounds, as a delivery note for VoxCPM2 (our own descriptions, nobody real)
const PERSONA = {
  narr: 'warm, playful storybook narrator',
  queen: 'glamorous, mature, velvety-voiced queen, elegant and poised, with a pinch of sass',
  fishnet: 'eager, quick young scout',
  fake: 'a cute toddler voice that is a little too deep and sinister',
  fakedeep: 'deep, sinister, smoky demon voice',
  stinky: 'cocky young street brawler',
  argyle: 'calm, noble samurai',
  shinobi: 'cool, quiet ninja woman',
  gran: 'SASSY, quick-witted, forgetful 98-year-old granny who SHOUTS everything, fast-talking, sharp-tongued, shrill and loud, voice cracking and squeaking, croaky',
  baby: 'squeaky, bratty toddler',
  kneehi: 'booming, jolly sumo wrestler',
  robo: 'flat, monotone robot',
  ghost: 'soft, whispery, eerie ghost girl',
  lint: 'tiny, squeaky, fluffy creature',
  socklet: 'cheeky, fast-talking little boy',
  holey: 'nervous, whiny coward',
  steel: 'gruff, deep construction worker',
  king: 'pompous, theatrical king',
  demon: 'deep, growling demon lord',
  bleach: 'snobbish, sneering aristocrat',
  cling: 'sultry, smug villainess queen',
  iron: 'stern, booming warlord',
  mismatch: 'huge, deep, rumbling patchwork golem, a little dim-witted',
  lefty: 'sly, quick-talking young man: a creepy villain with a raspy sinister whisper, hilariously over-the-top dramatic and fussy, with a lonely sad crack in his voice',
  puppet: 'flamboyant, hammy stage prince, dramatic showman',
  mitten: 'big, grumpy, woolly voice, jealous and dramatic',
  flipflop: 'laid-back, goofy surfer dude',
  stiletto: 'haughty, sassy fashion diva',
  galosh: 'huge, booming, splashy rubber boot',
  skate: 'groovy, bubbly disco queen',
  tapper: 'dapper, cheerful old-time showman',
  slipper: 'sleepy, cranky dinosaur slipper',
  lace: 'sly, hissing snake',
  studs: 'loud, shouty football coach',
  bigboot: 'gigantic, slow, booming ancient boot'
};
/** The mood of one line, read from how it's written. */
function mood(who, text) {
  // Mismatch gloating over the hero's lost sock: mocking and taunting
  if (who === 'mismatch' && /YOURS|Nyah|FINDERS/.test(text)) return 'mocking, taunting and teasing, sing-song and gloating, like a playground bully';
  if (who === 'queen') {
    // the Queen never shouts: even her big moments stay poised
    if (/dabbing|RUN!/.test(text)) return 'gently tearful, still graceful'; // (her *sniff* is a sniff at a smell)
    // her put-downs and jokes get the sass
    if (/curtains|WASH|wrinkl|sheen|finest|slow|gym bag|FASHION|TIMELESS|toaster|trip|wet|GUARDS|DAMP|shower cap|ESPECIALLY|everything/i.test(text))
      return 'sassy, with a sly, knowing smirk and a raised eyebrow';
    if (/!/.test(text)) return 'composed but firm, with elegant emphasis';
    if (/\?\s*$/.test(text)) return 'arch and curious';
    return 'calm, gracious and a little sassy';
  }
  const words = text.replace(/\*[^*]*\*/g, '');
  const letters = words.replace(/[^A-Za-z]/g, '');
  const caps = letters.replace(/[^A-Z]/g, '').length;
  if (who === 'narr') return /!/.test(text) ? 'excited storytelling' : 'storytelling';
  // Stocking Gran nags, and she nags LOUDLY
  if (who === 'gran') return /HA(HA)+|laugh|hee/i.test(text) ? 'cackling wildly' : 'sassy and quick-witted, talking fast and shouting, snappy cheeky scolding, a bit scatterbrained';
  if (/WAA+H|\*sniff|crying|tantrum|\*dabbing/i.test(text)) return 'crying and sobbing';
  if (/\*quietly\*/.test(text)) return 'quiet and sad';
  if (/\*VERY loudly\*/.test(text)) return 'suddenly very loud';
  if (/HA(HA)+|laugh/i.test(text)) return 'laughing';
  if (letters.length >= 8 && caps / letters.length > 0.55) return 'shouting furiously';
  if (/^\s*\.\.\./.test(text)) return 'deadpan, awkward pause';
  if (/!\s*$|!\W*$/.test(words.trim()) && caps / Math.max(1, letters.length) > 0.2) return 'excited, emphatic';
  if (/\?\s*$/.test(words.trim())) return 'confused, questioning';
  if (/!/.test(words)) return 'lively';
  return 'conversational';
}

// Spoken in JAPANESE (the English shows on screen, like subtitles): ja.js maps each English line to its Japanese.
const JA = require('./ja.js');
{
  const missing = [];
  for (const k of Object.keys(raw))
    if (k !== 'ROSTER') for (const l of raw[k]) if (JA[l.text] === undefined && !missing.includes(l.text)) missing.push(l.who + ': ' + l.text);
  if (missing.length) {
    console.log('These story lines need a Japanese translation in ja.js:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
}
// heroes' Japanese names, as the announcer calls them (CALL_NAMES in index.html)
const JP_NAME = {};
{
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const at = html.indexOf('const CALL_NAMES');
  const block = html.slice(at, html.indexOf('};', at));
  for (const m of block.matchAll(/(\w+): \['([^']+)'/g)) JP_NAME[m[1]] = m[2];
}
function japanese(text, heroId) {
  const t = JA[text];
  if (t === undefined) throw new Error('no Japanese for: ' + text);
  const out = t.replace(/\{HERO\}/g, heroId ? JP_NAME[heroId] : '');
  return /[぀-ヿ一-鿿A-Za-z]/.test(out) ? out : ''; // '…' alone = silent
}

// Gran's back really hurts on these lines (the game's GRAN_OUCH acts it out on the same lines)
const GRAN_OUCH = /oh, my back|was my back|my back hurts|ow ow/i;
const names = Object.keys(raw).filter(k => k !== 'ROSTER');
const roster = raw.ROSTER.filter(([id]) => id !== 'mysock'); // [id, NAME] (MY SOCK is not in the story)
const jobs = new Map();
function add(speaker, shown, voice, say, file, text, who) {
  if (!say) return;
  const key = storyVoiceKey(speaker, shown);
  let note = (PERSONA[voice] || "") + ", " + mood(who, text);
  // Stocking Gran's back (and hip) REALLY hurt: three long, pained ouches, and she sounds it
  // Stocking Gran has no teeth: a gummy lisp on her さ-row (same as TOOTHLESS in qwen_fighters.py)
  // ...and she is 98: she speaks VERY slowly, pausing after every phrase (the pauses are written into her lines)
  if (voice === 'gran') say = say.replace(/、/g, '、…').replace(/。(?!$)/g, '。……').replace(/([!！])(?!$)/g, '$1…').replace(/([?？])(?!$)/g, '$1…');
  if (voice === 'gran') say = say.replace(/[さすせそざずぜぞサスセソザズゼゾ]/g, c => ({ さ: 'しゃ', す: 'しゅ', せ: 'しぇ', そ: 'しょ', ざ: 'じゃ', ず: 'じゅ', ぜ: 'じぇ', ぞ: 'じょ', サ: 'シャ', ス: 'シュ', セ: 'シェ', ソ: 'ショ', ザ: 'ジャ', ズ: 'ジュ', ゼ: 'ジェ', ゾ: 'ジョ' })[c]);
  if (who === 'gran' && GRAN_OUCH.test(text)) {
    say = say.replace(/[。!?…\s]*$/, '') + '…いったぁ〜い…いったぁ〜い…いったぁ〜い…';
    note = (PERSONA[voice] || '') + ', in real pain, groaning and wincing, three long drawn-out ouches';
  }
  if (!jobs.has(key)) jobs.set(key, { key, voice, say, note, file });
}
let skipped = 0;
for (const n of names)
  for (const line of raw[n]) {
    const perHero = line.who === 'hero' || /\{HERO\}/.test(line.text);
    if (!perHero) {
      let voice = line.who;
      if (voice === 'fake' && /deep, smoky voice/.test(line.text)) voice = 'fakedeep';
      const say = japanese(line.text);
      if (!say) skipped++;
      add(line.who, line.text, voice, say, 'story', line.text, line.who);
      continue;
    }
    for (const [id, NAME] of roster) {
      const shown = line.text.replace(/\{HERO\}/g, NAME);
      const say = japanese(line.text, id);
      const speaker = line.who === 'hero' ? id : line.who;
      add(speaker, shown, line.who === 'hero' ? id : line.who, say, 'hero-' + id, line.text, line.who);
    }
  }
const list = [...jobs.values()];
fs.writeFileSync(path.join(__dirname, 'jobs.json'), JSON.stringify(list, null, 1));
const byFile = {};
list.forEach(j => (byFile[j.file] = (byFile[j.file] || 0) + 1));
console.log(list.length + ' recordings (' + skipped + ' silent lines skipped)', JSON.stringify(byFile));
module.exports = { storyVoiceKey };
