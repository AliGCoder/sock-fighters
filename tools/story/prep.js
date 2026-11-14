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
  gran: 'very old, creaky, wheezy grandmother',
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
  iron: 'stern, booming warlord'
};
/** The mood of one line, read from how it's written. */
function mood(who, text) {
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

// Spoken in JAPANESE (the English shows on screen, like subtitles): ja.js has one translation per line of
// to_translate.txt (every unique line, in story order — write it with `node prep.js --list`).
const ORDER_FILE = path.join(__dirname, 'to_translate.txt');
if (process.argv.includes('--list')) {
  const seen = new Set(),
    out = [];
  for (const k of Object.keys(raw))
    if (k !== 'ROSTER')
      for (const l of raw[k])
        if (!seen.has(l.text)) {
          seen.add(l.text);
          out.push(l.who + '\t' + l.text);
        }
  fs.writeFileSync(ORDER_FILE, out.join('\n'));
}
const order = fs.readFileSync(ORDER_FILE, 'utf8').split('\n').map(l => l.slice(l.indexOf('\t') + 1));
const JA = {};
require('./ja.js').forEach((t, i) => (JA[order[i]] = t));
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

const names = Object.keys(raw).filter(k => k !== 'ROSTER');
const roster = raw.ROSTER; // [id, NAME]
const jobs = new Map();
function add(speaker, shown, voice, say, file, text, who) {
  if (!say) return;
  const key = storyVoiceKey(speaker, shown);
  const note = (PERSONA[voice] || "") + ", " + mood(who, text);
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
