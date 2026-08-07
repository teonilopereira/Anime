// ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR MANUALMENTE
// Generado por: tools/generate-config.cjs  (fuente: .env, en local)
//
// Este archivo SÍ se versiona: el deploy publica los estáticos del repo sin
// correr build, así que la app lo necesita en el árbol para arrancar.
// Solo contiene la clave ANÓNIMA de Supabase (pública por diseño; el acceso a
// los datos lo restringe RLS, ver server/schema.sql) y la clave VAPID pública.
// No hay secretos reales acá. Para cambiar credenciales, editá .env y regenerá
// con `node tools/generate-config.cjs`.

(function (window) {
    "use strict";

    const config = {
        supabaseUrl:     "https://llytokoztnjuczuppzgs.supabase.co",
        supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxseXRva296dG5qdWN6dXBwemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTE2MTcsImV4cCI6MjA5NTU4NzYxN30.jKU5ZoweR3v5TPyn_4TNs6W01Cns3xEZOkleZGg1UNg",
        defaultPageSize: 40,
        maxCatalogItems: 40,
        debug:           false,
        cachePrefix:     "animeDestiny",
        vapidPublicKey:  ""
    };

    window.AppConfig = Object.freeze(config);
})(window);
