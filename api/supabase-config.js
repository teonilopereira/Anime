/**
 * supabase-config.js
 * Módulo de autenticación y datos con Supabase.
 * Expone window.AppSupabase con la API pública.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = window.AppConfig?.supabaseUrl
    || process?.env?.VITE_SUPABASE_URL
    || process?.env?.SUPABASE_URL
    || "";
const SUPABASE_ANON = window.AppConfig?.supabaseAnonKey
    || process?.env?.VITE_SUPABASE_ANON_KEY
    || process?.env?.SUPABASE_ANON_KEY
    || "";

if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error("[Supabase] No se encontró la configuración de Supabase. Revisa AppConfig o las variables de entorno.");
    window.AppSupabase = null;
    window.AppSupabaseReady = Promise.resolve(null);
    window.dispatchEvent(new CustomEvent("supabase-auth-changed", { detail: { user: null, username: "" } }));
    throw new Error("[Supabase] Configuración incompleta: supabase-url o supabase-anon-key faltante.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: true
    }
});

// ─── Estado de sesión en memoria ──────────────────────────────────
let _currentUser  = null;
let _sessionReady = false;

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
        const { data: { session } } = await supabase.auth.getSession();
        _currentUser  = session?.user ?? null;
        _sessionReady = true;
    }
    return _currentUser;
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
        photo_url:    user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
        provider:     extra.provider || user.app_metadata?.provider || "email",
        updated_at:   new Date().toISOString()
    };

    const { error } = await supabase
        .from("profiles")
        .upsert(profile, { onConflict: "id" });

    if (error) {
        console.error("Error guardando perfil en Supabase:", error);
        throw new Error(`No se pudo guardar el perfil: ${error.message}`);
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
async function saveItemState({ category, itemId, fav = false, viewed = false, meta = {} }) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Tenés que iniciar sesión.");

    if (!fav && !viewed) {
        const { error } = await supabase
            .from("item_states")
            .delete()
            .eq("user_id", user.id)
            .eq("category", String(category))
            .eq("item_id",  String(itemId));
        if (error) console.warn("saveItemState delete:", error.message);
        return;
    }

    const { error } = await supabase
        .from("item_states")
        .upsert({
            user_id:    user.id,
            category:   String(category || ""),
            item_id:    String(itemId   || ""),
            fav:        !!fav,
            viewed:     !!viewed,
            meta:       meta,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id,category,item_id" });

    if (error) throw error;
}

async function loadItemStates(category = "") {
    const user = await getCurrentUserAsync();
    if (!user) return [];

    let query = supabase
        .from("item_states")
        .select("item_id, fav, viewed, meta")
        .eq("user_id", user.id);

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) { console.warn("loadItemStates:", error.message); return []; }

    return (data || []).map((row) => ({
        item_id: row.item_id,
        fav:     row.fav    ? 1 : 0,
        viewed:  row.viewed ? 1 : 0,
        meta:    row.meta   || {}
    }));
}
 
async function addExperience(delta) {
    const user = await getCurrentUserAsync();
    if (!user) return;
    const { data } = await supabase
        .from('profiles').select('exp').eq('id', user.id).single();
    const newExp = (data?.exp || 0) + delta;
    await supabase.from('profiles')
        .update({ exp: newExp, level: calcLevel(newExp) })
        .eq('id', user.id);
}
// ─── Progreso (episodios / capítulos) ─────────────────────────────
async function setProgress({ category, itemId, key, value }) {
    const user = await getCurrentUserAsync();
    if (!user) throw new Error("Tenés que iniciar sesión.");

    if (value) {
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

// ─── Listener de sesión ────────────────────────────────────────────
const authListeners = new Set();

supabase.auth.onAuthStateChange(async (event, session) => {
    _currentUser  = session?.user ?? null;
    _sessionReady = true;

    if (_currentUser && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
        try { await saveUserProfile(_currentUser); } catch (e) {
            console.warn("No se pudo guardar el perfil en Supabase:", e);
        }
    }

    const detail = { user: _currentUser, username: supabaseUserName(_currentUser) };

    // Notificar a todos los listeners registrados
    authListeners.forEach((fn) => fn(detail));

    // Mantener el mismo nombre de evento para compatibilidad con auth.js
    window.dispatchEvent(new CustomEvent("supabase-auth-changed", { detail }));

    // Si acaba de loguearse via Google redirect, cerrar el modal y limpiar la URL
    if (event === "SIGNED_IN" && _currentUser) {
        document.getElementById("userModal")?.classList.remove("is-open");

        // Limpiar los tokens de la URL que deja Supabase después del redirect
        if (window.location.hash && window.location.hash.includes("access_token")) {
            const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState(null, "", cleanUrl);
        }
    }
});

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
    loadProgress,
    saveItemState,
    saveUserProfile,
    setProgress,
    addExperience,

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

// Exponer con ambos nombres para compatibilidad total
// ==================================================================
// ─── EXPOSICIÓN GLOBAL ULTRA SEGURA ───────────────────────────────
// ==================================================================
window.AppSupabase = AppSupabase;
supabase.auth.getSession().then(({ data: { session } }) => {
    _currentUser = session?.user ?? null;
    _sessionReady = true;
    window.AppSupabaseReady = Promise.resolve(AppSupabase);
    window.dispatchEvent(new CustomEvent("supabase-auth-changed", { detail: { user: _currentUser, username: supabaseUserName(_currentUser) } }));
});