/**
 * generate-config.cjs
 * ─────────────────────────────────────────────────────────────────
 * Lee las credenciales del .env y genera js/core/config.js.
 *
 * IMPORTANTE: config.js SÍ se versiona (ver .gitignore). El deploy publica los
 * estáticos del repo sin correr build ni tener el .env, así que la app necesita
 * config.js commiteado. Este script es solo para (re)generarlo en local cuando
 * cambian las credenciales. La única clave que contiene es la ANÓNIMA de
 * Supabase, pública por diseño (RLS restringe el acceso real).
 *
 * Uso:
 *   node tools/generate-config.cjs
 *
 * El archivo .env debe tener:
 *   VITE_SUPABASE_URL="https://xxxx.supabase.co"
 *   VITE_SUPABASE_ANON_KEY="eyJ..."
 * ─────────────────────────────────────────────────────────────────
 */

const fs   = require("fs");
const path = require("path");

// ── Leer .env ────────────────────────────────────────────────────
const ROOT    = path.resolve(__dirname, "..");
const envPath = path.join(ROOT, ".env");

if (!fs.existsSync(envPath)) {
    console.error("❌  No se encontró el archivo .env en:", envPath);
    console.error("   Creá el archivo .env con tus credenciales de Supabase.");
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");

function parseEnv(content) {
    const result = {};
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key   = trimmed.slice(0, eqIdx).trim();
        let   value = trimmed.slice(eqIdx + 1).trim();
        // Quitar comillas envolventes si las hay
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

const env = parseEnv(envContent);

const SUPABASE_URL  = env["VITE_SUPABASE_URL"]      || env["SUPABASE_URL"]      || "";
const SUPABASE_ANON = env["VITE_SUPABASE_ANON_KEY"] || env["SUPABASE_ANON_KEY"] || "";
// Clave PÚBLICA VAPID para Web Push (la privada vive solo en la edge function
// como secreto). Si falta, las notificaciones push quedan desactivadas y la app
// funciona igual: el toggle de "Notificaciones" avisa que no están configuradas.
const VAPID_PUBLIC  = env["VITE_VAPID_PUBLIC_KEY"]  || env["VAPID_PUBLIC_KEY"]  || "";

if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error("❌  Faltan credenciales en el .env:");
    if (!SUPABASE_URL)  console.error("   - VITE_SUPABASE_URL no encontrado");
    if (!SUPABASE_ANON) console.error("   - VITE_SUPABASE_ANON_KEY no encontrado");
    process.exit(1);
}

// ── Generar js/core/config.js ─────────────────────────────────────
const outputPath = path.join(ROOT, "js", "core", "config.js");

const output = `// ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR MANUALMENTE
// Generado por: tools/generate-config.cjs  (fuente: .env, en local)
//
// Este archivo SÍ se versiona: el deploy publica los estáticos del repo sin
// correr build, así que la app lo necesita en el árbol para arrancar.
// Solo contiene la clave ANÓNIMA de Supabase (pública por diseño; el acceso a
// los datos lo restringe RLS, ver server/schema.sql) y la clave VAPID pública.
// No hay secretos reales acá. Para cambiar credenciales, editá .env y regenerá
// con \`node tools/generate-config.cjs\`.

(function (window) {
    "use strict";

    const config = {
        supabaseUrl:     ${JSON.stringify(SUPABASE_URL)},
        supabaseAnonKey: ${JSON.stringify(SUPABASE_ANON)},
        defaultPageSize: 40,
        maxCatalogItems: 40,
        debug:           false,
        cachePrefix:     "animeDestiny",
        vapidPublicKey:  ${JSON.stringify(VAPID_PUBLIC)}
    };

    window.AppConfig = Object.freeze(config);
})(window);
`;

fs.writeFileSync(outputPath, output, "utf8");

console.log("✅  js/core/config.js generado correctamente.");
console.log("   URL:  ", SUPABASE_URL);
console.log("   ANON: ", SUPABASE_ANON.slice(0, 20) + "...[oculto]");
