/**
 * supabase-config.js
 * Módulo de autenticación y datos con Supabase.
 * Expone window.AppSupabase con la API pública.
 */

// ─── SDK de Supabase (desde bundle UMD cargado por el HTML) ─────────
const createClient = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient
    : null;

if (!createClient) {
    console.error("[Supabase] SDK no disponible en window.supabase. Verificá que el script CDN cargó correctamente antes de supabase-config.js.");
    // Exponer un stub que muestre error claro, evitando que el resto de la app se rompa
    window.AppSupabase = null;
    window.AppSupabaseReady = Promise.resolve(null);
    window.dispatchEvent(new CustomEvent("supabase-auth-changed", { detail: { user: null, username: "" } }));
    throw new Error("[Supabase] SDK no cargado – script detenido.");
}

// ─── CONFIGURACIÓN ─────────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
// ─── Crear el cliente de Supabase ─────────────────────────────────
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

// Leer la sesión al cargar (detecta el token del redirect de Google)
supabase.auth.getSession().then(({ data: { session } }) => {
    _currentUser  = session?.user ?? null;
    _sessionReady = true;
});

// ─── API pública ──────────────────────────────────────────────────
const AppSupabase = Object.freeze({
    client: supabase,
    auth:   supabase.auth,
    db:     supabase,

    supabaseUserName: supabaseUserName,
    getCurrentUser:   () => _currentUser,
    isSignedIn:       () => !!_currentUser,

    loadItemStates,
    loadProgress,
    saveItemState,
    saveUserProfile,
    setProgress,

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

// 1. Registramos a Supabase en el objeto global WINDOW inmediatamente
window.AppSupabase = AppSupabase;
window.AppSupabaseReady = Promise.resolve(AppSupabase);

// 2. Disparamos el evento para avisarle a auth.js que ya despertamos
// (Por si auth.js cargó antes y se quedó esperando)
window.dispatchEvent(new CustomEvent("supabase-auth-changed", {
    detail: { user: _currentUser, username: supabaseUserName(_currentUser) }
}));

// 3. Conectamos la lógica de tus botones una vez asegurado el entorno
window.AppSupabaseReady.then((AppSupabase) => {
    if (!AppSupabase) return;

    // ─── BOTÓN DE GOOGLE ───
    const googleBtn = document.getElementById("btn-google");
    if (googleBtn) {
        googleBtn.addEventListener("click", () => {
            AppSupabase.signInWithGoogle();
        });
    }

    // ─── FORMULARIO DE REGISTRO MANUAL (Email y Contraseña) ───
    const registrarBtn = document.getElementById("btn-registrarse") || document.getElementById("btn-register");
    
    if (registrarBtn) {
        registrarBtn.addEventListener("click", async (e) => {
            e.preventDefault(); // Evita que la página se recargue sola

            // Capturamos las casillas del formulario HTML
            const emailInput = document.getElementById("reg-email") || document.getElementById("auth-email");
            const passwordInput = document.getElementById("reg-password") || document.getElementById("auth-password");

            if (!emailInput || !passwordInput) {
                console.error("No se encontraron los inputs de Email o Contraseña en el HTML. Verificá sus IDs.");
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || password.length < 6) {
                alert("Por favor, ingresá un mail válido y una contraseña de al menos 6 caracteres.");
                return;
            }

            try {
                await AppSupabase.signUpWithEmail(email, password);
                alert("¡Registro iniciado con éxito! Se envió un correo de verificación. Revisá tu casilla (y la carpeta Spam).");
                
                if (typeof window.closeUserModal === "function") {
                    window.closeUserModal();
                }
            } catch (error) {
                alert("Error de Supabase al registrarse: " + error.message);
            }
        });
    }
});