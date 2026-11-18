"""Nadomestni modul `adsk` (Fusion 360 API) za zagon avtorjevih skript zunaj Fusiona.

Geometrijo zagotavlja build123d (OpenCascade). Vse dolzine so v cm, kot v Fusionu.
Implementirano je le tisto, kar skripte dejansko kličejo (glej core.py, fusion.py);
za novo skripto dodajte manjkajoče metode v ustrezno datoteko.
"""
from . import core, fusion  # noqa: F401
