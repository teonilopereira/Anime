const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
// 8000 es el default de siempre, pero se respeta PORT para poder levantar dos
// instancias a la vez sin que la segunda choque contra la primera.
const PORT = Number(process.env.PORT) || 8000;

// Fuentes que disparan un rebuild. Incluye CSS: antes solo se vigilaba JS, asi
// que editar un .css no regeneraba el bundle y quedaba desincronizado.
const SRC_DIRS = [
    "js/core", "js/catalog", "js/security", "js/ui", "js/utils.js", "js/datos.js",
    "css"
];
const BUNDLE_PATH = path.join(ROOT, "js/core-bundle.js");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".json": "application/json",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
    ".webp": "image/webp",
    ".txt":  "text/plain; charset=utf-8"
};

// ── Auto-rebuild bundle on source changes ──
var rebuildTimer = null;
function rebuildBundle() {
    if (rebuildTimer) return;
    rebuildTimer = setTimeout(function () {
        rebuildTimer = null;
        console.log("Cambio detectado, reconstruyendo...");
        var cp = require("child_process");
        // Un solo paso: tools/build.js concatena, minifica con esbuild y estampa
        // la version. Antes esto llamaba a build-js-bundle.ps1 + minify.js, que
        // ademas de depender de PowerShell reintroducia el bug del minificador
        // casero (se comia espacios dentro de los strings).
        cp.exec('node tools/build.js', { cwd: ROOT }, function (err, stdout, stderr) {
            if (err) {
                console.error("Error al reconstruir:", stderr || err.message);
                return;
            }
            console.log(stdout.trim());
        });
    }, 300);
}

// Los bundles son SALIDA del build: si dispararan un rebuild, el watcher
// entraria en bucle infinito (build escribe -> watcher detecta -> build...).
var GENERADOS = ["bundle.css", "bundle.min.css", "core-bundle.js", "core-bundle.min.js"];

function esFuente(filename) {
    if (!filename) return false;
    var base = path.basename(filename);
    if (GENERADOS.indexOf(base) !== -1) return false;
    return base.endsWith(".js") || base.endsWith(".css");
}

SRC_DIRS.forEach(function (p) {
    var full = path.join(ROOT, p);
    try {
        if (fs.statSync(full).isDirectory()) {
            fs.watch(full, { recursive: true }, function (event, filename) {
                if (esFuente(filename)) rebuildBundle();
            });
        } else {
            fs.watch(full, function (event, filename) {
                rebuildBundle();
            });
        }
    } catch (_) { /* ignore */ }
});

// Watch the bundle itself to inject into HTML for live reload
var clients = [];
function notifyClients() {
    clients.forEach(function (res) { try { res.end("data: reload\n\n"); } catch (_) {} });
    clients = [];
}
fs.watch(BUNDLE_PATH, function () { notifyClients(); });

http.createServer((req, res) => {
    var url = req.url.split("?")[0].split("#")[0];

    // SSE endpoint for live reload
    if (url === "/__reload") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });
        clients.push(res);
        return;
    }

    if (url === "/") url = "/index.html";
    var filePath = path.join(ROOT, url);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    var ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("404 - No encontrado: " + url);
            return;
        }
        var body = data;
        if (ext === ".html") {
            body = data.toString().replace("</body>",
                '<script src="js/reload.js"></script></body>');
        }
        res.writeHead(200, {
            "Content-Type": MIME[ext] || "application/octet-stream",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        });
        res.end(body);
    });
}).listen(PORT, () => {
    console.log("Servidor corriendo en http://localhost:" + PORT);
    console.log("Abrí http://localhost:" + PORT + "/Login.html");
    console.log("Live reload activo — editá source files y el bundle se reconstruye solo.");
    // BOM check — warn if any source file has Byte Order Mark
    var bomFiles = [];
    ["js/core","js/catalog","js/security","js/pages","js/detalle","css","."].forEach(function(dir) {
        try {
            var full = path.join(ROOT, dir);
            fs.readdirSync(full).forEach(function(f) {
                if (!/\.(html|js|css)$/.test(f)) return;
                var fp = path.join(full, f);
                try {
                    var buf = fs.readFileSync(fp);
                    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
                        bomFiles.push(path.relative(ROOT, fp));
                    }
                } catch(_) {}
            });
        } catch(_) {}
    });
    if (bomFiles.length) {
        console.warn("⚠ BOM detectado en:", bomFiles.join(", "));
        console.warn("  Ejecutá: node tools/strip-bom.js");
    }
});
