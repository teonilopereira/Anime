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
    { id: "panda",       name: "Panda Rojo",   anime: "Original", prompt: "cute chibi red panda, anime pixel art, full body, side view" }
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
    const idleRel = path.join(relDir, "idle-0.png");
    saveBase64Png(path.join(ROOT, idleRel), baseB64);
    console.log(`  idle  ✓ ${idleRel}`);

    // 2. Ciclo de caminata usando el base como referencia.
    const idle = [idleRel.split(path.sep).join("/")];
    const walk = [];
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
        const frames = anim?.images || [];
        frames.forEach((img, i) => {
            if (!img?.base64) return;
            const rel = path.join(relDir, `walk-${i}.png`);
            saveBase64Png(path.join(ROOT, rel), img.base64);
            walk.push(rel.split(path.sep).join("/"));
        });
        console.log(`  walk  ✓ ${walk.length} fotogramas`);
    } catch (e) {
        console.warn(`  walk  ✗ animación falló (${e.message}). Se usa idle como caminata.`);
    }

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
