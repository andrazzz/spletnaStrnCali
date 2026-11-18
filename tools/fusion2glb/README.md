# fusion2glb

Zažene avtorjeve **nespremenjene** Fusion 360 skripte (`cali-kuhinja/skripte`) zunaj Fusiona in izvozi GLB.
Skripta `import adsk.core, adsk.fusion` dobi nadomestni modul iz `adsk/` (geometrija: build123d / OpenCascade).

```bash
pip install -r requirements.txt
bash tools/fusion2glb/sync.sh                      # klonira skripte v /tmp/cali-kuhinja
python tools/fusion2glb/generiraj.py --vir /tmp/cali-kuhinja/skripte --izhod assets/models --sklop kuhinja
pytest tests/py -v                                 # CALI_VIR=<mapa skripte>, privzeto /tmp/cali-kuhinja/skripte
```

- Enote v skriptah: cm, z gor. GLB: metri, y gor, `(x, y, z)_cm -> (x, z, -y) * 0,01`.
- En mesh na telo, ime `"<komponenta>/<telo>"`, `extras.videz` = ime videza iz skripte (`extras.prosojnost` le, če < 1).
- Ob izvozu nastane `<sklop>-deli.json` (`ime`, `videz`, `bbox_cm`); generiraj.py izpiše tudi seznam imen delov.
- Parametri (mm) so v `parametri.json` po sklopih; manjkajoče parametre skripta doda sama.
- Shim implementira le API, ki ga skripte kličejo. Če nova verzija skripte javi `AttributeError`, dodaj metodo v `adsk/core.py` ali `adsk/fusion.py`.
