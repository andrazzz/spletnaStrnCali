// Veliki predal: izvlek in mirujoči vodili Vevor (koordinate iz skripte, cm).
import { izSkripte } from './skupno.js';

export const IZVLEK_CM = 90;               // proti prtljažnim vratom (-y v skripti)
export const IZVLEK = izSkripte(0, -IZVLEK_CM, 0);
// Vodilo Vevor: 1,9 x 101,6 x 7,6 cm; x -1,9..0 in 76..77,9; y 0..101,6; z -0,5..7,1.
export const VODILI = [
  { x0: -1.9, x1: 0 }, { x0: 76, x1: 77.9 },
].map((v) => ({ ...v, y0: 0, y1: 101.6, z0: -0.5, z1: 7.1 }));
