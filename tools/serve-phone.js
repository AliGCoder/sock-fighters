// Serves ONLY the game (index.html) on your home Wi-Fi so a phone on the same Wi-Fi can play it.
// Nothing else on this PC is shared. Start it by double-clicking "Play on phone.bat" in the main folder.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8080;
const GAME = path.join(__dirname, '..', 'index.html');

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    fs.readFile(GAME, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Could not read the game file.');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map(a => a.address);
  console.log('Sock Fighters is ready to play on your phone!');
  console.log('On your phone (same Wi-Fi), open:');
  for (const a of addresses) console.log('   http://' + a + ':' + PORT);
  console.log('Keep this window open while you play. Close it to stop.');
});
