const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { zagon, novaStran } = require('./pomoc');

let o;
before(async () => { o = await zagon(); });
after(async () => { await o.zapri(); });

test('uvodni prizor: kuhinja in predal se izvlecejo, Ponovi ju zažene znova', async () => {
  const { context, stran, napake } = await novaStran(o.brskalnik);
  await stran.goto(o.url + '/');
  await stran.waitForFunction(() => document.querySelector('#uvod .pogled-3d')?.dataset.stanje === 'pripravljeno' && window.__uvod, null, { timeout: 45000 });
  const lege = () => stran.evaluate(() => window.__uvod.lege());
  const zacetek = await lege();
  assert.ok(Math.abs(zacetek.kuhinja) < 0.01 && Math.abs(zacetek.predal) < 0.01 || zacetek.kuhinja > 0, 'začetek');
  await stran.waitForTimeout(4500);
  const konec = await lege();
  assert.ok(Math.abs(konec.kuhinja - 0.6) < 0.01, 'kuhinja ' + konec.kuhinja);
  assert.ok(Math.abs(konec.predal - 0.9) < 0.01, 'predal ' + konec.predal);
  assert.equal(await stran.evaluate(() => window.__uvod.stanje().konec), true);
  const ob = await stran.evaluate(() => ({ ...window.__uvod.obseg(), odprtina: window.__uvod.odprtina }));
  const sr = (a) => (a[0] + a[1]) / 2;
  assert.ok(sr(ob.predal) < 0 && 0 < sr(ob.kuhinja), JSON.stringify(ob));
  for (const k of [ob.predal, ob.kuhinja]) assert.ok(k[0] >= ob.odprtina[0] + 2 && k[1] <= ob.odprtina[1] - 2, 'izven odprtine ' + JSON.stringify(ob));
  assert.ok(ob.predal[1] <= ob.kuhinja[0], 'predal in kuhinja se prekrivata ' + JSON.stringify(ob));
  await stran.locator('#uvod .pogled-3d').screenshot({ path: path.join(__dirname, 'posnetki', 'uvod.png') });
  // Ponovi: vse nazaj in znova ven
  await stran.locator('#uvod button[data-akcija="ponovi"]').click();
  await stran.waitForTimeout(300);
  const vmes = await lege();
  assert.ok(vmes.kuhinja < 0.6 - 0.001, 'zapira se ' + vmes.kuhinja);
  await stran.waitForTimeout(5500);
  const znova = await lege();
  assert.ok(Math.abs(znova.kuhinja - 0.6) < 0.01 && Math.abs(znova.predal - 0.9) < 0.01);
  assert.deepEqual(napake, []);
  await context.close();
});
