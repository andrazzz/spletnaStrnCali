# Cali pohištvo – predstavitvena spletna stran (design)

Datum: 18. 11. 2026 · Repozitorij strani: `andrazzz/spletnaStrnCali` · Vir modelov: `andrazzz/cali-kuhinja`

## 1. Namen in zakaj
Avtor dela pohištvo po meri za kombi **VW California T7** (»Cali«): izvlečno kuhinjo, veliki izvlečni predal pod posteljo, škatlo za hladilnik in notranji (otroški) predal. Vse je parametrično modelirano s Fusion 360 Python skriptami.

Stran je **zdaj** osebna predstavitev za avtorja in bližnje: obiskovalec naj takoj razume, kaj je to, kje v kombiju stoji in kako deluje. **Kasneje** (ko bo izdelano in fotografirano) bo stran postala prodajna (prodaja 3D modela/načrtov ali izdelanega kompleta), zato mora biti zgrajena tako, da se razdelki z resničnimi fotografijami in ponudbo enostavno dodajo.

## 2. Cilji, ne-cilji, anti-cilji
**Cilji**
- Preprosta, jedrnata, ena dolga stran (scroll), slovenščina.
- Interaktivni 3D modeli vseh štirih sklopov, zgrajeni iz avtorjevih skript (pravi deli, prave mere).
- Kuhinja (najpomembnejša): vrtenje/zoom z miško ali prstom, animacije (izvlek iz kombija, odpiranje obeh predalov, drsenje vrat, dvig sprednje poličke), dva izbirnika materiala: **pult** in **drsna vrata**.
- Veliki izvlečni predal (drugi po pomembnosti): 3D, animacija izvleka.
- Hladilnik in notranji predal: manjša razdelka (3D brez ali z minimalno interakcijo).
- Uvodni prizor: poenostavljen **zadnji del kombija** (odprta prtljažna vrata, postelja), iz katerega se izvlečeta kuhinja in veliki predal.
- Razdelek s fotografijami (zdaj: obstoječe slike iz `cali-kuhinja/slike/`).
- Kontakt.

**Ne-cilji (zdaj)**
- Spletna trgovina, plačila, košarica, kontaktni obrazec, prijave.
- Natančen model avtomobila (samo obris zadnjega dela).
- Angleščina (pride s prodajo).
- Konfigurator mer (spreminjanje parametrov na strani).

**Anti-cilji** (stran bi bila neuspeh, tudi če tehnično deluje)
- Počasna ali neodzivna na telefonu (avtor in bližnji jo bodo gledali predvsem z Androida).
- Natrpana, »tehnična« stran, ki obiskovalca zasuje z merami in CNC podrobnostmi.
- 3D modeli, ki se ne ujemajo z avtorjevim dizajnom (izmišljene oblike namesto njegovih delov).

## 3. Omejitve
- Stran je statična (brez strežnika), gostovanje na **GitHub Pages**.
- Brez koraka gradnje (brez npm/Vite): urejati se mora dati tudi z Androida prek Claude Code.
- Fusion skripte (`adsk` API) zunaj Fusiona ne tečejo; modeli se morajo generirati brez Fusiona, iz **nespremenjenih** skript (ko avtor spremeni skripto ali parameter, se GLB ponovno zgenerira).
- Velikost: celotna stran z modeli naj bo po možnosti < ~10 MB, prvi prikaz < 3 s na povprečnem telefonu.

## 4. Pristopi (izbran A)
| | Pristop | Za | Proti |
|---|---|---|---|
| **A ✔** | Navaden HTML/CSS/JS, Three.js iz CDN (import map), GLB iz Python pretvornika | najpreprosteje, brez orodij, deluje povsod, popoln nadzor nad animacijami in materiali | malo manj udobno pri večji kodi |
| B | Vite + Three.js (npm) | hitrejši razvoj, stiskanje | korak gradnje, več lomljivih delov, težje z Androida |
| C | `<model-viewer>` | najmanj kode | animacije morajo biti vnaprej posnete, menjava materiala po delih okorna |

Izbran **A** (avtor, 18. 11.), ker je najpreprostejši in ustreza željenim animacijam in izbirnikom.

## 5. Kar je odločil avtor
- Tehnologija: HTML + CSS + JavaScript, **brez Clojure**, Three.js.
- Vsi štirje sklopi; kuhinja najpomembnejša, nato veliki predal.
- Uvodna slika/prizor zadnjega dela kombija s kuhinjo in predalom.
- Materiali (5): **vezana plošča topol**, **topol lakiran mat**, **topol lakiran sijaj**, **topol laminiran s steklenimi vlakni**, **topol laminiran s karbonom**.
- Izbirnik materiala posebej za **pult** in posebej za **drsna vrata**; vse ostalo ostane v enem materialu.
- Delo z ekipo agentov z različnimi modeli: analitik/načrt (Opus, glavna seja), koder (Sonnet), pregledovalec kode (Opus), tester (Sonnet).

## 6. Zasnova

### 6.1 Struktura strani (od zgoraj navzdol)
1. **Glava:** »Cali pohištvo« + sidra (Kuhinja, Predal, Ostalo, Fotografije, Kontakt).
2. **Uvod (hero):** 3D prizor obrisa zadnjega dela T7, kamera rahlo od zadaj-zgoraj; ob nalaganju/kliku se kuhinja (desno) in veliki predal (levo) izvlečeta. Kratek stavek: »Pohištvo po meri za VW California T7«.
3. **Kuhinja:** levo kratek opis (3–5 stavkov + nekaj ključnih številk: 38,4 × 84 × 45 cm, ~9,7 kg, 35 delov), desno 3D pregledovalnik. Gumbi: Izvleci, Predal pribor, Predal krožniki, Vrata, Polička. Dva izbirnika materiala (Pult, Drsna vrata), vsak s 5 krogci/vzorci + imenom.
4. **Veliki izvlečni predal:** enako postavljeno, gumb Izvleci, brez izbirnika (110 × 76 × 8 cm, ~4,9 kg).
5. **Škatla za hladilnik** in **notranji predal:** dve kartici drug ob drugem (na telefonu ena pod drugo), vsaka z manjšim 3D pogledom (vrtenje) in 2–3 stavki.
6. **Fotografije:** mreža obstoječih slik (postelja, hladilnik), klik poveča. Pripravljeno za dodajanje slik izdelanih kosov.
7. **Kontakt:** e-pošta (in morda telefon) – podatke določi avtor.

### 6.2 Pretvorba modelov (Python, v repozitoriju strani)
- Mapa `tools/fusion2glb/`: **nadomestni modul `adsk`** (`adsk.core`, `adsk.fusion`), ki implementira samo to, kar skripte uporabljajo: `TemporaryBRepManager` (`createBox` iz `OrientedBoundingBox3D`, `createCylinderOrCone`, `booleanOperation` Union/Difference/Intersection na mestu, `copy`, `transform` z `Matrix3D`), `Point3D`, `Vector3D`, `Matrix3D`, telesa z `volume`/`lumps`, `Design` z `userParameters` (`itemByName`, `add`, `.value` v cm), `rootComponent.occurrences.addNewComponent`, `allOccurrences`, `baseFeatures`, `bRepBodies.add`, `appearances.itemByName`. Geometrija prek odprtokodnega CAD jedra (OpenCascade prek `build123d` ali `cadquery-ocp`).
- Skripte iz `cali-kuhinja/skripte/` se uvozijo **nespremenjene** (najnovejše verzije: kuhinja v7, veliki predal v2, notranji predal v2, hladilnik v2), pokliče se `main(False)`; nadomestek zbere vse komponente/telesa z imeni in jih tesselira.
- Izhod: en GLB na sklop (`assets/models/kuhinja.glb`, `veliki-predal.glb`, `notranji-predal.glb`, `hladilnik.glb`), vsak del je svoj mesh z imenom komponente/telesa iz skripte; enote pretvorjene v metre, os z gor → y gor (glTF).
- Vrednosti parametrov iz `docs/povzetek-californija.md` in dokumentov stanja (stanje 17. 11.): t12 12, t10 10, t6 6, zrak_reze 0,2, zrak_glob 0,2, utor_glob 3, cep_dolz 35, zep_pult 6, rezkar_d 4, zob_predal 18 (notranji 17), magnet_d 8, magnet_h 3, ter parametri posameznih sklopov iz njihovih dokumentov stanja. Hranijo se v `tools/fusion2glb/parametri.json`.
- Skripta za zagon (`tools/fusion2glb/generiraj.py`) in kratka navodila v README. Pretvorba se ne izvaja na strani, GLB datoteke so commitane.
- REF telesa: večina (vodila, tovor) v skriptah ni – vodila Vevor se dodajo v Three.js kot preproste oblike po merah iz dokumentov. Skripti hladilnika in notranjega predala pa vsebujeta »REF hladilnik« in »REF plasticni predal«: ta gresta v GLB in se na strani prikažeta (temen hladilnik, siv plastični predal), ker obiskovalcu pokažeta namen. *(odločitev graditelja)*
- Vir skript: `tools/fusion2glb/sync.sh` prenese (`git clone --depth 1`) `andrazzz/cali-kuhinja` v začasno mapo; `generiraj.py` bere skripte od tam (pot kot argument). Skripte se ne kopirajo v repozitorij strani. Ponovna generacija je ročna (Claude Code seja: »posodobi modele«); brez GitHub Action. *(odločitev graditelja)*
- Prikazana stanja: notranji predal s skripto privzeto (`PRIKAZ_MIZICA = True`, dvignjena mizica); kuhinja: polička in palica v skripti obstajata v legi »v uporabi« + pospravljena palica; na strani je privzeto zaprto stanje (polička zložena, rotacija v JS, prikazana samo pospravljena palica), gumb Polička jo dvigne in pokaže palico v uporabi. *(odločitev graditelja)*
- **Rezervni načrt:** če nadomestek za katero skripto ne uspe, avtor iz Fusiona izvozi STEP, ki se pretvori v GLB z istimi imeni delov.

### 6.3 3D na strani
- Three.js (fiksna verzija iz cdnjs/jsdelivr prek import map), `GLTFLoader`, `OrbitControls`, preprosta okolijska osvetlitev (`RoomEnvironment`) + mehke sence pod modelom.
- En skupen modul pregledovalnika (`js/viewer.js`), ki ga uporabljajo vsi razdelki; modeli se nalagajo **leno** (ko razdelek pride v pogled), na telefonu največ en aktiven 3D pogled naenkrat.
- **Animacije** v JavaScriptu, po imenih delov iz skript: skupine delov (npr. predal pribor = dno + stene + letvice) se definirajo v `js/deli-kuhinja.js` (preslikava ime dela → skupina → gibanje). Gibanja:
  - izvlek kuhinje/predala: translacija po y za dolžino vodila (~100 cm za Vevor 100 cm, uporabi vidno smiselno vrednost),
  - predala kuhinje: odpiranje levo/desno (dokument: »odpirata se levo in desno«),
  - drsna vrata: zdrs vzdolž utora,
  - polička: rotacija okoli osi klavirskega tečaja + palica v legi »v uporabi« (koordinate v `Kuhinja-stanje-projekta.md`).
  - Gladko (easing, ~0,8–1,2 s), gumb deluje kot preklop (odpri/zapri).
- **Materiali:** 5 PBR materialov v `js/materiali.js`; teksture proceduralne (Canvas) ali majhne JPG/WebP (< 200 KB/kos):
  - vezana plošča topol: svetel topol, vidni robovi slojev,
  - lakiran mat: enobarven, nizek sijaj,
  - lakiran sijaj: enobarven, visok sijaj (odsev okolja),
  - laminat s steklenimi vlakni: rahlo prosojen/belkast sijaj z drobno teksturo tkanja na lesu,
  - laminat s karbonom: črna/temno siva tkana tekstura (twill), sijaj.
  - Izbirnik pult menja material samo mesha »Pult«, izbirnik vrata samo štirih drsnih vrat. Ostali topol deli: vezana topol. Brezovi kosi na vodilu: breza. Barvo laka (mat/sijaj) izbere graditelj (nevtralna, npr. antracit ali bela) – glej §8.
- **Kombi (uvod):** poenostavljen nizko-poligonski obris zadnjega dela T7 v Three.js (tla, stranice, streha, odprta dvižna prtljažna vrata, postelja na višini ~55 cm), brez logotipov in znamk; vanj postavljena kuhinja (desno) in veliki predal (levo) na pravih mestih.

### 6.4 Datoteke
```
index.html
css/style.css
js/main.js            (zagon, leno nalaganje razdelkov)
js/viewer.js          (skupni 3D pregledovalnik)
js/kombi.js           (uvodni prizor)
js/deli-kuhinja.js    (skupine delov in animacije kuhinje)
js/deli-predal.js     (veliki predal)
js/materiali.js
assets/models/*.glb
assets/img/*          (fotografije, stisnjene)
tools/fusion2glb/     (Python pretvornik + parametri + README)
tests/                (Playwright testi)
```

### 6.5 Testiranje
- Python: test, da vsaka skripta prek nadomestka ustvari pričakovano število delov (kuhinja 35 komponent / 50 teles, veliki predal 12 teles, hladilnik 6 delov, notranji predal po skripti) in da se zunanje mere ujemajo z dokumenti (kuhinja 38,4 × 84 × 45 cm, veliki predal 110 × 76 × 8 cm, hladilnik 67 × 43,7 × 53,5, notranji 42 × 63 × 53,5) ± 1 mm; prostornine približno ustrezajo težam iz dokumentov.
- Brskalnik (Playwright, Chromium): stran se naloži brez napak v konzoli; vsak 3D pogled se izriše (ni prazen); gumbi sprožijo animacijo; izbirnik zamenja material pravega dela; posnetki zaslona na namizni širini in v pogledu telefona (Pixel).

### 6.6 Potek dela z agenti
- Glavna seja (Opus): načrt, razdelitev nalog, odločitve, komunikacija z avtorjem.
- Za vsako nalogo načrta: **koder** (Sonnet) implementira → **pregledovalec** (Opus) pregleda kodo glede na načrt in pravilnost → popravki → **tester** (Sonnet) zažene teste in naredi posnetke zaslona. Majhne popravke naredi glavna seja sama.
- Delo na veji `ccr-3d7aa892-7e9gfr`, commit po vsaki nalogi. Objava: na koncu se avtorja vpraša za združitev v `main` in vklop GitHub Pages (iz `main`, mapa `/`); do takrat je »končano« = vsi testi zeleni na veji. *(odločitev graditelja)*

## 7. Prepuščeno graditelju
- Natančna vizualna podoba (pisava, barve, razmiki) – čisto, moderno, svetlo, z veliko praznega prostora; ustrezati mora lesu in kombiju.
- Izbira CAD knjižnice v Pythonu (build123d ali cadquery/OCP) in tesselacijska natančnost (ravnotežje velikost/kakovost).
- Postavitev kamere, osvetlitev, hitrosti animacij.
- Kako natančno sestaviti skupine delov za animacije (iz imen v skriptah).
- Besedila opisov (kratka, iz dokumentov v `cali-kuhinja/docs/`, brez CNC podrobnosti).

## 8. Odprta vprašanja (za avtorja)
- Kontaktni podatki (e-pošta, telefon?) za razdelek Kontakt.
- Barva laka za »lakiran mat« in »lakiran sijaj«.
