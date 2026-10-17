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

// Géneros oficiales de AniList (para filtrar del campo info lo que sí es un género)
const KNOWN_GENRES = AnimeDestiny.Genres.OFICIALES;

function extractGenresFromInfo(info) {
    if (!info) return [];
    return String(info)
        .split(/[|/,]/)
        .map(function (g) { return g.trim(); })
        .filter(Boolean)
        .map(function (g) {
            return KNOWN_GENRES.find(function (k) { return k.toLowerCase() === g.toLowerCase(); }) || null;
        })
        .filter(Boolean);
}

// Devuelve los géneros más frecuentes entre las entradas dadas, ordenados por peso.
function topGenresFromEntries(entries) {
    const counts = {};
    entries.forEach(function (e) {
        // "Visto" pesa más que "Me gusta" para el perfil de gustos
        const weight = e.viewed ? 2 : 1;
        extractGenresFromInfo(e.item && e.item.info).forEach(function (g) {
            counts[g] = (counts[g] || 0) + weight;
        });
    });
    return Object.keys(counts)
        .sort(function (a, b) { return counts[b] - counts[a]; });
}


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
    // Etiquetas estilo QBadge: el estado de seguimiento con el mismo color que
    // el selector del detalle; favorito, visto y match con contorno.
    const badges = [
        wsBadge ? `<span class="q-badge q-badge--${escapeHtml(wstatus)}">${escapeHtml(wsBadge.label.replace(/^\S+\s/, ''))}</span>` : '',
        fav ? '<span class="q-badge q-badge--outline q-badge--fav">Me gusta</span>' : '',
        viewed ? '<span class="q-badge q-badge--outline">Visto</span>' : '',
        match ? `<span class="q-badge q-badge--outline">${escapeHtml(match)} match</span>` : ''
    ].filter(Boolean).join(' ');
    
    if (isRow) {
        const catIcons = { anime: '📺', manga: '📖', novelas: '📝' };
        const icon = catIcons[item.__category] || '';
        const epsLabel = item.__category === 'anime' ? 'eps' : 'vols';
        return `
            <article class="list-row-card">
                <div class="row-rank">${index}</div>
                <a href="${escapeHtml(link)}">
                    <img class="row-cover" src="${safeUrl(anilistCover(item.img, 'small'))}" alt="${escapeHtml(item.titulo)}" width="42" height="60" decoding="async" loading="lazy" data-fallback-catalog="1">
                </a>
                <div class="row-info">
                    <div class="row-title">${escapeHtml(item.titulo)}</div>
                    <div class="row-desc"><span class="row-cat">${icon} ${escapeHtml(category)}</span>${renderGenres(item.info)}</div>
                    ${badges ? `<div class="row-status">${badges}</div>` : ''}
                </div>
                <div class="row-eps">
                    <div>${escapeHtml(String(item.total || item.episodes || item.chapters || item.volumes || '?'))}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">${epsLabel}</div>
                </div>
            </article>
        `;
    }

    // Para recomendaciones: la misma card "portada con riel" que el resto de
    // la app (.wcard), con el género que motivó la recomendación en la píldora.
    const safeId = escapeHtml(String(item.id));
    const title = escapeHtml(item.titulo);
    return `
    <a class="wcard recommend-card" href="${escapeHtml(link)}" data-item-id="${safeId}" data-category="${escapeHtml(item.__category)}">
        <span class="wcard-media">
            <img src="${safeUrl(item.img)}"${coverSrcsetAttrs(safeUrl(item.img))} alt="${title}" width="230" height="345" decoding="async" loading="lazy" data-fallback-catalog="1" data-title="${title}">
            ${match ? `<span class="wcard-pill">${escapeHtml(match)}</span>` : ''}
        </span>
        <span class="wcard-text">
            <span class="wcard-title">${title}</span>
            <span class="wcard-meta">${escapeHtml(category)}</span>
        </span>
    </a>
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

    // resolveUserLevel respeta el nivel guardado del servidor (u:<id>|level), que
    // es la autoridad: el exp sincronizado es solo el sobrante del nivel actual,
    // así que derivar el nivel de esos puntos daría nivel 1 para un usuario avanzado.
    const lv = (typeof resolveUserLevel === 'function')
        ? resolveUserLevel(userId)
        : (typeof levelFromPoints === 'function'
            ? levelFromPoints(getUserPoints(userId))
            : { level: 1, current: 0, next: 100, points: 0 });
    const pts = lv.points != null ? lv.points : Number(UserStore.getItem(`u:${userId}|points`) || '0');
    // Nivel y barra derivados de lv para que el número y la barra coincidan siempre.
    const level = lv.level;
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
            <span class="lists-profile-apodo">${escapeHtml(getActiveApodoNick(userId))}</span>
            <div class="lists-profile-track" role="progressbar" aria-label="Progreso de nivel"
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                <div class="lists-profile-fill" style="width:${pct}%;--pctnum:${Math.max(pct, 1)}"></div>
            </div>
            <span class="lists-profile-meta"><strong>Nivel ${level}</strong> · ${pts} pts</span>
            <span class="lists-profile-hint">${lv.atMax ? '¡Nivel máximo alcanzado!' : `Faltan ${Math.max(0, lv.next - lv.current)} pts para el próximo nivel`}</span>
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

document.addEventListener('DOMContentLoaded', () => {
    const renderCurrentFilter = bindControls();

    function renderAll() {
        renderProfileSummary();
        renderPoints();
        renderAchievements();
        renderApodos();
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
        // Repara portadas guardadas sin URL (metadatos viejos). No bloquea el
        // render inicial: corre en segundo plano y re-renderiza si recupera algo.
        repararPortadasFaltantes().catch((e) => console.warn('repararPortadasFaltantes:', e));
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
        repararPortadasFaltantes().catch((e) => console.warn('repararPortadasFaltantes:', e));
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

    // Apodos: equipar al hacer click / Enter en una card desbloqueada
    const apodosGrid = document.getElementById('apodosGrid');
    if (apodosGrid) {
        apodosGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.apodo-card.is-unlocked');
            if (card) equipApodo(card.getAttribute('data-apodo'));
        });
        apodosGrid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.apodo-card.is-unlocked');
            if (card) { e.preventDefault(); equipApodo(card.getAttribute('data-apodo')); }
        });
    }

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



