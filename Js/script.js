// ==========================================
// script.js — núcleo del catálogo
// Funciones de catálogo extraídas a:
//   js/catalog/cards.js   → render de tarjetas, API, progreso
//   js/catalog/search.js  → búsqueda y filtros de género
// ==========================================

// ==========================================
// 1. CARGA DINÁMICA DESDE EL PANEL ADMIN
// ==========================================
function eliminarItem(id) {
    let listaItems = JSON.parse(UserStore.getItem('itemsTienda')) || [];
    listaItems = listaItems.filter(item => item.id !== id);
    UserStore.setItem('itemsTienda', JSON.stringify(listaItems));
    location.reload(); 
}
// ==========================================
// 3. SISTEMA DE FAVORITOS Y VISTOS
// ==========================================
function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getCategoriaActual() {
    const pathName = String(window.location.pathname || '').toLowerCase();
    if (pathName.includes('manga.html')) return 'manga';
    if (pathName.includes('anime.html')) return 'anime';
    if (pathName.includes('juegos.html')) return 'juegos';
    if (pathName.includes('novelas.html')) return 'novelas';
    const fromBody = document.body.getAttribute('data-page');
    return fromBody ? String(fromBody) : '';
}

function getCurrentUserId() {
    // Usar getCurrentUserSync (síncrono) en lugar de getCurrentUser que retorna Promise
    const user = window.AppSupabase?.getCurrentUserSync?.()
              || window.AppSupabase?.client?.auth?.user?.()
              || null;
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

function statusStorageKey(userId, itemId, type) {
    return `u:${userId}|item:${itemId}|${type}`;
}

function pointsKey(userId) {
    return `u:${userId}|points`;
}

function getUserPoints(userId) {
    const n = Number(UserStore.getItem(pointsKey(userId)) || '0');
    return Number.isFinite(n) ? n : 0;
}

function addUserPoints(userId, delta) {
    if (!userId || userId === 'Invitado') return;
    const next = Math.max(0, getUserPoints(userId) + delta);
    UserStore.setItem(pointsKey(userId), String(next)); // UI inmediata
    window.AppSupabase?.addExperience?.(delta);         // ← persistir
}

function levelFromPoints(points) {
    const p = Number(points) || 0;
    let level = 1;
    let need = 100;
    let remaining = p;
    while (remaining >= need) {
        remaining -= need;
        level += 1;
        need = Math.floor(need * 1.2);
        if (level > 50) break;
    }
    return { level, current: remaining, next: need };
}

function countKeysWithPrefix(prefix) {
    try {
        let count = 0;
        for (let i = 0; i < UserStore.length; i++) {
            const k = UserStore.key(i);
            if (!k) continue;
            if (k.startsWith(prefix) && UserStore.getItem(k)) count++;
        }
        return count;
    } catch {
        return 0;
    }
}

function countUserStates(userId, type) {
    if (!userId || userId === 'Invitado') return 0;
    let count = 0;
    const suffix = `|${type}`;
    const prefix = `u:${userId}|item:`;
    for (let i = 0; i < UserStore.length; i++) {
        const key = UserStore.key(i);
        if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        if (UserStore.getItem(key)) count++;
    }
    return count;
}

function getPreference(key, fallback = false) {
    try {
        const value = UserStore.getItem(key);
        if (value === null) return fallback;
        return value === 'true';
    } catch {
        return fallback;
    }
}

function applyUserPreferences() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.toggle('compact-cards', getPreference('pref:compactCards', false));
    document.body.classList.toggle('reduce-motion', getPreference('pref:reduceMotion', false));
}

function getPreferenceValue(key, fallback = '') {
    try {
        const value = UserStore.getItem(key);
        return value === null ? fallback : value;
    } catch {
        return fallback;
    }
}

function clearInlineBackgroundStyle(body) {
    body.style.removeProperty('background');
    body.style.removeProperty('background-image');
    body.style.removeProperty('background-color');
    body.style.removeProperty('background-repeat');
    body.style.removeProperty('background-size');
    body.style.removeProperty('background-position');
    body.style.removeProperty('background-attachment');
}

function applyBackgroundPreference() {
    if (typeof document === 'undefined' || !document.body) return;
    const body = document.body;
    const mode = getPreferenceValue('pref:bgMode', 'default');
    clearInlineBackgroundStyle(body);

    if (mode === 'color') {
        const color = getPreferenceValue('pref:bgColor', '#2b0a55');
        body.style.background = `linear-gradient(180deg, #000000 0%, ${color} 100%)`;
        body.style.backgroundAttachment = 'fixed';
    } else if (mode === 'image') {
        const imageUrl = getPreferenceValue('pref:bgImage', '');
        if (imageUrl) {
            body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.76)), url("${String(imageUrl).replaceAll('"', '\\"')}")`;
            body.style.backgroundSize = 'cover';
            body.style.backgroundPosition = 'center center';
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundAttachment = 'fixed';
        }
    }
}

function getUserStateSummary(userId) {
    const points = getUserPoints(userId);
    const level = levelFromPoints(points);
    const favorites = countUserStates(userId, 'fav');
    const viewed = countUserStates(userId, 'viewed');
    return { points, level, favorites, viewed };
}

function buildSearchIndexForItem(category, item) {
    const parts = [
        item?.titulo,
        item?.info,
        item?.status,
        item?.demografia
    ];

    const detail = (typeof obtenerDetalleItem === 'function')
        ? obtenerDetalleItem(category, item?.id)
        : null;

    if (detail) {
        parts.push(
            detail.estudio,
            detail.desarrollador,
            detail.editor,
            detail.plataforma,
            detail.resumen
        );
        if (Array.isArray(detail.temporadas)) {
            detail.temporadas.forEach((season) => {
                parts.push(season?.nombre, season?.episodios);
            });
        }
        if (Array.isArray(detail.franquicia)) {
            parts.push(...detail.franquicia);
        }
        if (category === 'manga') parts.push(detail.volumenes);
    }

    return parts
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ');
}

function injectAfterNavbar(html) {
    const navbar = document.querySelector('.navbar');
    if (!navbar || navbar.nextElementSibling?.classList?.contains('profile-strip')) return null;
    const wrapper = document.createElement('section');
    wrapper.className = 'profile-strip';
    wrapper.innerHTML = html;
    navbar.insertAdjacentElement('afterend', wrapper);
    return wrapper;
}

function renderUserProfileStrip() {
    // Disabled profile strip rendering as requested
}

function enhanceFooters() {
    const footers = document.querySelectorAll('.app-footer-inner');
    footers.forEach((footer) => {
        if (footer.querySelector('[data-footer-summary="1"]')) return;
        const summary = document.createElement('div');
        summary.className = 'app-footer-col app-footer-summary';
        summary.setAttribute('data-footer-summary', '1');
        summary.innerHTML = `
            <div class="app-footer-title">Atajos</div>
            <p class="app-footer-text">Usá el perfil para ver tu progreso, el comparador para revisar 2 títulos y el buscador para filtrar por título, género o estudio.</p>
        `;
        footer.appendChild(summary);
    });
}

function getProgressPercentForItem(userId, category, itemId) {
    try {
        const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
        if (viewed) return 100;
        const det = (typeof obtenerDetalleItem === 'function')
            ? obtenerDetalleItem(category, itemId)
            : null;

        if (category === 'manga') {
            const vols = Number(det?.volumenes || 0);
            const total = Number.isFinite(vols) ? vols : 0;
            if (!total) return 0;
            const read = countKeysWithPrefix(`u:${userId}|manga:${itemId}|vol:`);
            return Math.min(100, Math.round((read / total) * 100));
        }
        if (category === 'anime') {
            const temporadas = Array.isArray(det?.temporadas) ? det.temporadas : [];
            const total = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
            if (!total) return 0;
            const watched = countKeysWithPrefix(`u:${userId}|anime:${itemId}|s:`);
            return Math.min(100, Math.round((watched / total) * 100));
        }
        if (category === 'juegos') {
            return 0;
        }
    } catch {
        // ignore
    }
    return null;
}

function normalizeImageTitle(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function slugifyImageTitle(text, separator = '-') {
    return normalizeImageTitle(text).replace(/\s+/g, separator);
}

function buildCatalogImageCandidates(title, currentSrc = '') {
    const cleanTitle = String(title || '').trim();
    const current = String(currentSrc || '').trim();
    const variants = new Set([current]);
    const slug = slugifyImageTitle(cleanTitle);
    const compact = slugifyImageTitle(cleanTitle, '');
    const rawNoSymbols = cleanTitle
        .replace(/[â€™']/g, '')
        .replace(/[:!?.,]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const dashed = slugifyImageTitle(rawNoSymbols);
    const noSpaces = slugifyImageTitle(rawNoSymbols, '');

    const bases = [cleanTitle, rawNoSymbols, slug, dashed, compact, noSpaces]
        .filter(Boolean);

    const extensions = ['webp', 'jpg', 'jpeg', 'png', 'svg'];
    bases.forEach((base) => {
        extensions.forEach((ext) => {
            variants.add(`images/manga/${base}.${ext}`);
        });
    });

    const aliases = {
        'Oyasumi Punpun': ['images/manga/Goodnight-Punpun.webp', 'images/manga/Punpun.webp'],
        'Monster': ['images/manga/Monsters We Make.webp'],
        "JoJo's Bizarre": [
            "images/manga/JoJo's Bizarre Adventure Part 1 Phantom Blood.webp",
            "images/manga/JoJo's Bizarre Adventure Part 7 Steel Ball Run.jpg"
        ],
        'Frieren': ["images/manga/Frieren Beyond Journey's End.jpg"],
        'Akira': ['images/manga/Akira Failing in Love.webp'],
        'Dr. Stone': ['images/manga/Dr Stone .svg', 'images/manga/RuriDragon.webp'],
        'Dorohedoro': ['images/manga/RuriDragon.webp'],
        'Claymore': ['images/manga/Black Torch.webp'],
        "Hell's Paradise": ['images/manga/Hells-Paradise-2.svg'],
        'Hells Paradise': ['images/manga/Hells-Paradise-2.svg'],
        'Gantz': ['images/manga/Monsters We Make.webp'],
        'Pluto': ['images/manga/Blame!.webp'],
        'Real': ['images/manga/Blame!.webp'],
        'Biomega': ['images/manga/Blame!.webp'],
        'Yotsuba&!': ['images/manga/Yotsuba.svg']
    };

    (aliases[cleanTitle] || []).forEach((candidate) => variants.add(candidate));

    return [...variants].filter(Boolean);
}

function createFallbackPosterDataUrl(title, subtitle = '') {
    const safeTitle = String(title || 'Sin título').slice(0, 48);
    const safeSubtitle = String(subtitle || '').slice(0, 70);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
            <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#050505"/>
                    <stop offset="55%" stop-color="#1a0b2e"/>
                    <stop offset="100%" stop-color="#2b0a55"/>
                </linearGradient>
                <radialGradient id="glow1" cx="25%" cy="20%" r="70%">
                    <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.45"/>
                    <stop offset="100%" stop-color="#00f2ff" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="glow2" cx="75%" cy="80%" r="70%">
                    <stop offset="0%" stop-color="#bc13fe" stop-opacity="0.5"/>
                    <stop offset="100%" stop-color="#bc13fe" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <rect width="600" height="800" fill="url(#bg)"/>
            <rect width="600" height="800" fill="url(#glow1)"/>
            <rect width="600" height="800" fill="url(#glow2)"/>
            <rect x="36" y="36" width="528" height="728" rx="42" fill="none" stroke="#bc13fe" stroke-width="3"/>
            <text x="300" y="230" text-anchor="middle" fill="#00f2ff" font-size="44" font-family="Orbitron, Arial, sans-serif" font-weight="700">${safeTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
            ${safeSubtitle ? `<text x="300" y="290" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Rajdhani, Arial, sans-serif">${safeSubtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>` : ''}
        </svg>
    `.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function fallbackCatalogImage(imgEl) {
    if (!(imgEl instanceof HTMLImageElement)) return;
    if (imgEl.dataset.fallbackReady === '1') return;
    imgEl.dataset.fallbackReady = '1';

    const title = imgEl.dataset.title || imgEl.alt || 'Sin título';
    const subtitle = imgEl.dataset.subtitle || '';
    const currentSrc = imgEl.getAttribute('src') || '';
    const candidates = buildCatalogImageCandidates(title, currentSrc);

    let index = 0;
    const tryNext = () => {
        if (index >= candidates.length) {
            imgEl.src = createFallbackPosterDataUrl(title, subtitle);
            return;
        }

        const candidate = candidates[index++];
        if (!candidate || candidate === currentSrc) {
            tryNext();
            return;
        }

        const probe = new Image();
        probe.onload = () => {
            imgEl.src = candidate;
        };
        probe.onerror = tryNext;
        probe.src = candidate;
    };

    tryNext();
}

function updateCardProgressIndicators() {
    const mainContainer = document.getElementById('main-container');
    if (!mainContainer) return;
    const category = document.body.getAttribute('data-page') || '';
    const userId = getCurrentUserId();
    const cards = mainContainer.querySelectorAll('.card-container[data-item-id]');

    cards.forEach((card) => {
        const itemId = card.getAttribute('data-item-id');
        if (!itemId) return;
        const progressBox = card.querySelector('[data-progress]');
        if (!progressBox) return;

        const meta = resolveCatalogProgress(userId, String(category), String(itemId), card);
        const footer = card.querySelector('[data-completion-footer]');

        if (!meta.show) {
            progressBox.style.display = 'none';
            if (footer) footer.style.display = 'none';
            return;
        }

        const fillEl = progressBox.querySelector('.card-progress-fill, .card-back-progress-fill');
        const labelEl = progressBox.querySelector('[data-progress-label]');
        const pctEl = progressBox.querySelector('[data-progress-pct]');
        const completionEl = card.querySelector('[data-completion-text]');

        if (fillEl) fillEl.style.width = `${meta.pct}%`;
        if (labelEl) {
            labelEl.textContent = meta.total
                ? `${meta.prefix} ${meta.watched}/${meta.total}`
                : `${meta.pct}%`;
        }
        if (pctEl) pctEl.textContent = `${meta.pct}%`;
        if (completionEl) completionEl.textContent = meta.completionText || `${meta.pct}% VISTO`;

        progressBox.style.display = '';
        if (footer) footer.style.display = 'flex';
    });
}

function toggleStatus(btn, type, itemId) {
    const userId = getCurrentUserId();
    const storageKey = statusStorageKey(userId, itemId, type);

    btn.classList.toggle('active');

    if (btn.classList.contains('active')) {
        UserStore.setItem(storageKey, '1');
        addUserPoints(userId, type === 'viewed' ? 10 : 5);
    } else {
        UserStore.removeItem(storageKey);
    }

    const card = btn.closest('[data-item-id]');
    const completeInput = card?.querySelector('.card-complete-input');
    if (completeInput && type === 'viewed') {
        completeInput.checked = btn.classList.contains('active');
    }

    if (card && userId !== 'Invitado') {
        const fav = !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav'));
        const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
        const metaKey = `u:${userId}|itemMeta:${itemId}`;
        const category = card.getAttribute('data-category') || getCategoriaActual();
        const img = card.getAttribute('data-img') || card.querySelector('img')?.getAttribute('src') || '';
        const titulo = card.getAttribute('data-title') || card.querySelector('.catalog-card-title, .card-back-title')?.textContent || itemId;
        const info = card.getAttribute('data-genres') || card.getAttribute('data-search-index') || '';

        if (fav || viewed) {
            UserStore.setItem(metaKey, JSON.stringify({
                id: String(itemId),
                titulo: String(titulo).trim(),
                img,
                info,
                __category: String(category)
            }));
        } else {
            UserStore.removeItem(metaKey);
        }
        
        syncItemStateToSupabase(category, itemId, fav, viewed, {
            id: String(itemId),
            titulo: String(titulo).trim(),
            img,
            info,
            __category: String(category)
        });
    }

    updateCardProgressIndicators();
}

function syncItemStateToSupabase(category, itemId, fav, viewed, meta = {}) {
    const client = window.AppSupabase;
    if (!client?.saveItemState) return;
    client.saveItemState({ category, itemId, fav, viewed, meta }).catch((error) => {
        console.warn('No se pudo sincronizar estado a Supabase:', error);
    });
}

function applyRemoteStateToCards(cards, userId) {
    cards.forEach(card => {
        const itemId = card.getAttribute('data-item-id');
        if (!itemId) return;
        const favBtn = card.querySelector('.fav-btn');
        const viewedBtn = card.querySelector('.viewed-btn');
        if (favBtn) favBtn.classList.toggle('active', !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav')));
        if (viewedBtn) viewedBtn.classList.toggle('active', !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed')));
        const completeInput = card.querySelector('.card-complete-input');
        if (completeInput) completeInput.checked = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
    });
    updateCardProgressIndicators();
}

function syncStatesFromSupabase(category, userId, cards) {
    const client = window.AppSupabase;
    if (!client?.loadItemStates || !client?.isSignedIn?.()) return;
    client.loadItemStates(category).then((states) => {
        if (!Array.isArray(states)) return;
        states.forEach((state) => {
            const key = state.item_id;
            if (!key) return;
            if (state.fav)    UserStore.setItem(statusStorageKey(userId, key, 'fav'), '1');
            if (state.viewed) UserStore.setItem(statusStorageKey(userId, key, 'viewed'), '1');
        });
        applyRemoteStateToCards(cards, userId);
    }).catch((error) => {
        console.warn('No se pudo cargar estados desde Supabase:', error);
    });
}

function cargarEstadosBotones() {
    const userId = getCurrentUserId();
    const cards = document.querySelectorAll('[data-item-id]');

    cards.forEach(card => {
        const itemId = card.getAttribute('data-item-id');
        if (!itemId) return;

        const favBtn = card.querySelector('.fav-btn');
        const viewedBtn = card.querySelector('.viewed-btn');

        if (favBtn) {
            favBtn.classList.toggle('active', !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav')));
        }
        if (viewedBtn) {
            viewedBtn.classList.toggle('active', !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed')));
        }

        const completeInput = card.querySelector('.card-complete-input');
        if (completeInput) {
            completeInput.checked = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
        }
    });

    updateCardProgressIndicators();
    syncStatesFromSupabase(getCategoriaActual(), userId, cards);

    // Pull inicial desde SQL deshabilitado temporalmente
}

// ==========================================
// 4. ANIMACIÓN DE PARTÍCULAS (Solo para Index)
// ==========================================
function iniciarParticulas() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return; // Protección: Si la página no tiene canvas, no ejecuta esto.

    const ctx = canvas.getContext('2d');
    let particles = [];
    const particleCount = 80;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor() { this.init(); }
        init() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
            this.color = Math.random() > 0.5 ? '#00f2ff' : '#bc13fe';
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    animate();
}

function inicializarNavbarAdaptable() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    if (!navbar.querySelector('.nav-toggle')) {
        const toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Abrir menú');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = `<span class="nav-toggle-icon" aria-hidden="true"></span><span>Menú</span>`;
        navbar.insertBefore(toggle, navbar.firstElementChild);

        toggle.addEventListener('click', () => {
            const isOpen = navbar.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
        });
    }

    const update = () => {
        navbar.classList.toggle('is-scrolled', (window.scrollY || 0) > 12);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
}

// ==========================================
// 5. INICIALIZADOR PRINCIPAL (Evita conflictos)
// ==========================================
/*
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar ítems del admin
    applyUserPreferences();
    
    // 2. Restaurar favoritos
    cargarEstadosBotones();

    // 2.5 Perfil y footer más ricos
    renderUserProfileStrip();
    enhanceFooters();
    inicializarNavbarAdaptable();
    
    // 3. Encender partículas (si existe el canvas)
    iniciarParticulas();
    applyBackgroundPreference();
    
    // 4. Iniciar precios dinámicos
    updatePrices();
    setInterval(updatePrices, 8000);
});
*/

document.addEventListener('DOMContentLoaded', () => {
    applyUserPreferences();
    enhanceFooters();
    inicializarNavbarAdaptable();
    iniciarParticulas();
    applyBackgroundPreference();
    updatePrices();
    setInterval(updatePrices, 8000);
});

// ==========================================
// 6. BUSQUEDA DESDE API
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('catalogSearch');
    if (!searchInput) return;

    searchInput.addEventListener('keypress', async (e) => {
        if (e.key !== 'Enter') return;

        const query = searchInput.value;
        const pageType = document.body.getAttribute('data-page');
        const resultados = pageType === 'novelas'
            ? await window.buscarNovelasEnApi(query)
            : await window.buscarEnApi(query, pageType);

        mostrarResultados(resultados);
    });
});

function mostrarResultados(items) {
    const galeria = document.getElementById('main-container');
    if (!galeria) return;

    const pageType = document.body.getAttribute('data-page');
    const list = Array.isArray(items) ? items.slice(0, 40) : [];

    galeria.innerHTML = list.map((item) => {
        const id = item.mal_id;
        const title = item.title || 'Sin titulo';
        const image = getApiPoster(item);
        const info = getApiCatalogInfo(pageType, item);
        const genres = getApiGenresList(item);
        const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
        const detailUrl = `detalle.html?cat=${encodeURIComponent(pageType)}&id=${encodeURIComponent(id)}`;
        const searchIndex = [title, item.title_english, info, item.synopsis, ...genres].filter(Boolean).join(' ').toLowerCase();

        return buildCatalogCardHtml({
            id,
            title,
            image,
            detailUrl,
            status: item.status || 'En emision',
            searchIndex,
            genres: genres.join('|'),
            genresNorm,
            categoria: pageType,
            progressTotal: pageType === 'anime' ? (item.episodes || 0) : (item.volumes || item.chapters || 0),
            imageExtraAttrs: ` data-title="${escapeHtml(title)}" onerror="fallbackCatalogImage(this)"`
        });
    }).join('');

    window.__catalogSearchItems = list.map((item) => ({
        item: {
            id: item.mal_id,
            titulo: item.title,
            info: getApiCatalogInfo(pageType, item)
        },
        searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
    }));

    cargarEstadosBotones();
    inicializarGeneroWidgets();
    if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
}

function renderFeaturedBanner() {
    const host = document.getElementById('featuredBanner');
    if (!host) return;
    if (typeof DATOS_WEB === 'undefined' || !DATOS_WEB) return;

    const mode = host.getAttribute('data-featured') || 'all'; // all | anime | manga | juegos

    function buildRow(category, title, subtitle, maxItems, itemIds) {
        const list = Array.isArray(DATOS_WEB[category]) ? DATOS_WEB[category] : [];
        const picked = Array.isArray(itemIds) && itemIds.length
            ? itemIds.map((id) => list.find((x) => String(x.id) === String(id))).filter(Boolean)
            : list.slice(0, maxItems);

        if (!picked.length) return '';

        const itemsHtml = picked.map((item) => {
            const link = `detalle.html?cat=${encodeURIComponent(category)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(item.titulo)}`;
            return `
                <a class="featured-item" href="${link}">
                    <div class="featured-thumb">
                        <img src="${item.img}" alt="${item.titulo}" loading="lazy" data-title="${item.titulo}" data-subtitle="${item.info || ''}" onerror="fallbackCatalogImage(this)">
                    </div>
                    <div class="featured-meta">
                        <div class="featured-name">${item.titulo}</div>
                        <div class="featured-info">${item.info || ''}</div>
                    </div>
                </a>
            `;
        }).join('');

        return `
            <section class="featured-block" aria-label="${title}">
                <div class="featured-head">
                    <div>
                        <h2 class="featured-title">${title}</h2>
                        <p class="featured-subtitle">${subtitle}</p>
                    </div>
                </div>
                <div class="featured-row" role="list">${itemsHtml}</div>
            </section>
        `;
    }

    const defaultIds = {
        anime: ['a1', 'a3', 'a2', 'a29', 'a36', 'a37', 'a50', 'a51'],
        manga: ['m1', 'm2', 'm3', 'm25', 'm26', 'm6', 'm10', 'm21'],
        juegos: ['j1', 'j2', 'j3', 'j10', 'j26', 'j31', 'j46', 'j62']
    };

    const blocks = [];
    if (mode === 'all' || mode === 'anime') blocks.push(buildRow('anime', 'Animes destacados', 'Elegidos para empezar rápido.', 10, defaultIds.anime));
    if (mode === 'all' || mode === 'manga') blocks.push(buildRow('manga', 'Mangas destacados', 'Lo más buscado y recomendado.', 10, defaultIds.manga));
    if (mode === 'all' || mode === 'juegos') blocks.push(buildRow('juegos', 'Juegos destacados', 'Franquicias y clásicos modernos.', 10, defaultIds.juegos));

    host.innerHTML = blocks.join('');
}

document.addEventListener('DOMContentLoaded', renderFeaturedBanner);

function renderContinueWatching() {
    const host = document.getElementById('continueWatching');
    if (!host) return;
    if (typeof DATOS_WEB === 'undefined' || !DATOS_WEB) return;

    const userId = getCurrentUserId();
    if (userId === 'Invitado') {
        host.innerHTML = `
            <section class="featured-block">
                <div class="featured-head">
                    <div>
                        <h2 class="featured-title">Continúa viendo</h2>
                        <p class="featured-subtitle">Iniciá sesión para ver tu progreso.</p>
                    </div>
                </div>
            </section>
        `;
        return;
    }

    const keys = UserStore.keys();

    function lastProgressFor(prefix, parseFn) {
        let best = null;
        keys.forEach((k) => {
            if (!k.startsWith(prefix)) return;
            const value = UserStore.getItem(k);
            if (!value) return;
            const p = parseFn(k);
            if (!p) return;
            if (!best || p.score > best.score) best = p;
        });
        return best;
    }

    // Manga: u:<user>|manga:<id>|vol:<n>
    const mangaProg = lastProgressFor(`u:${userId}|manga:`, (k) => {
        const m = k.match(/\|manga:([^|]+)\|vol:(\d+)$/);
        if (!m) return null;
        const id = m[1];
        const vol = Number(m[2]);
        if (!Number.isFinite(vol)) return null;
        return { cat: 'manga', id, label: `Vol. ${vol}`, score: vol };
    });

    // Anime: u:<user>|anime:<id>|s:<idx>|ep:<n>
    const animeProg = lastProgressFor(`u:${userId}|anime:`, (k) => {
        const m = k.match(/\|anime:([^|]+)\|s:(\d+)\|ep:(\d+)$/);
        if (!m) return null;
        const id = m[1];
        const sIdx = Number(m[2]);
        const ep = Number(m[3]);
        if (!Number.isFinite(sIdx) || !Number.isFinite(ep)) return null;
        return { cat: 'anime', id, label: `T${sIdx + 1} Â· Ep. ${ep}`, score: (sIdx + 1) * 10000 + ep };
    });

    const items = [animeProg, mangaProg].filter(Boolean);
    if (items.length === 0) {
        host.innerHTML = `
            <section class="featured-block">
                <div class="featured-head">
                    <div>
                        <h2 class="featured-title">Continúa viendo</h2>
                        <p class="featured-subtitle">Marcá capítulos/volúmenes en â€œDetalleâ€ para que aparezcan acá.</p>
                    </div>
                </div>
            </section>
        `;
        return;
    }

    function findItem(cat, id) {
        if (typeof obtenerItemCategoria === 'function') return obtenerItemCategoria(cat, id);
        const list = Array.isArray(DATOS_WEB[cat]) ? DATOS_WEB[cat] : [];
        return list.find((x) => String(x.id) === String(id)) || null;
    }

    const cards = items.map((p) => {
        const item = findItem(p.cat, p.id);
        if (!item) return '';
        const link = `detalle.html?cat=${encodeURIComponent(p.cat)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(item.titulo)}`;
        return `
            <a class="featured-item" href="${link}">
                <div class="featured-thumb">
                    <img src="${item.img}" alt="${item.titulo}" loading="lazy" data-title="${item.titulo}" data-subtitle="${item.info || ''}" onerror="fallbackCatalogImage(this)">
                </div>
                <div class="featured-meta">
                    <div class="featured-name">${item.titulo}</div>
                    <div class="featured-info">${p.label}</div>
                </div>
            </a>
        `;
    }).join('');

    host.innerHTML = `
        <section class="featured-block" aria-label="Continúa viendo">
            <div class="featured-head">
                <div>
                    <h2 class="featured-title">Continúa viendo</h2>
                    <p class="featured-subtitle">Tu progreso reciente (por usuario).</p>
                </div>
            </div>
            <div class="featured-row" role="list">${cards}</div>
        </section>
    `;
}

document.addEventListener('DOMContentLoaded', renderContinueWatching);

// ==========================================
// LÓGICA DE PAGINACIÓN Y API (Modificado)
// ==========================================

// 1. Variable global para controlar en qué página estamos
let currentPage = 1;

// 2. Función que los botones "Anterior" y "Siguiente" van a usar



const CATALOG_FLIP_ICON_SVG = `<svg class="catalog-flip-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`;







// 3. Modificamos esta función para que reciba "page"


async function inicializarPagina() {
    const mainContainer = document.getElementById("main-container");
    if (!mainContainer) return;

    // Detectar categoría según el body
    const categoria = document.body.getAttribute("data-page");

    // Al recargar la página, nos aseguramos de estar en la página 1
    currentPage = 1;
    const pageNum = document.getElementById('page-num');
    if (pageNum) pageNum.innerText = currentPage;

    const usaCatalogoApi = categoria === 'anime' || categoria === 'manga' || categoria === 'novelas';

    if (usaCatalogoApi) {
        await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage);
        return;
    }
    
    // Obtenemos los datos desde datos.js usando una API común para todas las categorías locales (Juegos, Novelas)
    const listaItems = (typeof obtenerItemsCategoria === 'function')
        ? obtenerItemsCategoria(categoria)
        : ((typeof DATOS_WEB !== 'undefined' && DATOS_WEB && DATOS_WEB[categoria]) || []);
    window.__catalogSearchItems = listaItems.map((item) => ({ item, searchIndex: buildSearchIndexForItem(categoria, item) }));

    if (listaItems.length === 0) {
        mainContainer.innerHTML = `
            <section class="empty-state">
                <span class="empty-state-kicker">Catálogo en preparación</span>
                <h2>Próximamente más contenido de ${escapeHtml(categoria)}.</h2>
                <p>Cuando cargues nuevos títulos desde datos o el panel, van a aparecer en esta sección.</p>
            </section>
        `;
        return;
    }

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    function getGenres(item) {
        return (typeof separarGeneros === 'function')
            ? separarGeneros(item?.info)
            : String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean);
    }

    mainContainer.innerHTML = listaItems.map(item => {
        const genres = getGenres(item);
        const genresNorm = genres.map(g => normalize(g)).join('|');
        const searchIndex = buildSearchIndexForItem(categoria, item);
        const detailUrl = `detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(item.titulo)}`;
        const hasDetail = typeof obtenerDetalleItem === 'function' && !!obtenerDetalleItem(categoria, item.id);
        const detalle = (typeof obtenerDetalleItem === 'function')
            ? obtenerDetalleItem(categoria, item.id)
            : null;
        let progressTotal = 0;
        if (categoria === 'anime' && detalle?.temporadas) {
            progressTotal = detalle.temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
        } else if (categoria === 'manga') {
            progressTotal = Number(detalle?.volumenes || 0);
        }

        return buildCatalogCardHtml({
            id: item.id,
            title: item.titulo,
            image: item.img,
            detailUrl,
            status: item.status || '',
            showDetail: hasDetail,
            searchIndex,
            genres: genres.join('|'),
            genresNorm,
            categoria,
            progressTotal,
            imageExtraAttrs: ` data-title="${escapeHtml(item.titulo)}" onerror="fallbackCatalogImage(this)"`
        });
    }).join('');

    cargarEstadosBotones();
    inicializarBusquedaCatalogo();
    inicializarGeneroWidgets();
}

document.addEventListener("DOMContentLoaded", inicializarPagina);


function rememberCatalogPosition() {
    try {
        sessionStorage.setItem('lastCatalogUrl', window.location.href);
        sessionStorage.setItem('lastCatalogScrollY', String(window.scrollY || 0));
    } catch {
        // ignore
    }
}

function restoreCatalogPosition() {
    try {
        const url = sessionStorage.getItem('lastCatalogUrl');
        const y = Number(sessionStorage.getItem('lastCatalogScrollY') || '0');
        const shouldRestore = sessionStorage.getItem('shouldRestoreCatalog') === '1';
        if (!shouldRestore) return;
        if (url && url === window.location.href) {
            sessionStorage.removeItem('shouldRestoreCatalog');
            window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: 'instant' });
        }
    } catch {
        // ignore
    }
}

document.addEventListener('DOMContentLoaded', restoreCatalogPosition);
