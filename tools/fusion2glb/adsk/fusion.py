"""adsk.fusion: Design, TemporaryBRepManager, telesa, komponente. Geometrija: build123d.

Vsa telesa hranijo `shape` (build123d.Shape); booleanOperation ga zamenja na mestu,
kot Fusionov TemporaryBRepManager spremeni ciljno telo.
"""
from __future__ import annotations

from build123d import Compound, Plane, Shape, Solid, Vector

from .core import Point3D, ValueInput  # noqa: F401


def _normiraj(r):
    """Rezultat booleve operacije (Shape | ShapeList | None) -> Shape."""
    if r is None:
        return Compound([])
    if isinstance(r, (list, tuple)):  # ShapeList
        return Compound(list(r)) if len(r) else Compound([])
    return r


class BooleanTypes:
    UnionBooleanType = 'union'
    DifferenceBooleanType = 'difference'
    IntersectionBooleanType = 'intersection'


class BoundingBox3D:
    def __init__(self, mn, mx):
        self.minPoint = Point3D(*mn)
        self.maxPoint = Point3D(*mx)

    def intersects(self, o):
        a, b = self.minPoint.asArray(), self.maxPoint.asArray()
        c, d = o.minPoint.asArray(), o.maxPoint.asArray()
        return all(a[i] <= d[i] and c[i] <= b[i] for i in range(3))


class _Vertex:
    def __init__(self, p):
        self.geometry = Point3D(*p)


class Lump:
    def __init__(self, solid):
        self.volume = solid.volume


class Lumps(list):
    @property
    def count(self):
        return len(self)


class BRepBody:
    """Začasno (TemporaryBRepManager) ali trajno telo v komponenti."""

    def __init__(self, shape, ime='Body1'):
        self.shape = shape
        self.name = ime
        self.appearance = None
        self.opacity = 1.0
        self.isLightBulbOn = True

    @property
    def volume(self):
        return self.shape.volume if self.shape is not None else 0.0

    @property
    def lumps(self):
        return Lumps(Lump(s) for s in self.shape.solids())

    @property
    def vertices(self):
        return [_Vertex((v.X, v.Y, v.Z)) for v in self.shape.vertices()]

    @property
    def boundingBox(self):
        bb = self.shape.bounding_box()
        return BoundingBox3D((bb.min.X, bb.min.Y, bb.min.Z), (bb.max.X, bb.max.Y, bb.max.Z))


class TemporaryBRepManager:
    _inst = None

    @staticmethod
    def get():
        if TemporaryBRepManager._inst is None:
            TemporaryBRepManager._inst = TemporaryBRepManager()
        return TemporaryBRepManager._inst

    def createBox(self, obb):
        ld = Vector(*obb.lengthDirection.asArray())
        wd = Vector(*obb.widthDirection.asArray())
        hd = ld.cross(wd)
        c = Vector(*obb.centerPoint.asArray())
        origin = c - ld * (obb.length / 2) - wd * (obb.width / 2) - hd * (obb.height / 2)
        plane = Plane(origin=origin, x_dir=ld, z_dir=hd)
        return BRepBody(Solid.make_box(obb.length, obb.width, obb.height, plane))

    def createCylinderOrCone(self, p0, r0, p1, r1):
        a, b = Vector(*p0.asArray()), Vector(*p1.asArray())
        os = b - a
        plane = Plane(origin=a, z_dir=os)
        if abs(r0 - r1) < 1e-12:
            return BRepBody(Solid.make_cylinder(r0, os.length, plane))
        return BRepBody(Solid.make_cone(r0, r1, os.length, plane))

    def booleanOperation(self, target, tool, tip):
        if target.shape is None or not target.shape.solids():
            # prazen cilj: unija vzame orodje, ostalo ostane prazno
            if tip == BooleanTypes.UnionBooleanType:
                target.shape = tool.shape
            return True
        if tip == BooleanTypes.UnionBooleanType:
            r = target.shape.fuse(tool.shape)
        elif tip == BooleanTypes.DifferenceBooleanType:
            r = target.shape.cut(tool.shape)
        elif tip == BooleanTypes.IntersectionBooleanType:
            r = target.shape.intersect(tool.shape)
        else:
            raise ValueError('neznana boolova operacija %r' % (tip,))
        target.shape = _normiraj(r)
        return True

    def copy(self, body):
        return BRepBody(body.shape, body.name)

    def transform(self, body, matrika):
        """Togo gibanje (rotacija + premik). Splošne afine matrike niso podprte."""
        from OCP.BRepBuilderAPI import BRepBuilderAPI_Transform
        from OCP.gp import gp_Trsf
        r = matrika.vrstice
        t = gp_Trsf()
        t.SetValues(r[0][0], r[0][1], r[0][2], r[0][3],
                    r[1][0], r[1][1], r[1][2], r[1][3],
                    r[2][0], r[2][1], r[2][2], r[2][3])
        novo = BRepBuilderAPI_Transform(body.shape.wrapped, t, True).Shape()
        body.shape = Shape.cast(novo)
        return True


class Appearance:
    def __init__(self, name):
        self.name = name


class Appearances(list):
    """Knjižnica videzov. Skripte iščejo po imenu; vsako ime velja (videz je le oznaka)."""

    # videzi, ki jih avtor drzi v Fusionovi knjiznici (skripte jih iscejo z item(i) po imenu)
    KNJIZNICA = ('Topol', 'Breza', 'Modra REF')

    def __init__(self):
        super().__init__(Appearance(n) for n in self.KNJIZNICA)

    @property
    def count(self):  # Fusionov API; prekrije list.count
        return len(self)

    def item(self, i):
        return self[i]

    def itemByName(self, name):
        for a in self:
            if a.name == name:
                return a
        a = Appearance(name)
        self.append(a)
        return a

    def addByCopy(self, src, name):
        a = Appearance(name)
        a.kopija_od = getattr(src, 'name', None)
        self.append(a)
        return a


class Parameter:
    def __init__(self, name, value_cm, units='', comment=''):
        self.name, self.value, self.unit, self.comment = name, value_cm, units, comment


class UserParameters:
    def __init__(self, parametri_cm):
        self._p = {n: Parameter(n, v) for n, v in parametri_cm.items()}

    def itemByName(self, name):
        return self._p.get(name)

    def add(self, name, value_input, units, comment):
        p = Parameter(name, value_input.v_cm(), units, comment)
        self._p[name] = p
        return p


class BodyCollection:
    def __init__(self):
        self._t = []

    def add(self, body, base_feature=None):
        nov = BRepBody(body.shape, 'Body%d' % (len(self._t) + 1))
        self._t.append(nov)
        return nov

    def item(self, i):
        return self._t[i]

    @property
    def count(self):
        return len(self._t)

    def __iter__(self):
        return iter(self._t)

    def __len__(self):
        return len(self._t)


class BaseFeature:
    def __init__(self, komp, name=''):
        self._komp = komp
        self.name = name

    def startEdit(self):
        return True

    def finishEdit(self):
        return True

    @property
    def sourceBodies(self):
        return list(self._komp.bRepBodies)

    def updateBody(self, staro, novo):
        staro.shape = novo.shape
        return True


class BaseFeatures:
    def __init__(self, komp):
        self._komp, self._t = komp, []

    def add(self):
        f = BaseFeature(self._komp)
        self._t.append(f)
        return f

    def item(self, i):
        return self._t[i]

    @property
    def count(self):
        return len(self._t)


class Features:
    def __init__(self, komp):
        self.baseFeatures = BaseFeatures(komp)


class Component:
    def __init__(self, name='Component'):
        self.name = name
        self.bRepBodies = BodyCollection()
        self.features = Features(self)


class Occurrence:
    def __init__(self, komp):
        self.component = komp
        self.isLightBulbOn = True  # vidnost celotne komponente (Fusion: zarnica v brskalniku)

    @property
    def bRepBodies(self):
        return self.component.bRepBodies


class Occurrences(list):
    def addNewComponent(self, matrika=None):
        o = Occurrence(Component('Component%d' % (len(self) + 1)))
        self.append(o)
        return o


class RootComponent(Component):
    def __init__(self):
        super().__init__('root')
        self.occurrences = Occurrences()

    @property
    def allOccurrences(self):
        return list(self.occurrences)


class Design:
    def __init__(self, parametri_cm):
        self.userParameters = UserParameters(parametri_cm)
        self.rootComponent = RootComponent()
        self.appearances = Appearances()

    @staticmethod
    def cast(produkt):
        return produkt
