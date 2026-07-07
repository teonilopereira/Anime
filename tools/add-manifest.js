const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const FILES = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));

FILES.forEach(name => {
  const fp = path.join(ROOT, name);
  let c = fs.readFileSync(fp, "utf8");
  if (c.includes('manifest.json')) return;
  c = c.replace(
    '<link rel="stylesheet"',
    '<link rel="manifest" href="manifest.json">\n    <link rel="stylesheet"'
  );
  fs.writeFileSync(fp, c, "utf8");
  console.log("✓ " + name);
});
