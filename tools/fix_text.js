const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const TARGET_FILES = [
  path.join(ROOT, 'mis-listas.js'),
  path.join(ROOT, 'script.js')
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, text) {
  fs.writeFileSync(filePath, text, 'utf8');
}

function fixMisListas(text) {
  let s = text;
  s = s.replace(/<h3>IniciÃ¡ sesiÃ³n<\/h3>/g, '<h3>Iniciá sesión</h3>');
  s = s.replace(/UsÃ¡ el botÃ³n/g, 'Usá el botón');
  s = s.replace(/No tenÃ©s items/g, 'No tenés items');

  // Reemplaza cualquier variante corrupta del badge (emoji roto) por emoji real.
  s = s.replace(/lists-badge fav">[^<]*Me gusta<\/span>/g, 'lists-badge fav">❤ Me gusta</span>');
  s = s.replace(/lists-badge viewed">[^<]*Visto<\/span>/g, 'lists-badge viewed">👁 Visto</span>');
  return s;
}

function fixScript(text) {
  let s = text;
  s = s.replace(/Iniciar sesiÃ³n/g, 'Iniciar sesión');
  s = s.replace(/ContraseÃ±a/g, 'Contraseña');
  s = s.replace(/EscribÃ­/g, 'Escribí');
  s = s.replace(/sesiÃ³n/g, 'sesión');
  s = s.replace(/contraseÃ±a/g, 'contraseña');
  s = s.replace(/â€¢/g, '•');
  s = s.replace(/â¤/g, '❤');
  s = s.replace(/ðŸ‘/g, '👁');
  return s;
}

const FIXERS = new Map([
  ['mis-listas.js', fixMisListas],
  ['script.js', fixScript]
]);

let changed = 0;
for (const filePath of TARGET_FILES) {
  const base = path.basename(filePath);
  const fixer = FIXERS.get(base);
  if (!fixer) continue;
  const before = read(filePath);
  const after = fixer(before);
  if (after !== before) {
    write(filePath, after);
    changed += 1;
  }
}

console.log(`fix_text.js: archivos modificados = ${changed}`);

