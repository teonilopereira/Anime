const fs = require('fs');
const F = '\uFFFD';

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  for (const [oldStr, newStr] of replacements) {
    if (content.includes(oldStr)) {
      content = content.replaceAll(oldStr, newStr);
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  Fixed: ' + filePath);
  } else {
    console.log('  No changes: ' + filePath);
  }
}

// ====== CONFIGURACION.HTML ======
const configReplacements = [
  // Japanese language
  ['\uFFFD\u2014\uFFFD\uFFFD\u0153\uFFFD\uFFFD\u017E', '\u65E5\u672C\u8A9E'],
  // Moon in oscuro option 
  ['\uFFFD\u0178\u0153\u2122 Oscuro', '\uD83C\uDF19 Oscuro'],
  // Moon standalone  
  ['\uFFFD\u0178\u0153\u2122', '\uD83C\uDF19'],
  // Frame in FONDO panel
  ['\uFFFD\u0178\u2013\uFE0F', '\uD83D\uDDBC\uFE0F'],
  // Brush in bg-mode (COLOR button)
  ['\uFFFD\u0178\u017D' + F, '\uD83C\uDFA8'],
  // Reset button
  ['\uFFFD\u2020\uFFFD RESTAURAR POR DEFECTO', '\uD83D\uDD04 RESTAURAR POR DEFECTO'],
  ['\uFFFD\u2020\uFFFD', '\uD83D\uDD04'],
];

console.log('=== configuracion.html ===');
fixFile('configuracion.html', configReplacements);

// ====== USUARIO.HTML ======
const usuarioReplacements = [
  // Edit icon (pencil) - standalone
  ['title="Editar nombre">\uFFFD\u0153\uFE0F', 'title="Editar nombre">\u270F\uFE0F'],
  // Edit profile button
  ['editProfileBtn">\uFFFD\u0153\uFE0F EDITAR PERFIL', 'editProfileBtn">\u270F\uFE0F EDITAR PERFIL'],
  // Eye icon with VS16 - card icon
  [F + '\u0178\u2018\uFE0F', '\uD83D\uDC41\uFE0F'],
  // Personal info icon in panel 
  [F + '\u0178\u2018' + F, '\uD83D\uDCCB'],
  // Email icon (œ‰)
  ['\uFFFD\u0153\u2030\uFE0F', '\u2709\uFE0F'],
  // Timezone icon (ø•)
  ['\uFFFD\u0178\u2015' + F, '\uD83D\uDD70\uFE0F'],
  // Edit info button
  ['cambiarInfoBtn">\uFFFD\u0153\uFE0F CAMBIAR INFORMACIÓN', 'cambiarInfoBtn">\u270F\uFE0F CAMBIAR INFORMACIÓN'],
  // Stats icon (Ÿ“Š = F0 9F 93 8A → 📊)
  [F + '\u0178\u201C\u0160', '\uD83D\uDCCA'],
  // Stats icon variant  
  [F + '\u0178\u201C\u201E', '\uD83D\uDCCA'],
  // Session icon (Ÿ”“ = F0 9F 94 84 → 🔥)
  [F + '\u0178\u201D\u201E', '\uD83D\uDD25'],
  // Average icon (Ÿ“ˆ = F0 9F 93 88 → 📈)
  [F + '\u0178\u201C\u02C6', '\uD83D\uDCC8'],
  // Stats button  
  [F + '\u0178\u201C\u0160 VER ESTADÍSTICAS DETALLADAS', '\uD83D\uDCCA VER ESTADÍSTICAS DETALLADAS'],
  // Theme moon icon  
  ['\uFFFD\u0178\u0153\u2122', '\uD83C\uDF19'],
  // Activity arrow right
  [F + '\u2020\u2019', '\u2192'],
  // Preview button eye
  ['previewMalBtn">' + F + '\u0178\u2018\uFE0F VISTA PREVIA', 'previewMalBtn">\uD83D\uDC41\uFE0F VISTA PREVIA'],
];

console.log('\n=== usuario.html ===');
fixFile('usuario.html', usuarioReplacements);

// ====== MIS-LISTAS.HTML ======
const listasReplacements = [
  // Stats icon for Actividad sidebar
  [F + '\u0178\u201C\u0160', '\uD83D\uDCCA'],
  // Trophy/ranking icon for Logros
  [F + '\u0178' + F + '\u2020', '\uD83C\uDFC6'],
];

console.log('\n=== mis-listas.html ===');
fixFile('mis-listas.html', listasReplacements);

// ====== INDEX.HTML remaining ======
const indexReplacements = [
  [F + '\u0178' + F + '\u2020', '\uD83C\uDFC6'],
];

console.log('\n=== index.html (remaining) ===');
fixFile('index.html', indexReplacements);

// Verify all files
console.log('\n=== Verification ===');
const files = ['index.html', 'anime.html', 'manga.html', 'novelas.html', 'detalle.html', 
               'usuario.html', 'mis-listas.html', 'privacidad.html', 'terminos.html', 
               'configuracion.html'];
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes(F)) {
    let count = 0;
    for (let ch of c) { if (ch === F) count++; }
    console.log(`  ${f}: ${count} U+FFFD remaining`);
  } else {
    console.log(`  ${f}: CLEAN`);
  }
}
