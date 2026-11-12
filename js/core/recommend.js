/**
 * js/core/recommend.js — Motor de recomendaciones del cliente (window.AppRecommend).
 *
 * Funciones puras (sin DOM, sin red, sin storage salvo allowNsfw()):
 *   buildProfile(entries)                 → perfil de gustos a partir de lo marcado
 *   scoreCandidates(candidates, profile, opts) → [{ item, reason, score }]
 *   reasonFromOrigin(title)               → "Porque te gustó <obra>"
 *   allowNsfw()                           → lee la preferencia pref:nsfw
 *
 * Reglas:
 *   - Se excluye todo lo que la persona ya marcó (visto, favorito, en curso,
 *     pendiente, pausado, abandonado) y el contenido +18 salvo opts.allowNsfw.
 *   - Un candidato sin relación con el perfil (ni obra origen, ni estudio, ni
 *     género en común) se descarta: no se rellena con populares.
 *   - Cada resultado lleva un motivo corto y visible.
 *
 * Acepta dos formas de entrada (las dos que hay en la app):
 *   - entradas de mis-listas: { item: { id, __category, titulo, info, genres?, studios? }, viewed, fav, wstatus }
 *   - filas de Supabase:      { item_id, category, viewed, fav, watch_status, meta: { titulo, info, studios? } }
 */
(function () {
    'use strict';

    // Peso de cada señal en el perfil de géneros. "abandonado" no suma gusto
    // (pero igual se excluye de las sugerencias).
    var WEIGHTS = { fav: 3, viewed: 2, viendo: 1.5, pendiente: 1, pausado: 0.5, abandonado: 0 };
    // Géneros demasiado amplios para explicar una sugerencia (igual que inicio.js).
    var GENRE_STOP = { 'comedy': 1, 'drama': 1, 'slice of life': 1 };
    var ADULT_GENRES = { 'hentai': 1 };

    var FALLBACK = {
        'reco.motivo.origen': 'Porque te gustó {titulo}',
        'reco.motivo.estudio': 'Del estudio de {titulo}',
        'reco.motivo.genero': '{genero}, como {titulo}',
        'reco.motivo.genero_solo': 'Por tu gusto por {genero}'
    };

    function t(key, args) {
        var txt = null;
        try {
            if (window.AppI18n && typeof window.AppI18n.t === 'function') {
                txt = window.AppI18n.t(key, args);
                if (typeof txt === 'string' && txt.charAt(0) === '[') txt = null;
            }
        } catch (_) { txt = null; }
        if (txt) return txt;
        return String(FALLBACK[key] || '').replace(/\{(\w+)\}/g, function (_, k) {
            return args && args[k] != null ? String(args[k]) : '';
        });
    }

    function genreLabel(g) {
        try {
            var G = window.AnimeDestiny && window.AnimeDestiny.Genres;
            if (G && typeof G.etiqueta === 'function') return G.etiqueta(g) || g;
        } catch (_) { /* sin módulo de géneros */ }
        return g;
    }

    function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

    function listOf(value) {
        if (!value) return [];
        if (Array.isArray(value)) {
            return value.map(function (v) { return v && typeof v === 'object' ? (v.name || '') : v; })
                .map(function (v) { return String(v || '').trim(); }).filter(Boolean);
        }
        return String(value).split(/[|,/]/).map(function (v) { return v.trim(); }).filter(Boolean);
    }

    function itemKeyId(x) {
        if (!x) return '';
        var id = x.id != null ? x.id : (x.item_id != null ? x.item_id : x.mal_id);
        return id == null ? '' : String(id);
    }

    function itemTitle(x) {
        if (!x) return '';
        var t0 = x.titulo || x.title || x.name || '';
        if (t0 && typeof t0 === 'object') t0 = t0.english || t0.romaji || t0.native || '';
        return String(t0 || '');
    }

    /** Pasa una entrada (mis-listas o Supabase) a una forma común. */
    function normEntry(e) {
        if (!e) return null;
        var src = e.item || e.meta || e;
        var id = e.item ? itemKeyId(e.item) : itemKeyId(e);
        if (!id) return null;
        var wstatus = e.wstatus || e.watch_status || '';
        return {
            id: id,
            category: String((e.item && (e.item.__category || e.item.categoria)) || e.category || e.__category || ''),
            title: itemTitle(src) || itemTitle(e),
            genres: listOf(src.genres).concat(listOf(src.info)),
            studios: listOf(src.studios || src.studio),
            fav: !!e.fav,
            viewed: !!e.viewed,
            wstatus: String(wstatus)
        };
    }

    function weightOf(n) {
        var w = 0;
        if (n.fav) w += WEIGHTS.fav;
        if (n.viewed) w += WEIGHTS.viewed;
        if (n.wstatus && WEIGHTS[n.wstatus] != null) w += WEIGHTS[n.wstatus];
        return w;
    }

    /**
     * Perfil de gustos.
     * @returns {{ markedIds:Set<string>, genres:Array<{name,weight,sample}>,
     *             studios:Object<string,{name,weight,sample}>, categories:Object<string,number>,
     *             topCategory:string, signalCount:number, markedCount:number }}
     */
    function buildProfile(entries) {
        var markedIds = new Set();
        var genreMap = {};
        var studioMap = {};
        var categories = {};
        var signalCount = 0;

        (Array.isArray(entries) ? entries : []).forEach(function (raw) {
            var n = normEntry(raw);
            if (!n) return;
            var marked = n.fav || n.viewed || !!n.wstatus;
            if (!marked) return;
            markedIds.add(n.id);
            if (n.category) markedIds.add(n.category + ':' + n.id);

            var w = weightOf(n);
            if (w <= 0) return;
            signalCount += 1;
            if (n.category) categories[n.category] = (categories[n.category] || 0) + w;

            var seen = {};
            n.genres.forEach(function (g) {
                var k = norm(g);
                if (!k || seen[k]) return;
                seen[k] = 1;
                var slot = genreMap[k] || (genreMap[k] = { name: g, weight: 0, sample: '', sampleWeight: 0 });
                slot.weight += w;
                // La obra de ejemplo es la de más peso (un favorito antes que un pendiente).
                if (n.title && w > slot.sampleWeight) { slot.sample = n.title; slot.sampleWeight = w; }
            });
            n.studios.forEach(function (s) {
                var k = norm(s);
                if (!k) return;
                var slot = studioMap[k] || (studioMap[k] = { name: s, weight: 0, sample: '', sampleWeight: 0 });
                slot.weight += w;
                if (n.title && w > slot.sampleWeight) { slot.sample = n.title; slot.sampleWeight = w; }
            });
        });

        var genres = Object.keys(genreMap).map(function (k) {
            var g = genreMap[k];
            return { key: k, name: g.name, weight: g.weight, sample: g.sample };
        }).sort(function (a, b) { return b.weight - a.weight; });

        var topCategory = Object.keys(categories)
            .sort(function (a, b) { return categories[b] - categories[a]; })[0] || '';

        return {
            markedIds: markedIds,
            genres: genres,
            studios: studioMap,
            categories: categories,
            topCategory: topCategory,
            signalCount: signalCount,
            markedCount: markedIds.size
        };
    }

    function isAdult(c) {
        if (!c) return false;
        if (c.isAdult === true || c.adult === true) return true;
        if (/^rx\b/i.test(String(c.rating || ''))) return true;
        return listOf(c.genres).some(function (g) { return ADULT_GENRES[norm(g)]; });
    }

    function isMarked(profile, c, category) {
        var id = itemKeyId(c);
        if (!id || !profile || !profile.markedIds) return false;
        if (profile.markedIds.has(id)) return true;
        return !!(category && profile.markedIds.has(category + ':' + id));
    }

    function reasonFromOrigin(title) {
        return title ? t('reco.motivo.origen', { titulo: title }) : '';
    }

    /**
     * Ordena y explica candidatos.
     * @param {Array} candidates  ítems de catálogo (id, title|titulo, genres, studios, isAdult)
     *                            Un candidato puede traer `__from` (título de la obra origen,
     *                            p. ej. la recomendación de AniList de algo que te gustó).
     * @param {Object} profile    salida de buildProfile (puede ser null si solo hay obra origen)
     * @param {Object} [opts]     { allowNsfw, max, category, originTitle }
     * @returns {Array<{item, reason, score}>}
     */
    function scoreCandidates(candidates, profile, opts) {
        opts = opts || {};
        var max = opts.max > 0 ? opts.max : Infinity;
        var genreIndex = {};
        var studios = (profile && profile.studios) || {};
        ((profile && profile.genres) || []).forEach(function (g) { genreIndex[g.key] = g; });
        var seen = new Set();
        var out = [];

        (Array.isArray(candidates) ? candidates : []).forEach(function (c, idx) {
            if (!c) return;
            var id = itemKeyId(c);
            if (!id || seen.has(id)) return;
            if (!opts.allowNsfw && isAdult(c)) return;
            if (isMarked(profile, c, opts.category || c.__category)) return;

            var score = 0;
            var reason = '';
            var origin = c.__from || opts.originTitle || '';
            if (origin) {
                score += 5;
                reason = reasonFromOrigin(origin);
            }

            var bestStudio = null;
            listOf(c.studios || c.studio).forEach(function (s) {
                var slot = studios[norm(s)];
                if (slot && (!bestStudio || slot.weight > bestStudio.weight)) bestStudio = slot;
            });
            if (bestStudio) {
                score += 2 + bestStudio.weight / 10;
                if (!reason && bestStudio.sample) reason = t('reco.motivo.estudio', { titulo: bestStudio.sample });
            }

            var bestGenre = null;
            var bestBroad = null;
            var genreScore = 0;
            listOf(c.genres).forEach(function (g) {
                var slot = genreIndex[norm(g)];
                if (!slot) return;
                genreScore += slot.weight;
                if (GENRE_STOP[slot.key]) {
                    if (!bestBroad || slot.weight > bestBroad.weight) bestBroad = slot;
                    return;
                }
                if (!bestGenre || slot.weight > bestGenre.weight) bestGenre = slot;
            });
            // Un género amplio (Comedia, Drama) solo explica si no hay otro.
            bestGenre = bestGenre || bestBroad;
            score += genreScore / 10;
            if (!reason && bestGenre) {
                reason = bestGenre.sample
                    ? t('reco.motivo.genero', { genero: genreLabel(bestGenre.name), titulo: bestGenre.sample })
                    : t('reco.motivo.genero_solo', { genero: genreLabel(bestGenre.name) });
            }

            // Sin motivo no hay recomendación: no se disfrazan populares.
            if (!reason || score <= 0) return;
            seen.add(id);
            out.push({ item: c, reason: reason, score: score, _i: idx });
        });

        out.sort(function (a, b) { return (b.score - a.score) || (a._i - b._i); });
        return out.slice(0, max).map(function (r) { return { item: r.item, reason: r.reason, score: r.score }; });
    }

    /** Preferencia "Mostrar NSFW" de configuración (clave pref:nsfw). */
    function allowNsfw() {
        try { return localStorage.getItem('pref:nsfw') === 'true'; } catch (_) { return false; }
    }

    window.AppRecommend = {
        buildProfile: buildProfile,
        scoreCandidates: scoreCandidates,
        reasonFromOrigin: reasonFromOrigin,
        isAdult: isAdult,
        allowNsfw: allowNsfw,
        WEIGHTS: WEIGHTS
    };
})();
