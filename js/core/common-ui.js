(() => {
    "use strict";

    const path = window.location.pathname.toLowerCase();

    /**
     * Nombre del archivo actual, sin carpeta ni extension ("manga", "index").
     *
     * Todo lo que depende de "en que pagina estoy" se resuelve con esto y no
     * con path.includes(...): el substring encendia el item equivocado apenas
     * el nombre de una pagina aparecia dentro del de otra o de una carpeta del
     * deploy. Ademas "ranking.html" no contenia ninguno de los nombres
     * buscados, asi que la pagina quedaba sin marcar en la barra.
     */
    const archivo = (path.split("/").pop() || "index.html").replace(/\.html?$/, "") || "index";

    const t = (clave, porDefecto) => (window.AppI18n ? window.AppI18n.t(clave) : porDefecto);

    /**
     * Destinos de la barra, partidos en dos niveles.
     *
     * Los primarios son los cuatro que se usan todo el tiempo; el resto vive en
     * el desplegable "Mas". Con todo suelto la barra de arriba se apretaba en
     * pantallas medianas y el bottom nav de mobile no da para siete pestañas,
     * asi que comparar.html y top.html habian quedado fuera de la navegacion:
     * solo se llegaba a ellas desde una card del index.
     */
    const NAV_PRIMARIOS = [
        { id: "anime", href: "anime.html", icon: "clapperboard", i18n: "nav.anime", corto: "nav.anime", def: "Anime" },
        { id: "manga", href: "manga.html", icon: "book-open", i18n: "nav.manga", corto: "nav.manga", def: "Manga" },
        { id: "novelas", href: "novelas.html", icon: "book", i18n: "nav.novelas", corto: "nav.novelas", def: "Novelas" },
        // "Mis Listas" no entra en una linea en el tab de mobile y desalinea el
        // icono, asi que ahi se rotula con la clave corta.
        { id: "mis-listas", href: "mis-listas.html", icon: "heart", i18n: "nav.mis_listas", corto: "nav.listas", def: "Mis Listas", defCorto: "Listas" }
    ];

    const NAV_SECUNDARIOS = [
        { id: "ranking", href: "ranking.html", icon: "trophy", i18n: "nav.ranking", def: "Ranking" },
        { id: "comparar", href: "comparar.html", icon: "columns-2", i18n: "nav.comparar", def: "Comparar" },
        { id: "top", href: "top.html", icon: "crown", i18n: "nav.top_jugadores", def: "Top de jugadores" },
        { id: "configuracion", href: "configuracion.html", icon: "settings", i18n: "nav.configuracion", def: "Configuración" }
    ];

    const paginaActiva = NAV_PRIMARIOS.some((l) => l.id === archivo) ? archivo : null;
    // Estando en una pagina del desplegable, el que se marca es el boton "Mas":
    // si no, la barra queda sin ningun item encendido y no se sabe donde uno esta.
    const secundarioActivo = NAV_SECUNDARIOS.some((l) => l.id === archivo) ? archivo : null;

    // Paginas con texto propio en el pie; el resto (404, privacidad, terminos)
    // cae al generico de index.
    const PAGINAS_CON_PIE = [
        "mis-listas", "anime", "manga", "novelas", "comparar",
        "detalle", "configuracion", "usuario", "login", "ranking", "top"
    ];
    const pageKey = PAGINAS_CON_PIE.indexOf(archivo) !== -1 ? archivo : "index";


    const ensureMainTarget = () => {
        if (document.getElementById('main-content')) return;
        const candidates = [
            document.querySelector('main'),
            document.querySelector('.login-shell'),
            document.querySelector('.profile-dashboard'),
            document.querySelector('.catalog-layout'),
            document.querySelector('.menu-container'),
            document.querySelector('.featured'),
            document.querySelector('.hero-menu')
        ].filter(Boolean);
        if (!candidates.length) return;
        const target = candidates[0];
        if (target.id) return; // no sobrescribir id existente (ej: main-container)
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    };

    // ── NAV BRAND ──
    const injectNavBrand = () => {
        const el = document.getElementById("nav-brand-container");
        if (!el) return;
        el.innerHTML = `<a class="nav-brand" href="index.html" aria-label="Anime Destiny">
<span class="nav-brand-mark"><img src="images/Logo.png" alt="Anime Destiny logo" aria-hidden="true"></span>
<span class="nav-brand-copy">
<span class="nav-brand-anime">Anime</span>
<span class="nav-brand-destiny">Destiny</span>
<span class="nav-brand-jp">&gt; \u30A2\u30CB\u30E1\u306E\u904B\u547D &lt;</span>
</span>
</a>`;
    };

    // ── NAV TOGGLE (Hamburger) ──
    const injectNavToggle = () => {
        const nav = document.querySelector('.destiny-navbar');
        if (!nav || nav.querySelector('.nav-toggle')) return;

        const toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-label', 'Menú de navegación');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<span class="nav-toggle-icon" aria-hidden="true"></span><span class="nav-toggle-text">Menú</span>';

        toggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });

        nav.insertBefore(toggle, document.getElementById('nav-links-container'));
    };

    // ── NAV LINKS ──
    const injectNavLinks = () => {
        const el = document.getElementById("nav-links-container");
        if (!el) return;

        const isDetail = archivo === "detalle";

        let html = "";
        for (let i = 0; i < NAV_PRIMARIOS.length; i++) {
            const l = NAV_PRIMARIOS[i];
            let cls = "nav-btn";
            let current = "";
            let dataCat = "";
            if (l.id === paginaActiva) {
                cls += " active";
                current = ' aria-current="page"';
            }
            if (isDetail && i < 3) {
                dataCat = ` data-nav-cat="${l.id}"`;
            }
            html += `<a href="${l.href}" class="${cls}"${current}${dataCat}>
<span class="nav-icon" aria-hidden="true"><i data-lucide="${l.icon}"></i></span><span data-i18n="${l.i18n}">${t(l.i18n, l.def)}</span>
</a>`;
        }

        const itemsMas = NAV_SECUNDARIOS.map((l) => {
            const current = l.id === secundarioActivo ? ' aria-current="page"' : '';
            const cls = l.id === secundarioActivo ? ' is-active' : '';
            return `<a href="${l.href}" class="nav-more-item${cls}"${current}>
<span class="nav-more-icon" aria-hidden="true"><i data-lucide="${l.icon}"></i></span><span data-i18n="${l.i18n}">${t(l.i18n, l.def)}</span>
</a>`;
        }).join("");

        html += `<div class="nav-more">
<button class="nav-btn nav-more-btn${secundarioActivo ? " active" : ""}" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="nav-more-menu">
<span class="nav-icon" aria-hidden="true"><i data-lucide="chevron-down"></i></span><span data-i18n="nav.mas">${t("nav.mas", "Más")}</span>
</button>
<div class="nav-more-menu" id="nav-more-menu" role="menu" hidden>${itemsMas}</div>
</div>`;

        el.innerHTML = `<div class="nav-links" aria-label="Navegación principal">${html}</div>`;
        wireNavMore(el);
    };

    // ── DESPLEGABLE "MÁS" ──
    const wireNavMore = (scope) => {
        const wrap = scope.querySelector(".nav-more");
        if (!wrap) return;
        const btn = wrap.querySelector(".nav-more-btn");
        const menu = wrap.querySelector(".nav-more-menu");
        if (!btn || !menu) return;

        let cierreDiferido = null;
        const cancelarCierre = () => {
            if (cierreDiferido) {
                clearTimeout(cierreDiferido);
                cierreDiferido = null;
            }
        };

        const abrir = (estado) => {
            cancelarCierre();
            menu.hidden = !estado;
            wrap.classList.toggle("is-open", estado);
            btn.setAttribute("aria-expanded", String(estado));
        };

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            abrir(menu.hidden);
        });

        // Con el mouse encima alcanza: pedir un click para ver cuatro destinos
        // hacia que el desplegable se sintiera escondido y no rapido.
        //
        // Solo para el mouse (pointerType): en tactil el primer toque emula un
        // hover, asi que el menu se abriria sin que nadie se lo pida, y en los
        // hibridos (notebook con pantalla tactil) el puntero fino existe igual.
        wrap.addEventListener("pointerenter", (e) => {
            if (e.pointerType !== "mouse") return;
            abrir(true);
        });

        // Un respiro antes de cerrar: entre el borde del boton y el del panel
        // hay unos pixeles muertos, y sin la espera el menu se cierra justo
        // cuando el mouse los esta cruzando.
        wrap.addEventListener("pointerleave", (e) => {
            if (e.pointerType !== "mouse") return;
            cancelarCierre();
            cierreDiferido = setTimeout(() => abrir(false), 180);
        });

        // Cerrar al clickear afuera o con Escape: sin esto el panel queda
        // abierto tapando el contenido despues de navegar con el teclado.
        document.addEventListener("click", (e) => {
            if (!menu.hidden && !wrap.contains(e.target)) abrir(false);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !menu.hidden) {
                abrir(false);
                btn.focus();
            }
        });

        // Los usa el botón "Más" del bottom nav, que vive en otro contenedor.
        window.__navMoreOpen = () => abrir(true);
        window.__navMoreClose = () => abrir(false);
    };

    // ── MOBILE BOTTOM NAV ──
    const injectMobileBottomNav = () => {
        if (document.querySelector('.mobile-bottom-nav')) return;

        // No inyectar en páginas de auth ni en el 404 (en el resto siempre debe
        // haber navegación visible: en mobile la navbar superior queda oculta)
        if (archivo === "login" || archivo === "404") return;

        // Las mismas cuatro pestañas que la barra de arriba; el resto queda
        // detrás del botón "Más", que despliega la navbar superior (en mobile
        // hace de hoja) con el menú secundario ya abierto.
        let html = '';
        for (let i = 0; i < NAV_PRIMARIOS.length; i++) {
            const tab = NAV_PRIMARIOS[i];
            const activeClass = tab.id === paginaActiva ? ' active' : '';
            const currentAttr = tab.id === paginaActiva ? ' aria-current="page"' : '';
            const clave = tab.corto || tab.i18n;
            html += `<a href="${tab.href}" class="bottom-tab${activeClass}"${currentAttr}>
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="${tab.icon}"></i></span>
<span data-i18n="${clave}">${t(clave, tab.defCorto || tab.def)}</span>
</a>`;
        }

        html += `<button class="bottom-tab-more${secundarioActivo ? " active" : ""}" aria-label="${t("nav.mas", "Más")}" type="button">
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="menu"></i></span>
<span data-i18n="nav.mas">${t("nav.mas", "Más")}</span>
</button>`;

        const nav = document.createElement('nav');
        nav.className = 'mobile-bottom-nav';
        nav.setAttribute('aria-label', 'Navegación móvil');
        nav.innerHTML = html;
        document.body.appendChild(nav);
        document.body.classList.add('has-bottom-nav');

        // Cerrar navbar top al hacer click en cualquier link del bottom bar
        nav.addEventListener('click', (e) => {
            const link = e.target.closest('.bottom-tab');
            if (!link) return;
            const navbar = document.querySelector('.destiny-navbar');
            if (navbar) navbar.classList.remove('is-open');
            const moreBtn = nav.querySelector('.bottom-tab-more');
            if (moreBtn) moreBtn.classList.remove('is-open');
        });

        // "Más": despliega la navbar superior, que en mobile entra desde arriba
        // y trae el buscador, el usuario y el menú secundario.
        const moreBtn = nav.querySelector('.bottom-tab-more');
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                const navbar = document.querySelector('.destiny-navbar');
                if (!navbar) return;
                // Sin esto el click sigue subiendo hasta el listener que cierra
                // el desplegable al tocar afuera, y el menú se abriría y
                // cerraría en el mismo gesto.
                e.stopPropagation();
                const isOpen = navbar.classList.toggle('is-open');
                moreBtn.classList.toggle('is-open', isOpen);
                if (!isOpen && typeof window.__navMoreClose === 'function') window.__navMoreClose();
                if (isOpen) {
                    // El menú secundario se abre solo: si no, el que viene
                    // buscando Comparar o Ranking tiene que adivinar que hay
                    // que tocar otro botón más.
                    if (typeof window.__navMoreOpen === 'function') window.__navMoreOpen();
                    const input = navbar.querySelector('.nav-search-input');
                    if (input) setTimeout(() => input.focus(), 100);
                }
            });
        }
    };

    // ── LOGIN / USER AREA ──
    const injectLoginButton = () => {
        const el = document.getElementById("nav-login-container");
        if (!el) return;
        if (archivo === "login") return;

        const ingresarText = window.AppI18n ? window.AppI18n.t("nav.ingresar") : "Ingresar";
        const invitadoText = window.AppI18n ? window.AppI18n.t("nav.usuario_invitado") : "...";
        el.innerHTML = `<div class="nav-user" id="nav-user">
<div class="nav-user-info">
<span id="nav-user-name" class="nav-user-name" data-i18n="nav.usuario_invitado">${invitadoText}</span>
<span id="nav-user-grade" class="nav-user-grade" hidden></span>
<a id="nav-user-btn" href="Login.html" class="nav-user-btn" data-i18n="nav.ingresar">${ingresarText}</a>
</div>
<div id="nav-user-avatar" class="nav-user-avatar"></div>
</div>`;

        // Refrescar la UI del usuario si auth.js ya cargó
        if (typeof window.refreshUserUi === 'function') {
            window.refreshUserUi();
        }

        // Cuando Supabase cargue, actualizar la UI del usuario
        window.addEventListener('supabase-ready', () => {
            if (typeof window.refreshUserUi === 'function') {
                window.refreshUserUi();
            }
        }, { once: true });
    };

    // ── FOOTER ──
    const FOOTER_DATA = {
        anime: {
            col1: { title: "Tips", text: 'Us\u00E1 la b\u00FAsqueda para filtrar r\u00E1pido y abr\u00ED "Detalle" para marcar cap\u00EDtulos.' },
            col2: { title: "Cuenta", text: 'Entr\u00E1 desde el bot\u00F3n <strong>Cuenta</strong> para guardar tus listas.' }
        },
        manga: {
            col1: { title: "Tips", text: 'Entr\u00E1 a "Detalle" para marcar vol\u00FAmenes en verde y llevar progreso.' },
            col2: { title: "Cuenta", text: 'Si quer\u00E9s guardar tus listas, inici\u00E1 sesi\u00F3n desde <strong>Cuenta</strong>.' }
        },
        novelas: {
            col1: { title: "Tips", text: "Us\u00E1 la b\u00FAsqueda para filtrar por t\u00EDtulo." },
            col2: { title: "Cuenta", text: 'Inici\u00E1 sesi\u00F3n para guardar tus "Me gusta" y "Vistos".' }
        },
        index: {
            col1: { title: "Anime Destiny", text: "Cat\u00E1logo de anime, manga y novelas con detalle, progreso y listas por usuario." },
            col2: { title: "Contacto", text: "Soporte: contacto@animedestiny.local<br>Buenos Aires, AR" }
        },
        comparar: {
            col1: { title: "Tip", text: "Pod\u00E9s comparar t\u00EDtulos de distintas categor\u00EDas." },
            col2: { title: "Detalle", text: "Desde la comparaci\u00F3n pod\u00E9s abrir el detalle de cada uno." }
        },
        detalle: {
            col1: { title: "PROGRESO", text: "Toc\u00E1 los cuadrados (vol\u00FAmenes/cap\u00EDtulos) para marcarlos en verde." },
            col2: { title: "LISTAS", text: "Us\u00E1 \u2764 y \uD83D\uDC41 en las cards para armar tus listas." }
        },
        configuracion: {
            col1: { title: "Configuraci\u00F3n", text: "Tus cambios se guardan localmente en este navegador." },
            col2: { title: "Consejo", text: "Activ\u00E1 cards compactas si quer\u00E9s ver m\u00E1s t\u00EDtulos sin hacer tanto scroll." },
            col3: { title: "Seguridad", text: "Si elimin\u00E1s el usuario, se borra su sesi\u00F3n y progreso local." }
        },
        usuario: {
            col1: { title: "Perfil", text: "Gestion\u00E1 tu informaci\u00F3n, preferencias y estad\u00EDsticas de uso." },
            col2: { title: "Acciones", text: "Us\u00E1 Mis listas para revisar guardados y el comparador para analizar dos t\u00EDtulos." }
        },
        "mis-listas": {
            col1: { title: "Tus listas", text: "Revis\u00E1 tus Me gusta, Vistos y progreso de cap\u00EDtulos/vol\u00FAmenes." },
            col2: { title: "Cuenta", text: "Todo se guarda con tu cuenta de Supabase. Nunca perd\u00E9s tu progreso." }
        },
        top: {
            col1: { title: "Ranking", text: "Jugadores ordenados por nivel y experiencia total acumulada." },
            col2: { title: "F2P / P2W", text: "Pr\u00F3ximamente m\u00E1s categor\u00EDas de ranking." }
        },
        ranking: {
            col1: { title: "Top Ranking", text: "Anime, manga y novelas ordenados por la puntuaci\u00F3n de la comunidad." },
            col2: { title: "Detalle", text: "Toc\u00E1 cualquier fila para abrir la ficha completa del t\u00EDtulo." }
        }
    };

    const injectFooter = () => {
        const el = document.getElementById("footer-container");
        if (!el) return;

        const lang = window.AppI18n ? window.AppI18n.getLang() : "es";

        // Translate static footer titles/links
        const redesTitle = lang === "en" ? "Social" : "Redes";
        const privacidadText = lang === "en" ? "Privacy" : "Privacidad";
        const terminosText = lang === "en" ? "Terms" : "Términos";

        const data = FOOTER_DATA[pageKey];
        if (!data) return;

        let cols = "";
        const entries = data.col3 ? [data.col1, data.col2, data.col3] : [data.col1, data.col2];

        for (let i = 0; i < entries.length; i++) {
            const c = entries[i];
            let title = c.title;
            let text = c.text;

            // Apply translations dynamically for footer if language is set to English
            if (lang === "en") {
                if (title === "Tips" || title === "Tip" || title === "Consejo") title = "Tips";
                else if (title === "Cuenta") title = "Account";
                else if (title === "Contacto") title = "Contact";
                else if (title === "PROGRESO") title = "PROGRESS";
                else if (title === "LISTAS") title = "LISTS";
                else if (title === "Configuraci\u00F3n" || title === "Configuracion") title = "Settings";
                else if (title === "Seguridad") title = "Security";
                else if (title === "Perfil") title = "Profile";
                else if (title === "Acciones") title = "Actions";
                else if (title === "Tus listas") title = "Your lists";
                else if (title === "Ranking") title = "Ranking";
                else if (title === "F2P / P2W") title = "F2P / P2W";

                if (text.includes("b\u00FAsqueda para filtrar")) {
                    text = "Use search to filter quickly and open \"Detail\" to track chapters.";
                } else if (text.includes("Entr\u00E1 desde el bot\u00F3n")) {
                    text = "Log in using the <strong>Account</strong> button to save your lists.";
                } else if (text.includes("marcar vol\u00FAmenes")) {
                    text = "Open \"Detail\" to mark green volumes and track progress.";
                } else if (text.includes("guardar tus listas, inici\u00E1 sesi\u00F3n")) {
                    text = "If you want to save your lists, log in from <strong>Account</strong>.";
                } else if (text.includes("filtrar por t\u00EDtulo")) {
                    text = "Use search to filter by title.";
                } else if (text.includes("guardar tus \"Me gusta\"")) {
                    text = "Log in to save your \"Likes\" and \"Watched\" items.";
                } else if (text.includes("Cat\u00E1logo de anime")) {
                    text = "Anime, manga and novel catalog with detail, progress and lists per user.";
                } else if (text.includes("contacto@animedestiny")) {
                    text = "Support: contacto@animedestiny.local<br>Buenos Aires, AR";
                } else if (text.includes("comparar t\u00EDtulos de distintas")) {
                    text = "You can compare titles of different categories.";
                } else if (text.includes("comparaci\u00F3n pod\u00E9s abrir")) {
                    text = "From the comparison you can open the detail of each.";
                } else if (text.includes("cuadrados (vol\u00FAmenes")) {
                    text = "Tap the squares (volumes/chapters) to mark them green.";
                } else if (text.includes(" cards para armar")) {
                    text = "Use \u2764 and \uD83D\uDC41 on cards to build your lists.";
                } else if (text.includes("guardan localmente")) {
                    text = "Your changes are saved locally in this browser.";
                } else if (text.includes("cards compactas si quer\u00E9s")) {
                    text = "Enable compact cards if you want to see more titles without scrolling.";
                } else if (text.includes("elimin\u00E1s el usuario")) {
                    text = "If you delete the user, their session and local progress are deleted.";
                } else if (text.includes("Gestion\u00E1 tu informaci\u00F3n")) {
                    text = "Manage your info, preferences, and usage statistics.";
                } else if (text.includes("comparador para analizar")) {
                    text = "Use My lists to review saved items and comparison to analyze two titles.";
                } else if (text.includes("Revis\u00E1 tus Me gusta")) {
                    text = "Review your Likes, Watched and progress of chapters/volumes.";
                } else if (text.includes("Supabase. Nunca perd\u00E9s")) {
                    text = "Everything is saved to your Supabase account. You never lose your progress.";
                } else if (text.includes("nivel y experiencia total acumulada")) {
                    text = "Players sorted by level and total accumulated experience.";
                } else if (text.includes("categor\u00EDas de ranking")) {
                    text = "More ranking categories coming soon.";
                }
            }

            cols += `<div class="app-footer-col">
<div class="app-footer-title">${title}</div>
<p class="app-footer-text">${text}</p>
</div>`;
        }

        if (!data.col3) {
            cols += `<div class="app-footer-col">
<div class="app-footer-title">${redesTitle}</div>
<div class="app-footer-social">
<a class="app-footer-icon" href="#" aria-label="X">\uD835\uDD4F</a>
<a class="app-footer-icon" href="#" aria-label="Instagram">IG</a>
<a class="app-footer-icon" href="#" aria-label="YouTube">YT</a>
</div>
</div>`;
        }

        el.innerHTML = `<footer class="app-footer">
<div class="app-footer-inner">${cols}</div>
<div class="app-footer-bottom">
    <span>© 2026 Anime Destiny</span>
    <span style="margin: 0 10px;">•</span>
    <a class="app-footer-link app-footer-link-cyan" href="privacidad.html">${privacidadText}</a>
    <span style="margin: 0 10px;">•</span>
    <a class="app-footer-link app-footer-link-purple" href="terminos.html">${terminosText}</a>
</div>
</footer>`;
    };

    // ── Custom colors (leer desde localStorage y aplicar en :root) ──
    (() => {
        const r = (key, def) => {
            try { return localStorage.getItem(key) || def; } catch { return def; }
        };
        const colorKeys = {
            '--neon-purple':  'pref:color:neonPurple',
            '--nav-accent':   'pref:color:navAccent',
            '--accent-cyan':  'pref:color:cyan',
            '--dark-bg':      'pref:color:darkBg',
            '--text-main':    'pref:color:textMain',
            '--text-muted':   'pref:color:textMuted'
        };
        const defaults = {
            '--neon-purple':  '#bc13fe',
            '--nav-accent':   '#a855f7',
            '--accent-cyan':  '#00f2ff',
            '--dark-bg':      '#050505',
            '--text-main':    '#ffffff',
            '--text-muted':   '#b0b0b0'
        };
        const root = document.documentElement;
        for (const name in colorKeys) {
            if (colorKeys.hasOwnProperty(name)) {
                const val = r(colorKeys[name], defaults[name]);
                root.style.setProperty(name, val);
            }
        }
        const navAccent = root.style.getPropertyValue('--nav-accent') || defaults['--nav-accent'];
        root.style.setProperty('--nav-accent-soft', `${navAccent}3d`);
    })();

    // ── Cards per row (localStorage → body class) ──
    (() => {
        try {
            const cpr = localStorage.getItem('pref:cardsPerRow');
            if (cpr && cpr !== 'auto') {
                const n = parseInt(cpr, 10);
                if (n >= (AnimeDestiny.Constants.CARDS_PER_ROW_MIN || 2) && n <= (AnimeDestiny.Constants.CARDS_PER_ROW_MAX || 8)) {
                    document.documentElement.style.setProperty('--cards-per-row', String(n));
                    document.body.classList.add('fixed-cards-row');
                }
            }
        } catch { /* no-op (prefs) */ }
    })();

    // ── RUN ──
    const installSecurityHandlers = () => {
        if (window.__adSecurityHandlersInstalled) return;
        window.__adSecurityHandlersInstalled = true;

        document.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            var rememberLink = target.closest('a[data-remember-catalog="1"]');
            if (rememberLink) {
                if (typeof window.rememberCatalogPosition === 'function') {
                    window.rememberCatalogPosition();
                }
                return;
            }

            var restoreLink = target.closest('a[data-restore-catalog="1"]');
            if (restoreLink) {
                try { sessionStorage.setItem('shouldRestoreCatalog', '1'); } catch (_) {}
                return;
            }

            var activityLink = target.closest('a[data-open-tab="actividad"]');
            if (activityLink) {
                event.preventDefault();
                var tab = document.querySelector('.sidebar-link[data-tab="actividad"]');
                if (tab) tab.click();
                return;
            }

            var closeResumen = target.closest('button[data-close-modal="resumen"]');
            if (closeResumen) {
                var modal = document.getElementById('resumenModal');
                if (modal) modal.style.display = 'none';
            }
        }, true);

        document.addEventListener('error', function (event) {
            var target = event.target;
            if (!(target instanceof HTMLImageElement)) return;

            if (target.dataset.fallbackCatalog === '1') {
                if (typeof window.fallbackCatalogImage === 'function') {
                    window.fallbackCatalogImage(target);
                }
                return;
            }

            if (target.dataset.avatarFallback === '1') {
                target.style.display = 'none';
                var sibling = target.nextElementSibling;
                if (sibling) sibling.style.display = 'flex';
            }
        }, true);
    };
    ensureMainTarget();
    injectNavBrand();
    injectNavToggle();
    injectNavLinks();
    injectMobileBottomNav();
    injectLoginButton();
    injectFooter();
    installSecurityHandlers();

})();