#!/usr/bin/env python3
"""
slice-mascots.py — Recorta mascotas de Bleach desde spritesheets rasterizados.

Las hojas de tools/mascot-sheets/*.jpg son "sprite rips" con disposicion
IRREGULAR (filas y anchos distintos), no una grilla limpia, asi que no se
pueden cortar con un cols x rows fijo. En su lugar:

  1. Se separa el fondo (casi blanco) del personaje por umbral de color.
  2. Se agrupan las filas por bandas horizontales (huecos verticales vacios).
  3. Dentro de cada banda se agrupan columnas por huecos horizontales -> cada
     cluster es un fotograma.
  4. Se eligen a mano los indices de fotograma para idle / walk / attack (la
     agrupacion semantica no se puede automatizar de forma fiable).
  5. Cada fotograma se normaliza a un lienzo CUADRADO comun por personaje,
     anclado abajo-centro (pies al piso), con fondo transparente. Asi todas las
     animaciones comparten escala y los pies quedan alineados.

Salida:  images/mascots/<id>/<anim>-<i>.png  +  (re)genera js/ui/mascots.js

Uso:  python3 tools/slice-mascots.py
Requisitos:  pip install pillow numpy scipy
"""

import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, "tools", "mascot-sheets")

# Umbral de "fondo blanco": un pixel es fondo si sus 3 canales superan esto.
BG = 236

# Definicion de cada mascota: hoja fuente + que fotogramas forman cada animacion.
#
# Cada fotograma se indica de una de dos formas:
#   • int  -> índice en la extracción automática por bandas+columnas (sirve para
#             poses compactas: idle, walk).
#   • [x0,y0,x1,y1] -> región manual. El recorte se ajusta al contenido REAL
#             dentro de esa región (sin cortar) y sin capturar sprites vecinos.
#             Se usa en los ataques, cuya espada/estela se sale de la banda que
#             detecta el modo automático y quedaba cortada.
MASCOTS = [
    {
        "id": "ichigo", "name": "Ichigo Kurosaki", "anime": "Bleach",
        "sheet": "ichigo.jpg",
        "anims": {
            "idle":   [0, 2, 4],
            "walk":   [7, 8, 9],
            "attack": [[98, 356, 172, 438], [329, 380, 428, 442], [183, 382, 286, 442]],
        },
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "kenpachi", "name": "Kenpachi Zaraki", "anime": "Bleach",
        "sheet": "kenpachi.jpg",
        "anims": {
            "idle":   [0],
            "walk":   [6, 7, 8, 9, 10, 11, 12, 13],
            "attack": [[78, 338, 152, 422], [160, 322, 256, 423], [258, 338, 338, 422]],
        },
        "fps": {"idle": 4, "walk": 11, "attack": 12},
    },
]


def foreground(arr):
    bg = (arr[:, :, 0] > BG) & (arr[:, :, 1] > BG) & (arr[:, :, 2] > BG)
    fg = ~bg
    return ndimage.binary_opening(fg, iterations=1)


def bands_of(fg, min_h=12, gap=4):
    rowsum = fg.sum(axis=1)
    bands = []
    inb = False
    s = 0
    run_empty = 0
    for y, v in enumerate(rowsum):
        if v > 3:
            if not inb:
                inb = True
                s = y
            run_empty = 0
        elif inb:
            run_empty += 1
            if run_empty >= gap:
                bands.append((s, y - run_empty + 1))
                inb = False
    if inb:
        bands.append((s, len(rowsum)))
    return [(a, b) for a, b in bands if b - a >= min_h]


def clusters_in_band(fg, y0, y1, min_w=12, gap=6):
    colsum = fg[y0:y1, :].sum(axis=0)
    cl = []
    inc = False
    s = 0
    run_empty = 0
    for x, v in enumerate(colsum):
        if v > 0:
            if not inc:
                inc = True
                s = x
            run_empty = 0
        elif inc:
            run_empty += 1
            if run_empty >= gap:
                cl.append((s, x - run_empty + 1))
                inc = False
    if inc:
        cl.append((s, len(colsum)))
    return [(a, b) for a, b in cl if b - a >= min_w]


def extract_frames(path):
    """Devuelve (imagen, mask fg, cajas [x0,y0,x1,y1]) en orden fila->columna."""
    im = Image.open(path).convert("RGB")
    fg = foreground(np.asarray(im))
    boxes = []
    for (y0, y1) in bands_of(fg):
        for (x0, x1) in clusters_in_band(fg, y0, y1):
            sub = fg[y0:y1, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            if len(ys) == 0:
                continue
            boxes.append((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
    return im, fg, boxes


def tight_box(fg, region):
    """Ajusta una región manual [x0,y0,x1,y1] al contenido real que encierra."""
    x0, y0, x1, y1 = region
    sub = fg[y0:y1, x0:x1]
    ys = np.where(sub.any(axis=1))[0]
    xs = np.where(sub.any(axis=0))[0]
    if not len(ys):
        return tuple(region)
    return (x0 + int(xs[0]), y0 + int(ys[0]), x0 + int(xs[-1]) + 1, y0 + int(ys[-1]) + 1)


def resolve_box(item, fg, boxes):
    """Un fotograma es un índice (auto) o una región [x0,y0,x1,y1] (manual)."""
    if isinstance(item, int):
        return boxes[item]
    return tight_box(fg, item)


def clean_alpha(arr, light_luma=196, speck=14, hole=8):
    """
    Alfa limpio a partir del recorte RGB de un fotograma. Además de separar el
    fondo casi blanco, mejora la prolijidad del sprite (las hojas son JPEG, con
    ruido y halo de compresión):

      1. Opening: borra pixeles sueltos de 1px.
      2. De-fringe: pela SOLO el halo claro y fino del borde (el "ringing" del
         JPEG), protegiendo las regiones claras SÓLIDAS —haori blanco de
         Kenpachi, corte blanco— y el contorno oscuro del personaje.
      3. Quita motas flotantes (componentes chicos de ruido).
      4. Rellena huecos diminutos (pinholes del umbral en zonas claras).
    """
    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    luma = 0.299 * r + 0.587 * g + 0.114 * b

    fg = ~((r > BG) & (g > BG) & (b > BG))
    fg = ndimage.binary_opening(fg, iterations=1)

    light = fg & (luma > light_luma)
    solid_light = ndimage.binary_opening(light, iterations=1)          # blobs claros reales
    thin_light = light & ~ndimage.binary_dilation(solid_light, iterations=1)
    boundary = fg & ndimage.binary_dilation(~fg, iterations=1)
    fg = fg & ~(boundary & thin_light)                                 # pela solo halo fino

    lbl, n = ndimage.label(fg, structure=np.ones((3, 3)))
    if n:
        sizes = np.bincount(lbl.ravel())
        sizes[0] = 0
        fg = (sizes >= speck)[lbl]

    holes = ndimage.binary_fill_holes(fg) & ~fg
    lblh, nh = ndimage.label(holes, structure=np.ones((3, 3)))
    if nh:
        hs = np.bincount(lblh.ravel())
        hs[0] = 0
        fg = fg | ((hs > 0) & (hs <= hole))[lblh]

    return fg


def keyed_crop(im, box):
    """Recorta la caja y vuelve transparente el fondo, con limpieza de bordes y motas."""
    crop = im.crop(box).convert("RGBA")
    a = np.asarray(crop).copy()
    a[:, :, 3] = np.where(clean_alpha(a[:, :, :3]), 255, 0)
    return Image.fromarray(a, "RGBA")


def normalize(sprite, side):
    """Coloca el sprite en un lienzo cuadrado side x side, anclado abajo-centro."""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x = (side - sprite.width) // 2
    y = side - sprite.height
    canvas.alpha_composite(sprite, (x, max(0, y)))
    return canvas


def build(mascot):
    im, fg, boxes = extract_frames(os.path.join(SHEETS, mascot["sheet"]))
    # Resolver cada fotograma (índice auto o región manual) a una caja concreta.
    resolved = {}
    for anim, items in mascot["anims"].items():
        seq = []
        for it in items:
            if isinstance(it, int) and it >= len(boxes):
                raise SystemExit(
                    f"{mascot['id']}: índice {it} fuera de rango ({len(boxes)} fotogramas)")
            seq.append(resolve_box(it, fg, boxes))
        resolved[anim] = seq

    # Lienzo cuadrado común: el mayor lado entre TODOS los fotogramas usados, así
    # nada queda recortado y todas las animaciones comparten escala.
    side = 0
    for seq in resolved.values():
        for (x0, y0, x1, y1) in seq:
            side = max(side, x1 - x0, y1 - y0)
    side += 4  # holgura para que no toque los bordes

    rel_dir = os.path.join("images", "mascots", mascot["id"])
    out_dir = os.path.join(ROOT, rel_dir)
    os.makedirs(out_dir, exist_ok=True)
    # Limpiar PNG viejos de esta mascota.
    for f in os.listdir(out_dir):
        if f.endswith(".png"):
            os.remove(os.path.join(out_dir, f))

    frames = {}
    for anim, seq in resolved.items():
        rels = []
        for n, box in enumerate(seq):
            spr = normalize(keyed_crop(im, box), side)
            name = f"{anim}-{n}.png"
            spr.save(os.path.join(out_dir, name))
            rels.append(rel_dir.replace(os.sep, "/") + "/" + name)
        frames[anim] = rels

    anims = {}
    for anim, rels in frames.items():
        anims[anim] = {"f": list(range(len(rels))), "fps": mascot["fps"].get(anim, 6)}

    print(f"  {mascot['id']}: lienzo {side}px, "
          + ", ".join(f"{k}={len(v)}" for k, v in frames.items()))
    return {
        "id": mascot["id"], "name": mascot["name"], "anime": mascot["anime"],
        "mode": "frames", "frames": frames, "anims": anims,
    }


def write_registry(entries):
    banner = (
        "/**\n"
        " * mascots.js -- Registro de mascotas seleccionables (ademas de Rimuru).\n"
        " *\n"
        " * GENERADO por tools/slice-mascots.py a partir de las hojas de\n"
        " * tools/mascot-sheets/. No editar a mano: se sobrescribe.\n"
        " * mascot.js lee window.MascotRegistry y lo suma a la lista del selector.\n"
        " *\n"
        " * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una\n"
        " * imagen por fotograma), ya normalizadas a un lienzo cuadrado con los\n"
        " * pies anclados abajo-centro.\n"
        " */\n"
    )
    body = "window.MascotRegistry = " + json.dumps(entries, ensure_ascii=False, indent=4) + ";\n"
    path = os.path.join(ROOT, "js", "ui", "mascots.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(banner + body)
    print(f"\nOK js/ui/mascots.js con {len(entries)} mascota(s).")
    print("  Corre `npm run build` para re-estampar versiones y el service worker.")


if __name__ == "__main__":
    print("Cortando mascotas desde tools/mascot-sheets/ ...")
    entries = [build(m) for m in MASCOTS]
    write_registry(entries)
