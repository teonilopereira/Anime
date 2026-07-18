/**
 * supabase-config.js
 * Módulo de autenticación y datos con Supabase.
 * Expone window.AppSupabase con la API pública.
 */

// SDK auto-hospedado (lo empaqueta tools/build.js desde node_modules, version
// fijada en package.json). Antes se importaba desde jsDelivr, lo que exigia
// abrir el CSP a un CDN externo con acceso al JWT en localStorage.
import { createClient } from '../js/vendor/supabase.esm.js';

const runtimeConfig = window.AppConfig || {};

if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
    console.error("[Supabase] No se encontró la configuración de Supabase. Revisa AppConfig o las variables de entorno.");
    window.AppSupabase = null;
    window.AppSupabaseReady = Promise.resolve(null);
    window.dispatchEvent(new CustomEvent("supabase-auth-changed", { detail: { user: null, username: "" } }));
    window.dispatchEvent(new CustomEvent("supabase-ready", { detail: null }));
} else {

const supabase = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
    auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true
    }
});
// ⚠ SEGURIDAD: persistSession=true guarda el token JWT en localStorage
// bajo la clave `sb-<url>-auth-token`. Esto es por diseño de Supabase.
// En un frontend estático (sin backend propio), no es posible usar
// httpOnly cookies. Cualquier script XSS en el mismo origen puede
// leer este token. La mitigación requeriría un proxy backend que
// maneje la sesión con cookies httpOnly.

// ─── Estado de sesión en memoria ──────────────────────────────────
let _currentUser  = null;
let _sessionReady = false;
let _profileCache = null;

// ─── Listener de sesión ────────────────────────────────────────────
// Registrado INMEDIATAMENTE después de createClient para no perder INITIAL_SESSION
const authListeners = new Set();

supabase.auth.onAuthStateChange(async (event, session) => {
    _currentUser  = session?.user ?? null;
    _sessionReady = true;
    if (!_currentUser) _profileCache = null;

    // NOTA: El perfil se crea automáticamente mediante el trigger handle_new_user()
    // en auth.users AFTER INSERT. No es necesario saveUserProfile() aquí.

    const detail = { user: _currentUser, username: supabaseUserName(_currentUser) };

    authListeners.forEach((fn) => fn(detail));

    window.dispatchEvent(new CustomEvent("supabase-auth-changed", { detail }));

    if (_currentUser) {
        queueMicrotask(() => ensureCurrentUserProfile(_currentUser, event));
    }

    if (event === "SIGNED_IN" && _currentUser) {
        var _m = document.getElementById("userModal");
        if (_m) _m.classList.remove("is-open");

        if (window.location.hash && window.location.hash.includes("access_token")) {
            const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState(null, "", cleanUrl);
        }
    }
});

// Recuperar sesión al cargar (getUser verifica con el servidor, no depende de cache local)
supabase.auth.getUser().then(({ data: { user } }) => {
    _currentUser  = user ?? null;
    _sessionReady = true;
    if (_currentUser) {
        queueMicrotask(() => ensureCurrentUserProfile(_currentUser, "getUser"));
        window.dispatchEvent(new CustomEvent("supabase-auth-changed", {
            detail: { user: _currentUser, username: supabaseUserName(_currentUser) }
        }));
    }
}).catch(() => {
    _sessionReady = true;
});

// ─── Helpers ──────────────────────────────────────────────────────
function supabaseUserName(user) {
    if (!user) return "";
    return (
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        (user.email ? user.email.split("@")[0] : "") ||
        user.id ||
        ""
    );
}

function profileUsername(user, fallback = "") {
    return (
        fallback ||
        user?.user_metadata?.username ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        (user?.email ? user.email.split("@")[0] : "") ||
        user?.id ||
        ""
    );
}

async function getCurrentUserAsync() {
    if (!_sessionReady) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            _currentUser  = user ?? null;
        } catch { _currentUser = null; }
        _sessionReady = true;
    }
    return _currentUser;
}

async function ensureCurrentUserProfile(user, source = "") {
    if (!user) return;
    try {
        // Si ya tenemos cache para este usuario, verificar si algo cambió
        if (_profileCache && _profileCache._userId === user.id) {
            const newUsername   = profileUsername(user);
            const newDisplay    = user.user_metadata?.full_name || user.user_metadata?.name || "";
            const newPhoto      = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
            if (_profileCache.username === newUsername &&
                _profileCache.display_name === newDisplay &&
                _profileCache.photo_url === newPhoto) {
                return; // Sin cambios, no escribir
            }
        }
        await saveUserProfile(user);
    } catch (error) {
        console.warn("No se pudo sincronizar el perfil" + (source ? " (" + source + ")" : "") + ":", error.message);
    }
}

// ─── Perfil de usuario ────────────────────────────────────────────
async function saveUserProfile(user, extra = {}) {
    if (!user) return null;
    const requestedUsername = String(extra.username || extra.display_name || "").trim();
    const requestedEmail = String(extra.email || user.email || "").trim();

    const profile = {
        ...extra,
        id:           user.id,
        username:     profileUsername(user, requestedUsername),
        display_name: requestedUsername || user.user_metadata?.full_name || user.user_metadata?.name || "",
        email:        requestedEmail,
        photo_url:    extra.photo_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
        provider:     extra.provider || user.app_metadata?.provider || "email",
        updated_at:   new Date().toISOString()
    };

    const { error } = await supabase
        .from("profiles")
        .upsert(profile, { onConflict: "id" });

    if (error) {
        console.error("Error guardando perfil en Supabase:", error);
        throw new Error("No se pudo guardar el perfil. Intentá de nuevo.");
    }

    // Actualizar cache después de escritura exitosa
    _profileCache = { ...profile, _userId: user.id };

    try {
        await supabase.auth.updateUser({
            data: {
                name: profile.display_name,
                full_name: profile.display_name,
                avatar_url: profile.photo_url,
                picture: profile.photo_url
            }
        });
    } catch (e) {
        console.warn("No se pudo actualizar metadata del auth:", e);
    }

    return profile;
}

// ─── Auth con Google ──────────────────────────────────────────────
async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            queryParams:  { prompt: "select_account" },
            redirectTo:   window.location.origin + window.location.pathname
        }
    });
    if (error) throw error;
    // signInWithOAuth redirige al usuario a Google.
    // Cuando vuelve, detectSessionInUrl lee el token de la URL
    // y onAuthStateChange dispara SIGNED_IN.
    return data;
}

async function signOutGoogle() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// ─── Auth con Email / Contraseña ──────────────────────────────────
async function signUpWithEmail(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username, name: username, full_name: username, email }
        }
    });
    if (error) throw error;
    if (data?.user) {
        const profileData = {
            username: username || email.split("@")[0],
            display_name: username || "",
            email,
            provider: "email"
        };
        try {
            await saveUserProfile(data.user, profileData);
        } catch (profileError) {
            console.warn("Fallo no crítico al guardar perfil inicial en signUp:", profileError.message);
            // No propagamos el error para permitir que continúe el flujo;
            // la base de datos creará el perfil automáticamente mediante el trigger.
        }
    }
    return data;
}

async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    if (data?.user) {
        const profileData = {
            username: data.user.user_metadata?.username || email.split("@")[0],
            email,
            provider: "email"
        };
        try {
            await saveUserProfile(data.user, profileData);
        } catch (profileError) {
            console.warn("Fallo no crítico al actualizar perfil en signIn:", profileError.message);
        }
    }
    return data;
}

// ─── Estados de ítems (fav / viewed) ─────────────────────────────
// save_item_state_v3 agrega watch_status (viendo/pendiente/pausado/abandonado).
// Si la función no existe en la base (migración no aplicada), cae a v2 y el
// estado de seguimiento queda solo en el almacenamiento local.
let _rpcV3Available = true;

async function saveItemState({ category, itemId, fav = false, viewed = false, meta = {}, watchStatus }) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Tenés que iniciar sesión.");

    // meta se pasa como p_item_data para que el RPC lo upsertee en catalog_items.
    // item_states.meta ya no se usa (la función SQL guarda '{}' directamente).
    const itemData = (meta && typeof meta === 'object' && meta.titulo) ? meta : null;

    const baseParams = {
        p_user_id:   user.id,
        p_category:  String(category || ""),
        p_item_id:   String(itemId   || ""),
        p_fav:       !!fav,
        p_viewed:    !!viewed,
        p_item_data: itemData
    };

    if (_rpcV3Available && watchStatus !== undefined) {
        const { error } = await supabase.rpc('save_item_state_v3', {
            ...baseParams,
            p_watch_status: String(watchStatus || "")
        });
        if (!error) return;
        // 42883 = undefined_function; PGRST202 = function not found en PostgREST
        if (error.code === '42883' || error.code === 'PGRST202' || /save_item_state_v3/.test(String(error.message || ''))) {
            _rpcV3Available = false;
        } else {
            throw error;
        }
    }

    const { error } = await supabase.rpc('save_item_state_v2', baseParams);
    if (error) throw error;
}

async function loadItemStates(category = "") {
    const user = await getCurrentUserAsync();
    if (!user) return [];

    // watch_status solo existe si se aplicó la migración; si la columna
    // no está en la vista, reintentar sin ella.
    const buildQuery = (withWatchStatus) => {
        const cols = "id, category, fav, viewed, titulo, img, info, status, updated_at"
            + (withWatchStatus ? ", watch_status" : "");
        let q = supabase.from("item_states_with_details").select(cols);
        if (category) q = q.eq("category", category);
        return q;
    };

    let { data, error } = await buildQuery(true);
    if (error && /watch_status/.test(String(error.message || ''))) {
        ({ data, error } = await buildQuery(false));
    }
    if (error) { console.warn("loadItemStates:", error.message); return []; }

    return (data || []).map((row) => ({
        item_id:   row.id,
        category:  row.category || '',
        fav:       row.fav    ? 1 : 0,
        viewed:    row.viewed ? 1 : 0,
        watch_status: row.watch_status || '',
        meta:      { titulo: row.titulo, img: row.img, info: row.info, status: row.status },
        updated_at: row.updated_at
    }));
}
 
async function addExperience(delta) {
    const user = await getCurrentUserAsync();
    if (!user) return;
    const { error } = await supabase.rpc('add_user_exp', {
        p_user_id: user.id,
        p_delta: Number(delta) || 0
    });
    if (error) console.warn('addExperience RPC falló:', error.message);
}
async function loadProfile() {
    const user = await getCurrentUserAsync();
    if (!user) return null;
    const { data, error } = await supabase
        .from('profiles').select('exp, level, total_likes, total_viewed').eq('id', user.id).single();
    if (error) { console.warn("loadProfile:", error.message); return null; }
    return data || null;
}

// ─── Apodo equipado ───────────────────────────────────────────────
// Consulta separada y resiliente: si la columna 'apodo' todavía no existe
// en la tabla, solo avisa por consola sin romper la carga del perfil.
async function loadApodo() {
    const user = await getCurrentUserAsync();
    if (!user) return null;
    const { data, error } = await supabase
        .from('profiles').select('apodo').eq('id', user.id).single();
    if (error) { console.warn("loadApodo:", error.message); return null; }
    return (data && data.apodo) || null;
}

async function saveApodo(apodo) {
    const user = await getCurrentUserAsync();
    if (!user) return;
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, apodo: String(apodo || ''), updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.warn("saveApodo:", error.message);
}
// ─── Progreso (episodios / capítulos) ─────────────────────────────
async function setProgress({ category, itemId, key, value }) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Tenés que iniciar sesión.");

    if (value) {
        // onConflict coincide con la PK: (user_id, category, item_id, pkey)
        const { error } = await supabase
            .from("progress_keys")
            .upsert({
                user_id:    user.id,
                category:   String(category || ""),
                item_id:    String(itemId   || ""),
                pkey:       String(key      || ""),
                value:      true,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id,category,item_id,pkey" });
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from("progress_keys")
            .delete()
            .eq("user_id",  user.id)
            .eq("category", String(category))
            .eq("item_id",  String(itemId))
            .eq("pkey",     String(key));
        if (error) console.warn("setProgress delete:", error.message);
    }
}

async function loadProgress(category, itemId) {
    const user = await getCurrentUserAsync();
    if (!user) return [];

    const { data, error } = await supabase
        .from("progress_keys")
        .select("pkey, value")
        .eq("user_id",  user.id)
        .eq("category", String(category || ""))
        .eq("item_id",  String(itemId   || ""))
        .eq("value",    true);

    if (error) { console.warn("loadProgress:", error.message); return []; }

    return (data || []).map((row) => ({ pkey: row.pkey, value: 1 }));
}

async function loadAllProgress() {
    const user = await getCurrentUserAsync();
    if (!user) return [];

    const { data, error } = await supabase
        .from("progress_keys")
        .select("category, item_id, pkey, value")
        .eq("user_id", user.id)
        .eq("value", true);

    if (error) { console.warn("loadAllProgress:", error.message); return []; }

    return data || [];
}

// ─── Comentarios ────────────────────────────────────────────────
async function loadComments(category, itemId, refFilter) {
    let query = supabase
        .from("comments")
        .select("id, user_id, body, parent_id, ref_type, ref_number, created_at, updated_at")
        .eq("category", category)
        .eq("item_id", String(itemId))
        .order("created_at", { ascending: false });

    if (refFilter && refFilter.type && refFilter.number) {
        query = query.eq("ref_type", refFilter.type).eq("ref_number", refFilter.number);
    }

    const { data, error } = await query;

    if (error) { console.warn("loadComments:", error.message); return []; }
    if (!data || !data.length) return [];

    // Obtener perfiles de autores (uno por usuario único)
    const userIds = [...new Set(data.map(c => c.user_id))];
    let profilesMap = {};
    if (userIds.length) {
        const { data: profiles } = await supabase
            .rpc("get_profiles_by_ids", { p_ids: userIds });
        if (profiles) {
            profiles.forEach(p => { profilesMap[p.id] = p; });
        }
    }

    return data.map(c => ({
        ...c,
        author: profilesMap[c.user_id] || { username: "Usuario", display_name: "", photo_url: "" }
    }));
}

async function addComment(category, itemId, body, parentId, refType, refNumber) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Debés iniciar sesión para comentar");

    const { data, error } = await supabase
        .from("comments")
        .insert({
            user_id:   user.id,
            category:  category,
            item_id:   String(itemId),
            body:      body.trim(),
            parent_id: parentId || null,
            ref_type:  refType || null,
            ref_number: refNumber || null
        })
        .select("id, user_id, body, parent_id, ref_type, ref_number, created_at, updated_at")
        .single();

    if (error) {
        console.error("addComment:", error);
        throw new Error("No se pudo guardar el comentario");
    }

    // Obtener perfil del autor
    const { data: profiles } = await supabase
        .rpc("get_profiles_by_ids", { p_ids: [user.id] });
    const profile = profiles && profiles[0] ? profiles[0] : null;

    return {
        ...data,
        author: profile || { username: "Usuario", display_name: "", photo_url: "" }
    };
}

async function editComment(commentId, body) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Debés iniciar sesión");

    const { error } = await supabase
        .from("comments")
        .update({ body: body.trim(), updated_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("user_id", user.id);

    if (error) {
        console.error("editComment:", error);
        throw new Error("No se pudo editar el comentario");
    }
}

async function deleteComment(commentId) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Debés iniciar sesión");

    const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

    if (error) {
        console.error("deleteComment:", error);
        throw new Error("No se pudo borrar el comentario");
    }
}

// ─── API pública ──────────────────────────────────────────────────
const AppSupabase = Object.freeze({
    client: supabase,
    auth:   supabase.auth,
    db:     supabase,

    supabaseUserName: supabaseUserName,
    getCurrentUser:     () => getCurrentUserAsync(),
    getCurrentUserSync: () => _currentUser,
    isSignedIn:         () => !!_currentUser,

    loadItemStates,
    loadProfile,
    loadApodo,
    saveApodo,
    loadProgress,
    loadAllProgress,
    saveItemState,
    saveUserProfile,
    setProgress,
    addExperience,

    loadComments,
    addComment,
    editComment,
    deleteComment,

    signInWithGoogle,
    signOutGoogle,
    signInWithEmail,
    signUpWithEmail,

    onAuthChange(listener) {
        if (typeof listener !== "function") return () => {};
        authListeners.add(listener);
        const detail = { user: _currentUser, username: supabaseUserName(_currentUser) };
        listener(detail);
        return () => authListeners.delete(listener);
    }
});

// ==================================================================
// ─── EXPOSICIÓN GLOBAL ────────────────────────────────────────────
// ==================================================================
window.AppSupabase = AppSupabase;
window.AppSupabaseReady = Promise.resolve(AppSupabase);
window.dispatchEvent(new CustomEvent('supabase-ready', { detail: AppSupabase }));
// Disparar evento de sesión inicial en el próximo macrotask,
// después de que los scripts defer hayan registrado sus listeners.
setTimeout(function () {
    window.dispatchEvent(new CustomEvent("supabase-auth-changed", {
        detail: { user: _currentUser, username: supabaseUserName(_currentUser) }
    }));
}, 0);

} // end else (configOk)


