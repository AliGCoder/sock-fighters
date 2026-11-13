// Extracts every Japanese announcer beat from ../../index.html -> lines.json
// Usage: node extract_lines.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const JP = /[぀-ヿ一-鿿]/;

// 1) Code regions that contain announcer speech
const regions = [];
const grab = (startRe, endRe) => {
  const s = src.search(startRe);
  if (s < 0) throw new Error('missing region ' + startRe);
  const rest = src.slice(s);
  const e = rest.slice(1).search(endRe);
  regions.push(rest.slice(0, e < 0 ? 4000 : e + 1));
};
grab(/function testVoice\(/, /\n\s*\/\* ---- crowd/); // testVoice + cycleAnnouncer
grab(/\n\s*const Announcer = \{/, /\n\s*\};/); // the whole Announcer object
grab(/function updateDifficulty\(/, /\n\s*(\/\*\*|function )/); // difficulty pick
grab(/function updateContinue\(/, /\n\s*(\/\*\*|function )/); // continue countdown / game over
grab(/function updateEnding\(/, /\n\s*(\/\*\*|function )/); // ending
for (const m of src.matchAll(/say\(\s*phrase\([^;]*;/g)) regions.push(m[0]); // any other say(phrase(...)) call

// 2) Every single-quoted JP literal in those regions, split into beats
const beats = new Set();
const addBeats = s => s.split('|').map(b => b.trim()).filter(b => JP.test(b)).forEach(b => beats.add(b));
// (strings may use either quote style, e.g. "Let's go!")
for (const r of regions) {
  for (const m of r.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
    const literal = m[1] ?? m[2];
    if (JP.test(literal)) addBeats(literal);
  }
}

// partial literals that only make sense with a dynamic prefix get replaced by their full forms
beats.delete('ヒット・コンボ!');

// 3) Dynamic pieces from the data tables
const evalLit = re => { const m = src.match(re); if (!m) throw new Error('missing ' + re); return Function('return ' + m[1])(); };
const CALL_NAMES = evalLit(/const CALL_NAMES = (\{[^;]*?\});/);
const SUPER_NAMES_JP = evalLit(/const SUPER_NAMES_JP = (\{[^;]*?\});/);
const NUMBERS_JP = evalLit(/const NUMBERS_JP = (\[[^\]]*\])/);
const DIFF_JP = [...src.matchAll(/^\s*(easy|medium|hard|nightmare): \{\s*name: '[A-Z]+',\s*jp: '([^']+)'/gm)].map(m => m[2]);
const LADDER_JP = [...src.matchAll(/^\s*(easy|medium|hard|nightmare): \{\s*label: '[^']+',\s*jp: '([^']+)'/gm)].map(m => m[2]);
if (DIFF_JP.length < 3 || LADDER_JP.length < 3) throw new Error('difficulty/ladder names not found');
const dyn = [];
for (const [ja] of Object.values(CALL_NAMES)) dyn.push(ja + '!', ja + '…');
dyn.push(...Object.values(SUPER_NAMES_JP).filter(Boolean));
dyn.push(...NUMBERS_JP.map(n => n + '!'));
dyn.push(...DIFF_JP.map(d => d + '!'));
dyn.push(...LADDER_JP.map(d => d + '…'));
dyn.push('3ヒット・コンボ!', '5ヒット・コンボ!');
dyn.forEach(b => beats.add(b));

const list = [...beats].sort();
fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(list, null, 1));

// 4) Whole multi-beat lines that never change: recorded as one performance each (the game prefers these).
const full = new Set();
for (const r of regions) {
  for (const m of r.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
    const literal = (m[1] ?? m[2]).trim();
    const parts = literal.split('|');
    if (parts.length > 1 && parts.every(p => JP.test(p) && p.trim()) && JP.test(literal[0])) full.add(literal);
  }
}
NUMBERS_JP.forEach(n => full.add('ラウンド…|' + n + '!')); // "Round… ONE!" etc. are built from parts
const fullList = [...full].sort();
fs.writeFileSync(path.join(__dirname, 'lines_full.json'), JSON.stringify(fullList, null, 1));
console.log(fullList.length + ' whole lines');
console.log(list.length + ' beats', { names: Object.keys(CALL_NAMES).length, supers: Object.keys(SUPER_NAMES_JP).length, DIFF_JP, LADDER_JP });
