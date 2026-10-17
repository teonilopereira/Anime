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



