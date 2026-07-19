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

// Dominio publico: se usa para las URLs canonicas y para generar el sitemap.
const SITE_URL = 'https://animedestiny.netlify.app';

// Paginas que NO deben indexarse ni entrar al sitemap (privadas o sin valor
// de busqueda). El resto se agrega solo, asi no hay que mantener una lista.
const NO_INDEXABLES = new Set(['404.html', 'Login.html', 'usuario.html', 'configuracion.html']);

/**
 * Verificacion de propiedad de Google Search Console (token del meta tag).
 *
 * Se estampa por build en vez de subir el googleXXXX.html que ofrece Google:
 * ese archivo iria a la raiz y el sitemap se arma listando los .html de ahi
 * (ver mas abajo), asi que terminaria pidiendole a Google que indexe su propio
 * archivo de verificacion. Con el meta tag no hay archivo suelto que excluir.
 *
 * Google deja de reconocer la propiedad si el tag desaparece: vaciar esto lo
 * quita de todos los HTML y tumba la verificacion.
 */
const GOOGLE_SITE_VERIFICATION = 'x6Ye451jPznGAmYSkuq4o_Q50Bn_wR8mI1nRVHGq2F0';

/**
 * Analitica. Viene DESACTIVADA: poner el id la enciende y el build se encarga
 * del resto (inyecta el script en cada HTML y abre el CSP lo justo).
 * Dejarlo vacio quita el script y vuelve a cerrar el CSP.
 *
 * Se eligio Umami: no usa cookies ni recolecta datos personales, asi que no
 * hace falta banner de consentimiento (con Google Analytics si haria falta) y
 * el tier gratuito alcanza de sobra para el trafico actual.
 *
 *   1. Crear la cuenta y agregar el sitio en https://cloud.umami.is
 *   2. Copiar el "Website ID" (un UUID) y pegarlo abajo en `id`
 *   3. npm run build
 *
 * Para cambiar de proveedor se tocan las cuatro claves y nada mas: `attr` es
 * el atributo con el que cada uno identifica al sitio (Umami usa
 * data-website-id; Plausible, data-domain con el dominio en vez del UUID).
 */
const ANALYTICS = {
    id: '',
    attr: 'data-website-id',
    host: 'https://cloud.umami.is',
    src: 'https://cloud.umami.is/script.js',
};

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

// Nota: los CSS y JS especificos de cada pagina (usuario, detalle, login, etc.)
// NO van al bundle — se cargan sueltos y el estampado de version los cubre
// automaticamente, sin necesidad de listarlos aca.

// Dependencias de terceros que se auto-hospedan en vez de cargarse desde un CDN.
// Se copian desde node_modules para que la version quede fijada por package.json
// (antes se traia "npm/lucide" sin version ni SRI desde jsDelivr: el codigo podia
// cambiar solo y tenia acceso al JWT en localStorage).
const VENDOR = [];

// Dependencias que hay que empaquetar (no traen un build listo para el navegador).
// api/supabase-config.js importaba el SDK desde jsDelivr; al cerrar el CSP a
// script-src 'self' ese import quedaba bloqueado, asi que se sirve local.
const VENDOR_BUNDLES = [
    { entry: '@supabase/supabase-js', to: 'js/vendor/supabase.esm.js', format: 'esm' },
    // Subconjunto de Lucide: el UMD completo trae todos los iconos (~402 KB) y
    // la app usa ~22. Se sirve como IIFE porque se carga con <script> plano.
    { entry: 'tools/lucide-entry.js', to: 'js/vendor/lucide.min.js', format: 'iife' },
];

// ── Utilidades ───────────────────────────────────────────────────────────

function assertExists(rel) {
    if (!fs.existsSync(abs(rel))) {
        throw new Error(`Fuente no encontrada: ${rel}`);
    }
}

// Lee normalizando CRLF -> LF. Sin esto el build no es reproducible entre
// plataformas: en Windows las fuentes se leen con CRLF y esos saltos sobreviven
// dentro de plantillas de texto multilinea, cambiando el hash de version
// respecto de Linux (y rompiendo el chequeo de bundles al dia en CI).
function readSource(rel) {
    assertExists(rel);
    return fs.readFileSync(abs(rel), 'utf8').replace(/\r\n/g, '\n');
}

// UTF-8 sin BOM (fs.writeFileSync con 'utf8' no agrega BOM).
function writeUtf8(rel, data) {
    fs.writeFileSync(abs(rel), data, { encoding: 'utf8' });
}

function concatCss() {
    return CSS_SOURCES
        .map((rel) => `/* ===== ${path.basename(rel)} ===== */\n${readSource(rel)}`)
        .join('\n');
}

function concatJs() {
    let out = '/* === Anime Destiny Core Bundle === */\n';
    for (const rel of JS_SOURCES) {
        out += '\n/* ========================================== */\n';
        out += `/* === FILE: ${rel} === */\n`;
        out += '/* ========================================== */\n\n';
        out += `${readSource(rel)}\n`;
    }
    return out;
}

// ── Build ────────────────────────────────────────────────────────────────

// Copiar dependencias auto-hospedadas desde node_modules.
const vendorContents = [];
for (const { from, to } of VENDOR) {
    assertExists(from);
    fs.mkdirSync(path.dirname(abs(to)), { recursive: true });
    fs.copyFileSync(abs(from), abs(to));
    vendorContents.push(fs.readFileSync(abs(to)));
}

for (const { entry, to, format } of VENDOR_BUNDLES) {
    fs.mkdirSync(path.dirname(abs(to)), { recursive: true });
    await esbuild.build({
        entryPoints: [entry.startsWith('tools/') ? abs(entry) : entry],
        outfile: abs(to),
        bundle: true,
        format: format,
        platform: 'browser',
        target: 'es2020',
        minify: true,
        legalComments: 'none',
        logLevel: 'silent',
    });
    vendorContents.push(fs.readFileSync(abs(to)));
}

// ── Validar que todo icono usado este en el subconjunto de Lucide ─────────
// Si falta uno, Lucide simplemente no lo dibuja: fallo silencioso. Mejor
// romper el build.
(function validarIconos() {
    const entrada = readSource('tools/lucide-entry.js');
    const bloque = entrada.match(/const icons = \{([\s\S]*?)\};/);
    if (!bloque) throw new Error('No se pudo leer la lista de iconos de tools/lucide-entry.js');
    const disponibles = new Set(
        bloque[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            // PascalCase -> kebab-case, como hace Lucide con data-lucide.
            // Contempla siglas (XCircle -> x-circle) y digitos (Share2 -> share-2).
            .map((n) => n
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/([A-Za-z])(\d)/g, '$1-$2')
                .toLowerCase()),
    );

    const archivos = [
        ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => f),
        ...JS_SOURCES,
        'js/pages/script.js',
        'js/detalle/render.js',
    ];

    const usados = new Set();
    for (const rel of archivos) {
        if (!fs.existsSync(abs(rel))) continue;
        const txt = fs.readFileSync(abs(rel), 'utf8');
        // Estaticos: data-lucide="nombre"
        for (const m of txt.matchAll(/data-lucide="([a-z][a-z0-9-]*)"/g)) usados.add(m[1]);
        // Dinamicos: data-lucide="${cond ? 'a' : 'b'}" -> literales de adentro
        for (const m of txt.matchAll(/data-lucide="\$\{[^}]*\}"/g)) {
            for (const lit of m[0].matchAll(/'([a-z][a-z0-9-]*)'/g)) usados.add(lit[1]);
        }
        // Configs tipo { icon: "clapperboard" } (los emoji no matchean).
        for (const m of txt.matchAll(/\bicon:\s*["']([a-z][a-z0-9-]{2,})["']/g)) usados.add(m[1]);
    }

    const faltantes = [...usados].filter((n) => !disponibles.has(n)).sort();
    if (faltantes.length) {
        throw new Error(
            'Iconos usados que faltan en tools/lucide-entry.js: ' + faltantes.join(', ') +
            '\nAgregalos a ese archivo (en PascalCase) o no se van a dibujar.',
        );
    }
})();

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

// ── Versión ──────────────────────────────────────────────────────────────

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

// Expresion unica: identifica los assets locales tanto para calcular la version
// como para estamparla. Asi no pueden desincronizarse.
const ASSET_RE = /(src|href)="((?:css|js|api)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g;

// La version es el hash de TODO asset local referenciado por los HTML, no solo
// del bundle: los CSS/JS por pagina (usuario.css, script.js, i18n.js...) tambien
// se sirven con ?v=, asi que si no entraran en el hash cambiarian sin que la
// version se moviera y los usuarios seguirian recibiendo la copia cacheada.
const assetPaths = new Set();
for (const file of htmlFiles) {
    const src = fs.readFileSync(abs(file), 'utf8');
    for (const m of src.matchAll(ASSET_RE)) {
        // bundle.css se reescribe a bundle.min.css al estampar.
        assetPaths.add(m[2] === 'css/bundle.css' ? 'css/bundle.min.css' : m[2]);
    }
}

// Las dependencias vendorizadas que se importan como modulo (no via <script>)
// no aparecen en los HTML, asi que se suman a mano.
for (const { to } of VENDOR_BUNDLES) assetPaths.add(to);

// Se hashea el contenido NORMALIZADO (CRLF -> LF), no los bytes crudos: los
// saltos de linea dependen de como llego el archivo al disco (git checkout con
// autocrlf en Windows vs LF en Linux), y si entraran al hash la version
// cambiaria de plataforma en plataforma. Eso rompia el chequeo de CI, que
// reconstruye y compara contra lo commiteado.
const hash = crypto.createHash('sha256');
for (const rel of [...assetPaths].sort()) {
    if (fs.existsSync(abs(rel))) hash.update(rel).update(readSource(rel));
}

// Los HTML tambien entran al hash. Sin esto, un cambio que toque solo HTML
// (meta tags de SEO, el script de analitica, canonicals) no movia la version,
// y como sw.js usa CACHE_NAME = version y sirve HTML cache-first, el visitante
// que ya tenia el service worker instalado seguia recibiendo la copia vieja
// para siempre.
//
// Se hashea con los ?v= borrados: esos los escribe el propio estampado, asi
// que si entraran al hash cada build cambiaria la version que acaba de
// calcular y no convergeria nunca.
for (const file of [...htmlFiles].sort()) {
    hash.update(file).update(readSource(file).replace(/\?v=[^"]*/g, ''));
}
const version = hash.digest('hex').slice(0, 8);

// ── Estampar versión en los HTML ─────────────────────────────────────────

let stampedHtml = 0;

for (const file of htmlFiles) {
    const p = abs(file);
    const before = fs.readFileSync(p, 'utf8');
    let src = before;

    // El bundle CSS se sirve minificado: unificar bundle.css -> bundle.min.css.
    src = src.replace(/css\/bundle\.css(?=[?"'])/g, 'css/bundle.min.css');

    // Estampar la version en TODO asset local (css/, js/, api/). Una sola regla
    // cubre el bundle, los CSS y JS por pagina, y las dependencias vendorizadas,
    // para que ninguno quede sin cache-busting al agregarse en el futuro.
    src = src.replace(ASSET_RE, (_m, attr, ruta) => `${attr}="${ruta}?v=${version}"`);

    // Canonical: sin esto, la misma pagina servida como /x.html, /x.html?utm=...
    // o con / final se indexa como varias URLs distintas y se reparte el ranking.
    // detalle.html se excluye a proposito: su canonical lo pone render.js con el
    // id de la obra, porque el contenido depende del query string.
    if (file !== 'detalle.html') {
        const canonical = `${SITE_URL}/${file}`;
        if (/<link rel="canonical"/.test(src)) {
            src = src.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}">`);
        } else {
            src = src.replace(/(<title>)/, `<link rel="canonical" href="${canonical}">\n    $1`);
        }
    }

    // ── Verificacion de Search Console ──
    // Se borra y se re-inyecta en cada build (igual que la analitica): asi el
    // tag no se duplica al reconstruir y vaciar la constante lo saca de todos
    // los HTML de una.
    src = src.replace(/\s*<meta name="google-site-verification"[^>]*>/g, '');
    if (GOOGLE_SITE_VERIFICATION) {
        src = src.replace(
            /(\s*)<\/head>/,
            `$1    <meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}">$1</head>`,
        );
    }

    // ── Analitica ──
    // Se re-genera en cada build: si ANALYTICS.id esta vacio, el script se
    // quita y el CSP vuelve a cerrarse. Asi encender/apagar es un solo cambio.
    // La limpieza contempla los atributos de ambos proveedores y borra el host
    // viejo ademas del actual, para que cambiar de uno a otro no deje el script
    // anterior colgado ni un dominio de mas abierto en el CSP.
    src = src.replace(
        /\s*<script defer [^>]*\bdata-(?:website-id|domain)="[^"]*"[^>]*><\/script>/g,
        '',
    );
    for (const host of [ANALYTICS.host, 'https://plausible.io']) {
        src = src.split(' ' + host).join('');
    }

    if (ANALYTICS.id) {
        // El script va al final del <head>, con defer: no bloquea el render.
        src = src.replace(
            /(\s*)<\/head>/,
            `$1    <script defer ${ANALYTICS.attr}="${ANALYTICS.id}" src="${ANALYTICS.src}"><\/script>$1</head>`,
        );
        // Abrir el CSP solo para el host de analitica: script-src para cargarlo
        // y connect-src para que pueda mandar los eventos.
        src = src.replace(/script-src 'self'/, `script-src 'self' ${ANALYTICS.host}`);
        src = src.replace(/connect-src 'self'/, `connect-src 'self' ${ANALYTICS.host}`);
    }

    if (src !== before) {
        fs.writeFileSync(p, src, 'utf8');
        stampedHtml += 1;
    }
}

// ── Sitemap ──────────────────────────────────────────────────────────────
// Se genera desde los HTML que existen: el que habia estaba escrito a mano,
// tenia 8 URLs y le faltaba comparar.html.

const hoy = new Date().toISOString().slice(0, 10);
const prioridades = { 'index.html': '1.0', 'anime.html': '0.9', 'manga.html': '0.9', 'novelas.html': '0.9' };

const urlsSitemap = htmlFiles
    .filter((f) => !NO_INDEXABLES.has(f) && f !== 'detalle.html')
    .sort()
    .map((f) => {
        const prio = prioridades[f] || '0.6';
        return `  <url>\n    <loc>${SITE_URL}/${f}</loc>\n    <lastmod>${hoy}</lastmod>\n    <priority>${prio}</priority>\n  </url>`;
    });

writeUtf8(
    'sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urlsSitemap.join('\n') + '\n</urlset>\n',
);

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
