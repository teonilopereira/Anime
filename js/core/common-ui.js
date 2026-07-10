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

    const ensureSkipLink = () => {
        if (document.querySelector('.skip-link')) return;
        const skip = document.createElement('a');
        skip.className = 'skip-link';
        skip.href = '#main-content';
        skip.textContent = 'Saltar al contenido';
        document.body.prepend(skip);
    };

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
            { id: "anime", href: "anime.html", icon: "\uD83C\uDFAC", label: "Anime" },
            { id: "manga", href: "manga.html", icon: "\uD83D\uDCDA", label: "Manga" },
            { id: "novelas", href: "novelas.html", icon: "\uD83D\uDCD6", label: "Novelas" },
            { id: "mis-listas", href: "mis-listas.html", icon: "\uD83D\uDC96", label: "Mis Listas" },
            { id: "top", href: "top.html", icon: "\uD83C\uDFC6", label: "Ranking" }
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
<span class="nav-icon" aria-hidden="true">${l.icon}</span><span>${l.label}</span>
</a>`;
        }
        el.innerHTML = `<div class="nav-links" aria-label="Navegaci\u00F3n principal">${html}</div>`;
    };

    // ── LOGIN / USER AREA ──
    const injectLoginButton = () => {
        const el = document.getElementById("nav-login-container");
        if (!el) return;
        if (path.includes("login")) return;

        el.innerHTML = `<div class="nav-user" id="nav-user">
<div id="nav-user-avatar" class="nav-user-avatar"></div>
<div class="nav-user-info">
<span id="nav-user-name" class="nav-user-name">Invitado</span>
<a id="nav-user-btn" href="Login.html" class="nav-user-btn">Ingresar</a>
</div>
</div>`;

        // Refrescar la UI del usuario si auth.js ya cargó
        if (typeof window.refreshUserUi === 'function') {
            window.refreshUserUi();
        }
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

        const data = FOOTER_DATA[pageKey];
        if (!data) return;

        let cols = "";
        const entries = data.col3 ? [data.col1, data.col2, data.col3] : [data.col1, data.col2];

        for (let i = 0; i < entries.length; i++) {
            const c = entries[i];
            cols += `<div class="app-footer-col">
<div class="app-footer-title">${c.title}</div>
<p class="app-footer-text">${c.text}</p>
</div>`;
        }

        if (!data.col3) {
            cols += `<div class="app-footer-col">
<div class="app-footer-title">Redes</div>
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
    <a class="app-footer-link app-footer-link-cyan" href="privacidad.html">Privacidad</a>
    <span style="margin: 0 10px;">•</span>
    <a class="app-footer-link app-footer-link-purple" href="terminos.html">Términos</a>
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
        let hasCustom = false;
        for (const name in colorKeys) {
            if (colorKeys.hasOwnProperty(name)) {
                const val = r(colorKeys[name], defaults[name]);
                root.style.setProperty(name, val);
                if (val !== defaults[name]) hasCustom = true;
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
    ensureSkipLink();
    ensureMainTarget();
    injectNavBrand();
    injectNavToggle();
    injectNavLinks();
    injectLoginButton();
    injectFooter();
    installSecurityHandlers();

})();



