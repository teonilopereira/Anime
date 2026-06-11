const fs = require('fs');
const path = require('path');

const replacements = {
    'á': 'á',
    'é': 'é',
    'í': 'í', // Note: this is \u00C3\u00AD
    'ó': 'ó',
    'ú': 'ú',
    'ñ': 'ñ',
    'Ã\x81': 'Á',
    'Ã\x89': 'É',
    'Ã\x8D': 'Í',
    'Ã\x93': 'Ó',
    'Ã\x9A': 'Ú',
    'Ã\x91': 'Ñ',
    '•': '•',
    '❤': '❤',
    '👁': '👁',
    'Á': 'Á' // Just in case
};

// Also 'Ó' and 'Á' are common for Ó and Á. In JavaScript strings, Ó is "\u00C3\u201C" because 0x93 in win-1252 is “ (\u201C).
replacements["\u00C3\u201C"] = "Ó"; // Ó
replacements["\u00C3\u201D"] = "Ô"; // Ô
replacements["\u00C3\u00A1"] = "á";
replacements["\u00C3\u00A9"] = "é";
replacements["\u00C3\u00AD"] = "í";
replacements["\u00C3\u00B3"] = "ó";
replacements["\u00C3\u00BA"] = "ú";
replacements["\u00C3\u00B1"] = "ñ";
replacements["\u00C3\u2018"] = "Ñ"; // Ñ

function fixText(content) {
    let newContent = content;
    for (const [bad, good] of Object.entries(replacements)) {
        // Use split/join instead of replaceAll for older Node versions or simply as global replace
        newContent = newContent.split(bad).join(good);
    }
    
    // Also apply the ones from tools/fix_text.js explicitly
    newContent = newContent.split('Iniciar sesión').join('Iniciar sesión');
    newContent = newContent.split('Contraseña').join('Contraseña');
    newContent = newContent.split('Escribí').join('Escribí');
    
    // Sometimes there are invisible characters like the BOM ?<!DOCTYPE html>
    if (newContent.match(/^.*?(<!DOCTYPE html>)/i)) {
        const docTypeMatch = newContent.match(/^.*?(<!DOCTYPE html>)/i)[0];
        if (docTypeMatch !== '<!DOCTYPE html>' && docTypeMatch.includes('?')) {
            newContent = newContent.replace(/^.*?(<!DOCTYPE html>)/i, '<!DOCTYPE html>');
        }
    }
    return newContent;
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && file !== '.git' && file !== 'node_modules') {
            processDirectory(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const newContent = fixText(content);

            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log('Fixed', fullPath);
            }
        }
    }
}

processDirectory(__dirname);
console.log('Done');
