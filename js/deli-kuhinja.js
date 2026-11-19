// Skupine delov kuhinje (predpone imen komponent iz kuhinja-deli.json) in preslikava koordinat.
import * as THREE from 'three';

// Predala se odpirata samo na strani L (-x v koordinatah skripte, proti sredini kombija).
export const STRAN_ODPIRANJA = -1;

export const SKUPINE = {
  izvlek: [''],                                    // celotna kuhinja
  pribor: ['Predal pribor spredaj'],               // letvice utorov ('Letvice utor pribor') so fiksne
  krozniki: ['Predal zadaj notranje'],             // letvice utorov ('Letvice utor zadaj') so fiksne
  vrataSpredaj: ['Vrata L spredaj'],
  vrataZadaj: ['Vrata L zadaj'],
  policka: ['Policka spredaj'],
  palicaUporaba: ['Palica policke'],
  palicaPospravljena: ['PRIKAZ palica pospravljena'],
  pult: ['Pult 12'],
  vrata: ['Vrata '],
};

// Skripta (cm; z gor, y=0 spredaj) -> GLB (m; y gor): (x, y, z)cm -> (x, z, -y)*0,01.
export function izSkripte(x, y, z) {
  return new THREE.Vector3(x * 0.01, z * 0.01, -y * 0.01);
}

// Najde mesh-e, katerih ime se začne z eno od predpon. Neznana predpona -> opozorilo.
export function najdi(pogled, predpone) {
  const rezultat = [];
  for (const p of predpone) {
    const najdeni = [];
    for (const [ime, mesh] of pogled.deli) if (ime.startsWith(p)) najdeni.push(mesh);
    if (!najdeni.length) console.warn('Kuhinja: ni delov s predpono "' + p + '"');
    for (const m of najdeni) if (!rezultat.includes(m)) rezultat.push(m);
  }
  return rezultat;
}
