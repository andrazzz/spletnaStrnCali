// Skupine delov kuhinje (predpone imen komponent iz kuhinja-deli.json) in preslikava koordinat.
import { izSkripte } from './skupno.js';

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

export { izSkripte };

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

// Mirujoči vodili Vevor pod kuhinjo (REF |x| 17,5-19,4, y 0-101,6, z -0,5-7,1; cm skripte), obe strani.
export const VODILI_KUHINJE = [
  { x0: -19.4, x1: -17.5 }, { x0: 17.5, x1: 19.4 },
].map((v) => ({ ...v, y0: 0, y1: 101.6, z0: -0.5, z1: 7.1 }));
