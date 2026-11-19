const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { zagon, novaStran } = require('./pomoc');

let o;
before(async () => { o = await zagon(); });
after(async () => { await o.zapri(); });

async function odpriKuhinjo(opcije = {}) {
  const r = await novaStran(o.brskalnik, opcije);
  await r.stran.goto(o.url + '/');
  await r.stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await r.stran.waitForFunction(() => document.querySelector('#kuhinja .pogled-3d')?.dataset.stanje === 'pripravljeno' && window.__kuhinja, null, { timeout: 45000 });
  return r;
}

const VRATA = ['Vrata L spredaj (zunanji utor) 4+lam/Body1', 'Vrata L zadaj (notranji utor) 4+lam/Body1', 'Vrata D spredaj (zunanji utor) 4+lam/Body1', 'Vrata D zadaj (notranji utor) 4+lam/Body1'];
const PREDAL_PRIBOR = 'Predal pribor spredaj 7cm 6/Dno';
const PREDAL_KROZNIKI = 'Predal zadaj notranje 12.5cm 6/Dno';
const POLICKA = 'Policka spredaj 10/Body1';

test('privzeti materiali: pult hpl, vrata in celo topol-mat, breza breza', async () => {
  const { context, stran, napake } = await odpriKuhinjo();
  const r = await stran.evaluate((vrata) => {
    const d = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli;
    const m = (ime) => d.get(ime)?.userData.material;
    return { pult: m('Pult 12/Body1'), celo: m('Celo 10/Body1'), vrata: vrata.map(m), breza: m('Kos na vodilu spredaj D breza 12/Body1'),
      antracit: m('Celo 10/Body1'), refTovor: m('PRIKAZ palica pospravljena na celu/Body1') };
  }, VRATA);
  assert.equal(r.pult, 'hpl');
  assert.equal(r.celo, 'topol-mat');
  assert.deepEqual(r.vrata, ['topol-mat', 'topol-mat', 'topol-mat', 'topol-mat']);
  assert.equal(r.breza, 'breza');
  assert.equal(r.refTovor, 'topol-mat');
  assert.deepEqual(napake, []);
  await context.close();
});

test('izbira karbon za vrata spremeni samo 4 vrata (prek izbirnika), pult ostane hpl', async () => {
  const { context, stran, napake } = await odpriKuhinjo();
  await stran.locator('fieldset[data-izbirnik="vrata"] input[value="karbon"]').check({ force: true });
  const r = await stran.evaluate(() => {
    const d = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli;
    const karbon = [...d].filter(([, m]) => m.userData.material === 'karbon').map(([k]) => k);
    return { karbon, pult: d.get('Pult 12/Body1').userData.material, celo: d.get('Celo 10/Body1').userData.material,
      mat: d.get('Pult 12/Body1').material !== d.get('Celo 10/Body1').material };
  });
  assert.equal(r.karbon.length, 4, JSON.stringify(r.karbon));
  assert.ok(r.karbon.every((k) => k.startsWith('Vrata ')));
  assert.equal(r.pult, 'hpl');
  assert.equal(r.celo, 'topol-mat');
  assert.ok(r.mat);
  await stran.locator('fieldset[data-izbirnik="pult"] input[value="steklena-vlakna"]').check({ force: true });
  assert.equal(await stran.evaluate(() => window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli.get('Pult 12/Body1').userData.material), 'steklena-vlakna');
  assert.deepEqual(napake, []);
  await context.close();
});

test('izbirnika imata privzeto izbrana hpl / topol-mat in vidna imena', async () => {
  const { context, stran } = await odpriKuhinjo();
  assert.equal(await stran.locator('fieldset[data-izbirnik="pult"] input:checked').getAttribute('value'), 'hpl');
  assert.equal(await stran.locator('fieldset[data-izbirnik="vrata"] input:checked').getAttribute('value'), 'topol-mat');
  assert.equal(await stran.locator('fieldset[data-izbirnik="pult"] input').count(), 6);
  assert.equal(await stran.locator('fieldset[data-izbirnik="vrata"] input').count(), 5);
  assert.match(await stran.locator('fieldset[data-izbirnik="pult"]').innerText(), /Topol laminiran s karbonom/);
  await context.close();
});

test('preklopi(pribor): predal v -x za ~0,30 m, sprednja vrata L premaknjena', async () => {
  const { context, stran, napake } = await odpriKuhinjo();
  await stran.locator('button[data-akcija="pribor"]').click();
  await stran.waitForTimeout(2000);
  // SwiftShader riše počasi; dovolimo še zamudo zadnjega okvirja animacije
  await stran.waitForFunction(() => Math.abs(window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli.get('Predal pribor spredaj 7cm 6/Dno').position.x + 0.3) < 0.01, null, { timeout: 5000 });
  const r = await stran.evaluate(([p, v]) => {
    const d = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli;
    return { x: d.get(p).position.x, z: d.get(v).position.z, zadnja: d.get('Vrata L zadaj (notranji utor) 4+lam/Body1').position.z };
  }, [PREDAL_PRIBOR, VRATA[0]]);
  assert.ok(Math.abs(r.x + 0.30) < 0.01, 'x ' + r.x);
  assert.ok(Math.abs(r.z + 0.409) < 0.01, 'z ' + r.z);   // script +y -> GLB -z
  assert.ok(Math.abs(r.zadnja) < 0.005);
  assert.equal(await stran.locator('button[data-akcija="pribor"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(napake, []);
  await context.close();
});

test('trikratni hiter klik na Pribor: stanje true, predal na odprti legi (brez dvojnega premika)', async () => {
  const { context, stran, napake } = await odpriKuhinjo();
  const gumb = stran.locator('button[data-akcija="pribor"]');
  await gumb.click(); await gumb.click(); await gumb.click();
  await stran.waitForTimeout(3200);
  const r = await stran.evaluate(([p, v]) => {
    const d = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli;
    return { st: window.__kuhinja.stanje().pribor, x: d.get(p).position.x, z: d.get(v).position.z };
  }, [PREDAL_PRIBOR, VRATA[0]]);
  assert.equal(r.st, true);
  assert.ok(Math.abs(r.x + 0.30) < 0.01, 'x ' + r.x);
  assert.ok(Math.abs(r.z + 0.409) < 0.01, 'z ' + r.z);
  assert.equal(await gumb.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(napake, []);
  await context.close();
});

test('pribor nato krozniki: pribor se zapre, krozniki odprti, sodobna vrata na pravem mestu', async () => {
  const { context, stran } = await odpriKuhinjo();
  await stran.evaluate(async () => { await window.__kuhinja.preklopi('pribor'); await window.__kuhinja.preklopi('krozniki'); });
  const r = await stran.evaluate(([a, b, v0, v1]) => {
    const d = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli;
    return { a: d.get(a).position.x, b: d.get(b).position.x, f: d.get(v0).position.z, z: d.get(v1).position.z, st: window.__kuhinja.stanje() };
  }, [PREDAL_PRIBOR, PREDAL_KROZNIKI, VRATA[0], VRATA[1]]);
  assert.ok(Math.abs(r.a) < 0.005, 'pribor ' + r.a);
  assert.ok(Math.abs(r.b + 0.30) < 0.01, 'krozniki ' + r.b);
  assert.ok(Math.abs(r.f) < 0.005, 'sprednja vrata ' + r.f);
  assert.ok(Math.abs(r.z - 0.409) < 0.01, 'zadnja vrata ' + r.z);  // script -y -> GLB +z
  assert.equal(r.st.pribor, false); assert.equal(r.st.krozniki, true);
  await context.close();
});

test('izvlek premakne celotno kuhinjo za 0,6 m proti prtljaznim vratom', async () => {
  const { context, stran } = await odpriKuhinjo();
  const z0 = await stran.evaluate(() => { const p = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')); return p.koren.position.z; });
  await stran.evaluate(() => window.__kuhinja.preklopi('izvlek'));
  const z1 = await stran.evaluate(() => window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).koren.position.z);
  assert.ok(Math.abs(z1 - z0 - 0.6) < 0.01, z0 + ' -> ' + z1);
  await context.close();
});

test('polička je privzeto zložena (visi pred čelom), palica pospravljena vidna; dvakratni preklop vrne rotacijo', async () => {
  const { context, stran, napake } = await odpriKuhinjo();
  const zacetek = await stran.evaluate((ime) => {
    const p = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d'));
    const m = p.deli.get(ime);
    p.koren.updateMatrixWorld(true);
    const B = window.__kuhinja.Box3;
    const box = new B().setFromObject(m);
    return { q: m.getWorldQuaternion(new m.quaternion.constructor()).toArray(), minY: box.min.y, maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z,
      uporaba: p.deli.get('Palica policke (snemljiva) 12/Body1').visible, pospravljena: p.deli.get('PRIKAZ palica pospravljena na celu/Body1').visible };
  }, POLICKA);
  assert.ok(zacetek.maxZ <= 0.02 && zacetek.minZ >= -0.003, 'z ' + zacetek.minZ + '..' + zacetek.maxZ);   // pred celom (script y -1..0)
  assert.ok(zacetek.minY > 0.12 && zacetek.maxY < 0.46, 'y ' + zacetek.minY + '..' + zacetek.maxY);       // visi navzdol (script z 15..45)
  assert.equal(zacetek.uporaba, false);
  assert.equal(zacetek.pospravljena, true);
  await stran.evaluate(() => window.__kuhinja.preklopi('policka'));
  const odprta = await stran.evaluate((ime) => {
    const p = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d'));
    const box = new window.__kuhinja.Box3().setFromObject(p.deli.get(ime));
    return { minY: box.min.y, maxY: box.max.y, maxZ: box.max.z, uporaba: p.deli.get('Palica policke (snemljiva) 12/Body1').visible, pospravljena: p.deli.get('PRIKAZ palica pospravljena na celu/Body1').visible };
  }, POLICKA);
  assert.ok(odprta.minY > 0.43 && odprta.maxY < 0.46, 'odprta y ' + odprta.minY);
  assert.ok(odprta.maxZ > 0.25, 'odprta z ' + odprta.maxZ);   // sega 30 cm pred celo (script y -31..-1)
  assert.equal(odprta.uporaba, true); assert.equal(odprta.pospravljena, false);
  await stran.evaluate(() => window.__kuhinja.preklopi('policka'));
  const konec = await stran.evaluate((ime) => {
    const m = window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')).deli.get(ime);
    return m.getWorldQuaternion(new m.quaternion.constructor()).toArray();
  }, POLICKA);
  const kot = 2 * Math.acos(Math.min(1, Math.abs(konec.reduce((s, v, i) => s + v * zacetek.q[i], 0))));
  assert.ok(kot < 0.01, 'kot ' + kot);
  assert.deepEqual(napake, []);
  await context.close();
});

test('neznana predpona: najdi vrne prazno in izpiše opozorilo', async () => {
  const { context, stran } = await odpriKuhinjo();
  const opozorila = [];
  stran.on('console', (m) => { if (m.type() === 'warning') opozorila.push(m.text()); });
  const n = await stran.evaluate(async () => {
    const { najdi } = await import('/js/deli-kuhinja.js');
    return najdi(window.__pogledi.get(document.querySelector('#kuhinja .pogled-3d')), ['Ne obstaja']).length;
  });
  assert.equal(n, 0);
  assert.ok(opozorila.some((t) => t.includes('Ne obstaja')), JSON.stringify(opozorila));
  await context.close();
});

test('posnetek zaslona: kuhinja odprta (namizje)', async () => {
  const { context, stran, napake } = await odpriKuhinjo();
  await stran.evaluate(async () => { await window.__kuhinja.preklopi('policka'); await window.__kuhinja.preklopi('pribor'); });
  await stran.waitForTimeout(300);
  const mapa = path.join(__dirname, 'posnetki');
  fs.mkdirSync(mapa, { recursive: true });
  await stran.locator('#kuhinja').screenshot({ path: path.join(mapa, 'kuhinja-odprta.png') });
  assert.deepEqual(napake, []);
  await context.close();
});
