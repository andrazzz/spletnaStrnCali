import json
import struct

from generiraj import izvozi_glb


def _gltf_json(pot):
    b = pot.read_bytes()
    dolz = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + dolz])


def test_extras_videz_in_osi_kuhinje(tmp_path, kuhinja):
    izvozi_glb(kuhinja, tmp_path / 'k.glb')
    j = _gltf_json(tmp_path / 'k.glb')
    z_videzom = [m for m in j['meshes'] if (m.get('extras') or {}).get('videz')]
    assert z_videzom, 'noben mesh nima extras.videz'
    pult = next(m for m in j['meshes'] if m['name'] == 'Pult 12/Body1')
    assert pult['extras']['videz']
    # osi: y je navzgor, v metrih; kuhinja je visoka 0,45-0,52 m (ne 0,84 m = y skripte)
    import trimesh
    mn, mx = trimesh.load(tmp_path / 'k.glb').bounds
    assert 0.45 <= mx[1] - mn[1] <= 0.52
    assert 0.84 <= mx[2] - mn[2] <= 1.3  # ohisje 84 cm (y skripte) + izstopajoci deli je globina (z) v glTF
