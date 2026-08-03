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

# Definicion de cada mascota: hoja fuente + que indices de fotograma (segun la
# extraccion por bandas+columnas) forman cada animacion.
MASCOTS = [
    {
        "id": "ichigo", "name": "Ichigo Kurosaki", "anime": "Bleach",
        "sheet": "ichigo.jpg",
        "anims": {
            "idle":   [0, 2, 4],
            "walk":   [7, 8, 9],
            "attack": [20, 21, 22],
        },
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "kenpachi", "name": "Kenpachi Zaraki", "anime": "Bleach",
        "sheet": "kenpachi.jpg",
        "anims": {
            "idle":   [0],
            "walk":   [6, 7, 8, 9, 10, 11, 12, 13],
            "attack": [27, 28, 29],
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
    """Devuelve (imagen, lista de cajas [x0,y0,x1,y1]) en orden fila->columna."""
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
    return im, boxes


def keyed_crop(im, box):
    """Recorta la caja y vuelve transparente el fondo blanco, con limpieza de motas."""
    crop = im.crop(box).convert("RGBA")
    a = np.asarray(crop).copy()
    bg = (a[:, :, 0] > BG) & (a[:, :, 1] > BG) & (a[:, :, 2] > BG)
    alpha = ~bg
    # Quitar pixeles sueltos de fondo/artefacto JPEG.
    alpha = ndimage.binary_closing(alpha, iterations=1)
    a[:, :, 3] = np.where(alpha, 255, 0)
    return Image.fromarray(a, "RGBA")


def normalize(sprite, side):
    """Coloca el sprite en un lienzo cuadrado side x side, anclado abajo-centro."""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x = (side - sprite.width) // 2
    y = side - sprite.height
    canvas.alpha_composite(sprite, (x, max(0, y)))
    return canvas


def build(mascot):
    im, boxes = extract_frames(os.path.join(SHEETS, mascot["sheet"]))
    used = sorted({i for seq in mascot["anims"].values() for i in seq})
    for i in used:
        if i >= len(boxes):
            raise SystemExit(
                f"{mascot['id']}: indice {i} fuera de rango ({len(boxes)} fotogramas)")
    # Lienzo cuadrado comun: el mayor lado entre todos los fotogramas usados.
    side = 0
    for i in used:
        x0, y0, x1, y1 = boxes[i]
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
    for anim, idxs in mascot["anims"].items():
        rels = []
        for n, i in enumerate(idxs):
            spr = normalize(keyed_crop(im, boxes[i]), side)
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
