(() => {
    "use strict";

    const path = window.location.pathname.toLowerCase();
    const pageKey = path.includes("mis-listas") ? "mis-listas" :
        path.includes("anime") ? "anime" :
        path.includes("manga") ? "manga" :
        path.includes("novelas") ? "novelas" :
        path.includes("comparar") ? "comparar" :
        path.includes("detalle") ? "detalle" :
        path.includes("configuracion") ? "configuracion" :
        path.includes("usuario") ? "usuario" :
        path.includes("login") ? "login" :
        path.includes("top") ? "top" :
        "index";


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

        const isAnime = path.includes("anime");
        const isManga = path.includes("manga");
        const isNovelas = path.includes("novelas");
        const isMisListas = path.includes("mis-listas");
        const isTop = path.includes("top");
        const isIndex = path.endsWith("index.html") || path.endsWith("/") || path === "";
        const isDetail = path.includes("detalle");

        let activePage = isAnime ? "anime" : isManga ? "manga" : isNovelas ? "novelas" : isMisListas ? "mis-listas" : isTop ? "top" : null;
        if (isIndex) activePage = null;

        const links = [
            { id: "anime", href: "anime.html", icon: "clapperboard", label: window.AppI18n ? window.AppI18n.t("nav.anime") : "Anime" },
            { id: "manga", href: "manga.html", icon: "book-open", label: window.AppI18n ? window.AppI18n.t("nav.manga") : "Manga" },
            { id: "novelas", href: "novelas.html", icon: "book", label: window.AppI18n ? window.AppI18n.t("nav.novelas") : "Novelas" },
            { id: "mis-listas", href: "mis-listas.html", icon: "heart", label: window.AppI18n ? window.AppI18n.t("nav.mis_listas") : "Mis Listas" },
            { id: "top", href: "top.html", icon: "trophy", label: window.AppI18n ? window.AppI18n.t("nav.top") : "Ranking" }
        ];

        let html = "";
        for (let i = 0; i < links.length; i++) {
            const l = links[i];
            let cls = "nav-btn";
            let current = "";
            let dataCat = "";
            if (l.id === activePage) {
                cls += " active";
                current = ' aria-current="page"';
            }
            if (isDetail && i < 3) {
                dataCat = ` data-nav-cat="${l.id}"`;
            }
            html += `<a href="${l.href}" class="${cls}"${current}${dataCat}>
<span class="nav-icon" aria-hidden="true"><i data-lucide="${l.icon}"></i></span><span data-i18n="nav.${l.id.replace('-', '_')}">${l.label}</span>
</a>`;
        }
        el.innerHTML = `<div class="nav-links" aria-label="Navegación principal">${html}</div>`;
    };

    // ── MOBILE BOTTOM NAV ──
    const injectMobileBottomNav = () => {
        if (document.querySelector('.mobile-bottom-nav')) return;

        // No inyectar en páginas de auth (en el resto siempre debe haber
        // navegación visible: en mobile la navbar superior queda oculta)
        const skipPages = ["login"];
        for (let i = 0; i < skipPages.length; i++) {
            if (path.includes(skipPages[i])) return;
        }
        if (path.includes("404")) return;

        const isAnime = path.includes("anime");
        const isManga = path.includes("manga");
        const isNovelas = path.includes("novelas");
        const isMisListas = path.includes("mis-listas");

        const isTop = path.includes("top");
        const isIndex = path.endsWith("index.html") || path.endsWith("/") || path === "";

        let activePage = isAnime ? "anime" : isManga ? "manga" : isNovelas ? "novelas" : isMisListas ? "mis-listas" : isTop ? "top" : null;
        if (isIndex) activePage = null;

        // "mis-listas" usa la clave corta nav.listas: "Mis Listas" no entra
        // en una línea y desalinea el icono del tab en pantallas chicas
        const tabs = [
            { id: "anime", href: "anime.html", icon: "clapperboard", i18n: "nav.anime", label: window.AppI18n ? window.AppI18n.t("nav.anime") : "Anime" },
            { id: "manga", href: "manga.html", icon: "book-open", i18n: "nav.manga", label: window.AppI18n ? window.AppI18n.t("nav.manga") : "Manga" },
            { id: "novelas", href: "novelas.html", icon: "book", i18n: "nav.novelas", label: window.AppI18n ? window.AppI18n.t("nav.novelas") : "Novelas" },
            { id: "mis-listas", href: "mis-listas.html", icon: "heart", i18n: "nav.listas", label: window.AppI18n ? window.AppI18n.t("nav.listas") : "Listas" },
            { id: "top", href: "top.html", icon: "trophy", i18n: "nav.top", label: window.AppI18n ? window.AppI18n.t("nav.top") : "Top" }
        ];

        let html = '';
        for (let i = 0; i < tabs.length; i++) {
            const t = tabs[i];
            const activeClass = t.id === activePage ? ' active' : '';
            const currentAttr = t.id === activePage ? ' aria-current="page"' : '';
            html += `<a href="${t.href}" class="bottom-tab${activeClass}"${currentAttr}>
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="${t.icon}"></i></span>
<span data-i18n="${t.i18n}">${t.label}</span>
</a>`;
        }

        const searchText = window.AppI18n ? window.AppI18n.t("nav.menu") : "Menú";
        html += `<button class="bottom-tab-search" aria-label="Buscar" type="button">
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="menu"></i></span>
<span data-i18n="nav.menu">${searchText}</span>
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
            const searchBtn = nav.querySelector('.bottom-tab-search');
            if (searchBtn) searchBtn.classList.remove('is-open');
        });

        // Search toggle: show top navbar search
        const searchBtn = nav.querySelector('.bottom-tab-search');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const navbar = document.querySelector('.destiny-navbar');
                if (!navbar) return;
                const isOpen = navbar.classList.toggle('is-open');
                searchBtn.classList.toggle('is-open', isOpen);
                if (isOpen) {
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
        if (path.includes("login")) return;

        const ingresarText = window.AppI18n ? window.AppI18n.t("nav.ingresar") : "Ingresar";
        const invitadoText = window.AppI18n ? window.AppI18n.t("nav.usuario_invitado") : "...";
        el.innerHTML = `<div class="nav-user" id="nav-user">
<div id="nav-user-avatar" class="nav-user-avatar"></div>
<div class="nav-user-info">
<span id="nav-user-name" class="nav-user-name" data-i18n="nav.usuario_invitado">${invitadoText}</span>
<a id="nav-user-btn" href="Login.html" class="nav-user-btn" data-i18n="nav.ingresar">${ingresarText}</a>
</div>
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