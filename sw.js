// Sock Fighters as an installed app: keeps the game on the computer/phone so it opens fast and plays offline
// (online fights still need the internet).
//  - the game page: always tries the internet first, so updates arrive; the saved copy is used offline
//  - voices, icons, fonts: served from the saved copy straight away, refreshed in the background
const CACHE = 'sock-fighters-v2';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !fonts) return; // online play, matchmaking: straight to the internet
  const page = req.mode === 'navigate' || (same && /\/(index\.html)?$/.test(url.pathname));
  if (page) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then(async c => {
              // a new version of a voice file: forget the older saved copies of it
              if (url.search && url.pathname.includes('/voices/'))
                for (const k of await c.keys()) {
                  const ku = new URL(k.url);
                  if (ku.pathname === url.pathname && ku.search !== url.search) c.delete(k);
                }
              c.put(req, copy);
            });
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
