#!/usr/bin/env python3
"""
slice-characters.py — Recorta personajes desde spritesheets PNG con fondo
transparente (tools/character-sheets/*.png).

A diferencia de las hojas de Bleach (JPEG con fondo casi blanco, ver
slice-mascots.py), estas hojas ya vienen con alfa limpio y una disposicion en
grilla IRREGULAR: filas y columnas separadas por huecos vacios, con un ancho de
fotograma variable y —en la mayoria— un fotograma final que es el efecto/
proyectil del ataque.

Proceso:
  1. Se detecta el primer plano por el canal alfa (pixel opaco = personaje).
  2. Se agrupan filas por bandas horizontales (huecos verticales vacios) y,
     dentro de cada banda, columnas por huecos horizontales -> cada cluster es
     un fotograma, en orden fila->columna.
  3. Se eligen a mano los indices de fotograma para idle / walk / attack y, si
     existe, el proyectil (la agrupacion semantica no se puede automatizar).
  4. Cada fotograma del personaje se normaliza a un lienzo CUADRADO comun por
     personaje, anclado abajo-centro (pies al piso). El proyectil se normaliza
     a su propio lienzo, centrado, porque es un efecto que no "pisa" el suelo.

Salida:  images/mascots/<id>/<anim>-<i>.png
         images/mascots/<id>/projectile.png   (si el personaje tiene proyectil)
         (re)genera js/ui/characters.js  ->  window.CharacterRegistry

Uso:  python3 tools/slice-characters.py
Requisitos:  pip install pillow numpy scipy
"""

import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, "tools", "character-sheets")

# Un pixel pertenece al personaje si su alfa supera esto.
ALPHA = 16

# Definicion de cada personaje: hoja fuente, que indices de fotograma (segun la
# extraccion por bandas+columnas, en orden fila->columna) forman cada animacion,
# y —opcional— el indice del fotograma que es el proyectil del ataque.
CHARACTERS = [
    {
        "id": "aurora", "name": "Aurora", "anime": "Personaje",
        "sheet": "aurora.png",
        "anims": {"idle": [0, 1, 2], "walk": [5, 6, 7], "attack": [3, 4, 9]},
        "projectile": 12,
        "fps": {"idle": 5, "walk": 9, "attack": 12},
    },
    {
        "id": "escarlata", "name": "Escarlata", "anime": "Personaje",
        "sheet": "escarlata.png",
        "anims": {"idle": [0, 1, 2], "walk": [16, 17, 18], "attack": [8, 9, 10]},
        "projectile": None,
        "fps": {"idle": 5, "walk": 10, "attack": 11},
    },
    {
        "id": "nix", "name": "Nix", "anime": "Personaje",
        "sheet": "nix.png",
        "anims": {"idle": [0, 1, 2], "walk": [16, 17, 18], "attack": [11, 12, 13]},
        "projectile": None,
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "corvina", "name": "Corvina", "anime": "Personaje",
        "sheet": "corvina.png",
        "anims": {"idle": [0, 1, 2], "walk": [6, 7, 8], "attack": [9, 10, 11]},
        "projectile": 15,
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "kitsune", "name": "Kitsune", "anime": "Personaje",
        "sheet": "kitsune.png",
        "anims": {"idle": [0, 1, 2], "walk": [5, 6, 7], "attack": [4, 9, 10]},
        "projectile": 12,
        "fps": {"idle": 5, "walk": 9, "attack": 12},
    },
    {
        "id": "vampi", "name": "Vampi", "anime": "Personaje",
        "sheet": "vampi.png",
        "anims": {"idle": [0, 1, 2], "walk": [6, 7, 8], "attack": [4, 5, 11]},
        "projectile": 15,
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "marea", "name": "Marea", "anime": "Personaje",
        "sheet": "marea.png",
        "anims": {"idle": [0, 1, 2], "walk": [5, 6, 7], "attack": [4, 8, 9]},
        "projectile": 12,
        "fps": {"idle": 5, "walk": 9, "attack": 12},
    },
    {
        "id": "infernal", "name": "Infernal", "anime": "Personaje",
        "sheet": "infernal.png",
        "anims": {"idle": [0, 1, 2], "walk": [6, 7, 8], "attack": [3, 4, 5]},
        "projectile": 15,
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "kurenai", "name": "Kurenai", "anime": "Personaje",
        "sheet": "kurenai.png",
        "anims": {"idle": [0, 1, 2], "walk": [14, 15, 16], "attack": [4, 11, 12]},
        "projectile": 8,
        "fps": {"idle": 6, "walk": 11, "attack": 12},
    },
    {
        "id": "kazuha", "name": "Kazuha", "anime": "Personaje",
        "sheet": "kazuha.png",
        "anims": {"idle": [1, 6, 0], "walk": [5, 6, 7], "attack": [2, 3, 4]},
        "projectile": 8,
        "fps": {"idle": 6, "walk": 11, "attack": 12},
    },
    {
        "id": "diablilla", "name": "Diablilla", "anime": "Personaje",
        "sheet": "diablilla.png",
        "anims": {"idle": [0, 1, 2], "walk": [5, 6, 7], "attack": [3, 4, 9]},
        "projectile": 14,
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
    {
        "id": "valkiria", "name": "Valkiria", "anime": "Personaje",
        "sheet": "valkiria.png",
        "anims": {"idle": [0, 1, 2], "walk": [5, 6, 7], "attack": [3, 4, 9]},
        "projectile": 13,
        "fps": {"idle": 5, "walk": 10, "attack": 12},
    },
]


def foreground(alpha):
    fg = alpha > ALPHA
    return ndimage.binary_opening(fg, iterations=1)


def bands_of(fg, min_h=10, gap=8):
    rowsum = fg.sum(axis=1)
    bands = []
    inb = False
    s = 0
    run_empty = 0
    for y, v in enumerate(rowsum):
        if v > 2:
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


def clusters_in_band(fg, y0, y1, min_w=10, gap=10):
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
    """Devuelve (imagen RGBA, cajas [x0,y0,x1,y1]) en orden fila->columna."""
    im = Image.open(path).convert("RGBA")
    alpha = np.asarray(im)[:, :, 3]
    fg = foreground(alpha)
    boxes = []
    for (y0, y1) in bands_of(fg):
        for (x0, x1) in clusters_in_band(fg, y0, y1):
            sub = fg[y0:y1, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            xs = np.where(sub.any(axis=0))[0]
            if len(ys) == 0 or len(xs) == 0:
                continue
            box = (x0 + xs[0], y0 + ys[0], x0 + xs[-1] + 1, y0 + ys[-1] + 1)
            # Descarta cajas casi vacias (ruido residual del umbral).
            if fg[box[1]:box[3], box[0]:box[2]].sum() < 40:
                continue
            boxes.append(box)
    return im, boxes


def crop(im, box):
    """Recorta la caja conservando el alfa original de la hoja."""
    return im.crop(box)


def normalize_floor(sprite, side):
    """Sprite en un lienzo cuadrado side x side, anclado abajo-centro."""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x = (side - sprite.width) // 2
    y = side - sprite.height
    canvas.alpha_composite(sprite, (x, max(0, y)))
    return canvas


def normalize_center(sprite, pad=6):
    """Proyectil en un lienzo propio, centrado en ambos ejes."""
    w, h = sprite.width + pad * 2, sprite.height + pad * 2
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(sprite, (pad, pad))
    return canvas


def build(ch):
    im, boxes = extract_frames(os.path.join(SHEETS, ch["sheet"]))
    used = sorted({i for seq in ch["anims"].values() for i in seq})
    if ch.get("projectile") is not None:
        used.append(ch["projectile"])
    for i in used:
        if i >= len(boxes):
            raise SystemExit(
                f"{ch['id']}: indice {i} fuera de rango ({len(boxes)} fotogramas)")

    # Lienzo cuadrado comun del cuerpo: el mayor lado entre los fotogramas de
    # animacion usados (sin contar el proyectil, que va aparte).
    body = sorted({i for seq in ch["anims"].values() for i in seq})
    side = 0
    for i in body:
        x0, y0, x1, y1 = boxes[i]
        side = max(side, x1 - x0, y1 - y0)
    side += 4  # holgura para que no toque los bordes

    rel_dir = os.path.join("images", "mascots", ch["id"])
    out_dir = os.path.join(ROOT, rel_dir)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.endswith(".png"):
            os.remove(os.path.join(out_dir, f))

    frames = {}
    for anim, idxs in ch["anims"].items():
        rels = []
        for n, i in enumerate(idxs):
            spr = normalize_floor(crop(im, boxes[i]), side)
            name = f"{anim}-{n}.png"
            spr.save(os.path.join(out_dir, name))
            rels.append(rel_dir.replace(os.sep, "/") + "/" + name)
        frames[anim] = rels

    anims = {}
    for anim, rels in frames.items():
        anims[anim] = {"f": list(range(len(rels))), "fps": ch["fps"].get(anim, 6)}

    entry = {
        "id": ch["id"], "name": ch["name"], "anime": ch["anime"],
        "mode": "frames", "frames": frames, "anims": anims,
    }

    proj_note = ""
    if ch.get("projectile") is not None:
        spr = normalize_center(crop(im, boxes[ch["projectile"]]))
        spr.save(os.path.join(out_dir, "projectile.png"))
        entry["projectile"] = rel_dir.replace(os.sep, "/") + "/projectile.png"
        proj_note = ", proyectil=si"

    print(f"  {ch['id']}: lienzo {side}px, "
          + ", ".join(f"{k}={len(v)}" for k, v in frames.items()) + proj_note)
    return entry


def write_registry(entries):
    banner = (
        "/**\n"
        " * characters.js -- Registro de personajes seleccionables.\n"
        " *\n"
        " * GENERADO por tools/slice-characters.py a partir de las hojas de\n"
        " * tools/character-sheets/. No editar a mano: se sobrescribe.\n"
        " * mascot.js lee window.CharacterRegistry (ademas de MascotRegistry) y lo\n"
        " * suma a la lista del selector.\n"
        " *\n"
        " * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una\n"
        " * imagen por fotograma), normalizadas a un lienzo cuadrado con los pies\n"
        " * anclados abajo-centro, y —si aplica— un 'projectile' con el efecto del\n"
        " * ataque.\n"
        " */\n"
    )
    body = "window.CharacterRegistry = " + json.dumps(entries, ensure_ascii=False, indent=4) + ";\n"
    path = os.path.join(ROOT, "js", "ui", "characters.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(banner + body)
    print(f"\nOK js/ui/characters.js con {len(entries)} personaje(s).")
    print("  Corre `npm run build` para re-estampar versiones y el service worker.")


if __name__ == "__main__":
    print("Cortando personajes desde tools/character-sheets/ ...")
    entries = [build(c) for c in CHARACTERS]
    write_registry(entries)
