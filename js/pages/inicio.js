/**
 * inicio.js — Retención en la portada.
 *
 * Tres bloques que solo aparecen para usuarios con sesión y datos:
 *   1. Widget de racha diaria (días seguidos + récord + aviso de riesgo).
 *   2. Escenario "Seguí donde lo dejaste": el título con progreso más reciente
 *      en grande, arriba de todo, y los dos siguientes al costado, cada uno con
 *      su siguiente paso concreto (Ep. N de M / Cap. N / Vol. N / "Empezar") y
 *      una acción rápida "+1" que guarda como la ficha.
 *   3. "Porque viste…": recomendaciones por el género más frecuente en lo que
 *      el usuario marcó como visto/favorito.
 *
 * Además oculta la invitación a crear cuenta (#homeJoin) cuando hay sesión.
 *
 * Todo es best-effort: si no hay sesión, si Supabase no cargó o si la API
 * falla, cada bloque se queda oculto sin romper el resto de la home.
 */
(function () {
    'use strict';

    var CONTINUE_MAX = 3; // 1 en grande + 2 al costado
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

    // Debajo de la racha: cuántas misiones de hoy van, con acceso a Retos.
    function renderMissionTeaser() {
        var host = document.getElementById('streakWidget');
        if (!host || host.hidden || !window.AppMissions) return;
        var old = host.querySelector('.streak-missions');
        if (old) old.remove();
        var s = window.AppMissions.getState();
        if (!s.signedIn) return;
        var done = s.daily.filter(function (m) { return m.done; }).length;
        var a = document.createElement('a');
        a.className = 'streak-missions';
        a.href = 'retos.html#misiones';
        a.textContent = done >= s.daily.length
            ? 'Misiones de hoy completas ✓ · Jugá el reto del día'
            : 'Misiones de hoy: ' + done + ' de ' + s.daily.length + ' · Ver retos';
        host.appendChild(a);
    }

    // ─────────────────────────────────────────────────────────────
    // 2 + 3. Datos desde Supabase
    // ─────────────────────────────────────────────────────────────
    function cardHtml(item) {
        var img = item.img || '';
        var badge = item.badge
            ? '<span class="wcard-pill home-mini-badge">' + esc(item.badge) + '</span>'
            : '';
        var imgTag = img
            ? '<img class="home-mini-img" loading="lazy" src="' + esc(img) + '" alt="' + esc(item.titulo) +
              '" data-title="' + esc(item.titulo) + '" data-fallback-catalog="1">'
            : '<span class="wcard-empty" aria-hidden="true">' + esc(String(item.titulo || '?').charAt(0)) + '</span>';

        return '<a class="wcard home-mini-card" href="' + esc(detailUrl(item.category, item.id)) + '">' +
                    '<span class="wcard-media">' + imgTag + badge + '</span>' +
                    '<span class="wcard-text"><span class="wcard-title">' + esc(item.titulo) + '</span>' +
                        (item.reason ? '<span class="wcard-reason">' + esc(item.reason) + '</span>' : '') +
                    '</span>' +
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
            var Reco = window.AppRecommend;
            var items;
            if (Reco) {
                // Motivo visible por tarjeta y exclusión de lo ya marcado / +18
                // según pref:nsfw (js/core/recommend.js).
                items = Reco.scoreCandidates(list, Reco.buildProfile(states), {
                    allowNsfw: Reco.allowNsfw(), category: 'anime', max: RECO_MAX
                }).map(function (r) {
                    var m = r.item;
                    return {
                        id: m.id != null ? m.id : m.mal_id,
                        category: 'anime',
                        titulo: m.title || 'Sin título',
                        img: (window.getApiPoster ? window.getApiPoster(m) : '') || '',
                        badge: '',
                        reason: r.reason
                    };
                });
            } else {
                items = (Array.isArray(list) ? list : [])
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
            }
            if (!items.length) { section.hidden = true; return; }
            fillRow('homeRecoTrack', 'homeReco', items);
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        } catch (e) {
            console.warn('[inicio] recomendaciones:', e);
            section.hidden = true;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // "Siguiente paso": a partir de las claves de progreso guardadas
    // (mismo formato que js/detalle/progress.js: "s:<temp>|ep:<n>" para anime,
    // "ch:<n>" / "vol:<n>" para manga y novelas) calcula qué toca ahora.
    // Función pura: la cubre tests/unit/inicio-next-step.test.js.
    // ─────────────────────────────────────────────────────────────
    function maxOf(list) {
        return list.reduce(function (m, n) { return n > m ? n : m; }, 0);
    }

    function nextStep(category, pkeys, total) {
        var cat = category === 'manga' || category === 'novelas' ? category : 'anime';
        var keys = Array.isArray(pkeys) ? pkeys.map(String) : [];
        var tot = Number(total);
        tot = Number.isFinite(tot) && tot > 0 ? Math.floor(tot) : 0;

        if (cat === 'anime') {
            var bySeason = {};
            keys.forEach(function (k) {
                var m = k.match(/^s:(\d+)\|ep:(\d+)$/);
                if (!m || Number(m[2]) <= 0) return;
                var s = Number(m[1]);
                (bySeason[s] = bySeason[s] || []).push(Number(m[2]));
            });
            var seasons = Object.keys(bySeason).map(Number);
            if (!seasons.length) {
                return { kind: 'start', unit: 'ep', season: 0, number: 1, total: tot, pkey: 's:0|ep:1', label: 'Empezar' };
            }
            var season = maxOf(seasons);
            var ep = maxOf(bySeason[season]) + 1;
            // El total guardado es el de la serie: solo lo usamos en la 1.ª temporada.
            var t = season === 0 ? tot : 0;
            if (t && ep > t) {
                return { kind: 'done', unit: 'ep', season: season, number: t, total: t, pkey: '', label: 'Al día' };
            }
            var prefix = season > 0 ? 'T' + (season + 1) + ' · ' : '';
            return {
                kind: 'next', unit: 'ep', season: season, number: ep, total: t,
                pkey: 's:' + season + '|ep:' + ep,
                label: prefix + 'Ep. ' + ep + (t ? ' de ' + t : '')
            };
        }

        var chs = [], vols = [];
        keys.forEach(function (k) {
            var m = k.match(/^(ch|vol):(\d+)$/);
            if (!m || Number(m[2]) <= 0) return;
            (m[1] === 'ch' ? chs : vols).push(Number(m[2]));
        });
        if (chs.length) {
            // Capítulos: el total guardado suele ser de volúmenes, no lo mezclamos.
            var ch = maxOf(chs) + 1;
            return { kind: 'next', unit: 'cap', season: 0, number: ch, total: 0, pkey: 'ch:' + ch, label: 'Cap. ' + ch };
        }
        if (vols.length) {
            var vol = maxOf(vols) + 1;
            if (tot && vol > tot) {
                return { kind: 'done', unit: 'vol', season: 0, number: tot, total: tot, pkey: '', label: 'Al día' };
            }
            return { kind: 'next', unit: 'vol', season: 0, number: vol, total: tot, pkey: 'vol:' + vol, label: 'Vol. ' + vol + (tot ? ' de ' + tot : '') };
        }
        // La ficha marca manga y novelas por volumen: "Empezar" = volumen 1.
        return { kind: 'start', unit: 'vol', season: 0, number: 1, total: tot, pkey: 'vol:1', label: 'Empezar' };
    }

    function tsNum(raw) {
        if (!raw) return 0;
        var n = new Date(raw).getTime();
        return Number.isFinite(n) ? n : 0;
    }

    function storeGet(key) {
        try { return window.UserStore ? window.UserStore.getItem(key) : null; } catch (e) { return null; }
    }

    function localTotal(userId, itemId) {
        try {
            var raw = storeGet('u:' + userId + '|itemMeta:' + itemId);
            var meta = raw ? JSON.parse(raw) : null;
            return Number(meta && meta.total) || 0;
        } catch (e) { return 0; }
    }

    // progressByItem: "<cat>|<id>" → { keys: [pkey...], ts: número }
    function buildContinueWatching(states, progressByItem, userId) {
        var out = [];
        states.forEach(function (st) {
            var id = String(st.item_id);
            var category = st.category || 'anime';
            var key = category + '|' + id;
            var prog = progressByItem[key] || { keys: [], ts: 0 };
            var progressCount = prog.keys.length;
            var status = st.watch_status || '';

            // Está "en curso" si lo marcó como Viendo, o si tiene progreso y no
            // lo dio por terminado ni abandonado.
            var enCurso = status === 'viendo' ||
                (progressCount > 0 && !st.viewed && status !== 'abandonado' && status !== 'pausado');
            if (!enCurso) return;

            var meta = st.meta || {};
            if (!meta.titulo) return; // sin título no hay tarjeta útil

            var total = Number(meta.total || 0) || localTotal(userId, id);
            out.push({
                id: id,
                category: category,
                titulo: meta.titulo,
                img: meta.img || '',
                keys: prog.keys.slice(),
                visto: progressCount,
                total: total,
                step: nextStep(category, prog.keys, total),
                // Último progreso primero; si nunca marcó nada, cuenta el
                // último cambio de estado.
                _ts: Math.max(prog.ts || 0,
                    tsNum(storeGet('u:' + userId + '|item:' + id + '|progressTs')),
                    tsNum(st.updated_at))
            });
        });

        out.sort(function (a, b) { return b._ts - a._ts; });
        return out;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Escenario "Seguí donde lo dejaste"
    // ─────────────────────────────────────────────────────────────
    var _continueItems = [];

    function unidad(item) {
        return item.category === 'anime' ? 'episodios' : (item.step && item.step.unit === 'cap' ? 'capítulos' : 'volúmenes');
    }

    function progresoTexto(item) {
        if (item.visto > 0 && item.total > 0 && item.step.unit !== 'cap') return item.visto + ' de ' + item.total + ' ' + unidad(item) + ' marcados';
        if (item.visto > 0) return item.visto + ' ' + unidad(item) + ' marcados';
        return 'Sin progreso marcado';
    }

    function stepTexto(item) {
        var s = item.step;
        if (s.kind === 'start') return 'Empezar';
        if (s.kind === 'done') return 'Al día';
        return 'Sigue: ' + s.label;
    }

    function plusBtnHtml(item, extraClass) {
        if (item.step.kind === 'done') return '';
        var verbo = item.category === 'anime' ? 'visto' : 'leído';
        var paso = item.step.kind === 'start' ? (item.step.unit === 'ep' ? 'Ep. 1' : 'Vol. 1') : item.step.label;
        var aria = 'Marcar ' + paso + ' de ' + item.titulo + ' como ' + verbo;
        return '<button type="button" class="home-plus' + (extraClass ? ' ' + extraClass : '') + '"' +
                   ' data-plus-cat="' + esc(item.category) + '" data-plus-id="' + esc(item.id) + '"' +
                   ' aria-label="' + esc(aria) + '">+1 ' + verbo + '</button>';
    }

    function stageSideHtml(item) {
        var img = item.img
            ? '<img src="' + esc(item.img) + '" alt="" loading="lazy">'
            : '<span aria-hidden="true">' + esc(String(item.titulo || '?').charAt(0)) + '</span>';
        return '<li class="home-stage-row"><a class="home-stage-mini" href="' + esc(detailUrl(item.category, item.id)) + '">' +
                    '<span class="home-stage-thumb">' + img + '</span>' +
                    '<span class="home-stage-mini-copy">' +
                        '<strong>' + esc(item.titulo) + '</strong>' +
                        '<span class="home-stage-next">' + esc(stepTexto(item)) + '</span>' +
                    '</span>' +
                '</a>' + plusBtnHtml(item, 'home-plus--mini') + '</li>';
    }

    function renderStage(items) {
        var host = document.getElementById('homeStage');
        if (!host) return;
        _continueItems = items || [];
        var shown = _continueItems.slice(0, CONTINUE_MAX);
        if (!shown.length) { host.hidden = true; host.innerHTML = ''; return; }

        var main = shown[0];
        var rest = shown.slice(1);
        var pct = main.total > 0 && main.step.unit !== 'cap' ? Math.min(100, Math.round(main.visto / main.total * 100)) : 0;
        var bar = pct > 0
            ? '<span class="home-stage-bar" role="img" aria-label="' + esc(progresoTexto(main)) + '">' +
                  '<span style="width:' + pct + '%"></span>' +
              '</span>'
            : '';
        var bg = main.img
            ? '<img class="home-stage-bg" src="' + esc(main.img) + '" alt="">'
            : '';
        var cta = main.step.kind === 'start'
            ? 'Empezar'
            : (main.category === 'anime' ? 'Seguir viendo' : 'Seguir leyendo');

        host.innerHTML =
            '<div class="home-stage-main">' +
                bg +
                '<div class="home-stage-copy">' +
                    '<p class="home-stage-label" id="homeStageLabel">Seguí donde lo dejaste</p>' +
                    '<h2 class="home-stage-title">' + esc(main.titulo) + '</h2>' +
                    '<p class="home-stage-step">' + esc(stepTexto(main)) + '</p>' +
                    (main.visto > 0 ? '<p class="home-stage-progress">' + esc(progresoTexto(main)) + '</p>' : '') +
                    '<div class="home-stage-actions">' +
                        '<a class="home-stage-btn" href="' + esc(detailUrl(main.category, main.id)) + '">' + cta + '</a>' +
                        plusBtnHtml(main) +
                        bar +
                    '</div>' +
                '</div>' +
            '</div>' +
            (rest.length
                ? '<div class="home-stage-side">' +
                      '<p class="home-stage-side-label">También en curso</p>' +
                      '<ul>' + rest.map(stageSideHtml).join('') + '</ul>' +
                      '<a class="home-stage-all" href="mis-listas.html">Ver todas tus listas</a>' +
                  '</div>'
                : '');
        // Si el arte no carga, queda el fondo liso en vez del ícono de imagen rota.
        host.querySelectorAll('img').forEach(function (img) {
            img.addEventListener('error', function () { img.remove(); }, { once: true });
        });
        host.hidden = false;
    }

    // ─────────────────────────────────────────────────────────────
    // Acción rápida "+1": misma ruta que la ficha (UserStore + setProgress
    // de AppSupabase con la misma pkey). Si Supabase falla, la operación queda
    // en la misma cola local que usa js/detalle/progress.js ("progressSyncQueue"),
    // que se reintenta al volver a la home, al reconectar o al abrir la ficha.
    // ─────────────────────────────────────────────────────────────
    var PROGRESS_SYNC_KEY = 'progressSyncQueue';

    function readQueue() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_SYNC_KEY)) || []; } catch (e) { return []; }
    }

    function writeQueue(q) {
        try { localStorage.setItem(PROGRESS_SYNC_KEY, JSON.stringify(q)); return true; } catch (e) { return false; }
    }

    async function drainQueue() {
        var client = window.AppSupabase;
        if (!client || typeof client.setProgress !== 'function') return;
        var queue = readQueue();
        if (!queue.length) return;
        var remaining = [];
        for (var i = 0; i < queue.length; i++) {
            var op = queue[i];
            try {
                await client.setProgress({ category: op.category, itemId: op.itemId, key: op.key, value: op.value });
            } catch (e) {
                remaining.push(op);
            }
        }
        writeQueue(remaining);
    }

    function toast(kind, msg) {
        if (window.Toast && typeof window.Toast[kind] === 'function') window.Toast[kind](msg);
    }

    function localProgressKey(userId, item, step) {
        if (item.category === 'anime') return 'u:' + userId + '|anime:' + item.id + '|s:' + step.season + '|ep:' + step.number;
        var catSingular = item.category === 'novelas' ? 'novela' : item.category;
        return 'u:' + userId + '|' + catSingular + ':' + item.id + '|' + (step.unit === 'cap' ? 'ch' : 'vol') + ':' + step.number;
    }

    async function plusOne(cat, id, btn) {
        var item = _continueItems.find(function (it) { return it.category === cat && it.id === id; });
        if (!item || !item.step || !item.step.pkey) return;
        var step = item.step;
        var userId = (typeof getCurrentUserIdSafe === 'function') ? getCurrentUserIdSafe() : 'Invitado';
        var unitName = step.unit === 'ep' ? 'Episodio' : (step.unit === 'cap' ? 'Capítulo' : 'Volumen');
        var label = unitName + ' ' + step.number;
        if (btn) btn.disabled = true;

        // Primero el estado local, igual que la ficha, para que la UI no espere.
        var nowIso = new Date().toISOString();
        try {
            if (window.UserStore) {
                window.UserStore.setItem(localProgressKey(userId, item, step), '1');
                window.UserStore.setItem('u:' + userId + '|item:' + item.id + '|progressTs', nowIso);
            }
        } catch (e) { /* sin store: seguimos con Supabase */ }

        item.keys.push(step.pkey);
        item.visto += 1;
        item.step = nextStep(item.category, item.keys, item.total);
        item._ts = Date.now();
        _continueItems.sort(function (a, b) { return b._ts - a._ts; });
        renderStage(_continueItems);

        var op = { category: item.category, itemId: item.id, key: step.pkey, value: true };
        var client = window.AppSupabase;
        try {
            if (!client || typeof client.setProgress !== 'function') throw new Error('Supabase no disponible');
            await drainQueue();
            await client.setProgress(op);
            toast('success', '¡' + label + ' marcado! 🎯');
        } catch (e) {
            console.warn('[inicio] +1 progreso:', e);
            var q = readQueue();
            q.push({ category: op.category, itemId: op.itemId, key: op.key, value: op.value, ts: Date.now() });
            writeQueue(q);
            toast('warning', label + ' guardado en este dispositivo. Se sincroniza cuando vuelva la conexión.');
        }
        try {
            window.dispatchEvent(new CustomEvent('progress-updated', { detail: { category: item.category, itemId: item.id, key: step.pkey } }));
        } catch (e) { /* noop */ }
    }

    function bindStage() {
        var host = document.getElementById('homeStage');
        if (!host || host.dataset.plusBound) return;
        host.dataset.plusBound = '1';
        host.addEventListener('click', function (e) {
            var btn = e.target instanceof Element ? e.target.closest('button.home-plus') : null;
            if (!btn || btn.disabled) return;
            e.preventDefault();
            plusOne(btn.getAttribute('data-plus-cat'), btn.getAttribute('data-plus-id'), btn);
        });
    }

    function syncJoin() {
        var join = document.getElementById('homeJoin');
        if (!join) return;
        var client = window.AppSupabase;
        join.hidden = !!(client && client.isSignedIn && client.isSignedIn());
    }

    async function loadHomeData() {
        syncJoin();
        var client = window.AppSupabase;
        if (!client || !client.isSignedIn || !client.isSignedIn()) {
            renderStage([]);
            return;
        }
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
        function addKey(cat, itemId, pkey, ts) {
            var key = (cat || '') + '|' + String(itemId);
            var entry = progressByItem[key] || (progressByItem[key] = { keys: [], ts: 0 });
            if (pkey && entry.keys.indexOf(pkey) === -1) entry.keys.push(pkey);
            if (ts > entry.ts) entry.ts = ts;
        }
        progress.forEach(function (row) {
            if (!row || !row.value) return;
            // updated_at solo llega si loadAllProgress lo selecciona.
            addKey(row.category, row.item_id, String(row.pkey || ''), tsNum(row.updated_at));
        });
        // Lo que quedó pendiente de sincronizar (+1 sin conexión) también cuenta.
        readQueue().forEach(function (op) {
            if (op && op.value) addKey(op.category, op.itemId, String(op.key || ''), Number(op.ts) || 0);
        });

        var ownedIds = new Set();
        states.forEach(function (st) { ownedIds.add(String(st.item_id)); });

        // 2. Seguí donde lo dejaste
        var userId = (typeof getCurrentUserIdSafe === 'function') ? getCurrentUserIdSafe() : 'Invitado';
        renderStage(buildContinueWatching(states, progressByItem, userId));
        drainQueue().catch(function () { /* se reintenta en la próxima carga */ });

        // 3. Recomendaciones
        await loadRecommendations(states, ownedIds);
    }

    // ─────────────────────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────────────────────
    function renderTop() {
        renderStreakWidget();
        renderMissionTeaser();
    }

    function start() {
        renderTop();
        window.addEventListener('streak-updated', renderTop);
        window.addEventListener('missions-updated', renderTop);

        if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
            window.AppSupabaseReady.then(function () {
                renderTop();
                loadHomeData();
            }).catch(function () { /* sin supabase: solo carruseles públicos */ });
        }
        // La sesión puede resolverse después del ready inicial.
        window.addEventListener('supabase-auth-changed', function () {
            renderTop();
            loadHomeData();
        });
        bindStage();
        window.addEventListener('online', function () { drainQueue().catch(function () {}); });

        // Novedades: el módulo (js/core/novedades.js) es opcional; si no está o
        // falla, el contenedor queda oculto y la home sigue.
        try {
            if (window.AppNovedades) window.AppNovedades.render(document.getElementById('homeNovedades'));
        } catch (e) {
            console.warn('[inicio] novedades:', e);
        }
    }

    // Expuesto para tests y para quien quiera reutilizar el cálculo.
    window.AppInicio = { nextStep: nextStep, buildContinueWatching: buildContinueWatching };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
