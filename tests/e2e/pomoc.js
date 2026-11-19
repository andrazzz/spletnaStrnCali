// Skupni pomočniki za e2e teste: brskalnik z WebGL in lokalni predpomnilnik CDN (jsdelivr).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { zazeni } = require('./streznik');

const KORENA = path.resolve(__dirname, '../..');
const PREDPOMNILNIK = path.join(__dirname, '.cdn');

async function zagon() {
  const streznik = await zazeni(KORENA);
  const brskalnik = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  return { streznik, brskalnik, url: streznik.url,
    async zapri() { await brskalnik.close(); await streznik.zapri(); } };
}

// Zahteve na cdn.jsdelivr.net postrežemo iz lokalnega predpomnilnika (ob prvem zagonu se prenesejo s curl).
async function cdnPredpomnilnik(context) {
  await context.route('https://cdn.jsdelivr.net/**', async (route) => {
    const url = new URL(route.request().url());
    const datoteka = path.join(PREDPOMNILNIK, url.pathname);
    try {
      if (!fs.existsSync(datoteka)) {
        fs.mkdirSync(path.dirname(datoteka), { recursive: true });
        execFileSync('curl', ['-fsSL', '-o', datoteka, url.href], { timeout: 60000 });
      }
      await route.fulfill({ path: datoteka, contentType: 'text/javascript; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' } });
    } catch (e) {
      await route.abort();
    }
  });
}

async function novaStran(brskalnik, moznosti = {}) {
  const context = await brskalnik.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ...moznosti });
  await cdnPredpomnilnik(context);
  const stran = await context.newPage();
  const napake = [];
  stran.on('console', (m) => { if (m.type() === 'error') napake.push('console: ' + m.text()); });
  stran.on('pageerror', (e) => napake.push('pageerror: ' + e.message));
  return { context, stran, napake };
}

module.exports = { zagon, novaStran };
