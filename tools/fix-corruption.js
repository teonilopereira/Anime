const fs = require('fs');
const path = require('path');

const F = '\uFFFD';

function fixFile(relPath, replacements) {
  const filePath = path.resolve(relPath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let count = 0;
  for (const [oldStr, newStr] of replacements) {
    if (content.includes(oldStr)) {
      content = content.replaceAll(oldStr, newStr);
      modified = true;
      count++;
    }
  }
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ${relPath}: ${count} replacements`);
  } else {
    console.log(`  ${relPath}: no changes`);
  }
}

// ============================================================
// FIX: index.html
// ============================================================
console.log('\n=== index.html ===');
fixFile('index.html', [
  ['Base de datos ' + F + '\u20AC' + F + ' v2026', 'Base de datos \u2022 v2026'],
  [F + '\u0178\u017D' + F, '\uD83C\uDFAC'],  // 🎬
  [F + '\u0178\u201C\u0161', '\uD83D\uDCDA'], // 📚
  [F + '\u0178\u201C\u2013', '\uD83D\uDCD6'], // 📖
  [F + '\u0178\u201C\u2039', '\uD83D\uDC96'], // 💖
  [F + '\u0178' + F + '\u2020', '\uD83C\uDFC6'], // 🏆
]);

// ============================================================
// FIX: anime.html, manga.html, novelas.html
// ============================================================
for (const f of ['anime.html', 'manga.html', 'novelas.html']) {
  console.log(`\n=== ${f} ===`);
  fixFile(f, [
    [F + '\u0178\u017D' + F, '\uD83C\uDFAC'],
    ['G' + F + '\u2030NERO', 'G\u00C9NERO'],
  ]);
}

// ============================================================
// FIX: detalle.html
// ============================================================
console.log('\n=== detalle.html ===');
fixFile('detalle.html', [
  ['CONFIGURACI' + F + '\u201CN', 'CONFIGURACIÓN'],
  [F + '\u20AC' + F, '\uD83C\uDFAC'],      // 🎬 badge
  [F + '\u0178\u201C\u2013', '\uD83D\uDCD6'], // 📖 volumenes
  [F + '\u0178\u201C\u0152', '\uD83D\uDCCC'], // 📌 estado
  [F + '\u0178\u201D\u2014', '\uD83D\uDD17'], // 🔗 compartir
  [F + '\u0178\u2018' + F, '\uD83D\uDC41'],   // 👁 visto
  [F + '\u2014', '\u00D7'],                    // × close
  ['G' + F + '\u2030NEROS', 'G\u00C9NEROS'],
  ['G\u00C9\u2030NEROS', 'G\u00C9NEROS'],     // in case partial fix
  ['G' + F + '\u2030NEROS' , 'G\u00C9NEROS'], // GÉNEROS
]);

// ============================================================
// FIX: privacidad.html, terminos.html
// ============================================================
for (const f of ['privacidad.html', 'terminos.html']) {
  console.log(`\n=== ${f} ===`);
  fixFile(f, [
    [F + '\u0161ltima', '\u00DAltima'],
  ]);
}

// ============================================================
// FIX: configuracion.html (complete)
// ============================================================
console.log('\n=== configuracion.html ===');

// Helper: same corruption patterns
const P_O = F + '\u201C';
const P_FLAG = F + '\u0178\u2021' + F + F + '\u0178\u2021' + F;
const P_JP = F + '\u2014' + F + F + '\u0153' + F + F + '\u017E';
const P_GEAR = F + '\u0161\u2122\uFE0F';
const P_MOON = F + '\u0178\u0153\u2122';
const P_SUN = F + '\u02DC\u20AC\uFE0F';
const P_SYSTEM = F + '\u0178\u2019' + F;
const P_CHECK = F + '\u0153\u201C';
const P_BRUSH = F + '\u0178\u017D' + F;
const P_LOCK = F + '\u0178\u201D\u2019';
const P_CARD = F + '\u0178\u201D' + F;
const P_FRAME = F + '\u0178\u2013\uFE0F';
const P_CARDS = F + '\u0153' + F;
const P_PERSONAL = F + '\u0178\u2018' + F;
const P_SAVE = F + '\u0178\u2019' + F;
const P_IMPORT = F + '\u0178\u201C' + F;
const P_DEL = F + '\u0178\u2014\u2018\uFE0F';
const P_WARN = F + '\u0161' + F + '\uFE0F';
const P_RESET = F + '\u2020' + F;
const P_DEF = F + '\u0178\u0152\u0152';
const P_EYE = F + '\u0178\u2018\uFE0F';

fixFile('configuracion.html', [
  // --- FIX 1: CONFIGURACIÓN y INFORMACIÓN ---
  ['CONFIGURACI' + P_O + 'N', 'CONFIGURACIÓN'],
  ['INFORMACI' + P_O + 'N', 'INFORMACIÓN'],
  ['INFORMACI' + P_O + 'N PERSONAL', 'INFORMACIÓN PERSONAL'],

  // --- FIX 2: Panel icons (match with context) ---
  [P_PERSONAL + '</span>\r\n                    INFORMACIÓN PERSONAL', '\uD83D\uDCCB</span>\r\n                    INFORMACIÓN PERSONAL'],
  [P_PERSONAL + '</span> INFORMACIÓN PERSONAL', '\uD83D\uDCCB</span> INFORMACIÓN PERSONAL'],
  [P_GEAR + '</span> PREFERENCIAS', '\u2699\uFE0F</span> PREFERENCIAS'],
  [P_BRUSH + '</span> COLORES DE LA APP', '\uD83C\uDFA8</span> COLORES DE LA APP'],
  [P_CARD + '</span> TARJETAS POR FILA', '\uD83C\uDCCF</span> TARJETAS POR FILA'],
  [P_FRAME + '</span> FONDO DE PANTALLA', '\uD83D\uDDBC\uFE0F</span> FONDO DE PANTALLA'],
  [P_CARDS + '</span> APARIENCIA DE CARDS', '\uD83C\uDCB4</span> APARIENCIA DE CARDS'],
  [P_LOCK + '</span> PRIVACIDAD Y DATOS', '\uD83D\uDD12</span> PRIVACIDAD Y DATOS'],

  // --- FIX 3: Country flags ---
  ['Argentina ' + P_FLAG, 'Argentina \uD83C\uDDE6\uD83C\uDDF7'],
  ['M\u00E9xico ' + P_FLAG, 'M\u00E9xico \uD83C\uDDF2\uD83C\uDDFD'],
  ['Espa\u00F1a ' + P_FLAG, 'Espa\u00F1a \uD83C\uDDEA\uD83C\uDDF8'],
  ['Chile ' + P_FLAG, 'Chile \uD83C\uDDE8\uD83C\uDDF1'],
  ['Colombia ' + P_FLAG, 'Colombia \uD83C\uDDE8\uD83C\uDDF4'],
  ['Uruguay ' + P_FLAG, 'Uruguay \uD83C\uDDFA\uD83C\uDDFE'],
  ['Per\u00FA ' + P_FLAG, 'Per\u00FA \uD83C\uDDF5\uD83C\uDDEA'],
  ['Venezuela ' + P_FLAG, 'Venezuela \uD83C\uDDFB\uD83C\uDDEA'],
  ['Ecuador ' + P_FLAG, 'Ecuador \uD83C\uDDEA\uD83C\uDDE8'],
  ['Bolivia ' + P_FLAG, 'Bolivia \uD83C\uDDE7\uD83C\uDDF4'],
  ['Paraguay ' + P_FLAG, 'Paraguay \uD83C\uDDF5\uD83C\uDDFE'],

  // --- FIX 4: Japanese language ---
  [P_JP + '\u201D', '\u65E5\u672C\u8A9E'],
  ['\u65E5\u672C\u8A9E ' + P_FLAG, '\u65E5\u672C\u8A9E \uD83C\uDDEF\uD83C\uDDF5'],

  // --- FIX 5: Save buttons ---
  [P_SAVE + ' GUARDAR INFORMACIÓN', '\uD83D\uDCBE GUARDAR INFORMACIÓN'],
  [P_SAVE + ' GUARDAR PREFERENCIAS', '\uD83D\uDCBE GUARDAR PREFERENCIAS'],
  [P_SAVE + ' GUARDAR APARIENCIA', '\uD83D\uDCBE GUARDAR APARIENCIA'],
  [P_SAVE + ' GUARDAR TODOS LOS CAMBIOS', '\uD83D\uDCBE GUARDAR TODOS LOS CAMBIOS'],
  [P_SAVE + ' GUARDAR</button>', '\uD83D\uDCBE GUARDAR</button>'],

  // --- FIX 6: Theme options ---
  [P_MOON + ' Oscuro', '\uD83C\uDF19 Oscuro'],
  [P_SUN + ' Claro', '\u2600\uFE0F Claro'],
  [P_SYSTEM + ' Seg\u00FAn sistema', '\uD83D\uDCBB Seg\u00FAn sistema'],

  // --- FIX 7: Apply/reset buttons ---
  ['>' + F + ' APLICAR COLORES', '>\u2705 APLICAR COLORES'],
  ['>' + F + ' RESTABLECER', '>\uD83D\uDD04 RESTABLECER'],
  [P_RESET + ' AUTO', '\uD83D\uDD04 AUTO'],

  // --- FIX 8: Background icons ---
  [P_DEF + '</span>', '\uD83C\uDF0C</span>'],
  ['colores' + F + ' APLICAR FONDO', '\u2705 APLICAR FONDO'], // let's be more specific
  [P_CHECK + ' APLICAR FONDO', '\u2705 APLICAR FONDO'],

  // --- FIX 9: Clear/restore background ---
  ['clearFondo\">' + F + '\u2020' + ' RESTAURAR POR DEFECTO', 'clearFondo\">\uD83D\uDD04 RESTAURAR POR DEFECTO'],

  // --- FIX 10: Description text ---
  ['\u00CDconos de ' + P_EYE + ' Visto', '\u00CDconos de \uD83D\uDC41\uFE0F Visto'],
  ['\u00CDconos de ' + F + '\u0178\u2018' + F + ' Visto', '\u00CDconos de \uD83D\uDC41\uFE0F Visto'],

  // --- FIX 11: Privacy buttons ---
  ['exportData\">' + P_IMPORT + ' EXPORTAR MIS DATOS (JSON)', 'exportData\">\uD83D\uDCE5 EXPORTAR MIS DATOS (JSON)'],
  ['deleteUserBtn\">' + P_DEL + ' ELIMINAR USUARIO', 'deleteUserBtn\">\uD83D\uDDD1\uFE0F ELIMINAR USUARIO'],
  ['clearAllBtn\">' + P_WARN + ' BORRAR TODO EL ALMACENAMIENTO', 'clearAllBtn\">\u26A0\uFE0F BORRAR TODO EL ALMACENAMIENTO'],

  // --- FIX 12: Global save/reset buttons ---
  ['resetAll\">' + F + ' RESTABLECER TODO', 'resetAll\">\uD83D\uDD04 RESTABLECER TODO'],
  
  // remaining bg-mode-icon patterns (these don't have the panel icon context)
  // The bg-mode-icon with P_BRUSH should be color palette
]);

// After main fixes, do a second pass for remaining corruption
console.log('\n=== Second pass: checking remaining corruption ===');

const files = ['index.html', 'anime.html', 'manga.html', 'novelas.html', 'detalle.html', 
               'usuario.html', 'mis-listas.html', 'privacidad.html', 'terminos.html', 
               'configuracion.html'];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let count = 0;
  for (let i = 0; i < c.length; i++) {
    if (c[i] === F) { count++; break; }
  }
  if (count > 0) {
    console.log(`  ${f}: STILL HAS CORRUPTION`);
  } else {
    console.log(`  ${f}: CLEAN`);
  }
}
