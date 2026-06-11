/**
 * config.js
 * 
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. Copia este archivo como: config.js (en la misma carpeta)
 * 2. Reemplaza TU_SUPABASE_URL y TU_SUPABASE_ANON_KEY con tus datos
 * 3. Guarda el archivo
 * 4. ¡Listo! Se cargará automáticamente en todas las páginas
 * 
 * Dónde obtener las credenciales:
 * ─────────────────────────────────
 * Ve a: https://supabase.com/
 * → Inicia sesión en tu proyecto
 * → Haz clic en "Settings" en la esquina inferior izquierda
 * → Haz clic en "API" en el menú lateral
 * → Copia "Project URL" → TU_SUPABASE_URL
 * → Copia "anon (public)" → TU_SUPABASE_ANON_KEY
 * 
 * ═══════════════════════════════════════════════════════════════
 */

window.AppConfig = {
    supabaseUrl: process?.env?.VITE_SUPABASE_URL,           // Ej: https://xyzabc.supabase.co
    supabaseAnonKey: process?.env?.VITE_SUPABASE_ANON_KEY  // Ej: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...
};

console.log("✅ Configuración cargada. Si ves este mensaje, config.js se cargó correctamente.");

// Verificar que las credenciales estén configuradas
if (window.AppConfig.supabaseUrl === process?.env?.VITE_SUPABASE_URL|| 
    window.AppConfig.supabaseAnonKey ===process?.env?.VITE_SUPABASE_ANON_KEY) {
    console.warn("⚠️  Advertencia: Todavía no has configurado tus credenciales de Supabase.");
    console.warn("📝 Por favor, edita el archivo config.js y reemplaza:");
    console.warn("   - TU_SUPABASE_URL con tu URL de Supabase");
    console.warn("   - TU_SUPABASE_ANON_KEY con tu clave anónima");
}
