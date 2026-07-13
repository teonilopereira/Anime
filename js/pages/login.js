(function () {
    "use strict";

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
        title.textContent = isRegister ? "Crear cuenta" : "Iniciar sesión";
        submitBtn.textContent = isRegister ? "Crear cuenta" : "Entrar";
        setStatus("");
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
            return "Abrí la página con un servidor local (node tools/serve.js). Supabase no funciona bien desde file://.";
        }
        if (!window.AppConfig?.supabaseUrl || !window.AppConfig?.supabaseAnonKey) {
            return "Falta la configuración de Supabase en js/core/config.js.";
        }
        if (navigator.onLine === false) {
            return "No hay conexión de red.";
        }
        if (!window.AppSupabase && !window.AppSupabaseReady) {
            return "No se cargó Supabase. Revisá la conexión o abrí la app desde un servidor local.";
        }
        return "Supabase no está disponible. Revisá la conexión y recargá la página.";
    }

    function goHomeSoon() {
        let redirected = false;
        function doRedirect() {
            if (redirected) return;
            redirected = true;
            window.location.href = "index.html";
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
            setStatus("Ingresá un correo válido.");
            return;
        }
        if (password.length < (AnimeDestiny.Constants.MIN_PASSWORD_LENGTH || 6)) {
            setStatus("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        if (mode === "register" && username.length < (AnimeDestiny.Constants.MIN_USERNAME_LENGTH || 3)) {
            setStatus("El usuario debe tener al menos 3 caracteres.");
            return;
        }

        submitBtn.disabled = true;
        setStatus(mode === "register" ? "Creando cuenta..." : "Iniciando sesión...");

        try {
            if (mode === "register") {
                const data = await client.signUpWithEmail(email, password, username);
                saveLocalUser();
                if (data?.session) {
                    setStatus("Cuenta creada. Entrando...");
                    goHomeSoon();
                } else {
                    setStatus("Cuenta creada. Revisá tu correo para confirmarla.");
                }
            } else {
                const data = await client.signInWithEmail(email, password);
                saveLocalUser();
                setStatus("Sesión iniciada.");
                goHomeSoon();
            }
        } catch (error) {
            const message = String(error?.message || "");
            if (message.toLowerCase().includes("invalid login")) {
                setStatus("Correo o contraseña incorrectos.");
            } else if (message.toLowerCase().includes("email not confirmed")) {
                setStatus("Confirmá tu correo antes de iniciar sesión.");
            } else {
                setStatus("Error: " + message);
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
            setStatus("El inicio con Google no está habilitado en esta configuración.");
            return;
        }
        setStatus("Abriendo Google...");
        try {
            await client.signInWithGoogle();
        } catch (error) {
            setStatus("No se pudo iniciar con Google: " + (error?.message || ""));
        }
    });

    logoutBtn.addEventListener("click", async () => {
        const client = await getClient();
        try {
            if (client?.signOutGoogle) await client.signOutGoogle();
        } finally {
            if (typeof window.refreshUserUi === "function") window.refreshUserUi();
            setStatus("Sesión cerrada.");
        }
    });

    if (isFileProtocol()) {
        setStatus("⚠️ Estás usando file://. Usá un servidor local: node tools/serve.js");
    }

    if (window.AppSupabaseReady) {
        window.AppSupabaseReady.then((client) => {
            client?.onAuthChange?.((detail) => {
                if (detail?.user) saveLocalUser();
            });
        });
    }

    setMode("login");
})();




