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
// 2. ACTUALIZACIÓN DE PRECIOS ALEATORIOS
// ==========================================
function updatePrices() {
    const priceElements = document.querySelectorAll('.price-tag');

    priceElements.forEach((element) => {
        let currentText = element.innerText.replace('$', '').replace(/\./g, '').trim();
        let basePrice = parseFloat(currentText);

        if (!isNaN(basePrice)) {
            const variation = Math.floor(Math.random() * 1001) - 500;
            let newPrice = basePrice + variation;

            // Evitar que el precio sea menor a $1000
            if (newPrice < 1000) newPrice = 1000;

            element.innerText = `$${newPrice.toLocaleString('es-AR')}`;
            
            // Efecto de parpadeo de color
            element.style.color = "var(--accent-cyan)";
            setTimeout(() => { element.style.color = "white"; }, 500);
        }
    });
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
    const user = window.AppSupabase?.getCurrentUser?.();
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
    const next = Math.max(0, getUserPoints(userId) + (Number(delta) || 0));
    UserStore.setItem(pointsKey(userId), String(next));
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
                __category: category
            }));
        } else {
            UserStore.removeItem(metaKey);
        }

        syncItemStateToSupabase(category, itemId, fav, viewed, {
            id: String(itemId),
            titulo: String(titulo).trim(),
            img,
            info,
            __category: category
        });
    }

    updateCardProgressIndicators();

    // Si hay sesión SQL activa, sincroniza el estado (favorito/visto) al servidor.
    // Deshabilitado temporalmente para usar solo LocalStorage
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

    const keys = Object.keys(UserStore);

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

function inicializarBusquedaCatalogo() {
    const categoria = document.body.getAttribute('data-page');
    const input = document.getElementById('catalogSearch') || document.getElementById('mangaSearch');
    const mainContainer = document.getElementById('main-container');
    if (!input || !mainContainer) return;

    const inputWrap = input.closest('.nav-search') || input.parentElement;
    let suggestionBox = document.getElementById('catalogSuggestions');
    if (!suggestionBox && inputWrap) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'catalogSuggestions';
        suggestionBox.className = 'catalog-suggestions';
        inputWrap.appendChild(suggestionBox);
    }

    let emptyMsg = document.getElementById('searchEmptyMsg');
    if (!emptyMsg) {
        emptyMsg = document.createElement('section');
        emptyMsg.id = 'searchEmptyMsg';
        emptyMsg.className = 'empty-state empty-state-inline';
        emptyMsg.style.display = 'none';
        const nombreCategoria = categoria ? String(categoria) : 'contenido';
        emptyMsg.innerHTML = `
            <span class="empty-state-kicker">Sin resultados</span>
            <h2>No encontramos coincidencias en ${escapeHtml(nombreCategoria)}.</h2>
            <p>Probá con otro título, género o estado.</p>
        `;
        mainContainer.parentElement?.appendChild(emptyMsg);
    }

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    function getCatalogItems() {
        return Array.isArray(window.__catalogSearchItems) ? window.__catalogSearchItems : [];
    }

    function renderSuggestions(query) {
        if (!suggestionBox) return;
        const q = normalize(query);
        if (!q) {
            suggestionBox.classList.remove('is-open');
            suggestionBox.innerHTML = '';
            return;
        }

        const matches = getCatalogItems()
            .filter((entry) => normalize(entry.searchIndex || '').includes(q))
            .slice(0, 6);

        if (!matches.length) {
            suggestionBox.innerHTML = `
                <div class="catalog-suggestion empty">
                    <span class="catalog-suggestion-title">Sin sugerencias</span>
                    <span class="catalog-suggestion-meta">Probá con menos palabras o revisá el género.</span>
                </div>
            `;
            suggestionBox.classList.add('is-open');
            return;
        }

        suggestionBox.innerHTML = matches.map((entry) => `
            <a class="catalog-suggestion" href="detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(entry.item.id)}&nombre=${encodeURIComponent(entry.item.titulo)}">
                <span class="catalog-suggestion-title">${escapeHtml(entry.item.titulo)}</span>
                <span class="catalog-suggestion-meta">${escapeHtml(entry.item.info || entry.item.status || '')}</span>
            </a>
        `).join('');
        suggestionBox.classList.add('is-open');
    }

    function applyFilter() {
        const q = normalize(input.value);
        const cards = mainContainer.querySelectorAll('.card-container');
        const selectedGenres = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        let visible = 0;

        cards.forEach(card => {
            const indexText = normalize(card.getAttribute('data-search-index') || '');
            const genres = String(card.getAttribute('data-genres-norm') || '');
            const matchQuery = !q || indexText.includes(q);
            const genreSet = new Set(genres.split('|').filter(Boolean));
            const matchGenre = selectedGenres.length === 0 || selectedGenres.some((g) => genreSet.has(String(g)));
            const match = matchQuery && matchGenre;
            card.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        emptyMsg.style.display = (cards.length > 0 && visible === 0) ? '' : 'none';
        renderSuggestions(input.value);
    }

    input.addEventListener('input', applyFilter);
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (suggestionBox) suggestionBox.classList.remove('is-open');
        }, 180);
    });
    window.__applyCatalogFilter = applyFilter;
    applyFilter();
}
function getApiPoster(item) {
    return item?.images?.webp?.large_image_url
        || item?.images?.jpg?.large_image_url
        || item?.images?.jpg?.image_url
        || item?.images?.webp?.image_url
        || '';
}
// ==========================================
// LÓGICA DE PAGINACIÓN Y API (Modificado)
// ==========================================

// 1. Variable global para controlar en qué página estamos
let currentPage = 1;

// 2. Función que los botones "Anterior" y "Siguiente" van a usar
window.changePage = async function(delta) {
    const mainContainer = document.getElementById("main-container");
    const categoria = document.body.getAttribute("data-page");
    
    // Si no estamos en anime o manga, no hacemos nada
    if (!mainContainer || (categoria !== 'anime' && categoria !== 'manga' && categoria !== 'novelas')) return;

    // Sumamos o restamos, asegurando que nunca baje de la página 1
    currentPage = Math.max(1, currentPage + delta);
    
    // Actualizamos el numerito en el HTML
    const pageNum = document.getElementById('page-num');
    if (pageNum) pageNum.innerText = currentPage;

    // Volvemos a pedir los datos a la API con la página nueva
    await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage);
};

function getApiPoster(item) {
    return item?.images?.webp?.large_image_url
        || item?.images?.jpg?.large_image_url
        || item?.images?.jpg?.image_url
        || item?.images?.webp?.image_url
        || '';
}

function getApiCatalogInfo(categoria, item) {
    if (categoria === 'anime') {
        const parts = [item?.type, item?.episodes ? `${item.episodes} eps` : '', item?.status].filter(Boolean);
        return parts.join(' / ') || 'Anime';
    }

    const typeLabel = String(item?.type || '').toLowerCase().includes('light')
        ? 'Novela ligera'
        : (String(item?.type || '').toLowerCase() === 'novel' ? 'Novela' : (item?.type || 'Manga'));
    const parts = [typeLabel, item?.volumes ? `${item.volumes} vol.` : '', item?.status].filter(Boolean);
    if (categoria === 'novelas') return parts.join(' / ') || 'Novela';
    return parts.join(' / ') || 'Manga';
}

function normalizeCatalogGenre(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();
}

function getApiGenresList(item) {
    const genres = Array.isArray(item?.genres)
        ? item.genres.map((genre) => typeof genre === 'string' ? genre : genre?.name)
        : [];
    const themes = Array.isArray(item?.themes)
        ? item.themes.map((theme) => typeof theme === 'string' ? theme : theme?.name)
        : [];

    return [...genres, ...themes]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.findIndex((x) => normalizeCatalogGenre(x) === normalizeCatalogGenre(value)) === index);
}

const CATALOG_FLIP_ICON_SVG = `<svg class="catalog-flip-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`;

function getCatalogProgressPrefix(categoria) {
    if (categoria === 'anime') return 'EP';
    if (categoria === 'manga' || categoria === 'novelas') return 'VOL';
    return 'VOL';
}

function buildCatalogBackProgressHtml(categoria, total) {
    const prefix = getCatalogProgressPrefix(categoria);
    const safeTotal = Number(total) > 0 ? Number(total) : 0;
    return `
        <div class="card-back-progress-box" data-progress data-total="${safeTotal}" data-prefix="${prefix}" style="display:none">
            <div class="card-back-progress-top" data-progress-label>${prefix} 0/${safeTotal}</div>
            <div class="card-back-progress-row">
                <div class="card-back-progress-track">
                    <div class="card-progress-fill card-back-progress-fill" style="width:0%"></div>
                </div>
                <span class="card-back-progress-pct" data-progress-pct>0%</span>
            </div>
        </div>
        <div class="card-back-completion" data-completion-footer style="display:none">
            <span class="card-back-hud-line" aria-hidden="true"></span>
            <span class="card-back-completion-text" data-completion-text>0% VISTO</span>
            <span class="card-back-hud-line" aria-hidden="true"></span>
        </div>`;
}

function countAnimeEpisodesWatched(userId, animeId, totalEps) {
    if (!totalEps) return 0;
    let watched = 0;
    for (let ep = 1; ep <= totalEps; ep++) {
        let found = false;
        for (let i = 0; i < UserStore.length; i++) {
            const key = UserStore.key(i) || '';
            if (!key.startsWith(`u:${userId}|anime:${animeId}|s:`) || !UserStore.getItem(key)) continue;
            const m = key.match(/ep:(\d+)$/);
            if (m && Number(m[1]) === ep) {
                found = true;
                break;
            }
        }
        if (found) watched += 1;
    }
    return watched;
}

function resolveCatalogProgress(userId, category, itemId, card) {
    const box = card.querySelector('[data-progress]');
    const dataTotal = Number(box?.getAttribute('data-total') || 0);
    const prefix = box?.getAttribute('data-prefix') || getCatalogProgressPrefix(category);

    if (!dataTotal) {
        const legacyPct = getProgressPercentForItem(userId, category, itemId);
        if (legacyPct === null) return { show: false };
        return {
            show: true,
            pct: legacyPct,
            watched: 0,
            total: 0,
            prefix,
            completionText: `${legacyPct}% VISTO`
        };
    }

    const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
    let watched = 0;
    if (category === 'anime') {
        watched = countAnimeEpisodesWatched(userId, itemId, dataTotal);
    } else if (category === 'manga' || category === 'novelas') {
        for (let n = 1; n <= dataTotal; n++) {
            if (UserStore.getItem(`u:${userId}|manga:${itemId}|ch:${n}`) ||
                UserStore.getItem(`u:${userId}|manga:${itemId}|vol:${n}`)) {
                watched += 1;
            }
        }
    }

    const pct = viewed ? 100 : Math.min(100, Math.round((watched / dataTotal) * 100));
    if (viewed) watched = dataTotal;

    return {
        show: true,
        pct,
        watched,
        total: dataTotal,
        prefix,
        completionText: `${pct}% VISTO`
    };
}

window.toggleCardComplete = function (input, itemId) {
    const card = input?.closest('[data-item-id]');
    const viewedBtn = card?.querySelector('.viewed-btn');
    if (!viewedBtn) return;
    const isActive = viewedBtn.classList.contains('active');
    if (Boolean(input.checked) !== isActive) viewedBtn.click();
};

function buildCatalogCardHtml(options) {
    const {
        id,
        title,
        image = '',
        detailUrl = '#',
        status = '',
        showDetail = true,
        searchIndex = '',
        genres = '',
        genresNorm = '',
        imageExtraAttrs = '',
        categoria = 'manga',
        progressTotal = 0
    } = options;

    const flipId = `flip-${id}`;
    const safeId = escapeHtml(String(id));
    const detailBtn = showDetail
        ? `<a class="details-btn card-back-detail-btn" href="${escapeHtml(detailUrl)}" onclick="rememberCatalogPosition()">DETALLE</a>`
        : '';
    const statusHtml = status
        ? `<span class="card-back-status-badge">${escapeHtml(status)}</span>`
        : '';
    const genresAttr = genres ? ` data-genres="${escapeHtml(genres)}"` : '';
    const genresNormAttr = genresNorm ? ` data-genres-norm="${escapeHtml(genresNorm)}"` : '';

    return `
    <div class="card-container catalog-neon-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}" data-img="${escapeHtml(image)}" data-search-index="${escapeHtml(searchIndex)}"${genresAttr}${genresNormAttr}>
        <input class="flip-toggle" type="checkbox" id="${flipId}">
        <div class="catalog-card-shell">
            <div class="catalog-card-inner">
                <div class="catalog-card-media">
                    <div class="card-inner">
                        <div class="card-front">
                            <div class="catalog-card-poster">
                                <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy"${imageExtraAttrs}>
                            </div>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${escapeHtml(title)}</h2>
                            ${detailBtn}
                            ${statusHtml}
                            <label class="card-back-complete">
                                <input class="card-complete-input" type="checkbox" onchange="toggleCardComplete(this, '${safeId}')">
                                <span class="card-back-toggle-switch" aria-hidden="true"></span>
                                <span class="card-back-toggle-label">Completado</span>
                            </label>
                            <div class="card-back-actions">
                                <button class="action-btn fav-btn" type="button" aria-label="Favorito" onclick="toggleStatus(this, 'fav', '${safeId}')">❤</button>
                                <button class="action-btn viewed-btn" type="button" aria-label="Visto" onclick="toggleStatus(this, 'viewed', '${safeId}')">👁</button>
                            </div>
                            ${buildCatalogBackProgressHtml(categoria, progressTotal)}
                        </div>
                    </div>
                </div>
                <div class="catalog-card-bar">
                    <span class="catalog-card-title">${escapeHtml(title)}</span>
                    <label class="catalog-card-flip-btn" for="${flipId}" aria-label="Ver información de ${escapeHtml(title)}" title="Ver info">
                        ${CATALOG_FLIP_ICON_SVG}
                    </label>
                </div>
            </div>
        </div>
    </div>`;
}

// 3. Modificamos esta función para que reciba "page"
async function cargarCatalogoDesdeApi(categoria, mainContainer, page = 1) {
    const loaderLabel = categoria === 'anime'
        ? 'animes'
        : (categoria === 'novelas' ? 'novelas' : 'mangas');
    const getTopItems = categoria === 'anime'
        ? window.getTopAnimes
        : (categoria === 'novelas' ? window.getTopNovelas : window.getTopMangas);

    if (typeof getTopItems !== 'function') return false;

    mainContainer.innerHTML = `
        <section class="empty-state empty-state-inline">
            <span class="empty-state-kicker">Cargando Página ${page}</span>
            <h2>Buscando los 40 ${escapeHtml(loaderLabel)} principales...</h2>
        </section>
    `;

    try {
        // AQUÍ le pasamos el número de página a tu api.js
        const listaItems = await getTopItems(page);
        const items = Array.isArray(listaItems) ? listaItems.slice(0, 40) : [];

        if (!items.length) {
            const fallbackItems = Array.isArray(window.DATOS_WEB?.[categoria])
                ? window.DATOS_WEB[categoria].slice(0, 40)
                : [];

            if (fallbackItems.length) {
                return renderCatalogCardsFromLocalData(categoria, mainContainer, fallbackItems);
            }
        }

        window.__catalogSearchItems = items.map((item) => ({
            item: {
                id: item.mal_id,
                titulo: item.title,
                info: getApiCatalogInfo(categoria, item)
            },
            searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
        }));

        if (!items.length) {
            mainContainer.innerHTML = `
                <section class="empty-state">
                    <span class="empty-state-kicker">Sin resultados</span>
                    <h2>La API no devolvio ${escapeHtml(loaderLabel)} para esta pagina.</h2>
                    <p>Proba con otra pagina o usa el buscador.</p>
                </section>
            `;
            return false;
        }

        mainContainer.innerHTML = items.map((item) => {
            const id = item.mal_id;
            const title = item.title || 'Sin título';
            const image = getApiPoster(item);
            const info = getApiCatalogInfo(categoria, item);
            const genres = getApiGenresList(item);
            const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
            const detailCat = categoria === 'novelas' ? 'novelas' : categoria;
            const detailUrl = `detalle.html?cat=${encodeURIComponent(detailCat)}&id=${encodeURIComponent(id)}`;
            const searchIndex = [title, item.title_english, info, item.synopsis, item.type, ...genres].filter(Boolean).join(' ').toLowerCase();

            return buildCatalogCardHtml({
                id,
                title,
                image,
                detailUrl,
                status: item.status || 'En emisión',
                searchIndex,
                genres: genres.join('|'),
                genresNorm,
                categoria: detailCat,
                progressTotal: categoria === 'anime' ? (item.episodes || 0) : (item.volumes || item.chapters || 0),
                imageExtraAttrs: ` data-title="${escapeHtml(title)}" onerror="fallbackCatalogImage(this)"`
            });
        }).join('');

        cargarEstadosBotones();
        inicializarBusquedaCatalogo();
        inicializarGeneroWidgets();
        return true;
    } catch (error) {
        console.warn('Error cargando API:', error);
        mainContainer.innerHTML = `
            <section class="empty-state">
                <span class="empty-state-kicker">API no disponible</span>
                <h2>No se pudo cargar el catalogo de ${escapeHtml(loaderLabel)}.</h2>
                <p>Revisa tu conexion y recarga la pagina.</p>
            </section>
        `;
        return false;
    }
}

function renderCatalogCardsFromLocalData(categoria, mainContainer, items) {
    const list = items.map((item) => {
        const id = item.id || item.item_id || item.mal_id || item.itemId || 0;
        const title = item.titulo || item.title || item.name || 'Sin título';
        const image = item.img || item.image || item.cover_image || '';
        const genres = String(item.info || item.synopsis || '').split('/').map((genre) => genre.trim()).filter(Boolean);
        const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
        const detailUrl = `detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(id)}`;
        const searchIndex = [title, item.title_english, item.info, item.synopsis, ...genres]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return buildCatalogCardHtml({
            id,
            title,
            image,
            detailUrl,
            status: item.status || '',
            searchIndex,
            genres: genres.join('|'),
            genresNorm,
            categoria,
            progressTotal: Number(item.volumes || item.chapters || item.episodes || 0),
            imageExtraAttrs: ` data-title="${escapeHtml(title)}" onerror="fallbackCatalogImage(this)"`
        });
    });

    mainContainer.innerHTML = list.join('');
    window.__catalogSearchItems = items.map((item) => ({
        item,
        searchIndex: buildSearchIndexForItem(categoria, item)
    }));

    cargarEstadosBotones();
    inicializarBusquedaCatalogo();
    inicializarGeneroWidgets();
    return true;
}

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

function inicializarGeneroWidgets() {
    const categoria = document.body.getAttribute('data-page');
    const sidebarHost = document.getElementById('genreSidebar');
    const drawerTab = document.getElementById('genreDrawerTab');
    const mainContainer = document.getElementById('main-container');
    if (!categoria || !mainContainer) return;
    if (!sidebarHost) return;

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    const counts = new Map();

    const cardGenreRows = [...mainContainer.querySelectorAll('.card-container[data-genres]')]
        .map((card) => String(card.getAttribute('data-genres') || '').split('|').map((genre) => genre.trim()).filter(Boolean))
        .filter((genres) => genres.length);

    const localList = (() => {
        if (cardGenreRows.length) return [];
        if (typeof obtenerItemsCategoria === 'function') return obtenerItemsCategoria(categoria);
        if (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB[categoria])) return DATOS_WEB[categoria];
        return [];
    })();

    const rows = cardGenreRows.length
        ? cardGenreRows
        : localList.map((item) => (typeof separarGeneros === 'function')
            ? separarGeneros(item?.info)
            : String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean));

    rows.forEach((genres) => {
        genres.forEach((g) => {
            const key = normalize(g);
            if (!key) return;
            counts.set(key, { label: g, count: (counts.get(key)?.count || 0) + 1 });
        });
    });

    const sorted = [...counts.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

    const max = sorted.length ? sorted[0].count : 1;
    const top = sorted.slice(0, 6);

    const filterGenres = sorted.slice(0, 18);

    const selectedKey = `ui:selectedGenres:${categoria}`;
    const selectedGenres = (() => {
        try {
            const raw = UserStore.getItem(selectedKey) || '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return [];
        }
    })();

    window.__selectedGenres = selectedGenres;

    function renderSidebar(host) {
        const openKey = `ui:genreDrawerOpen:${categoria}`;
        const isOpen = UserStore.getItem(openKey) === '1';
        const topHtml = top.length
            ? `
                <div class="genre-stats">
                    <div class="top-genres-title">Popularidad</div>
                    ${top.map((g) => {
                        const pct = Math.max(6, Math.round((g.count / max) * 100));
                        return `
                            <div class="genre-bar" role="listitem" aria-label="${g.label}">
                                <div class="genre-bar-label">${g.label}</div>
                                <div class="genre-bar-track" aria-hidden="true">
                                    <div class="genre-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <div class="genre-bar-count">${g.count}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `
            : '';

        host.innerHTML = `
            <div class="genre-sidebar-head">
                <div>
                    <div class="genre-sidebar-title">Géneros</div>
                    <div class="genre-sidebar-help">Elegí 1 o más géneros.</div>
                </div>
                <button class="genre-collapse-btn" type="button" id="toggleGenreSidebar" aria-expanded="${isOpen ? 'true' : 'false'}">
                    ${isOpen ? 'Cerrar' : 'Abrir'}
                </button>
            </div>
            ${topHtml}
            <div class="genre-filters">
                <button class="genre-chip${selectedGenres.length ? '' : ' is-active'}" type="button" data-genre="" aria-pressed="${selectedGenres.length ? 'false' : 'true'}">Todos</button>
                ${filterGenres.map((g) => {
                    const isActive = selectedGenres.includes(g.key);
                    const active = isActive ? ' is-active' : '';
                    return `<button class="genre-chip${active}" type="button" data-genre="${g.key}" aria-pressed="${isActive ? 'true' : 'false'}">${g.label}</button>`;
                }).join('')}
            </div>
            <div class="genre-actions">
                <button class="genre-clear-btn" type="button" id="clearGenres">Limpiar</button>
            </div>
        `;

        host.classList.toggle('is-open', isOpen);
        if (drawerTab) drawerTab.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        const toggleBtn = host.querySelector('#toggleGenreSidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const nextOpen = !host.classList.contains('is-open');
                host.classList.toggle('is-open', nextOpen);
                UserStore.setItem(openKey, nextOpen ? '1' : '0');
                toggleBtn.textContent = nextOpen ? 'Cerrar' : 'Abrir';
                toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                if (drawerTab) drawerTab.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            });
        }

        if (drawerTab) {
            drawerTab.addEventListener('click', () => {
                const nextOpen = !host.classList.contains('is-open');
                host.classList.toggle('is-open', nextOpen);
                UserStore.setItem(openKey, nextOpen ? '1' : '0');
                if (toggleBtn) {
                    toggleBtn.textContent = nextOpen ? 'Cerrar' : 'Abrir';
                    toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                }
                drawerTab.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            });
        }

        host.addEventListener('click', (e) => {
            const clearBtn = e.target instanceof HTMLElement ? e.target.closest('button.genre-clear-btn') : null;
            if (clearBtn) {
                window.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                return;
            }

            const btn = e.target instanceof HTMLElement ? e.target.closest('button.genre-chip') : null;
            if (!btn) return;
            const genreKey = String(btn.getAttribute('data-genre') || '');

            if (!genreKey) {
                window.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                return;
            }

            const next = new Set(Array.isArray(window.__selectedGenres) ? window.__selectedGenres : []);
            if (next.has(genreKey)) next.delete(genreKey);
            else next.add(genreKey);

            const arr = [...next];
            window.__selectedGenres = arr;
            UserStore.setItem(selectedKey, JSON.stringify(arr));

            host.querySelectorAll('button.genre-chip').forEach((b) => {
                const k = String(b.getAttribute('data-genre') || '');
                if (!k) {
                    const activeTodos = arr.length === 0;
                    b.classList.toggle('is-active', activeTodos);
                    b.setAttribute('aria-pressed', activeTodos ? 'true' : 'false');
                    return;
                }
                const active = next.has(k);
                b.classList.toggle('is-active', active);
                b.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
        }, { passive: true });
    }

    renderSidebar(sidebarHost);
}

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

