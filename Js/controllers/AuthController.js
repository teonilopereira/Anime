// ==========================================
// js/controllers/AuthController.js
// Único punto de verdad para sesión y usuario.
// Reemplaza: window.getCurrentUser, window.getCurrentUserId,
//            window.refreshUserUi, window.ensureUserUi
// Dispara: auth:ready  auth:login  auth:logout
// ==========================================
(function (window) {
    'use strict';

    // ── Esperar a AppSupabase ──────────────────────────────────────
    function waitForSupabase(maxMs = 8000) {
        if (window.AppSupabase) return Promise.resolve(window.AppSupabase);
        return new Promise((resolve) => {
            const start = Date.now();
            const t = setInterval(() => {
                if (window.AppSupabase) { clearInterval(t); resolve(window.AppSupabase); }
                else if (Date.now() - start > maxMs) { clearInterval(t); resolve(null); }
            }, 100);
        });
    }

    // ── Estado interno ─────────────────────────────────────────────
    let _user = null;
    let _ready = false;

    // ── Helpers de usuario ─────────────────────────────────────────
    function _displayName(user) {
        if (!user) return 'Invitado';
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split('@')[0] : '') ||
            'Usuario'
        );
    }

    function _getId(user) {
        if (!user) return 'Invitado';
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split('@')[0] : '') ||
            user.id ||
            'Usuario'
        );
    }

    function _getAvatar(user) {
        if (!user) return '';
        return user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    }

    // ── Disparar evento ────────────────────────────────────────────
    function _dispatch(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }

    // ── Actualizar UI del botón de login en navbar ─────────────────
    function _updateNavBtn(user) {
        const btn    = document.getElementById('nav-login-btn');
        const avatar = document.getElementById('nav-login-avatar');
        const icon   = document.getElementById('nav-login-icon');
        const label  = document.getElementById('nav-login-label');
        if (!btn) return;

        if (user) {
            const name  = _displayName(user);
            const photo = _getAvatar(user);
            if (label) label.textContent = name;
            btn.href = 'usuario.html';
            btn.setAttribute('aria-label', 'Ver perfil de ' + name);
            if (avatar && photo) {
                avatar.src = photo;
                avatar.alt = name;
                avatar.style.display = 'block';
                if (icon) icon.style.display = 'none';
            }
        } else {
            if (label) label.textContent = 'Ingresar';
            btn.href = 'Login.html';
            btn.setAttribute('aria-label', 'Iniciar sesión');
            if (avatar) avatar.style.display = 'none';
            if (icon)   icon.style.display   = 'block';
        }

        // Compatibilidad con botón viejo (auth-user-btn / userBtn)
        const legacyBtn = document.getElementById('auth-user-btn') ||
                          document.getElementById('userBtn') ||
                          document.getElementById('user-profile');
        if (legacyBtn) {
            legacyBtn.textContent = user ? _displayName(user) : 'Cuenta';
            legacyBtn.classList.toggle('logged-in', !!user);
        }
    }

    // ── Cargar usuario desde Supabase ──────────────────────────────
    async function _loadUser() {
        const client = await waitForSupabase();
        if (!client?.client) return null;
        const { data } = await client.client.auth.getUser();
        return data?.user ?? null;
    }

    // ── Inicializar ────────────────────────────────────────────────
    async function _init() {
        const client = await waitForSupabase();

        _user = await _loadUser();
        _ready = true;

        _updateNavBtn(_user);
        _dispatch('auth:ready', { user: _user });
        if (_user) _dispatch('auth:login', { user: _user });

        // Escuchar cambios de sesión de Supabase
        if (client && typeof client.onAuthChange === 'function') {
            client.onAuthChange(async () => {
                const prev = _user;
                _user = await _loadUser();
                _updateNavBtn(_user);

                if (!prev && _user)  _dispatch('auth:login',  { user: _user });
                if (prev  && !_user) _dispatch('auth:logout', {});
            });
        }

        // Compatibilidad: escuchar el evento viejo de supabase-init
        window.addEventListener('supabase-auth-changed', async () => {
            _user = await _loadUser();
            _updateNavBtn(_user);
        });
    }

    // ── API pública: window.Auth ───────────────────────────────────
    window.Auth = Object.freeze({

        // ¿Está listo el controlador?
        isReady()       { return _ready; },

        // Usuario completo (objeto Supabase)
        getUser()       { return _user; },

        // ¿Está logueado?
        isSignedIn()    { return !!_user; },

        // ID / nombre de usuario (string, nunca null)
        getId()         { return _getId(_user); },

        // Nombre visible
        getName()       { return _displayName(_user); },

        // URL del avatar (string, puede ser '')
        getAvatar()     { return _getAvatar(_user); },

        // Token de acceso (async)
        async getToken() {
            const client = await waitForSupabase();
            if (!client?.client) return null;
            const { data } = await client.client.auth.getSession();
            return data?.session?.access_token ?? null;
        },

        // Forzar recarga del usuario desde Supabase
        async refresh() {
            _user = await _loadUser();
            _updateNavBtn(_user);
            return _user;
        },

        // Cerrar sesión
        async signOut() {
            const client = await waitForSupabase();
            if (client?.client) {
                try { await client.client.auth.signOut(); } catch { /* silent */ }
            }
            if (window.UserStore) window.UserStore.clear();
            _user = null;
            _updateNavBtn(null);
            _dispatch('auth:logout', {});
        },

        // Esperar a que auth:ready se dispare (útil en módulos)
        onReady(cb) {
            if (_ready) { cb(_user); return; }
            window.addEventListener('auth:ready', (e) => cb(e.detail.user), { once: true });
        },
    });

    // ── Compatibilidad con código existente ────────────────────────
    // Mantener las funciones viejas apuntando al controlador
    // para no romper mis-listas.js / detalle.js antes de migrarlos
    window.getCurrentUser   = () => Promise.resolve(_user);
    window.refreshUserUi    = () => { _user && _updateNavBtn(_user); };
    window.ensureUserUi     = () => { _updateNavBtn(_user); };

    // ── Arrancar ───────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', _init);

})(window);
