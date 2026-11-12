import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { leerCspCabecera, cspParaMeta } from './csp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEXT_PATTERNS = ['Ã', 'â'];
const HTML_FILES = [
  'anime.html',
  'comparar.html',
  'escena.html',
  'configuracion.html',
  'detalle.html',
  'index.html',
  'Login.html',
  'manga.html',
  'mis-listas.html',
  'novelas.html',
  'top.html',
  'usuario.html',
  'view_images.html'
].map((name) => path.join(ROOT, name)).filter((file) => fs.existsSync(file));

// vendor: bundles de terceros (no es nuestro codigo). tools: scripts de Node que
// usan import.meta y no se pueden validar con `new Function`. Ambos quedan fuera
// del muro de calidad, que solo cubre el JS del navegador que se sirve al usuario.
const SKIP_DIRS = new Set(['.git', '.agents', '.codex', 'node_modules', 'vendor', 'tools']);

// Archivos de configuracion (vitest.config.js, etc.): ESM de Node, no assets del navegador.
const isConfigFile = (name) => /\.config\.[cm]?js$/.test(name);

function walkJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...walkJsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('.fix-') && !isConfigFile(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripModuleSyntax(source) {
  return source
    .replace(/^\s*import\s.*$/gm, '')
    .replace(/^\s*export\s+\{.*$/gm, '')
    .replace(/^\s*export\s+default.*$/gm, '')
    .replace(/^\s*export\s+(?=async\s+function|function|class|const|let|var)/gm, '');
}

function checkJsSyntax(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sanitized = stripModuleSyntax(source);

  try {
    new Function(sanitized);
    return { ok: true };
  } catch (error) {
    return { ok: false, output: String(error && (error.stack || error.message) || error) };
  }
}

let failed = false;
let issueCount = 0;

for (const file of HTML_FILES) {
  const text = fs.readFileSync(file, 'utf8');
  const hits = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (TEXT_PATTERNS.some((pattern) => line.includes(pattern))) {
      hits.push({ line: index + 1, text: line.trim() });
    }
  }
  if (!hits.length) continue;
  failed = true;
  issueCount += hits.length;
  console.log(`HTML ${path.relative(ROOT, file)}`);
  for (const hit of hits.slice(0, 20)) {
    console.log(`  ${hit.line}: ${hit.text}`);
  }
}

const jsFiles = walkJsFiles(ROOT);
for (const file of jsFiles) {
  const result = checkJsSyntax(file);
  if (result.ok) continue;
  failed = true;
  issueCount += 1;
  console.log(`JS ${path.relative(ROOT, file)}`);
  for (const line of result.output.split(/\r?\n/).filter(Boolean).slice(0, 20)) {
    console.log(`  ${line}`);
  }
}

// CSP: una sola definicion, en netlify.toml (vercel.json debe coincidir). Los
// HTML llevan un <meta> que el build genera desde ahi para GitHub Pages, que no
// manda cabeceras; como el navegador aplica ambas, cualquier diferencia
// bloquearia recursos en esa pagina, asi que tiene que ser exactamente la
// version generada (ver tools/csp.js).
const netlifyCsp = leerCspCabecera(ROOT);
const vercelCsp = (JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers || [])
  .flatMap((rule) => rule.headers || [])
  .find((h) => h.key === 'Content-Security-Policy')?.value;
if (!netlifyCsp || netlifyCsp !== vercelCsp) {
  failed = true;
  issueCount += 1;
  console.log('CSP netlify.toml y vercel.json no coinciden (o falta en alguno).');
}
const cspMetaEsperado = netlifyCsp ? cspParaMeta(netlifyCsp) : null;
for (const name of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const metas = [...fs.readFileSync(path.join(ROOT, name), 'utf8')
    .matchAll(/<meta http-equiv=["']Content-Security-Policy["'] content="([^"]*)"/gi)].map((m) => m[1]);
  if (metas.length !== 1 || metas[0] !== cspMetaEsperado) {
    failed = true;
    issueCount += 1;
    console.log(`CSP ${name}: el <meta> de CSP falta, esta repetido o no coincide con netlify.toml. Corré 'npm run build'.`);
  }
}

// ─── Verificaciones de HTML entre páginas ────────────────────────────
// Cubren todos los *.html de la raíz (no solo HTML_FILES):
//  1. enlaces internos rotos: href a un .html propio que no existe (incluye
//     canonical/hreflang al dominio publicado). Case-sensitive como GitHub Pages.
//  2. ids duplicados dentro de un mismo HTML (rompen getElementById y los
//     aria-labelledby / label for).
//  3. data-i18n con una clave que no está en el diccionario "es" de js/core/i18n.js
//     (en pantalla se vería "[clave]").
// Comentarios y <script> inline se ignoran para no tomar ids/links de strings JS.
// Si una de estas verificaciones tuviera falsos positivos legítimos, pasarla a
// WARN_ONLY en vez de borrarla.
const SITE_ORIGINS = ['https://mirudoku.netlify.app/'];
const WARN_ONLY = new Set([]); // p. ej. 'ids' para que solo avise
const ROOT_HTML = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

function loadSpanishI18nKeys() {
  const noop = () => {};
  const document = {
    readyState: 'complete',
    querySelectorAll: () => [],
    documentElement: { setAttribute: noop },
    addEventListener: noop,
    createElement: () => ({}),
    head: { appendChild: noop }
  };
  const storage = { getItem: () => null, setItem: noop, removeItem: noop };
  const window = { document, localStorage: storage, navigator: { language: 'es' }, addEventListener: noop, dispatchEvent: noop };
  const sandbox = { window, document, localStorage: storage, navigator: window.navigator, console, CustomEvent: function () {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core/i18n.js'), 'utf8'), sandbox, { filename: 'js/core/i18n.js' });
  const es = sandbox.window.AppI18n?._translations?.es;
  if (!es) throw new Error('js/core/i18n.js no expuso AppI18n._translations.es');
  return es;
}

function hasI18nKey(dict, key) {
  if (dict[key] != null) return true;
  let current = dict;
  for (const part of key.split('.')) {
    if (current == null) return false;
    current = current[part];
  }
  return current != null && typeof current !== 'object';
}

// Blanquea (sin borrar) comentarios y <script>: así los índices y números de
// línea siguen coincidiendo con el archivo original.
const blank = (chunk) => chunk.replace(/[^\n]/g, ' ');
const stripNonMarkup = (html) => html
  .replace(/<!--[\s\S]*?-->/g, blank)
  .replace(/<script\b[\s\S]*?<\/script>/gi, blank);

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

const htmlIssues = { links: [], ids: [], i18n: [] };
let esDict = null;
try {
  esDict = loadSpanishI18nKeys();
} catch (error) {
  failed = true;
  issueCount += 1;
  console.log(`I18N no se pudo leer el diccionario: ${error.message}`);
}

for (const name of ROOT_HTML) {
  const raw = fs.readFileSync(path.join(ROOT, name), 'utf8');
  const text = stripNonMarkup(raw);

  for (const m of text.matchAll(/\shref=["']([^"']+)["']/gi)) {
    let href = m[1].trim();
    const origin = SITE_ORIGINS.find((o) => href.startsWith(o));
    if (origin) href = href.slice(origin.length);
    else if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue; // externo, mailto:, javascript:
    const target = href.split(/[?#]/)[0].replace(/^\.?\//, '');
    if (!target.endsWith('.html')) continue;
    if (!fs.existsSync(path.join(ROOT, target))) {
      htmlIssues.links.push(`${name}:${lineOf(text, m.index)} enlaza a "${m[1]}", que no existe`);
    }
  }

  const seen = new Map();
  for (const m of text.matchAll(/\sid=["']([^"']+)["']/g)) {
    const id = m[1];
    if (seen.has(id)) {
      htmlIssues.ids.push(`${name}:${lineOf(text, m.index)} id="${id}" repetido (primero en línea ${seen.get(id)})`);
    } else {
      seen.set(id, lineOf(text, m.index));
    }
  }

  if (esDict) {
    for (const m of text.matchAll(/\sdata-i18n=["']([^"']*)["']/g)) {
      const key = m[1].trim();
      if (key && !hasI18nKey(esDict, key)) {
        htmlIssues.i18n.push(`${name}:${lineOf(text, m.index)} data-i18n="${key}" no está en js/core/i18n.js`);
      }
    }
  }
}

const HTML_CHECK_LABELS = {
  links: 'Enlaces internos rotos',
  ids: 'Ids duplicados',
  i18n: 'Claves data-i18n inexistentes'
};
for (const [kind, list] of Object.entries(htmlIssues)) {
  if (!list.length) continue;
  const warnOnly = WARN_ONLY.has(kind);
  console.log(`${warnOnly ? 'AVISO' : 'HTML'} ${HTML_CHECK_LABELS[kind]} (${list.length}):`);
  for (const line of list.slice(0, 30)) console.log(`  ${line}`);
  if (!warnOnly) {
    failed = true;
    issueCount += list.length;
  }
}

if (failed) {
  console.error(`\nQuality check failed: ${issueCount} issue(s) found.`);
  process.exit(1);
}

console.log(`Quality check passed: ${HTML_FILES.length} HTML file(s) and ${jsFiles.length} JS file(s) verified; links, ids and data-i18n checked in ${ROOT_HTML.length} HTML file(s).`);


