// js/pages/mis-listas-calendario.js
// Calendario de emisión (pestaña "Calendario"): próximos episodios de
// los animes que el usuario está viendo o tiene pendientes.
// Extraído de mis-listas.js. Ámbito global (script clásico con defer), igual
// que mis-listas.js: comparte sus constantes y estado (_sessionUser, etc.) y
// sus funciones se llaman recién en DOMContentLoaded, con todo ya cargado.

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
