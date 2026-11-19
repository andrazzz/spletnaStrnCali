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
    animiraj: () => Promise.resolve(), nastaviMaterial() {}, zagon() {}, ustavi() {}, unici() {},
  };
}

export async function ustvariPogled(vsebnik, { model, kamera, avtoVrtenje = false } = {}) {
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
    renderer.shadowMap.enabled = true;
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

    // Kamera: iz podane lege ali samodejno iz okvirja modela.
    const okvir = new THREE.Box3().setFromObject(koren);
    const prazen = okvir.isEmpty();
    const sredina = prazen ? new THREE.Vector3(0, 0.3, 0) : okvir.getCenter(new THREE.Vector3());
    const velikost = prazen ? new THREE.Vector3(1, 1, 1) : okvir.getSize(new THREE.Vector3());
    const polmer = Math.max(velikost.length() / 2, 0.1);
    const kam = new THREE.PerspectiveCamera(35, 1, polmer / 50, polmer * 50);
    if (kamera) {
      kam.position.fromArray(kamera.pozicija);
    } else {
      const razdalja = (polmer / Math.sin(THREE.MathUtils.degToRad(kam.fov / 2))) * 0.95;
      kam.position.copy(sredina).addScaledVector(new THREE.Vector3(1, 0.7, 1.25).normalize(), razdalja);
    }
    const cilj = kamera ? new THREE.Vector3().fromArray(kamera.cilj) : sredina;
    kam.lookAt(cilj);

    // Luči in mehka senca na tleh.
    const sonce = new THREE.DirectionalLight(0xffffff, 1.4);
    sonce.position.copy(sredina).add(new THREE.Vector3(polmer, polmer * 2.5, polmer * 1.2));
    sonce.target.position.copy(sredina);
    sonce.castShadow = true;
    sonce.shadow.mapSize.set(1024, 1024);
    Object.assign(sonce.shadow.camera, { left: -polmer * 1.5, right: polmer * 1.5, top: polmer * 1.5, bottom: -polmer * 1.5, near: 0.01, far: polmer * 8 });
    sonce.shadow.radius = 4;
    sonce.shadow.bias = -0.0005;
    scena.add(sonce, sonce.target);
    if (!prazen) {
      const tla = new THREE.Mesh(new THREE.PlaneGeometry(polmer * 12, polmer * 12), new THREE.ShadowMaterial({ opacity: 0.22 }));
      tla.rotation.x = -Math.PI / 2;
      tla.position.set(sredina.x, okvir.min.y - 0.002, sredina.z);
      tla.receiveShadow = true;
      scena.add(tla);
    }

    const kontrole = new OrbitControls(kam, platno);
    kontrole.target.copy(cilj);
    kontrole.enableDamping = true;
    kontrole.dampingFactor = 0.08;
    kontrole.autoRotate = avtoVrtenje;
    kontrole.autoRotateSpeed = 1.2;
    kontrole.update();

    const prilagodi = () => {
      const w = Math.max(vsebnik.clientWidth, 1), h = Math.max(vsebnik.clientHeight, 1);
      renderer.setSize(w, h, false);
      kam.aspect = w / h;
      kam.updateProjectionMatrix();
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

    function nastaviMaterial(imena, mat) {
      for (const ime of imena) {
        const m = deli.get(ime);
        if (m) m.material = mat; else console.warn('3D: neznan del "' + ime + '"');
      }
    }

    // --- Render zanka: teče samo, ko je vsebnik viden ---
    let tece = false, rafId = 0, unicen = false;
    function narisi() {
      kontrole.update();
      renderer.render(scena, kam);
    }
    const zanka = () => { if (!tece) return; narisi(); rafId = requestAnimationFrame(zanka); };
    function zagon() {
      if (tece || unicen) return;
      tece = true; vsebnik.dataset.render = 'da';
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
    return { scena, koren, deli, kamera: kam, kontrole, animiraj, nastaviMaterial, zagon, ustavi, unici };
  } catch (e) {
    console.warn('3D pogled ni uspel:', e);
    try { renderer.dispose(); } catch (_) { /* nič */ }
    prikaziNapako(vsebnik);
    return prazenPogled();
  }
}

// Ustvari pogled šele, ko je vsebnik blizu vidnega polja; zunaj zaslona ustavi render zanko.
export function lenoNalaganje(vsebnik, ustvari) {
  let pogled = null, nalaganje = false, viden = false;
  const io = new IntersectionObserver((vnosi) => {
    for (const v of vnosi) {
      viden = v.isIntersecting;
      if (viden && !pogled && !nalaganje) {
        nalaganje = true;
        Promise.resolve().then(ustvari).then((p) => {
          pogled = p || null;
          if (pogled && viden) pogled.zagon?.();
        }).catch(() => prikaziNapako(vsebnik)).finally(() => { nalaganje = false; });
      } else if (pogled) {
        if (viden) pogled.zagon?.(); else pogled.ustavi?.();
      }
    }
  }, { rootMargin: '200px' });
  io.observe(vsebnik);
}
