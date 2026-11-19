// Veliki predal: materiali, mirujoči vodili in gumb za izvlek.
import * as THREE from 'three';
import { ustvariPogled } from './viewer.js';
import { izSkripte, dodeliMateriale } from './skupno.js';
import { IZVLEK, VODILI } from './deli-predal.js';

const MS = 1100;

// Vodili Vevor kot mirujoči škatli (koordinate skripte -> GLB); uporabita ju tudi uvodni prizor.
export function ustvariVodili(seznam = VODILI) {
  const sivo = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.7, roughness: 0.45 });
  return seznam.map((v) => {
    const a = izSkripte(v.x0, v.y0, v.z0), b = izSkripte(v.x1, v.y1, v.z1);
    const velikost = new THREE.Vector3(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.z - a.z));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(velikost.x, velikost.y, velikost.z), sivo);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.vodilo = true;
    return mesh;
  });
}

export async function zazeniPredal(vsebnik) {
  const pogled = await ustvariPogled(vsebnik, {
    model: vsebnik.dataset.model,
    kamera: { pozicija: [2.3, 1.7, 2.4], cilj: [0.38, 0, -0.1] },
    naZahtevo: true,   // izris le ob premikih
  });
  const razdelek = vsebnik.closest('section') || document;
  const gumbi = [...razdelek.querySelectorAll('button[data-akcija]')];
  dodeliMateriale(pogled);

  // Premični del: vsi meshi predala. Vodili so ločeni in mirujoči.
  const gibljivo = new THREE.Group();
  pogled.koren.add(gibljivo);
  for (const m of pogled.deli.values()) gibljivo.attach(m);

  for (const mesh of ustvariVodili()) pogled.koren.add(mesh);

  let izvlecen = false;
  const osvezi = () => { for (const g of gumbi) g.setAttribute('aria-pressed', String(izvlecen)); };
  function preklopi(akcija) {
    if (akcija !== 'izvlek') { console.warn('Predal: neznana akcija "' + akcija + '"'); return Promise.resolve(); }
    izvlecen = !izvlecen;
    osvezi();
    // animiraj prekine prejšnjo animacijo in nadaljuje iz trenutne lege
    return pogled.animiraj(gibljivo, { pozicija: izvlecen ? IZVLEK.clone() : new THREE.Vector3() }, MS);
  }
  for (const g of gumbi) g.addEventListener('click', () => { preklopi(g.dataset.akcija); });
  osvezi();
  if (!pogled.napaka) for (const g of gumbi) g.disabled = false;   // v HTML onemogočeni do konca nalaganja

  const api = { pogled, preklopi, stanje: () => ({ izvlek: izvlecen }), Box3: THREE.Box3 };
  window.__predal = api;
  return api;
}
