/**
 * auto-html.js
 * Automates HTML consistency across all pages:
 * 1. Replaces footer HTML with <div id="footer-container">
 * 2. Adds common-ui.js to script loading
 * 3. Normalizes config.js (removes defer)
 * 4. Normalizes datos.js position (before importmap)
 * 5. Fixes social icons (X → 𝕏)
 * 6. Fixes accessibility issues (aria-current, alt text)
 *
 * Uso: node tools/auto-html.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HTML_FILES = [
    "anime.html", "manga.html", "novelas.html", "top.html",
    "index.html", "comparar.html", "mis-listas.html",
    "detalle.html", "configuracion.html", "usuario.html",
    "Login.html"
];

// ── Footer replacements ──────────────────────────────────────────
// Each file's exact footer HTML (from the exploration agent output)
const FOOTERS = {};

// Read current footers from files
HTML_FILES.forEach(function (name) {
    const fp = path.join(ROOT, name);
    const c = fs.readFileSync(fp, "utf8");
    // Extract footer (everything between <footer class="app-footer"> and </footer>)
    const m = c.match(/<footer class="app-footer">[\s\S]*?<\/footer>/);
    if (m) FOOTERS[name] = m[0];
});

function replaceFooter(content) {
    // Find <footer class="app-footer">...</footer> and replace with placeholder
    return content.replace(
        /[\t ]*<footer class="app-footer">[\s\S]*?<\/footer>\n?/,
        '    <div id="footer-container"></div>\n'
    );
}

function addCommonUIScript(content) {
    // Add common-ui.js script tag. Put it after auth.js (last infra script before catalog)
    // Pattern: <script src="js/core/auth.js" defer></script>
    // Add after it: <script src="js/core/common-ui.js" defer></script>
    // But Login.html, configuracion.html, usuario.html don't have catalog scripts after auth
    // Better: add as last deferred script before </body>
    return content.replace(
        '</body>',
        '    <script src="js/core/common-ui.js" defer></script>\n</body>'
    );
}

function normalizeConfigJS(content) {
    // Remove defer from config.js: <script src="js/core/config.js" defer> → <script src="js/core/config.js">
    return content.replace(
        '<script src="js/core/config.js" defer>',
        '<script src="js/core/config.js">'
    );
}

function normalizeDatosJS(content) {
    // Move datos.js to right after config.js (before importmap)
    // Step 1: remove datos.js from its current position (if it's after importmap)
    content = content.replace(
        /[\t ]*<script src="js\/datos\.js" defer><\/script>\n?/,
        ''
    );
    // Step 2: add datos.js right after config.js (before importmap)
    content = content.replace(
        '<script src="js/core/config.js">',
        '<script src="js/core/config.js">\n    <script src="js/datos.js" defer>'
    );
    return content;
}

function fixSocialIcons(content) {
    // Replace plain X with 𝕏 in social links
    return content.replace(
        /<a class="app-footer-icon" href="#" aria-label="X">X<\/a>/g,
        '<a class="app-footer-icon" href="#" aria-label="X">𝕏</a>'
    );
}

function fixMangaAltText(content) {
    if (!content.includes('manga.html')) return content;
    // Fix alt="Anime Destiny logo" vs alt=""
    return content.replace(
        '<img src="images/Logo.png" alt="" aria-hidden="true">',
        '<img src="images/Logo.png" alt="Anime Destiny logo" aria-hidden="true">'
    );
}

function fixMangaAccent(content) {
    if (!content.includes('manga.html')) return content;
    return content.replace(
        'Navegacion principal',
        'Navegación principal'
    );
}

function countChanges(content, original) {
    return content !== original;
}

// ── Process all files ────────────────────────────────────────────
HTML_FILES.forEach(function (name) {
    const fp = path.join(ROOT, name);
    let content = fs.readFileSync(fp, "utf8");
    const original = content;
    let changes = [];

    // 1. Replace footer with placeholder
    if (FOOTERS[name]) {
        const before = content;
        content = replaceFooter(content);
        if (content !== before) changes.push("footer");
    }

    // 2. Add common-ui.js script
    let before = content;
    content = addCommonUIScript(content);
    if (content !== before) changes.push("common-ui.js");

    // 3. Normalize config.js (remove defer)
    before = content;
    content = normalizeConfigJS(content);
    if (content !== before) changes.push("config.js defer");

    // 4. Normalize datos.js position
    before = content;
    content = normalizeDatosJS(content);
    if (content !== before) changes.push("datos.js position");

    // 5. Fix social icons
    before = content;
    content = fixSocialIcons(content);
    if (content !== before && !changes.includes("footer")) changes.push("social icons");

    // 6. Fix manga.html specifics
    if (name === "manga.html") {
        before = content;
        content = fixMangaAltText(content);
        if (content !== before) changes.push("alt text");
        before = content;
        content = fixMangaAccent(content);
        if (content !== before) changes.push("accent typo");
    }

    if (changes.length > 0) {
        fs.writeFileSync(fp, content, "utf8");
        console.log("✓ " + name + " (" + changes.join(", ") + ")");
    } else {
        console.log("- " + name + " (sin cambios)");
    }
});

console.log("Listo.");
