const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { zagon, novaStran } = require('./pomoc');

let o;
before(async () => { o = await zagon(); });
after(async () => { await o.zapri(); });

const STANJE_MS = 45000;
async function pocakajStanje(stran, izbirnik, stanje) {
  await stran.waitForFunction(([i, s]) => document.querySelector(i)?.dataset.stanje === s, [izbirnik, stanje], { timeout: STANJE_MS });
}

test('stran se naloži brez napak v konzoli in ima vse sekcije', async () => {
  const { context, stran, napake } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  for (const id of ['uvod', 'kuhinja', 'predal', 'ostalo', 'fotografije', 'kontakt']) {
    assert.equal(await stran.locator('section#' + id).count(), 1, 'manjka sekcija #' + id);
  }
  assert.equal(await stran.locator('html').getAttribute('lang'), 'sl');
  await stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await pocakajStanje(stran, '#kuhinja .pogled-3d', 'pripravljeno');
  assert.deepEqual(napake, []);
  await context.close();
});

test('pogled kuhinje se naloži po drsenju in canvas ni enobarven', async () => {
  const { context, stran } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  await stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await pocakajStanje(stran, '#kuhinja .pogled-3d', 'pripravljeno');
  const barve = await stran.evaluate(() => {
    const platno = document.querySelector('#kuhinja .pogled-3d canvas');
    const k = document.createElement('canvas'); k.width = platno.width; k.height = platno.height;
    const c = k.getContext('2d'); c.drawImage(platno, 0, 0);
    const p = c.getImageData(0, 0, k.width, k.height).data;
    const set = new Set();
    for (let i = 0; i < p.length; i += 4 * 97) set.add(p[i] + ',' + p[i + 1] + ',' + p[i + 2]);
    return set.size;
  });
  assert.ok(barve >= 2, 'canvas je enobarven (' + barve + ')');
  await context.close();
});

test('mesh imena iz GLB so ključi v deli, z userData.videz', async () => {
  const { context, stran } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  await stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await pocakajStanje(stran, '#kuhinja .pogled-3d', 'pripravljeno');
  const r = await stran.evaluate(() => {
    const p = window.__pogledi?.get(document.querySelector('#kuhinja .pogled-3d'));
    const m = p?.deli.get('Pult 12/Body1');
    return { stevilo: p?.deli.size, videz: m?.userData.videz };
  });
  assert.ok(r.stevilo >= 30, 'premalo delov: ' + r.stevilo);
  assert.ok(r.videz, 'manjka userData.videz');
  await context.close();
});

test('ob 404 za kuhinja.glb vsebnik dobi napako, ostala stran deluje', async () => {
  const { context, stran } = await novaStran(o.brskalnik);
  await stran.route('**/kuhinja.glb', (route) => route.fulfill({ status: 404, body: 'ni' }));
  await stran.goto(o.url + '/');
  await stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await pocakajStanje(stran, '#kuhinja .pogled-3d', 'napaka');
  assert.match(await stran.locator('#kuhinja .pogled-3d .napaka-3d').innerText(), /3D ogled ni na voljo/);
  assert.ok(await stran.locator('#kontakt').count());
  await context.close();
});

test('pogled #ostalo pred drsenjem ni naložen', async () => {
  const { context, stran } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  await stran.waitForTimeout(1500);
  const n = await stran.locator('#ostalo .pogled-3d').count();
  assert.ok(n >= 1);
  for (let i = 0; i < n; i++) {
    const s = await stran.locator('#ostalo .pogled-3d').nth(i).getAttribute('data-stanje');
    assert.notEqual(s, 'pripravljeno');
  }
  await context.close();
});

test('render zanka teče samo, ko je pogled viden', async () => {
  const { context, stran } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  await stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await pocakajStanje(stran, '#kuhinja .pogled-3d', 'pripravljeno');
  await stran.waitForFunction(() => document.querySelector('#kuhinja .pogled-3d').dataset.render === 'da');
  await stran.evaluate(() => window.scrollTo(0, 0));
  await stran.locator('#kontakt').scrollIntoViewIfNeeded();
  await stran.waitForFunction(() => document.querySelector('#kuhinja .pogled-3d').dataset.render === 'ne', null, { timeout: 10000 });
  await context.close();
});

test('na ozkem zaslonu (360 px) ni vodoravnega drsenja', async () => {
  const { context, stran } = await novaStran(o.brskalnik, { viewport: { width: 360, height: 740 }, isMobile: true });
  await stran.goto(o.url + '/');
  const w = await stran.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(w <= 360, 'scrollWidth ' + w);
  await context.close();
});

test('animiraj premakne objekt, prekinitev prejšnje animacije ju razreši', async () => {
  const { context, stran } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  await stran.locator('#predal').scrollIntoViewIfNeeded();
  await pocakajStanje(stran, '#predal .pogled-3d', 'pripravljeno');
  const r = await stran.evaluate(async () => {
    const p = window.__pogledi.get(document.querySelector('#predal .pogled-3d'));
    const V = p.koren.position.constructor;
    const a = p.animiraj(p.koren, { pozicija: new V(5, 0, 0) }, 2000);
    await new Promise((res) => setTimeout(res, 300));
    const b = p.animiraj(p.koren, { pozicija: new V(0, 0, 1) }, 200);
    await Promise.all([a, b]);
    return [p.koren.position.x, p.koren.position.z];
  });
  assert.ok(Math.abs(r[0]) < 1e-6 && Math.abs(r[1] - 1) < 1e-6, JSON.stringify(r));
  await context.close();
});
