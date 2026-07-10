const fs = require('fs');
const F = '\uFFFD';

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let mod = false;
  for (const [oldStr, newStr] of replacements) {
    let c = 0;
    while (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr);
      c++;
      mod = true;
    }
    if (c > 0) console.log(`  Replaced ${c}x: ${JSON.stringify(oldStr.substring(0,25))}`);
  }
  if (mod) fs.writeFileSync(filePath, content, 'utf8');
}

// ====== CONFIGURACION ======
console.log('=== configuracion.html ===');
fixFile('configuracion.html', [
  // Japanese language text
  ['\uFFFD\u2014\uFFFD\uFFFD\u0153\uFFFD\uFFFD\u017E', '\u65E5\u672C\u8A9E'],
  // Moon icon (Œ™ = 8C 99)
  ['\uFFFD\u0178\u0152\u2122', '\uD83C\uDF19'],
  // Frame icon with extra FFFD between dash and VS16
  ['\uFFFD\u0178\u2013\uFFFD\uFE0F', '\uD83D\uDDBC\uFE0F'],
  // Brush/palette  
  ['\uFFFD\u0178\u017D' + F, '\uD83C\uDFA8'],
  // Reset
  ['\uFFFD\u2020\uFFFD', '\uD83D\uDD04'],
]);

// ====== USUARIO ======
console.log('\n=== usuario.html ===');
fixFile('usuario.html', [
  // Pencil edit icon (œ + extra FFFD)
  ['\uFFFD\u0153\uFFFD\uFE0F', '\u270F\uFE0F'],
  // Eye icon (viewed)
  ['\uFFFD\u0178\u2018\uFFFD\uFE0F', '\uD83D\uDC41\uFE0F'],
  // Clipboard (info panel)
  ['\uFFFD\u0178\u2018\uFFFD', '\uD83D\uDCCB'],
  // Envelope (email)
  ['\uFFFD\u0153\u2030\uFE0F', '\u2709\uFE0F'],
  // Clock (timezone) - • is U+2022
  ['\uFFFD\u0178\u2022' + F, '\uD83D\uDD70\uFE0F'],
  // Stats icon (Š = 8A)
  ['\uFFFD\u0178\u201C\u0160', '\uD83D\uDCCA'],
  // Session icon („ = 84)
  ['\uFFFD\u0178\u201D\u201E', '\uD83D\uDD04'],
  // Average chart icon (ˆ = 88)
  ['\uFFFD\u0178\u201C\u02C6', '\uD83D\uDCC8'],
  // Right arrow
  ['\uFFFD\u2020\u2019', '\u2192'],
]);

// ====== MIS-LISTAS ======
console.log('\n=== mis-listas.html ===');
fixFile('mis-listas.html', [
  // Stats icon (Š)
  ['\uFFFD\u0178\u201C\u0160', '\uD83D\uDCCA'],
  // Trophy († with extra FFFD in middle)
  ['\uFFFD\u0178' + F + '\u2020', '\uD83C\uDFC6'],
]);

// ====== VERIFICATION ======
console.log('\n=== Verification ===');
const files = ['index.html', 'anime.html', 'manga.html', 'novelas.html', 'detalle.html',
               'usuario.html', 'mis-listas.html', 'privacidad.html', 'terminos.html',
               'configuracion.html'];
let allClean = true;
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let hasCorruption = false;
  for (let ch of c) { if (ch === F) { hasCorruption = true; break; } }
  if (hasCorruption) {
    // Count occurrences
    let count = 0;
    for (let ch of c) { if (ch === F) count++; }
    console.log(`  ${f}: ${count} U+FFFD remaining ⚠️`);
    allClean = false;
  } else {
    console.log(`  ${f}: CLEAN ✅`);
  }
}
if (allClean) console.log('\nAll files clean! 🎉');
