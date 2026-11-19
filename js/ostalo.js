// Hladilnik in notranji predal: samo samodejno vrtenje.
import * as THREE from 'three';
import { ustvariPogled } from './viewer.js';
import { dodeliMateriale } from './skupno.js';

const IZJEME = {
  'REF hladilnik': () => new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.1 }),
  'REF plasticni predal': () => new THREE.MeshPhysicalMaterial({ color: 0xd8dce0, roughness: 0.25, transparent: true, opacity: 0.6, depthWrite: false }),
  'PRIKAZ vijaki': () => new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.4, metalness: 0.9 }),
};

export async function zazeniOstalo(vsebnik, model) {
  const pogled = await ustvariPogled(vsebnik, { model, avtoVrtenje: true });
  dodeliMateriale(pogled, IZJEME);
  return { pogled };
}
