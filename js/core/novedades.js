/**
 * novedades.js — "Novedades para vos" (window.AppNovedades).
 *
 * Sección personalizada para la home (o el calendario): episodios nuevos de los
 * animes que el usuario sigue y estrenos de la temporada que encajan con los
 * géneros de sus listas. El host (`<section id="homeNovedades" hidden>`) lo pone
 * la página; este módulo lo rellena y le quita el `hidden` solo si hay algo.
 *
 *   AppNovedades.render(hostElement) → Promise<boolean>  (true si pintó algo)
 *
 * Datos:
 *   - Seguidos: AppSupabase.loadItemStates('') (fav / visto / viendo / pendiente,
 *     sin "abandonado").
 *   - Episodios: getAiringSchedule(ids) de js/core/api.js. AniList solo da el
 *     PRÓXIMO episodio (nextAiringEpisode); el anterior se infiere: si el ep. N
 *     sale dentro de 7 días, el N-1 ya salió (cadencia semanal). Si el usuario
 *     ya marcó ese episodio en su progreso, no se muestra como novedad.
 *   - Estrenos: getTopAnimes(1, { browse: 'temporada', genres }) con los géneros
 *     que más pesan en sus listas, sin lo que ya tiene marcado.
 *
 * Las respuestas de AniList se cachean en sessionStorage 1 hora. La lista final
 * se rearma en cada visita con el estado actual (así lo que el usuario marca
 * desaparece enseguida sin volver a pegarle a AniList).
 *
 * Best-effort: sin sesión, sin seguidos o si falla todo, devuelve false y el
 * host queda oculto.
 */
(function (window) {
    'use strict';

    var DAY_S = 86400;
    var WINDOW_S = 7 * DAY_S;
    var CACHE_TTL_MS = 3600 * 1000;
    var CACHE_PREFIX = 'novedades:v1:';
    var MAX_EPISODIOS = 12;
    var MAX_ESTRENOS = 10;
    var MAX_GENEROS = 3;
    // Géneros que no dicen nada del gusto (mismo criterio que inicio.js).
    var GENRE_STOP = { 'Comedy': 1, 'Drama': 1, 'Slice of Life': 1 };
    var FALLBACK_OFICIALES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
        'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
        'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];

    // ── Utilidades ───────────────────────────────────────────────────────
    var FALLBACK_TEXT = {
        'novedades.titulo': 'Novedades para vos',
        'novedades.episodios': 'Episodios nuevos',
        'novedades.estrenos': 'Estrenos de la temporada',
        'novedades.motivo.salio': 'Ya salió el ep. {ep}',
        'novedades.motivo.sale_hoy': 'Ep. {ep} sale hoy',
        'novedades.motivo.sale': 'Ep. {ep} sale el {dia}',
        'novedades.motivo.genero': 'Estreno · {generos}',
        'novedades.badge.nuevo': 'Nuevo',
        'novedades.badge.pronto': 'Pronto',
        'novedades.badge.estreno': 'Estreno'
    };

    function t(key, args) {
        var i18n = window.AppI18n;
        var text = null;
        if (i18n && typeof i18n.t === 'function') {
            text = i18n.t(key, args);
            if (typeof text === 'string' && text.charAt(0) === '[') text = null;
        }
        if (text == null) {
            text = (FALLBACK_TEXT[key] || key).replace(/\{(\w+)\}/g, function (m, k) {
                return args && args[k] != null ? String(args[k]) : m;
            });
        }
        return text;
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function detailUrl(cat, id) {
        return 'detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(id);
    }

    function oficiales() {
        var g = window.AnimeDestiny && window.AnimeDestiny.Genres;
        return (g && Array.isArray(g.OFICIALES)) ? g.OFICIALES : FALLBACK_OFICIALES;
    }

    function genreLabel(name) {
        var g = window.AnimeDestiny && window.AnimeDestiny.Genres;
        try { if (g && typeof g.etiqueta === 'function') return g.etiqueta(name) || name; } catch (_) { /* sin catálogo */ }
        return name;
    }

    function lang() {
        var i18n = window.AppI18n;
        return (i18n && typeof i18n.getLang === 'function' && i18n.getLang() === 'en') ? 'en' : 'es-AR';
    }

    function dayLabel(epochS) {
        try {
            return new Date(epochS * 1000).toLocaleDateString(lang(), { weekday: 'long', day: 'numeric' });
        } catch (_) {
            return new Date(epochS * 1000).toDateString();
        }
    }

    function sameLocalDay(aS, bS) {
        return new Date(aS * 1000).toDateString() === new Date(bS * 1000).toDateString();
    }

    function ssGet(k) {
        try { var raw = sessionStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
    }
    function ssSet(k, v) {
        try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* lleno o bloqueado */ }
    }

    // ── Armado de la lista (puro, sin red ni DOM: lo cubre el test) ──────

    function isFollowed(st) {
        if (!st || st.watch_status === 'abandonado') return false;
        return !!(st.fav || st.viewed || st.watch_status === 'viendo' || st.watch_status === 'pendiente');
    }

    function followedAnimeIds(states) {
        var seen = {};
        var out = [];
        (states || []).forEach(function (st) {
            if (!st || String(st.category || '') !== 'anime' || !isFollowed(st)) return;
            var id = Number(st.item_id);
            if (!Number.isFinite(id) || id <= 0 || seen[id]) return;
            seen[id] = 1;
            out.push(id);
        });
        return out;
    }

    // Géneros oficiales de AniList más frecuentes en las listas (cualquier
    // categoría). "Visto" y "Me gusta" pesan el doble que lo pendiente.
    function topGenres(states, max) {
        var known = {};
        oficiales().forEach(function (g) { known[g.toLowerCase()] = g; });
        var counts = {};
        (states || []).forEach(function (st) {
            if (!st || st.watch_status === 'abandonado') return;
            var info = st.meta && st.meta.info;
            if (!info) return;
            var w = (st.viewed || st.fav) ? 2 : 1;
            String(info).split(/[|/,]/).forEach(function (raw) {
                var g = known[raw.trim().toLowerCase()];
                if (!g || GENRE_STOP[g]) return;
                counts[g] = (counts[g] || 0) + w;
            });
        });
        return Object.keys(counts)
            .sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); })
            .slice(0, max || MAX_GENEROS);
    }

    // Episodio más alto marcado por título: progress_keys usa "s:N|ep:M".
    function watchedEpisodes(progress) {
        var out = {};
        (progress || []).forEach(function (row) {
            if (!row || !row.value || String(row.category || '') !== 'anime') return;
            var m = String(row.pkey || '').match(/ep:(\d+)$/);
            if (!m) return;
            var id = String(row.item_id);
            var ep = Number(m[1]);
            if (!out[id] || ep > out[id]) out[id] = ep;
        });
        return out;
    }

    /**
     * Arma las dos listas.
     * @param {object} d
     *   d.states    loadItemStates('')
     *   d.progress  loadAllProgress() (opcional)
     *   d.schedule  getAiringSchedule(ids): [{ id, title, img, episode, airingAt }]
     *   d.seasonal  getTopAnimes(...temporada): items normalizados de api.js
     *   d.now       epoch en segundos (opcional; por defecto ahora)
     * @returns {{ episodios: Array, estrenos: Array }}
     *   Cada ítem: { id, cat, title, img, date, kind, episode?, reason, badge }
     */
    function build(d) {
        d = d || {};
        var now = Number(d.now) || Math.floor(Date.now() / 1000);
        var states = Array.isArray(d.states) ? d.states : [];
        var followed = {};
        followedAnimeIds(states).forEach(function (id) { followed[id] = 1; });
        var watched = watchedEpisodes(d.progress);

        // 1. Episodios. Dedupe por título (gana el airingAt más cercano).
        var byId = {};
        (Array.isArray(d.schedule) ? d.schedule : []).forEach(function (row) {
            var id = Number(row && row.id);
            var at = Number(row && row.airingAt);
            var ep = Number(row && row.episode) || 0;
            if (!followed[id] || !at || !ep) return;
            if (at < now - WINDOW_S || at > now + WINDOW_S) return;
            var prev = byId[id];
            if (!prev || at < prev.airingAt) byId[id] = { id: id, title: row.title, img: row.img, episode: ep, airingAt: at };
        });

        var aired = [];
        var upcoming = [];
        Object.keys(byId).forEach(function (k) {
            var r = byId[k];
            var seenUpTo = watched[String(r.id)] || 0;
            var base = { id: r.id, cat: 'anime', title: r.title || '', img: r.img || '' };

            if (r.airingAt <= now) {
                // Dato ya vencido del caché: el ep. N salió.
                if (seenUpTo >= r.episode) return;
                aired.push(Object.assign(base, {
                    kind: 'aired', episode: r.episode, date: r.airingAt,
                    reason: t('novedades.motivo.salio', { ep: r.episode }), badge: t('novedades.badge.nuevo')
                }));
                return;
            }
            // Sale el ep. N; el N-1 salió hace ~7 días (cadencia semanal).
            var prevEp = r.episode - 1;
            if (prevEp >= 1 && seenUpTo < prevEp) {
                aired.push(Object.assign(base, {
                    kind: 'aired', episode: prevEp, date: r.airingAt - WINDOW_S,
                    reason: t('novedades.motivo.salio', { ep: prevEp }), badge: t('novedades.badge.nuevo')
                }));
                return;
            }
            upcoming.push(Object.assign(base, {
                kind: 'upcoming', episode: r.episode, date: r.airingAt,
                reason: sameLocalDay(r.airingAt, now)
                    ? t('novedades.motivo.sale_hoy', { ep: r.episode })
                    : t('novedades.motivo.sale', { ep: r.episode, dia: dayLabel(r.airingAt) }),
                badge: t('novedades.badge.pronto')
            }));
        });
        // Lo ya salido primero (lo más reciente arriba), después lo que viene
        // (lo más próximo arriba).
        aired.sort(function (a, b) { return b.date - a.date || a.id - b.id; });
        upcoming.sort(function (a, b) { return a.date - b.date || a.id - b.id; });
        var episodios = aired.concat(upcoming).slice(0, MAX_EPISODIOS);

        // 2. Estrenos: sin nada que ya esté en alguna lista ni en Episodios.
        var owned = {};
        states.forEach(function (st) {
            if (st && String(st.category || '') === 'anime') owned[String(st.item_id)] = 1;
        });
        episodios.forEach(function (e) { owned[String(e.id)] = 1; });

        var genres = Array.isArray(d.genres) ? d.genres : topGenres(states);
        var wanted = {};
        genres.forEach(function (g, i) { wanted[g] = genres.length - i; });

        var seenSeasonal = {};
        var estrenos = [];
        (Array.isArray(d.seasonal) ? d.seasonal : []).forEach(function (m, idx) {
            var id = m && (m.id != null ? m.id : m.mal_id);
            if (id == null || owned[String(id)] || seenSeasonal[String(id)]) return;
            var names = (Array.isArray(m.genres) ? m.genres : []).map(function (g) { return g && (g.name || g); });
            var match = names.filter(function (g) { return wanted[g]; });
            if (!match.length) return;
            seenSeasonal[String(id)] = 1;
            match.sort(function (a, b) { return wanted[b] - wanted[a]; });
            var score = match.reduce(function (s, g) { return s + wanted[g]; }, 0);
            var img = (m.images && m.images.jpg && (m.images.jpg.large_image_url || m.images.jpg.image_url)) || m.img || '';
            estrenos.push({
                id: id, cat: 'anime', title: m.title || '', img: img, kind: 'season',
                date: null, score: score, order: idx,
                reason: t('novedades.motivo.genero', { generos: match.slice(0, 2).map(genreLabel).join(', ') }),
                badge: t('novedades.badge.estreno')
            });
        });
        estrenos.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
        estrenos = estrenos.slice(0, MAX_ESTRENOS);

        return { episodios: episodios, estrenos: estrenos };
    }

    // ── Red (con caché de sesión) ────────────────────────────────────────

    function signedInUser() {
        var c = window.AppSupabase;
        if (!c || typeof c.isSignedIn !== 'function' || !c.isSignedIn()) return null;
        var u = typeof c.getCurrentUserSync === 'function' ? c.getCurrentUserSync() : null;
        return u && u.id ? u : null;
    }

    async function fetchRemote(userId, ids, genres) {
        var key = CACHE_PREFIX + userId;
        var sig = ids.slice().sort(function (a, b) { return a - b; }).join(',') + '|' + genres.join(',');
        var cached = ssGet(key);
        if (cached && cached.sig === sig && Date.now() - Number(cached.at) < CACHE_TTL_MS) return cached;

        var tasks = [
            typeof window.getAiringSchedule === 'function'
                ? window.getAiringSchedule(ids).catch(function () { return null; })
                : Promise.resolve([]),
            (genres.length && typeof window.getTopAnimes === 'function')
                ? window.getTopAnimes(1, { browse: 'temporada', genres: genres }).catch(function () { return null; })
                : Promise.resolve([])
        ];
        var res = await Promise.all(tasks);
        var out = {
            at: Date.now(), sig: sig,
            schedule: Array.isArray(res[0]) ? res[0] : [],
            // Solo lo que usa build(): achica lo que va a sessionStorage.
            seasonal: (Array.isArray(res[1]) ? res[1] : []).map(function (m) {
                return {
                    id: m.id != null ? m.id : m.mal_id,
                    title: m.title || '',
                    img: (m.images && m.images.jpg && (m.images.jpg.large_image_url || m.images.jpg.image_url)) || '',
                    genres: (m.genres || []).map(function (g) { return g && (g.name || g); })
                };
            })
        };
        // No se cachea un fallo: getAiringSchedule devuelve [] si AniList cae y
        // se reintenta en la próxima visita.
        if (res[0] !== null && res[1] !== null) ssSet(key, out);
        return out;
    }

    // ── Render ───────────────────────────────────────────────────────────

    function cardHtml(item) {
        var imgTag = item.img
            ? '<img loading="lazy" src="' + esc(item.img) + '" alt="" data-title="' + esc(item.title) + '" data-fallback-catalog="1">'
            : '<span class="wcard-empty" aria-hidden="true">' + esc(String(item.title || '?').charAt(0)) + '</span>';
        return '<a class="wcard home-mini-card" href="' + esc(detailUrl(item.cat, item.id)) + '"' +
                ' title="' + esc(item.title + ' — ' + item.reason) + '">' +
                    '<span class="wcard-media">' + imgTag +
                        '<span class="wcard-pill">' + esc(item.badge) + '</span>' +
                    '</span>' +
                    '<span class="wcard-text">' +
                        '<span class="wcard-title">' + esc(item.title) + '</span>' +
                        '<span class="wcard-meta">' + esc(item.reason) + '</span>' +
                    '</span>' +
                '</a>';
    }

    function rowHtml(id, title, items) {
        if (!items.length) return '';
        return '<h3 class="home-block-title" id="' + id + '">' + esc(title) + '</h3>' +
            '<div class="home-mini-track" role="list" aria-labelledby="' + id + '">' +
                items.map(function (it) { return '<div role="listitem">' + cardHtml(it) + '</div>'; }).join('') +
            '</div>';
    }

    function paint(host, data) {
        var html = '<h2 class="home-block-title" id="homeNovedadesTitle">' + esc(t('novedades.titulo')) + '</h2>' +
            rowHtml('homeNovedadesEps', t('novedades.episodios'), data.episodios) +
            rowHtml('homeNovedadesEstrenos', t('novedades.estrenos'), data.estrenos);
        host.innerHTML = html;
        if (host.classList) host.classList.add('home-strip');
        host.setAttribute('aria-labelledby', 'homeNovedadesTitle');
        host.hidden = false;
    }

    var _pending = null;
    async function doRender(host) {
        if (!host) return false;
        if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
            try { await window.AppSupabaseReady; } catch (_) { /* sin cliente */ }
        }
        var user = signedInUser();
        var client = window.AppSupabase;
        if (!user || typeof client.loadItemStates !== 'function') return false;

        var states = [];
        var progress = [];
        try {
            var r = await Promise.all([
                client.loadItemStates(''),
                typeof client.loadAllProgress === 'function'
                    ? client.loadAllProgress().catch(function () { return []; })
                    : Promise.resolve([])
            ]);
            states = Array.isArray(r[0]) ? r[0] : [];
            progress = Array.isArray(r[1]) ? r[1] : [];
        } catch (e) {
            console.warn('[novedades] estados:', e);
            return false;
        }

        var ids = followedAnimeIds(states);
        if (!ids.length) return false;
        var genres = topGenres(states);

        var remote;
        try {
            remote = await fetchRemote(user.id, ids, genres);
        } catch (e) {
            console.warn('[novedades] AniList:', e);
            return false;
        }

        var data = build({ states: states, progress: progress, schedule: remote.schedule, seasonal: remote.seasonal, genres: genres });
        if (!data.episodios.length && !data.estrenos.length) return false;
        paint(host, data);
        return true;
    }

    function render(host) {
        // Dos llamadas seguidas sobre el mismo host comparten la misma carga.
        if (_pending && _pending.host === host) return _pending.promise;
        var p = doRender(host).catch(function (e) {
            console.warn('[novedades] render:', e);
            return false;
        }).finally(function () { if (_pending && _pending.promise === p) _pending = null; });
        _pending = { host: host, promise: p };
        return p;
    }

    window.AppNovedades = Object.freeze({
        render: render,
        _build: build,
        _topGenres: topGenres,
        _followedAnimeIds: followedAnimeIds,
        _clearCache: function () {
            try {
                Object.keys(sessionStorage).forEach(function (k) {
                    if (k.indexOf(CACHE_PREFIX) === 0) sessionStorage.removeItem(k);
                });
            } catch (_) { /* bloqueado */ }
        }
    });
})(window);
