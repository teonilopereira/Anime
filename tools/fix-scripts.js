/**
 * fix-scripts.js
 * Fixes the <script src="config.js"> missing </script> bug in all HTML files.
 * Also ensures datos.js is a properly closed script element before importmap.
 * Run: node tools/fix-scripts.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const HTML_FILES = [
  "anime.html", "manga.html", "novelas.html", "top.html",
  "index.html", "comparar.html", "mis-listas.html",
  "detalle.html", "configuracion.html", "usuario.html", "Login.html"
];

HTML_FILES.forEach(name => {
  const fp = path.join(ROOT, name);
  let content = fs.readFileSync(fp, "utf8");
  const orig = content;

  // Fix 1: Ensure config.js has a closing </script> tag
  // Pattern: <script src="js/core/config.js">\n followed by something that is not </script>
  content = content.replace(
    /<script src="js\/core\/config\.js">\n([\t ]*)(?!<\/script>)/g,
    '<script src="js/core/config.js"></script>\n$1'
  );

  // Fix 2: Ensure datos.js is a separate, properly closed script element
  // Remove if datos.js line is inside config.js (i.e., not properly closed)
  // Then add it right after config.js with proper closing
  const hasDatos = content.includes('src="js/datos.js"');
  
  if (!hasDatos) {
    // datos.js might have been swallowed — add it after config.js
    content = content.replace(
      '<script src="js/core/config.js"></script>',
      '<script src="js/core/config.js"></script>\n    <script src="js/datos.js" defer></script>'
    );
  }

  if (content !== orig) {
    fs.writeFileSync(fp, content, "utf8");
    console.log(`✓ Fixed ${name}`);
  } else {
    console.log(`- ${name} (ok)`);
  }
});

console.log("Done.");
