const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git', 'node_modules', '.agents']);

const win1252ToByte = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
};

function decodeDoubleUTF8(str) {
    let result = '';
    let i = 0;
    let modified = false;
    while (i < str.length) {
        const code = str.charCodeAt(i);
        if (code >= 0xC2 && code <= 0xF4) {
            let numBytes = 1;
            if (code >= 0xE0 && code <= 0xEF) numBytes = 2;
            else if (code >= 0xF0 && code <= 0xF4) numBytes = 3;
            if (i + numBytes < str.length) {
                const bytes = [code];
                let ok = true;
                for (let j = 1; j <= numBytes; j++) {
                    const charCode = str.charCodeAt(i + j);
                    let b = charCode;
                    if (win1252ToByte[charCode] !== undefined) {
                        b = win1252ToByte[charCode];
                    }
                    if (b >= 0x80 && b <= 0xBF) {
                        bytes.push(b);
                    } else {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    const buf = Buffer.from(bytes);
                    const decodedChar = buf.toString('utf8');
                    if (!decodedChar.includes('\uFFFD')) {
                        result += decodedChar;
                        i += numBytes + 1;
                        modified = true;
                        continue;
                    }
                }
            }
        }
        result += str[i];
        i++;
    }
    return { decoded: result, modified };
}

function processFile(filePath) {
    const relativePath = path.relative(ROOT, filePath);
    const buf = fs.readFileSync(filePath);
    
    // Check if valid UTF-8
    const isUtf8 = buf.equals(Buffer.from(buf.toString('utf8'), 'utf8'));
    
    if (!isUtf8) {
        // Step 1: Convert from Latin-1/Windows-1252 to UTF-8
        console.log(`[CONVERT] Decoding ${relativePath} as Latin-1 and saving as UTF-8...`);
        const latin1Text = buf.toString('latin1');
        fs.writeFileSync(filePath, latin1Text, 'utf8');
        return true;
    } else {
        // Step 2: Check for double-encoding UTF-8
        let text = buf.toString('utf8');
        const res = decodeDoubleUTF8(text);
        if (res.modified) {
            console.log(`[DECODE] Fixing double-encoded UTF-8 in ${relativePath}...`);
            fs.writeFileSync(filePath, res.decoded, 'utf8');
            return true;
        }
    }
    return false;
}

function applyLiteralReplacements() {
    // index.html
    const indexFile = path.join(ROOT, 'index.html');
    if (fs.existsSync(indexFile)) {
        let indexText = fs.readFileSync(indexFile, 'utf8');
        const originalText = indexText;
        
        indexText = indexText.replace(/catlogo/g, 'catálogo');
        indexText = indexText.replace(/captulos/g, 'capítulos');
        indexText = indexText.replace(/volmenes/g, 'volúmenes');
        indexText = indexText.replace(/Base de datos  v2026/g, 'Base de datos • v2026');
        indexText = indexText.replace(/navegacin/g, 'navegación');
        indexText = indexText.replace(/Men/g, 'Menú');
        indexText = indexText.replace(/pelculas/g, 'películas');
        indexText = indexText.replace(/Cmics/g, 'Cómics');
        indexText = indexText.replace(/ms/g, 'más');
        indexText = indexText.replace(/Contina/g, 'Continúa');
        indexText = indexText.replace(/Explor/g, 'Exploré');
        indexText = indexText.replace(/guard/g, 'guardé');
        indexText = indexText.replace(/constru/g, 'construí');
        
        if (indexText !== originalText) {
            fs.writeFileSync(indexFile, indexText, 'utf8');
            console.log(`[LITERAL] Corrected replacement characters in index.html`);
        }
    }
    
    // css/components.css
    const cssFile = path.join(ROOT, 'css', 'components.css');
    if (fs.existsSync(cssFile)) {
        let cssText = fs.readFileSync(cssFile, 'utf8');
        const originalText = cssText;
        
        cssText = cssText.replace(/PGINA/g, 'PÁGINA');
        
        if (cssText !== originalText) {
            fs.writeFileSync(cssFile, cssText, 'utf8');
            console.log(`[LITERAL] Corrected replacement characters in css/components.css`);
        }
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (skipDirs.has(file)) continue;
        const stat = fs.statSync(fullPath);
        if (dir === ROOT && (file === 'tools' || file === 'server' || file === 'api')) {
            // Include subdirectories of interest
            walk(fullPath);
        } else if (stat.isDirectory()) {
            walk(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
            processFile(fullPath);
        }
    }
}

console.log('Starting encoding fixes...');
walk(ROOT);
console.log('Applying literal replacements...');
applyLiteralReplacements();
console.log('Encoding fixes complete.');
