"""adsk.core: točke, vektorji, matrike, aplikacija, dokumenti, ValueInput. Enote: cm."""
from __future__ import annotations

import math
import re

_ENOTE_V_CM = {'': 1.0, 'cm': 1.0, 'mm': 0.1, 'm': 100.0}


class Point3D:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x, self.y, self.z = float(x), float(y), float(z)

    @staticmethod
    def create(x=0.0, y=0.0, z=0.0):
        return Point3D(x, y, z)

    def asArray(self):
        return (self.x, self.y, self.z)


class Vector3D:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x, self.y, self.z = float(x), float(y), float(z)

    @staticmethod
    def create(x=0.0, y=0.0, z=0.0):
        return Vector3D(x, y, z)

    def asArray(self):
        return (self.x, self.y, self.z)

    def crossProduct(self, o):
        return Vector3D(self.y * o.z - self.z * o.y, self.z * o.x - self.x * o.z, self.x * o.y - self.y * o.x)

    def normalize(self):
        d = math.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)
        self.x, self.y, self.z = self.x / d, self.y / d, self.z / d
        return True


class Matrix3D:
    """4x4 matrika po vrsticah (kot v Fusionu: setWithArray prejme 16 števil po vrsticah)."""

    def __init__(self):
        self.vrstice = [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]

    @staticmethod
    def create():
        return Matrix3D()

    def setWithArray(self, a):
        if len(a) != 16:
            raise ValueError('Matrix3D.setWithArray pričakuje 16 števil')
        self.vrstice = [[float(a[4 * i + j]) for j in range(4)] for i in range(4)]
        return True

    def asArray(self):
        return tuple(v for r in self.vrstice for v in r)

    @property
    def translation(self):
        return Vector3D(self.vrstice[0][3], self.vrstice[1][3], self.vrstice[2][3])

    @translation.setter
    def translation(self, v):
        for i, c in enumerate((v.x, v.y, v.z)):
            self.vrstice[i][3] = c

    def setToRotation(self, kot, os, izhodisce):
        """Rotacija za `kot` (rad) okoli osi `os` skozi `izhodisce` (Rodrigues)."""
        n = math.sqrt(os.x ** 2 + os.y ** 2 + os.z ** 2)
        x, y, z = os.x / n, os.y / n, os.z / n
        c, s = math.cos(kot), math.sin(kot)
        t = 1 - c
        r = [[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
             [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
             [t * x * z - s * y, t * y * z + s * x, t * z * z + c]]
        o = (izhodisce.x, izhodisce.y, izhodisce.z)
        for i in range(3):
            self.vrstice[i] = r[i] + [o[i] - sum(r[i][j] * o[j] for j in range(3))]
        self.vrstice[3] = [0.0, 0.0, 0.0, 1.0]
        return True


class OrientedBoundingBox3D:
    def __init__(self, center, length_dir, width_dir, length, width, height):
        self.centerPoint = center
        self.lengthDirection = length_dir
        self.widthDirection = width_dir
        self.length, self.width, self.height = float(length), float(width), float(height)

    @staticmethod
    def create(center, length_dir, width_dir, length, width, height):
        return OrientedBoundingBox3D(center, length_dir, width_dir, length, width, height)


class ValueInput:
    def __init__(self, niz=None, realna=None):
        self.niz, self.realna = niz, realna

    @staticmethod
    def createByString(s):
        return ValueInput(niz=str(s))

    @staticmethod
    def createByReal(r):
        return ValueInput(realna=float(r))

    def v_cm(self):
        """Vrednost v internih enotah (cm). Niz '8 mm' -> 0.8."""
        if self.realna is not None:
            return self.realna
        m = re.fullmatch(r'\s*([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s*([a-zA-Z]*)\s*', self.niz.replace(',', '.'))
        if not m or m.group(2) not in _ENOTE_V_CM:
            raise ValueError('ValueInput: ne razumem "%s"' % self.niz)
        return float(m.group(1)) * _ENOTE_V_CM[m.group(2)]


class Document:
    def __init__(self, ime, app):
        self.name = ime
        self._app = app

    def activate(self):
        self._app._aktivni = self
        return True


class Application:
    """Enojni dokument z imenom, ki ga skripta pričakuje (konstanta DOC). Nastavi ga generiraj.py."""
    _instanca = None

    def __init__(self, doc_ime, design):
        self.documents = [Document(doc_ime, self)]
        self._aktivni = self.documents[0]
        self._design = design

    @staticmethod
    def get():
        if Application._instanca is None:
            raise RuntimeError('adsk: aplikacija ni inicializirana (kliči adsk.core.Application._zacni)')
        return Application._instanca

    @staticmethod
    def _zacni(doc_ime, parametri_cm):
        from . import fusion
        Application._instanca = Application(doc_ime, fusion.Design(parametri_cm))
        return Application._instanca

    @property
    def activeDocument(self):
        return self._aktivni

    @property
    def activeProduct(self):
        return self._design
