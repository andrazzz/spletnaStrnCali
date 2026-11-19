// Skupni pomočniki za sklope.
import * as THREE from 'three';

// Skripta (cm; z gor, y=0 spredaj) -> GLB (m; y gor): (x, y, z)cm -> (x, z, -y)*0,01.
export function izSkripte(x, y, z) {
  return new THREE.Vector3(x * 0.01, z * 0.01, -y * 0.01);
}

// Meshi iz CAD-a nimajo UV; naredimo škatlasto projekcijo (1 ponovitev teksture na 0,4 m).
export function dodajUV(mesh) {
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


// Materiali po videzu: les -> topol/breza, ostalo po izjemah (predpona imena -> () => Material).
import { MATERIALI, materialZaVidez } from './materiali.js';
export function dodeliMateriale(pogled, izjeme = {}) {
  const predpomnilnik = new Map();
  const dobi = (id) => { if (!predpomnilnik.has(id)) predpomnilnik.set(id, MATERIALI[id].ustvari()); return predpomnilnik.get(id); };
  for (const [ime, mesh] of pogled.deli) {
    dodajUV(mesh);
    const izjema = Object.keys(izjeme).find((p) => ime.startsWith(p));
    if (izjema) { mesh.material = izjeme[izjema](); mesh.userData.material = izjema; continue; }
    if (!mesh.userData.videz && ime.startsWith('PRIKAZ vijaki')) continue;
    const id = materialZaVidez(mesh.userData.videz);
    mesh.material = dobi(id); mesh.userData.material = id;
  }
}
