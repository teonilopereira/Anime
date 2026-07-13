(function (window, document) {
    "use strict";

    // ─────────────────────────────────────────────
    // Supabase es la ÚNICA fuente de verdad de sesión.
    // No se usa localStorage para tokens ni usuarios.
    // ─────────────────────────────────────────────

async function waitForSupabase() {
        if (window.AppSupabase) return window.AppSupabase;
        var promises = [];
        if (window.AppSupabaseReady) promises.push(window.AppSupabaseReady);
        promises.push(new Promise(r => {
            var onReady = function () { window.removeEventListener('supabase-ready', onReady); r(window.AppSupabase); };
            window.addEventListener('supabase-ready', onReady, { once: true });
            setTimeout(function () { window.removeEventListener('supabase-ready', onReady); r(null); }, AnimeDestiny.Constants.SUPABASE_WAIT_TIMEOUT_MS || 12000);
        }));
        return await Promise.race(promises);
    }
    async function getCurrentUser() {
        const client = await waitForSupabase();
        if (!client?.client) return null;

        // getUser() verifica de forma segura la sesión persistida en el almacenamiento
        const { data } = await client.client.auth.getUser();
        return data?.user ?? null;
    }

    // Nombre visible basado en la metadata de Supabase
    function displayNameFromUser(user) {
        if (!user) return "Invitado";
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] || 
            "Usuario"
        );
    }
    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────

    function setMsg(text) {
        const msg = document.getElementById("userModalMsg");
        if (msg) msg.textContent = text || "";
    }

    function displayNameFromProfile(user, profile) {
        if (profile?.display_name) return profile.display_name;
        return displayNameFromUser(user);
    }

    function photoUrlFromProfile(user, profile) {
        if (profile?.photo_url) return profile.photo_url;
        return user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    }

  async function refreshUserUi() {
        const user = await getCurrentUser();
        // Intentar usar perfil guardado globalmente (lo setea usuario.html)
        const profile = window.__profileData || null;
        const username = displayNameFromProfile(user, profile);
        
        const userBtn = document.getElementById("auth-user-btn") || document.getElementById("userBtn") || document.getElementById("user-profile");
        if (userBtn) {
            if (user) {
                userBtn.textContent = username;
                userBtn.classList.add("logged-in");
            } else {
                userBtn.textContent = "Cuenta";
                userBtn.classList.remove("logged-in");
            }
        }

        // Área de usuario en navbar (avatar + nombre + botón de acción)
        const nameEl = document.getElementById('nav-user-name');
        const btnEl = document.getElementById('nav-user-btn');
        const avatarEl = document.getElementById('nav-user-avatar');
        if (nameEl && btnEl && avatarEl) {
            if (user) {
                nameEl.textContent = username;
                btnEl.textContent = 'Cuenta';
                btnEl.href = 'usuario.html';
                btnEl.setAttribute('aria-label', 'Ver perfil de ' + username);
                const photoUrl = photoUrlFromProfile(user, profile);
                if (photoUrl && (typeof window.safeUrl !== 'function' || window.safeUrl(photoUrl))) {
                    avatarEl.classList.add('has-image');
                    var cleanUrl = photoUrl.replace(/[\\"'()]/g, '');
                    avatarEl.style.backgroundImage = 'url("' + cleanUrl + '")';
                } else {
                    avatarEl.classList.remove('has-image');
                    avatarEl.style.removeProperty('background-image');
                }
            } else {
                nameEl.textContent = 'Invitado';
                btnEl.textContent = 'Ingresar';
                btnEl.href = 'Login.html';
                btnEl.setAttribute('aria-label', 'Iniciar sesión');
                avatarEl.classList.remove('has-image');
                avatarEl.style.removeProperty('background-image');
            }
        }
    }

    function closeUserModal() {
        document.getElementById("userModal")?.classList.remove("is-open");
    }

    function isValidGmailAddress(value) {
        return /^[^\s@]+@gmail\.com$/i.test(String(value || "").trim());
    }

    async function loginWithPassword(mode) {
        const username  = String(document.getElementById("userNameInput")?.value  || "").trim();
        const email     = String(document.getElementById("userEmailInput")?.value || "").trim();
        const password  = String(document.getElementById("userPassInput")?.value  || "");

        const loginEmail = email || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(username) ? username : "");

        if (!username && !email) return setMsg("Escribí un nombre de usuario o correo.");
        if (mode === "create" && username.length < (AnimeDestiny.Constants.MIN_USERNAME_LENGTH || 3)) return setMsg("El usuario debe tener al menos 3 caracteres.");
        if (mode === "create" && !isValidGmailAddress(email)) return setMsg("Usá un correo @gmail.com válido.");
        if (!password || password.length < (AnimeDestiny.Constants.MIN_PASSWORD_LENGTH || 6)) return setMsg("La contraseña debe tener al menos 6 caracteres.");

        setMsg(mode === "create" ? "Creando cuenta..." : "Iniciando sesión...");

        const client = await waitForSupabase();
        if (!client?.client) {
            setMsg("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
            return;
        }

        if (mode === "create") {
            try {
                const { data, error } = await client.client.auth.signUp({
                    email,
                    password,
                    options: { data: { username, name: username, full_name: username } }
                });

                if (error) {
                    if (error.message?.toLowerCase().includes("already registered") ||
                        error.message?.toLowerCase().includes("already exists")) {
                        setMsg("Ese correo ya tiene una cuenta. Iniciá sesión en cambio.");
                    } else if (error.message?.toLowerCase().includes("invalid email")) {
                        setMsg("El correo ingresado no es válido.");
                    } else if (error.message?.toLowerCase().includes("password")) {
                        setMsg("La contraseña es muy débil. Usá al menos 6 caracteres.");
                    } else {
                        setMsg("Error al crear cuenta. Intentá de nuevo.");
                    }
                    return;
                }

                if (data?.user && !data?.session) {
                    setMsg("✅ Cuenta creada. Revisá tu correo para confirmarla.");
                    window.setTimeout(closeUserModal, 2500);
                    return;
                }

                if (data?.session) {
                    await refreshUserUi();
                    setMsg("✅ Cuenta creada exitosamente.");
                    window.setTimeout(closeUserModal, 800);
                    return;
                }

                setMsg("Cuenta creada. Iniciá sesión para continuar.");
                window.setTimeout(closeUserModal, 1500);

            } catch (err) {
                console.error("Error inesperado al crear cuenta:", err);
                setMsg("Sin conexión al servidor. Revisá tu internet e intentá de nuevo.");
            }
            return;
        }

        if (!loginEmail) {
            setMsg("Ingresá tu correo electrónico para iniciar sesión.");
            return;
        }

        try {
            const { data, error } = await client.client.auth.signInWithPassword({
                email: loginEmail,
                password
            });

            if (error) {
                if (error.message?.toLowerCase().includes("invalid login") ||
                    error.message?.toLowerCase().includes("invalid credentials")) {
                    setMsg("Correo o contraseña incorrectos.");
                } else if (error.message?.toLowerCase().includes("email not confirmed")) {
                    setMsg("Confirmá tu correo antes de iniciar sesión.");
                } else if (error.message?.toLowerCase().includes("network") ||
                           error.message?.toLowerCase().includes("fetch")) {
                    setMsg("Sin conexión al servidor. Revisá tu internet e intentá de nuevo.");
                } else {
                    setMsg("Error al iniciar sesión. Intentá de nuevo.");
                }
                return;
            }

            if (data?.user) {
                await refreshUserUi();
                setMsg("");
                window.setTimeout(closeUserModal, 600);
                return;
            }

            setMsg("No se pudo iniciar sesión. Intentá de nuevo.");

        } catch (err) {
            console.error("Error inesperado al iniciar sesión:", err);
            setMsg("Sin conexión al servidor. Revisá tu internet e intentá de nuevo.");
        }
    }

    async function logoutUser() {
        const client = await waitForSupabase();
        if (client?.client) {
            try {
                await client.client.auth.signOut();
            } catch (err) {
                console.warn("No se pudo cerrar sesión de Supabase:", err);
            }
        }
        if (window.UserStore) window.UserStore.clear();
        await refreshUserUi();
    }

    // ─────────────────────────────────────────────
    // Navbar
    // ─────────────────────────────────────────────

   function ensureUserUi() {
        const userBtn = document.getElementById("auth-user-btn") || document.getElementById("userBtn") || document.getElementById("user-profile");
        if (userBtn && !userBtn.dataset.authInitialized) {
            userBtn.textContent = "..."; // Estado de carga temporal seguro
            userBtn.dataset.authInitialized = "true";
        }
    }

    // ─────────────────────────────────────────────
    function grantDailyLoginBonus() {
        var client = window.AppSupabase;
        var user = client && typeof client.getCurrentUserSync === 'function' ? client.getCurrentUserSync() : null;
        if (!user) return;
        var today = new Date().toISOString().split('T')[0];
        var key = 'lastDailyLogin:' + user.id;
        if (localStorage.getItem(key) === today) return;
        localStorage.setItem(key, today);
        var delta = AnimeDestiny.Constants.XP_LOGIN || 10;
        if (typeof addUserPoints === 'function') {
            addUserPoints(user.id, delta);
        } else if (client && typeof client.addExperience === 'function') {
            client.addExperience(delta);
            var pts = Number(UserStore.getItem('u:' + user.id + '|points') || '0');
            UserStore.setItem('u:' + user.id + '|points', String(pts + delta));
        }
        if (window.Toast) {
            setTimeout(function () {
                window.Toast.success("¡Bienvenido! (+" + delta + " EXP por login diario)");
            }, 800);
        }
    }

    // Escuchar cambios de sesión de Supabase
    // ─────────────────────────────────────────────

    // Evento disparado por supabase-config.js
    window.addEventListener("supabase-auth-changed", function () {
        refreshUserUi();
        if (window.AppSupabase && !window.AppSupabase.isSignedIn()) {
            if (window.UserStore) window.UserStore.clear();
        } else if (window.AppSupabase && window.AppSupabase.isSignedIn()) {
            grantDailyLoginBonus();
        }
    });

    waitForSupabase().then((client) => {
        if (client && typeof client.onAuthChange === "function") {
            client.onAuthChange(() => {
                refreshUserUi();
                if (!client.isSignedIn()) {
                    if (window.UserStore) window.UserStore.clear();
                }
            });
        }
    }).catch((err) => console.error("Error al registrar onAuthChange:", err));
    // ─────────────────────────────────────────────
    // API pública mínima — solo lo que otros módulos necesitan
    // ─────────────────────────────────────────────
window.getCurrentUser      = getCurrentUser;
    window.waitForSupabase     = waitForSupabase;
    window.ensureUserUi        = ensureUserUi;
    window.refreshUserUi       = refreshUserUi;
    window.logoutUser          = logoutUser;

    // Ejecución segura al cargar el DOM
    document.addEventListener('DOMContentLoaded', async () => {
        ensureUserUi();       // Crea el estado de carga neutro (...)
        await refreshUserUi(); // Espera a Supabase y pinta el usuario correcto o el botón de cuenta
    });

})(window, document);



