/**
 * generate-characters.js — Genera personajes anime en pixel art con PixelLab.ai
 * y los publica en window.CharacterRegistry (js/ui/characters.js).
 *
 * A diferencia de generate-mascots.js (que solo hace idle/walk y escribe
 * MascotRegistry), este script produce el set COMPLETO que usa el selector de
 * personajes de mascot.js: idle + walk + attack, con lienzo cuadrado y —si el
 * personaje lo define— un 'projectile' con el efecto del ataque.
 *
 * Para cada personaje de la lista CHARACTERS:
 *   1. pixflux           → sprite base (fotograma "idle-0").
 *   2. animate-with-text → ciclo de "walk"  (usando el base como referencia).
 *   3. animate-with-text → ciclo de "attack" (acción configurable por personaje).
 *   4. pixflux           → 'projectile' opcional (si se define proj_prompt).
 * Guarda los PNG en  images/mascots/<id>/  y FUSIONA el registro existente de
 * js/ui/characters.js con las entradas nuevas (no pisa las que ya estaban).
 *
 * REQUISITOS
 *   • Node 18+ (usa fetch nativo).
 *   • Token de PixelLab en el entorno:
 *
 *       PIXELLAB_API_KEY=tu-token   node tools/generate-characters.js
 *
 *   • Corré esto en una máquina con salida a api.pixellab.ai. El sandbox de
 *     Claude Code on the web tiene ese host BLOQUEADO por política de red, así
 *     que la generación real hay que hacerla fuera del sandbox.
 *
 * OPCIONES por env:
 *   CHAR_SIZE=<px>        tamaño del lienzo del sprite         (default 64)
 *   WALK_FRAMES=<n>       fotogramas del ciclo de caminata     (default 6)
 *   ATTACK_FRAMES=<n>     fotogramas del ciclo de ataque       (default 4)
 *   ONLY=<id,id,...>      regenerar solo esos personajes
 *
 * Tras correrlo:  `npm run build`  para re-estampar versiones y el service worker.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API = "https://api.pixellab.ai/v1";
const KEY = process.env.PIXELLAB_API_KEY;
const SIZE = Number(process.env.CHAR_SIZE) || 64;
const WALK_FRAMES = Math.max(2, Math.min(20, Number(process.env.WALK_FRAMES) || 6));
const ATTACK_FRAMES = Math.max(2, Math.min(20, Number(process.env.ATTACK_FRAMES) || 4));
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

// ── Lista curada de personajes nuevos ───────────────────────────────────────
// Personajes originales estilo anime (evita IP de terceros). Ajustá prompts a
// gusto. Se generan de cuerpo entero, de costado (view "side") para que los
// ciclos de caminata/ataque queden naturales.
//   • prompt      → descripción base del personaje (pixflux + referencia).
//   • action      → acción del ataque para animate-with-text (ej "slashing").
//   • proj_prompt → (opcional) descripción del efecto/proyectil del ataque.
const CHARACTERS = [
    {
        id: "tempestad", name: "Tempestad", anime: "Personaje",
        prompt: "anime storm mage girl with a flowing cloak and glowing staff, pixel art, full body, side view",
        action: "casting a spell",
        proj_prompt: "glowing blue lightning orb projectile, pixel art, no background"
    },
    {
        id: "centella", name: "Centella", anime: "Personaje",
        prompt: "anime speedster boy with yellow lightning aura and goggles, pixel art, full body, side view",
        action: "dashing punch",
        proj_prompt: "yellow lightning spark slash effect, pixel art, no background"
    },
    {
        id: "boreal", name: "Boreal", anime: "Personaje",
        prompt: "anime ice knight in blue armor with a frost sword, pixel art, full body, side view",
        action: "sword slashing",
        proj_prompt: "cyan ice shard crescent slash, pixel art, no background"
    },
    {
        id: "solaris", name: "Solaris", anime: "Personaje",
        prompt: "anime sun priestess with golden robes and a radiant halo, pixel art, full body, side view",
        action: "casting a spell",
        proj_prompt: "bright golden sun flare projectile, pixel art, no background"
    },
    {
        id: "umbra", name: "Umbra", anime: "Personaje",
        prompt: "anime shadow assassin in a dark hooded outfit with twin daggers, pixel art, full body, side view",
        action: "dagger slashing",
        proj_prompt: "purple shadow crescent slash effect, pixel art, no background"
    },
    {
        id: "geode", name: "Geode", anime: "Personaje",
        prompt: "anime earth warrior girl with rocky gauntlets and crystal armor, pixel art, full body, side view",
        action: "punching",
        proj_prompt: "brown rock shard burst effect, pixel art, no background"
    }
];

if (!KEY) {
    console.error("Falta PIXELLAB_API_KEY en el entorno.\n  Ej: PIXELLAB_API_KEY=xxxx node tools/generate-characters.js");
    console.error("  Nota: api.pixellab.ai está bloqueado dentro del sandbox de Claude Code on the web;");
    console.error("        corré este script fuera del sandbox, donde ese host sea alcanzable.");
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

// Anima una acción con animate-with-text y guarda los fotogramas. Devuelve la
// lista de rutas relativas; si falla, devuelve [] (el que llama decide el
// fallback, típicamente reusar idle).
async function animate(m, relDir, baseB64, anim, action, nFrames) {
    const res = await callPixelLab("/animate-with-text", {
        image_size: { width: SIZE, height: SIZE },
        description: m.prompt,
        action: action,
        view: "side",
        direction: "east",
        n_frames: nFrames,
        reference_image: { type: "base64", base64: baseB64 }
    });
    const frames = res?.images || [];
    const rels = [];
    frames.forEach((img, i) => {
        if (!img?.base64) return;
        const rel = path.join(relDir, `${anim}-${i}.png`);
        saveBase64Png(path.join(ROOT, rel), img.base64);
        rels.push(rel.split(path.sep).join("/"));
    });
    return { rels, usd: res?.usage?.usd || 0 };
}

async function generateOne(m) {
    console.log(`\n▶ ${m.name} (${m.id})`);
    let usd = 0;
    const relDir = path.join("images", "mascots", m.id);

    // 1. Sprite base (idle-0).
    const base = await callPixelLab("/generate-image-pixflux", {
        description: m.prompt,
        image_size: { width: SIZE, height: SIZE },
        no_background: true,
        text_guidance_scale: 8
    });
    const baseB64 = base?.image?.base64;
    if (!baseB64) throw new Error("pixflux no devolvió imagen");
    usd += base?.usage?.usd || 0;

    const idleRel = path.join(relDir, "idle-0.png");
    saveBase64Png(path.join(ROOT, idleRel), baseB64);
    const idle = [idleRel.split(path.sep).join("/")];
    console.log(`  idle  ✓ ${idle[0]}`);

    // 2. Caminata (con fallback a idle).
    let walk = idle;
    try {
        const r = await animate(m, relDir, baseB64, "walk", "walking", WALK_FRAMES);
        usd += r.usd;
        if (r.rels.length) { walk = r.rels; console.log(`  walk  ✓ ${walk.length} fotogramas`); }
    } catch (e) {
        console.warn(`  walk  ✗ (${e.message}). Se usa idle como caminata.`);
    }

    // 3. Ataque (con fallback a idle).
    let attack = idle;
    try {
        const r = await animate(m, relDir, baseB64, "attack", m.action || "slashing", ATTACK_FRAMES);
        usd += r.usd;
        if (r.rels.length) { attack = r.rels; console.log(`  attack✓ ${attack.length} fotogramas`); }
    } catch (e) {
        console.warn(`  attack✗ (${e.message}). Se usa idle como ataque.`);
    }

    const entry = {
        id: m.id, name: m.name, anime: m.anime || "Personaje", mode: "frames",
        frames: { idle: idle, walk: walk, attack: attack },
        anims: {
            idle: { f: idle.map((_, i) => i), fps: 5 },
            walk: { f: walk.map((_, i) => i), fps: 10 },
            attack: { f: attack.map((_, i) => i), fps: 12 }
        }
    };

    // 4. Proyectil opcional.
    if (m.proj_prompt) {
        try {
            const proj = await callPixelLab("/generate-image-pixflux", {
                description: m.proj_prompt,
                image_size: { width: SIZE, height: SIZE },
                no_background: true,
                text_guidance_scale: 8
            });
            const pb64 = proj?.image?.base64;
            if (pb64) {
                usd += proj?.usage?.usd || 0;
                const projRel = path.join(relDir, "projectile.png");
                saveBase64Png(path.join(ROOT, projRel), pb64);
                entry.projectile = projRel.split(path.sep).join("/");
                console.log(`  proj  ✓ ${entry.projectile}`);
            }
        } catch (e) {
            console.warn(`  proj  ✗ (${e.message}). Sin proyectil; el golpe usa la marca de corte CSS.`);
        }
    }

    console.log(`  costo ~US$${usd.toFixed(4)}`);
    return entry;
}

// Lee las entradas ya publicadas en js/ui/characters.js para fusionarlas.
function readExisting() {
    try {
        const prev = fs.readFileSync(path.join(ROOT, "js", "ui", "characters.js"), "utf8");
        const match = prev.match(/window\.CharacterRegistry\s*=\s*(\[[\s\S]*\]);/);
        if (match) return JSON.parse(match[1]);
    } catch (_) { /* sin registro previo válido */ }
    return [];
}

function writeRegistry(entries) {
    const banner =
`/**
 * characters.js -- Registro de personajes seleccionables.
 *
 * GENERADO por tools/slice-characters.py (hojas locales) y/o
 * tools/generate-characters.js (PixelLab). No editar a mano: se sobrescribe.
 * mascot.js lee window.CharacterRegistry (ademas de MascotRegistry) y lo suma
 * a la lista del selector.
 *
 * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una imagen
 * por fotograma), normalizadas a un lienzo cuadrado con los pies anclados
 * abajo-centro, y --si aplica-- un 'projectile' con el efecto del ataque.
 */
`;
    const body = "window.CharacterRegistry = " + JSON.stringify(entries, null, 4) + ";\n";
    fs.writeFileSync(path.join(ROOT, "js", "ui", "characters.js"), banner + body);
    console.log(`\n✔ js/ui/characters.js actualizado con ${entries.length} personaje(s).`);
    console.log("  Ejecutá `npm run build` para re-estampar las versiones y el service worker.");
}

(async () => {
    const list = ONLY.length ? CHARACTERS.filter((m) => ONLY.includes(m.id)) : CHARACTERS;
    if (!list.length) {
        console.error("\nNada para generar (revisá ONLY / la lista CHARACTERS).");
        process.exit(1);
    }
    const fresh = [];
    for (const m of list) {
        try {
            fresh.push(await generateOne(m));
        } catch (e) {
            console.error(`  ✗ ${m.id}: ${e.message}`);
        }
    }
    if (!fresh.length) {
        console.error("\nNo se generó ningún personaje.");
        process.exit(1);
    }
    // Fusiona: conserva las entradas previas cuyo id NO se regeneró y suma las nuevas.
    const freshIds = new Set(fresh.map((e) => e.id));
    const kept = readExisting().filter((e) => !freshIds.has(e.id));
    writeRegistry(kept.concat(fresh));
})();
