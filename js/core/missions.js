/**
 * missions.js — Misiones diarias y semanales (window.AppMissions).
 *
 * Retención: además de la racha, cada día hay tres misiones chicas y cada
 * semana cuatro más grandes. Cumplir una da EXP (por el mismo addUserPoints de
 * siempre, así el motor de EXP sigue centralizado).
 *
 * Quien hace la acción avisa con AppMissions.track('viewed' | 'fav' |
 * 'progress' | 'share' | 'comment' | 'detail' | 'quiz_play' | 'quiz_win').
 * 'visit' lo registra este mismo archivo al detectar sesión, una vez por día.
 *
 * Todo vive en localStorage por usuario, igual que la racha: son contadores
 * locales que no necesitan viajar al servidor. Además se guarda un total por
 * mes que usa el resumen mensual de retos.html.
 *
 * Claves:
 *   ad:mis:<uid>:d:<YYYY-MM-DD>  → { counts, done } del día (se borran los viejos)
 *   ad:mis:<uid>:w:<YYYY-MM-DD>  → { counts, done } de la semana (lunes)
 *   ad:mis:<uid>:m:<YYYY-MM>     → { counts } del mes
 */
(function (window) {
    'use strict';

    var PREFIX = 'ad:mis:';

    // Diarias: 'quiz' va siempre (es el motivo para entrar cada día); las otras
    // dos salen del resto según la fecha, iguales para todos ese día.
    var DAILY_FIXED = { id: 'd_quiz', action: 'quiz_play', goal: 1, xp: 10, label: 'Jugá "Adiviná el anime"' };
    var DAILY_POOL = [
        { id: 'd_viewed', action: 'viewed', goal: 1, xp: 15, label: 'Marcá un título como visto' },
        { id: 'd_fav', action: 'fav', goal: 1, xp: 10, label: 'Agregá un favorito' },
        { id: 'd_progress', action: 'progress', goal: 3, xp: 15, label: 'Registrá 3 episodios o capítulos' },
        { id: 'd_detail', action: 'detail', goal: 3, xp: 10, label: 'Abrí 3 fichas del catálogo' },
        { id: 'd_share', action: 'share', goal: 1, xp: 15, label: 'Compartí un título' },
        { id: 'd_comment', action: 'comment', goal: 1, xp: 15, label: 'Dejá un comentario' }
    ];
    var DAILY_BONUS_XP = 20;

    var WEEKLY = [
        { id: 'w_visit', action: 'visit', goal: 5, xp: 50, label: 'Entrá 5 días distintos' },
        { id: 'w_viewed', action: 'viewed', goal: 5, xp: 60, label: 'Marcá 5 títulos como vistos' },
        { id: 'w_progress', action: 'progress', goal: 20, xp: 60, label: 'Registrá 20 episodios o capítulos' },
        { id: 'w_quiz', action: 'quiz_win', goal: 3, xp: 50, label: 'Ganá 3 veces "Adiviná el anime"' }
    ];

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno/bloqueado */ } }
    function lsRemove(k) { try { localStorage.removeItem(k); } catch (_) { /* bloqueado */ } }
    function lsKeys() {
        try {
            var out = [];
            for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
            return out;
        } catch (_) { return []; }
    }

    function readJson(k) {
        try { var v = JSON.parse(lsGet(k)); return v && typeof v === 'object' ? v : null; } catch (_) { return null; }
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    // Día local (no UTC), igual que la racha: el día es el del usuario.
    function dayStr(date) {
        var d = date || new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    // La semana se identifica por su lunes.
    function weekStr(date) {
        var d = new Date((date || new Date()).getTime());
        var dow = (d.getDay() + 6) % 7; // lunes = 0
        d.setDate(d.getDate() - dow);
        return dayStr(d);
    }

    function monthStr(date) {
        var d = date || new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    }

    // FNV-1a de 32 bits: el mismo texto da el mismo número en cualquier
    // navegador, así todos ven las mismas misiones (y el mismo anime del día).
    function hash(str) {
        var h = 0x811c9dc5;
        var s = String(str);
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    function dailyMissions(date) {
        var day = dayStr(date);
        var picks = DAILY_POOL.slice().sort(function (a, b) {
            return hash(day + ':' + b.id) - hash(day + ':' + a.id);
        }).slice(0, 2);
        return [DAILY_FIXED].concat(picks);
    }

    function currentUserId() {
        var uid = typeof window.getCurrentUserIdSafe === 'function' ? window.getCurrentUserIdSafe() : 'Invitado';
        return uid && uid !== 'Invitado' ? uid : null;
    }

    function dayKey(uid, date) { return PREFIX + uid + ':d:' + dayStr(date); }
    function weekKey(uid, date) { return PREFIX + uid + ':w:' + weekStr(date); }
    function monthKey(uid, date) { return PREFIX + uid + ':m:' + monthStr(date); }

    function readBucket(key) {
        var b = readJson(key) || {};
        return { counts: b.counts || {}, done: b.done || {} };
    }

    // Solo interesa el día de hoy: los días anteriores se borran para no
    // acumular una clave por día para siempre.
    function pruneOldDays(uid, keepKey) {
        var dayPrefix = PREFIX + uid + ':d:';
        var weekPrefix = PREFIX + uid + ':w:';
        var keepWeek = weekKey(uid);
        lsKeys().forEach(function (k) {
            if (!k) return;
            if (k.indexOf(dayPrefix) === 0 && k !== keepKey) lsRemove(k);
            if (k.indexOf(weekPrefix) === 0 && k !== keepWeek) lsRemove(k);
        });
    }

    function withProgress(list, bucket) {
        return list.map(function (m) {
            var n = Math.min(Number(bucket.counts[m.action]) || 0, m.goal);
            return {
                id: m.id, label: m.label, goal: m.goal, xp: m.xp, action: m.action,
                progress: n, done: !!bucket.done[m.id]
            };
        });
    }

    function grant(uid, xp, message) {
        if (typeof window.addUserPoints === 'function') window.addUserPoints(uid, xp);
        if (window.Toast) window.Toast.success(message + ' (+' + xp + ' EXP)', 5000);
    }

    function notify() {
        try { window.dispatchEvent(new CustomEvent('missions-updated')); } catch (_) { /* navegador viejo */ }
    }

    /**
     * Registra una acción. Devuelve las misiones cumplidas en esta llamada.
     * Sin sesión no hace nada (no hay a quién darle EXP).
     */
    function track(action, amount, date) {
        var uid = currentUserId();
        if (!uid || !action) return [];
        var n = Math.max(1, Number(amount) || 1);
        var now = date || new Date();

        var dKey = dayKey(uid, now);
        var day = readBucket(dKey);
        // "Entrar" cuenta una vez por día, no una por página abierta.
        if (action === 'visit') {
            if (day.counts.visit) return [];
            n = 1;
        }

        var wKey = weekKey(uid, now);
        var week = readBucket(wKey);
        var mKey = monthKey(uid, now);
        var month = readBucket(mKey);

        day.counts[action] = (Number(day.counts[action]) || 0) + n;
        week.counts[action] = (Number(week.counts[action]) || 0) + n;
        month.counts[action] = (Number(month.counts[action]) || 0) + n;

        var completed = [];
        function check(list, bucket) {
            list.forEach(function (m) {
                if (bucket.done[m.id] || m.action !== action) return;
                if ((Number(bucket.counts[m.action]) || 0) >= m.goal) {
                    bucket.done[m.id] = true;
                    completed.push(m);
                }
            });
        }
        var daily = dailyMissions(now);
        check(daily, day);
        check(WEEKLY, week);

        var allDaily = daily.every(function (m) { return day.done[m.id]; });
        var bonus = allDaily && !day.done.bonus;
        if (bonus) day.done.bonus = true;

        lsSet(dKey, JSON.stringify(day));
        lsSet(wKey, JSON.stringify(week));
        lsSet(mKey, JSON.stringify({ counts: month.counts }));
        pruneOldDays(uid, dKey);

        completed.forEach(function (m) { grant(uid, m.xp, 'Misión cumplida: ' + m.label); });
        if (bonus) grant(uid, DAILY_BONUS_XP, '¡Completaste todas las misiones de hoy!');
        notify();
        return completed;
    }

    function getState(date) {
        var uid = currentUserId();
        var now = date || new Date();
        var day = uid ? readBucket(dayKey(uid, now)) : { counts: {}, done: {} };
        var week = uid ? readBucket(weekKey(uid, now)) : { counts: {}, done: {} };
        return {
            signedIn: !!uid,
            daily: withProgress(dailyMissions(now), day),
            weekly: withProgress(WEEKLY, week),
            dailyBonus: { xp: DAILY_BONUS_XP, done: !!day.done.bonus }
        };
    }

    // Contadores del mes ('YYYY-MM' o Date). Para el resumen mensual.
    function getMonth(month) {
        var uid = currentUserId();
        if (!uid) return {};
        var ym = month instanceof Date ? monthStr(month) : String(month || monthStr());
        var b = readJson(PREFIX + uid + ':m:' + ym);
        return (b && b.counts) || {};
    }

    // 'visit' se registra solo, en cuanto hay sesión.
    // (track ya ignora las repeticiones del mismo día).
    function trackVisit() { track('visit'); }
    function init() {
        if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
            window.AppSupabaseReady.then(trackVisit).catch(function () { /* sin supabase */ });
        }
        window.addEventListener('supabase-auth-changed', trackVisit);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.AppMissions = Object.freeze({
        track: track,
        getState: getState,
        getMonth: getMonth,
        dailyMissions: dailyMissions,
        weekly: WEEKLY.slice(),
        dayStr: dayStr,
        weekStr: weekStr,
        monthStr: monthStr,
        hash: hash
    });
})(window);
