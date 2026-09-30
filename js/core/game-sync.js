/**
 * game-sync.js — Racha, misiones y Retos en la nube (window.AppGameSync).
 *
 * streak.js, missions.js y retos.js guardan todo en localStorage. Eso anda,
 * pero cada navegador tenía su propia racha: el celu y la compu mostraban
 * números distintos y borrar los datos del navegador se llevaba todo. Este
 * módulo copia esas claves a una fila por usuario en Supabase
 * (public.user_game_state, migración 011) y al entrar mezcla lo de la nube con
 * lo local, sin perder lo de ninguno de los dos lados.
 *
 * Los módulos siguen leyendo y escribiendo localStorage como siempre; solo
 * avisan con AppGameSync.touch() cuando cambian algo, y acá se sube con un
 * pequeño retraso. Si la tabla no existe todavía (migración sin correr) o no
 * hay sesión, no hace nada y la app funciona igual que antes.
 *
 * Reglas de mezcla (ver merge*): la racha toma el último día contado y, si el
 * otro dispositivo había contado el día anterior, continúa su cuenta; las
 * misiones toman el mayor contador y la unión de lo cumplido (así no se cobra
 * dos veces la misma EXP); el reto del día prefiere el que ya terminó.
 */
(function (window) {
    'use strict';

    var TABLE = 'user_game_state';
    var PUSH_DELAY_MS = 2500;
    var KEEP_MONTHS = 13;

    var K_STREAK = { count: 'ad:streak:count:', best: 'ad:streak:best:', day: 'ad:streak:day:' };
    var K_MIS = 'ad:mis:';
    var K_QUIZ_DAY = 'ad:quiz:day:';
    var K_QUIZ_STATS = 'ad:quiz:stats';

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno/bloqueado */ } }
    function lsKeys() {
        var out = [];
        try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (_) { /* bloqueado */ }
        return out;
    }
    function readJson(k) { try { return JSON.parse(lsGet(k)); } catch (_) { return null; } }
    function num(v) { var n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }
    function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

    function daysBetween(fromStr, toStr) {
        var a = new Date(fromStr + 'T00:00:00');
        var b = new Date(toStr + 'T00:00:00');
        if (isNaN(a) || isNaN(b)) return null;
        return Math.round((b - a) / 86400000);
    }

    // ─── Mezclas (puras, se testean aparte) ───────────────────────────────

    function mergeStreak(a, b) {
        a = isObj(a) ? a : {};
        b = isObj(b) ? b : {};
        if (!a.day) return b.day ? { count: num(b.count), best: Math.max(num(a.best), num(b.best)), day: b.day } : { count: 0, best: Math.max(num(a.best), num(b.best)), day: null };
        if (!b.day) return { count: num(a.count), best: Math.max(num(a.best), num(b.best)), day: a.day };
        var best = Math.max(num(a.best), num(b.best));
        if (a.day === b.day) {
            var c = Math.max(num(a.count), num(b.count));
            return { count: c, best: Math.max(best, c), day: a.day };
        }
        var later = a.day > b.day ? a : b;
        var earlier = later === a ? b : a;
        var count = num(later.count);
        // El dispositivo "más nuevo" empezó de cero porque no sabía que el otro
        // había contado el día anterior: la racha en realidad sigue.
        if (daysBetween(earlier.day, later.day) === 1 && count <= num(earlier.count)) {
            count = num(earlier.count) + 1;
        }
        return { count: count, best: Math.max(best, count), day: later.day };
    }

    function mergeBucket(a, b) {
        a = isObj(a) ? a : {};
        b = isObj(b) ? b : {};
        var out = { counts: {}, done: {} };
        [a.counts, b.counts].forEach(function (c) {
            if (!isObj(c)) return;
            Object.keys(c).forEach(function (k) { out.counts[k] = Math.max(out.counts[k] || 0, num(c[k])); });
        });
        [a.done, b.done].forEach(function (d) {
            if (!isObj(d)) return;
            Object.keys(d).forEach(function (k) { if (d[k]) out.done[k] = true; });
        });
        return out;
    }

    function mergeQuizDay(a, b) {
        var okA = isObj(a) && Array.isArray(a.guesses);
        var okB = isObj(b) && Array.isArray(b.guesses);
        if (!okA) return okB ? b : null;
        if (!okB) return a;
        var endA = a.status && a.status !== 'playing';
        var endB = b.status && b.status !== 'playing';
        if (endA !== endB) return endA ? a : b;
        return b.guesses.length > a.guesses.length ? b : a;
    }

    function mergeQuizStats(a, b) {
        var okA = isObj(a), okB = isObj(b);
        if (!okA) return okB ? b : null;
        if (!okB) return a;
        var pick = num(b.played) > num(a.played) ? b : a;
        var out = Object.assign({}, pick);
        out.best = Math.max(num(a.best), num(b.best));
        return out;
    }

    // Mezcla dos estados completos { streak, mis, quizDay, quizStats }.
    function mergeState(a, b) {
        a = isObj(a) ? a : {};
        b = isObj(b) ? b : {};
        var out = { v: 1, streak: mergeStreak(a.streak, b.streak), mis: {}, quizDay: {}, quizStats: mergeQuizStats(a.quizStats, b.quizStats) };
        var misKeys = {};
        [a.mis, b.mis].forEach(function (m) { if (isObj(m)) Object.keys(m).forEach(function (k) { misKeys[k] = 1; }); });
        Object.keys(misKeys).sort().forEach(function (k) {
            out.mis[k] = mergeBucket(isObj(a.mis) ? a.mis[k] : null, isObj(b.mis) ? b.mis[k] : null);
        });
        var qKeys = {};
        [a.quizDay, b.quizDay].forEach(function (q) { if (isObj(q)) Object.keys(q).forEach(function (k) { qKeys[k] = 1; }); });
        Object.keys(qKeys).sort().forEach(function (k) {
            var m = mergeQuizDay(isObj(a.quizDay) ? a.quizDay[k] : null, isObj(b.quizDay) ? b.quizDay[k] : null);
            if (m) out.quizDay[k] = m;
        });
        return prune(out);
    }

    // Recorta lo viejo para que la fila no crezca sin fin: los buckets diarios
    // y semanales solo la última semana, el reto solo el de hoy y los mensuales
    // un año (el resumen del mes los usa).
    function prune(state) {
        var now = new Date();
        var cutoffDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8);
        var cut = cutoffDay.getFullYear() + '-' + String(cutoffDay.getMonth() + 1).padStart(2, '0') + '-' + String(cutoffDay.getDate()).padStart(2, '0');
        var months = Object.keys(state.mis).filter(function (k) { return k.indexOf('m:') === 0; }).sort();
        var dropMonths = months.slice(0, Math.max(0, months.length - KEEP_MONTHS));
        Object.keys(state.mis).forEach(function (k) {
            var date = k.slice(2);
            if ((k.indexOf('d:') === 0 || k.indexOf('w:') === 0) && date < cut) delete state.mis[k];
            if (dropMonths.indexOf(k) !== -1) delete state.mis[k];
        });
        // Del reto diario solo sirve el de hoy (retos.js borra los demás).
        var today = todayStr();
        Object.keys(state.quizDay).forEach(function (k) { if (k !== today) delete state.quizDay[k]; });
        return state;
    }

    // ─── Local ↔ objeto ───────────────────────────────────────────────────

    function readLocal(uid) {
        var state = {
            v: 1,
            streak: {
                count: num(lsGet(K_STREAK.count + uid)),
                best: num(lsGet(K_STREAK.best + uid)),
                day: lsGet(K_STREAK.day + uid) || null
            },
            mis: {},
            quizDay: {},
            quizStats: readJson(K_QUIZ_STATS)
        };
        var misPrefix = K_MIS + uid + ':';
        lsKeys().forEach(function (k) {
            if (!k) return;
            if (k.indexOf(misPrefix) === 0) {
                var v = readJson(k);
                if (isObj(v)) state.mis[k.slice(misPrefix.length)] = v;
            } else if (k.indexOf(K_QUIZ_DAY) === 0) {
                var q = readJson(k);
                if (isObj(q)) state.quizDay[k.slice(K_QUIZ_DAY.length)] = q;
            }
        });
        return state;
    }

    function writeLocal(uid, state) {
        var s = state.streak || {};
        if (s.day) {
            lsSet(K_STREAK.day + uid, s.day);
            lsSet(K_STREAK.count + uid, String(num(s.count)));
        }
        if (num(s.best)) lsSet(K_STREAK.best + uid, String(num(s.best)));
        Object.keys(state.mis || {}).forEach(function (k) {
            lsSet(K_MIS + uid + ':' + k, JSON.stringify(state.mis[k]));
        });
        Object.keys(state.quizDay || {}).forEach(function (k) {
            lsSet(K_QUIZ_DAY + k, JSON.stringify(state.quizDay[k]));
        });
        if (isObj(state.quizStats)) lsSet(K_QUIZ_STATS, JSON.stringify(state.quizStats));
    }

    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // ─── Supabase ─────────────────────────────────────────────────────────

    var disabled = false;   // tabla ausente: no insistir en esta visita
    var pushTimer = null;
    var busy = null;
    var lastPushed = '';

    function currentUser() {
        var c = window.AppSupabase;
        var u = c && typeof c.getCurrentUserSync === 'function' ? c.getCurrentUserSync() : null;
        return u && u.id && c.client ? { id: u.id, client: c.client } : null;
    }

    function tableMissing(error) {
        var code = error && (error.code || '');
        var msg = String(error && error.message || '');
        return code === '42P01' || code === 'PGRST205' || /user_game_state/.test(msg) && /not find|does not exist/.test(msg);
    }

    function fetchRemote(ctx) {
        return ctx.client.from(TABLE).select('data').eq('user_id', ctx.id).maybeSingle().then(function (res) {
            if (res.error) throw res.error;
            return res.data && isObj(res.data.data) ? res.data.data : null;
        });
    }

    function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

    // Trae lo de la nube, lo mezcla con lo local, escribe lo mezclado en los
    // dos lados. Se usa al entrar y en cada subida (así una subida nunca pisa
    // lo que otro dispositivo guardó mientras tanto).
    function sync() {
        if (disabled) return Promise.resolve(false);
        var ctx = currentUser();
        if (!ctx) return Promise.resolve(false);
        if (busy) return busy;
        busy = fetchRemote(ctx).then(function (remote) {
            var local = readLocal(ctx.id);
            var merged = mergeState(local, remote);
            var localChanged = !sameJson(mergeState(local, null), merged);
            if (localChanged) {
                writeLocal(ctx.id, merged);
                announce();
            }
            var payload = JSON.stringify(merged);
            if (remote && sameJson(mergeState(remote, null), merged)) {
                lastPushed = payload;
                return true;
            }
            if (payload === lastPushed) return true;
            return ctx.client.from(TABLE)
                .upsert({ user_id: ctx.id, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
                .then(function (res) {
                    if (res.error) throw res.error;
                    lastPushed = payload;
                    return true;
                });
        }).catch(function (err) {
            if (tableMissing(err)) disabled = true;
            else console.warn('[game-sync]', err && err.message || err);
            return false;
        }).then(function (ok) {
            busy = null;
            return ok;
        });
        return busy;
    }

    function announce() {
        try {
            window.dispatchEvent(new CustomEvent('streak-updated', { detail: {} }));
            window.dispatchEvent(new CustomEvent('missions-updated'));
            window.dispatchEvent(new CustomEvent('game-sync-merged'));
        } catch (_) { /* navegador viejo */ }
    }

    // Los módulos llaman esto después de escribir. Junta varios cambios
    // seguidos en una sola subida.
    function touch() {
        if (disabled) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(sync, PUSH_DELAY_MS);
    }

    function flush() {
        if (!pushTimer) return;
        clearTimeout(pushTimer);
        pushTimer = null;
        sync();
    }

    window.AppGameSync = {
        touch: touch,
        sync: sync,
        _merge: { mergeStreak: mergeStreak, mergeBucket: mergeBucket, mergeQuizDay: mergeQuizDay, mergeQuizStats: mergeQuizStats, mergeState: mergeState }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') flush();
            else sync();
        });
        window.addEventListener('pagehide', flush);
    }
    window.addEventListener('supabase-auth-changed', function () { sync(); });
    if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
        window.AppSupabaseReady.then(function () { sync(); }).catch(function () { /* sin supabase */ });
    }
})(window);
