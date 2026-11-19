import { ustvariPogled, lenoNalaganje } from './viewer.js';
import { zazeniKuhinjo } from './kuhinja.js';
import { zazeniPredal } from './predal.js';
import { zazeniOstalo } from './ostalo.js';
import { zazeniUvod } from './kombi.js';

// Za teste in razhroščevanje: vsebnik -> pogled.
window.__pogledi = new Map();

const hero = document.querySelector('#uvod .pogled-3d');
if (hero) {
  lenoNalaganje(hero, async () => {
    const uvod = await zazeniUvod(hero);
    window.__pogledi.set(hero, uvod.pogled);
    return uvod.pogled;
  });
}

for (const vsebnik of document.querySelectorAll('.pogled-3d[data-model]')) {
  lenoNalaganje(vsebnik, async () => {
    if (vsebnik.closest('#kuhinja')) {
      const kuhinja = await zazeniKuhinjo(vsebnik);
      window.__pogledi.set(vsebnik, kuhinja.pogled);
      return kuhinja.pogled;
    }
    if (vsebnik.closest('#predal')) {
      const predal = await zazeniPredal(vsebnik);
      window.__pogledi.set(vsebnik, predal.pogled);
      return predal.pogled;
    }
    if (vsebnik.closest('#ostalo')) {
      const { pogled } = await zazeniOstalo(vsebnik, vsebnik.dataset.model);
      window.__pogledi.set(vsebnik, pogled);
      return pogled;
    }
    const pogled = await ustvariPogled(vsebnik, {
      model: vsebnik.dataset.model,
      avtoVrtenje: vsebnik.dataset.vrtenje === 'da',
    });
    window.__pogledi.set(vsebnik, pogled);
    return pogled;
  });
}

// Označi aktivno sidro v navigaciji.
const povezave = new Map([...document.querySelectorAll('.glava nav a')].map((a) => [a.getAttribute('href').slice(1), a]));
const io = new IntersectionObserver((vnosi) => {
  for (const v of vnosi) {
    const a = povezave.get(v.target.id);
    if (a) a.toggleAttribute('aria-current', v.isIntersecting);
  }
}, { rootMargin: '-45% 0px -50% 0px' });
for (const id of povezave.keys()) { const s = document.getElementById(id); if (s) io.observe(s); }
