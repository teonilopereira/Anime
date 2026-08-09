/**
 * generate-mascots.js — Genera mascotas anime en pixel art con PixelLab.ai.
 *
 * Para cada mascota de la lista MASCOTS:
 *   1. pixflux            → sprite base (fotograma "idle").
 *   2. animate-with-text  → ciclo de "walk" (varios fotogramas) usando el base
 *                           como imagen de referencia.
 * Guarda los PNG en  images/mascots/<id>/  y (re)genera  js/ui/mascots.js  con
 * el registro que lee mascot.js.
 *
 * REQUISITOS
 *   • Node 18+ (usa fetch nativo).
 *   • Variable de entorno con el token de PixelLab:
 *
 *       PIXELLAB_API_KEY=tu-token   node tools/generate-mascots.js
 *
 *   • Correlo en una máquina con salida a api.pixellab.ai (el sandbox de
 *     Claude Code on the web tiene ese host BLOQUEADO por política de red).
 *
 * Opcionales por env:  MASCOT_SIZE (px, default 64)  ·  WALK_FRAMES (default 6)
 *   ·  ONLY=<id,id>  para regenerar solo algunas.
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API = "https://api.pixellab.ai/v1";
const KEY = process.env.PIXELLAB_API_KEY;
const SIZE = Number(process.env.MASCOT_SIZE) || 64;
const WALK_FRAMES = Math.max(2, Math.min(20, Number(process.env.WALK_FRAMES) || 6));
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

// ── Lista curada de mascotas ────────────────────────────────────────────────
// Ajustá los prompts a gusto. Se generan como pixel art de cuerpo entero, de
// costado (view "side") para que el ciclo de caminata quede natural.
const MASCOTS = [
    { id: "gato-ninja",  name: "Gato Ninja",   anime: "Original", prompt: "cute chibi ninja cat with a headband, anime pixel art, full body, side view" },
    { id: "dragon-bebe", name: "Dragón Bebé",  anime: "Original", prompt: "cute baby dragon, anime pixel art, full body, side view" },
    { id: "kitsune",     name: "Kitsune",      anime: "Original", prompt: "cute chibi nine-tailed fox spirit, anime pixel art, full body, side view" },
    { id: "robot-neko",  name: "Robot Neko",   anime: "Original", prompt: "cute chibi robot cat, neon accents, anime pixel art, full body, side view" },
    { id: "maga",        name: "Pequeña Maga", anime: "Original", prompt: "cute chibi anime witch girl with a pointy hat and cape, pixel art, full body, side view" },
    { id: "panda",       name: "Panda Rojo",   anime: "Original", prompt: "cute chibi red panda, anime pixel art, full body, side view" },
    // ── Personajes mujeres ──────────────────────────────────────────────────
    { id: "hikari", name: "Hikari", anime: "Original", prompt: "cute chibi anime warrior girl, long crimson ponytail, silver armor, red scarf, holding a katana, pixel art, full body, side view" },
    { id: "luna",   name: "Luna",   anime: "Original", prompt: "cute chibi anime sorceress girl, long lavender hair, purple star witch hat, flowing violet robe, holding a glowing magic staff, pixel art, full body, side view" }
];

if (!KEY) {
    console.error("Falta PIXELLAB_API_KEY en el entorno.\n  Ej: PIXELLAB_API_KEY=xxxx node tools/generate-mascots.js");
    process.exit(1);
}

async function callPixelLab(endpoint, body) {
    const res = await fetch(API + endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${endpoint} → HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }
    return res.json();
}

function saveBase64Png(absPath, b64) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, Buffer.from(b64, "base64"));
}

function savePng(absPath, buf) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buf);
}

// ── PNG en Node puro (decode/encode RGBA 8-bit) + normalización ──────────────
// PixelLab devuelve cada fotograma como PNG suelto (idle y walk se generan por
// separado), con el personaje en cualquier parte del lienzo de 64×64 y unos
// pocos px de aire bajo los pies. Al renderizarlos tal cual, el personaje
// "flota" sobre las repisas y se bambolea de lado entre fotogramas (el bounding
// box no está centrado igual en cada uno). Para que se muevan bien, replicamos
// la normalización de slice-characters.py: recortar al contenido y recomponer
// cada fotograma en un lienzo cuadrado COMÚN, centrado en X y con los pies
// pegados al borde inferior. Así el andar queda estable y apoyado en el suelo.

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ALPHA_MIN = 16;   // alfa mínimo para considerar un píxel "del personaje"
const CANVAS_PAD = 4;   // holgura del lienzo para que el sprite no toque bordes

function pngChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
}

// Decodifica un PNG (bit depth 8, sin entrelazar) a { w, h, data: RGBA }.
function decodePng(buf) {
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const ct = buf[25];
    let idat = Buffer.alloc(0), o = 8;
    while (o < buf.length) {
        const len = buf.readUInt32BE(o);
        const type = buf.toString("ascii", o + 4, o + 8);
        if (type === "IDAT") idat = Buffer.concat([idat, buf.slice(o + 8, o + 8 + len)]);
        o += 12 + len;
    }
    const raw = zlib.inflateSync(idat);
    const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1;
    const stride = w * ch;
    const out = Buffer.alloc(w * h * 4);
    let prev = Buffer.alloc(stride), ptr = 0;
    for (let y = 0; y < h; y++) {
        const f = raw[ptr++];
        const cur = Buffer.alloc(stride);
        for (let x = 0; x < stride; x++) {
            const a = raw[ptr + x], bpp = ch;
            const ra = x >= bpp ? cur[x - bpp] : 0;
            const ub = prev[x];
            const uc = x >= bpp ? prev[x - bpp] : 0;
            let v;
            if (f === 0) v = a;
            else if (f === 1) v = a + ra;
            else if (f === 2) v = a + ub;
            else if (f === 3) v = a + ((ra + ub) >> 1);
            else {
                const p = ra + ub - uc;
                const pa = Math.abs(p - ra), pb = Math.abs(p - ub), pc = Math.abs(p - uc);
                v = a + ((pa <= pb && pa <= pc) ? ra : (pb <= pc ? ub : uc));
            }
            cur[x] = v & 255;
        }
        ptr += stride;
        prev = cur;
        for (let x = 0; x < w; x++) {
            let r, g, b, al;
            if (ch === 4) { r = cur[x * 4]; g = cur[x * 4 + 1]; b = cur[x * 4 + 2]; al = cur[x * 4 + 3]; }
            else if (ch === 3) { r = cur[x * 3]; g = cur[x * 3 + 1]; b = cur[x * 3 + 2]; al = 255; }
            else if (ch === 2) { r = g = b = cur[x * 2]; al = cur[x * 2 + 1]; }
            else { r = g = b = cur[x]; al = 255; }
            const i = (y * w + x) * 4;
            out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = al;
        }
    }
    return { w, h, data: out };
}

// Codifica { w, h, data: RGBA } a PNG (color type 6, filtro 0 por línea).
function encodePng(w, h, data) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const stride = w * 4;
    const raw = Buffer.alloc((stride + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (stride + 1)] = 0; // filtro None
        data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
    }
    const idat = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([
        PNG_SIG,
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", idat),
        pngChunk("IEND", Buffer.alloc(0))
    ]);
}

// Caja del contenido (alfa > umbral) de una imagen RGBA, o null si está vacía.
function alphaBBox(img) {
    let minx = img.w, miny = img.h, maxx = -1, maxy = -1;
    for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
            if (img.data[(y * img.w + x) * 4 + 3] > ALPHA_MIN) {
                if (x < minx) minx = x; if (x > maxx) maxx = x;
                if (y < miny) miny = y; if (y > maxy) maxy = y;
            }
        }
    }
    if (maxx < 0) return null;
    return { minx, miny, maxx, maxy, w: maxx - minx + 1, h: maxy - miny + 1 };
}

// Copia la caja `box` de `src` sobre el lienzo transparente `dst` en (dx, dy).
function blit(dst, dw, src, box, dx, dy) {
    for (let y = 0; y < box.h; y++) {
        for (let x = 0; x < box.w; x++) {
            const si = ((box.miny + y) * src.w + (box.minx + x)) * 4;
            const a = src.data[si + 3];
            if (a === 0) continue;
            const di = ((dy + y) * dw + (dx + x)) * 4;
            dst[di] = src.data[si]; dst[di + 1] = src.data[si + 1];
            dst[di + 2] = src.data[si + 2]; dst[di + 3] = a;
        }
    }
}

// Normaliza un grupo de fotogramas (base64) a un lienzo cuadrado común, con el
// personaje centrado en X y los pies anclados abajo. Devuelve PNGs (Buffer) en
// el mismo orden. Al compartir lienzo, todos quedan a la misma escala.
function normalizeFrames(b64List) {
    const imgs = b64List.map((b) => decodePng(Buffer.from(b, "base64")));
    const boxes = imgs.map(alphaBBox);
    let side = 0;
    boxes.forEach((bx) => { if (bx) side = Math.max(side, bx.w, bx.h); });
    side += CANVAS_PAD;
    return imgs.map((im, i) => {
        const bx = boxes[i];
        const canvas = Buffer.alloc(side * side * 4); // 0 = transparente
        if (bx) {
            const dx = Math.floor((side - bx.w) / 2);
            const dy = Math.max(0, side - bx.h); // pies al borde inferior
            blit(canvas, side, im, bx, dx, dy);
        }
        return encodePng(side, side, canvas);
    });
}

async function generateOne(m) {
    console.log(`\n▶ ${m.name} (${m.id})`);
    let usd = 0;

    // 1. Sprite base (idle).
    const base = await callPixelLab("/generate-image-pixflux", {
        description: m.prompt,
        image_size: { width: SIZE, height: SIZE },
        no_background: true,
        text_guidance_scale: 8
    });
    const baseB64 = base?.image?.base64;
    if (!baseB64) throw new Error("pixflux no devolvió imagen");
    usd += base?.usage?.usd || 0;

    const relDir = path.join("images", "mascots", m.id);

    // 2. Ciclo de caminata usando el base como referencia.
    let walkB64 = [];
    try {
        const anim = await callPixelLab("/animate-with-text", {
            image_size: { width: SIZE, height: SIZE },
            description: m.prompt,
            action: "walking",
            view: "side",
            direction: "east",
            n_frames: WALK_FRAMES,
            reference_image: { type: "base64", base64: baseB64 }
        });
        usd += anim?.usage?.usd || 0;
        walkB64 = (anim?.images || []).map((img) => img?.base64).filter(Boolean);
    } catch (e) {
        console.warn(`  walk  ✗ animación falló (${e.message}). Se usa idle como caminata.`);
    }

    // 3. Normalización conjunta: idle + walk comparten lienzo (misma escala),
    //    van centrados en X y con los pies anclados abajo → se mueven estables y
    //    apoyados en las repisas, sin flotar ni bambolearse entre fotogramas.
    const pngs = normalizeFrames([baseB64].concat(walkB64));
    const idlePng = pngs[0];
    const walkPngs = pngs.slice(1);

    const cleanRel = (p) => p.split(path.sep).join("/");

    // Limpia PNGs viejos del personaje (p. ej. de una corrida sin normalizar).
    const absDir = path.join(ROOT, relDir);
    if (fs.existsSync(absDir)) {
        for (const f of fs.readdirSync(absDir)) {
            if (f.endsWith(".png")) fs.rmSync(path.join(absDir, f));
        }
    }

    const idleRel = path.join(relDir, "idle-0.png");
    savePng(path.join(ROOT, idleRel), idlePng);
    const idle = [cleanRel(idleRel)];
    console.log(`  idle  ✓ ${cleanRel(idleRel)}`);

    const walk = [];
    walkPngs.forEach((buf, i) => {
        const rel = path.join(relDir, `walk-${i}.png`);
        savePng(path.join(ROOT, rel), buf);
        walk.push(cleanRel(rel));
    });
    if (walk.length) console.log(`  walk  ✓ ${walk.length} fotogramas`);

    console.log(`  costo ~US$${usd.toFixed(4)}`);
    return {
        id: m.id, name: m.name, anime: m.anime, mode: "frames",
        frames: { idle: idle, walk: walk.length ? walk : idle }
    };
}

function writeRegistry(entries) {
    const banner =
`/**
 * mascots.js — Registro de mascotas seleccionables (además de Rimuru).
 *
 * GENERADO por tools/generate-mascots.js. No editar a mano: se sobrescribe.
 * mascot.js lee window.MascotRegistry y lo suma a la lista del selector.
 */
`;
    const body = "window.MascotRegistry = " + JSON.stringify(entries, null, 4) + ";\n";
    fs.writeFileSync(path.join(ROOT, "js", "ui", "mascots.js"), banner + body);
    console.log(`\n✔ js/ui/mascots.js actualizado con ${entries.length} mascota(s).`);
    console.log("  Ejecutá `npm run build` para re-estampar las versiones y el service worker.");
}

(async () => {
    const list = ONLY.length ? MASCOTS.filter((m) => ONLY.includes(m.id)) : MASCOTS;
    const entries = [];
    for (const m of list) {
        try {
            entries.push(await generateOne(m));
        } catch (e) {
            console.error(`  ✗ ${m.id}: ${e.message}`);
        }
    }
    if (!entries.length) {
        console.error("\nNo se generó ninguna mascota.");
        process.exit(1);
    }
    // Si se usó ONLY, conservar las mascotas previas del registro que no se tocaron.
    let existing = [];
    if (ONLY.length) {
        try {
            const prev = fs.readFileSync(path.join(ROOT, "js", "ui", "mascots.js"), "utf8");
            const match = prev.match(/window\.MascotRegistry\s*=\s*(\[[\s\S]*\]);/);
            if (match) existing = JSON.parse(match[1]).filter((e) => !ONLY.includes(e.id));
        } catch (_) { /* sin registro previo válido */ }
    }
    writeRegistry(existing.concat(entries));
})();
