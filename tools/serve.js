const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8000;

const SRC_DIRS = [
    "js/core", "js/catalog", "js/security", "js/utils.js", "js/ui.js", "js/datos.js"
];
const BUNDLE_PATH = path.join(ROOT, "js/core-bundle.js");
const BUILD_SCRIPT = path.join(ROOT, "tools/build-js-bundle.ps1");

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
        console.log("Cambio detectado, reconstruyendo bundle...");
        var cp = require("child_process");
        cp.exec(
            'PowerShell -ExecutionPolicy Bypass -File "' + BUILD_SCRIPT + '"',
            { cwd: ROOT },
            function (err, stdout, stderr) {
                if (err) {
                    console.error("Error al reconstruir bundle:", stderr || err.message);
                } else {
                    console.log(stdout.trim());
                }
            }
        );
    }, 300);
}

SRC_DIRS.forEach(function (p) {
    var full = path.join(ROOT, p);
    try {
        if (fs.statSync(full).isDirectory()) {
            fs.watch(full, { recursive: true }, function (event, filename) {
                if (filename && filename.endsWith(".js")) rebuildBundle();
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
                '<script>new EventSource("/__reload").onmessage=function(){location.reload()}</script></body>');
        }
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
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
