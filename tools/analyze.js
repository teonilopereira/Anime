const fs = require('fs');
const F = '\uFFFD';

function analyze(relPath) {
  let c = fs.readFileSync(relPath, 'utf8');
  let lines = c.split('\n');
  console.log('=== ' + relPath + ' ===');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(F)) {
      let line = lines[i];
      let idx = line.indexOf(F);
      let chunk = line.substring(idx);
      console.log('  L'+(i+1)+' chunk:', JSON.stringify(chunk));
    }
  }
}
analyze('configuracion.html');
analyze('usuario.html');
analyze('mis-listas.html');
