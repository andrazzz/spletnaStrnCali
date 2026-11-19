#!/usr/bin/env python3
"""Zažene avtorjeve Fusion 360 skripte zunaj Fusiona (nadomestni `adsk`) in izvozi GLB.

Uporaba:
  python tools/fusion2glb/generiraj.py --vir /tmp/cali-kuhinja/skripte --izhod assets/models --sklop kuhinja
Osi: skripte so v cm (z gor), GLB je v metrih, y gor: (x, y, z)_cm -> (x, z, -y) * 0,01.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.dont_write_bytecode = True  # ne piši __pycache__ ob skriptah v viru
MAPA = Path(__file__).resolve().parent
if str(MAPA) not in sys.path:
    sys.path.insert(0, str(MAPA))

import numpy as np  # noqa: E402
import trimesh  # noqa: E402
from build123d import Compound, Shape, Solid  # noqa: E402

# sklop -> predpona imena skripte; najdi_skripto vzame zadnjo po abecedi med ujemajocimi (npr. -v2-... pred -v3-...)
SKLOPI = {
    'kuhinja': 'kuhinja-v7',
    'veliki-predal': 'veliki-predal-v2',
    'notranji-predal': 'notranji-predal-v2',
    'hladilnik': 'hladilnik-v2',
}
TOLERANCA_CM = 0.02
KOTNA_TOLERANCA = 0.3
SMOOTH_KOT = np.radians(30)


@dataclass
class Del:
    komponenta: str
    telo: str
    videz: str | None
    vidno: bool
    oblika: Solid | Compound | Shape
    prosojnost: float = 1.0

    @property
    def ime(self) -> str:
        return '%s/%s' % (self.komponenta, self.telo)


def nalozi_parametre(sklop: str) -> dict[str, float]:
    return json.loads((MAPA / 'parametri.json').read_text(encoding='utf-8'))[sklop]


def doc_ime_iz_skripte(pot: Path) -> str:
    m = re.search(r"^DOC\s*=\s*'([^']*)'", pot.read_text(encoding='utf-8'), re.M)
    if not m:
        raise RuntimeError('V skripti %s ni konstante DOC' % pot)
    return m.group(1)


def pozeni_skripto(pot: Path, parametri: dict[str, float], doc_ime: str) -> list[Del]:
    """Zažene main(False) skripte. `parametri` so v mm, shim jih pretvori v cm."""
    import adsk.core
    import adsk.fusion

    pot = Path(pot)
    cm = {n: float(v) / 10.0 for n, v in parametri.items()}
    spec = importlib.util.spec_from_file_location('skripta_' + re.sub(r'\W', '_', pot.stem), pot)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    # skripte z BF_IME pricakujejo ze obstojec base feature s tem imenom v korenu
    app = adsk.core.Application._zacni(doc_ime, cm, getattr(modul, 'BF_IME', None))
    modul.main(False)
    root = app.activeProduct.rootComponent
    deli = []
    # telesa neposredno v korenu (npr. veliki predal: base feature v root) -> komponenta 'root'
    for b in root.bRepBodies:
        deli.append(Del(root.name, b.name, b.appearance.name if b.appearance else None,
                        b.isLightBulbOn, b.shape, b.opacity))
    for o in root.allOccurrences:
        for b in o.component.bRepBodies:
            deli.append(Del(o.component.name, b.name, b.appearance.name if b.appearance else None,
                            b.isLightBulbOn and o.isLightBulbOn, b.shape, b.opacity))
    return deli


def _v_gltf(v):
    """cm (x, y, z) -> m, y gor: (x, z, -y)."""
    a = np.asarray(v, dtype=np.float64) * 0.01
    return np.column_stack([a[:, 0], a[:, 2], -a[:, 1]])


def _mesh(d: Del) -> trimesh.Trimesh:
    verts, tris = d.oblika.tessellate(TOLERANCA_CM, KOTNA_TOLERANCA)
    v = _v_gltf([(p.X, p.Y, p.Z) for p in verts])
    m = trimesh.Trimesh(vertices=v, faces=np.asarray(tris, dtype=np.int64), process=True)
    m.merge_vertices()
    m = m.smooth_shaded  # normale z ostrimi robovi pri > 30 stopinj
    meta = {'videz': d.videz}
    if d.prosojnost < 1.0:
        meta['prosojnost'] = d.prosojnost
    m.metadata = meta  # le videz (+ prosojnost); trimesh-ove interne podatke zavržemo
    return m


def bbox_cm(oblika) -> list[list[float]]:
    bb = oblika.bounding_box()
    return [[round(bb.min.X, 4), round(bb.min.Y, 4), round(bb.min.Z, 4)],
            [round(bb.max.X, 4), round(bb.max.Y, 4), round(bb.max.Z, 4)]]


def izvozi_glb(deli: list[Del], pot: Path) -> None:
    """En mesh na telo, ime "<komponenta>/<telo>", extras.videz. Nevidna telesa se ne izvozijo.
    Ob izvozu zapiše tudi <sklop>-deli.json (ime datoteke = ime GLB brez končnice + '-deli.json')."""
    pot = Path(pot)
    scena = trimesh.Scene()
    seznam = []
    for d in deli:
        if not d.vidno:
            continue
        ime = d.ime
        scena.add_geometry(_mesh(d), node_name=ime, geom_name=ime)
        seznam.append({'ime': ime, 'videz': d.videz, 'bbox_cm': bbox_cm(d.oblika)})
    pot.parent.mkdir(parents=True, exist_ok=True)
    pot.write_bytes(scena.export(file_type='glb', include_normals=True))
    pot.with_name(pot.stem + '-deli.json').write_text(
        '[\n' + ',\n'.join(' ' + json.dumps(z, ensure_ascii=False) for z in seznam) + '\n]\n', encoding='utf-8')


def najdi_skripto(vir: Path, sklop: str) -> Path:
    najdene = sorted(Path(vir).glob(SKLOPI[sklop] + '-*.py'))
    if not najdene:
        raise SystemExit('Skripta %s-*.py ni v %s' % (SKLOPI[sklop], vir))
    return najdene[-1]


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--vir', required=True, type=Path, help='mapa s skriptami (cali-kuhinja/skripte)')
    ap.add_argument('--izhod', required=True, type=Path, help='ciljna mapa (assets/models)')
    ap.add_argument('--sklop', choices=sorted(SKLOPI), default='kuhinja')
    a = ap.parse_args(argv)
    pot = najdi_skripto(a.vir, a.sklop)
    deli = pozeni_skripto(pot, nalozi_parametre(a.sklop), doc_ime_iz_skripte(pot))
    izhod = a.izhod / (a.sklop + '.glb')
    izvozi_glb(deli, izhod)
    print('\n== %s: %d komponent, %d teles -> %s (%.0f kB)' % (
        a.sklop, len({d.komponenta for d in deli}), len(deli), izhod, izhod.stat().st_size / 1024))
    print('Imena delov (za js/deli-*.js):')
    for d in deli:
        print('  %s%s' % (d.ime, '' if d.vidno else '  [nevidno]'))


if __name__ == '__main__':
    main()
