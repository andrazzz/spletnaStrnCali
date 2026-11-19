// Uvodni prizor: zadnji del kombija z odprtimi vrati; izvleče se kuhinja (desno) in veliki predal (levo).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ustvariPogled } from './viewer.js';
import { dodeliMateriale, izSkripte } from './skupno.js';
import { ustvariVodili } from './predal.js';
import { IZVLEK as IZVLEK_PREDALA } from './deli-predal.js';

const M = 0.01;                                   // cm -> m
const IZVLEK_KUHINJE = izSkripte(0, -60, 0);
const MS_KUHINJA = 1000, MS_PREDAL = 1100, ZAMIK_MS = 600;
const SKRITI_DELI_KUHINJE = ['Policka spredaj', 'Palica policke'];

// Poenostavljena lupina: tla, stranski steni, rob strehe, zadnja stebra, vrata prtljažnika. Brez znamk.
function zgradiLupino() {
  const skupina = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd4d6d9, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const temno = new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 0.9 });
  const steklo = new THREE.MeshStandardMaterial({ color: 0x5d6770, roughness: 0.25, metalness: 0.2 });
  // škatla v cm: sredina (x, višina, globina naprej od odprtine), mere (širina, višina, dolžina)
  const skatla = (m, sx, sy, sz, cx, cy, cz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx * M, sy * M, sz * M), m);
    mesh.position.copy(izSkripte(cx, cz, cy));
    mesh.castShadow = mesh.receiveShadow = true;
    skupina.add(mesh);
    return mesh;
  };
  const W = 160, V = 140, D = 150, T = 3;
  skatla(mat, W + 2 * T, T, D, 0, -T / 2, D / 2);                         // tla
  skatla(mat, T, V, D, -(W + T) / 2, V / 2, D / 2);                       // leva stena
  skatla(mat, T, V, D, (W + T) / 2, V / 2, D / 2);                        // desna stena
  skatla(mat, W + 2 * T, V, T, 0, V / 2, D + T / 2);                      // sprednja stena (v notranjosti)
  // streha: samo robni pasovi, sredina je izrezana
  skatla(mat, 22, T, D, -(W - 22) / 2, V + T / 2, D / 2);
  skatla(mat, 22, T, D, (W - 22) / 2, V + T / 2, D / 2);
  skatla(mat, W, T, 14, 0, V + T / 2, D - 7);
  skatla(mat, W, T, 14, 0, V + T / 2, 7);                                  // zgornji prag odprtine
  // stebra odprtine
  skatla(mat, 10, V, 8, -(W - 10) / 2, V / 2, 0);
  skatla(mat, 10, V, 8, (W - 10) / 2, V / 2, 0);
  // postelja (vezana plošča 155 x 115 x 2 na ~55 cm), pregrada med predalom in kuhinjo
  const vezana = new THREE.MeshStandardMaterial({ color: 0xcfa874, roughness: 0.75 });
  skatla(vezana, 155, 2, 115, 0, 56, 57.5);
  skatla(temno, 2, 54, 100, 3.5, 27, 50);
  // dvižna vrata: tečaj na zgornjem robu odprtine, nagnjena 75° nad vodoravnico
  const tecaj = new THREE.Group();
  tecaj.position.copy(izSkripte(0, -2, V + T));
  const plosca = new THREE.Group();
  const lista = new THREE.Mesh(new THREE.BoxGeometry(W * M, 70 * M, 3 * M), mat);
  const okno = new THREE.Mesh(new THREE.BoxGeometry((W - 30) * M, 28 * M, 3.4 * M), steklo);
  okno.position.y = 35 * M;
  lista.position.y = -35 * M; okno.position.y = -35 * M;
  lista.castShadow = true;
  plosca.add(lista, okno);
  tecaj.add(plosca);
  // plošča visi navzdol (−y); zavrtimo jo okoli x tako, da kaže navzgor in rahlo nazaj (proti +z)
  tecaj.rotation.x = -(Math.PI - THREE.MathUtils.degToRad(15));
  skupina.add(tecaj);
  return skupina;
}

async function naloziSklop(url, izjeme) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const deli = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    deli.set(o.userData.name || o.name, o);
  });
  const skupina = new THREE.Group();
  skupina.add(gltf.scene);
  dodeliMateriale({ deli });
  return { skupina, deli };
}

export async function zazeniUvod(vsebnik) {
  const pogled = await ustvariPogled(vsebnik, {
    kamera: { pozicija: [1.9, 2.6, 3.4], cilj: [0, 0.75, -0.45] },
  });
  const razdelek = vsebnik.closest('section') || document;
  const gumbi = [...razdelek.querySelectorAll('button[data-akcija="ponovi"]')];
  let predvajanje = 0, konec = false;
  let kuhinja = null, predal = null;

  if (!pogled.napaka) {
    try {
      pogled.koren.add(zgradiLupino());
      const [k, p] = await Promise.all([
        naloziSklop('assets/models/kuhinja.glb'), naloziSklop('assets/models/veliki-predal.glb'),
      ]);
      for (const [ime, mesh] of k.deli) if (SKRITI_DELI_KUHINJE.some((s) => ime.startsWith(s))) mesh.visible = false;
      // kuhinja desno: sredina odprtine 39 cm na x ~ 24,5 cm, tla + 0,5 cm
      kuhinja = k.skupina; kuhinja.userData.zacetek = izSkripte(24.5, 0, 0.5);
      // predal levo: rob vodila pri x = -77 cm (vodila segajo 1,9 cm izven predala)
      predal = p.skupina; predal.userData.zacetek = izSkripte(-75.1, 0, 0.5);
      for (const s of [kuhinja, predal]) { s.position.copy(s.userData.zacetek); pogled.koren.add(s); }
      const vodili = new THREE.Group();
      vodili.position.copy(predal.userData.zacetek);
      for (const v of ustvariVodili()) vodili.add(v);
      pogled.koren.add(vodili);
    } catch (e) {
      console.warn('Uvod: nalaganje modelov ni uspelo', e);
      throw e;
    }
  }

  const odmik = (s, vektor) => s.userData.zacetek.clone().add(vektor);
  const cakaj = (ms) => new Promise((r) => setTimeout(r, ms));

  async function predvajaj() {
    if (!kuhinja) return;
    const moj = ++predvajanje;
    konec = false;
    for (const g of gumbi) g.disabled = true;
    // najprej nazaj v zaprto lego, nato kuhinja, nato predal
    await Promise.all([
      pogled.animiraj(kuhinja, { pozicija: kuhinja.userData.zacetek }, 500),
      pogled.animiraj(predal, { pozicija: predal.userData.zacetek }, 500),
    ]);
    if (moj !== predvajanje) return;
    await cakaj(ZAMIK_MS);
    if (moj !== predvajanje) return;
    await pogled.animiraj(kuhinja, { pozicija: odmik(kuhinja, IZVLEK_KUHINJE) }, MS_KUHINJA);
    if (moj !== predvajanje) return;
    await pogled.animiraj(predal, { pozicija: odmik(predal, IZVLEK_PREDALA) }, MS_PREDAL);
    if (moj !== predvajanje) return;
    konec = true;
    for (const g of gumbi) g.disabled = false;
  }
  for (const g of gumbi) g.addEventListener('click', () => { predvajaj(); });
  if (pogled.napaka) for (const g of gumbi) g.disabled = true;

  const lege = () => (kuhinja ? {
    kuhinja: kuhinja.position.z - kuhinja.userData.zacetek.z,
    predal: predal.position.z - predal.userData.zacetek.z,
  } : { kuhinja: 0, predal: 0 });
  const api = { pogled, predvajaj, lege, stanje: () => ({ konec, napaka: !!pogled.napaka }), Box3: THREE.Box3 };
  window.__uvod = api;
  if (!pogled.napaka) predvajaj();
  return api;
}
