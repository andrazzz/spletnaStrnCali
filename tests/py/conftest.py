import os
import sys
from pathlib import Path

import pytest

KOREN = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(KOREN / 'tools' / 'fusion2glb'))

VIR = Path(os.environ.get('CALI_VIR', '/tmp/cali-kuhinja/skripte'))


def skripta(ime):
    if not VIR.is_dir():
        pytest.skip('mapa skript %s ne obstaja (CALI_VIR / sync.sh)' % VIR)
    return VIR / ime


def bbox_cm(deli):
    """Skupni kvader [[x0,y0,z0],[x1,y1,z1]] v cm."""
    mn = [1e9] * 3
    mx = [-1e9] * 3
    for d in deli:
        bb = d.oblika.bounding_box()
        for i, (a, b) in enumerate(zip((bb.min.X, bb.min.Y, bb.min.Z), (bb.max.X, bb.max.Y, bb.max.Z))):
            mn[i] = min(mn[i], a)
            mx[i] = max(mx[i], b)
    return mn, mx


@pytest.fixture(scope='session')
def kuhinja():
    from generiraj import nalozi_parametre, pozeni_skripto
    pot = skripta('kuhinja-v7-skripta-cel-model.py')
    return pozeni_skripto(pot, nalozi_parametre('kuhinja'), 'Californija kuhinja v7')
