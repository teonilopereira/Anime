import os
import re

HTML_PAGES = [
    "index.html", "anime.html", "manga.html", "novelas.html",
    "top.html", "mis-listas.html", "configuracion.html", "comparar.html",
    "usuario.html", "privacidad.html", "terminos.html", "Login.html",
    "404.html", "detalle.html"
]

# This regex matches the whole block of script tags from config.js to common-ui.js
SCRIPT_BLOCK_RE = re.compile(
    r'[ \t]*<script src="js/core/config\.js"></script>.*?<script src="js/core/common-ui\.js" defer></script>',
    re.DOTALL
)

NEW_BLOCK = '''    <script src="js/core/config.js"></script>
    <script src="js/core/namespace.js"></script>
    <script src="js/datos.js" defer></script>
    <script type="module" src="api/supabase-config.js"></script>
    <script src="js/core-bundle.js" defer></script>'''

for page in HTML_PAGES:
    if not os.path.exists(page):
        print(f"SKIP (no existe): {page}")
        continue

    with open(page, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if there's a catalog script block
    if 'js/catalog/pagination.js' not in content:
        print(f"SKIP (sin bloque estándar): {page}")
        continue

    new_content, count = SCRIPT_BLOCK_RE.subn(NEW_BLOCK, content)
    if count == 0:
        print(f"MANUAL: {page} — bloque no reconocido, revisar manualmente")
    else:
        # If the page still has js/script.js, keep it
        with open(page, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"OK ({count} reemplazo/s): {page}")

print("\nListo.")
