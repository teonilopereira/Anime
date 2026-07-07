const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEXT_PATTERNS = ['Ã', 'â'];
const HTML_FILES = [
  'anime.html',
  'comparar.html',
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

const SKIP_DIRS = new Set(['.git', '.agents', '.codex', 'node_modules']);

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
    if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('.fix-')) {
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

if (failed) {
  console.error(`\nQuality check failed: ${issueCount} issue(s) found.`);
  process.exit(1);
}

console.log(`Quality check passed: ${HTML_FILES.length} HTML file(s) and ${jsFiles.length} JS file(s) verified.`);


