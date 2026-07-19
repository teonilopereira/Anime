/**
 * supabase-config.js — cargador diferido del cliente de Supabase.
 *
 * El SDK pesa ~216 KB y antes se descargaba en TODAS las páginas, incluso para
 * visitantes anónimos que nunca inician sesión (que son la mayoría del tráfico
 * que llega por buscadores). Ahora sólo se carga cuando hace falta:
 *
 *   - Si hay una sesión guardada en localStorage → se carga enseguida, así el
 *     comportamiento para usuarios logueados queda EXACTAMENTE igual que antes.
 *   - Si no hay sesión → no se descarga nada. Se carga bajo demanda la primera
 *     vez que alguien llama a waitForSupabase() (por ejemplo, al ir a Login).
 *
 * El cliente en sí vive sin cambios en api/supabase-client.js.
 */

let _promesaCarga = null;

/** Importa e inicializa el cliente una sola vez. Devuelve window.AppSupabase. */
function cargarClienteSupabase() {
    if (!_promesaCarga) {
        _promesaCarga = import('./supabase-client.js')
            .then(() => window.AppSupabase || null)
            .catch((e) => {
                console.error('[Supabase] No se pudo cargar el cliente:', e);
                _promesaCarga = null; // permitir reintento
                return null;
            });
    }
    return _promesaCarga;
}

// Punto de entrada para la carga diferida. js/core/auth.js lo usa desde
// waitForSupabase() cuando todavía no hay cliente.
window.__loadSupabase = cargarClienteSupabase;

/**
 * ¿Hay una sesión persistida? Supabase la guarda bajo `sb-<ref>-auth-token`.
 * Se busca por patrón para no depender del id del proyecto.
 */
function haySesionGuardada() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
        }
    } catch (_) { /* localStorage bloqueado */ }
    return false;
}

// La página de login necesita el cliente sí o sí; y si el enlace trae tokens en
// el hash (confirmación de mail, OAuth) hay que procesarlos al vuelo.
const esLogin = /login\.html$/i.test(window.location.pathname);
const hayTokensEnUrl = /access_token=|refresh_token=|[?&]code=/.test(window.location.hash + window.location.search);

/**
 * ¿Tiene sentido cargar el SDK? Si no hay token guardado, no estamos en Login y
 * la URL no trae tokens, entonces con certeza no hay sesión: preguntarle a
 * Supabase costaría 216 KB para recibir "no hay usuario", que ya sabemos.
 * auth.js consulta esto antes de disparar la carga.
 */
window.__puedeHaberSesion = function () {
    return haySesionGuardada() || esLogin || hayTokensEnUrl;
};

if (haySesionGuardada() || esLogin || hayTokensEnUrl) {
    window.AppSupabaseReady = cargarClienteSupabase();
} else {
    // Visitante anónimo: no se descarga el SDK. Este es el mismo estado que la
    // app ya manejaba cuando faltaba configuración, así que los ~63 accesos a
    // window.AppSupabase (casi todos con optional chaining o guarda de nulo)
    // siguen funcionando y degradan a "sin sesión".
    window.AppSupabase = null;
    window.AppSupabaseReady = Promise.resolve(null);
    window.dispatchEvent(new CustomEvent('supabase-auth-changed', { detail: { user: null, username: '' } }));
    window.dispatchEvent(new CustomEvent('supabase-ready', { detail: null }));
}
