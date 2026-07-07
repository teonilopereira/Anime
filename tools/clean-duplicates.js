/**
 * clean-duplicates.js
 * Elimina los bloques CSS e inline scripts duplicados de todos los HTMLs,
 * ahora que están centralizados en destiny-navbar.css y auth.js.
 *
 * Uso: node tools/clean-duplicates.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const HTML_FILES = [
    "anime.html", "manga.html", "novelas.html", "top.html",
    "index.html", "comparar.html", "mis-listas.html",
    "detalle.html", "configuracion.html", "usuario.html"
];

// CSS block to remove (lines 17-83 in most files)
const CSS_BLOCK_START = "    <style>\n        /* ── Botón login en navbar ── */";
const CSS_BLOCK_END = "    </style>";

// Inline script to remove (the updateLoginBtn + tryGetUser pattern)
const INLINE_SCRIPT_START = '    <script defer>\n        // ── Botón login: actualizar según estado de sesión ──';
const INLINE_SCRIPT_END = '    </script>';

function removeBlock(content, start, end) {
    const startIdx = content.indexOf(start);
    if (startIdx === -1) return content;
    const endIdx = content.indexOf(end, startIdx);
    if (endIdx === -1) return content;
    return content.slice(0, startIdx) + content.slice(endIdx + end.length);
}

function removeCSSBlock(content) {
    // Try to remove the standard pattern
    let newContent = removeBlock(content, CSS_BLOCK_START, CSS_BLOCK_END);
    // If nothing changed, try index.html variant (different comment)
    if (newContent === content) {
        newContent = removeBlock(content,
            '    <style>\n        /* ── Botón login en navbar ── */',
            '    </style>');
    }
    return newContent;
}

function removeInlineScript(content) {
    let newContent = removeBlock(content, INLINE_SCRIPT_START, INLINE_SCRIPT_END);
    // Also try with different whitespace (some files use slightly different spacing)
    if (newContent === content) {
        newContent = removeBlock(content,
            '        // ── Botón login: actualizar según estado de sesión ──',
            '    </script>');
    }
    return newContent;
}

function processFile(fileName) {
    const filePath = path.join(ROOT, fileName);
    let content = fs.readFileSync(filePath, "utf8");
    const before = content.length;

    // Remove CSS block
    content = removeCSSBlock(content);

    // Remove inline script
    content = removeInlineScript(content);

    // Also remove the duplicate CSS in mis-listas.html (second occurrence)
    if (fileName === "mis-listas.html") {
        // Remove the second CSS block (around line 588-654)
        const secondStart = content.indexOf('    <style>\n        /* ── Botón login en navbar ── */');
        if (secondStart !== -1) {
            content = removeBlock(content,
                '    <style>\n        /* ── Botón login en navbar ── */',
                '    </style>');
        }
    }

    if (content.length !== before) {
        fs.writeFileSync(filePath, content, "utf8");
        console.log(`✓ ${fileName} (${((before - content.length) / before * 100).toFixed(0)}% reducido)`);
    } else {
        console.log(`- ${fileName} (sin cambios)`);
    }
}

HTML_FILES.forEach(processFile);
console.log("Listo.");
