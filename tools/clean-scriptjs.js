const fs = require("fs");
const path = require("path");

const fp = path.resolve(__dirname, "..", "js", "script.js");
let c = fs.readFileSync(fp, "utf8");

// Remove the entire duplicate pagination block
// Match from "// L?GICA DE PAGINACI?N" through the second DOMContentLoaded listener
const regex = /\/\/ [\s\S]*?GICA DE PAGINACI[\s\S]*?N Y API[\s\S]*?document\.addEventListener\(['"]DOMContentLoaded['"],\s*restoreCatalogPosition\s*\);\n?/;
const match = c.match(regex);

if (match) {
    const before = c.substring(0, match.index);
    let after = c.substring(match.index + match[0].length);
    
    // Clean up trailing whitespace
    before.replace(/\s+$/, "\n\n");
    
    // Check if there's a supabase-auth-changed listener after
    const remainingListener = after.match(/\/\/ Sincronizar[\s\S]*?cargarEstadosBotones[\s\S]*?;\n?/);
    if (remainingListener) {
        after = after.substring(0, remainingListener.index) + after.substring(remainingListener.index + remainingListener[0].length);
    }
    
    const result = before.trimEnd() + "\n\n// Sincronizar cat\u00E1logo al cambiar la sesi\u00F3n de Supabase\nwindow.addEventListener('supabase-auth-changed', function () {\n    if (typeof cargarEstadosBotones === 'function') cargarEstadosBotones();\n});\n" + after.trimStart();
    
    fs.writeFileSync(fp, result, "utf8");
    console.log("Script.js cleaned successfully");
} else {
    console.log("Regex did not match");
    // Debug: show all lines containing L?GICA
    const lines = c.split("\n");
    lines.forEach(function(line, i) {
        if (line.includes("GICA") || line.includes("PAGINACI")) {
            console.log("Line " + (i+1) + ": " + line.substring(0, 80));
        }
    });
}
