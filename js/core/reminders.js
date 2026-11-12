/**
 * reminders.js — Recordatorios en la app (window.AppReminders).
 *
 * Complementa al push del servidor (server/functions/notify-new-episodes), que
 * necesita clave VAPID y despliegue. Esto, en cambio, funciona 100% en el
 * cliente mientras la app está abierta: al cargar, revisa el calendario de los
 * animes que el usuario sigue y le avisa de dos cosas —
 *
 *   1. Un episodio de su lista que sale HOY (o salió en las últimas horas).
 *   2. Que su racha diaria sigue viva / en riesgo.
 *
 * El aviso es siempre un Toast (no pide permisos). Si además concedió permiso
 * de notificaciones, se emite una notificación del sistema vía el service
 * worker.
 *
 * Recordatorio por título (opt-in, botón "Avisame" del calendario):
 *   - Clave UserStore `u:<userId>|remind:<animeId>` = '1' (activo).
 *   - UserStore vive en memoria, así que la lista se persiste además en
 *     localStorage `ad:remind:titles:<userId>` (JSON array de ids) y se
 *     rehidrata al primer uso. Que esa clave exista (aunque sea `[]`) significa
 *     "la persona configuró recordatorios": desde ahí solo se avisa de los
 *     títulos activos. Si nunca configuró nada, se avisa de todo lo seguido
 *     (comportamiento anterior).
 *   - No hay tabla en Supabase para esto todavía: queda solo en el navegador.
 *
 * Deduplicación: un aviso por (usuario, anime, episodio), sin importar el día,
 * en localStorage `ad:remind:sent:<userId>` (mapa "id:ep" → timestamp, se
 * purga lo de más de 14 días).
 *
 * Preferencias: si existe window.AppNotifPrefs (js/core/notif-prefs.js) se
 * consulta isAllowed(categoría) antes de cada aviso y recordSent(categoría)
 * después. Categorías usadas: 'episodios' y 'racha'. Si no existe, se avisa
 * como siempre.
 *
 * Nada de avisos genéricos: si no hay un estreno de algo seguido (y con
 * recordatorio activo, si configuró), no hay aviso de episodios.
 *
 * Best-effort: sin sesión, sin API o sin datos, no hace nada.
 */
(function (window) {
    'use strict';

    var DAY_MS = 86400000;
    var WINDOW_BACK_MS = 12 * 3600000; // salió hace hasta 12 h
    var WINDOW_AHEAD_MS = DAY_MS;      // sale en las próximas 24 h
    var SENT_TTL_MS = 14 * DAY_MS;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno */ } }

    function today() { return new Date().toISOString().split('T')[0]; }

    function signedInUserId() {
        var c = window.AppSupabase;
        var u = c && typeof c.getCurrentUserSync === 'function' ? c.getCurrentUserSync() : null;
        return u ? u.id : null;
    }

    // ─── Preferencias de notificación (otro módulo, opcional) ───────────
    function prefsAllow(category) {
        var p = window.AppNotifPrefs;
        if (!p || typeof p.isAllowed !== 'function') return true;
        try { return !!p.isAllowed(category); } catch (_) { return true; }
    }

    function prefsRecord(category) {
        var p = window.AppNotifPrefs;
        if (!p || typeof p.recordSent !== 'function') return;
        try { p.recordSent(category); } catch (_) { /* best-effort */ }
    }

    // ─── Seguidos ───────────────────────────────────────────────────────
    // Un anime "se sigue" si es fav, visto o está en viendo / pendiente.
    function isFollowedState(st) {
        if (!st) return false;
        return !!(st.fav || st.viewed || st.watch_status === 'viendo' || st.watch_status === 'pendiente');
    }

    function followedIdsFromStates(states) {
        var set = new Set();
        (Array.isArray(states) ? states : []).forEach(function (st) {
            if (isFollowedState(st) && st.item_id != null) set.add(String(st.item_id));
        });
        return set;
    }

    // Filtra una lista de estrenos ({ id, ... }) a los que están en `ids`.
    function filterFollowed(list, ids) {
        if (!ids) return [];
        var has = typeof ids.has === 'function'
            ? function (v) { return ids.has(v); }
            : function (v) { return ids.indexOf(v) !== -1; };
        return (Array.isArray(list) ? list : []).filter(function (ep) {
            return ep && has(String(ep.id));
        });
    }

    async function followedAnimeIds() {
        var c = window.AppSupabase;
        if (!c || !c.isSignedIn || !c.isSignedIn() || !c.loadItemStates) return new Set();
        try {
            return followedIdsFromStates(await c.loadItemStates('anime'));
        } catch (e) {
            console.warn('[reminders] followed:', e);
            return new Set();
        }
    }

    // ─── Recordatorio por título ────────────────────────────────────────
    function titlesKey(userId) { return 'ad:remind:titles:' + userId; }
    function storeKey(userId, animeId) { return 'u:' + userId + '|remind:' + animeId; }

    function readTitleList(userId) {
        var raw = lsGet(titlesKey(userId));
        if (raw == null) return null;
        try {
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr.map(String) : [];
        } catch (_) { return []; }
    }

    var _hydrated = {};
    function hydrate(userId) {
        if (_hydrated[userId]) return;
        _hydrated[userId] = true;
        var list = readTitleList(userId);
        if (!list || !window.UserStore) return;
        list.forEach(function (id) { window.UserStore.setItem(storeKey(userId, id), '1'); });
    }

    function hasConfiguredTitles(userId) {
        return !!userId && readTitleList(userId) !== null;
    }

    function isTitleReminder(userId, animeId) {
        if (!userId || animeId == null) return false;
        hydrate(userId);
        if (window.UserStore && window.UserStore.getItem(storeKey(userId, animeId)) === '1') return true;
        var list = readTitleList(userId);
        return !!list && list.indexOf(String(animeId)) !== -1;
    }

    function setTitleReminder(userId, animeId, on) {
        if (!userId || animeId == null) return false;
        hydrate(userId);
        var id = String(animeId);
        var list = readTitleList(userId) || [];
        var idx = list.indexOf(id);
        if (on && idx === -1) list.push(id);
        if (!on && idx !== -1) list.splice(idx, 1);
        lsSet(titlesKey(userId), JSON.stringify(list));
        if (window.UserStore) {
            if (on) window.UserStore.setItem(storeKey(userId, id), '1');
            else window.UserStore.removeItem(storeKey(userId, id));
        }
        return !!on;
    }

    function toggleTitleReminder(userId, animeId) {
        return setTitleReminder(userId, animeId, !isTitleReminder(userId, animeId));
    }

    // Ids activos (Set de strings) o null si nunca configuró nada.
    function activeTitleIds(userId) {
        var list = readTitleList(userId);
        return list ? new Set(list) : null;
    }

    // ─── Deduplicación ──────────────────────────────────────────────────
    function sentKey(userId) { return 'ad:remind:sent:' + userId; }

    function readSent(userId) {
        try {
            var obj = JSON.parse(lsGet(sentKey(userId)) || '{}');
            return obj && typeof obj === 'object' ? obj : {};
        } catch (_) { return {}; }
    }

    function writeSent(userId, map, now) {
        var out = {};
        Object.keys(map).forEach(function (k) {
            if (now - Number(map[k]) < SENT_TTL_MS) out[k] = map[k];
        });
        lsSet(sentKey(userId), JSON.stringify(out));
    }

    /**
     * Pura (testeable): decide qué episodios avisar.
     * opts: { followedIds: Set|Array, remindIds: Set|null, sent: {}, now: ms }
     * Devuelve [{ item, key, aired }] sin repetir (id, episodio).
     */
    function selectEpisodeReminders(schedule, opts) {
        opts = opts || {};
        var now = opts.now || Date.now();
        var sent = opts.sent || {};
        var followed = filterFollowed(schedule, opts.followedIds);
        var remind = opts.remindIds; // null → sin configurar: todo lo seguido
        var seen = {};
        var out = [];
        followed.forEach(function (item) {
            if (!item.airingAt) return;
            if (remind && !remind.has(String(item.id))) return;
            var at = item.airingAt * 1000;
            if (at < now - WINDOW_BACK_MS || at > now + WINDOW_AHEAD_MS) return;
            var key = String(item.id) + ':' + item.episode;
            if (sent[key] || seen[key]) return;
            seen[key] = true;
            out.push({ item: item, key: key, aired: at <= now });
        });
        return out;
    }

    // Notificación del sistema, solo si ya hay permiso concedido (nunca lo pide
    // acá: pedir permiso sin que el usuario lo accione es mala práctica).
    function systemNotify(title, body, url) {
        try {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            if (!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.ready.then(function (reg) {
                reg.showNotification(title, {
                    body: body,
                    icon: '/images/brand/mirudoku-icon-192.png',
                    badge: '/images/brand/mirudoku-icon-192.png',
                    tag: url || 'anime-destiny-reminder',
                    data: { url: url || '/index.html' }
                });
            }).catch(function () { /* SW no listo */ });
        } catch (_) { /* navegador sin soporte */ }
    }

    function toast(kind, msg) {
        if (window.Toast && typeof window.Toast[kind] === 'function') window.Toast[kind](msg);
    }

    async function checkEpisodes(userId) {
        if (typeof window.getAiringSchedule !== 'function') return;
        var followed = await followedAnimeIds();
        if (!followed.size) return;

        var remind = activeTitleIds(userId);
        // Configuró recordatorios y no dejó ninguno activo: no hay nada que avisar.
        if (remind && !remind.size) return;

        var ids = Array.from(followed).filter(function (id) { return !remind || remind.has(id); });
        if (!ids.length) return;

        var schedule = [];
        try {
            schedule = await window.getAiringSchedule(ids) || [];
        } catch (e) {
            console.warn('[reminders] airing:', e);
            return;
        }

        var now = Date.now();
        var sent = readSent(userId);
        var picks = selectEpisodeReminders(schedule, { followedIds: followed, remindIds: remind, sent: sent, now: now });
        if (!picks.length) return;

        picks.forEach(function (p) {
            if (!prefsAllow('episodios')) return;
            sent[p.key] = now;
            var item = p.item;
            var msg = p.aired
                ? '🔔 Nuevo episodio: ' + item.title + ' (ep. ' + item.episode + ')'
                : '📅 Hoy sale ' + item.title + ' (ep. ' + item.episode + ')';
            toast('info', msg);
            systemNotify('Mirudoku', msg, '/detalle.html?cat=anime&id=' + item.id);
            prefsRecord('episodios');
        });
        writeSent(userId, sent, now);
    }

    // Recordatorio de racha: una sola vez por día, y solo si la racha está viva.
    function checkStreak(userId) {
        if (!window.AppStreak) return;
        var s = window.AppStreak.getStreak(userId);
        if (!s || s.count <= 0) return;

        var dkey = 'ad:remind:streak:' + userId + ':' + today();
        if (lsGet(dkey)) return;

        var celebrate = s.countedToday && s.count >= 3;
        if (!celebrate && !s.atRisk) return;
        if (!prefsAllow('racha')) return;
        lsSet(dkey, '1');

        if (celebrate) {
            toast('success', '🔥 ¡Racha de ' + s.count + ' días! Seguí así.');
        } else {
            // Sin presión: con el día de gracia, atRisk llega recién el segundo
            // día sin actividad (daysLeft 1 = solo hoy); si algún día se avisa
            // antes (daysLeft 2), el texto dice "hoy o mañana".
            var cuando = (s.daysLeft || 1) >= 2 ? 'hoy o mañana' : 'hoy';
            var msg = '🔥 Tu racha de ' + s.count + ' días sigue viva si entrás ' + cuando + '.';
            toast('info', msg);
            systemNotify('Mirudoku', msg, '/index.html');
        }
        prefsRecord('racha');
    }

    var _ran = false;
    async function run() {
        if (_ran) return;
        var userId = signedInUserId();
        if (!userId) return;
        _ran = true;
        checkStreak(userId);
        // Los episodios pegan a la API: se difieren un momento para no competir
        // con la carga inicial de la página.
        setTimeout(function () { checkEpisodes(userId); }, 2500);
    }

    function init() {
        if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
            window.AppSupabaseReady.then(run).catch(function () {});
        }
        window.addEventListener('supabase-auth-changed', run);
    }

    window.AppReminders = Object.freeze({
        run: run,
        isFollowedState: isFollowedState,
        followedIdsFromStates: followedIdsFromStates,
        filterFollowed: filterFollowed,
        isTitleReminder: isTitleReminder,
        setTitleReminder: setTitleReminder,
        toggleTitleReminder: toggleTitleReminder,
        hasConfiguredTitles: hasConfiguredTitles,
        selectEpisodeReminders: selectEpisodeReminders,
        _checkStreak: checkStreak,
        _checkEpisodes: checkEpisodes
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
