/**
 * inicio.js — Retención en la portada.
 *
 * Tres bloques que solo aparecen para usuarios con sesión y datos:
 *   1. Widget de racha diaria (días seguidos + récord + aviso de riesgo).
 *   2. "Continuar viendo": títulos empezados y sin terminar, para retomar de
 *      una. Se derivan de los estados de item + el progreso guardado.
 *   3. "Porque viste…": recomendaciones por el género más frecuente en lo que
 *      el usuario marcó como visto/favorito.
 *
 * Todo es best-effort: si no hay sesión, si Supabase no cargó o si la API
 * falla, cada bloque se queda oculto sin romper el resto de la home.
 */
(function () {
    'use strict';

    var CONTINUE_MAX = 12;
    var RECO_MAX = 12;

    function esc(s) {
        return (window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));
    }

    function detailUrl(cat, id) {
        return 'detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(id);
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Widget de racha
    // ─────────────────────────────────────────────────────────────
    function renderStreakWidget() {
        var host = document.getElementById('streakWidget');
        if (!host) return;

        var userId = (typeof getCurrentUserIdSafe === 'function') ? getCurrentUserIdSafe() : 'Invitado';
        if (!userId || userId === 'Invitado' || !window.AppStreak) {
            host.hidden = true;
            host.innerHTML = '';
            return;
        }

        var s = window.AppStreak.getStreak(userId);
        if (!s || s.count <= 0) {
            // Sin racha viva todavía: invitación suave a empezar.
            host.hidden = false;
            host.innerHTML =
                '<div class="streak-card streak-card--start">' +
                    '<span class="streak-flame" aria-hidden="true">🔥</span>' +
                    '<div class="streak-copy">' +
                        '<strong class="streak-title">Empezá tu racha</strong>' +
                        '<span class="streak-sub">Entrá cada día y sumá EXP extra.</span>' +
                    '</div>' +
                '</div>';
            return;
        }

        var riskMsg = s.atRisk
            ? '<span class="streak-risk">¡Entrá hoy para no perderla!</span>'
            : (s.countedToday ? '<span class="streak-ok">Sumada hoy ✓</span>' : '');

        host.hidden = false;
        host.innerHTML =
            '<div class="streak-card' + (s.atRisk ? ' streak-card--risk' : '') + '">' +
                '<span class="streak-flame" aria-hidden="true">🔥</span>' +
                '<div class="streak-copy">' +
                    '<strong class="streak-title">' + s.count + (s.count === 1 ? ' día' : ' días') + ' de racha</strong>' +
                    '<span class="streak-sub">Récord: ' + s.best + (s.best === 1 ? ' día' : ' días') + '. ' + '</span>' +
                    riskMsg +
                '</div>' +
            '</div>';
    }

    // ─────────────────────────────────────────────────────────────
    // 2 + 3. Datos desde Supabase
    // ─────────────────────────────────────────────────────────────
    function cardHtml(item) {
        var img = item.img || '';
        var badge = item.badge
            ? '<span class="home-mini-badge">' + esc(item.badge) + '</span>'
            : '';
        var imgTag = img
            ? '<img class="home-mini-img" loading="lazy" src="' + esc(img) + '" alt="' + esc(item.titulo) +
              '" data-title="' + esc(item.titulo) + '" data-fallback-catalog="1">'
            : '<span class="home-mini-noimg" aria-hidden="true">🎞️</span>';

        return '<a class="home-mini-card" href="' + esc(detailUrl(item.category, item.id)) + '">' +
                    '<span class="home-mini-poster">' + imgTag + badge + '</span>' +
                    '<span class="home-mini-title">' + esc(item.titulo) + '</span>' +
                '</a>';
    }

    function fillRow(trackId, sectionId, items) {
        var track = document.getElementById(trackId);
        var section = document.getElementById(sectionId);
        if (!track || !section) return;
        if (!items.length) { section.hidden = true; return; }
        track.innerHTML = items.map(cardHtml).join('');
        section.hidden = false;
    }

    // Género más frecuente en los títulos guardados, ignorando los genéricos que
    // no dicen nada sobre el gusto del usuario.
    var GENRE_STOP = { 'Comedy': 1, 'Drama': 1, 'Slice of Life': 1 };

    function topGenreFrom(states) {
        var tally = {};
        var sampleTitle = {};
        states.forEach(function (st) {
            var info = (st.meta && st.meta.info) || '';
            if (!info) return;
            String(info).split(/[|,]/).forEach(function (raw) {
                var g = raw.trim();
                if (!g || GENRE_STOP[g]) return;
                tally[g] = (tally[g] || 0) + 1;
                if (!sampleTitle[g] && st.meta && st.meta.titulo) sampleTitle[g] = st.meta.titulo;
            });
        });
        var best = null, bestN = 0;
        Object.keys(tally).forEach(function (g) {
            if (tally[g] > bestN) { bestN = tally[g]; best = g; }
        });
        return best ? { genre: best, sample: sampleTitle[best] || '' } : null;
    }

    async function loadRecommendations(states, ownedIds) {
        var section = document.getElementById('homeReco');
        var track = document.getElementById('homeRecoTrack');
        var titleEl = document.getElementById('homeRecoTitle');
        if (!section || !track) return;

        // Solo recomienda a partir de lo que el usuario terminó o marcó fav; con
        // poca señal, no muestra nada (mejor vacío que ruido).
        var signal = states.filter(function (st) { return st.viewed || st.fav; });
        if (signal.length < 2 || typeof window.getTopAnimes !== 'function') { section.hidden = true; return; }

        var top = topGenreFrom(signal);
        if (!top) { section.hidden = true; return; }

        if (titleEl) {
            titleEl.textContent = top.sample
                ? 'Porque viste ' + top.sample
                : 'Recomendado para vos';
        }

        try {
            var list = await window.getTopAnimes(1, { genres: top.genre });
            var items = (Array.isArray(list) ? list : [])
                .filter(function (m) { return m && !ownedIds.has(String(m.id != null ? m.id : m.mal_id)); })
                .slice(0, RECO_MAX)
                .map(function (m) {
                    var id = m.id != null ? m.id : m.mal_id;
                    return {
                        id: id,
                        category: 'anime',
                        titulo: m.title || 'Sin título',
                        img: (window.getApiPoster ? window.getApiPoster(m) : '') || '',
                        badge: ''
                    };
                });
            fillRow('homeRecoTrack', 'homeReco', items);
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        } catch (e) {
            console.warn('[inicio] recomendaciones:', e);
            section.hidden = true;
        }
    }

    function buildContinueWatching(states, progressByItem) {
        var out = [];
        states.forEach(function (st) {
            var id = String(st.item_id);
            var key = (st.category || '') + '|' + id;
            var progressCount = progressByItem[key] || 0;
            var status = st.watch_status || '';

            // Está "en curso" si lo marcó como Viendo, o si tiene progreso y no
            // lo dio por terminado ni abandonado.
            var enCurso = status === 'viendo' ||
                (progressCount > 0 && !st.viewed && status !== 'abandonado' && status !== 'pausado');
            if (!enCurso) return;

            var meta = st.meta || {};
            if (!meta.titulo) return; // sin título no hay tarjeta útil

            out.push({
                id: id,
                category: st.category || 'anime',
                titulo: meta.titulo,
                img: meta.img || '',
                badge: progressCount > 0 ? (progressCount + '✓') : 'Viendo',
                _ts: st.updated_at || ''
            });
        });

        // Lo más reciente primero: es lo que el usuario probablemente quiere
        // retomar.
        out.sort(function (a, b) { return String(b._ts).localeCompare(String(a._ts)); });
        return out.slice(0, CONTINUE_MAX);
    }

    async function loadHomeData() {
        var client = window.AppSupabase;
        if (!client || !client.isSignedIn || !client.isSignedIn()) return;
        if (typeof client.loadItemStates !== 'function' || typeof client.loadAllProgress !== 'function') return;

        var states = [];
        var progress = [];
        try {
            var res = await Promise.all([client.loadItemStates(''), client.loadAllProgress()]);
            states = Array.isArray(res[0]) ? res[0] : [];
            progress = Array.isArray(res[1]) ? res[1] : [];
        } catch (e) {
            console.warn('[inicio] carga de datos de home:', e);
            return;
        }

        var progressByItem = {};
        progress.forEach(function (row) {
            if (!row || !row.value) return;
            var key = (row.category || '') + '|' + String(row.item_id);
            progressByItem[key] = (progressByItem[key] || 0) + 1;
        });

        var ownedIds = new Set();
        states.forEach(function (st) { ownedIds.add(String(st.item_id)); });

        // 2. Continuar viendo
        fillRow('continueWatchingTrack', 'continueWatchingSection', buildContinueWatching(states, progressByItem));
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

        // 3. Recomendaciones
        await loadRecommendations(states, ownedIds);
    }

    // ─────────────────────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────────────────────
    function start() {
        renderStreakWidget();
        window.addEventListener('streak-updated', renderStreakWidget);

        if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
            window.AppSupabaseReady.then(function () {
                renderStreakWidget();
                loadHomeData();
            }).catch(function () { /* sin supabase: solo carruseles públicos */ });
        }
        // La sesión puede resolverse después del ready inicial.
        window.addEventListener('supabase-auth-changed', function () {
            renderStreakWidget();
            loadHomeData();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
