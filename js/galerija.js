// Galerija: klik na sličico odpre <dialog> z veliko sliko; Esc, klik na ozadje ali gumb zapre.
const dialog = document.querySelector('dialog.galerija');
if (dialog) {
  const slika = dialog.querySelector('img');
  const podnapis = dialog.querySelector('.galerija-podnapis');
  for (const a of document.querySelectorAll('.galerija-mreza a')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const mala = a.querySelector('img');
      slika.src = a.getAttribute('href');
      slika.alt = mala.alt;
      podnapis.textContent = a.dataset.podnapis || '';
      dialog.showModal();
    });
  }
  // Klik zunaj slike (na ozadje dialoga) zapre.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { slika.removeAttribute('src'); });
}
