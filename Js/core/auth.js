(function (window, document) {
    "use strict";

    window.AppAuthHandlesUserUi = true;

    // ─────────────────────────────────────────────
    // Supabase es la ÚNICA fuente de verdad de sesión.
    // No se usa localStorage para tokens ni usuarios.
    // ─────────────────────────────────────────────

    async function waitForSupabase() {
        if (window.AppSupabase) return window.AppSupabase;
        return new Promise((resolve) => {
            let elapsed = 0;
            const interval = setInterval(() => {
                elapsed += 100;
                if (window.AppSupabase) {
                    clearInterval(interval);
                    resolve(window.AppSupabase);
                } else if (elapsed >= 5000) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 100);
        });
    }

    // Obtiene el usuario activo directamente desde el SDK de Supabase.
    // Nunca leer localStorage manualmente para esto.
    async function getCurrentUser() {
        const client = await waitForSupabase();
        if (!client?.client) return null;
        const { data } = await client.client.auth.getUser();
        return data?.user ?? null;
    }

    // Nombre visible: metadata del usuario de Supabase, sin fallback local.
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

    async function refreshUserUi() {
        const user = await getCurrentUser();
        const name = displayNameFromUser(user);
        const photoUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

        const label = document.getElementById("navUserName");
        if (label) label.textContent = name;

        const avatar = document.getElementById("navUserAvatar");
        if (avatar) {
            avatar.style.backgroundImage = photoUrl ? `url("${photoUrl.replaceAll('"', '\\"')}")` : "";
            avatar.classList.toggle("has-image", !!photoUrl);
        }

        if (typeof window.renderUserProfileStrip === "function") window.renderUserProfileStrip();
        if (typeof window.cargarEstadosBotones === "function") window.cargarEstadosBotones();
        if (typeof window.updateCardProgressIndicators === "function") window.updateCardProgressIndicators();
    }

    function openUserModal() {
        const modal = document.getElementById("userModal");
        const input = document.getElementById("userNameInput");
        if (!modal || !input) return;
        input.value = "";
        document.getElementById("userEmailInput")?.value && (document.getElementById("userEmailInput").value = "");
        document.getElementById("userPassInput")?.value && (document.getElementById("userPassInput").value = "");
        setMsg("");
        modal.classList.add("is-open");
        input.focus();
    }

    function closeUserModal() {
        document.getElementById("userModal")?.classList.remove("is-open");
    }

    function isValidGmailAddress(value) {
        return /^[^\s@]+@gmail\.com$/i.test(String(value || "").trim());
    }

    // ─────────────────────────────────────────────
    // Autenticación — solo Supabase
    // ─────────────────────────────────────────────

    async function signInWithGoogle() {
        setMsg("Abriendo Google...");
        const client = await waitForSupabase();
        if (!client?.signInWithGoogle) {
            setMsg("Supabase todavía no está listo. Intentá de nuevo.");
            return;
        }
        try {
            await client.signInWithGoogle();
            // La sesión llega via onAuthStateChange; el modal se cierra solo.
        } catch (err) {
            console.error(err);
            setMsg("No se pudo iniciar sesión con Google.");
        }
    }

    async function loginWithPassword(mode) {
        const username  = String(document.getElementById("userNameInput")?.value  || "").trim();
        const email     = String(document.getElementById("userEmailInput")?.value || "").trim();
        const password  = String(document.getElementById("userPassInput")?.value  || "");

        // El campo "usuario" puede contener un email en modo login
        const loginEmail = email || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(username) ? username : "");

        // — Validaciones —
        if (!username && !email) return setMsg("Escribí un nombre de usuario o correo.");
        if (mode === "create" && username.length < 3) return setMsg("El usuario debe tener al menos 3 caracteres.");
        if (mode === "create" && !isValidGmailAddress(email)) return setMsg("Usá un correo @gmail.com válido.");
        if (!password || password.length < 4) return setMsg("La contraseña debe tener al menos 4 caracteres.");

        setMsg(mode === "create" ? "Creando cuenta..." : "Iniciando sesión...");

        const client = await waitForSupabase();
        if (!client?.client) {
            setMsg("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
            return;
        }

        if (mode === "create") {
            // ── REGISTRO ─────────────────────────────────────────────
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
                        setMsg("Error al crear cuenta: " + error.message);
                    }
                    return;
                }

                if (data?.user && !data?.session) {
                    setMsg("✅ Cuenta creada. Revisá tu correo para confirmarla.");
                    window.setTimeout(closeUserModal, 2500);
                    return;
                }

                // Sesión activa inmediata (email confirmation desactivado en Supabase)
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

        // ── INICIO DE SESIÓN ─────────────────────────────────────────
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
                    setMsg("Error al iniciar sesión: " + error.message);
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

    function ensureDestinyNavbar() {
        const navbar = document.querySelector(".navbar");
        if (!navbar) return;

        if (!document.querySelector('link[href$="destiny-navbar.css"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "css/destiny-navbar.css";
            document.head.appendChild(link);
        }

        navbar.classList.add("destiny-navbar");

        if (!navbar.querySelector(".nav-brand")) {
            const brand = document.createElement("a");
            brand.className = "nav-brand";
            brand.href = "index.html";
            brand.setAttribute("aria-label", "Anime Destiny");
            brand.innerHTML = `
                <span class="nav-brand-mark"><img src="images/Logo.png" alt="" aria-hidden="true"></span>
                <span class="nav-brand-copy">
                    <span class="nav-brand-anime">Anime</span>
                    <span class="nav-brand-destiny">Destiny</span>
                    <span class="nav-brand-jp">&gt; アニメの運命 &lt;</span>
                </span>
            `;
            navbar.insertBefore(brand, navbar.firstChild);
        }

        if (!navbar.querySelector(".nav-links")) {
            const links = Array.from(navbar.children)
                .filter((el) => el.classList?.contains("nav-btn"))
                .filter((el) => !String(el.textContent || "").trim().toLowerCase().includes("juego"));

            if (links.length) {
                const navLinks = document.createElement("div");
                navLinks.className = "nav-links";
                navLinks.setAttribute("aria-label", "Navegación principal");
                links[0].insertAdjacentElement("beforebegin", navLinks);
                links.forEach((link) => {
                    if (link.tagName.toLowerCase() === "a") { navLinks.appendChild(link); return; }
                    const label = String(link.textContent || "").trim();
                    const href = label.toLowerCase().includes("anime")  ? "anime.html"
                               : label.toLowerCase().includes("manga")  ? "manga.html"
                               : label.toLowerCase().includes("novela") ? "novelas.html"
                               : "index.html";
                    const anchor = document.createElement("a");
                    anchor.className = link.className;
                    anchor.href = href;
                    anchor.textContent = label;
                    link.replaceWith(anchor);
                    navLinks.appendChild(anchor);
                });
            }
        }

        navbar.querySelectorAll(".nav-links .nav-btn").forEach((link) => {
            if (String(link.textContent || "").trim().toLowerCase().includes("juego")) link.remove();
        });

        navbar.querySelectorAll(".nav-links .nav-btn").forEach((link) => {
            if (link.querySelector(".nav-icon")) return;
            const label = String(link.textContent || "").trim();
            const n = label.toLowerCase();
            const icon = n.includes("inicio") ? "⌂" : n.includes("anime") ? "♨"
                       : n.includes("manga")  ? "▣" : n.includes("novela") ? "▤"
                       : n.includes("lista")  ? "♡" : "•";
            link.innerHTML = `<span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
        });

        if (!navbar.querySelector(".nav-actions")) {
            const actions = document.createElement("div");
            actions.className = "nav-actions";
            navbar.appendChild(actions);
        }

        const actions  = navbar.querySelector(".nav-actions");
        const search   = navbar.querySelector(":scope > .nav-search");
        if (actions && search) actions.insertBefore(search, actions.firstChild);

        const searchWrap = navbar.querySelector(".nav-search");
        if (searchWrap && !searchWrap.querySelector(".nav-search-icon")) {
            const icon = document.createElement("span");
            icon.className = "nav-search-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = "⌕";
            searchWrap.insertBefore(icon, searchWrap.firstChild);
        }
    }

    function ensureUserUi() {
        ensureDestinyNavbar();
        const navbar  = document.querySelector(".navbar");
        const actions = document.querySelector(".nav-actions");
        const host    = actions || navbar || document.body;
        if (navbar) navbar.style.position = "sticky";

        if (!document.querySelector(".nav-user")) {
            const wrapper = document.createElement("div");
            wrapper.className = navbar ? "nav-user" : "nav-user nav-user-fixed";
            wrapper.innerHTML = `
                <span class="nav-user-avatar" id="navUserAvatar" aria-hidden="true"></span>
                <span class="nav-user-name"   id="navUserName"></span>
                <a class="nav-user-btn" id="accountLoginLink" href="Login.html">Cuenta</a>
            `;
            host.appendChild(wrapper);
        }

        if (document.body?.dataset.page === "login") { refreshUserUi(); return; }

        if (!document.getElementById("userModal")) {
            const modal = document.createElement("div");
            modal.className = "user-modal";
            modal.id = "userModal";
            modal.innerHTML = `
                <div class="user-modal-card" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
                    <h2 class="user-modal-title" id="userModalTitle">Cuenta</h2>
                    <div class="user-modal-toggle" role="group" aria-label="Modo de cuenta">
                        <button class="user-modal-tab is-active" id="userTabLogin"  type="button">Iniciar sesión</button>
                        <button class="user-modal-tab"            id="userTabCreate" type="button">Crear cuenta</button>
                    </div>
                    <div class="user-modal-row">
                        <label for="userNameInput">Usuario</label>
                        <input id="userNameInput" type="text" placeholder="Ej: NarutoFan" autocomplete="nickname">
                    </div>
                    <div class="user-modal-row is-hidden" id="emailRow">
                        <label for="userEmailInput">Gmail</label>
                        <input id="userEmailInput" type="email" placeholder="Ej: tuusuario@gmail.com" autocomplete="email">
                    </div>
                    <div class="user-modal-row">
                        <label for="userPassInput">Contraseña</label>
                        <input id="userPassInput" type="password" placeholder="********" autocomplete="current-password">
                    </div>
                    <p class="user-modal-msg" id="userModalMsg" aria-live="polite"></p>
                    <div class="user-modal-actions">
                        <button class="user-modal-btn google-btn" id="googleLoginBtn" type="button">Continuar con Google</button>
                    </div>
                    <div class="user-modal-actions">
                        <button class="user-modal-btn danger"  id="logoutBtn"      type="button">Salir</button>
                        <button class="user-modal-btn"         id="closeUserModal" type="button">Cerrar</button>
                        <button class="user-modal-btn primary" id="saveUserBtn"    type="button">Continuar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener("click", (e) => { if (e.target === modal) closeUserModal(); });
        }

        let mode = "login";
        const setMode = (next) => {
            mode = next;
            document.getElementById("userTabLogin")?.classList.toggle("is-active",  mode === "login");
            document.getElementById("userTabCreate")?.classList.toggle("is-active", mode === "create");
            document.getElementById("emailRow")?.classList.toggle("is-hidden",      mode === "login");
            const pass = document.getElementById("userPassInput");
            if (pass) pass.autocomplete = mode === "create" ? "new-password" : "current-password";
            setMsg("");
        };

        document.getElementById("openUserModal")?.addEventListener("click", openUserModal);
        document.getElementById("closeUserModal")?.addEventListener("click", closeUserModal);
        document.getElementById("userTabLogin")?.addEventListener("click",  () => setMode("login"));
        document.getElementById("userTabCreate")?.addEventListener("click", () => setMode("create"));
        document.getElementById("googleLoginBtn")?.addEventListener("click", signInWithGoogle);
        document.getElementById("saveUserBtn")?.addEventListener("click",   () => loginWithPassword(mode));
        document.getElementById("logoutBtn")?.addEventListener("click",     () => logoutUser().finally(closeUserModal));

        setMode("login");
        refreshUserUi();
    }

    // ─────────────────────────────────────────────
    // Escuchar cambios de sesión de Supabase
    // ─────────────────────────────────────────────

    // Evento disparado por supabase-config.js
    window.addEventListener("supabase-auth-changed", () => refreshUserUi());

    waitForSupabase().then((client) => {
        if (client) client.onAuthChange?.(() => refreshUserUi());
    }).catch((err) => console.error("Error al registrar onAuthChange:", err));

    // ─────────────────────────────────────────────
    // API pública mínima — solo lo que otros módulos necesitan
    // ─────────────────────────────────────────────
    window.getCurrentUser     = getCurrentUser;       // async → { user } de Supabase
    window.isValidGmailAddress = isValidGmailAddress;
    window.ensureUserUi       = ensureUserUi;
    window.refreshUserUi      = refreshUserUi;
    window.closeUserModal     = closeUserModal;

    document.addEventListener("DOMContentLoaded", ensureUserUi);

})(window, document);
