const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git', 'node_modules', '.agents']);
let bomCount = 0;
let mojibakeCount = 0;

function scan(dir) {
  const entries = fs.readdirSync(dir);
  for (const f of entries) {
    if (skipDirs.has(f)) continue;
    const fp = path.join(dir, f);
    const s = fs.statSync(fp);
    if (s.isDirectory()) {
      scan(fp);
    } else if (/\.(html|js|css)$/.test(f)) {
      const buf = fs.readFileSync(fp);
      if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        bomCount++;
        console.log('BOM:', path.relative(root, fp));
      }
      const txt = buf.toString('utf8');
      if (/Ã./.test(txt) || /â€/.test(txt)) {
        mojibakeCount++;
        console.log('MOJIBAKE:', path.relative(root, fp));
      }
    }
  }
}

scan(root);
console.log('---');
console.log('BOM files:', bomCount);
console.log('Mojibake files:', mojibakeCount);
if (bomCount === 0 && mojibakeCount === 0) {
  console.log('ALL CLEAN');
}
