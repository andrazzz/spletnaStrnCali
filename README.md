# Cali pohištvo

Predstavitvena statična stran (slovensko) za pohištvo po meri v VW California T7: izvlečna kuhinja, veliki izvlečni predal, škatla za hladilnik in notranji predal. Modeli se prikažejo v 3D (Three.js prek CDN), brez koraka gradnje. Fotografije so v `assets/img/` (WebP, brez EXIF), kontakt je zaenkrat nadomestno besedilo (e-pošto vpišeš v `index.html`, v razdelek `#kontakt`).

## Lokalni zagon

```
python3 -m http.server 8000
```

Nato odpri http://localhost:8000.

## Posodobitev 3D modelov

GLB-je v `assets/models/` ustvari pretvornik iz Fusion skript projekta `cali-kuhinja`:

```
bash tools/fusion2glb/sync.sh                      # prenese skripte v /tmp/cali-kuhinja
pip install -r requirements.txt
python tools/fusion2glb/generiraj.py --vir /tmp/cali-kuhinja/skripte --izhod assets/models
```

Podrobnosti (sklopi, parametri, imena delov) so v `tools/fusion2glb/README.md`.

## Testi

```
CALI_VIR=/tmp/cali-kuhinja/skripte pytest tests/py   # pretvornik in GLB
bash tests/e2e/zazeni.sh                              # Playwright, namizje in telefon (~200 s)
```

E2E testi potrebujejo globalno nameščen `playwright` s Chromiumom; posnetki zaslona se shranijo v `tests/e2e/posnetki/`.

## Objava na GitHub Pages

Settings → Pages → Source: Deploy from a branch → branch `main`, mapa `/ (root)`. Datoteka `.nojekyll` je že v korenu.
