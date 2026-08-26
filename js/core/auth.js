(function (window, document) {
    "use strict";

    // Traducción con fallback al español si i18n aún no cargó.
    function authTr(key, fallback, args) {
        if (window.AppI18n && typeof window.AppI18n.t === 'function') {
            var out = window.AppI18n.t(key, args);
            if (out && out.charAt(0) !== '[') return out;
        }
        return fallback;
    }

    // ─────────────────────────────────────────────
    // Supabase es la ÚNICA fuente de verdad de sesión.
    // No se usa localStorage para tokens ni usuarios.
    // ─────────────────────────────────────────────

async function waitForSupabase() {
        if (window.AppSupabase) return window.AppSupabase;

        // Carga diferida del SDK (~216 KB). Si no hay token guardado, no
        // estamos en Login y la URL no trae tokens, con certeza no hay sesión:
        // se devuelve null sin descargar nada. Cargarlo sólo para que conteste
        // "no hay usuario" era el motivo de que pesara en toda visita anónima.
        if (typeof window.__puedeHaberSesion === 'function' && !window.__puedeHaberSesion()) {
            return null;
        }
        if (typeof window.__loadSupabase === 'function') {
            var cliente = await window.__loadSupabase();
            if (cliente) return cliente;
        }

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

    // Etiquetas de apodo para el badge del navbar. Debe seguir en sincronía
    // con APODOS en js/pages/mis-listas.js: un id que falte aca hace que el
    // badge desaparezca del navbar apenas el usuario equipa ese apodo.
    const APODO_LABELS = {
        novato: 'Novato',
        corazon: 'Corazón de Otaku',
        coleccionista: 'Coleccionista',
        observador: 'Observador',
        devorador: 'Devorador de Mundos',
        primer_paso: 'Un Pasito',
        maratonista: 'Maratonista',
        veterano: 'Veterano',
        leyenda: 'Leyenda Destiny',
        hechicero_actual: 'El Hechicero Más Fuerte Actual',
        hechicero_historia: 'El Hechicero Más Fuerte de la Historia',
        rey_piratas: 'El Próximo Rey de los Piratas',
        hokage: 'Séptimo Hokage',
        soldado: 'El Soldado Más Fuerte de la Humanidad',
        espadachin_negro: 'El Espadachín Negro',
        monarca: 'Monarca de las Sombras',
        simbolo_paz: 'El Símbolo de la Paz',
        pilar: 'Pilar del Agua',
        kira: 'Kira'
    };

    async function resolveGrade(profile) {
        // 1) Del perfil global si ya está cargado (usuario.html)
        let apodoId = (profile && profile.apodo) || null;
        // 2) Si no, intentar traerlo desde Supabase (consulta liviana)
        if (!apodoId && window.AppSupabase && typeof window.AppSupabase.loadApodo === 'function') {
            try { apodoId = await window.AppSupabase.loadApodo(); } catch (_) { apodoId = null; }
        }
        if (!apodoId) return '';
        return APODO_LABELS[apodoId] || '';
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
        const gradeEl = document.getElementById('nav-user-grade');
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
                // Badge de apodo. Se resuelve async para no demorar el nombre.
                // Sin el prefijo "GRADO:": los apodos largos de franquicia ya
                // rozan el max-width del badge, y el nombre solo se entiende igual.
                if (gradeEl) {
                    resolveGrade(profile).then(function (label) {
                        if (label) {
                            gradeEl.textContent = label;
                            gradeEl.title = label;
                            gradeEl.hidden = false;
                        } else {
                            gradeEl.hidden = true;
                            gradeEl.textContent = '';
                            gradeEl.removeAttribute('title');
                        }
                    });
                }
            } else {
                nameEl.textContent = authTr('nav.usuario_invitado', 'Invitado');
                btnEl.textContent = authTr('nav.ingresar', 'Ingresar');
                btnEl.href = 'Login.html';
                btnEl.setAttribute('aria-label', authTr('auth.iniciar_sesion', 'Iniciar sesión'));
                avatarEl.classList.remove('has-image');
                avatarEl.style.removeProperty('background-image');
                if (gradeEl) { gradeEl.hidden = true; gradeEl.textContent = ''; }
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

        if (!username && !email) return setMsg(authTr('auth.err.falta_usuario', "Escribí un nombre de usuario o correo."));
        if (mode === "create" && username.length < (AnimeDestiny.Constants.MIN_USERNAME_LENGTH || 3)) return setMsg(authTr('auth.err.usuario_corto', "El usuario debe tener al menos 3 caracteres."));
        if (mode === "create" && !isValidGmailAddress(email)) return setMsg(authTr('auth.err.gmail', "Usá un correo @gmail.com válido."));
        if (!password || password.length < (AnimeDestiny.Constants.MIN_PASSWORD_LENGTH || 6)) return setMsg(authTr('auth.err.pass_corta', "La contraseña debe tener al menos 6 caracteres."));

        setMsg(mode === "create" ? authTr('auth.creando', "Creando cuenta...") : authTr('auth.iniciando', "Iniciando sesión..."));

        const client = await waitForSupabase();
        if (!client?.client) {
            setMsg(authTr('auth.err.sin_servidor', "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."));
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
                        setMsg(authTr('auth.err.ya_existe', "Ese correo ya tiene una cuenta. Iniciá sesión en cambio."));
                    } else if (error.message?.toLowerCase().includes("invalid email")) {
                        setMsg(authTr('auth.err.email_invalido', "El correo ingresado no es válido."));
                    } else if (error.message?.toLowerCase().includes("password")) {
                        setMsg(authTr('auth.err.pass_debil', "La contraseña es muy débil. Usá al menos 6 caracteres."));
                    } else {
                        setMsg(authTr('auth.err.crear', "Error al crear cuenta. Intentá de nuevo."));
                    }
                    return;
                }

                if (data?.user && !data?.session) {
                    setMsg(authTr('auth.ok.confirmar', "✅ Cuenta creada. Revisá tu correo para confirmarla."));
                    window.setTimeout(closeUserModal, 2500);
                    return;
                }

                if (data?.session) {
                    await refreshUserUi();
                    setMsg(authTr('auth.ok.creada', "✅ Cuenta creada exitosamente."));
                    window.setTimeout(closeUserModal, 800);
                    return;
                }

                setMsg(authTr('auth.ok.creada_login', "Cuenta creada. Iniciá sesión para continuar."));
                window.setTimeout(closeUserModal, 1500);

            } catch (err) {
                console.error("Error inesperado al crear cuenta:", err);
                setMsg(authTr('auth.err.sin_conexion', "Sin conexión al servidor. Revisá tu internet e intentá de nuevo."));
            }
            return;
        }

        if (!loginEmail) {
            setMsg(authTr('auth.err.falta_email', "Ingresá tu correo electrónico para iniciar sesión."));
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
                    setMsg(authTr('auth.err.credenciales', "Correo o contraseña incorrectos."));
                } else if (error.message?.toLowerCase().includes("email not confirmed")) {
                    setMsg(authTr('auth.err.no_confirmado', "Confirmá tu correo antes de iniciar sesión."));
                } else if (error.message?.toLowerCase().includes("network") ||
                           error.message?.toLowerCase().includes("fetch")) {
                    setMsg(authTr('auth.err.sin_conexion', "Sin conexión al servidor. Revisá tu internet e intentá de nuevo."));
                } else {
                    setMsg(authTr('auth.err.login', "Error al iniciar sesión. Intentá de nuevo."));
                }
                return;
            }

            if (data?.user) {
                await refreshUserUi();
                setMsg("");
                window.setTimeout(closeUserModal, 600);
                return;
            }

            setMsg(authTr('auth.err.no_login', "No se pudo iniciar sesión. Intentá de nuevo."));

        } catch (err) {
            console.error("Error inesperado al iniciar sesión:", err);
            setMsg(authTr('auth.err.sin_conexion', "Sin conexión al servidor. Revisá tu internet e intentá de nuevo."));
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

        // Racha diaria: sube el contador de días seguidos y agrega un bonus de
        // EXP que crece con la racha (además del login base). Se registra antes
        // de sumar puntos para poder incluir el bonus en una sola operación.
        var streak = null;
        var streakBonus = 0;
        if (window.AppStreak && typeof window.AppStreak.recordActivity === 'function') {
            streak = window.AppStreak.recordActivity(user.id);
            streakBonus = window.AppStreak.bonusForStreak(streak.count);
        }

        var delta = (AnimeDestiny.Constants.XP_LOGIN || 10) + streakBonus;
        if (typeof addUserPoints === 'function') {
            addUserPoints(user.id, delta);
        } else if (client && typeof client.addExperience === 'function') {
            client.addExperience(delta);
            var pts = Number(UserStore.getItem('u:' + user.id + '|points') || '0');
            UserStore.setItem('u:' + user.id + '|points', String(pts + delta));
        }
        if (window.Toast) {
            setTimeout(function () {
                if (streak && streak.count > 1) {
                    window.Toast.success(authTr('auth.racha', "¡Racha de {count} días! (+{delta} EXP)", { count: streak.count, delta: delta }));
                } else {
                    window.Toast.success(authTr('auth.bienvenido', "¡Bienvenido! (+{delta} EXP por login diario)", { delta: delta }));
                }
            }, 800);
        }
        // Aviso para que la UI (widget de racha en inicio / mis-listas) se
        // repinte sin recargar.
        try {
            window.dispatchEvent(new CustomEvent('streak-updated', { detail: streak || {} }));
        } catch (_) { /* navegador viejo sin CustomEvent */ }
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
    // Traduce el id de apodo guardado en el perfil a su etiqueta visible.
    // Lo usa el ranking (y quien necesite mostrar apodos fuera de mis-listas)
    // para no mantener una tercera copia de APODO_LABELS.
    window.apodoLabel          = function (id) { return APODO_LABELS[id] || ''; };

    // Ejecución segura al cargar el DOM
    document.addEventListener('DOMContentLoaded', async () => {
        ensureUserUi();       // Crea el estado de carga neutro (...)
        await refreshUserUi(); // Espera a Supabase y pinta el usuario correcto o el botón de cuenta
    });

})(window, document);



