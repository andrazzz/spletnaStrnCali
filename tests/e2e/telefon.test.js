const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { devices } = require('playwright');
const { zagon, novaStran } = require('./pomoc');

let o;
before(async () => { o = await zagon(); });
after(async () => { await o.zapri(); });

const { deviceScaleFactor, ...pixel } = devices['Pixel 7'];
const telefon = { ...pixel, viewport: { width: 360, height: 740 } };

test('telefon: brez vodoravnega drsenja, fotografije, galerija, gumbi kuhinje', async () => {
  const { context, stran, napake } = await novaStran(o.brskalnik, telefon);
  await stran.goto(o.url + '/');
  await stran.waitForTimeout(1500);
  await stran.screenshot({ path: path.join(__dirname, 'posnetki', 'telefon-vrh.png') });
  assert.ok(await stran.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'vodoravno drsenje');

  // Fotografije: 5 slik z alt, naložene
  const slike = stran.locator('#fotografije .galerija-mreza img');
  assert.equal(await slike.count(), 5);
  for (let i = 0; i < 5; i++) {
    const s = slike.nth(i);
    assert.ok((await s.getAttribute('alt') || '').length > 5, 'alt ' + i);
  }
  await stran.locator('#fotografije').scrollIntoViewIfNeeded();
  await stran.waitForFunction(() => [...document.querySelectorAll('#fotografije .galerija-mreza img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  assert.ok(await stran.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // Klik na sličico odpre dialog, Esc ga zapre
  const dialog = stran.locator('dialog.galerija');
  assert.equal(await dialog.evaluate((d) => d.open), false);
  await slike.nth(1).click();
  await stran.waitForFunction(() => document.querySelector('dialog.galerija')?.open);
  await stran.waitForFunction(() => { const i = document.querySelector('dialog.galerija img'); return i && i.complete && i.naturalWidth > 0; });
  assert.ok(/\.webp$/.test(await dialog.locator('img').getAttribute('src')));
  await stran.keyboard.press('Escape');
  await stran.waitForFunction(() => !document.querySelector('dialog.galerija').open);
  // klik na ozadje zapre
  await slike.nth(0).click();
  await stran.waitForFunction(() => document.querySelector('dialog.galerija').open);
  await stran.mouse.click(2, 2);
  await stran.waitForFunction(() => !document.querySelector('dialog.galerija').open);

  // Kontakt
  assert.match(await stran.locator('#kontakt').innerText(), /Kontakt bo dodan kmalu\./);

  // Kuhinja: gumbi vidni, klikljivi, canvas pan-y
  await stran.locator('#kuhinja .pogled-kuhinja').scrollIntoViewIfNeeded();
  await stran.waitForFunction(() => document.querySelector('#kuhinja .pogled-3d')?.dataset.stanje === 'pripravljeno' && window.__kuhinja, null, { timeout: 60000 });
  assert.equal(await stran.locator('#kuhinja canvas').evaluate((c) => getComputedStyle(c).touchAction), 'pan-y');
  const gumbi = stran.locator('#kuhinja .gumbi button');
  const n = await gumbi.count();
  assert.ok(n >= 5);
  for (let i = 0; i < n; i++) {
    const b = await gumbi.nth(i).boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= 360 && b.width > 40 && b.height >= 40, 'gumb ' + i + ' ' + JSON.stringify(b));
  }
  await stran.locator('#kuhinja button[data-akcija="pribor"]').scrollIntoViewIfNeeded();
  await stran.locator('#kuhinja button[data-akcija="pribor"]').tap();
  assert.equal(await stran.locator('#kuhinja button[data-akcija="pribor"]').getAttribute('aria-pressed'), 'true');
  await stran.waitForTimeout(1500);
  await stran.locator('#kuhinja').scrollIntoViewIfNeeded();
  await stran.screenshot({ path: path.join(__dirname, 'posnetki', 'telefon-kuhinja.png') });
  await stran.locator('#fotografije').scrollIntoViewIfNeeded();
  await stran.screenshot({ path: path.join(__dirname, 'posnetki', 'telefon-fotografije.png') });
  assert.ok(await stran.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(napake, []);
  await context.close();
});
