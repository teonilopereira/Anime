/**
 * minify.js — Minificación básica de JS/CSS sin dependencias npm.
 * Uso: node tools/minify.js
 * Genera core-bundle.min.js y bundle.min.css junto a los originales.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function minifyJS(code) {
    let result = '';
    let i = 0;
    const len = code.length;

    // Chars afterwhich a `/` starts a regex literal (not division)
    const regexStarters = new Set('=( [{!&|?:;,+~-^%');

    while (i < len) {
        // Strings literales — preservar
        if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
            const quote = code[i];
            result += code[i++];
            while (i < len && code[i] !== quote) {
                if (code[i] === '\\') { result += code[i++]; }
                result += code[i++];
            }
            if (i < len) result += code[i++];
            continue;
        }
        // Line comments
        if (code[i] === '/' && code[i + 1] === '/') {
            while (i < len && code[i] !== '\n') i++;
            continue;
        }
        // Block comments
        if (code[i] === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        // Regex literals — preservar /.../flags
        if (code[i] === '/' && code[i + 1] !== '/' && code[i + 1] !== '*') {
            // Determinar si es regex (después de operador/keyword) o división
            var prevChar = '';
            for (var j = result.length - 1; j >= 0; j--) {
                if (result[j] !== ' ') { prevChar = result[j]; break; }
            }
            if (!prevChar || regexStarters.has(prevChar)) {
                // Es un regex literal — preservar completo
                result += code[i++]; // /
                while (i < len && code[i] !== '/') {
                    if (code[i] === '\\') { result += code[i++]; }
                    result += code[i++];
                }
                if (i < len) result += code[i++]; // closing /
                // Flags (g, i, m, s, u, y, d)
                while (i < len && /[gimsuyd]/.test(code[i])) {
                    result += code[i++];
                }
                continue;
            }
        }
        // Newlines → espacio
        if (code[i] === '\n') {
            i++;
            while (i < len && (code[i] === ' ' || code[i] === '\t' || code[i] === '\n' || code[i] === '\r')) i++;
            result += ' ';
            continue;
        }
        // Tabs/carriage returns → skip
        if (code[i] === '\t' || code[i] === '\r') { i++; continue; }
        result += code[i++];
    }
    // Eliminar espacios alrededor de puntuación
    return result
        .replace(/\s*([{}();:,.<>=!&|?+\-~%])\s*/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function minifyCSS(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s*([{:;,])\s*/g, '$1')
        .replace(/\s+/g, ' ')
        .replace(/;}/g, '}')
        .trim();
}

function processFile(inputRel, outputRel, minifier, label) {
    const inputPath = path.join(ROOT, inputRel);
    const outputPath = path.join(ROOT, outputRel);

    if (!fs.existsSync(inputPath)) {
        console.warn(`[${label}] No se encontró ${inputRel}, saltando.`);
        return;
    }

    const original = fs.readFileSync(inputPath, 'utf8');
    const minified = minifier(original);

    fs.writeFileSync(outputPath, minified, 'utf8');

    const saving = ((1 - minified.length / original.length) * 100).toFixed(1);
    console.log(`[${label}] ${inputRel} → ${outputRel}`);
    console.log(`  Original:  ${(original.length / 1024).toFixed(1)} KB`);
    console.log(`  Minificado: ${(minified.length / 1024).toFixed(1)} KB`);
    console.log(`  Reducción: ${saving}%`);
}

console.log('=== Minificación de bundles ===\n');

processFile('js/core-bundle.js', 'js/core-bundle.min.js', minifyJS, 'JS');
processFile('css/bundle.css', 'css/bundle.min.css', minifyCSS, 'CSS');

console.log('\nListo. Actualiza las referencias en los HTML para producción.');
