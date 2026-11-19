const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { zagon, novaStran } = require('./pomoc');

let o;
before(async () => { o = await zagon(); });
after(async () => { await o.zapri(); });

const pocakaj = (stran, sel, dodatno = true) => stran.waitForFunction(([s, d]) => document.querySelector(s)?.dataset.stanje === 'pripravljeno' && (d === true || eval(d)), [sel, dodatno], { timeout: 45000 });

test('vsi trije vsebniki dosežejo pripravljeno', async () => {
  const { context, stran, napake } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  for (const m of ['veliki-predal', 'hladilnik', 'notranji-predal']) {
    const sel = '.pogled-3d[data-model$="' + m + '.glb"]';
    await stran.locator(sel).scrollIntoViewIfNeeded();
    await pocakaj(stran, sel);
  }
  assert.deepEqual(napake, []);
  await context.close();
});

async function odpriPredal() {
  const r = await novaStran(o.brskalnik);
  await r.stran.goto(o.url + '/');
  await r.stran.locator('#predal').scrollIntoViewIfNeeded();
  await r.stran.waitForFunction(() => document.querySelector('#predal .pogled-3d')?.dataset.stanje === 'pripravljeno' && window.__predal, null, { timeout: 45000 });
  return r;
}

test('izvlek premakne predal za 0,9 m proti prtljaznim vratom, vodili ostaneta', async () => {
  const { context, stran, napake } = await odpriPredal();
  const meri = () => stran.evaluate(() => {
    const p = window.__pogledi.get(document.querySelector('#predal .pogled-3d'));
    p.koren.updateMatrixWorld(true);
    const B = window.__predal.Box3;
    const z = (o) => new B().setFromObject(o).min.z;
    const vodili = [...p.koren.children, ...p.scena.children].flatMap((c) => c.userData.vodilo ? [c] : []);
    return { dno: z(p.deli.get('root/Dno 10mm')), vodila: vodili.map(z), n: vodili.length };
  });
  const a = await meri();
  assert.equal(a.n, 2);
  assert.equal(await stran.locator('#predal button[data-akcija="izvlek"]').getAttribute('aria-pressed'), 'false');
  await stran.locator('#predal button[data-akcija="izvlek"]').click();
  await stran.waitForFunction(() => window.__predal.stanje().izvlek === true);
  await stran.waitForTimeout(1300);
  const b = await meri();
  assert.ok(Math.abs(b.dno - a.dno - 0.9) < 0.01, a.dno + ' -> ' + b.dno);
  assert.deepEqual(b.vodila, a.vodila);
  assert.equal(await stran.locator('#predal button[data-akcija="izvlek"]').getAttribute('aria-pressed'), 'true');
  // vodilo 1,9 x 101,6 x 7,6 cm
  const mere = await stran.evaluate(() => {
    const p = window.__pogledi.get(document.querySelector('#predal .pogled-3d'));
    const v = [...p.koren.children, ...p.scena.children].find((c) => c.userData.vodilo);
    return new window.__predal.Box3().setFromObject(v).getSize(new (p.koren.position.constructor)()).toArray();
  });
  assert.ok(Math.abs(mere[0] - 0.019) < 0.001 && Math.abs(mere[1] - 0.076) < 0.001 && Math.abs(mere[2] - 1.016) < 0.001, JSON.stringify(mere));
  await stran.locator('#predal .pogled-3d').screenshot({ path: path.join(__dirname, 'posnetki', 'predal-izvlecen.png') });
  await stran.screenshot({ path: path.join(__dirname, 'posnetki', 'predal-izvlecen-stran.png') });
  assert.deepEqual(napake, []);
  await context.close();
});

test('hiter dvojni klik: koncno stanje skladno s preklopom', async () => {
  const { context, stran } = await odpriPredal();
  const g = stran.locator('#predal button[data-akcija="izvlek"]');
  const zMin = () => stran.evaluate(() => { const p = window.__pogledi.get(document.querySelector('#predal .pogled-3d')); p.koren.updateMatrixWorld(true); return new window.__predal.Box3().setFromObject(p.deli.get('root/Dno 10mm')).min.z; });
  const z0 = await zMin();
  await g.click(); await g.click(); await g.click();
  await stran.waitForTimeout(1500);
  const z = await zMin();
  assert.equal(await stran.evaluate(() => window.__predal.stanje().izvlek), true);
  assert.ok(Math.abs(z - z0 - 0.9) < 0.01, z0 + ' -> ' + z);
  await context.close();
});

test('hladilnik ima mesh REF hladilnik, temno siv; notranji predal REF prosoren', async () => {
  const { context, stran, napake } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  for (const m of ['hladilnik', 'notranji-predal']) {
    const sel = '.pogled-3d[data-model$="' + m + '.glb"]';
    await stran.locator(sel).scrollIntoViewIfNeeded();
    await pocakaj(stran, sel);
  }
  const r = await stran.evaluate(() => {
    const dobi = (m) => window.__pogledi.get(document.querySelector('.pogled-3d[data-model$="' + m + '.glb"]'));
    const h = dobi('hladilnik'), n = dobi('notranji-predal');
    const ref = [...h.deli].find(([k]) => k.startsWith('REF hladilnik'));
    const pl = [...n.deli].find(([k]) => k.startsWith('REF plasticni predal'));
    const vijak = [...n.deli].find(([k]) => k.startsWith('PRIKAZ vijaki'));
    return { ref: ref?.[1].material.color.getHexString(), plO: pl?.[1].material.opacity, plT: pl?.[1].material.transparent,
      vijak: vijak?.[1].material.metalness, les: h.deli.get('Pokrov 10/Body1').userData.material,
      rot: [...document.querySelectorAll('.kartica .pogled-3d')].map((e) => e.dataset.stanje) };
  });
  assert.equal(r.ref, '2b2f36');
  assert.equal(r.plO, 0.6); assert.equal(r.plT, true);
  assert.ok(r.vijak > 0.5);
  assert.equal(r.les, 'topol-mat');
  assert.deepEqual(napake, []);
  await context.close();
});
