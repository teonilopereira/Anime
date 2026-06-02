const LIST_FILTERS = Object.freeze({
    ALL: 'all',
    FAV: 'fav',
    VIEWED: 'viewed'
});

const CATEGORY_LABELS = Object.freeze({
    anime: 'Anime',
    manga: 'Manga',
    juegos: 'Juegos',
    novelas: 'Novelas'
});

function getCurrentUserIdSafe() {
    if (typeof getCurrentUserId === 'function') return getCurrentUserId();
    return localStorage.getItem('currentUser') || 'Invitado';
}

function getAuthTokenSafe() {
    if (typeof getAuthToken === 'function') return getAuthToken();
    return localStorage.getItem('authToken') || '';
}

function statusStorageKeySafe(userId, itemId, type) {
    if (typeof statusStorageKey === 'function') return statusStorageKey(userId, itemId, type);
    return `u:${userId}|item:${itemId}|${type}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function normalizeTextSafe(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
}

function getAllItems() {
    const all = [];
    const byId = new Set();
    if (window.DATOS_WEB && typeof window.DATOS_WEB === 'object') {
        Object.entries(window.DATOS_WEB).forEach(([category, list]) => {
            if (!Array.isArray(list)) return;
            list.forEach((item) => {
                const normalized = { ...item, __category: category };
                all.push(normalized);
                byId.add(String(normalized.id));
            });
        });
    }

    const userId = getCurrentUserIdSafe();
    if (userId !== 'Invitado') {
        Object.keys(localStorage).forEach((key) => {
            if (!key.startsWith(`u:${userId}|itemMeta:`) || !localStorage.getItem(key)) return;
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (!item?.id || byId.has(String(item.id))) return;
                all.push({
                    ...item,
                    __category: item.__category || item.categoria || 'anime'
                });
                byId.add(String(item.id));
            } catch {
                // Ignorar fichas viejas corruptas.
            }
        });
    }

    return all;
}

function getItemLink(item) {
    const category = item.__category || item.categoria || '';
    if (!category || !item.id) return '#';
    return `detalle.html?cat=${encodeURIComponent(category)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(item.titulo || '')}`;
}

function getItemGenres(item) {
    return normalizeTextSafe(item.info)
        .split(/[\/|]/)
        .map((genre) => genre.trim())
        .filter(Boolean);
}

function getUserItemState(userId, item) {
    const fav = !!localStorage.getItem(statusStorageKeySafe(userId, item.id, 'fav'));
    const viewed = !!localStorage.getItem(statusStorageKeySafe(userId, item.id, 'viewed'));
    return { item, fav, viewed };
}

function matchesFilter(entry, filterMode) {
    if (filterMode === LIST_FILTERS.FAV) return entry.fav;
    if (filterMode === LIST_FILTERS.VIEWED) return entry.viewed;
    return entry.fav || entry.viewed;
}

function renderMediaCard({ item, fav = false, viewed = false, match = null, isRow = false, index = 1 }) {
    const link = getItemLink(item);
    const category = CATEGORY_LABELS[item.__category] || item.__category || 'Lista';
    const badges = [
        fav ? '<span style="color:#bc13fe;">❤ Me gusta</span>' : '',
        viewed ? '<span style="color:#00f2ff;">👁 Visto</span>' : '',
        match ? `<span style="color:#00f2ff;">${escapeHtml(match)} match</span>` : ''
    ].filter(Boolean).join(' ');
    
    // Obtenemos los capítulos leídos de local storage para mostrar en la card de lista
    const userId = getCurrentUserIdSafe();
    let currentEp = 0;
    if (item.__category === 'manga' || item.__category === 'novelas') {
        currentEp = localStorage.getItem(`u:${userId}|manga:${item.id}|ch:1`) || 0; // fallback básico si no hay progress.js completo
    } else {
        currentEp = localStorage.getItem(`u:${userId}|anime:${item.id}|s:1|ep:1`) || 0; // fallback
    }

    if (isRow) {
        const catIcons = { anime: '📺', manga: '📖', novelas: '📝', juegos: '🎮' };
        const icon = catIcons[item.__category] || '';
        return `
            <article class="list-row-card">
                <div class="row-rank">${index}</div>
                <a href="${escapeHtml(link)}">
                    <img class="row-cover" src="${escapeHtml(item.img)}" alt="${escapeHtml(item.titulo)}" loading="lazy" onerror="fallbackCatalogImage(this)">
                </a>
                <div class="row-info">
                    <div class="row-title">${escapeHtml(item.titulo)}</div>
                    <div class="row-desc">${icon} ${escapeHtml(category)} • ${escapeHtml(item.info || '')}</div>
                </div>
                <div class="row-status">
                    ${badges}
                </div>
                <div class="row-eps">
                    <div>${item.episodes || item.chapters || item.volumes || '?'}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">eps</div>
                </div>
            </article>
        `;
    }

    // Para recomendaciones: Card vertical estilo manga.html pero adaptada
    const safeId = escapeHtml(String(item.id));
    const title = escapeHtml(item.titulo);
    return `
    <div class="card-container catalog-neon-card" style="transform: scale(0.9); margin: -10px;" data-item-id="${safeId}" data-category="${escapeHtml(item.__category)}">
        <input class="flip-toggle" type="checkbox" id="flip-${safeId}">
        <div class="catalog-card-shell">
            <div class="catalog-card-inner">
                <div class="catalog-card-media">
                    <div class="card-inner">
                        <div class="card-front">
                            <div class="catalog-card-poster">
                                <img src="${escapeHtml(item.img)}" alt="${title}" loading="lazy" onerror="fallbackCatalogImage(this)">
                            </div>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${title}</h2>
                            <span style="color:#00f2ff;font-weight:bold;margin-bottom:10px;display:block;">${match || ''}</span>
                            <a class="details-btn card-back-detail-btn" href="${escapeHtml(link)}">DETALLE</a>
                        </div>
                    </div>
                </div>
                <div class="catalog-card-bar">
                    <span class="catalog-card-title">${title}</span>
                    <label class="catalog-card-flip-btn" for="flip-${safeId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7M16 3h5v5M10 14L21 3"/></svg>
                    </label>
                </div>
            </div>
        </div>
    </div>
    `;
}

function renderEmpty(host, title, text) {
    host.innerHTML = `
        <div class="lists-empty">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(text)}</p>
        </div>
    `;
}

let currentCatFilter = 'all';

function render(filterMode) {
    const grid = document.getElementById('listsGrid');
    if (!grid) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        renderEmpty(grid, 'Inicia sesion', 'Usa el boton Cuenta para entrar o crear un usuario y ver tus listas.');
        return;
    }

    const items = getAllItems()
        .map((item) => getUserItemState(userId, item))
        .filter((entry) => matchesFilter(entry, filterMode))
        .filter((entry) => currentCatFilter === 'all' || entry.item.__category === currentCatFilter);

    if (!items.length) {
        renderEmpty(grid, 'Sin resultados', 'No tenes items marcados con este filtro.');
        return;
    }

    grid.innerHTML = items.map((entry, idx) => renderMediaCard({ ...entry, isRow: true, index: idx + 1 })).join('');
}

function setActiveChip(activeId) {
    document.querySelectorAll('.lists-chip').forEach((chip) => {
        chip.classList.toggle('is-active', chip.id === activeId);
    });
}

function downloadJson(filename, obj) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function exportUserData() {
    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') return;

    const data = {
        user: userId,
        exportedAt: new Date().toISOString(),
        lists: { fav: [], viewed: [] },
        progress: { manga: [], anime: [] }
    };

    Object.keys(localStorage).forEach((key) => {
        if (!key.startsWith(`u:${userId}|`) || !localStorage.getItem(key)) return;

        const stateMatch = key.match(/^u:([^|]+)\|item:([^|]+)\|(fav|viewed)$/);
        if (stateMatch) {
            data.lists[stateMatch[3]].push(stateMatch[2]);
            return;
        }

        const mangaMatch = key.match(/^u:([^|]+)\|manga:([^|]+)\|(?:vol|ch):(\d+)$/);
        if (mangaMatch) {
            data.progress.manga.push({ id: mangaMatch[2], progress: Number(mangaMatch[3]) });
            return;
        }

        const animeMatch = key.match(/^u:([^|]+)\|anime:([^|]+)\|s:(\d+)\|ep:(\d+)$/);
        if (animeMatch) {
            data.progress.anime.push({ id: animeMatch[2], s: Number(animeMatch[3]), ep: Number(animeMatch[4]) });
            return;
        }
    });

    downloadJson(`anime_destiny_${userId}_backup.json`, data);
}

function renderAchievements() {
    const host = document.getElementById('achievementsGrid');
    if (!host) return;

    const userId = getCurrentUserIdSafe();
    const lists = { fav: 0, viewed: 0, eps: 0 };
    if (userId !== 'Invitado') {
        Object.keys(localStorage).forEach((key) => {
            if (!key.startsWith(`u:${userId}|`) || !localStorage.getItem(key)) return;
            if (key.endsWith('|fav')) lists.fav++;
            if (key.endsWith('|viewed')) lists.viewed++;
            if (key.includes('|ep:') || key.includes('|ch:') || key.includes('|vol:')) lists.eps++;
        });
    }

    const rules = [
        { id: 'fav1', title: 'Corazon de Otaku', desc: 'Marca 1 titulo como "Me gusta"', req: lists.fav >= 1, icon: '❤' },
        { id: 'fav10', title: 'Coleccionista', desc: 'Marca 10 titulos como "Me gusta"', req: lists.fav >= 10, icon: '🌟' },
        { id: 'view1', title: 'Primer Vistazo', desc: 'Marca 1 titulo como "Visto"', req: lists.viewed >= 1, icon: '👁' },
        { id: 'view50', title: 'Devorador de Mundos', desc: 'Marca 50 titulos como "Visto"', req: lists.viewed >= 50, icon: '🔥' },
        { id: 'ep1', title: 'Un Pasito', desc: 'Marca tu primer capitulo o episodio', req: lists.eps >= 1, icon: '🎬' },
        { id: 'ep100', title: 'Maratonista', desc: 'Marca 100 capitulos o episodios', req: lists.eps >= 100, icon: '🏃' }
    ];

    host.innerHTML = rules.map((r) => `
        <div class="achievement-card ${r.req ? 'is-unlocked' : 'is-locked'}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="achievement-icon" aria-hidden="true">${r.icon}</span>
                <span class="achievement-state">${r.req ? 'Desbloqueado' : 'Bloqueado'}</span>
            </div>
            <div>
                <div class="achievement-title">${escapeHtml(r.title)}</div>
                <div class="achievement-desc">${escapeHtml(r.desc)}</div>
            </div>
        </div>
    `).join('');
}

function renderPoints() {
    const host = document.getElementById('pointsBar');
    if (!host) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        host.innerHTML = '';
        return;
    }

    const pts = (typeof getUserPoints === 'function')
        ? getUserPoints(userId)
        : Number(localStorage.getItem(`u:${userId}|points`) || '0');
    const level = (typeof levelFromPoints === 'function')
        ? levelFromPoints(pts)
        : { level: 1, current: 0, next: 100 };
    const pct = Math.max(0, Math.min(100, Math.round((level.current / level.next) * 100)));

    host.innerHTML = `
        <div class="points-card">
            <div class="points-top">
                <div class="points-title">Nivel ${level.level}</div>
                <div class="points-value">${pts} pts</div>
            </div>
            <div class="points-track" aria-hidden="true"><div class="points-fill" style="width:${pct}%"></div></div>
            <div class="points-sub">Faltan ${Math.max(0, level.next - level.current)} pts para el proximo nivel.</div>
        </div>
    `;
}

function renderProfileSummary() {
    const host = document.getElementById('listsProfile');
    if (!host) return;

    const userId = getCurrentUserIdSafe();
    const label = userId === 'Invitado' ? 'Invitado' : userId;
    const initials = String(label || 'IN').trim().slice(0, 2).toUpperCase();
    const pts = userId === 'Invitado' ? 0 : ((typeof getUserPoints === 'function') ? getUserPoints(userId) : Number(localStorage.getItem(`u:${userId}|points`) || '0'));
    const level = (typeof levelFromPoints === 'function') ? levelFromPoints(pts) : { level: 1, current: 0, next: 100 };
    const pct = Math.max(0, Math.min(100, Math.round((level.current / level.next) * 100)));

    host.innerHTML = `
        <div class="lists-profile-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div class="lists-profile-main">
            <span class="lists-profile-label">Perfil</span>
            <strong class="lists-profile-name">${escapeHtml(label)}</strong>
            <div class="lists-profile-track" aria-label="Progreso de nivel">
                <div class="lists-profile-fill" style="width:${pct}%"></div>
            </div>
            <span class="lists-profile-meta">Nivel ${level.level} · ${pts} pts</span>
        </div>
        <div class="lists-profile-actions">
            <a class="lists-profile-btn" href="usuario.html">Editar perfil</a>
            <a class="lists-profile-btn secondary" href="configuracion.html">Configuracion</a>
        </div>
    `;
}

let filterModeState = LIST_FILTERS.ALL;

function bindControls() {
    const actions = [
        ['filterAll', LIST_FILTERS.ALL],
        ['filterFav', LIST_FILTERS.FAV],
        ['filterViewed', LIST_FILTERS.VIEWED]
    ];

    actions.forEach(([id, mode]) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('click', () => {
            filterModeState = mode;
            setActiveChip(id);
            render(filterModeState);
        });
    });

    const exportBtn = document.getElementById('exportJson');
    if (exportBtn) exportBtn.addEventListener('click', exportUserData);

    return () => render(filterModeState);
}

function renderActividad() {
    const grid = document.getElementById('actividadGrid');
    if (!grid) return;
    
    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        grid.innerHTML = '<div class="lists-empty"><h3>Inicia sesion</h3><p>Para registrar y ver actividad.</p></div>';
        return;
    }

    const allItems = getAllItems();
    let actividadItems = [];
    
    // Buscar items con vistos o fav, o que tengan capítulos guardados
    allItems.forEach(item => {
        const fav = !!localStorage.getItem(`u:${userId}|item:${item.id}|fav`);
        const viewed = !!localStorage.getItem(`u:${userId}|item:${item.id}|viewed`);
        
        let hasProgress = false;
        let lastChapter = 0;
        
        Object.keys(localStorage).forEach((key) => {
            if (!key.startsWith(`u:${userId}|`)) return;
            if (key.includes(`|anime:${item.id}|ep:`)) { hasProgress = true; lastChapter = key.split('|ep:')[1]; }
            if (key.includes(`|manga:${item.id}|ch:`)) { hasProgress = true; lastChapter = key.split('|ch:')[1]; }
            if (key.includes(`|novelas:${item.id}|ch:`)) { hasProgress = true; lastChapter = key.split('|ch:')[1]; }
        });

        if (fav || viewed || hasProgress) {
            actividadItems.push({
                ...item,
                fav, viewed, hasProgress, lastChapter
            });
        }
    });

    actividadItems = actividadItems.reverse().slice(0, 15);
    
    if (actividadItems.length === 0) {
        grid.innerHTML = '<div class="lists-empty"><h3>Sin actividad</h3><p>No hay actividad reciente.</p></div>';
        return;
    }
    
    grid.innerHTML = actividadItems.map((entry, idx) => {
        const title = escapeHtml(entry.titulo);
        const img = escapeHtml(entry.img);
        const cat = CATEGORY_LABELS[entry.__category] || entry.__category;
        const badges = [
            entry.fav ? '<span style="color:#bc13fe;">❤ Me gusta</span>' : '',
            entry.viewed ? '<span style="color:#00f2ff;">👁 Visto</span>' : ''
        ].filter(Boolean).join(' ');
        
        const prog = entry.hasProgress ? `<div style="color:#00f2ff; font-weight:bold; font-size: 0.85rem; margin-top:4px;">Último marcado: ${entry.lastChapter}</div>` : '';

        return `
            <article class="list-row-card">
                <div class="row-rank">${idx + 1}</div>
                <img class="row-cover" src="${img}" alt="${title}" loading="lazy" onerror="fallbackCatalogImage(this)">
                <div class="row-info">
                    <div class="row-title">${title}</div>
                    <div class="row-desc">${cat} • ${escapeHtml(entry.info || '')}</div>
                    ${prog}
                </div>
                <div class="row-status">
                    ${badges}
                </div>
                <div class="row-eps">
                    <div>${entry.episodes || entry.chapters || entry.volumes || '?'}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">eps</div>
                </div>
            </article>
        `;
    }).join('');
}

function updateCategoryCards() {
    const user = getCurrentUserIdSafe();
    if (user === 'Invitado') return;

    const catCounts = { anime: 0, manga: 0, novelas: 0, juegos: 0 };
    const catFav    = { anime: 0, manga: 0, novelas: 0, juegos: 0 };
    const catViewed = { anime: 0, manga: 0, novelas: 0, juegos: 0 };

    getAllItems().forEach(item => {
        const cat = item.__category;
        const fav = !!localStorage.getItem(`u:${user}|item:${item.id}|fav`);
        const viewed = !!localStorage.getItem(`u:${user}|item:${item.id}|viewed`);
        if (fav || viewed) {
            catCounts[cat] = (catCounts[cat] || 0) + 1;
            if (fav)    catFav[cat]    = (catFav[cat] || 0) + 1;
            if (viewed) catViewed[cat] = (catViewed[cat] || 0) + 1;
        }
    });

    const setE = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setE('countAnime', catCounts.anime || 0);
    setE('countManga', catCounts.manga || 0);
    setE('countNovelas', catCounts.novelas || 0);
    setE('sublabelAnime', `${catFav.anime || 0} ❤ · ${catViewed.anime || 0} 👁`);
    setE('sublabelManga', `${catFav.manga || 0} ❤ · ${catViewed.manga || 0} 👁`);
    setE('sublabelNovelas', `${catFav.novelas || 0} ❤ · ${catViewed.novelas || 0} 👁`);
}

function updateActividadMini() {
    const user = getCurrentUserIdSafe();
    const host = document.getElementById('actividadMini');
    if (!host || user === 'Invitado') return;

    const items = [];
    getAllItems().forEach(item => {
        const fav = !!localStorage.getItem(`u:${user}|item:${item.id}|fav`);
        const viewed = !!localStorage.getItem(`u:${user}|item:${item.id}|viewed`);
        if (fav || viewed) items.push({ ...item, fav, viewed });
    });

    const recent = items.reverse().slice(0, 5);
    if (!recent.length) return;

    const catIcons = { anime: '📺', manga: '📖', novelas: '📝', juegos: '🎮' };
    host.innerHTML = recent.map(item => `
        <div class="cat-activity-item">
            <span class="ai-icon">${catIcons[item.__category] || '⭐'}</span>
            <span class="ai-title">${String(item.titulo || '').substring(0, 35)}</span>
            <span>${item.fav ? '❤' : ''} ${item.viewed ? '👁' : ''}</span>
        </div>
    `).join('');
}

function renderStats() {
    const host = document.getElementById('statsGrid');
    if (!host) return;
    const user = getCurrentUserIdSafe();
    if (user === 'Invitado') {
        host.innerHTML = '<div class="lists-empty" style="grid-column:1/-1"><h3>Sin datos</h3><p>Iniciá sesión para ver estadísticas.</p></div>';
        return;
    }
    let totalFav = 0, totalViewed = 0, byCategory = {};
    getAllItems().forEach(item => {
        const cat = item.__category;
        if (!byCategory[cat]) byCategory[cat] = { fav: 0, viewed: 0 };
        if (localStorage.getItem(`u:${user}|item:${item.id}|fav`))    { byCategory[cat].fav++; totalFav++; }
        if (localStorage.getItem(`u:${user}|item:${item.id}|viewed`)) { byCategory[cat].viewed++; totalViewed++; }
    });
    
    const pts = Number(localStorage.getItem(`u:${user}|points`) || 0);
    const sessions = Number(localStorage.getItem(`u:${user}|sessions`) || 0);

    const statItems = [
        { label: 'Total Me gusta', value: totalFav, icon: '❤', color: '#bc13fe' },
        { label: 'Total Vistos', value: totalViewed, icon: '👁', color: '#00f2ff' },
        { label: 'Puntos acumulados', value: pts, icon: '⭐', color: '#f59e0b' },
        { label: 'Sesiones', value: sessions, icon: '🔄', color: '#22c55e' },
        ...Object.entries(byCategory).map(([cat, c]) => ({
            label: `${cat.charAt(0).toUpperCase() + cat.slice(1)} guardados`,
            value: c.fav + c.viewed,
            icon: { anime: '📺', manga: '📖', novelas: '📝', juegos: '🎮' }[cat] || '📋',
            color: '#bc13fe'
        }))
    ];

    host.innerHTML = statItems.map(s => `
        <div style="background:rgba(10,5,25,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;">
            <div style="font-size:1.6rem;">${s.icon}</div>
            <div>
                <div style="font-family:'Orbitron',sans-serif;font-size:1.4rem;color:${s.color};font-weight:700;">${s.value}</div>
                <div style="font-size:0.78rem;color:rgba(255,255,255,0.45);font-family:'Rajdhani',sans-serif;">${s.label}</div>
            </div>
        </div>
    `).join('');
}

// Para que las recomendaciones no tiren error, agregamos una version fake simple o importamos algo si existiera
function renderRecommendations() {
    const grid = document.getElementById('recommendGrid');
    if (!grid) return;
    const allItems = getAllItems();
    if(allItems.length > 5) {
        // tomar aleatorios
        grid.innerHTML = allItems.slice(0, 5).map(item => renderMediaCard({ item, match: '95%' })).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const renderCurrentFilter = bindControls();

    function renderAll() {
        renderProfileSummary();
        renderPoints();
        renderAchievements();
        renderCurrentFilter();
        renderRecommendations();
        renderActividad();
        updateCategoryCards();
        updateActividadMini();
        renderStats();
    }

    if (window.DATOS_WEB && Object.keys(window.DATOS_WEB).some((key) => Array.isArray(window.DATOS_WEB[key]) && window.DATOS_WEB[key].length)) {
        renderAll();
    } else {
        document.addEventListener('datosCargados', renderAll, { once: true });
        setTimeout(renderAll, 2000);
    }

    // Sidebar tab logic
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const tabId = link.getAttribute('data-tab');
            if(tabId) {
                document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                const activeTab = document.getElementById('tab-' + tabId);
                if(activeTab) activeTab.classList.add('active');
            }
        });
    });

    // Resultados tabs logic
    document.querySelectorAll('.res-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.res-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCatFilter = tab.dataset.cat || 'all';
            render(filterModeState);
        });
    });
});
