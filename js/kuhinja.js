// Kuhinja: materiali, izbirnika materialov in animirani gumbi.
import * as THREE from 'three';
import { ustvariPogled } from './viewer.js';
import { MATERIALI, materialZaVidez, predogled } from './materiali.js';
import { SKUPINE, STRAN_ODPIRANJA, izSkripte, najdi } from './deli-kuhinja.js';

const MS = 900;
const IZVLEK_CM = 60, VRATA_CM = 40.9, PREDAL_CM = 30;
const NAZIV_AKCIJ = ['izvlek', 'pribor', 'krozniki', 'vrata', 'policka'];

// Meshi iz CAD-a nimajo UV; naredimo škatlasto projekcijo (1 ponovitev teksture na 0,4 m).
function dodajUV(mesh) {
  const g = mesh.geometry;
  if (g.attributes.uv || !g.attributes.position || !g.attributes.normal) return;
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[2 * i] = u / 0.4; uv[2 * i + 1] = v / 0.4;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function napolniIzbirnik(fs, idji, privzeto, naIzbiro) {
  const ime = fs.dataset.izbirnik;
  for (const id of idji) {
    const oznaka = document.createElement('label');
    oznaka.className = 'material-moznost';
    const vhod = document.createElement('input');
    vhod.type = 'radio'; vhod.name = 'material-' + ime; vhod.value = id; vhod.checked = id === privzeto;
    const krogec = document.createElement('span');
    krogec.className = 'krogec'; krogec.setAttribute('aria-hidden', 'true');
    krogec.style.backgroundImage = 'url(' + predogled(id) + ')';
    const besedilo = document.createElement('span');
    besedilo.textContent = MATERIALI[id].ime;
    oznaka.append(vhod, krogec, besedilo);
    fs.append(oznaka);
    vhod.addEventListener('change', () => { if (vhod.checked) naIzbiro(id); });
  }
}

export async function zazeniKuhinjo(vsebnik) {
  const pogled = await ustvariPogled(vsebnik, { model: vsebnik.dataset.model });
  const razdelek = vsebnik.closest('section') || document;
  const gumbi = [...razdelek.querySelectorAll('button[data-akcija]')];
  const izbirnika = { pult: razdelek.querySelector('fieldset[data-izbirnik="pult"]'), vrata: razdelek.querySelector('fieldset[data-izbirnik="vrata"]') };

  // --- materiali ---
  const predpomnilnik = new Map();
  const dobiMaterial = (id) => { if (!predpomnilnik.has(id)) predpomnilnik.set(id, MATERIALI[id].ustvari()); return predpomnilnik.get(id); };
  function nastavi(meshi, id) {
    const m = dobiMaterial(id);
    for (const mesh of meshi) { mesh.material = m; mesh.userData.material = id; }
  }
  for (const mesh of pogled.deli.values()) { dodajUV(mesh); nastavi([mesh], materialZaVidez(mesh.userData.videz)); }

  function izberi(kaj, id) {
    if (!MATERIALI[id]) { console.warn('Kuhinja: neznan material "' + id + '"'); return; }
    if (kaj !== 'pult' && kaj !== 'vrata') { console.warn('Kuhinja: neznana izbira "' + kaj + '"'); return; }
    nastavi(najdi(pogled, SKUPINE[kaj]), id);
    const vhod = izbirnika[kaj]?.querySelector('input[value="' + id + '"]');
    if (vhod) vhod.checked = true;
  }

  if (izbirnika.pult) napolniIzbirnik(izbirnika.pult, ['hpl', 'vezana', 'topol-mat', 'topol-sijaj', 'steklena-vlakna', 'karbon'], 'hpl', (id) => izberi('pult', id));
  if (izbirnika.vrata) napolniIzbirnik(izbirnika.vrata, ['vezana', 'topol-mat', 'topol-sijaj', 'steklena-vlakna', 'karbon'], 'topol-mat', (id) => izberi('vrata', id));

  // --- gibanje ---
  const skupine = {
    pribor: najdi(pogled, SKUPINE.pribor), krozniki: najdi(pogled, SKUPINE.krozniki),
    vrataSpredaj: najdi(pogled, SKUPINE.vrataSpredaj), vrataZadaj: najdi(pogled, SKUPINE.vrataZadaj),
    policka: najdi(pogled, SKUPINE.policka),
    uporaba: najdi(pogled, SKUPINE.palicaUporaba), pospravljena: najdi(pogled, SKUPINE.palicaPospravljena),
  };
  const izhodisce = new Map();      // mesh -> začetna lega
  for (const m of [...skupine.pribor, ...skupine.krozniki, ...skupine.vrataSpredaj, ...skupine.vrataZadaj]) izhodisce.set(m, m.position.clone());
  const premik = (m, x, y) => izhodisce.get(m).clone().add(izSkripte(x, y, 0));
  const odprtoPredal = izSkripte(STRAN_ODPIRANJA * PREDAL_CM, 0, 0);
  const odprtoSpredaj = izSkripte(0, VRATA_CM, 0), odprtoZadaj = izSkripte(0, -VRATA_CM, 0);

  // Polička: tečaj (x-os) skozi y -1, z 45 (cm); mesh-e zavrtimo v vrtišču.
  const tecaj = izSkripte(0, -1, 45);
  const vrtisce = new THREE.Group();
  const stars = skupine.policka[0]?.parent || pogled.koren;
  vrtisce.position.copy(tecaj);
  stars.add(vrtisce);
  for (const m of skupine.policka) vrtisce.attach(m);
  const zlozena = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); // +90° okoli x: visi navzdol pred čelom
  const odprta = new THREE.Quaternion();
  vrtisce.quaternion.copy(zlozena);
  const pokaziPalici = (kaj) => {   // 'uporaba' | 'pospravljena' | 'nobena'
    for (const m of skupine.uporaba) m.visible = kaj === 'uporaba';
    for (const m of skupine.pospravljena) m.visible = kaj === 'pospravljena';
  };
  pokaziPalici('pospravljena');

  const zelja = { izvlek: false, vrata: false, pribor: false, krozniki: false, policka: false };
  const ukazano = new Map();        // objekt -> { kljuc, obljuba } zadnji ukazani cilj
  let zeton = 0;

  function pojdi(obj, cilj, kljuc, ms = MS) {
    const prej = ukazano.get(obj);
    if (prej && prej.kljuc === kljuc) return prej.obljuba;
    const lastnosti = cilj instanceof THREE.Quaternion ? { rotacija: new THREE.Euler().setFromQuaternion(cilj) } : { pozicija: cilj };
    const obljuba = pogled.animiraj(obj, lastnosti, ms);
    ukazano.set(obj, { kljuc, obljuba });
    return obljuba;
  }
  const pocakaj = (obljube) => Promise.all(obljube);

  async function uskladi() {
    const moj = ++zeton;
    const sprednjaOdprta = zelja.vrata || zelja.pribor;
    const zadnjaOdprta = zelja.krozniki;
    // izvlek in polička tečeta neodvisno
    const neodvisno = [];
    neodvisno.push(pojdi(pogled.koren, izSkripte(0, -IZVLEK_CM, 0).multiplyScalar(zelja.izvlek ? 1 : 0), 'izvlek:' + zelja.izvlek));
    const kljucPolicke = 'policka:' + zelja.policka;
    if (ukazano.get(vrtisce)?.kljuc !== kljucPolicke) pokaziPalici('nobena');
    neodvisno.push(pojdi(vrtisce, zelja.policka ? odprta : zlozena, kljucPolicke));

    // 1. predala, ki se morata zapreti
    const predaliZapri = [];
    if (!zelja.pribor) for (const m of skupine.pribor) predaliZapri.push(pojdi(m, premik(m, 0, 0), 'zaprt'));
    if (!zelja.krozniki) for (const m of skupine.krozniki) predaliZapri.push(pojdi(m, premik(m, 0, 0), 'zaprt'));
    await pocakaj(predaliZapri);
    if (moj !== zeton) return;
    // 2. vrata
    const vrata = [];
    for (const m of skupine.vrataSpredaj) vrata.push(pojdi(m, sprednjaOdprta ? izhodisce.get(m).clone().add(odprtoSpredaj) : izhodisce.get(m), 'vrata:' + sprednjaOdprta));
    for (const m of skupine.vrataZadaj) vrata.push(pojdi(m, zadnjaOdprta ? izhodisce.get(m).clone().add(odprtoZadaj) : izhodisce.get(m), 'vrata:' + zadnjaOdprta));
    await pocakaj(vrata);
    if (moj !== zeton) return;
    // 3. predala, ki se morata odpreti
    const predaliOdpri = [];
    if (zelja.pribor) for (const m of skupine.pribor) predaliOdpri.push(pojdi(m, izhodisce.get(m).clone().add(odprtoPredal), 'odprt'));
    if (zelja.krozniki) for (const m of skupine.krozniki) predaliOdpri.push(pojdi(m, izhodisce.get(m).clone().add(odprtoPredal), 'odprt'));
    await pocakaj(predaliOdpri);
    await pocakaj(neodvisno);
    if (moj === zeton) pokaziPalici(zelja.policka ? 'uporaba' : 'pospravljena');
  }

  function osvezi() {
    for (const g of gumbi) g.setAttribute('aria-pressed', String(!!zelja[g.dataset.akcija]));
  }

  function preklopi(akcija) {
    if (!NAZIV_AKCIJ.includes(akcija)) { console.warn('Kuhinja: neznana akcija "' + akcija + '"'); return Promise.resolve(); }
    zelja[akcija] = !zelja[akcija];
    // sprednji in zadnji predal si zapirata pot (vrata drsijo v isti utor): odprt je lahko le eden
    if (zelja[akcija] && akcija === 'pribor') zelja.krozniki = false;
    if (zelja[akcija] && akcija === 'krozniki') { zelja.pribor = false; zelja.vrata = false; }
    if (zelja[akcija] && akcija === 'vrata') zelja.krozniki = false;
    if (!zelja[akcija] && akcija === 'vrata') zelja.pribor = false;
    osvezi();
    return uskladi();
  }

  for (const g of gumbi) g.addEventListener('click', () => { preklopi(g.dataset.akcija); });
  osvezi();
  if (pogled.napaka) {
    for (const g of gumbi) g.disabled = true;
    for (const fs of Object.values(izbirnika)) if (fs) fs.disabled = true;
  }

  const api = { pogled, preklopi, izberi, stanje: () => ({ ...zelja }), Box3: THREE.Box3 };
  window.__kuhinja = api;
  return api;
}
