/**
 * build.js — Pipeline de build unificado de Anime Destiny.
 *
 * Un solo comando (`npm run build`) que:
 *   1. Concatena los CSS compartidos → css/bundle.css y los minifica → css/bundle.min.css
 *   2. Concatena los JS core → js/core-bundle.js y los minifica → js/core-bundle.min.js
 *   3. Calcula UNA versión (hash de contenido) y la estampa en todos los HTML + sw.js,
 *      reemplazando los tres contadores manuales que antes se bumpeaban a mano.
 *
 * Usa esbuild para minificar: rápido, correcto y string-safe (no corrompe textos, a
 * diferencia del viejo tools/minify.js basado en regex). Reemplaza a minify.js y
 * build-js-bundle.ps1.
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const abs = (...p) => path.join(ROOT, ...p);

// ── Definición de fuentes ────────────────────────────────────────────────

// CSS compartido → bundle. Orden fijo (base primero por reset/variables).
const CSS_SOURCES = ['base', 'theme', 'components', 'cards', 'responsive', 'destiny-navbar']
    .map((n) => `css/${n}.css`);

// JS core → bundle. Orden por dependencias de inicialización (igual que el viejo
// build-js-bundle.ps1). config.js / i18n.js / namespace.js quedan FUERA a propósito:
// las páginas los cargan sueltos y temprano, antes del bundle.
const JS_SOURCES = [
    'js/core/constants.js',
    'js/core/api.js',
    'js/datos.js',
    'js/core/user-store.js',
    'js/core/storage.js',
    'js/core/auth.js',
    'js/security/sanitizer.js',
    'js/security/validator.js',
    'js/utils.js',
    'js/ui/toast.js',
    'js/catalog/states.js',
    'js/catalog/cards.js',
    'js/catalog/search.js',
    'js/catalog/pagination.js',
    'js/core/common-ui.js',
];

// CSS page-specific: NO van al bundle (se cargan sueltos), pero se les estampa versión
// para que dejen de servirse sin cache-busting.
const PAGE_CSS = ['advanced-filter', 'detalle', 'login', 'configuracion', 'usuario'];

// ── Utilidades ───────────────────────────────────────────────────────────

function assertExists(rel) {
    if (!fs.existsSync(abs(rel))) {
        throw new Error(`Fuente no encontrada: ${rel}`);
    }
}

// UTF-8 sin BOM (fs.writeFileSync con 'utf8' no agrega BOM).
function writeUtf8(rel, data) {
    fs.writeFileSync(abs(rel), data, { encoding: 'utf8' });
}

function concatCss() {
    return CSS_SOURCES
        .map((rel) => {
            assertExists(rel);
            const name = path.basename(rel);
            return `/* ===== ${name} ===== */\n${fs.readFileSync(abs(rel), 'utf8')}`;
        })
        .join('\n');
}

function concatJs() {
    let out = '/* === Anime Destiny Core Bundle === */\n';
    for (const rel of JS_SOURCES) {
        assertExists(rel);
        out += '\n/* ========================================== */\n';
        out += `/* === FILE: ${rel} === */\n`;
        out += '/* ========================================== */\n\n';
        out += `${fs.readFileSync(abs(rel), 'utf8')}\n`;
    }
    return out;
}

// ── Build ────────────────────────────────────────────────────────────────

const cssBundle = concatCss();
const jsBundle = concatJs();

const [cssMinRes, jsMinRes] = await Promise.all([
    esbuild.transform(cssBundle, { loader: 'css', minify: true }),
    esbuild.transform(jsBundle, { loader: 'js', minify: true }),
]);
const cssMin = cssMinRes.code;
const jsMin = jsMinRes.code;

writeUtf8('css/bundle.css', cssBundle);
writeUtf8('css/bundle.min.css', cssMin);
writeUtf8('js/core-bundle.js', jsBundle);
writeUtf8('js/core-bundle.min.js', jsMin);

// Versión = hash de contenido (solo cambia cuando cambia lo minificado).
const version = crypto.createHash('sha256').update(jsMin).update(cssMin).digest('hex').slice(0, 8);

// ── Estampar versión en los HTML ─────────────────────────────────────────

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
let stampedHtml = 0;

for (const file of htmlFiles) {
    const p = abs(file);
    const before = fs.readFileSync(p, 'utf8');
    let src = before;

    // bundle css (min o no-min, con o sin ?v=) → siempre bundle.min.css?v=<version>
    src = src.replace(
        /css\/bundle(?:\.min)?\.css(?:\?v=[^"']*)?/g,
        `css/bundle.min.css?v=${version}`,
    );

    // core-bundle.min.js → ?v=<version>
    src = src.replace(
        /js\/core-bundle\.min\.js(?:\?v=[^"']*)?/g,
        `js/core-bundle.min.js?v=${version}`,
    );

    // CSS page-specific → agregar/actualizar ?v=<version>
    for (const name of PAGE_CSS) {
        const re = new RegExp(`css/${name}\\.css(?:\\?v=[^"']*)?`, 'g');
        src = src.replace(re, `css/${name}.css?v=${version}`);
    }

    if (src !== before) {
        fs.writeFileSync(p, src, 'utf8');
        stampedHtml += 1;
    }
}

// ── Estampar CACHE_NAME del service worker ───────────────────────────────

const swPath = abs('sw.js');
const swBefore = fs.readFileSync(swPath, 'utf8');
const swAfter = swBefore.replace(
    /const CACHE_NAME = '[^']*';/,
    `const CACHE_NAME = 'anime-destiny-${version}';`,
);
if (swAfter !== swBefore) fs.writeFileSync(swPath, swAfter, 'utf8');

// ── Reporte ──────────────────────────────────────────────────────────────

const kb = (s) => `${(s.length / 1024).toFixed(1)} KB`;
console.log(`Build OK — versión ${version}`);
console.log(`  css/bundle.min.css     ${kb(cssMin)}  (fuente ${kb(cssBundle)})`);
console.log(`  js/core-bundle.min.js  ${kb(jsMin)}  (fuente ${kb(jsBundle)})`);
console.log(`  HTML estampados: ${stampedHtml}/${htmlFiles.length}`);
console.log(`  sw.js CACHE_NAME: anime-destiny-${version}`);
