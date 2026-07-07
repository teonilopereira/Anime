const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const files = ["anime.html", "manga.html", "novelas.html"];

files.forEach(name => {
  const fp = path.join(ROOT, name);
  let c = fs.readFileSync(fp, "utf8");
  const orig = c;

  // Remove the modern-pagination block
  c = c.replace(
    /[\t ]*<div class="modern-pagination">[\s\S]*?<\/div>\n?/,
    '    <div id="scroll-sentinel" class="scroll-sentinel"></div>\n'
  );

  if (c !== orig) {
    fs.writeFileSync(fp, c, "utf8");
    console.log("✓ " + name);
  } else {
    console.log("- " + name + " (no match)");
  }
});

console.log("Listo.");
