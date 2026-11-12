/**
 * notif-prefs.js — Preferencias de avisos por categoría (window.AppNotifPrefs).
 *
 * Una sola fuente de verdad para decidir si se puede mostrar un aviso. La
 * consultan reminders.js (toasts y notificaciones del sistema) y push.js
 * (suscripción a episodios nuevos). Reglas, en este orden:
 *
 *   1. Categoría apagada  -> no ('episodios', 'racha', 'retos', 'comunidad').
 *   2. Pausa global activa (1 o 7 días) -> no.
 *   3. Silencio nocturno activo (por defecto 22 a 8, hora local) -> no.
 *   4. Límite diario alcanzado (por defecto 3 avisos entre todas) -> no.
 *
 * Quien muestra un aviso llama a recordSent(categoria) para que cuente en el
 * límite del día. Todo vive en localStorage con claves pref:notif:*; no hay
 * columna de preferencias en profiles (server/schema.sql), así que no se
 * sincroniza con la cuenta.
 *
 * Compatibilidad: antes había un único interruptor (pref:notif = 'on'/'off').
 * Si una categoría nunca se tocó y pref:notif era 'off', arranca apagada.
 *
 * Funciones que reciben `now` lo aceptan opcional (Date o ms) para los tests.
 */
(function (window) {
    'use strict';

    var DAY_MS = 86400000;
    var CATEGORIES = ['episodios', 'racha', 'retos', 'comunidad'];
    var PREFIX = 'pref:notif:';
    var LEGACY_KEY = 'pref:notif';
    var DEFAULTS = { maxPerDay: 3, quiet: false, quietStart: 22, quietEnd: 8 };
    var MAX_PER_DAY_CAP = 20;

    function lsGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (_) { /* lleno o bloqueado */ } }
    function lsDel(k) { try { window.localStorage.removeItem(k); } catch (_) { /* bloqueado */ } }

    function toDate(now) {
        if (now instanceof Date) return now;
        if (typeof now === 'number') return new Date(now);
        return new Date();
    }

    // Fecha local AAAA-MM-DD: el límite se reinicia a la medianoche de la persona.
    function dayKey(d) {
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    function isCategory(cat) { return CATEGORIES.indexOf(cat) !== -1; }

    function intIn(raw, min, max, def) {
        var n = parseInt(raw, 10);
        return (isNaN(n) || n < min || n > max) ? def : n;
    }

    function isEnabled(cat) {
        if (!isCategory(cat)) return false;
        var v = lsGet(PREFIX + cat);
        if (v === 'on') return true;
        if (v === 'off') return false;
        return lsGet(LEGACY_KEY) !== 'off';
    }

    function maxPerDay() { return intIn(lsGet(PREFIX + 'maxPerDay'), 1, MAX_PER_DAY_CAP, DEFAULTS.maxPerDay); }

    function quietConfig() {
        return {
            enabled: lsGet(PREFIX + 'quiet') === 'on',
            start: intIn(lsGet(PREFIX + 'quietStart'), 0, 23, DEFAULTS.quietStart),
            end: intIn(lsGet(PREFIX + 'quietEnd'), 0, 23, DEFAULTS.quietEnd)
        };
    }

    function pausedUntil() {
        var n = parseInt(lsGet(PREFIX + 'pauseUntil'), 10);
        return isNaN(n) ? 0 : n;
    }

    function isPaused(now) { return pausedUntil() > toDate(now).getTime(); }

    function isQuietTime(now) {
        var q = quietConfig();
        if (!q.enabled || q.start === q.end) return false;
        var h = toDate(now).getHours();
        // 22 -> 8 cruza la medianoche; 13 -> 15 no.
        return q.start > q.end ? (h >= q.start || h < q.end) : (h >= q.start && h < q.end);
    }

    function readLog(now) {
        var today = dayKey(toDate(now));
        var log = null;
        try { log = JSON.parse(lsGet(PREFIX + 'log') || 'null'); } catch (_) { log = null; }
        if (!log || log.day !== today || typeof log.count !== 'number') return { day: today, count: 0, byCat: {} };
        if (!log.byCat || typeof log.byCat !== 'object') log.byCat = {};
        return log;
    }

    function sentToday(now) { return readLog(now).count; }

    // Motivo por el que NO se puede avisar ahora, o null si se puede.
    function blockReason(cat, now) {
        if (!isCategory(cat)) return 'unknown';
        if (!isEnabled(cat)) return 'off';
        if (isPaused(now)) return 'paused';
        if (isQuietTime(now)) return 'quiet';
        if (sentToday(now) >= maxPerDay()) return 'limit';
        return null;
    }

    function isAllowed(cat, now) { return blockReason(cat, now) === null; }

    function recordSent(cat, now) {
        var log = readLog(now);
        log.count += 1;
        if (isCategory(cat)) log.byCat[cat] = (log.byCat[cat] || 0) + 1;
        lsSet(PREFIX + 'log', JSON.stringify(log));
        return log.count;
    }

    function emitChange() {
        try { window.dispatchEvent(new CustomEvent('notif-prefs-change', { detail: get() })); } catch (_) { /* sin CustomEvent */ }
    }

    // pause(1) o pause(7): días desde ahora. pause(0) reanuda.
    function pause(days, now) {
        var d = Number(days);
        if (!(d > 0)) { lsDel(PREFIX + 'pauseUntil'); emitChange(); return 0; }
        var until = toDate(now).getTime() + Math.min(d, 365) * DAY_MS;
        lsSet(PREFIX + 'pauseUntil', until);
        emitChange();
        return until;
    }

    function resume() { return pause(0); }

    function get(now) {
        var cats = {};
        CATEGORIES.forEach(function (c) { cats[c] = isEnabled(c); });
        var until = pausedUntil();
        return {
            categories: cats,
            maxPerDay: maxPerDay(),
            quiet: quietConfig(),
            pausedUntil: until > toDate(now).getTime() ? until : 0,
            sentToday: sentToday(now)
        };
    }

    // El viejo pref:notif lo sigue leyendo usuario.js para mostrar
    // "Activadas/Desactivadas": se mantiene como "alguna categoría encendida".
    function syncLegacy() {
        var any = CATEGORIES.some(isEnabled);
        lsSet(LEGACY_KEY, any ? 'on' : 'off');
    }

    // set({ categories: { racha: false }, maxPerDay: 5, quiet: { enabled, start, end } })
    function set(patch) {
        if (!patch || typeof patch !== 'object') return get();
        var cats = patch.categories || {};
        // Fijar primero todas las categorías sin tocar: si no, apagar una sola
        // con el legado en 'off' las dejaría a todas atadas a ese valor viejo.
        if (patch.categories) CATEGORIES.forEach(function (c) { lsSet(PREFIX + c, isEnabled(c) ? 'on' : 'off'); });
        Object.keys(cats).forEach(function (c) {
            if (isCategory(c)) lsSet(PREFIX + c, cats[c] ? 'on' : 'off');
        });
        if (patch.categories) syncLegacy();
        if (patch.maxPerDay != null) lsSet(PREFIX + 'maxPerDay', intIn(patch.maxPerDay, 1, MAX_PER_DAY_CAP, DEFAULTS.maxPerDay));
        var q = patch.quiet;
        if (q && typeof q === 'object') {
            if (q.enabled != null) lsSet(PREFIX + 'quiet', q.enabled ? 'on' : 'off');
            if (q.start != null) lsSet(PREFIX + 'quietStart', intIn(q.start, 0, 23, DEFAULTS.quietStart));
            if (q.end != null) lsSet(PREFIX + 'quietEnd', intIn(q.end, 0, 23, DEFAULTS.quietEnd));
        }
        emitChange();
        return get();
    }

    function setCategory(cat, on) {
        var c = {};
        c[cat] = !!on;
        return set({ categories: c });
    }

    // Claves que configuracion.js exporta y borra al restablecer.
    var KEYS = CATEGORIES.map(function (c) { return PREFIX + c; })
        .concat(['maxPerDay', 'quiet', 'quietStart', 'quietEnd', 'pauseUntil'].map(function (k) { return PREFIX + k; }));

    var api = Object.freeze({
        CATEGORIES: CATEGORIES.slice(),
        KEYS: KEYS,
        DEFAULTS: DEFAULTS,
        isAllowed: isAllowed,
        blockReason: blockReason,
        isEnabled: isEnabled,
        recordSent: recordSent,
        sentToday: sentToday,
        pause: pause,
        resume: resume,
        isPaused: isPaused,
        isQuietTime: isQuietTime,
        get: get,
        set: set,
        setCategory: setCategory
    });

    window.AppNotifPrefs = api;
    if (window.AnimeDestiny) window.AnimeDestiny.NotifPrefs = api;
})(window);
