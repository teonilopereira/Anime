/**
 * code-map.js — Mapa del código de Anime Destiny (para triage rápido de bugs).
 *
 * Escanea el proyecto y escribe `code-map.json` en la raíz con, por cada archivo:
 *   - métricas de riesgo: líneas, tests (sí/no), fragilidad (catch/console.error),
 *     llamadas a API externas, TODOs y churn de git;
 *   - un `risk` normalizado 0..1 (grande + sin test + frágil + muy tocado => alto);
 *   - inventario de funciones / APIs públicas (window.*) definidas;
 *   - para las páginas HTML, los scripts que carga.
 * Además un bloque `hotspots` con los archivos de mayor riesgo, para "por dónde empezar".
 *
 * Todo se RECALCULA desde el repo en cada corrida (no queda congelado):
 *   npm run map        # o: node tools/code-map.js
 *
 * Pensado como insumo legible por máquina (agentes / scripts), no como reemplazo
 * de leer el código: el riesgo ACOTA la búsqueda, no señala el bug exacto.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const abs = (...p) => path.join(ROOT, ...p);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/* ---------- descubrir archivos (dinámico) ---------- */
function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (/(^|\/)(node_modules|\.git|vendor|dist)$/.test(rel(p))) continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}
const all = walk(ROOT);
const jsFiles = all.filter(p => {
  const r = rel(p);
  return r.endsWith('.js')
    && !r.includes('/vendor/')
    && !/\.min\.js$/.test(r)
    && !/core-bundle/.test(r)
    && !r.startsWith('tools/')
    && !r.startsWith('tests/')
    && (r.startsWith('js/') || r.startsWith('api/'));
});
const htmlFiles = all.filter(p => rel(p).endsWith('.html') && !rel(p).includes('/'));
const testFiles = all.filter(p => /tests\/.*\.(test|spec)\.js$/.test(rel(p)));

/* ---------- churn (git) ---------- */
const churn = {};
try {
  const out = execSync('git log --pretty=format: --name-only', { cwd: ROOT, maxBuffer: 1e8 }).toString();
  for (let f of out.split(/\n/)) { f = f.trim(); if (f) churn[f] = (churn[f] || 0) + 1; }
} catch { /* sin git: churn = 0 */ }

/* ---------- tests: qué fuentes están cubiertas ---------- */
const testBlob = testFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
function isTested(r) {
  const base = path.basename(r).replace(/\.(js|html)$/, '');
  // cubierto si algún test referencia la ruta o el basename distintivo del módulo
  return testBlob.includes(r) || new RegExp(`[\\W_]${base}[\\W_.]`).test(testBlob);
}

/* ---------- extracción por archivo ---------- */
function countMatches(src, re) { return (src.match(re) || []).length; }
function inventory(src) {
  const seen = new Map(); // name -> line (primera aparición)
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const add = (name, idx) => { if (!seen.has(name)) seen.set(name, lineAt(idx)); };
  let m;
  const reFn = /(?:^|\s)function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = reFn.exec(src))) add(m[1] + '()', m.index);
  const reWin = /window\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = reWin.exec(src))) add('window.' + m[1], m.index);
  const reConst = /(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g;
  while ((m = reConst.exec(src))) add(m[1] + '()', m.index);
  const reMethod = /([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?function/g;
  while ((m = reMethod.exec(src))) add(m[1] + '()', m.index);
  return [...seen.entries()]
    .map(([name, line]) => ({ name, line }))
    .sort((a, b) => a.line - b.line);
}
function scriptsOf(html) {
  const out = [];
  const re = /src=["']((?:js|api)\/[^"']+\.js)(?:\?[^"']*)?["']/g;
  let m;
  while ((m = re.exec(html))) if (!/\/vendor\//.test(m[1])) out.push(m[1]);
  return out;
}

const files = {};
function record(p, kind) {
  const r = rel(p);
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split(/\n/).length;
  const err = countMatches(src, /catch\s*\(|console\.(error|warn)|reportError/g);
  const api = countMatches(src, /fetch\s*\(|anilist|mangadex|graphql|supabase|https?:\/\//gi);
  const todos = countMatches(src, /TODO|FIXME|HACK|XXX|\bBUG\b/g);
  files[r] = {
    kind, lines, err, api, todos,
    tested: isTested(r) ? 1 : 0,
    churn: churn[r] || 0,
    exports: kind === 'js' ? inventory(src) : undefined,
    loads: kind === 'html' ? scriptsOf(src) : undefined,
  };
}
jsFiles.forEach(p => record(p, 'js'));
htmlFiles.forEach(p => record(p, 'html'));

/* ---------- riesgo normalizado ---------- */
const keys = Object.keys(files);
const mx = { lines: 1, err: 1, api: 1, churn: 1, frag: 1 };
for (const k of keys) {
  const f = files[k];
  mx.lines = Math.max(mx.lines, f.lines);
  mx.err = Math.max(mx.err, f.err);
  mx.api = Math.max(mx.api, f.api);
  mx.churn = Math.max(mx.churn, f.churn);
  mx.frag = Math.max(mx.frag, f.err + f.api);
}
let maxRisk = 0;
for (const k of keys) {
  const f = files[k];
  const size = f.lines / mx.lines, frag = (f.err + f.api) / mx.frag,
        ch = f.churn / mx.churn, untested = f.tested ? 0 : 1;
  f.risk = 0.40 * size + 0.22 * frag + 0.13 * ch + 0.25 * untested;
  maxRisk = Math.max(maxRisk, f.risk);
}
for (const k of keys) files[k].risk = +(files[k].risk / maxRisk).toFixed(3);

/* ---------- hotspots (por dónde empezar) ---------- */
const hotspots = keys
  .filter(k => files[k].kind === 'js')
  .sort((a, b) => files[b].risk - files[a].risk)
  .slice(0, 10)
  .map(k => ({
    file: k, risk: files[k].risk, lines: files[k].lines,
    tested: !!files[k].tested, err: files[k].err, api: files[k].api, churn: files[k].churn,
  }));

/* ---------- salida ---------- */
const out = {
  generatedAt: new Date().toISOString(),
  note: 'Riesgo = 0.40*tamaño + 0.22*fragilidad(catch+API) + 0.13*churn + 0.25*(sin test), normalizado 0..1. Acota dónde mirar; no señala el bug exacto. Regenerar con: npm run map',
  summary: {
    jsFiles: jsFiles.length,
    htmlPages: htmlFiles.length,
    totalLines: keys.reduce((a, k) => a + files[k].lines, 0),
    untested: keys.filter(k => files[k].kind === 'js' && !files[k].tested).length,
    functions: keys.reduce((a, k) => a + (files[k].exports ? files[k].exports.length : 0), 0),
  },
  hotspots,
  files,
};
fs.writeFileSync(abs('code-map.json'), JSON.stringify(out, null, 2) + '\n');

console.log(`code-map.json escrito · ${jsFiles.length} JS + ${htmlFiles.length} HTML · ${out.summary.untested} JS sin test`);
console.log('Top hotspots (mayor riesgo):');
for (const h of hotspots.slice(0, 6))
  console.log(`  ${(h.risk * 100).toFixed(0).padStart(3)}%  ${h.file}  (${h.lines} líneas, ${h.tested ? 'con test' : 'SIN TEST'}, ${h.err} err, ${h.api} api, churn ${h.churn})`);
