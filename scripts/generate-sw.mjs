import { readFile, writeFile, readdir } from 'fs/promises';
import { createHash } from 'crypto';

const photos = JSON.parse(await readFile('src/photos.json', 'utf8'));
const hash = createHash('md5').update(JSON.stringify(photos)).digest('hex').slice(0, 8);

const BASE = '/portfolio/';

// Cache 400 + 800 sizes (mobile-appropriate, keeps total under ~25MB)
const photoUrls = photos.flatMap(p =>
  [400, 800].filter(s => p.sizes.includes(s)).map(s => `${BASE}${p.dir}/${s}.webp`)
);

const assets = await readdir('dist/assets');
const assetUrls = assets.map(f => `${BASE}assets/${f}`);

const CACHE = `portfolio-${hash}`;
const URLS = [BASE, ...assetUrls, `${BASE}manifest.json`, ...photoUrls];

const sw = `const CACHE = '${CACHE}';
const URLS = ${JSON.stringify(URLS, null, 2)};

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
`;

await writeFile('dist/sw.js', sw);
console.log(`✓  sw.js — cache: ${CACHE}, ${photoUrls.length} photos cached`);
