// PBR materiali s proceduralnimi teksturami (Canvas), brez slikovnih datotek.
import * as THREE from 'three';

// Deterministični psevdonaključni generator, da so teksture ob vsakem nalaganju enake.
function nakljucje(seme) {
  let s = seme >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function platno(velikost) {
  const c = document.createElement('canvas');
  c.width = c.height = velikost;
  return [c, c.getContext('2d')];
}

// Letnice topola/breze: svetla osnova z valovitimi, blago temnejšimi žilami.
function narisiLes(ctx, v, osnova, zila, seme, jakost = 1) {
  const r = nakljucje(seme);
  ctx.fillStyle = osnova; ctx.fillRect(0, 0, v, v);
  const n = Math.round(v / 3);
  for (let i = 0; i < n; i++) {
    const y0 = r() * v, amp = 1 + r() * 4 * (v / 512), f = 0.004 + r() * 0.01, f0 = r() * 6.28;
    ctx.strokeStyle = zila;
    ctx.globalAlpha = (0.05 + r() * 0.14) * jakost;
    ctx.lineWidth = Math.max(0.5, (0.5 + r() * 1.6) * (v / 512));
    ctx.beginPath();
    for (let x = 0; x <= v; x += 8) {
      const y = y0 + Math.sin(x * f * 6.28 + f0) * amp * 4 + Math.sin(x * 0.02 + f0) * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function risiVezana(ctx, v) {
  narisiLes(ctx, v, '#d2ad6c', '#7a5426', 11, 1.2);
  // vidni sloji: tanke temnejše črte po celotni sliki
  const r = nakljucje(5);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#9a7840';
  for (let y = 0; y < v; y += v / 16) ctx.fillRect(0, y + r() * 2, v, Math.max(1, v / 256));
  ctx.globalAlpha = 1;
}

function risiTopol(ctx, v) { narisiLes(ctx, v, '#d9b676', '#80592a', 7, 0.9); }
function risiBreza(ctx, v) { narisiLes(ctx, v, '#d6b57a', '#7a5426', 23, 1.1); }

// Steklena vlakna: les z drobno, svetlo tkano mrežo.
function risiSteklo(ctx, v) {
  narisiLes(ctx, v, '#d9b676', '#80592a', 7, 0.8);
  const korak = Math.max(2, v / 128);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(0.5, korak / 4);
  for (let i = 0; i < v; i += korak) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, v); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(v, i); ctx.stroke();
  }
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, v, v);
  ctx.globalAlpha = 1;
}

// Karbon twill 2x2: diagonalni vzorec svetlih in temnih niti.
function risiKarbon(ctx, v) {
  const celic = 32, k = v / celic;
  ctx.fillStyle = '#16171a'; ctx.fillRect(0, 0, v, v);
  for (let j = 0; j < celic; j++) {
    for (let i = 0; i < celic; i++) {
      const vzorec = ((i + j) >> 1) & 1;           // 2x2 twill
      const g = ctx.createLinearGradient(i * k, j * k, vzorec ? i * k + k : i * k, vzorec ? j * k : j * k + k);
      g.addColorStop(0, vzorec ? '#3a3d44' : '#26282d');
      g.addColorStop(1, vzorec ? '#1c1d21' : '#111215');
      ctx.fillStyle = g;
      ctx.fillRect(i * k, j * k, k - 0.5, k - 0.5);
    }
  }
}

function risiHpl(ctx, v) {
  ctx.fillStyle = '#c9cbcd'; ctx.fillRect(0, 0, v, v);
  const r = nakljucje(3);
  for (let i = 0; i < v * 2; i++) {
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = r() > 0.5 ? '#ffffff' : '#808488';
    ctx.fillRect(r() * v, r() * v, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

const RISANJE = {
  'vezana': risiVezana, 'topol-mat': risiTopol, 'topol-sijaj': risiTopol,
  'steklena-vlakna': risiSteklo, 'karbon': risiKarbon, 'hpl': risiHpl, 'breza': risiBreza,
};

// Majhen predogled za krogce v izbirniku (data URL).
export function predogled(id, velikost = 40) {
  const [c, ctx] = platno(velikost);
  RISANJE[id](ctx, velikost);
  return c.toDataURL('image/png');
}

function tekstura(id, velikost = 512, ponovitve = 1) {
  const [c, ctx] = platno(velikost);
  RISANJE[id](ctx, velikost);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(ponovitve, ponovitve);
  return t;
}

const mat = (id, lastnosti) => () => new THREE.MeshPhysicalMaterial({ map: tekstura(id), metalness: 0, ...lastnosti });

export const MATERIALI = {
  'vezana': { ime: 'Vezana plošča topol', ustvari: mat('vezana', { roughness: 0.75 }) },
  'topol-mat': { ime: 'Topol lakiran mat', ustvari: mat('topol-mat', { roughness: 0.7 }) },
  'topol-sijaj': { ime: 'Topol lakiran sijaj', ustvari: mat('topol-sijaj', { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }) },
  'steklena-vlakna': { ime: 'Topol laminiran s steklenimi vlakni', ustvari: mat('steklena-vlakna', { roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) }) },
  'karbon': { ime: 'Topol laminiran s karbonom', ustvari: mat('karbon', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }) },
  'hpl': { ime: 'HPL', ustvari: mat('hpl', { roughness: 0.8 }) },
  'breza': { ime: 'Breza', ustvari: mat('breza', { roughness: 0.7 }) },
};

export function materialZaVidez(videz) {
  if (videz === 'Breza') return 'breza';
  if (videz === 'Pult HPL') return 'hpl';
  return 'topol-mat';
}
