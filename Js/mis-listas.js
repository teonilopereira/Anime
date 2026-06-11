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

// Sesión local: se setea desde getSession() directamente para evitar
// problemas de timing con _currentUser interno de supabase-config.js
let _sessionUser = null;


function getCurrentUserIdSafe() {
    if (typeof getCurrentUserId === 'function') return getCurrentUserId();
    // Usar _sessionUser o getCurrentUserSync (síncrono) para no recibir una Promise
    const user = _sessionUser
              || window.AppSupabase?.getCurrentUserSync?.()
              || null;
    if (!user) return 'Invitado';
    return (
        user.user_metadata?.username ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        (user.email ? user.email.split('@')[0] : '') ||
        user.id ||
        'Invitado'
    );
}

function getAuthTokenSafe() {
    if (typeof getAuthToken === 'function') return getAuthToken();
    // Obtener el token directamente desde el cliente de Supabase, no desde UserStore
    return window.AppSupabase?.client?.auth?.session?.()?.access_token
        || window.AppSupabase?.getCurrentSession?.()?.access_token
        || '';
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
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(`u:${userId}|itemMeta:`) || !UserStore.getItem(key)) return;
            try {
                const item = JSON.parse(UserStore.getItem(key));
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
    const fav = !!UserStore.getItem(statusStorageKeySafe(userId, item.id, 'fav'));
    const viewed = !!UserStore.getItem(statusStorageKeySafe(userId, item.id, 'viewed'));
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
    
    // Obtenemos los capítulos leídos de UserStore para mostrar en la card de lista
    const userId = getCurrentUserIdSafe();
    let currentEp = 0;
    if (item.__category === 'manga' || item.__category === 'novelas') {
        // Manga/novelas usan volumeStorageKey: u:userId|manga:id|vol:N
        currentEp = UserStore.getItem(`u:${userId}|manga:${item.id}|vol:1`) || 0;
    } else {
        // Anime usa episodeStorageKey: u:userId|anime:id|s:0|ep:N
        currentEp = UserStore.getItem(`u:${userId}|anime:${item.id}|s:0|ep:1`) || 0;
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

    UserStore.keys().forEach((key) => {
        if (!key.startsWith(`u:${userId}|`) || !UserStore.getItem(key)) return;

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
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(`u:${userId}|`) || !UserStore.getItem(key)) return;
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
        : Number(UserStore.getItem(`u:${userId}|points`) || '0');
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

    // ── Invitado: mostrar botón de login prominente ──
    if (userId === 'Invitado') {
        host.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px 12px;text-align:center;">
                <div style="width:64px;height:64px;border-radius:50%;border:2px solid rgba(168,85,247,0.5);display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#1c1032,#7c3aed);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(192,132,252,0.8)" stroke-width="1.5" style="width:32px;height:32px;">
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                </div>
                <div>
                    <p style="color:rgba(255,255,255,0.5);font-size:0.8rem;font-family:'Rajdhani',sans-serif;margin:0 0 4px;">No has iniciado sesión</p>
                    <p style="color:rgba(255,255,255,0.35);font-size:0.72rem;margin:0;">Iniciá sesión para guardar tus listas</p>
                </div>
                <a href="Login.html" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border:1.5px solid rgba(168,85,247,0.7);border-radius:999px;background:linear-gradient(135deg,rgba(91,33,182,0.4),rgba(168,85,247,0.2));color:#e2d9f3;font-family:'Rajdhani',sans-serif;font-size:0.9rem;font-weight:700;text-decoration:none;letter-spacing:0.04em;transition:all 0.2s;box-shadow:0 0 14px rgba(168,85,247,0.25);"
                   onmouseover="this.style.background='linear-gradient(135deg,rgba(124,58,237,0.6),rgba(168,85,247,0.4))';this.style.color='#fff';"
                   onmouseout="this.style.background='linear-gradient(135deg,rgba(91,33,182,0.4),rgba(168,85,247,0.2))';this.style.color='#e2d9f3';">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    Ingresar
                </a>
            </div>
        `;
        return;
    }

    // ── Usuario logueado: mostrar avatar y stats ──
    const user = _sessionUser;
    const photoUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
    const displayName = user?.user_metadata?.username
        || user?.user_metadata?.name
        || user?.user_metadata?.full_name
        || (user?.email ? user.email.split('@')[0] : userId);
    const initials = String(displayName || 'US').trim().slice(0, 2).toUpperCase();

    const pts = (typeof getUserPoints === 'function') ? getUserPoints(userId) : Number(UserStore.getItem(`u:${userId}|points`) || '0');
    const level = (typeof levelFromPoints === 'function') ? levelFromPoints(pts) : { level: 1, current: 0, next: 100 };
    const pct = Math.max(0, Math.min(100, Math.round((level.current / level.next) * 100)));

    const avatarHtml = photoUrl
        ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}"
               style="width:64px;height:64px;border-radius:50%;border:2px solid rgba(192,132,252,0.7);object-fit:cover;display:block;"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="lists-profile-avatar" style="display:none;" aria-hidden="true">${escapeHtml(initials)}</div>`
        : `<div class="lists-profile-avatar" aria-hidden="true">${escapeHtml(initials)}</div>`;

    host.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-bottom:8px;">
            ${avatarHtml}
        </div>
        <div class="lists-profile-main">
            <span class="lists-profile-label">Perfil</span>
            <strong class="lists-profile-name">${escapeHtml(displayName)}</strong>
            <div class="lists-profile-track" aria-label="Progreso de nivel">
                <div class="lists-profile-fill" style="width:${pct}%"></div>
            </div>
            <span class="lists-profile-meta">Nivel ${level.level} · ${pts} pts</span>
        </div>
        <div class="lists-profile-actions">
            <a class="lists-profile-btn" href="usuario.html">Editar perfil</a>
            <a class="lists-profile-btn secondary" href="configuracion.html">Configuración</a>
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
        const fav = !!UserStore.getItem(`u:${userId}|item:${item.id}|fav`);
        const viewed = !!UserStore.getItem(`u:${userId}|item:${item.id}|viewed`);
        
        let hasProgress = false;
        let lastChapter = 0;
        
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(`u:${userId}|`)) return;
            // anime: u:userId|anime:id|s:0|ep:1  (siempre tiene |s:N| antes de |ep:)
            if (key.includes(`|anime:${item.id}|s:`) && key.includes('|ep:')) {
                hasProgress = true;
                const epPart = key.split('|ep:')[1];
                lastChapter = epPart ? `EP ${epPart}` : lastChapter;
            }
            // manga: u:userId|manga:id|vol:1
            if (key.includes(`|manga:${item.id}|vol:`)) {
                hasProgress = true;
                const volPart = key.split('|vol:')[1];
                lastChapter = volPart ? `Vol ${volPart}` : lastChapter;
            }
            // novelas también usan volumeStorageKey (manga prefix internamente)
            if (key.includes(`|manga:${item.id}|vol:`) && item.__category === 'novelas') {
                hasProgress = true;
                const volPart = key.split('|vol:')[1];
                lastChapter = volPart ? `Vol ${volPart}` : lastChapter;
            }
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
        const fav = !!UserStore.getItem(`u:${user}|item:${item.id}|fav`);
        const viewed = !!UserStore.getItem(`u:${user}|item:${item.id}|viewed`);
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
        const fav = !!UserStore.getItem(`u:${user}|item:${item.id}|fav`);
        const viewed = !!UserStore.getItem(`u:${user}|item:${item.id}|viewed`);
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
        if (UserStore.getItem(`u:${user}|item:${item.id}|fav`))    { byCategory[cat].fav++; totalFav++; }
        if (UserStore.getItem(`u:${user}|item:${item.id}|viewed`)) { byCategory[cat].viewed++; totalViewed++; }
    });
    
    const pts = Number(UserStore.getItem(`u:${user}|points`) || 0);
    // 'sessions' requiere persistencia en Supabase (tabla profiles/user_stats).
    // Por ahora se muestra 0 para no leer datos fantasma de memoria volátil.
    const sessions = 0;

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

// ─── Carga todos los estados del usuario desde Supabase al UserStore ───────────
async function cargarEstadosDesdeSupabase() {
    const client = window.AppSupabase;
    if (!client?.loadItemStates) return;

    // Usar _sessionUser directamente para no depender de isSignedIn()
    const user = _sessionUser || client?.getCurrentUserSync?.() || null;
    if (!user) return;

    const userId = getCurrentUserIdSafe();
    if (!userId || userId === 'Invitado') return;

    try {
        const categorias = ['anime', 'manga', 'novelas', 'juegos'];
        const resultados = await Promise.all(categorias.map(cat => client.loadItemStates(cat)));

        resultados.forEach((states, i) => {
            const cat = categorias[i];
            if (!Array.isArray(states)) return;
            states.forEach((state) => {
                const itemId = state.item_id;
                if (!itemId) return;
                const favKey    = `u:${userId}|item:${itemId}|fav`;
                const viewedKey = `u:${userId}|item:${itemId}|viewed`;
                const metaKey   = `u:${userId}|itemMeta:${itemId}`;

                if (state.fav)    UserStore.setItem(favKey, '1');
                else              UserStore.removeItem(favKey);

                if (state.viewed) UserStore.setItem(viewedKey, '1');
                else              UserStore.removeItem(viewedKey);

                // Guardar meta si el item tiene fav o viewed.
                // Aunque meta llegue vacío desde Supabase, lo guardamos igual
                // para que getAllItems() pueda encontrar items que no estén en DATOS_WEB
                // (ej: animes cargados desde la API de Jikan).
                if (state.fav || state.viewed) {
                    const metaToStore = (state.meta && Object.keys(state.meta).length > 0)
                        ? { ...state.meta, __category: cat }
                        : { id: state.item_id, __category: cat };
                    UserStore.setItem(metaKey, JSON.stringify(metaToStore));
                } else {
                    UserStore.removeItem(metaKey);
                }
            });
        });
    } catch (err) {
        console.warn('[mis-listas] Error cargando estados desde Supabase:', err);
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

    async function initConSupabase() {
        // 1) Esperar a que AppSupabase esté listo usando la Promise garantizada,
        //    en lugar del while-loop que no garantiza que _currentUser ya esté seteado.
        if (window.AppSupabaseReady) {
            await window.AppSupabaseReady;
        } else {
            // Fallback: esperar hasta 6s si el módulo cargó tarde
            let elapsed = 0;
            while (!window.AppSupabase && elapsed < 6000) {
                await new Promise(r => setTimeout(r, 100));
                elapsed += 100;
            }
        }

        // 2) Leer la sesión directamente — esto también garantiza que
        //    _currentUser en supabase-config.js ya esté seteado antes de
        //    llamar a loadItemStates (que internamente lee _currentUser).
        if (window.AppSupabase?.client) {
            try {
                const { data: { session } } = await window.AppSupabase.client.auth.getSession();
                _sessionUser = session?.user ?? null;
            } catch (e) {
                console.warn('[mis-listas] No se pudo leer la sesion:', e);
            }
        }

        await cargarEstadosDesdeSupabase();
        renderAll();
    }

    if (window.DATOS_WEB && Object.keys(window.DATOS_WEB).some((key) => Array.isArray(window.DATOS_WEB[key]) && window.DATOS_WEB[key].length)) {
        initConSupabase();
    } else {
        document.addEventListener('datosCargados', () => initConSupabase(), { once: true });
        setTimeout(() => initConSupabase(), 2000);
    }

    window.addEventListener('supabase-auth-changed', async (e) => {
        // Actualizar _sessionUser con el usuario del evento o desde getSession()
        const evtUser = e?.detail?.user ?? null;
        if (evtUser !== undefined) {
            _sessionUser = evtUser;
        } else if (window.AppSupabase?.client) {
            try {
                const { data: { session } } = await window.AppSupabase.client.auth.getSession();
                _sessionUser = session?.user ?? null;
            } catch (_) {}
        }
        await cargarEstadosDesdeSupabase();
        renderAll();
    });

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