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
 * worker. Todo se deduplica por día en localStorage para no repetir.
 *
 * Best-effort: sin sesión, sin API o sin datos, no hace nada.
 */
(function (window) {
    'use strict';

    var DAY_MS = 86400000;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno */ } }

    function today() { return new Date().toISOString().split('T')[0]; }

    function signedInUserId() {
        var c = window.AppSupabase;
        var u = c && typeof c.getCurrentUserSync === 'function' ? c.getCurrentUserSync() : null;
        return u ? u.id : null;
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
                    icon: '/images/icon-192.png',
                    badge: '/images/icon-192.png',
                    tag: url || 'anime-destiny-reminder',
                    data: { url: url || '/index.html' }
                });
            }).catch(function () { /* SW no listo */ });
        } catch (_) { /* navegador sin soporte */ }
    }

    function toast(kind, msg) {
        if (window.Toast && typeof window.Toast[kind] === 'function') window.Toast[kind](msg);
    }

    // Ids de anime que el usuario sigue (fav / visto / viendo).
    async function followedAnimeIds() {
        var c = window.AppSupabase;
        if (!c || !c.isSignedIn || !c.isSignedIn() || !c.loadItemStates) return [];
        try {
            var states = await c.loadItemStates('anime');
            return (Array.isArray(states) ? states : [])
                .filter(function (st) { return st.fav || st.viewed || st.watch_status === 'viendo'; })
                .map(function (st) { return st.item_id; });
        } catch (e) {
            console.warn('[reminders] followed:', e);
            return [];
        }
    }

    // Episodios de la lista del usuario que salen hoy (o salieron en las últimas
    // horas). Deduplica por (id, episodio) y día.
    async function checkEpisodes(userId) {
        if (typeof window.getAiringSchedule !== 'function') return;
        var ids = await followedAnimeIds();
        if (!ids.length) return;

        var schedule = [];
        try {
            schedule = await window.getAiringSchedule(ids) || [];
        } catch (e) {
            console.warn('[reminders] airing:', e);
            return;
        }

        var now = Date.now();
        schedule.forEach(function (item) {
            if (!item || !item.airingAt) return;
            var at = item.airingAt * 1000;
            // Ventana: desde 12 h atrás hasta 24 h adelante (lo de "hoy/inminente").
            if (at < now - 12 * 3600000 || at > now + DAY_MS) return;

            var dkey = 'ad:remind:ep:' + userId + ':' + item.id + ':' + item.episode + ':' + today();
            if (lsGet(dkey)) return;
            lsSet(dkey, '1');

            var salido = at <= now;
            var msg = salido
                ? '🔔 Nuevo episodio: ' + item.title + ' (ep. ' + item.episode + ')'
                : '📅 Hoy sale ' + item.title + ' (ep. ' + item.episode + ')';
            toast('info', msg);
            systemNotify('Anime Destiny', msg, '/detalle.html?cat=anime&id=' + item.id);
        });
    }

    // Recordatorio de racha: una sola vez por día, y solo si la racha está viva.
    function checkStreak(userId) {
        if (!window.AppStreak) return;
        var s = window.AppStreak.getStreak(userId);
        if (!s || s.count <= 0) return;

        var dkey = 'ad:remind:streak:' + userId + ':' + today();
        if (lsGet(dkey)) return;
        lsSet(dkey, '1');

        if (s.countedToday && s.count >= 3) {
            toast('success', '🔥 ¡Racha de ' + s.count + ' días! Seguí así.');
        } else if (s.atRisk) {
            var msg = '🔥 Tu racha de ' + s.count + ' días termina hoy. ¡Entrá para no perderla!';
            toast('info', msg);
            systemNotify('Anime Destiny', msg, '/index.html');
        }
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

    window.AppReminders = Object.freeze({ run: run, _checkStreak: checkStreak });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
