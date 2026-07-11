# Script para generar el bundle unificado de JavaScript core-bundle.js
# Ordenado según dependencias de inicialización

$jsFiles = @(
    "js/core/config.js",
    "js/core/i18n.js",
    "js/core/constants.js",
    "js/core/namespace.js",
    "js/core/api.js",
    "js/datos.js",
    "js/core/user-store.js",
    "js/core/data-sync.js",
    "js/core/auth.js",
    "js/core/storage.js",
    "js/security/sanitizer.js",
    "js/security/validator.js",
    "js/utils.js",
    "js/ui.js",
    "js/catalog/states.js",
    "js/catalog/cards.js",
    "js/catalog/search.js",
    "js/catalog/pagination.js",
    "js/core/common-ui.js"
)

$bundle = "/* === Anime Destiny Core Bundle === */`n"
foreach ($f in $jsFiles) {
    if (Test-Path $f) {
        $content = Get-Content $f -Raw -Encoding UTF8
        $bundle += "`n/* ========================================== */`n"
        $bundle += "/* === FILE: $f === */`n"
        $bundle += "/* ========================================== */`n`n"
        $bundle += $content + "`n"
    } else {
        Write-Warning "Archivo no encontrado: $f"
    }
}

# UTF8 without BOM (Set-Content -Encoding UTF8 injects BOM in PS 5.1)
[System.IO.File]::WriteAllText("js/core-bundle.js", $bundle, [System.Text.UTF8Encoding]::new($false))
$size = (Get-Item "js/core-bundle.js").Length
Write-Host "core-bundle.js creado exitosamente: $([math]::Round($size/1024, 1)) KB"
