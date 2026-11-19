// Skupni 3D pregledovalnik: Three.js (import map v index.html), leno nalaganje, ustavljanje render zanke zunaj zaslona.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const privzetiMaterial = () => new THREE.MeshStandardMaterial({ color: 0xd9b88a, roughness: 0.7, metalness: 0 });

function prikaziNapako(vsebnik, sporocilo) {
  vsebnik.dataset.stanje = 'napaka';
  vsebnik.dataset.render = 'ne';
  vsebnik.replaceChildren();
  const p = document.createElement('p');
  p.className = 'napaka-3d';
  p.textContent = sporocilo || '3D ogled ni na voljo.';
  vsebnik.append(p);
}

function prazenPogled() {
  return {
    scena: new THREE.Scene(), koren: new THREE.Group(), deli: new Map(), napaka: true,
    animiraj: () => Promise.resolve(), nastaviMaterial() {}, osvezi() {}, zagon() {}, ustavi() {}, unici() {},
  };
}

export async function ustvariPogled(vsebnik, { model, kamera, avtoVrtenje = false, sence = true, naZahtevo = false } = {}) {
  vsebnik.dataset.stanje = 'nalaganje';
  vsebnik.dataset.render = 'ne';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) {
    prikaziNapako(vsebnik);
    return prazenPogled();
  }
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = sence;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const platno = renderer.domElement;
    platno.setAttribute('role', 'img');
    platno.setAttribute('aria-label', vsebnik.dataset.opis || '3D pogled izdelka');
    vsebnik.replaceChildren(platno);

    const scena = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const koren = new THREE.Group();
    scena.add(koren);
    const deli = new Map();

    if (model) {
      const gltf = await new GLTFLoader().loadAsync(model);
      koren.add(gltf.scene);
      const mat = privzetiMaterial();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material = mat;
        o.castShadow = true;
        o.receiveShadow = true;
        // GLTFLoader očisti presledke in poševnice v imenu; izvirno ime je v userData.name.
        deli.set(o.userData.name || o.name, o);
      });
    }

    // Kamera: iz podane lege, iz smeri z samodejnim okvirjem (kamera.smer + dodatni okvir) ali samodejno iz okvirja modela.
    const okvir = new THREE.Box3().setFromObject(koren);
    const prazen = okvir.isEmpty();
    const sredina = prazen ? new THREE.Vector3(0, 0.3, 0) : okvir.getCenter(new THREE.Vector3());
    const velikost = prazen ? new THREE.Vector3(1, 1, 1) : okvir.getSize(new THREE.Vector3());
    const polmer = Math.max(velikost.length() / 2, 0.1);
    const kam = new THREE.PerspectiveCamera(35, 1, polmer / 50, polmer * 50);
    // Prileganje: najmanjša razdalja vzdolž smeri, pri kateri so vsa oglišča okvirja v kadru (z rezervo).
    let okvirKamere = null, smerKamere = null;
    if (kamera?.smer) {
      okvirKamere = okvir.clone();
      if (kamera.dodatniOkvir) okvirKamere.union(new THREE.Box3(new THREE.Vector3().fromArray(kamera.dodatniOkvir.min), new THREE.Vector3().fromArray(kamera.dodatniOkvir.max)));
      smerKamere = new THREE.Vector3().fromArray(kamera.smer).normalize();
    }
    function prileganje(aspekt) {
      kam.aspect = aspekt; kam.updateProjectionMatrix();
      const c = okvirKamere.getCenter(new THREE.Vector3());
      const kotki = [];
      for (const x of [okvirKamere.min.x, okvirKamere.max.x]) for (const y of [okvirKamere.min.y, okvirKamere.max.y]) for (const z of [okvirKamere.min.z, okvirKamere.max.z]) kotki.push(new THREE.Vector3(x, y, z));
      const vidno = (d) => {
        kam.position.copy(c).addScaledVector(smerKamere, d);
        kam.lookAt(c); kam.updateMatrixWorld(true);
        return kotki.every((k) => { const n = k.clone().project(kam); return Math.abs(n.x) <= 0.96 && Math.abs(n.y) <= 0.96; });
      };
      let lo = 0.05, hi = 50;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (vidno(mid)) hi = mid; else lo = mid; }
      vidno(hi);
      return c;
    }
    let cilj;
    if (okvirKamere) {
      cilj = prileganje(Math.max(vsebnik.clientWidth, 1) / Math.max(vsebnik.clientHeight, 1));
    } else if (kamera) {
      kam.position.fromArray(kamera.pozicija);
      cilj = new THREE.Vector3().fromArray(kamera.cilj);
    } else {
      const razdalja = (polmer / Math.sin(THREE.MathUtils.degToRad(kam.fov / 2))) * 0.95;
      kam.position.copy(sredina).addScaledVector(new THREE.Vector3(1, 0.7, 1.25).normalize(), razdalja);
      cilj = sredina;
    }
    kam.lookAt(cilj);

    // Luči in mehka senca na tleh.
    const sredinaS = okvirKamere ? okvirKamere.getCenter(new THREE.Vector3()) : sredina;
    const polmerS = okvirKamere ? Math.max(polmer, okvirKamere.getSize(new THREE.Vector3()).length() / 2) : polmer;
    const sonce = new THREE.DirectionalLight(0xffffff, 1.4);
    sonce.position.copy(sredinaS).add(new THREE.Vector3(polmerS, polmerS * 2.5, polmerS * 1.2));
    sonce.target.position.copy(sredinaS);
    sonce.castShadow = sence;
    sonce.shadow.mapSize.set(1024, 1024);
    Object.assign(sonce.shadow.camera, { left: -polmerS * 1.5, right: polmerS * 1.5, top: polmerS * 1.5, bottom: -polmerS * 1.5, near: 0.01, far: polmerS * 8 });
    sonce.shadow.radius = 4;
    sonce.shadow.bias = -0.0005;
    scena.add(sonce, sonce.target);
    if (!prazen) {
      const tla = new THREE.Mesh(new THREE.PlaneGeometry(polmerS * 12, polmerS * 12), new THREE.ShadowMaterial({ opacity: 0.22 }));
      tla.rotation.x = -Math.PI / 2;
      tla.position.set(sredinaS.x, okvir.min.y - 0.002, sredinaS.z);
      tla.receiveShadow = true;
      scena.add(tla);
    }

    const kontrole = new OrbitControls(kam, platno);
    kontrole.target.copy(cilj);
    kontrole.enableDamping = true;
    kontrole.dampingFactor = 0.08;
    kontrole.autoRotate = avtoVrtenje;
    kontrole.autoRotateSpeed = 1.2;
    // Miškino kolesce naj drsi po strani (ne zoomira); ščipanje na dotik ostane.
    if (window.matchMedia?.('(pointer: fine)').matches) kontrole.enableZoom = false;
    let uporabnikPremaknil = false;
    kontrole.addEventListener('start', () => { uporabnikPremaknil = true; });
    platno.style.touchAction = 'pan-y';   // navpično vlečenje drsi po strani, vodoravno vrti model
    kontrole.update();

    let umazano = true;
    const prilagodi = () => {
      const w = Math.max(vsebnik.clientWidth, 1), h = Math.max(vsebnik.clientHeight, 1);
      renderer.setSize(w, h, false);
      if (okvirKamere && !uporabnikPremaknil) {
        const c = prileganje(w / h);
        kontrole.target.copy(c);
        kontrole.update();
      }
      kam.aspect = w / h;
      kam.updateProjectionMatrix();
      umazano = true;
    };
    prilagodi();
    const ro = new ResizeObserver(() => { prilagodi(); if (!tece) narisi(); });
    ro.observe(vsebnik);

    // --- Animacije (easeInOutCubic, prekinitev prejšnje animacije istega objekta) ---
    const animacije = new Map();
    let animId = 0;
    const animTik = (t) => {
      for (const [obj, a] of [...animacije]) {
        const k = Math.min((t - a.zacetek) / a.ms, 1);
        const e = easeInOutCubic(k);
        if (a.pozicija) obj.position.lerpVectors(a.od.pozicija, a.pozicija, e);
        if (a.kvat) obj.quaternion.slerpQuaternions(a.od.kvat, a.kvat, e);
        umazano = true;
        obj.updateMatrixWorld(true);   // svetovne matrike takoj usklajene, ne šele ob naslednjem izrisu
        if (k >= 1) { animacije.delete(obj); a.resolve(); }
      }
      animId = animacije.size ? requestAnimationFrame(animTik) : 0;
    };
    function animiraj(obj, { pozicija, rotacija } = {}, ms = 1000) {
      const stara = animacije.get(obj);
      if (stara) { animacije.delete(obj); stara.resolve(); }
      return new Promise((resolve) => {
        animacije.set(obj, {
          resolve, ms: Math.max(ms, 1), zacetek: performance.now(),
          od: { pozicija: obj.position.clone(), kvat: obj.quaternion.clone() },
          pozicija: pozicija ? pozicija.clone() : null,
          kvat: rotacija ? new THREE.Quaternion().setFromEuler(rotacija) : null,
        });
        if (!animId) animId = requestAnimationFrame(animTik);
      });
    }

    function osvezi() { umazano = true; }

    function nastaviMaterial(imena, mat) {
      for (const ime of imena) {
        const m = deli.get(ime);
        if (m) m.material = mat; else console.warn('3D: neznan del "' + ime + '"');
      }
    }

    // --- Render zanka: teče samo, ko je vsebnik viden ---
    let tece = false, rafId = 0, unicen = false;
    // naZahtevo: izris samo, ko se je kaj spremenilo (animacija, kamera, velikost); sicer le prazni tiki.
    function narisi() {
      kontrole.update();
      renderer.render(scena, kam);
      umazano = false;
    }
    const zanka = () => {
      if (!tece) return;
      if (!naZahtevo) narisi();
      else if (kontrole.update() || umazano) { renderer.render(scena, kam); umazano = false; }
      rafId = requestAnimationFrame(zanka);
    };
    function zagon() {
      if (tece || unicen) return;
      tece = true; umazano = true; vsebnik.dataset.render = 'da';
      rafId = requestAnimationFrame(zanka);
    }
    function ustavi() {
      tece = false; vsebnik.dataset.render = 'ne';
      cancelAnimationFrame(rafId);
    }
    function unici() {
      unicen = true; ustavi();
      if (animId) cancelAnimationFrame(animId);
      for (const a of animacije.values()) a.resolve();
      animacije.clear();
      ro.disconnect(); kontrole.dispose();
      scena.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose();
      platno.remove();
    }

    narisi();
    vsebnik.dataset.stanje = 'pripravljeno';
    return { scena, koren, deli, kamera: kam, kontrole, animiraj, nastaviMaterial, osvezi, zagon, ustavi, unici };
  } catch (e) {
    console.warn('3D pogled ni uspel:', e);
    try { renderer.dispose(); } catch (_) { /* nič */ }
    prikaziNapako(vsebnik);
    return prazenPogled();
  }
}

// Ustvari pogled šele, ko je vsebnik blizu vidnega polja; zunaj zaslona ustavi render zanko.
// Na telefonu (< 800 px) teče naenkrat samo najbolj viden pogled (spec 6.3).
const vnosiPogledov = new Set();
const ozek = window.matchMedia('(max-width: 799px)');

function uskladiZanke() {
  const viden = [...vnosiPogledov].filter((v) => v.pogled && v.viden);
  const najboljsi = ozek.matches
    ? viden.reduce((a, b) => (!a || b.razmerje > a.razmerje ? b : a), null)
    : null;
  for (const v of vnosiPogledov) {
    if (!v.pogled) continue;
    if (v.viden && (!ozek.matches || v === najboljsi)) v.pogled.zagon?.(); else v.pogled.ustavi?.();
  }
}
ozek.addEventListener?.('change', uskladiZanke);

export function lenoNalaganje(vsebnik, ustvari, { odlog = 0 } = {}) {
  const v = { pogled: null, viden: false, razmerje: 0, casovnik: 0, neuspel: false };
  vnosiPogledov.add(v);
  let nalaganje = false;
  function zazeni() {
    nalaganje = true;
    Promise.resolve().then(ustvari).then((p) => { v.pogled = p || null; uskladiZanke(); })
      .catch(() => { v.neuspel = true; prikaziNapako(vsebnik); }).finally(() => { nalaganje = false; });
  }
  const io = new IntersectionObserver((vnosi) => {
    for (const e of vnosi) {
      v.viden = e.isIntersecting;
      v.razmerje = e.intersectionRatio;
      if (!v.viden) { clearTimeout(v.casovnik); v.casovnik = 0; }
      if (v.viden && !v.pogled && !v.neuspel && !nalaganje && !v.casovnik) {
        // odlog: pogled se ustvari šele, ko ostane viden (hitro drsenje mimo ga ne naloži)
        v.casovnik = setTimeout(() => { v.casovnik = 0; if (v.viden && !v.pogled && !v.neuspel && !nalaganje) zazeni(); }, odlog);
      }
    }
    uskladiZanke();
  }, { rootMargin: '200px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  io.observe(vsebnik);
}
