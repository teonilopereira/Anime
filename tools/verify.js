const fs = require('fs');

const checks = {
  'index.html': [
    ['Bullet', 'Base de datos \u2022 v2026'],
    ['ANIME icon', '\uD83C\uDFAC'],
    ['MANGA icon', '\uD83D\uDCDA'],
    ['NOVELAS icon', '\uD83D\uDCD6'],
    ['MIS LISTAS icon', '\uD83D\uDC96'],
    ['RANKING icon', '\uD83C\uDFC6'],
  ],
  'configuracion.html': [
    ['CONFIGURACIÓN', 'CONFIGURACIÓN'],
    ['Panel icon personal', '\uD83D\uDCCB'],
    ['Panel icon colores', '\uD83C\uDFA8'],
    ['Panel icon cards', '\uD83C\uDCCF'],
    ['Panel icon fondo', '\uD83D\uDDBC\uFE0F'],
    ['Panel icon apariencia', '\uD83C\uDCB4'],
    ['Panel icon privacidad', '\uD83D\uDD12'],
    ['Argentina flag', 'Argentina \uD83C\uDDE6\uD83C\uDDF7'],
    ['Moon theme', '\uD83C\uDF19 Oscuro'],
    ['Sun theme', '\u2600\uFE0F Claro'],
    ['System theme', '\uD83D\uDCBB Seg\u00FAn'],
    ['Japanese language', '\u65E5\u672C\u8A9E'],
    ['Japan flag', '\uD83C\uDDEF\uD83C\uDDF5'],
    ['Save icon', '\uD83D\uDCBE'],
    ['Delete icon', '\uD83D\uDDD1\uFE0F'],
    ['Warning icon', '\u26A0\uFE0F'],
    ['Reset icon', '\uD83D\uDD04'],
  ],
  'usuario.html': [
    ['Camera icon', '\uD83D\uDCF7'],
    ['Pencil icon', '\u270F\uFE0F'],
    ['Eye icon', '\uD83D\uDC41\uFE0F'],
    ['Stats icon', '\uD83D\uDCCA'],
    ['Session icon', '\uD83D\uDD04'],
    ['Chart icon', '\uD83D\uDCC8'],
    ['Moon icon', '\uD83C\uDF19'],
    ['Arrow right', '\u2192'],
    ['INFORMACIÓN', 'INFORMACIÓN'],
  ],
  'detalle.html': [
    ['CONFIGURACIÓN', 'CONFIGURACIÓN'],
    ['GÉNEROS', 'G\u00C9NEROS'],
    ['Modal close', '\u00D7'],
  ],
  'mis-listas.html': [
    ['Stats icon', '\uD83D\uDCCA'],
    ['Trophy icon', '\uD83C\uDFC6'],
  ],
  'anime.html': [
    ['Search icon', '\uD83C\uDFAC'],
    ['GÉNERO', 'G\u00C9NERO'],
  ],
  'manga.html': [
    ['Search icon', '\uD83C\uDFAC'],
    ['GÉNERO', 'G\u00C9NERO'],
  ],
  'novelas.html': [
    ['Search icon', '\uD83C\uDFAC'],
    ['GÉNERO', 'G\u00C9NERO'],
  ],
  'privacidad.html': [
    ['Última', '\u00DAltima'],
  ],
  'terminos.html': [
    ['Última', '\u00DAltima'],
  ],
};

let allOk = true;
for (const [f, items] of Object.entries(checks)) {
  let c = fs.readFileSync(f, 'utf8');
  for (const [label, pattern] of items) {
    if (c.includes(pattern)) {
      console.log('  OK ' + f + ': ' + label);
    } else {
      console.log('  MISSING ' + f + ': ' + label + ' = ' + JSON.stringify(pattern));
      allOk = false;
    }
  }
}
if (allOk) console.log('\nAll checks passed!');
else console.log('\nSome checks failed!');
