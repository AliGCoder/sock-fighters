// Story voices, step 0: read every story scene's lines out of the game into lines_raw.json.
//   node tools/story/extract.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('../announcer/node_modules/playwright');
(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  // every "const NAME = [ { who: ..." scene in the game
  const names = [...html.matchAll(/const ([A-Z0-9_]+) = \[\n\s+\{ who: /g)].map(m => m[1]);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(800);
  const data = await p.evaluate(names => {
    const o = {};
    // eslint-disable-next-line no-eval
    for (const n of names) o[n] = eval(n).map(l => ({ who: l.who, text: l.text }));
    o.ROSTER = window.__sock.ROSTER.map(d => [d.id, d.name]);
    return o;
  }, names);
  await b.close();
  fs.writeFileSync(path.join(__dirname, 'lines_raw.json'), JSON.stringify(data, null, 1));
  console.log(names.length + ' scenes: ' + names.join(' '));
})();
