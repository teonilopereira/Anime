// ─────────────────────────────────────────────────────────────────────────────
// config.template.js  —  PLANTILLA (este archivo SÍ va a Git)
// ─────────────────────────────────────────────────────────────────────────────
//
// INSTRUCCIONES PARA CONFIGURAR EL PROYECTO:
// ════════════════════════════════════════════════════════════════════════════
//
// 1. Creá un archivo  .env  en la raíz del proyecto con este contenido:
//
//      VITE_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
//      VITE_SUPABASE_ANON_KEY="eyJ..."
//
// 2. Obtené tus credenciales en:
//      https://supabase.com → tu proyecto → Settings → API
//      • "Project URL"      → VITE_SUPABASE_URL
//      • "anon (public)"    → VITE_SUPABASE_ANON_KEY
//
// 3. Generá el archivo config.js real ejecutando:
//
//      node tools/generate-config.js
//
//    Esto creará  js/core/config.js  con tus credenciales.
//    Ese archivo está en .gitignore y NUNCA se sube a Git.
//
// ════════════════════════════════════════════════════════════════════════════

(function (window) {
    "use strict";

    const config = {
        anilistEndpoint: "https://graphql.anilist.co",
        apiBaseUrl:      "",
        supabaseUrl:     "",   // ← Completar via .env + tools/generate-config.js
        supabaseAnonKey: "",   // ← Completar via .env + tools/generate-config.js
        defaultPageSize: 40,
        maxCatalogItems: 40,
        debug:           false,
        cachePrefix:     "animeDestiny"
    };

    window.AppConfig = Object.freeze(config);
})(window);
