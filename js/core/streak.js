/**
 * streak.js — Racha diaria de días activos (window.AppStreak).
 *
 * Retención: premia volver cada día. La racha sube si el usuario estuvo
 * activo AYER, se mantiene si ya contó HOY, y se reinicia a 1 si faltó uno o
 * más días. Todo vive en localStorage por usuario (los datos de racha son
 * un contador local; no necesitan viajar al servidor para funcionar).
 *
 * No otorga EXP por sí solo: devuelve cuánto subió para que quien lo llama
 * (auth.grantDailyLoginBonus) sume el bonus con addUserPoints y evite premiar
 * dos veces. Así el motor de EXP sigue centralizado.
 *
 * Claves:
 *   ad:streak:count:<uid>  → días seguidos actuales
 *   ad:streak:best:<uid>   → récord histórico
 *   ad:streak:day:<uid>    → último día contado (YYYY-MM-DD)
 */
(function (window) {
    "use strict";

    var K_COUNT = 'ad:streak:count:';
    var K_BEST  = 'ad:streak:best:';
    var K_DAY   = 'ad:streak:day:';

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno/bloqueado */ } }

    // Fecha local en YYYY-MM-DD. Local a propósito: la racha se siente por el
    // "día del usuario", no por UTC; con UTC alguien en América perdería la
    // racha a media tarde.
    function dayStr(date) {
        var d = date || new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function daysBetween(fromStr, toStr) {
        // Diferencia en días naturales entre dos YYYY-MM-DD, ignorando la hora.
        var a = new Date(fromStr + 'T00:00:00');
        var b = new Date(toStr + 'T00:00:00');
        if (isNaN(a) || isNaN(b)) return null;
        return Math.round((b - a) / 86400000);
    }

    function readNum(key, uid) {
        var n = Number(lsGet(key + uid));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    // Estado actual sin modificar nada. Devuelve además si la racha ya se contó
    // hoy y si está "en riesgo" (activa pero todavía sin contar hoy) para que la
    // UI muestre el recordatorio.
    function getStreak(uid) {
        var id = String(uid || '');
        if (!id || id === 'Invitado') {
            return { count: 0, best: 0, lastDay: null, countedToday: false, atRisk: false };
        }
        var count = readNum(K_COUNT, id);
        var best  = readNum(K_BEST, id);
        var lastDay = lsGet(K_DAY + id);
        var today = dayStr();
        var gap = lastDay ? daysBetween(lastDay, today) : null;

        // Si pasó más de un día desde la última cuenta, la racha ya está rota:
        // se refleja como 0 aunque el contador guardado siga en su último valor
        // (se normaliza al llamar a recordActivity).
        var alive = gap === 0 || gap === 1;
        return {
            count: alive ? count : 0,
            best: best,
            lastDay: lastDay,
            countedToday: gap === 0,
            atRisk: gap === 1 && count > 0
        };
    }

    // Registra actividad de hoy y actualiza la racha. Idempotente dentro del
    // mismo día. Devuelve { count, best, incremented, isNewRecord }.
    function recordActivity(uid) {
        var id = String(uid || '');
        if (!id || id === 'Invitado') {
            return { count: 0, best: 0, incremented: false, isNewRecord: false };
        }
        var today = dayStr();
        var lastDay = lsGet(K_DAY + id);
        var count = readNum(K_COUNT, id);
        var best  = readNum(K_BEST, id);

        var incremented = false;
        if (lastDay === today) {
            // Ya contó hoy: no tocar el contador.
            if (count < 1) count = 1;
        } else {
            var gap = lastDay ? daysBetween(lastDay, today) : null;
            if (gap === 1) {
                count = count + 1;   // día consecutivo
            } else {
                count = 1;           // primera vez o racha rota
            }
            incremented = true;
            lsSet(K_DAY + id, today);
            lsSet(K_COUNT + id, String(count));
        }

        var isNewRecord = false;
        if (count > best) {
            best = count;
            lsSet(K_BEST + id, String(best));
            isNewRecord = true;
        }

        return { count: count, best: best, incremented: incremented, isNewRecord: isNewRecord };
    }

    // Bonus de EXP por mantener la racha: crece con los días y se topa para que
    // no se dispare. Lo consume auth.grantDailyLoginBonus.
    function bonusForStreak(count) {
        var n = Number(count) || 0;
        if (n <= 1) return 0;
        return Math.min((n - 1) * 5, 50);
    }

    window.AppStreak = Object.freeze({
        getStreak: getStreak,
        recordActivity: recordActivity,
        bonusForStreak: bonusForStreak,
        _dayStr: dayStr // expuesto para tests
    });
})(window);
