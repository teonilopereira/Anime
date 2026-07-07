/**
 * replace-nav.js
 * Replaces nav-brand, nav-links, and login button HTML with placeholder divs.
 * Run: node tools/replace-nav.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "anime.html", "manga.html", "novelas.html", "top.html",
  "index.html", "comparar.html", "mis-listas.html",
  "detalle.html", "configuracion.html", "usuario.html", "Login.html"
];

FILES.forEach(name => {
  const fp = path.join(ROOT, name);
  let c = fs.readFileSync(fp, "utf8");
  const orig = c;
  const isLogin = name === "Login.html";
  const isConfig = name === "configuracion.html";

  // ── 1. Nav brand ──
  // Matches <a class="nav-brand" ...> ... </a>
  c = c.replace(
    /[\t ]*<a class="nav-brand"[\s\S]*?<\/a>\n?/,
    '        <div id="nav-brand-container"></div>\n'
  );

  // ── 2. Nav links ──
  // Matches <div class="nav-links" ...> ... </div>
  c = c.replace(
    /[\t ]*<div class="nav-links"[\s\S]*?<\/div>\n?/,
    '        <div id="nav-links-container"></div>\n'
  );

  // ── 3. Login button ──
  if (!isLogin) {
    // Replace the <a id="nav-login-btn" ...> ... </a> block
    c = c.replace(
      /[\t ]*<!-- Botón login \/ avatar -->\n?[\t ]*<a id="nav-login-btn"[\s\S]*?<\/a>\n?/,
      '            <div id="nav-login-container"></div>\n'
    );
  }

  // ── 4. Login.html and configuracion.html — add container inside empty nav-actions ──
  if (isLogin || isConfig) {
    // Add nav-login-container inside the empty nav-actions div
    c = c.replace(
      /(<div class="nav-actions">)\s*<\/div>/,
      '$1\n            <div id="nav-login-container"></div>\n        </div>'
    );
  }

  if (c !== orig) {
    fs.writeFileSync(fp, c, "utf8");
    console.log("✓ " + name);
  } else {
    console.log("- " + name + " (sin cambios)");
  }
});

console.log("Listo.");
