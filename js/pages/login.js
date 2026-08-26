(function () {
    "use strict";

    // Traducción con fallback al español si i18n aún no cargó.
    function loginTr(key, fallback, args) {
        if (window.AppI18n && typeof window.AppI18n.t === 'function') {
            const out = window.AppI18n.t(key, args);
            if (out && out.charAt(0) !== '[') return out;
        }
        return fallback;
    }

    const form = document.getElementById("loginForm");
    const title = document.getElementById("loginTitle");
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const usernameField = document.getElementById("usernameField");
    const usernameInput = document.getElementById("usernameInput");
    const emailInput = document.getElementById("emailInput");
    const passwordInput = document.getElementById("passwordInput");
    const submitBtn = document.getElementById("submitBtn");
    const googleBtn = document.getElementById("googleBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const status = document.getElementById("loginStatus");
    function isFileProtocol() { return window.location.protocol === "file:"; }
    let mode = "login";

    // ── Volver a la página desde donde se abrió el login ───────────────
    // Guardamos la URL de origen para regresar ahí después de iniciar sesión
    // (incluido el rodeo de Google OAuth, que recarga Login.html al volver).
    const RETURN_KEY = "ad-login-return";
    // ¿Volvemos de Google/confirmación de correo? La URL trae tokens/código.
    const returningFromOAuth = /access_token=|refresh_token=|[?&]code=/.test(
        window.location.hash + window.location.search
    );
    let oauthRedirectDone = false;

    // Devuelve una ruta interna segura (mismo origen y distinta de login), o "".
    function sanitizeReturnUrl(url) {
        if (!url) return "";
        try {
            const u = new URL(url, window.location.href);
            if (u.origin !== window.location.origin) return "";
            const file = (u.pathname.split("/").pop() || "").toLowerCase();
            if (file === "login.html") return "";
            return u.pathname + u.search + u.hash;
        } catch (_) {
            return "";
        }
    }

    function storeReturnUrl(url) {
        const clean = sanitizeReturnUrl(url);
        if (!clean) return;
        try { sessionStorage.setItem(RETURN_KEY, clean); } catch (_) {}
        try { localStorage.setItem(RETURN_KEY, clean); } catch (_) {}
    }

    function clearReturnUrl() {
        try { sessionStorage.removeItem(RETURN_KEY); } catch (_) {}
        try { localStorage.removeItem(RETURN_KEY); } catch (_) {}
    }

    function getStoredReturnUrl() {
        try {
            const s = sessionStorage.getItem(RETURN_KEY);
            if (s) return s;
        } catch (_) {}
        try {
            return localStorage.getItem(RETURN_KEY) || "";
        } catch (_) {
            return "";
        }
    }

    // Ruta a la que volver tras iniciar sesión (fallback: inicio).
    function resolveReturnUrl() {
        return getStoredReturnUrl() || "index.html";
    }

    function redirectToReturn() {
        const target = resolveReturnUrl();
        clearReturnUrl();
        window.location.href = target;
    }

    // En una llegada nueva a login (no volviendo de OAuth), recordamos la
    // página de origen. Prioridad: ?return=..., luego el referente.
    if (!returningFromOAuth) {
        let origin = "";
        try {
            origin = new URLSearchParams(window.location.search).get("return") || "";
        } catch (_) {}
        origin = sanitizeReturnUrl(origin) || sanitizeReturnUrl(document.referrer);
        if (origin) storeReturnUrl(origin);
        else clearReturnUrl(); // evitar quedarnos con un destino viejo
    }

    function setStatus(message) {
        status.textContent = message || "";
    }

    function setMode(nextMode) {
        mode = nextMode;
        const isRegister = mode === "register";
        tabLogin.classList.toggle("is-active", !isRegister);
        tabRegister.classList.toggle("is-active", isRegister);
        usernameField.classList.toggle("is-hidden", !isRegister);
        usernameInput.required = isRegister;
        passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
        title.textContent = isRegister ? loginTr('login.msg.crear_cuenta', "Crear cuenta") : loginTr('login.msg.iniciar_sesion', "Iniciar sesión");
        submitBtn.textContent = isRegister ? loginTr('login.msg.crear_cuenta', "Crear cuenta") : loginTr('login.msg.entrar', "Entrar");
        setStatus("");
    }

    function userDisplayName(user) {
        if (!user) return "";
        return user.user_metadata?.username
            || user.user_metadata?.name
            || user.user_metadata?.full_name
            || (user.email ? user.email.split("@")[0] : "")
            || loginTr('nav.usuario', "Usuario");
    }

    // Adapta el panel según haya sesión o no: invitado ve el formulario y
    // NO ve "Cerrar sesión"; logueado ve solo su estado + "Cerrar sesión".
    function applyAuthState(user) {
        const loggedIn = !!user;
        const tabsEl = document.querySelector(".login-tabs");
        const emailField = emailInput ? emailInput.closest(".login-field") : null;
        const passField = passwordInput ? passwordInput.closest(".login-field") : null;

        if (tabsEl) tabsEl.style.display = loggedIn ? "none" : "";
        if (usernameField) usernameField.style.display = loggedIn ? "none" : "";
        if (emailField) emailField.style.display = loggedIn ? "none" : "";
        if (passField) passField.style.display = loggedIn ? "none" : "";
        submitBtn.style.display = loggedIn ? "none" : "";
        googleBtn.style.display = loggedIn ? "none" : "";
        logoutBtn.style.display = loggedIn ? "" : "none";

        if (loggedIn) {
            title.textContent = loginTr('login.msg.tu_cuenta', "Tu cuenta");
            setStatus(loginTr('login.msg.conectado', "Conectado como {name}.", { name: userDisplayName(user) }));
        } else {
            title.textContent = mode === "register" ? loginTr('login.msg.crear_cuenta', "Crear cuenta") : loginTr('login.msg.iniciar_sesion', "Iniciar sesión");
        }
    }

    async function getClient() {
        if (window.AppSupabase) return window.AppSupabase;
        if (window.AppSupabaseReady) return await window.AppSupabaseReady;
        if (typeof window.waitForSupabase === 'function') return await window.waitForSupabase();
        return new Promise((resolve) => {
            let waited = 0;
            const t = setInterval(() => {
                waited += AnimeDestiny.Constants.POLL_INTERVAL_MS || 100;
                if (window.AppSupabase) { clearInterval(t); resolve(window.AppSupabase); return; }
                if (waited >= (AnimeDestiny.Constants.SUPABASE_WAIT_TIMEOUT_MS || 8000)) { clearInterval(t); resolve(null); }
            }, 100);
        });
    }

    function saveLocalUser() {
        if (typeof window.refreshUserUi === "function") window.refreshUserUi();
    }

    function describeSupabaseUnavailableReason() {
        if (window.location.protocol === "file:") {
            return loginTr('login.msg.file_protocol', "Abrí la página con un servidor local (node tools/serve.cjs). Supabase no funciona bien desde file://.");
        }
        if (!window.AppConfig?.supabaseUrl || !window.AppConfig?.supabaseAnonKey) {
            return loginTr('login.msg.falta_config', "Falta la configuración de Supabase en js/core/config.js.");
        }
        if (navigator.onLine === false) {
            return loginTr('login.msg.sin_red', "No hay conexión de red.");
        }
        if (!window.AppSupabase && !window.AppSupabaseReady) {
            return loginTr('login.msg.no_cargo', "No se cargó Supabase. Revisá la conexión o abrí la app desde un servidor local.");
        }
        return loginTr('login.msg.no_disponible', "Supabase no está disponible. Revisá la conexión y recargá la página.");
    }

    function goHomeSoon() {
        let redirected = false;
        function doRedirect() {
            if (redirected) return;
            redirected = true;
            redirectToReturn();
        }
        window.addEventListener("supabase-auth-changed", function handler(e) {
            if (e.detail?.user) {
                window.removeEventListener("supabase-auth-changed", handler);
                setTimeout(doRedirect, AnimeDestiny.Constants.LOGIN_REDIRECT_DELAY_MS || 200);
            }
        });
        setTimeout(doRedirect, AnimeDestiny.Constants.LOGIN_FALLBACK_REDIRECT_MS || 1500);
    }

    tabLogin.addEventListener("click", () => setMode("login"));
    tabRegister.addEventListener("click", () => setMode("register"));

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const client = await getClient();
        if (!client) {
            setStatus(describeSupabaseUnavailableReason());
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const username = usernameInput.value.trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setStatus(loginTr('login.msg.correo_invalido', "Ingresá un correo válido."));
            return;
        }
        if (password.length < (AnimeDestiny.Constants.MIN_PASSWORD_LENGTH || 6)) {
            setStatus(loginTr('login.msg.pass_corta', "La contraseña debe tener al menos 6 caracteres."));
            return;
        }
        if (mode === "register" && username.length < (AnimeDestiny.Constants.MIN_USERNAME_LENGTH || 3)) {
            setStatus(loginTr('login.msg.usuario_corto', "El usuario debe tener al menos 3 caracteres."));
            return;
        }

        submitBtn.disabled = true;
        setStatus(mode === "register" ? loginTr('login.msg.creando', "Creando cuenta...") : loginTr('login.msg.iniciando', "Iniciando sesión..."));

        try {
            if (mode === "register") {
                const data = await client.signUpWithEmail(email, password, username);
                saveLocalUser();
                if (data?.session) {
                    setStatus(loginTr('login.msg.cuenta_entrando', "Cuenta creada. Entrando..."));
                    goHomeSoon();
                } else {
                    setStatus(loginTr('login.msg.cuenta_confirmar', "Cuenta creada. Revisá tu correo para confirmarla."));
                }
            } else {
                const data = await client.signInWithEmail(email, password);
                saveLocalUser();
                setStatus(loginTr('login.msg.sesion_iniciada', "Sesión iniciada."));
                goHomeSoon();
            }
        } catch (error) {
            const message = String(error?.message || "");
            if (message.toLowerCase().includes("invalid login")) {
                setStatus(loginTr('login.msg.credenciales', "Correo o contraseña incorrectos."));
            } else if (message.toLowerCase().includes("email not confirmed")) {
                setStatus(loginTr('login.msg.no_confirmado', "Confirmá tu correo antes de iniciar sesión."));
            } else {
                setStatus(loginTr('login.msg.error', "Error: {message}", { message: message }));
            }
        } finally {
            submitBtn.disabled = false;
        }
    });

    googleBtn.addEventListener("click", async () => {
        const client = await getClient();
        if (!client) {
            setStatus(describeSupabaseUnavailableReason());
            return;
        }
        if (typeof client.signInWithGoogle !== 'function') {
            setStatus(loginTr('login.msg.google_no', "El inicio con Google no está habilitado en esta configuración."));
            return;
        }
        setStatus(loginTr('login.msg.abriendo_google', "Abriendo Google..."));
        try {
            await client.signInWithGoogle();
        } catch (error) {
            setStatus(loginTr('login.msg.google_error', "No se pudo iniciar con Google: {message}", { message: error?.message || "" }));
        }
    });

    logoutBtn.addEventListener("click", async () => {
        const client = await getClient();
        try {
            if (client?.signOutGoogle) await client.signOutGoogle();
        } finally {
            if (typeof window.refreshUserUi === "function") window.refreshUserUi();
            applyAuthState(null);
            setStatus(loginTr('login.msg.sesion_cerrada', "Sesión cerrada."));
        }
    });

    if (isFileProtocol()) {
        setStatus(loginTr('login.msg.file_warn', "⚠️ Estás usando file://. Usá un servidor local: node tools/serve.cjs"));
    }

    // Reaccionar al estado de sesión (se dispara de inmediato con el estado actual)
    getClient().then((client) => {
        if (client?.onAuthChange) {
            client.onAuthChange((detail) => {
                applyAuthState(detail?.user || null);
                if (detail?.user) {
                    saveLocalUser();
                    // Volvimos de Google (o confirmación de correo) y ya hay
                    // sesión: regresamos a la página desde donde se abrió login.
                    if (returningFromOAuth && !oauthRedirectDone) {
                        oauthRedirectDone = true;
                        setStatus(loginTr('login.msg.volviendo', "Sesión iniciada. Volviendo..."));
                        setTimeout(
                            redirectToReturn,
                            AnimeDestiny.Constants.LOGIN_REDIRECT_DELAY_MS || 200
                        );
                    }
                }
            });
        }
    });

    setMode("login");
    applyAuthState(null); // por defecto: vista de invitado (oculta "Cerrar sesión")
})();




