import json
from pathlib import Path

import pytest
import trimesh
from pytest import approx

from generiraj import (doc_ime_iz_skripte, izvozi_glb, nalozi_parametre, pozeni_skripto)
from conftest import KOREN, bbox_cm, skripta

SKRIPTE = {
    'veliki-predal': 'veliki-predal-v2-skripta-cel-model.py',
    'notranji-predal': 'notranji-predal-v2-skripta-cel-model.py',
    'hladilnik': 'hladilnik-v2-skripta-cel-model.py',
}


def pozeni(sklop):
    pot = skripta(SKRIPTE[sklop])
    return pozeni_skripto(pot, nalozi_parametre(sklop), doc_ime_iz_skripte(pot))


def mere(deli):
    (x0, y0, z0), (x1, y1, z1) = bbox_cm(deli)
    return (x1 - x0, y1 - y0, z1 - z0)


def lesni(deli, tudi_skrita=False):
    # Brez REF (hladilnik/plasticni predal) in brez vseh PRIKAZ (vijaki, magneti in odprta mizica).
    # Brief je izkljucil le 'PRIKAZ vijaki', a je pri notranjem predalu PRIKAZ_MIZICA = True, zato
    # je 'PRIKAZ mizica pokrov' (odprta mizica, x -10,5..52,5, z do 66,4) vidna in bi pokvarila mere
    # ohisja 42 x 53,5; mizica je razstavni prikaz, ne del ohisja. `tudi_skrita`: vkljuci skrito
    # zaprto lego (pokrov + okvir, isLightBulbOn False), ki da polno visino 53,5.
    return [d for d in deli if (d.vidno or tudi_skrita) and not d.komponenta.startswith(('REF', 'PRIKAZ'))]


@pytest.fixture(scope='module')
def veliki():
    return pozeni('veliki-predal')


@pytest.fixture(scope='module')
def hladilnik():
    return pozeni('hladilnik')


@pytest.fixture(scope='module')
def notranji():
    return pozeni('notranji-predal')


def test_veliki_predal(veliki):
    assert len(veliki) == 12
    assert {d.komponenta for d in veliki} == {'root'}
    assert mere(veliki) == approx((76, 110, 8), abs=0.1)


def test_hladilnik(hladilnik):
    komp = {d.komponenta for d in hladilnik}
    assert {'Pokrov 10', 'REF hladilnik'} <= komp
    assert len(komp) == 7
    assert mere(lesni(hladilnik)) == approx((67.0, 43.7, 53.5), abs=0.15)


def test_notranji(notranji):
    assert any(d.komponenta == 'REF plasticni predal' for d in notranji)
    # Zaprta lega (skrita telesa vkljucena): ohisje 42 x ... x 53,5 cm.
    m = mere(lesni(notranji, tudi_skrita=True))
    assert m[0] == approx(42.0, abs=0.15)
    assert m[2] == approx(53.5, abs=0.6)
    # Prikazana lega (PRIKAZ_MIZICA = True): pokrov je skrit, vidne stene segajo do 52,5 cm.
    v = mere(lesni(notranji))
    assert v[0] == approx(42.0, abs=0.15) and v[2] == approx(52.5, abs=0.15)


def test_notranji_nevidna_telesa_niso_izvozena(tmp_path, notranji):
    # PRIKAZ_MIZICA = True: zaprt pokrov/okvir sta skrita (isLightBulbOn False)
    nevidna = [d for d in notranji if not d.vidno]
    assert nevidna, 'skripta bi morala skriti vsaj eno telo'
    vidna = [d for d in notranji if d.vidno]
    izvozi_glb(notranji, tmp_path / 'n.glb')
    scena = trimesh.load(tmp_path / 'n.glb')
    imena = set(scena.geometry)
    assert imena == {d.ime for d in vidna}
    assert not imena & {d.ime for d in nevidna}
    deli = json.loads((tmp_path / 'n-deli.json').read_text(encoding='utf-8'))
    assert {z['ime'] for z in deli} == imena


def test_velikost_vseh():
    glb = list((KOREN / 'assets' / 'models').glob('*.glb'))
    assert len(glb) == 4
    assert sum(p.stat().st_size for p in glb) < 8_000_000


@pytest.mark.parametrize('sklop', ['veliki-predal', 'hladilnik'])
def test_glb_videz_in_osi(tmp_path, sklop, veliki, hladilnik):
    deli = {'veliki-predal': veliki, 'hladilnik': hladilnik}[sklop]
    izvozi_glb(deli, tmp_path / 'x.glb')
    scena = trimesh.load(tmp_path / 'x.glb')
    assert set(scena.geometry) == {d.ime for d in deli}
    mn, mx = scena.bounds
    # (x, y, z)_cm -> (x, z, -y) * 0,01: y v GLB je cm-z
    (x0, y0, z0), (x1, y1, z1) = bbox_cm(deli)
    assert mx[1] - mn[1] == approx((z1 - z0) / 100, abs=0.002)
    assert mx[2] - mn[2] == approx((y1 - y0) / 100, abs=0.002)
    assert mx[0] - mn[0] == approx((x1 - x0) / 100, abs=0.002)
