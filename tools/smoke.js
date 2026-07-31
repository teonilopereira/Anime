/**
 * smoke.js — Prueba de humo: abre cada página del sitio en un navegador headless
 * y reporta problemas de JS, para convertir "se ve raro" en un error concreto.
 *
 *   npm run smoke
 *
 * Por cada .html de la raíz carga la página con Chromium (headless), bloquea la
 * red externa (para que no dependa de APIs/creds ni se cuelgue) y captura:
 *   - EXCEPCIONES no atrapadas (pageerror)  -> fallo real, hace fallar la corrida
 *   - errores de consola relevantes          -> aviso (se filtran los de red/recursos)
 * Los recursos LOCALES (js/css propios) sí se cargan, así se ejecuta el código real.
 *
 * Degrada con gracia: si no hay navegador/playwright-core disponible, avisa y
 * termina sin romper (exit 0), en vez de tirar el pipeline.
 *
 * Nota honesta: sin backend no ejercita los flujos con datos; su fuerte es
 * detectar errores de carga y excepciones al inicializar (p. ej. un typo, un
 * NaN, un símbolo indefinido). Ese fue justo el tipo de bug que rompía la vista.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ---------- localizar navegador y playwright ---------- */
function findBrowser() {
  const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      if (!/^chromium-/.test(d)) continue;
      const exe = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined; // que playwright use su default
}

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch {
  console.log('⚠  playwright-core no está instalado — `npm i -D playwright-core`. Smoke test omitido.');
  process.exit(0);
}

const NOISE = [
  /Failed to load resource/i, /net::/i, /ERR_/i, /Failed to fetch/i,
  /supabase|anilist|mangadex|jikan|kitsu/i, /favicon/i, /manifest/i,
  /Service ?Worker/i, /\b404\b/i, /the server responded/i,
  /frame-ancestors/i, /Content Security Policy/i, /NetworkError|load failed/i,
];
const isNoise = (t) => NOISE.some(re => re.test(t));

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

let browser;
try {
  browser = await chromium.launch({ executablePath: findBrowser() });
} catch (e) {
  console.log('⚠  No se pudo iniciar Chromium (' + e.message.split('\n')[0] + '). Smoke test omitido.');
  process.exit(0);
}

const results = [];
for (const file of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const exceptions = [], warns = [];
  page.on('pageerror', e => { const t = e.message.split('\n')[0]; if (!isNoise(t)) exceptions.push(t); });
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!isNoise(t)) warns.push(t.split('\n')[0]); } });
  // bloquear red externa; permitir archivos locales
  // red externa: en vez de abortar (que provoca "Failed to fetch"), respondemos
  // vacío para que las promesas resuelvan y no se generen falsos positivos.
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    const rt = route.request().resourceType();
    if (rt === 'image' || rt === 'font' || rt === 'media' || rt === 'stylesheet')
      return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' });
  });
  try {
    await page.goto(pathToFileURL(path.join(ROOT, file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(900); // dejar correr scripts defer/async
  } catch (e) {
    exceptions.push('goto: ' + e.message.split('\n')[0]);
  }
  results.push({ file, exceptions: [...new Set(exceptions)], warns: [...new Set(warns)] });
  await ctx.close();
}
await browser.close();

/* ---------- reporte ---------- */
let bad = 0;
console.log('\nSMOKE TEST · ' + pages.length + ' páginas\n' + '─'.repeat(46));
for (const r of results) {
  if (r.exceptions.length) {
    bad++;
    console.log(`✖ ${r.file}`);
    r.exceptions.forEach(e => console.log(`    ⛔ ${e}`));
    r.warns.forEach(w => console.log(`    ⚠  ${w}`));
  } else if (r.warns.length) {
    console.log(`▲ ${r.file}`);
    r.warns.forEach(w => console.log(`    ⚠  ${w}`));
  } else {
    console.log(`✓ ${r.file}`);
  }
}
console.log('─'.repeat(46));
console.log(bad ? `✖ ${bad} página(s) con excepciones` : '✓ sin excepciones de JS');
process.exit(bad ? 1 : 0);
