/**
 * supabase-init.js
 * Inicializa Supabase y mantiene la sesión persistente en todas las páginas
 * Se carga ANTES que auth.js
 */

(function(window) {
    "use strict";

    // URL del CDN de Supabase JS
    const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    let _supabaseClient = null;
    let _currentUser = null;
    let _isSessionReady = false;

    // Esperar a que Supabase esté disponible desde el CDN
    async function loadSupabaseFromCDN() {
        if (window.supabase) return window.supabase;
        
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = SUPABASE_CDN + "/dist/umd/supabase.js";
            script.onload = () => {
                const supabase = window.supabase || window.supabaseLib;
                resolve(supabase);
            };
            script.onerror = () => {
                console.error("[Supabase] No se pudo cargar desde CDN");
                resolve(null);
            };
            document.head.appendChild(script);
        });
    }

    async function initSupabaseClient() {
        if (_supabaseClient) return _supabaseClient;

        // Obtener credenciales desde AppConfig (setear en cada HTML antes de este script)
        const SUPABASE_URL = window.AppConfig?.supabaseUrl || "";
        const SUPABASE_ANON = window.AppConfig?.supabaseAnonKey || "";

        if (!SUPABASE_URL || !SUPABASE_ANON) {
            console.warn("[Supabase] Credenciales no configuradas. Funcionando en modo invitado.");
            return null;
        }

        // Cargar Supabase JS si no está disponible
        const supabaseLib = await loadSupabaseFromCDN();
        if (!supabaseLib || !supabaseLib.createClient) {
            console.error("[Supabase] No se pudo inicializar");
            return null;
        }

        // Crear cliente
        _supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage // Usar localStorage para persistir sesión
            }
        });

        // Escuchar cambios de sesión
        _supabaseClient.auth.onAuthStateChange((event, session) => {
            _currentUser = session?.user || null;
            _isSessionReady = true;
            
            // Disparar evento global
            window.dispatchEvent(new CustomEvent("supabase-auth-changed", {
                detail: { user: _currentUser, event }
            }));

            // Limpiar URL si viene de redirect de Google
            if (event === "SIGNED_IN" && _currentUser) {
                if (window.location.hash && window.location.hash.includes("access_token")) {
                    const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
                    window.history.replaceState(null, "", cleanUrl);
                }
            }

            console.log("[Supabase] Auth cambió:", event, _currentUser?.email);
        });

        // Recuperar sesión existente
        const { data: { session } } = await _supabaseClient.auth.getSession();
        _currentUser = session?.user || null;
        _isSessionReady = true;

        return _supabaseClient;
    }

    // API pública simplificada
    window.AppSupabase = {
        // Obtener cliente de Supabase
        async getClient() {
            return await initSupabaseClient();
        },

        // Obtener usuario actual
        async getCurrentUser() {
            if (!_isSessionReady) {
                await initSupabaseClient();
            }
            return _currentUser;
        },

        // Verificar si está logueado
        isSignedIn() {
            return !!_currentUser;
        },

        // Obtener nombre de usuario
        getUserName() {
            if (!_currentUser) return "Invitado";
            return (
                _currentUser.user_metadata?.username ||
                _currentUser.user_metadata?.name ||
                _currentUser.user_metadata?.full_name ||
                (_currentUser.email ? _currentUser.email.split("@")[0] : "Usuario")
            );
        },

        // Obtener avatar
        getAvatar() {
            return _currentUser?.user_metadata?.avatar_url || 
                   _currentUser?.user_metadata?.picture || "";
        },

        // Sign in con Google
        async signInWithGoogle() {
            const client = await initSupabaseClient();
            if (!client) throw new Error("Supabase no está disponible");
            
            const { data, error } = await client.auth.signInWithOAuth({
                provider: "google",
                options: {
                    queryParams: { prompt: "select_account" },
                    redirectTo: window.location.origin + window.location.pathname
                }
            });
            
            if (error) throw error;
            return data;
        },

        // Sign in con Email/Contraseña
        async signInWithEmail(email, password) {
            const client = await initSupabaseClient();
            if (!client) throw new Error("Supabase no está disponible");
            
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            _currentUser = data?.user || null;
            _isSessionReady = true;
            
            return data;
        },

        // Crear cuenta
        async signUpWithEmail(email, password, username) {
            const client = await initSupabaseClient();
            if (!client) throw new Error("Supabase no está disponible");
            
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        name: username,
                        full_name: username
                    }
                }
            });
            
            if (error) throw error;
            
            if (data?.user) {
                _currentUser = data.user;
                _isSessionReady = true;
            }
            
            return data;
        },

        // Sign out
        async signOut() {
            const client = await initSupabaseClient();
            if (!client) throw new Error("Supabase no está disponible");
            
            const { error } = await client.auth.signOut();
            if (error) throw error;
            
            _currentUser = null;
            return true;
        },

        // Guardar estado de item (me gusta / visto)
        async saveItemState(category, itemId, fav = false, viewed = false, meta = {}) {
            const client = await initSupabaseClient();
            if (!client) throw new Error("Supabase no está disponible");
            if (!_currentUser) throw new Error("Debes iniciar sesión");

            if (!fav && !viewed) {
                // Eliminar si no hay nada marcado
                const { error } = await client
                    .from("item_states")
                    .delete()
                    .eq("user_id", _currentUser.id)
                    .eq("category", String(category))
                    .eq("item_id", String(itemId));
                
                if (error) console.warn("Error eliminando estado:", error);
                return;
            }

            const { error } = await client
                .from("item_states")
                .upsert({
                    user_id: _currentUser.id,
                    category: String(category),
                    item_id: String(itemId),
                    fav: !!fav,
                    viewed: !!viewed,
                    meta: meta,
                    updated_at: new Date().toISOString()
                }, { onConflict: "user_id,category,item_id" });

            if (error) throw error;
        },

        // Cargar estados de items
        async loadItemStates(category = null) {
            const client = await initSupabaseClient();
            if (!client) return [];
            if (!_currentUser) return [];

            let query = client
                .from("item_states")
                .select("item_id, category, fav, viewed, meta")
                .eq("user_id", _currentUser.id);

            if (category) {
                query = query.eq("category", category);
            }

            const { data, error } = await query;
            if (error) {
                console.warn("Error cargando estados:", error);
                return [];
            }

            return data || [];
        },

        // Cargar perfil del usuario
        async loadUserProfile() {
            const client = await initSupabaseClient();
            if (!client) return null;
            if (!_currentUser) return null;

            const { data, error } = await client
                .from("profiles")
                .select("*")
                .eq("id", _currentUser.id)
                .single();

            if (error) {
                console.warn("Error cargando perfil:", error);
                return null;
            }

            return data;
        },

        // Guardar perfil del usuario
        async saveUserProfile(profileData = {}) {
            const client = await initSupabaseClient();
            if (!client) return null;
            if (!_currentUser) return null;

            const profile = {
                id: _currentUser.id,
                username: profileData.username || 
                          _currentUser.user_metadata?.username ||
                          _currentUser.email?.split("@")[0] || "usuario",
                email: _currentUser.email,
                photo_url: _currentUser.user_metadata?.avatar_url || "",
                level: profileData.level || 1,
                exp: profileData.exp || 0,
                updated_at: new Date().toISOString(),
                ...profileData
            };

            const { error } = await client
                .from("profiles")
                .upsert(profile, { onConflict: "id" });

            if (error) {
                console.warn("Error guardando perfil:", error);
                return null;
            }

            return profile;
        }
    };

    // Inicializar automáticamente al cargar
    window.addEventListener("DOMContentLoaded", () => {
        initSupabaseClient().catch(err => console.warn("[Supabase] Error en init:", err));
    });

    // También intentar inicializar inmediatamente
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initSupabaseClient().catch(err => console.warn("[Supabase] Error en init:", err));
        });
    } else {
        initSupabaseClient().catch(err => console.warn("[Supabase] Error en init:", err));
    }

})(window);
