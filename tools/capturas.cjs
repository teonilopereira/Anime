// Capturas de una página en escritorio/móvil × oscuro/claro, para comparar
// antes y después de un cambio de diseño. Levanta su propio servidor, corta la
// red externa (las imágenes externas se reemplazan por un SVG de relleno) y
// oculta navbar, dock y mascota en la captura de página completa.
//
// Uso: node tools/capturas.cjs <pagina> <antes|despues> <carpeta-salida> [estado]
//   ej: node tools/capturas.cjs usuario antes "$SCRATCH"
//
// Si existe tools/capturas/<pagina>.cjs, de ahí salen los estados y los datos
// de ejemplo (ver ese directorio). Si no, se captura un único estado "base".
// Imprime el ancho real de cada PNG: más que el viewport = desborde horizontal.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const [PAGINA, PREFIJO, OUT, SOLO] = process.argv.slice(2);
if (!PAGINA || !PREFIJO || !OUT) {
    console.error('Uso: node tools/capturas.cjs <pagina> <antes|despues> <carpeta-salida> [estado]');
    process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8131;
const BASE = `http://localhost:${PORT}`;
const VIEWPORTS = [{ n: '1366', w: 1366, h: 900 }, { n: '390', w: 390, h: 844 }];
const TEMAS = ['dark', 'light'];
const OCULTAR = '.destiny-navbar,.mobile-bottom-nav,[class*=mascot]{display:none !important}';

function cargarPlaywright() {
    const intentos = ['playwright', '@playwright/test'];
    try {
        const global = require('child_process').execSync('npm root -g').toString().trim();
        intentos.push(path.join(global, 'playwright'));
    } catch (_) { /* sin npm global */ }
    for (const m of intentos) {
        try { return require(m); } catch (_) { /* siguiente */ }
    }
    throw new Error('No encuentro Playwright: corré npm ci.');
}

const COLORES = ['#3b1d6e', '#0b4f6c', '#6b1d3a', '#1d5e3a', '#5e4a1d', '#2a2f7a', '#7a2a5c', '#1d4f5e'];
function relleno(url) {
    const n = Number((url.match(/(\d+)\.\w+$/) || [])[1]) || 0;
    const c = COLORES[n % COLORES.length];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="345"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0a0614"/></linearGradient></defs><rect width="230" height="345" fill="url(#g)"/><circle cx="160" cy="90" r="50" fill="#ffffff22"/></svg>`;
}

function anchoPng(buf) {
    return buf.readUInt32BE(16);
}

function esperarServidor(intentos = 50) {
    return new Promise((resolve, reject) => {
        const probar = (n) => fetch(BASE + '/index.html').then(resolve).catch(() => {
            if (n <= 0) return reject(new Error('El servidor no arrancó'));
            setTimeout(() => probar(n - 1), 200);
        });
        probar(intentos);
    });
}

(async () => {
    const fixturePath = path.join(__dirname, 'capturas', PAGINA + '.cjs');
    const fixture = fs.existsSync(fixturePath) ? require(fixturePath) : { estados: [{ n: 'base' }] };
    const estados = fixture.estados.filter((e) => !SOLO || e.n === SOLO);
    fs.mkdirSync(OUT, { recursive: true });

    const server = spawn(process.execPath, [path.join(__dirname, 'serve.cjs')], {
        cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
    });
    try {
        await esperarServidor();
        const { chromium } = cargarPlaywright();
        // Igual que playwright.config.js: en el contenedor de Claude Code el
        // Chromium viene preinstalado y puede no coincidir con la versión del repo.
        const local = '/opt/pw-browsers/chromium';
        const browser = await chromium.launch(fs.existsSync(local) ? { executablePath: local } : {});
        for (const vp of VIEWPORTS) for (const tema of TEMAS) for (const est of estados) {
            const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: tema, deviceScaleFactor: 1, serviceWorkers: 'block' });
            await ctx.route((url) => !url.href.startsWith(BASE), (route) => {
                if (route.request().resourceType() === 'image') {
                    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: relleno(route.request().url()) });
                }
                return route.abort();
            });
            if (est.init) await ctx.addInitScript(est.init);
            const page = await ctx.newPage();
            await page.goto(`${BASE}/${PAGINA}.html${est.hash ? '#' + est.hash : ''}`, { waitUntil: 'load' });
            await page.waitForTimeout(1500);
            if (est.datos && fixture.poblar) await fixture.poblar(page, est);
            const nombre = `${PREFIJO}-${PAGINA}-${est.n}-${vp.n}-${tema}`;
            await page.screenshot({ path: path.join(OUT, nombre + '-vista.png') });
            await page.addStyleTag({ content: OCULTAR });
            const buf = await page.screenshot({ path: path.join(OUT, nombre + '.png'), fullPage: true });
            const ancho = anchoPng(buf);
            console.log(nombre, ancho > vp.w ? `DESBORDE ${ancho}px` : 'ok');
            await ctx.close();
        }
        await browser.close();
    } finally {
        server.kill();
    }
})().catch((e) => { console.error(e); process.exit(1); });
