# Cali pohištvo – spletna stran: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statična predstavitvena stran (slovenščina) z interaktivnimi 3D modeli štirih sklopov pohištva za VW California T7, zgrajenimi iz avtorjevih Fusion 360 skript.

**Architecture:** Python pretvornik (`tools/fusion2glb/`) z nadomestnim modulom `adsk` požene nespremenjene Fusion skripte iz `andrazzz/cali-kuhinja` nad OpenCascade (build123d) in zapiše GLB (en mesh na telo, z imeni). Stran je navaden HTML/CSS/JS z Three.js iz CDN prek import map; animacije in materiali so v JS, vezani na imena delov.

**Tech Stack:** Python 3.13, build123d 0.13, trimesh, pytest · HTML/CSS/ES moduli, Three.js 0.170.0 (jsdelivr), Playwright (Chromium, predinstaliran) · GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-18-cali-spletna-stran-design.md`

## Global Constraints
- Brez koraka gradnje (ni npm/Vite za stran). Three.js: `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` + `.../examples/jsm/` prek `<script type="importmap">`.
- Skripte iz `cali-kuhinja/skripte/` se uporabijo **nespremenjene** (kuhinja v7, veliki predal v2, notranji predal v2, hladilnik v2).
- Enote: skripte v cm (z gor) → GLB v metrih, y gor (glTF). Pretvorba: (x, y, z)_cm → (x, z, −y)·0,01.
- Jezik strani: slovenščina. Brez logotipov/znamk VW. Brez osebnih podatkov (kontakt = nadomestno besedilo).
- Privzeti materiali: vsi topolovi deli `topol-mat`; pult `hpl`; brezovi kosi `breza`. Izbirnik pult: `hpl`, `vezana`, `topol-mat`, `topol-sijaj`, `steklena-vlakna`, `karbon`. Izbirnik vrata: zadnjih 5 (privzeto `topol-mat`).
- Predala kuhinje se odpirata samo na strani L (−x v koordinatah skripte), konstanta `STRAN_ODPIRANJA = -1` v `js/deli-kuhinja.js`.
- Velikost: vsi GLB skupaj < 8 MB; stran deluje na Pixel 7 (Playwright).
- Commit po vsaki nalogi na veji `ccr-3d7aa892-7e9gfr`, sporočila v slovenščini, z attribution vrsticami seje.

## Review Focus
1. Počasen telefon / več 3D pogledov naenkrat → modeli se naložijo leno (IntersectionObserver), ustavi se render zanka pogledov zunaj zaslona (test v Task 3).
2. Neuspešno nalaganje GLB (404, brez WebGL) → v pogledu sporočilo »3D ogled ni na voljo«, ostala stran deluje (test v Task 3).
3. Hiter večkraten klik na gumb animacije → animacija se ne podvoji, končno stanje je skladno s preklopom (test v Task 4).
4. Imena delov se v novi verziji skripte spremenijo → `deli-*.js` neznana imena preskoči z opozorilom v konzoli, pretvornik izpiše seznam imen (test v Task 4 + izpis v Task 1).
5. Ozek zaslon 360 px → brez vodoravnega drsenja, gumbi se prelomijo (test v Task 7).

---

### Task 1: Nadomestni `adsk` modul + GLB kuhinje

**Files:**
- Create: `tools/fusion2glb/adsk/__init__.py`, `tools/fusion2glb/adsk/core.py`, `tools/fusion2glb/adsk/fusion.py`
- Create: `tools/fusion2glb/generiraj.py`, `tools/fusion2glb/parametri.json`, `tools/fusion2glb/sync.sh`, `tools/fusion2glb/README.md`, `requirements.txt`
- Create: `assets/models/kuhinja.glb`, `assets/models/kuhinja-deli.json`
- Test: `tests/py/test_kuhinja.py`

**Interfaces:**
- Produces: `generiraj.py --vir <mapa skripte> --izhod assets/models [--sklop kuhinja|veliki-predal|notranji-predal|hladilnik]`. Funkcija `pozeni_skripto(pot: Path, parametri: dict[str, float], doc_ime: str) -> list[Del]`, kjer `Del = dataclass(komponenta: str, telo: str, videz: str | None, vidno: bool, oblika: build123d.Solid | Compound)`. `izvozi_glb(deli: list[Del], pot: Path) -> None`: en mesh na telo, ime mesha `"<komponenta>/<telo>"`, `mesh.userData.videz` (glTF `extras.videz`) = ime videza iz skripte; nevidna telesa (`isLightBulbOn = False`) se ne izvozijo. Ob izvozu zapiše `<sklop>-deli.json`: seznam `{ime, videz, bbox_cm:[[x0,y0,z0],[x1,y1,z1]]}`.
- `sync.sh [ciljna mapa]` naredi `git clone --depth 1 https://github.com/andrazzz/cali-kuhinja` (ali `git pull`) v `/tmp/cali-kuhinja` privzeto.
- Shim implementira (vse v cm): `adsk.core.Application.get()` (`documents` z enim dokumentom z imenom `DOC` iz skripte, `activeDocument`, `activeProduct`), `Point3D.create`, `Vector3D.create`, `Matrix3D.create` (+ `translation`, `setToRotation`, kar skripte kličejo), `OrientedBoundingBox3D.create`, `ValueInput.createByString`; `adsk.fusion.Design.cast`, `TemporaryBRepManager.get()` s `createBox`, `createCylinderOrCone`, `booleanOperation(target, tool, tip)` (spremeni `target` na mestu, vrne `True`), `copy`, `transform`; `BooleanTypes`; telo z `volume`, `lumps.count`; `userParameters.itemByName(n).value` (vrednost v cm), `.add`; `rootComponent` z `occurrences.addNewComponent`, `allOccurrences`, `bRepBodies.add(body, bf)`, `features.baseFeatures.add/item`, `startEdit/finishEdit/updateBody/sourceBodies`; `appearances.itemByName` (vrne objekt z `.name`), `addByCopy`, iteracija; `isLightBulbOn`, `opacity`, `appearance` setterji. Česar skripta ne kliče, se ne implementira.

- [ ] **Step 1: Write the failing test** `tests/py/test_kuhinja.py`:
```python
def test_kuhinja_deli_in_mere(kuhinja):           # fixture: pozeni_skripto(kuhinja-v7, parametri)
    komp = {d.komponenta for d in kuhinja}
    assert len(komp) == 35
    assert len(kuhinja) == 50
    (x0, y0, z0), (x1, y1, z1) = bbox_cm([d for d in kuhinja if not d.komponenta.startswith('PRIKAZ')])
    assert abs((x1 - x0) - 38.4) < 0.1 and abs((z1 - z0) - 45.0) < 0.6   # ohisje 38,4 x 84 x 45
    assert 'Pult 12' in komp and 'Celo 10' in komp
    assert sum(1 for d in kuhinja if d.komponenta.startswith('Vrata ')) == 4
def test_kuhinja_glb(tmp_path, kuhinja):          # izvozi, prebere s trimesh
    izvozi_glb(kuhinja, tmp_path / 'k.glb'); scena = trimesh.load(tmp_path / 'k.glb')
    assert 'Pult 12/Body1' in scena.geometry and (tmp_path / 'k.glb').stat().st_size < 3_000_000
```
(Dolžina po y je zaradi palice/ograjice > 84; preveri samo x in z. Fixture vir skript: env `CALI_VIR`, privzeto `/tmp/cali-kuhinja/skripte`; test se preskoči, če mape ni.)

- [ ] **Step 2:** `pip install -r requirements.txt && bash tools/fusion2glb/sync.sh && pytest tests/py -v` → FAIL (modul ne obstaja).
- [ ] **Step 3: Implement shim + `generiraj.py`.** Geometrija z build123d (`Box`, `Cylinder` z `Location`/`Plane` iz osi p0→p1, `fuse`/`cut`/`intersect`). Skripto naloži z `importlib` iz poti (s `sys.path` na shim), pokliče `main(False)`. Tesselacija `tolerance=0.02` cm, `angular_tolerance=0.3`; zapis GLB s trimesh (Scene z imenovanimi node-i), pretvorba osi po Global Constraints. `parametri.json`: ključ po sklopu, vrednosti v mm iz spec §6.2 in dokumentov stanja (`zob_predal` 18, notranji 17; veliki predal `predal_dolz` 1100, `predal_sir` 760, `stranica_vis` 80, `letev_vis` 80, `luknja_d` 12; hladilnik in notranji iz `docs/*-stanje-projekta.md`); shim pretvori mm → cm, `ValueInput` niz z enoto parsira. Manjkajoči parameter: skripta ga doda sama (`userParameters.add`), shim to podpira.
- [ ] **Step 4:** `pytest tests/py -v` → PASS. Nato `python tools/fusion2glb/generiraj.py --vir /tmp/cali-kuhinja/skripte --izhod assets/models --sklop kuhinja` ustvari `kuhinja.glb` + `kuhinja-deli.json`.
- [ ] **Step 5: Commit** (`tools/ tests/py requirements.txt assets/models/kuhinja*`).

### Task 2: Ostali trije sklopi

**Files:**
- Modify: `tools/fusion2glb/adsk/*.py` (kar dodatno potrebujejo skripte), `tools/fusion2glb/parametri.json`
- Create: `assets/models/{veliki-predal,notranji-predal,hladilnik}.glb` + `*-deli.json`
- Test: `tests/py/test_ostali.py`

**Interfaces:** Consumes Task 1 `pozeni_skripto`, `izvozi_glb`. Produces GLB-je z istimi pravili imen.

- [ ] **Step 1: Failing tests:**
```python
def test_veliki_predal(): d = pozeni('veliki-predal-v2'); assert len(d) == 12; assert mere(d) == approx((76, 110, 8), abs=0.1)
def test_hladilnik(): d = pozeni('hladilnik-v2'); assert {x.komponenta for x in d} >= {'Pokrov 10', 'REF hladilnik'}; assert len({x.komponenta for x in d}) == 7; assert mere(lesni(d)) == approx((67.0, 43.7, 53.5), abs=0.15)
def test_notranji(): d = pozeni('notranji-predal-v2'); assert any(x.komponenta == 'REF plasticni predal' for x in d); assert mere(lesni(d))[0] == approx(42.0, abs=0.15) and mere(lesni(d))[2] == approx(53.5, abs=0.6)
def test_velikost_vseh(): assert sum(p.stat().st_size for p in Path('assets/models').glob('*.glb')) < 8_000_000
```
(`mere` = dimenzije bbox (x, y, z) v cm; `lesni` = brez `REF`/`PRIKAZ vijaki`. Veliki predal ima telesa v root base featurju, ne v komponentah – shim jih vrne s `komponenta = 'root'`; zato `len(d)` šteje telesa. Notranji: vidna samo telesa z `isLightBulbOn` True.)
- [ ] **Step 2:** `pytest tests/py/test_ostali.py -v` → FAIL.
- [ ] **Step 3:** Dopolni shim po napakah skript; generiraj vse tri GLB.
- [ ] **Step 4:** `pytest tests/py -v` → vse PASS.
- [ ] **Step 5: Commit.**

### Task 3: Ogrodje strani + skupni 3D pregledovalnik + testno okolje

**Files:**
- Create: `index.html`, `css/style.css`, `js/main.js`, `js/viewer.js`, `.nojekyll`
- Create: `tests/e2e/package.json` (samo `playwright` je že nameščen globalno – uporabi `require('playwright')`), `tests/e2e/streznik.js` (statični strežnik na naključnem portu), `tests/e2e/stran.test.js`, `tests/e2e/zazeni.sh`
- Test: `tests/e2e/stran.test.js` (Node `node:test` + playwright)

**Interfaces:**
- Produces (`js/viewer.js`):
  - `export async function ustvariPogled(vsebnik: HTMLElement, { model: string, kamera?: {pozicija:[x,y,z], cilj:[x,y,z]}, avtoVrtenje?: boolean }) -> Pogled`
  - `Pogled = { scena: THREE.Scene, koren: THREE.Object3D, deli: Map<string, THREE.Mesh>, animiraj(obj: THREE.Object3D, {pozicija?: THREE.Vector3, rotacija?: THREE.Euler}, ms=1000) -> Promise<void>, nastaviMaterial(imena: string[], mat: THREE.Material) -> void, unici() -> void }`
  - `deli` ključ = ime mesha iz GLB (`"Pult 12/Body1"`); `animiraj` prekine prejšnjo animacijo istega objekta in nadaljuje iz trenutne lege (easeInOutCubic).
  - `export function lenoNalaganje(vsebnik, ustvari: () => Promise<Pogled>) -> void` – IntersectionObserver (rootMargin 200px); render zanka teče samo, ko je vsebnik viden.
  - Napaka (ni WebGL / GLB 404): vsebnik dobi `<p class="napaka-3d">3D ogled ni na voljo.</p>`, brez izjeme navzven.
  - Vsak vsebnik dobi `data-stanje="nalaganje"|"pripravljeno"|"napaka"` (za teste).
- `index.html`: sekcije z id `uvod`, `kuhinja`, `predal`, `ostalo`, `fotografije`, `kontakt`; navigacija s sidri; 3D vsebniki `div.pogled-3d[data-model="assets/models/<sklop>.glb"]`. Besedila kratka (spec §6.1), številke: kuhinja 38,4 × 84 × 45 cm, ~9,7 kg, 35 delov; predal 110 × 76 × 8 cm, ~4,9 kg; hladilnik 67 × 43,7 × 53,5 cm; notranji predal 42 × 63 × 53,5 cm.
- Osvetlitev: `RoomEnvironment` + `PMREMGenerator`, `ShadowMaterial` tla, `OrbitControls` z dušenjem, `toneMapping = ACESFilmic`, `pixelRatio = min(devicePixelRatio, 2)`.

- [ ] **Step 1: Failing e2e tests:** stran se naloži brez `console.error`/`pageerror`; po drsenju do `#kuhinja` ima `#kuhinja .pogled-3d` `data-stanje="pripravljeno"` v 15 s; canvas ni enobarven (vzorči `toDataURL` → vsaj 2 različni barvi); ob prestrezanju `**/kuhinja.glb` z 404 dobi vsebnik `data-stanje="napaka"` in besedilo »3D ogled ni na voljo«; pogled `#ostalo` pred drsenjem ni naložen (`data-stanje` ≠ `pripravljeno`).
- [ ] **Step 2:** `bash tests/e2e/zazeni.sh` → FAIL.
- [ ] **Step 3:** Implement. Chromium headless potrebuje `--use-gl=swiftshader` / `--enable-unsafe-swiftshader` za WebGL.
- [ ] **Step 4:** `bash tests/e2e/zazeni.sh` → PASS.
- [ ] **Step 5: Commit.**

### Task 4: Kuhinja – materiali, izbirnika, animacije

**Files:**
- Create: `js/materiali.js`, `js/deli-kuhinja.js`, `js/kuhinja.js`
- Modify: `index.html` (kontrolniki v `#kuhinja`), `css/style.css`, `js/main.js`
- Test: `tests/e2e/kuhinja.test.js`

**Interfaces:**
- Consumes: Task 3 `Pogled`, `ustvariPogled`, `lenoNalaganje`; `assets/models/kuhinja-deli.json` (imena).
- Produces:
  - `js/materiali.js`: `export const MATERIALI: Record<'vezana'|'topol-mat'|'topol-sijaj'|'steklena-vlakna'|'karbon'|'hpl'|'breza', {ime: string, ustvari: () => THREE.MeshPhysicalMaterial}>`; `ime` = slovensko ime za gumb (»Vezana plošča topol«, »Topol lakiran mat«, »Topol lakiran sijaj«, »Topol laminiran s steklenimi vlakni«, »Topol laminiran s karbonom«, »HPL«). Teksture proceduralno s Canvas 512×512 (letnice topola, sloji vezane na robu ni potrebno, karbon twill 2×2, steklena vlakna drobno tkanje + `clearcoat`), sijaj: `clearcoat 1, roughness 0.15`, mat: `roughness 0.7`. `export function materialZaVidez(videz: string|null) -> keyof MATERIALI` (`'Breza'`→`breza`, `'Pult HPL'`→`hpl`, ostalo→`topol-mat`).
  - `js/deli-kuhinja.js`: `export const STRAN_ODPIRANJA = -1`; `export const SKUPINE: Record<'izvlek'|'pribor'|'krozniki'|'vrataSpredaj'|'vrataZadaj'|'policka'|'palicaUporaba'|'palicaPospravljena'|'pult'|'vrata', string[]>` – seznami predpon imen komponent (npr. `pribor: ['Predal pribor', 'Letvice utor pribor']`, `vrataSpredaj: ['Vrata L spredaj']` po dejanskem `sn` iz skripte, `policka: ['Policka spredaj']`, `palicaUporaba: ['Palica policke']`, `palicaPospravljena: ['PRIKAZ palica pospravljena']`, `pult: ['Pult 12']`, `vrata: ['Vrata ']`). `export function najdi(pogled, predpone) -> THREE.Mesh[]` (neznana predpona → `console.warn`, prazno).
  - `js/kuhinja.js`: `export async function zazeniKuhinjo(vsebnik) -> {preklopi(akcija: 'izvlek'|'pribor'|'krozniki'|'vrata'|'policka'): Promise<void>, izberi(kaj: 'pult'|'vrata', material: string): void, stanje(): Record<string, boolean>}`; izpostavi `window.__kuhinja` za teste.
- Gibanja (cm v koordinatah skripte, pretvori po Global Constraints): `izvlek` y −60 (celotna kuhinja, ven proti prtljažnim vratom); `vrataSpredaj` premik y +40,9 (čez zadnja), `vrataZadaj` y −40,9; `pribor`/`krozniki` x `STRAN_ODPIRANJA`·30 (predal) – najprej odpre ustrezna vrata, potem predal; zapiranje obratno; `policka`: rotacija okoli osi tečaja (x-os, y 0, z 45) za kot, da pride v vodoravno lego (polička v skripti je narisana v legi uporabe – privzeto stanje JS jo zavrti v zloženo lego, `palicaUporaba` skrita, `palicaPospravljena` vidna; ob odprtju obratno). Trajanje 900 ms. Med animacijo ponoven klik preklopi cilj (Pogled.animiraj prekine).
- UI: gumbi `button[data-akcija]` z `aria-pressed`; izbirnika `fieldset[data-izbirnik="pult"|"vrata"]` z radio gumbi (krogec z vzorcem + ime), privzeto `hpl` / `topol-mat`.

- [ ] **Step 1: Failing tests:** po nalaganju ima `Pult 12/Body1` material `hpl`, vsa vrata `topol-mat`, `Celo 10` `topol-mat` (preveri prek `window.__kuhinja` / `userData.material`); izbira `karbon` za vrata spremeni samo 4 vrata, pult ostane `hpl`; `preklopi('pribor')` → po 2 s je predal pribor premaknjen v −x za ~0,30 m in sprednja vrata L premaknjena; trikratni hiter klik na gumb Pribor → po 3 s stanje `pribor === true` in predal na odprti legi (ne dvojni premik); `preklopi('policka')` dvakrat → polička nazaj na začetni rotaciji (±0,01 rad); v konzoli ni napak.
- [ ] **Step 2:** `bash tests/e2e/zazeni.sh` → FAIL.
- [ ] **Step 3:** Implement. Imena preberi iz `kuhinja-deli.json`, ne ugibaj.
- [ ] **Step 4:** testi PASS + posnetek zaslona `tests/e2e/posnetki/kuhinja-odprta.png` (namizje) za pregled.
- [ ] **Step 5: Commit.**

### Task 5: Veliki predal, hladilnik, notranji predal

**Files:**
- Create: `js/deli-predal.js`, `js/predal.js`, `js/ostalo.js`
- Modify: `index.html`, `css/style.css`, `js/main.js`
- Test: `tests/e2e/ostalo.test.js`

**Interfaces:** Consumes Task 3, Task 4 `MATERIALI`, `materialZaVidez`. Produces `zazeniPredal(vsebnik) -> {preklopi('izvlek'), stanje()}` (`window.__predal`), izvlek y −90 cm; vodili Vevor kot preprosta siva kvadra 1,9 × 101,6 × 7,6 cm po koordinatah iz `zadnji-predal-stanje-projekta.md` (x −1,9–0 in 76–77,9, z −0,5–7,1), mirujoči. `zazeniOstalo(vsebnik, model)` za hladilnik in notranji predal: samo vrtenje (`avtoVrtenje: true`), REF hladilnik temno siv (`#2b2f36`), REF plastični predal svetlo siv prosojen (`opacity 0.6`).

- [ ] **Step 1: Failing tests:** vsi trije vsebniki dosežejo `pripravljeno`; `__predal.preklopi('izvlek')` premakne predal za ~0,9 m, vodili ostaneta; v hladilniku obstaja mesh z imenom, ki se začne z `REF hladilnik`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit.**

### Task 6: Uvodni prizor kombija

**Files:**
- Create: `js/kombi.js`
- Modify: `index.html` (`#uvod`), `js/main.js`, `css/style.css`
- Test: `tests/e2e/uvod.test.js`

**Interfaces:** Consumes Task 3 (`ustvariPogled` brez `model`, nato doda GLB-ja kuhinje in predala z `GLTFLoader`), Task 4/5 materiali. Produces `zazeniUvod(vsebnik) -> {predvajaj(): Promise<void>}` (`window.__uvod`).
- Obris T7 zadaj (v cm, poenostavljeno, nizko-poligonsko, svetlo siv mat, brez znamk): notranja širina ~160, višina tal do strehe ~140, prikazan zadnji ~150 cm dolžine; stranske stene in streha s sredinskim izrezom (pogled noter), odprta dvižna vrata nagnjena ~75° nad odprtino; postelja (vezana plošča, ~ 155 × 115 × 2) na spodnjem robu ~55 cm. Veliki predal levo, kuhinja desno pod posteljo (gledano od zadaj), oba poravnana s prtljažno odprtino.
- Animacija: ob prvem prikazu po 600 ms se kuhinja izvleče (−60 cm), nato predal (−90 cm); gumb »Ponovi« jo zažene znova. Kamera od zadaj-zgoraj, rahlo poševno; uporabnik lahko vrti.

- [ ] **Step 1: Failing tests:** `#uvod .pogled-3d` doseže `pripravljeno`; po 4 s sta kuhinja in predal na izvlečenih legah; posnetek zaslona `posnetki/uvod.png`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit.**

### Task 7: Fotografije, kontakt, telefon, README

**Files:**
- Create: `assets/img/*.webp` (iz `cali-kuhinja/slike/*.jpg`, dolga stranica 1600 px + sličice 600 px, kakovost 80), `js/galerija.js`, `README.md` (prepiši)
- Modify: `index.html` (`#fotografije`, `#kontakt`), `css/style.css`
- Test: `tests/e2e/telefon.test.js`

**Interfaces:** `galerija.js`: klik na sličico odpre `<dialog>` z veliko sliko, Esc/klik zapre. Kontakt: nadomestno besedilo »Kontakt bo dodan kmalu.« + komentar v HTML, kam vpisati e-pošto. README: kaj je stran, lokalni zagon (`python3 -m http.server`), posodobitev modelov (`sync.sh` + `generiraj.py`), testi, objava na GitHub Pages.

- [ ] **Step 1: Failing tests** (Playwright `devices['Pixel 7']` in viewport 360×740): `document.documentElement.scrollWidth <= innerWidth`; vseh 5 slik prisotnih z `alt`; klik na sličico odpre dialog, Esc ga zapre; kuhinjski gumbi vidni in klikljivi na 360 px; posnetka `posnetki/telefon-vrh.png`, `posnetki/telefon-kuhinja.png`.
- [ ] **Step 2–4:** FAIL → implement → PASS (vsi e2e in py testi).
- [ ] **Step 5: Commit + push** na `ccr-3d7aa892-7e9gfr`.
