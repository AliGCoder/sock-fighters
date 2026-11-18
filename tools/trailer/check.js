// Checks a recorded trailer: length, frame snapshots, and that it has sound (loudness over time).
const pw = require('../announcer/node_modules/playwright'), path = require('path');
const file = process.argv[2] || path.join(__dirname, 'out', 'sock-fighters-trailer.mp4');
(async () => {
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.route('http://trailer.test/**', r => r.request().url().endsWith('.mp4') ? r.fulfill({ path: file, contentType: 'video/mp4' }) : r.fulfill({ body: '<video src="/v.mp4" controls></video>', contentType: 'text/html' }));
  await p.goto('http://trailer.test/');
  await p.waitForTimeout(1500);
  const info = await p.evaluate(async () => {
    const v = document.querySelector('video');
    const buf = await (await fetch('/v.mp4')).arrayBuffer();
    const ac = new OfflineAudioContext(1, 48000, 48000);
    let loud = [];
    try {
      const a = await ac.decodeAudioData(buf);
      const d = a.getChannelData(0), sec = a.sampleRate;
      for (let s = 0; s + sec <= d.length; s += sec) { let m = 0; for (let i = s; i < s + sec; i += 4) m = Math.max(m, Math.abs(d[i])); loud.push(+m.toFixed(2)); }
    } catch (e) { loud = 'no sound: ' + e.message; }
    let quality = null;
    if (v.getVideoPlaybackQuality) { v.muted = true; await v.play(); await new Promise(r => setTimeout(r, 4000)); quality = v.getVideoPlaybackQuality(); v.pause(); }
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, loud, frames: quality && quality.totalVideoFrames };
  });
  console.log(JSON.stringify(info));
  await b.close();
})();
