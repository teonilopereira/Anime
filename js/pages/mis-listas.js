const LIST_FILTERS = Object.freeze({
    ALL: 'all',
    FAV: 'fav',
    VIEWED: 'viewed',
    WATCHING: 'viendo',
    PLANNED: 'pendiente',
    DROPPED: 'abandonado'
});

const WSTATUS_BADGES = Object.freeze({
    viendo:     { label: '▶ Viendo',     color: '#4d86ff' },
    pendiente:  { label: '🕒 Pendiente',  color: '#f59e0b' },
    pausado:    { label: '⏸ En pausa',   color: '#94a3b8' },
    abandonado: { label: '✕ Abandonado', color: '#ef4444' }
});

const CATEGORY_LABELS = Object.freeze({
    anime: 'Anime',
    manga: 'Manga',

    novelas: 'Novelas'
});

function renderGenres(info) {
    if (!info) return '';
    var genres = String(info).split(/[|/]/).map(function (g) { return g.trim(); }).filter(Boolean);
    if (!genres.length) return '';
    return '<span class="genre-chips">' + genres.map(function (g) { return '<span class="genre-chip">' + escapeHtml(g) + '</span>'; }).join('') + '</span>';
}

// Sesión local: se setea desde getSession() directamente para evitar
// problemas de timing con _currentUser interno de supabase-config.js
let _sessionUser = null;
let _remoteItemStates = [];


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

function statusStorageKeySafe(userId, itemId, type) {
    if (typeof statusStorageKey === 'function') return statusStorageKey(userId, itemId, type);
    return `u:${userId}|item:${itemId}|${type}`;
}

function getAllItems() {
    const all = [];
    const byId = new Set();

    const pushItem = (item, category) => {
        if (!item || !item.id) return;
        const cat = category || item.__category || item.categoria;
        if (!cat || ['anime', 'manga', 'novelas'].indexOf(cat) === -1) return;
        const key = cat + ':' + String(item.id);
        if (byId.has(key)) return;
        byId.add(key);
        all.push({
            ...item,
            id: String(item.id),
            __category: cat
        });
    };

    if (_remoteItemStates.length) {
        _remoteItemStates.forEach((state) => {
            pushItem({
                id: state.item_id,
                titulo: state.meta?.titulo || state.titulo || '',
                img: state.meta?.img || state.img || '',
                info: state.meta?.info || state.info || '',
                status: state.meta?.status || state.status || ''
            }, state.category);
        });
    }

    if (!all.length) {
        const userId = getCurrentUserIdSafe();
        if (userId !== 'Invitado') {
            UserStore.keys().forEach((key) => {
                if (!key.startsWith('u:' + userId + '|itemMeta:') || !UserStore.getItem(key)) return;
                try {
                    const item = JSON.parse(UserStore.getItem(key));
                    pushItem(item, item.__category || item.categoria);
                } catch (e) {
                    console.warn('Corrupt itemMeta key:', key, e);
                }
            });
        }
    }

    return all;
}



function getItemLink(item) {
    const category = item.__category || item.categoria || '';
    if (!category || !item.id) return '#';
    return `detalle.html?cat=${encodeURIComponent(category)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(item.titulo || '')}`;
}

function getUserItemState(userId, item) {
    const cat = String(item.__category || item.categoria || '');
    const map = _getRemoteStatesMap();
    const remote = map.get(String(item.id) + '|' + cat) || null;

    const fav = remote ? !!remote.fav : !!UserStore.getItem(statusStorageKeySafe(userId, item.id, 'fav'));
    const viewed = remote ? !!remote.viewed : !!UserStore.getItem(statusStorageKeySafe(userId, item.id, 'viewed'));
    // El estado local pisa al remoto (puede ser más nuevo si la migración
    // watch_status no está aplicada y la sync solo guardó fav/viewed)
    const localWstatus = UserStore.getItem('u:' + userId + '|item:' + item.id + '|wstatus') || '';
    const wstatus = localWstatus || remote?.watch_status || '';
    return {
        item,
        fav,
        viewed,
        wstatus,
        updatedAt: remote?.updated_at || UserStore.getItem('u:' + userId + '|item:' + item.id + '|ts') || ''
    };
}



function matchesFilter(entry, filterMode) {
    if (filterMode === LIST_FILTERS.FAV) return entry.fav;
    if (filterMode === LIST_FILTERS.VIEWED) return entry.viewed;
    if (filterMode === LIST_FILTERS.WATCHING) return entry.wstatus === 'viendo';
    if (filterMode === LIST_FILTERS.PLANNED) return entry.wstatus === 'pendiente';
    if (filterMode === LIST_FILTERS.DROPPED) return entry.wstatus === 'abandonado' || entry.wstatus === 'pausado';
    return entry.fav || entry.viewed || !!entry.wstatus;
}

function renderMediaCard({ item, fav = false, viewed = false, wstatus = '', match = null, isRow = false, index = 1 }) {
    const link = getItemLink(item);
    const category = CATEGORY_LABELS[item.__category] || item.__category || 'Lista';
    const wsBadge = WSTATUS_BADGES[wstatus];
    const badges = [
        wsBadge ? `<span style="color:${wsBadge.color};">${wsBadge.label}</span>` : '',
        fav ? '<span style="color:#bc13fe;">❤ Me gusta</span>' : '',
        viewed ? '<span style="color:#00f2ff;">👁 Visto</span>' : '',
        match ? `<span style="color:#00f2ff;">${escapeHtml(match)} match</span>` : ''
    ].filter(Boolean).join(' ');
    
    if (isRow) {
        const catIcons = { anime: '📺', manga: '📖', novelas: '📝' };
        const icon = catIcons[item.__category] || '';
        const epsLabel = item.__category === 'anime' ? 'eps' : 'vols';
        return `
            <article class="list-row-card">
                <div class="row-rank">${index}</div>
                <a href="${escapeHtml(link)}">
                    <img class="row-cover" src="${safeUrl(item.img)}" alt="${escapeHtml(item.titulo)}" loading="lazy" data-fallback-catalog="1">
                </a>
                <div class="row-info">
                    <div class="row-title">${escapeHtml(item.titulo)}</div>
                    <div class="row-desc">${icon} ${escapeHtml(category)}${item.info ? ' • ' : ''}${renderGenres(item.info)}</div>
                </div>
                <div class="row-status">
                    ${badges}
                </div>
                <div class="row-eps">
                    <div>${escapeHtml(String(item.total || item.episodes || item.chapters || item.volumes || '?'))}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">${epsLabel}</div>
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
                                <img src="${safeUrl(item.img)}" alt="${title}" loading="lazy" data-fallback-catalog="1">
                            </div>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${title}</h2>
                            <span style="color:#00f2ff;font-weight:bold;margin-bottom:10px;display:block;">${escapeHtml(match || '')}</span>
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

// ─── Calendario de emisión ───
let _calendarLoading = false;

function calendarDayLabel(airingMs) {
    const now = new Date();
    const target = new Date(airingMs);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    const label = target.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function calendarCountdown(airingMs) {
    const left = airingMs - Date.now();
    if (left <= 0) return '¡Ya disponible!';
    const totalMin = Math.floor(left / 60000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `en ${d}d ${h}h`;
    if (h > 0) return `en ${h}h ${m}m`;
    return `en ${m}m`;
}

function getCalendarAnimeIds() {
    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') return [];
    const ids = new Set();

    // Animes con fav, visto o estado de seguimiento activo
    getAllItems().forEach((item) => {
        if (item.__category !== 'anime') return;
        const entry = getUserItemState(userId, item);
        const followed = entry.fav || entry.wstatus === 'viendo' || entry.wstatus === 'pendiente';
        if (followed) ids.add(Number(item.id));
    });

    // Animes con episodios marcados (aunque no tengan fav/estado)
    try {
        UserStore.keys().forEach((key) => {
            const m = key.match(new RegExp('^u:' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\|anime:(\\d+)\\|s:\\d+\\|ep:\\d+$'));
            if (m && UserStore.getItem(key)) ids.add(Number(m[1]));
        });
    } catch (e) { console.warn('getCalendarAnimeIds scan failed:', e); }

    return [...ids].filter(n => Number.isFinite(n) && n > 0);
}

async function renderCalendario() {
    const host = document.getElementById('calendarGrid');
    if (!host || _calendarLoading) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        renderEmpty(host, 'Iniciá sesión', 'Entrá con tu cuenta para ver el calendario de tus animes.');
        return;
    }

    if (typeof window.getAiringSchedule !== 'function') {
        renderEmpty(host, 'No disponible', 'No se pudo cargar el módulo de calendario.');
        return;
    }

    const ids = getCalendarAnimeIds();
    if (!ids.length) {
        renderEmpty(host, 'Sin animes en seguimiento', 'Marcá animes como favoritos, "Viendo" o "Pendiente" para ver acá sus próximos episodios.');
        return;
    }

    _calendarLoading = true;
    host.innerHTML = '<div class="lists-empty"><h3>Consultando próximos episodios...</h3></div>';

    try {
        const schedule = await window.getAiringSchedule(ids);
        if (!schedule.length) {
            renderEmpty(host, 'Nada en emisión', 'Ninguno de tus animes seguidos tiene próximos episodios anunciados.');
            return;
        }

        // Agrupar por día manteniendo el orden por fecha
        const groups = [];
        const groupIndex = new Map();
        schedule.forEach((ep) => {
            const ms = ep.airingAt * 1000;
            const day = calendarDayLabel(ms);
            if (!groupIndex.has(day)) {
                groupIndex.set(day, groups.length);
                groups.push({ day, items: [] });
            }
            groups[groupIndex.get(day)].items.push(ep);
        });

        host.innerHTML = groups.map((group) => `
            <section class="calendar-day">
                <h2 class="calendar-day-title">${escapeHtml(group.day)}</h2>
                ${group.items.map((ep) => {
                    const ms = ep.airingAt * 1000;
                    const hora = new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const link = 'detalle.html?cat=anime&id=' + encodeURIComponent(ep.id);
                    return `
                    <a class="calendar-row" href="${escapeHtml(link)}">
                        ${ep.img ? `<img class="calendar-cover" src="${safeUrl(ep.img)}" alt="" loading="lazy">` : '<span class="calendar-cover calendar-cover--empty"></span>'}
                        <span class="calendar-info">
                            <span class="calendar-title">${escapeHtml(ep.title)}</span>
                            <span class="calendar-meta">EP ${ep.episode || '?'} • ${escapeHtml(hora)} hs</span>
                        </span>
                        <span class="calendar-countdown">${escapeHtml(calendarCountdown(ms))}</span>
                    </a>`;
                }).join('')}
            </section>
        `).join('');
    } catch (e) {
        console.warn('renderCalendario error:', e);
        renderEmpty(host, 'Error', 'No se pudo cargar el calendario. Probá de nuevo en unos segundos.');
    } finally {
        _calendarLoading = false;
    }
}

function render(filterMode) {
    const grid = document.getElementById('listsGrid');
    if (!grid) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        renderEmpty(grid, 'Iniciá sesión', 'Usá el botón Cuenta para entrar o crear un usuario y ver tus listas.');
        return;
    }

    const items = getAllItems()
        .map((item) => getUserItemState(userId, item))
        .filter((entry) => matchesFilter(entry, filterMode))
        .filter((entry) => currentCatFilter === 'all' || entry.item.__category === currentCatFilter)
        .sort((a, b) => getItemTs(userId, b.item.id) - getItemTs(userId, a.item.id));

    if (!items.length) {
        renderEmpty(grid, 'Sin resultados', 'No tenés ítems marcados con este filtro.');
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
        progress: { manga: [], novelas: [], anime: [] }
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
        const novelaMatch = key.match(/^u:([^|]+)\|novela:([^|]+)\|(?:vol|ch):(\d+)$/);
        if (novelaMatch) {
            data.progress.novelas.push({ id: novelaMatch[2], progress: Number(novelaMatch[3]) });
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
        { id: 'fav1', title: 'Corazón de Otaku', desc: 'Marcá 1 título como "Me gusta"', req: lists.fav >= 1, icon: '❤' },
        { id: 'fav10', title: 'Coleccionista', desc: 'Marca 10 títulos como "Me gusta"', req: lists.fav >= 10, icon: '🌟', secret: true },
        { id: 'view1', title: 'Primer Vistazo', desc: 'Marca 1 título como "Visto"', req: lists.viewed >= 1, icon: '👁️' },
        { id: 'view50', title: 'Devorador de Mundos', desc: 'Marca 50 títulos como "Visto"', req: lists.viewed >= 50, icon: '🔥', secret: true },
        { id: 'ep1', title: 'Un Pasito', desc: 'Marca tu primer capítulo o episodio', req: lists.eps >= 1, icon: '🎬' },
        { id: 'ep100', title: 'Maratonista', desc: 'Marca 100 capítulos o episodios', req: lists.eps >= 100, icon: '🏃', secret: true }
    ];

    rules.forEach(function(r) {
        if (r.req && userId !== 'Invitado') {
            UserStore.setItem('u:' + userId + '|achievement:' + r.id, '1');
        }
    });

    host.innerHTML = rules.map(function(r) {
        var unlocked = UserStore.getItem('u:' + userId + '|achievement:' + r.id) === '1';
        var isSecret = r.secret && !unlocked;

        return '<div class="achievement-card ' + (unlocked ? 'is-unlocked' : 'is-locked') + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                '<span class="achievement-icon" aria-hidden="true">' + (isSecret ? '❓' : escapeHtml(r.icon)) + '</span>' +
                '<span class="achievement-state">' + (unlocked ? 'Desbloqueado' : 'Bloqueado') + '</span>' +
            '</div>' +
            '<div>' +
                '<div class="achievement-title">' + (isSecret ? '???' : escapeHtml(r.title)) + '</div>' +
                (isSecret ? '' : '<div class="achievement-desc">' + escapeHtml(r.desc) + '</div>') +
            '</div>' +
        '</div>';
    }).join('');
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
    const lv = (typeof levelFromPoints === 'function')
        ? levelFromPoints(pts)
        : { level: 1, current: 0, next: 100 };
    const dbLevel = Number(UserStore.getItem('u:' + userId + '|level') || '0');
    const level = Math.max(dbLevel, lv.level);
    const pct = Math.max(0, Math.min(100, Math.round((lv.current / lv.next) * 100)));

    host.innerHTML = `
        <div class="points-card">
            <div class="points-top">
                <div class="points-title">Nivel ${level}</div>
                <div class="points-value">${pts} pts</div>
            </div>
            <div class="points-track" aria-hidden="true"><div class="points-fill" style="width:${pct}%"></div></div>
            <div class="points-sub">Faltan ${Math.max(0, lv.next - lv.current)} pts para el próximo nivel.</div>
        </div>
    `;
}

function renderProfileSummary() {
    const host = document.getElementById('listsProfile');
    if (!host) return;

    const userId = getCurrentUserIdSafe();

    // — Invitado: mostrar botón de login prominente —
    if (userId === 'Invitado') {
        host.innerHTML = `
            <div class="sidebar-guest">
                <div class="sidebar-guest-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(192,132,252,0.8)" stroke-width="1.5">
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                </div>
                <div>
                    <p class="sidebar-guest-text">No has iniciado sesión</p>
                    <p class="sidebar-guest-sub">Iniciá sesión para guardar tus listas</p>
                </div>
                <a href="Login.html" class="sidebar-login-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    Ingresar
                </a>
            </div>
        `;
        return;
    }

    // — Usuario logueado: mostrar avatar y stats —
    const user = _sessionUser;
    const photoUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
    const displayName = user?.user_metadata?.username
        || user?.user_metadata?.name
        || user?.user_metadata?.full_name
        || (user?.email ? user.email.split('@')[0] : userId);
    const initials = String(displayName || 'US').trim().slice(0, 2).toUpperCase();

    const pts = (typeof getUserPoints === 'function') ? getUserPoints(userId) : Number(UserStore.getItem(`u:${userId}|points`) || '0');
    const lv = (typeof levelFromPoints === 'function') ? levelFromPoints(pts) : { level: 1, current: 0, next: 100 };
    const dbLevel = Number(UserStore.getItem('u:' + userId + '|level') || '0');
    const level = Math.max(dbLevel, lv.level);
    const pct = Math.max(0, Math.min(100, Math.round((lv.current / lv.next) * 100)));

    const avatarHtml = photoUrl
        ? `<div class="sidebar-avatar-ring">
               <div class="sidebar-avatar-inner">
                   <img src="${safeUrl(photoUrl)}" alt="${escapeHtml(displayName)}"
                        data-avatar-fallback="1">
                   <div class="sidebar-initials" style="display:none;">${escapeHtml(initials)}</div>
               </div>
           </div>`
        : `<div class="sidebar-avatar-ring">
               <div class="sidebar-avatar-inner">
                   <div class="sidebar-initials">${escapeHtml(initials)}</div>
               </div>
           </div>`;

    host.innerHTML = `
        <div class="sidebar-avatar-wrap">
            ${avatarHtml}
        </div>
        <div class="lists-profile-main">
            <span class="lists-profile-label">Perfil</span>
            <strong class="lists-profile-name">${escapeHtml(displayName)}</strong>
            <div class="lists-profile-track" aria-label="Progreso de nivel">
                <div class="lists-profile-fill" style="width:${pct}%"></div>
            </div>
            <span class="lists-profile-meta">Nivel ${level} · ${pts} pts</span>
        </div>
        <div class="lists-profile-actions">
            <a class="lists-profile-btn" href="usuario.html">Editar perfil</a>
            <a class="lists-profile-btn secondary" href="configuracion.html">Configuración</a>
        </div>
    `;
}

function getItemTs(userId, itemId) {
    const map = _getRemoteStatesMap();
    var remote = null;
    map.forEach(function(v, k) { if (k.startsWith(String(itemId) + '|')) remote = v; });
    const raw = remote?.updated_at
        || UserStore.getItem('u:' + userId + '|item:' + itemId + '|ts')
        || UserStore.getItem('u:' + userId + '|item:' + itemId + '|progressTs')
        || '';
    if (!raw) return 0;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

let filterModeState = LIST_FILTERS.ALL;

// Cached Map for O(1) lookups from _remoteItemStates
let _remoteStatesMap = null;
let _remoteStatesMapRef = null;
function _getRemoteStatesMap() {
    if (_remoteStatesMap && _remoteStatesMapRef === _remoteItemStates) return _remoteStatesMap;
    _remoteStatesMap = new Map();
    _remoteItemStates.forEach(function(s) {
        _remoteStatesMap.set(String(s.item_id) + '|' + String(s.category || ''), s);
    });
    _remoteStatesMapRef = _remoteItemStates;
    return _remoteStatesMap;
}

function bindControls() {
    const actions = [
        ['filterAll', LIST_FILTERS.ALL],
        ['filterFav', LIST_FILTERS.FAV],
        ['filterViewed', LIST_FILTERS.VIEWED],
        ['filterWatching', LIST_FILTERS.WATCHING],
        ['filterPlanned', LIST_FILTERS.PLANNED],
        ['filterDropped', LIST_FILTERS.DROPPED]
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
        grid.innerHTML = '<div class="lists-empty"><h3>Iniciá sesión</h3><p>Para registrar y ver actividad.</p></div>';
        return;
    }

    const allItems = getAllItems();

    // Pre-build progress index: scan UserStore keys ONCE
    const progressMap = new Map();
    try {
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(`u:${userId}|`)) return;
            if (!UserStore.getItem(key)) return;
            let itemId = null, chapter = '';
            const animeM = key.match(/\|anime:(\d+)\|s:\d+\|ep:(\d+)$/);
            if (animeM) { itemId = animeM[1]; chapter = 'EP ' + animeM[2]; }
            if (!itemId) {
                const mangaM = key.match(/\|manga:(\d+)\|vol:(\d+)$/);
                if (mangaM) { itemId = mangaM[1]; chapter = 'Vol ' + mangaM[2]; }
            }
            if (!itemId) {
                const novelaM = key.match(/\|novela:(\d+)\|vol:(\d+)$/);
                if (novelaM) { itemId = novelaM[1]; chapter = 'Vol ' + novelaM[2]; }
            }
            if (itemId) {
                const prev = progressMap.get(itemId) || { hasProgress: false, lastChapter: '' };
                progressMap.set(itemId, { hasProgress: true, lastChapter: chapter || prev.lastChapter });
            }
        });
    } catch (e) { console.warn('Activity progress scan failed:', e); }

    let actividadItems = [];
    allItems.forEach(item => {
        const fav = !!UserStore.getItem(`u:${userId}|item:${item.id}|fav`);
        const viewed = !!UserStore.getItem(`u:${userId}|item:${item.id}|viewed`);
        const prog = progressMap.get(String(item.id));
        const hasProgress = prog ? prog.hasProgress : false;
        const lastChapter = prog ? prog.lastChapter : '';
        
        if (fav || viewed || hasProgress) {
            actividadItems.push({ ...item, fav, viewed, hasProgress, lastChapter });
        }
    });

    actividadItems.sort((a, b) => getItemTs(userId, b.id) - getItemTs(userId, a.id));
    actividadItems = actividadItems.slice(0, AnimeDestiny.Constants.MAX_ACTIVITY_ITEMS || 15);
    
    if (actividadItems.length === 0) {
        grid.innerHTML = '<div class="lists-empty"><h3>Sin actividad</h3><p>No hay actividad reciente.</p></div>';
        return;
    }
    
    grid.innerHTML = actividadItems.map((entry, idx) => {
        const title = escapeHtml(entry.titulo);
        const img = safeUrl(entry.img);
        const cat = escapeHtml(CATEGORY_LABELS[entry.__category] || entry.__category || '');
        const link = getItemLink(entry);
        const epsLabel = entry.__category === 'anime' ? 'eps' : 'vols';
        const badges = [
            entry.fav ? '<span style="color:#bc13fe;">❤ Me gusta</span>' : '',
            entry.viewed ? '<span style="color:#00f2ff;">👁 Visto</span>' : ''
        ].filter(Boolean).join(' ');
        
        const prog = entry.hasProgress ? `<div style="color:#00f2ff; font-weight:bold; font-size: 0.85rem; margin-top:4px;">Último marcado: ${escapeHtml(entry.lastChapter || '')}</div>` : '';

        return `
            <article class="list-row-card">
                <div class="row-rank">${idx + 1}</div>
                <a href="${escapeHtml(link)}">
                    <img class="row-cover" src="${img}" alt="${title}" loading="lazy" data-fallback-catalog="1">
                </a>
                <div class="row-info">
                    <div class="row-title">${title}</div>
                    <div class="row-desc">${cat}${entry.info ? ' • ' : ''}${renderGenres(entry.info)}</div>
                    ${prog}
                </div>
                <div class="row-status">
                    ${badges}
                </div>
                <div class="row-eps">
                    <div>${escapeHtml(String(entry.total || entry.episodes || entry.chapters || entry.volumes || '?'))}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">${epsLabel}</div>
                </div>
            </article>
        `;
    }).join('');
}

function updateCategoryCards() {
    const user = getCurrentUserIdSafe();
    if (user === 'Invitado') return;

    const catCounts = { anime: 0, manga: 0, novelas: 0 };
    const catFav    = { anime: 0, manga: 0, novelas: 0 };
    const catViewed = { anime: 0, manga: 0, novelas: 0 };

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

    items.sort((a, b) => getItemTs(user, b.id) - getItemTs(user, a.id));
    const recent = items.slice(0, AnimeDestiny.Constants.MAX_MINI_ACTIVITY || 5);
    if (!recent.length) return;

    const catIcons = { anime: '📺', manga: '📖', novelas: '📝' };
    host.innerHTML = recent.map(item => `
        <div class="cat-activity-item">
            <span class="ai-icon">${catIcons[item.__category] || '⭐'}</span>
            <span class="ai-title">${escapeHtml(String(item.titulo || '')).substring(0, AnimeDestiny.Constants.ACTIVITY_TITLE_MAX || 35)}</span>
            <span>${item.fav ? '❤' : ''} ${item.viewed ? '👁' : ''}</span>
        </div>
    `).join('');
}

function renderStats() {
    const host = document.getElementById('statsGrid');
    if (!host) return;
    const user = getCurrentUserIdSafe();
    if (user === 'Invitado') {
        host.innerHTML = '<div class="lists-empty" style="grid-column:1/-1"><h3>Sin datos</h3><p class="stat-label">Iniciá sesión para ver estadísticas.</p></div>';
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
            icon: { anime: '📺', manga: '📖', novelas: '📝' }[cat] || '📋',
            color: '#bc13fe'
        }))
    ];

    host.innerHTML = statItems.map(s => `
        <div class="stat-card">
            <div class="stat-icon">${s.icon}</div>
            <div>
                <div class="stat-value" style="color:${s.color}">${s.value}</div>
                <div class="stat-label">${s.label}</div>
            </div>
        </div>
    `).join('');
}

// Para que las recomendaciones no tiren error, agregamos una version fake simple o importamos algo si existiera
function renderRecommendations() {
    const grid = document.getElementById('recommendGrid');
    if (!grid) return;
    const allItems = getAllItems().sort((a, b) => {
        const ta = String(a.titulo || '').toLowerCase();
        const tb = String(b.titulo || '').toLowerCase();
        return ta.localeCompare(tb);
    });
    if(allItems.length > (AnimeDestiny.Constants.MAX_RECOMMENDATIONS || 5)) {
        grid.innerHTML = allItems.slice(0, AnimeDestiny.Constants.MAX_RECOMMENDATIONS || 5).map(item => renderMediaCard({ item })).join('');
    } else if (allItems.length > 0) {
        grid.innerHTML = allItems.map(item => renderMediaCard({ item })).join('');
    } else {
        grid.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-family:Rajdhani,sans-serif;text-align:center;grid-column:1/-1;padding:40px 0">Agregá contenido a tus listas para ver recomendaciones.</p>';
    }
}

// —— Carga todos los estados del usuario desde Supabase al UserStore ——————
async function cargarEstadosDesdeSupabase() {
    const client = window.AppSupabase;
    if (!client?.loadItemStates) return;

    const user = _sessionUser || client?.getCurrentUserSync?.() || null;
    if (!user) return;

    const userId = getCurrentUserIdSafe();
    if (!userId || userId === 'Invitado') return;

    try {
        const estados = await client.loadItemStates('');
        if (!Array.isArray(estados)) return;
        _remoteItemStates = estados.slice();

        estados.forEach((state) => {
            const itemId = state.item_id;
            if (!itemId) return;
            const favKey = 'u:' + userId + '|item:' + itemId + '|fav';
            const viewedKey = 'u:' + userId + '|item:' + itemId + '|viewed';
            const metaKey = 'u:' + userId + '|itemMeta:' + itemId;
            const tsKey = 'u:' + userId + '|item:' + itemId + '|ts';

            if (state.fav) UserStore.setItem(favKey, '1');
            else UserStore.removeItem(favKey);

            if (state.viewed) UserStore.setItem(viewedKey, '1');
            else UserStore.removeItem(viewedKey);

            if (state.fav || state.viewed) {
                if (state.meta && Object.keys(state.meta).length > 0) {
                    UserStore.setItem(metaKey, JSON.stringify(state.meta));
                } else if (state.category) {
                    UserStore.setItem(metaKey, JSON.stringify({ __category: state.category }));
                }
            }

            if (state.updated_at) {
                UserStore.setItem(tsKey, state.updated_at);
            }
        });
    } catch (err) {
        console.warn('[mis-listas] Error cargando estados desde Supabase:', err);
    }

    try {
        if (typeof client.loadAllProgress === 'function') {
            const progressRows = await client.loadAllProgress();
            if (Array.isArray(progressRows)) {
                progressRows.forEach((row) => {
                    const pkey = String(row.pkey || '');
                    const itemId = String(row.item_id || '');
                    const cat = String(row.category || '');
                    if (!pkey || !itemId) return;

                    if (cat === 'anime') {
                        const m = pkey.match(/^s:(\d+)\|ep:(\d+)$/);
                        if (m) {
                            const sIdx = Number(m[1]);
                            const ep = Number(m[2]);
                            if (Number.isFinite(sIdx) && Number.isFinite(ep) && ep > 0) {
                                UserStore.setItem('u:' + userId + '|anime:' + itemId + '|s:' + sIdx + '|ep:' + ep, '1');
                                if (row.updated_at) {
                                    UserStore.setItem('u:' + userId + '|item:' + itemId + '|progressTs', row.updated_at);
                                }
                            }
                        }
                    } else if (cat === 'manga' || cat === 'novelas') {
                        const prefix = cat === 'novelas' ? 'novela' : 'manga';
                        const mVol = pkey.match(/^vol:(\d+)$/);
                        if (mVol) {
                            const vol = Number(mVol[1]);
                            if (Number.isFinite(vol) && vol > 0) {
                                UserStore.setItem('u:' + userId + '|' + prefix + ':' + itemId + '|vol:' + vol, '1');
                                if (row.updated_at) {
                                    UserStore.setItem('u:' + userId + '|item:' + itemId + '|progressTs', row.updated_at);
                                }
                            }
                        }
                        const mCh = pkey.match(/^ch:(\d+)$/);
                        if (mCh) {
                            const ch = Number(mCh[1]);
                            if (Number.isFinite(ch) && ch > 0) {
                                UserStore.setItem('u:' + userId + '|' + prefix + ':' + itemId + '|ch:' + ch, '1');
                                if (row.updated_at) {
                                    UserStore.setItem('u:' + userId + '|item:' + itemId + '|progressTs', row.updated_at);
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (err) {
        console.warn('[mis-listas] Error cargando progreso desde Supabase:', err);
    }

    try {
        if (typeof client.loadProfile === 'function') {
            const profile = await client.loadProfile();
            if (profile) {
                if (typeof profile.exp === 'number') {
                    UserStore.setItem(pointsKey(userId), String(profile.exp));
                }
                if (typeof profile.level === 'number') {
                    UserStore.setItem('u:' + userId + '|level', String(profile.level));
                }
                if (typeof profile.total_likes === 'number') {
                    UserStore.setItem('u:' + userId + '|total_likes', String(profile.total_likes));
                }
                if (typeof profile.total_viewed === 'number') {
                    UserStore.setItem('u:' + userId + '|total_viewed', String(profile.total_viewed));
                }
            }
        }
    } catch (err) {
        console.warn('[mis-listas] Error cargando perfil desde Supabase:', err);
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
        // 1) Esperar a que window.AppSupabase exista
        if (!window.AppSupabase && typeof window.waitForSupabase === 'function') {
            await window.waitForSupabase();
        }

        // 2) Obtener la sesión directamente desde el cliente de Supabase.
        //    Guardamos el usuario en _sessionUser para no depender del timing
        //    interno de _currentUser en supabase-config.js.
        if (window.AppSupabase?.client) {
            try {
                const { data: { session } } = await window.AppSupabase.client.auth.getSession();
                _sessionUser = session?.user ?? null;
            } catch (e) {
                console.warn('[mis-listas] No se pudo leer la sesión:', e);
            }
        }

        await cargarEstadosDesdeSupabase();
        renderAll();
    }

    function hideListsLoader() {
        var loader = document.getElementById('listsLoader');
        if (loader) loader.style.display = 'none';
    }

    initConSupabase().then(hideListsLoader).catch(hideListsLoader);
    setTimeout(hideListsLoader, AnimeDestiny.Constants.SAFETY_NET_TIMEOUT_MS || 15000); // safety net

    window.addEventListener('supabase-auth-changed', async (e) => {
        // Actualizar _sessionUser con el usuario del evento o desde getSession()
        const evtUser = e?.detail?.user ?? null;
        if (evtUser !== undefined) {
            _sessionUser = evtUser;
        } else if (window.AppSupabase?.client) {
            try {
                const { data: { session } } = await window.AppSupabase.client.auth.getSession();
                _sessionUser = session?.user ?? null;
            } catch (e) { console.warn('Auth session refresh failed:', e); }
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
                if (tabId === 'calendario') renderCalendario();
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



