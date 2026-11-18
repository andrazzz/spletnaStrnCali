import trimesh

from conftest import bbox_cm
from generiraj import izvozi_glb

# Deli, ki segajo nad pult / izven ohisja (ograjica, palica, policka, prikaz).
IZVEN_OHISJA = ('Ograjica', 'Palica', 'Policka', 'PRIKAZ')


def test_kuhinja_deli_in_mere(kuhinja):
    komp = {d.komponenta for d in kuhinja}
    # Dokumentacija (Kuhinja-stanje-projekta.md) omenja 35 komponent / 50 teles, a skripta
    # kuhinja-v7 sama izpise "teles 47" in izdela 30 komponent (od tega 5 komponent
    # z vec telesi) - dokument je zastarel; test preverja dejansko stanje skripte.
    assert len(komp) == 30
    assert len(kuhinja) == 47
    (x0, y0, z0), (x1, y1, z1) = bbox_cm([d for d in kuhinja if not d.komponenta.startswith(IZVEN_OHISJA)])
    assert abs((x1 - x0) - 38.4) < 0.1 and abs((z1 - z0) - 45.0) < 0.6
    assert 'Pult 12' in komp and 'Celo 10' in komp
    assert sum(1 for d in kuhinja if d.komponenta.startswith('Vrata ')) == 4


def test_kuhinja_glb(tmp_path, kuhinja):
    izvozi_glb(kuhinja, tmp_path / 'k.glb')
    scena = trimesh.load(tmp_path / 'k.glb')
    assert 'Pult 12/Body1' in scena.geometry and (tmp_path / 'k.glb').stat().st_size < 3_000_000
