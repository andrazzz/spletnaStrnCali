// Preprost statični strežnik za teste (naključen prost port).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

function zazeni(koren) {
  const streznik = http.createServer((zahteva, odgovor) => {
    let pot = decodeURIComponent(new URL(zahteva.url, 'http://x').pathname);
    if (pot.endsWith('/')) pot += 'index.html';
    const datoteka = path.join(koren, path.normalize(pot));
    if (!datoteka.startsWith(koren) || !fs.existsSync(datoteka) || fs.statSync(datoteka).isDirectory()) {
      odgovor.writeHead(404); odgovor.end('ni najdeno'); return;
    }
    odgovor.writeHead(200, { 'Content-Type': TIPI[path.extname(datoteka)] || 'application/octet-stream' });
    fs.createReadStream(datoteka).pipe(odgovor);
  });
  return new Promise((resolve) => {
    streznik.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${streznik.address().port}`,
      zapri: () => new Promise((r) => streznik.close(r)),
    }));
  });
}

module.exports = { zazeni };
