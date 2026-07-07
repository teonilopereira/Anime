# Script para reemplazar listas de scripts individuales por core-bundle.js en los HTML
# Ejecutar desde la raíz del proyecto

$htmlPages = @(
    "index.html",
    "anime.html",
    "manga.html",
    "novelas.html",
    "top.html",
    "mis-listas.html",
    "configuracion.html",
    "comparar.html",
    "usuario.html",
    "privacidad.html",
    "terminos.html",
    "Login.html",
    "404.html",
    "detalle.html"
)

# Bloque viejo que se repite en catálogos (index, anime, manga, novelas)
$oldCatalogBlock = @'
    <script src="js/core/config.js"></script>
    <script src="js/core/i18n.js"></script>

    <script src="js/core/constants.js"></script>
    <script src="js/core/namespace.js"></script>
    <script src="js/datos.js" defer></script>
<script type="module" src="api/supabase-config.js"></script>
    <script src="js/core/user-store.js" defer></script>
    <script src="js/core/data-sync.js" defer></script>
    <script src="js/core/auth.js" defer></script>
    <script src="js/core/storage.js" defer></script>
    <script src="js/security/sanitizer.js" defer></script>
    <script src="js/security/validator.js" defer></script>
    <script src="js/utils.js" defer></script>
    <script src="js/ui.js" defer></script>
    <script src="js/core/api.js" defer></script>
    <script src="js/catalog/states.js" defer></script>
    <script src="js/catalog/cards.js" defer></script>
    <script src="js/catalog/search.js" defer></script>
    <script src="js/script.js" defer></script>
    <script src="js/catalog/pagination.js" defer></script>

    <script src="js/core/common-ui.js" defer></script>
'@

$newCatalogBlock = @'
    <script src="js/core/config.js"></script>
    <script src="js/core/namespace.js"></script>
    <script src="js/datos.js" defer></script>
    <script type="module" src="api/supabase-config.js"></script>
    <script src="js/core-bundle.js" defer></script>
    <script src="js/script.js" defer></script>
'@

foreach ($page in $htmlPages) {
    if (!(Test-Path $page)) {
        Write-Host "SKIP (no existe): $page"
        continue
    }
    $content = Get-Content $page -Raw -Encoding UTF8
    
    # Reemplazar bloque de catálogos si existe
    if ($content -match [regex]::Escape('<script src="js/core/config.js"></script>')) {
        # Normalizar EOL para matching
        $content = $content -replace '\r\n', "`n"
        $oldNorm  = $oldCatalogBlock -replace '\r\n', "`n"
        $newNorm  = $newCatalogBlock -replace '\r\n', "`n"
        
        if ($content.Contains($oldNorm)) {
            $content = $content.Replace($oldNorm, $newNorm)
            Set-Content $page $content -Encoding UTF8 -NoNewline
            Write-Host "ACTUALIZADO: $page"
        } else {
            Write-Host "MANUAL (bloque distinto): $page — revisar manualmente"
        }
    } else {
        Write-Host "SKIP (sin bloque de scripts core): $page"
    }
}
Write-Host "`nListo."
