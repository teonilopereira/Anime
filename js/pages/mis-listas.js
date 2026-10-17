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
                        ${ep.img ? `<img class="calendar-cover" src="${safeUrl(anilistCover(ep.img, 'small'))}" alt="" width="44" height="60" decoding="async" loading="lazy" data-fallback-catalog="1" data-title="${escapeHtml(ep.title || '')}">` : '<span class="calendar-cover calendar-cover--empty"></span>'}
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

// ─── Biblioteca: búsqueda, orden y vista (portadas / lista) ───
let currentSearch = '';
let currentSort = 'reciente';
let currentView = (function () {
    try { return localStorage.getItem('ad:listsView') === 'list' ? 'list' : 'grid'; } catch (_) { return 'grid'; }
})();

const STATUS_COLORS = Object.freeze({
    viendo: '#00f2ff',
    pendiente: '#f59e0b',
    pausado: '#94a3b8',
    abandonado: '#ef4444',
    visto: '#c77dff'
});

const CATEGORY_ACCENTS = Object.freeze({ anime: '#00f2ff', manga: '#22c55e', novelas: '#f43f5e' });

const HEART_SVG = '<svg viewBox="0 0 24 24" fill="#ff5fa2" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>';

// Progreso marcado por ítem, recorriendo UserStore UNA sola vez por render.
// Clave del mapa: "<categoria>:<id>" → { count, unit }.
function buildProgressIndex(userId) {
    const index = new Map();
    const prefix = 'u:' + userId + '|';
    const add = (key, unit) => {
        const prev = index.get(key);
        // Si un manga tiene capítulos y volúmenes marcados, cuentan los capítulos
        if (prev && prev.unit === 'cap' && unit === 'vol') return;
        if (prev && prev.unit === unit) prev.count++;
        else index.set(key, { count: 1, unit });
    };
    try {
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(prefix) || !UserStore.getItem(key)) return;
            let m = key.match(/\|anime:([^|]+)\|s:\d+\|ep:\d+$/);
            if (m) { add('anime:' + m[1], 'ep'); return; }
            m = key.match(/\|(manga|novela):([^|]+)\|(vol|ch):\d+$/);
            if (m) add((m[1] === 'novela' ? 'novelas' : 'manga') + ':' + m[2], m[3] === 'ch' ? 'cap' : 'vol');
        });
    } catch (e) { console.warn('buildProgressIndex failed:', e); }
    return index;
}

function itemTotal(item) {
    const n = Number(item.total || item.episodes || item.chapters || item.volumes || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function progressLabel(prog, total) {
    if (!prog) return '';
    const unit = { ep: 'Ep.', cap: 'Cap.', vol: 'Vol.' }[prog.unit];
    return total ? `${unit} ${prog.count} de ${total}` : `${unit} ${prog.count}`;
}

function entryStatus(entry) {
    if (entry.wstatus && WSTATUS_BADGES[entry.wstatus]) {
        return { label: WSTATUS_BADGES[entry.wstatus].label.replace(/^\S+\s/, ''), color: STATUS_COLORS[entry.wstatus] };
    }
    if (entry.viewed) return { label: 'Visto', color: STATUS_COLORS.visto };
    return null;
}

function renderTile(entry, progress) {
    const item = entry.item;
    const link = getItemLink(item);
    const title = escapeHtml(item.titulo);
    const category = CATEGORY_LABELS[item.__category] || item.__category || '';
    const status = entryStatus(entry);
    const total = itemTotal(item);
    const prog = progress.get(item.__category + ':' + item.id);
    const pct = entry.viewed ? 100 : (prog && total ? Math.min(100, Math.round((prog.count / total) * 100)) : 0);
    const meta = entry.viewed && !entry.wstatus ? 'Terminado' : (progressLabel(prog, total) || category);
    const color = status ? status.color : STATUS_COLORS.visto;
    return `
        <li>
            <a class="ml-tile" href="${escapeHtml(link)}" style="--st-color:${color}">
                <span class="ml-tile-cover">
                    <img src="${safeUrl(item.img)}"${coverSrcsetAttrs(safeUrl(item.img))} alt="" width="230" height="345" decoding="async" loading="lazy" data-fallback-catalog="1" data-title="${title}">
                    ${status ? `<span class="ml-tile-badge">${escapeHtml(status.label)}</span>` : ''}
                    ${entry.fav ? `<span class="ml-tile-fav" title="Te gusta">${HEART_SVG}<span class="sr-only">Te gusta</span></span>` : ''}
                    ${pct ? `<span class="ml-tile-bar"><span style="width:${pct}%"></span></span>` : ''}
                </span>
                <span class="ml-tile-title">${title}</span>
                <span class="ml-tile-meta">${escapeHtml(category)}${meta !== category ? ' · ' + escapeHtml(meta) : ''}</span>
            </a>
        </li>`;
}

function updateStatusCounts(entries) {
    document.querySelectorAll('[data-count-for]').forEach((el) => {
        const mode = el.getAttribute('data-count-for');
        el.textContent = entries.filter((e) => matchesFilter(e, mode)).length;
    });
}

function render(filterMode) {
    const grid = document.getElementById('listsGrid');
    if (!grid) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        updateStatusCounts([]);
        renderEmpty(grid, 'Iniciá sesión', 'Usá el botón Cuenta para entrar o crear un usuario y ver tus listas.');
        return;
    }

    const q = currentSearch.trim().toLowerCase();
    // Base: todo lo que está en alguna lista, con la categoría y la búsqueda
    // aplicadas. De ahí salen los contadores de cada pestaña de estado.
    const base = getAllItems()
        .map((item) => getUserItemState(userId, item))
        .filter((entry) => matchesFilter(entry, LIST_FILTERS.ALL))
        .filter((entry) => currentCatFilter === 'all' || entry.item.__category === currentCatFilter)
        .filter((entry) => !q || String(entry.item.titulo || '').toLowerCase().includes(q));
    updateStatusCounts(base);

    const items = base.filter((entry) => matchesFilter(entry, filterMode));
    if (currentSort === 'az') {
        items.sort((a, b) => String(a.item.titulo || '').localeCompare(String(b.item.titulo || ''), 'es'));
    } else {
        const dir = currentSort === 'antiguo' ? -1 : 1;
        items.sort((a, b) => dir * (getItemTs(userId, b.item.id) - getItemTs(userId, a.item.id)));
    }

    if (!items.length) {
        const filtered = q || currentCatFilter !== 'all' || filterMode !== LIST_FILTERS.ALL;
        grid.innerHTML = `
            <div class="lists-empty">
                <h3>${filtered ? 'Sin resultados' : 'Tu biblioteca está vacía'}</h3>
                <p>${filtered ? 'No hay títulos que coincidan con estos filtros.' : 'Marcá un anime, manga o novela como "Me gusta", "Visto" o "Viendo" y aparece acá.'}</p>
                ${filtered ? '<button type="button" class="ml-reset" data-reset-filters="1">Quitar filtros</button>' : ''}
            </div>`;
        return;
    }

    if (currentView === 'list') {
        grid.innerHTML = '<div class="lists-grid-rows">' +
            items.map((entry, idx) => renderMediaCard({ ...entry, isRow: true, index: idx + 1 })).join('') + '</div>';
        return;
    }
    const progress = buildProgressIndex(userId);
    grid.innerHTML = '<ul class="ml-grid">' + items.map((entry) => renderTile(entry, progress)).join('') + '</ul>';
}

// ─── Continuar: lo que tenés en "Viendo", con el progreso marcado ───
function renderContinue() {
    const section = document.getElementById('continueSection');
    const rail = document.getElementById('continueRail');
    if (!section || !rail) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') { section.hidden = true; return; }

    const entries = getAllItems()
        .map((item) => getUserItemState(userId, item))
        .filter((e) => e.wstatus === 'viendo')
        .sort((a, b) => getItemTs(userId, b.item.id) - getItemTs(userId, a.item.id))
        .slice(0, 12);

    section.hidden = !entries.length;
    if (!entries.length) { rail.innerHTML = ''; return; }

    const countEl = document.getElementById('continueCount');
    if (countEl) countEl.textContent = entries.length === 1 ? '1 en curso' : `${entries.length} en curso`;

    const progress = buildProgressIndex(userId);
    rail.innerHTML = entries.map(({ item }) => {
        const cat = item.__category;
        const total = itemTotal(item);
        const prog = progress.get(cat + ':' + item.id);
        const pct = prog && total ? Math.min(100, Math.round((prog.count / total) * 100)) : 0;
        const title = escapeHtml(item.titulo);
        const label = progressLabel(prog, total) || 'Sin progreso marcado';
        return `
            <article class="ml-cont-card" style="--cont-accent:${CATEGORY_ACCENTS[cat] || '#00f2ff'}">
                <img class="ml-cont-cover" src="${safeUrl(anilistCover(item.img, 'medium'))}" alt="" width="76" height="108" decoding="async" loading="lazy" data-fallback-catalog="1" data-title="${title}">
                <div class="ml-cont-body">
                    <h3 class="ml-cont-title">${title}</h3>
                    <p class="ml-cont-meta">${escapeHtml(CATEGORY_LABELS[cat] || cat)}</p>
                    <div class="ml-cont-foot">
                        <div class="ml-cont-progress"><span>${escapeHtml(label)}</span>${pct ? `<span>${pct}%</span>` : ''}</div>
                        <div class="ml-bar"><span style="width:${pct}%"></span></div>
                        <a class="ml-cont-cta" href="${escapeHtml(getItemLink(item))}">${cat === 'anime' ? 'Seguir viendo' : 'Seguir leyendo'}</a>
                    </div>
                </div>
            </article>`;
    }).join('');
}

// ─── Esta semana: próximos episodios de los animes que seguís ───
async function renderWeek() {
    const host = document.getElementById('weekList');
    if (!host) return;
    const msg = (t) => { host.innerHTML = '<p class="ml-week-empty">' + escapeHtml(t) + '</p>'; };

    if (getCurrentUserIdSafe() === 'Invitado') { msg('Iniciá sesión para ver los estrenos de tus animes.'); return; }
    if (typeof window.getAiringSchedule !== 'function') { msg('El calendario no está disponible ahora.'); return; }
    const ids = getCalendarAnimeIds();
    if (!ids.length) { msg('Marcá animes como "Viendo" o "Pendiente" para ver sus próximos episodios.'); return; }

    try {
        const weekEnd = Date.now() + 7 * 86400000;
        const next = (await window.getAiringSchedule(ids))
            .filter((ep) => ep.airingAt * 1000 <= weekEnd)
            .slice(0, 5);
        if (!next.length) { msg('Ninguno de tus animes estrena episodio esta semana.'); return; }
        host.innerHTML = '<ul class="ml-week">' + next.map((ep) => {
            const ms = ep.airingAt * 1000;
            const d = new Date(ms);
            const day = calendarDayLabel(ms);
            const short = (day === 'Hoy' || day === 'Mañana') ? day : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
            const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
            return `
                <li>
                    <span class="ml-week-day">${escapeHtml(short)}</span>
                    <a class="ml-week-title" href="detalle.html?cat=anime&amp;id=${encodeURIComponent(ep.id)}">${escapeHtml(ep.title)} <span class="ml-week-ep">ep. ${ep.episode || '?'}</span></a>
                    <span class="ml-week-time">${escapeHtml(time)}</span>
                </li>`;
        }).join('') + '</ul>';
    } catch (e) {
        console.warn('renderWeek error:', e);
        msg('No se pudieron cargar los estrenos. Probá de nuevo en unos minutos.');
    }
}

function setActiveChip(activeId) {
    document.querySelectorAll('.lists-chip').forEach((chip) => {
        chip.classList.toggle('is-active', chip.id === activeId);
        chip.setAttribute('aria-pressed', String(chip.id === activeId));
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

    // — Invitado: botón de ingreso en la barra superior —
    if (userId === 'Invitado') {
        host.innerHTML = `
            <a href="Login.html" class="ml-login-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                Ingresar para guardar tus listas
            </a>
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

    const apodo = getActiveApodoNick(userId);
    const avatarInner = photoUrl
        ? `<img src="${safeUrl(photoUrl)}" alt="" data-avatar-fallback="1"><span class="sidebar-initials" style="display:none;">${escapeHtml(initials)}</span>`
        : `<span class="sidebar-initials">${escapeHtml(initials)}</span>`;
    const hint = lv.atMax ? 'Nivel máximo alcanzado' : `${pct}% del nivel ${level}, ${pts} pts`;

    // Pastilla compacta: el anillo del avatar es la barra de progreso del nivel.
    host.innerHTML = `
        <a class="ml-profile-link" href="usuario.html" aria-label="Tu perfil: ${escapeHtml(displayName)}, nivel ${level}. ${escapeHtml(hint)}">
            <span class="ml-avatar" style="--pct:${pct}" aria-hidden="true"><span class="ml-avatar-inner">${avatarInner}</span></span>
            <span class="ml-profile-text">
                <span class="ml-profile-name">${escapeHtml(displayName)} · nivel ${level}</span>
                <span class="ml-profile-sub">${escapeHtml(apodo || hint)}</span>
            </span>
        </a>
        <a class="ml-icon-btn" href="configuracion.html" aria-label="Configuración" title="Configuración">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
        </a>
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

    const search = document.getElementById('listsSearch');
    if (search) search.addEventListener('input', () => {
        currentSearch = search.value;
        render(filterModeState);
    });

    const sort = document.getElementById('listsSort');
    if (sort) sort.addEventListener('change', () => {
        currentSort = sort.value;
        render(filterModeState);
    });

    const viewButtons = { grid: document.getElementById('viewGrid'), list: document.getElementById('viewList') };
    const syncView = () => Object.keys(viewButtons).forEach((mode) => {
        if (viewButtons[mode]) viewButtons[mode].setAttribute('aria-pressed', String(currentView === mode));
    });
    syncView();
    Object.keys(viewButtons).forEach((mode) => {
        if (!viewButtons[mode]) return;
        viewButtons[mode].addEventListener('click', () => {
            currentView = mode;
            try { localStorage.setItem('ad:listsView', mode); } catch (_) { /* storage bloqueado */ }
            syncView();
            render(filterModeState);
        });
    });

    // "Quitar filtros" del estado vacío: vuelve a Todo / Todos / sin búsqueda
    const grid = document.getElementById('listsGrid');
    if (grid) grid.addEventListener('click', (e) => {
        if (!e.target.closest('[data-reset-filters]')) return;
        filterModeState = LIST_FILTERS.ALL;
        currentCatFilter = 'all';
        currentSearch = '';
        if (search) search.value = '';
        setActiveChip('filterAll');
        document.querySelectorAll('.res-tab').forEach((t) => {
            const on = (t.dataset.cat || 'all') === 'all';
            t.classList.toggle('active', on);
            t.setAttribute('aria-pressed', String(on));
        });
        render(filterModeState);
    });

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
        const img = safeUrl(anilistCover(entry.img, 'small'));
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
                    <img class="row-cover" src="${img}" alt="${title}" width="42" height="60" decoding="async" loading="lazy" data-fallback-catalog="1">
                </a>
                <div class="row-info">
                    <div class="row-title">${title}</div>
                    <div class="row-desc"><span class="row-cat">${cat}</span>${renderGenres(entry.info)}</div>
                    ${badges ? `<div class="row-status">${badges}</div>` : ''}
                    ${prog}
                </div>
                <div class="row-eps">
                    <div>${escapeHtml(String(entry.total || entry.episodes || entry.chapters || entry.volumes || '?'))}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">${epsLabel}</div>
                </div>
            </article>
        `;
    }).join('');
}

// Totales por categoría de la columna lateral ("En números"): cuenta todo lo
// que está en alguna lista (Me gusta, Visto o un estado de seguimiento).
function updateCategoryCards() {
    const user = getCurrentUserIdSafe();
    const catCounts = { anime: 0, manga: 0, novelas: 0 };
    if (user !== 'Invitado') {
        getAllItems().forEach(item => {
            const cat = item.__category;
            if (catCounts[cat] == null) return;
            if (matchesFilter(getUserItemState(user, item), LIST_FILTERS.ALL)) catCounts[cat]++;
        });
    }
    const setE = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setE('countAnime', catCounts.anime);
    setE('countManga', catCounts.manga);
    setE('countNovelas', catCounts.novelas);
}

// Pinta una lista de barras horizontales (género/tipo/estado). Cada fila:
// etiqueta, barra proporcional al máximo y valor. Puro CSS, sin librerías.
function renderBarChart(title, rows, accent) {
    if (!rows.length) return '';
    const max = Math.max.apply(null, rows.map(r => r.value)) || 1;
    const bars = rows.map(r => {
        const pct = Math.max(4, Math.round((r.value / max) * 100));
        const color = r.color || accent || '#bc13fe';
        return `
        <div class="stat-bar-row">
            <span class="stat-bar-label">${escapeHtml(String(r.label))}</span>
            <span class="stat-bar-track"><span class="stat-bar-fill" style="width:${pct}%;background:${color}"></span></span>
            <span class="stat-bar-value">${r.value}</span>
        </div>`;
    }).join('');
    return `
    <section class="stat-chart-card">
        <h3 class="stat-chart-title">${escapeHtml(title)}</h3>
        <div class="stat-bars">${bars}</div>
    </section>`;
}

function renderStats() {
    const host = document.getElementById('statsGrid');
    const charts = document.getElementById('statsCharts');
    if (!host) return;
    const user = getCurrentUserIdSafe();
    if (user === 'Invitado') {
        host.innerHTML = '<div class="lists-empty" style="grid-column:1/-1"><h3>Sin datos</h3><p class="stat-label">Iniciá sesión para ver estadísticas.</p></div>';
        if (charts) charts.innerHTML = '';
        return;
    }

    let totalFav = 0, totalViewed = 0, byCategory = {};
    const genreCounts = {};
    const statusCounts = { viendo: 0, pendiente: 0, pausado: 0, abandonado: 0 };
    let totalEnListas = 0;

    getAllItems().forEach(item => {
        const cat = item.__category;
        if (!byCategory[cat]) byCategory[cat] = { count: 0 };
        const st = getUserItemState(user, item);
        const enLista = st.fav || st.viewed || st.wstatus;
        if (enLista) { byCategory[cat].count++; totalEnListas++; }
        if (st.fav)    totalFav++;
        if (st.viewed) totalViewed++;
        if (st.wstatus && statusCounts[st.wstatus] != null) statusCounts[st.wstatus]++;
        // Géneros: solo de lo que está en alguna lista, para reflejar gustos.
        if (enLista) {
            extractGenresFromInfo(item.info).forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
        }
    });

    const pts = Number(UserStore.getItem(`u:${user}|points`) || 0);

    const statItems = [
        { label: 'En tus listas', value: totalEnListas, icon: '📚', color: '#a855f7' },
        { label: 'Total Me gusta', value: totalFav, icon: '❤', color: '#bc13fe' },
        { label: 'Total Vistos', value: totalViewed, icon: '👁', color: '#00f2ff' },
        { label: 'Puntos acumulados', value: pts, icon: '⭐', color: '#f59e0b' }
    ];

    host.innerHTML = statItems.map(s => `
        <div class="stat-card">
            <div class="stat-icon">${s.icon}</div>
            <div>
                <div class="stat-value" style="color:${s.color}">${s.value}</div>
                <div class="stat-label">${escapeHtml(s.label)}</div>
            </div>
        </div>
    `).join('');

    if (!charts) return;

    // ── Top géneros (barras) ──
    const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value }));

    // ── Distribución por tipo ──
    const catColors = { anime: '#00f2ff', manga: '#bc13fe', novelas: '#f59e0b' };
    const catRows = Object.entries(byCategory)
        .filter(([, c]) => c.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([cat, c]) => ({
            label: CATEGORY_LABELS[cat] || cat,
            value: c.count,
            color: catColors[cat] || '#a855f7'
        }));

    // ── Estados de seguimiento ──
    const statusRows = [
        { key: 'viendo', label: 'Viendo' },
        { key: 'pendiente', label: 'Pendiente' },
        { key: 'pausado', label: 'En pausa' },
        { key: 'abandonado', label: 'Abandonado' }
    ].filter(s => statusCounts[s.key] > 0)
     .map(s => ({
        label: s.label,
        value: statusCounts[s.key],
        color: (WSTATUS_BADGES[s.key] && WSTATUS_BADGES[s.key].color) || '#94a3b8'
     }));

    const chartsHtml =
        renderBarChart('Tus géneros favoritos', topGenres, '#bc13fe') +
        renderBarChart('Distribución por tipo', catRows, '#00f2ff') +
        renderBarChart('Estados de seguimiento', statusRows, '#4d86ff');

    charts.innerHTML = chartsHtml ||
        '<p class="stat-label" style="text-align:center;padding:20px 0">Marcá contenido en tus listas para ver tu perfil de gustos.</p>';
}

// ─── Recomendaciones reales basadas en los géneros que mirás ───
let _recsSignature = null;

function recsMessage(text) {
    return '<p style="color:rgba(255,255,255,0.4);font-family:Rajdhani,sans-serif;text-align:center;grid-column:1/-1;padding:40px 0">' + escapeHtml(text) + '</p>';
}

async function renderRecommendations() {
    const grid = document.getElementById('recommendGrid');
    if (!grid) return;

    const subEl = document.querySelector('[data-i18n="lists.recommend.subtitulo"]');
    const setSub = function (txt) { if (subEl) subEl.textContent = txt; };

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        _recsSignature = null;
        setSub('Iniciá sesión para recibir recomendaciones.');
        grid.innerHTML = recsMessage('Iniciá sesión para ver recomendaciones personalizadas.');
        return;
    }

    // Perfil de gustos: ítems con "Visto", "Me gusta" o estado de seguimiento
    const profileEntries = getAllItems()
        .map(function (item) { return getUserItemState(userId, item); })
        .filter(function (e) { return e.viewed || e.fav || e.wstatus; });

    if (!profileEntries.length) {
        _recsSignature = null;
        setSub('Marcá algo como "Visto" o "Me gusta" para recibir recomendaciones.');
        grid.innerHTML = recsMessage('Agregá contenido a tus listas para ver recomendaciones.');
        return;
    }

    const topGenres = topGenresFromEntries(profileEntries).slice(0, 3);

    // Categoría preferida = la más marcada
    const catCount = {};
    profileEntries.forEach(function (e) {
        const c = e.item.__category;
        if (c) catCount[c] = (catCount[c] || 0) + 1;
    });
    const preferredCat = Object.keys(catCount)
        .sort(function (a, b) { return catCount[b] - catCount[a]; })[0] || 'anime';

    // Evitar re-fetch si nada cambió
    const signature = preferredCat + '|' + topGenres.join(',') + '|' + profileEntries.length;
    if (_recsSignature === signature && grid.children.length) return;
    _recsSignature = signature;

    setSub(topGenres.length
        ? 'Basado en tus gustos: ' + topGenres.join(', ') + '.'
        : 'Basado en lo que marcaste.');
    grid.innerHTML = recsMessage('Buscando recomendaciones...');

    const fetchers = {
        anime: window.getTopAnimes,
        manga: window.getTopMangas,
        novelas: window.getTopNovelas
    };
    const fetcher = fetchers[preferredCat] || window.getTopAnimes;
    if (typeof fetcher !== 'function') {
        grid.innerHTML = recsMessage('No se pudo cargar el catálogo de recomendaciones.');
        return;
    }

    const savedIds = new Set(getAllItems().map(function (i) { return String(i.id); }));
    const max = AnimeDestiny.Constants.MAX_RECOMMENDATIONS || 10;

    try {
        const results = await fetcher(1, topGenres.length ? { genres: topGenres } : {});
        const recs = (Array.isArray(results) ? results : [])
            .filter(function (r) { return !savedIds.has(String(r.id != null ? r.id : r.mal_id)); })
            .slice(0, max);

        if (_recsSignature !== signature) return; // otra llamada la reemplazó

        if (!recs.length) {
            grid.innerHTML = recsMessage('No encontramos títulos nuevos para recomendarte por ahora.');
            return;
        }

        grid.innerHTML = recs.map(function (r) {
            const img = (r.images && (
                (r.images.webp && (r.images.webp.large_image_url || r.images.webp.image_url)) ||
                (r.images.jpg && (r.images.jpg.large_image_url || r.images.jpg.image_url))
            )) || r.img || '';
            return renderMediaCard({
                item: {
                    id: r.id != null ? r.id : r.mal_id,
                    titulo: r.title || r.titulo || '',
                    img: img,
                    info: (r.genres || []).map(function (g) { return g.name || g; }).join('|'),
                    __category: preferredCat
                },
                match: topGenres[0] || ''
            });
        }).join('');

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (e) {
        console.warn('renderRecommendations error:', e);
        if (_recsSignature === signature) {
            grid.innerHTML = recsMessage('No se pudieron cargar las recomendaciones. Probá de nuevo en unos segundos.');
        }
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

    try {
        if (typeof client.loadApodo === 'function') {
            const apodo = await client.loadApodo();
            if (apodo) UserStore.setItem('u:' + userId + '|apodo', String(apodo));
        }
    } catch (err) {
        console.warn('[mis-listas] Error cargando apodo desde Supabase:', err);
    }
}

// ─── Reparación de portadas guardadas sin URL ───────────────────────────
// Metadatos viejos guardaban el id del item (o vacío) en vez de la URL de la
// portada, así que en la lista salía el poster de respaldo (el degradado con
// solo el título). Al cargar, se detectan esos ítems, se piden las portadas a
// AniList por lote y se persiste la URL correcta (UserStore + Supabase) para
// que no vuelva a pasar. Es idempotente: una vez reparados no hay más ítems
// rotos, así que no dispara pedidos en las siguientes cargas.
function _esPortadaRota(img) {
    const s = String(img || '').trim();
    if (!s) return true;                       // sin imagen
    if (/^https?:\/\//i.test(s)) return false; // URL remota válida
    if (/^data:image\//i.test(s)) return false;// data URI de imagen
    if (s.indexOf('/') !== -1) return false;   // ruta relativa (images/...)
    return true;                               // p.ej. "16498" (el id) → roto
}

async function repararPortadasFaltantes() {
    if (typeof window.getCoversByIds !== 'function') return;
    const userId = getCurrentUserIdSafe();
    if (!userId || userId === 'Invitado') return;

    const rotos = getAllItems().filter((it) => _esPortadaRota(it.img) && Number(it.id) > 0);
    if (!rotos.length) return;

    const covers = await window.getCoversByIds(rotos.map((it) => Number(it.id)));
    if (!covers || !Object.keys(covers).length) return;

    let cambiados = 0;
    rotos.forEach((it) => {
        const url = covers[String(it.id)];
        if (!url) return;

        // 1) Metadatos locales
        const metaKey = 'u:' + userId + '|itemMeta:' + it.id;
        let meta = {};
        try { const raw = UserStore.getItem(metaKey); if (raw) meta = JSON.parse(raw) || {}; } catch (e) { meta = {}; }
        meta.id = String(it.id);
        meta.img = url;
        if (!meta.__category && it.__category) meta.__category = it.__category;
        if (!meta.titulo && it.titulo) meta.titulo = it.titulo;
        UserStore.setItem(metaKey, JSON.stringify(meta));

        // 2) Estados remotos en memoria (getAllItems los prioriza)
        _remoteItemStates.forEach((st) => {
            if (String(st.item_id) === String(it.id)) {
                st.meta = st.meta || {};
                st.meta.img = url;
            }
        });

        // 3) Persistir a Supabase para que la corrección quede guardada
        if (typeof window.syncItemStateToSupabase === 'function') {
            const state = getUserItemState(userId, it);
            window.syncItemStateToSupabase(
                it.__category || meta.__category || 'listas',
                String(it.id),
                state.fav,
                state.viewed,
                meta,
                state.wstatus
            );
        }
        cambiados++;
    });

    if (cambiados) {
        try { render(filterModeState); } catch (e) { console.warn('Re-render tras reparar portadas falló:', e); }
        try { renderActividad(); } catch (e) {}
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const renderCurrentFilter = bindControls();

    function renderAll() {
        renderProfileSummary();
        renderPoints();
        renderAchievements();
        renderApodos();
        renderCurrentFilter();
        renderContinue();
        renderWeek();
        renderRecommendations();
        renderActividad();
        updateCategoryCards();
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

    // Pestañas de sección (barra superior)
    function openTab(tabId) {
        const activeTab = document.getElementById('tab-' + tabId);
        if (!activeTab) return false;
        document.querySelectorAll('.sidebar-link').forEach(l => {
            const on = l.getAttribute('data-tab') === tabId;
            l.classList.toggle('active', on);
            if (on) l.setAttribute('aria-current', 'page');
            else l.removeAttribute('aria-current');
        });
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc === activeTab));
        if (tabId === 'calendario') renderCalendario();
        return true;
    }
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            if (tabId) openTab(tabId);
        });
    });
    // Accesos desde la columna lateral ("Calendario", "Ver logros"...)
    document.querySelectorAll('[data-goto-tab]').forEach(link => {
        link.addEventListener('click', (e) => {
            if (!openTab(link.getAttribute('data-goto-tab'))) return;
            e.preventDefault();
            history.replaceState(null, '', '#' + link.getAttribute('data-goto-tab'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    // Entrar directo a una sección con el hash (mis-listas.html#logros)
    if (location.hash.length > 1) openTab(location.hash.slice(1));

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
            document.querySelectorAll('.res-tab').forEach(t => t.setAttribute('aria-pressed', String(t === tab)));
            currentCatFilter = tab.dataset.cat || 'all';
            render(filterModeState);
        });
    });
});



