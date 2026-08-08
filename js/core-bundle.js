/* === Anime Destiny Core Bundle === */

/* ========================================== */
/* === FILE: js/core/constants.js === */
/* ========================================== */

(function () {
    var C = {
        PER_PAGE: 40,
        MAX_PAGES: 250,
        SKELETON_COUNT: 40,
        SEARCH_DEBOUNCE_MS: 400,
        SYNC_DEBOUNCE_MS: 250,
        SUPABASE_WAIT_TIMEOUT_MS: 12000,
        REQUEST_TIMEOUT_MS: 12000,
        CARDS_PER_ROW_MIN: 2,
        CARDS_PER_ROW_MAX: 8,
        CARDS_PER_ROW_DEFAULT: 4,
        TOAST_DURATION_MS: 4000,
        XP_BASE: 100,
        XP_MULTIPLIER: 1.2,
        XP_MAX_LEVEL: 50,
        XP_VIEWED: 10,
        XP_FAV: 5,
        XP_PROGRESS: 2,
        XP_COMPLETE: 50,
        XP_LOGIN: 10,
        XP_SHARE: 5,
        XP_MAL_IMPORT: 100,
        MIN_USERNAME_LENGTH: 3,
        MIN_PASSWORD_LENGTH: 6,
        TRUNCATE_MAX_LENGTH: 140,
        LOCAL_PAGE_SIZE: 20,
        API_TIMEOUT_MS: 15000,
        SUGGESTION_LIMIT: 6,
        API_SUGGESTION_LIMIT: 8,
        SEARCH_PAGE_SIZE: 10,
        MANGADEX_SEARCH_LIMIT: 5,
        SYNC_QUEUE_INTERVAL_MS: 30000,
        RANKING_PAGE_SIZE: 50,
        RANKING_SKELETON_ROWS: 5,
        MAX_RECOMMENDATIONS: 5,
        MAX_ACTIVITY_ITEMS: 15,
        MAX_MINI_ACTIVITY: 5,
        ACTIVITY_TITLE_MAX: 35,
        SAFETY_NET_TIMEOUT_MS: 15000,
        PROFILE_REDIRECT_DELAY_MS: 1000,
        LOGIN_REDIRECT_DELAY_MS: 200,
        LOGIN_FALLBACK_REDIRECT_MS: 1500,
        POLL_INTERVAL_MS: 100,
        MODAL_CLOSE_DELAY_MS: 800,
        MODAL_CLOSE_LONG_DELAY_MS: 2500,
        COMMENT_MAX_LENGTH: 2000,
        COMMENTS_PER_PAGE: 20,
        COMMENT_RATE_LIMIT_MS: 5000,
        COMMENT_REF_TYPES: { EPISODE: 'episode', VOLUME: 'volume', CHAPTER: 'chapter' }
    };
    window.AnimeDestiny = window.AnimeDestiny || {};
    window.AnimeDestiny.Constants = C;
})();



/* ========================================== */
/* === FILE: js/core/api.js === */
/* ========================================== */

(function () {
    "use strict";

    var ANILIST_ENDPOINT = 'https://graphql.anilist.co';
    var PER_PAGE = AnimeDestiny.Constants.PER_PAGE || 40;
    var REQUEST_TIMEOUT = AnimeDestiny.Constants.REQUEST_TIMEOUT_MS || 12000;

    function anilistFetch(query, variables, retries) {
        if (retries === undefined) retries = 2;
        return new Promise(function (resolve, reject) {
            var controller = new AbortController();
            var timer = setTimeout(function () {
                controller.abort();
                reject(new Error('Timeout'));
            }, REQUEST_TIMEOUT);

            function done() {
                clearTimeout(timer);
            }

            fetch(ANILIST_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query: query, variables: variables }),
                signal: controller.signal
            }).then(function (res) {
                done();
                if (!res.ok) {
                    if (res.status === 429 && retries > 0) {
                        var retryAfter = res.headers.get('Retry-After');
                        var delay = retryAfter ? (parseInt(retryAfter, 10) * 1000) : Math.min(2000 * (4 - retries), 6000);
                        
                        if (delay > 15000) {
                            return res.text().then(function (text) {
                                reject(new Error('Límite de peticiones de AniList excedido. Espera unos minutos.'));
                            });
                        }
                        
                        console.warn('AniList rate limited (429), retrying in ' + delay + 'ms...');
                        setTimeout(function () {
                            anilistFetch(query, variables, retries - 1).then(resolve, reject);
                        }, delay);
                        return;
                    }
                    return res.text().then(function (text) {
                        reject(new Error('AniList HTTP ' + res.status + ': ' + text.slice(0, 200)));
                    });
                }
                return res.json();
            }).then(function (json) {
                if (json && json.errors) {
                    // GraphQL puede devolver errores Y datos a la vez: en una
                    // consulta con varios alias (buildMultiPageQuery) puede
                    // fallar uno solo y venir los otros dos completos. Tirar
                    // todo por la borda ahi seria peor que mostrar lo que llego.
                    var campos = json.data ? Object.keys(json.data) : [];
                    var hayDatos = campos.some(function (k) { return json.data[k] != null; });
                    if (!hayDatos) {
                        reject(new Error('AniList error: ' + (json.errors[0]?.message || 'Unknown')));
                        return;
                    }
                    console.warn('AniList devolvio errores parciales:', json.errors[0]?.message || 'Unknown');
                }
                if (json) resolve(json);
            }).catch(function (err) {
                done();
                reject(err);
            });
        });
    }

    function extractTitle(title) {
        return title?.english || title?.romaji || '';
    }

    function extractAltTitle(title) {
        return title?.romaji || title?.english || '';
    }

    function buildSeasonsFromItem(item, type) {
        var seasons = [];
        var isAnime = type === 'anime';
        var mainCount = isAnime ? (item.episodes || 0) : (item.chapters || item.volumes || 0);

        if (item.relations?.edges) {
            var sequelEdges = item.relations.edges.filter(function (e) {
                return e.relationType === 'SEQUEL';
            });

            if (sequelEdges.length > 0) {
                seasons.push({
                    id: item.id,
                    episodes: mainCount,
                    season: item.season || null,
                    seasonYear: item.seasonYear || null,
                    title: extractTitle(item.title) || 'Temporada 1',
                    format: item.format || null,
                    img: item.coverImage?.extraLarge || item.coverImage?.large || ''
                });
                sequelEdges.forEach(function (edge) {
                    var node = edge.node;
                    var count = isAnime ? (node.episodes || 0) : (node.chapters || node.volumes || 0);
                    if (count > 0) {
                        seasons.push({
                            id: node.id,
                            episodes: count,
                            season: node.season || null,
                            seasonYear: node.seasonYear || null,
                            title: extractTitle(node.title) || 'Secuela',
                            format: node.format || null,
                            img: node.coverImage?.large || ''
                        });
                    }
                });
            }
        }

        return seasons;
    }

    function anilistItemToLocal(item, type) {
        if (!item) return null;
        var title = extractTitle(item.title);
        var altTitle = extractAltTitle(item.title);
        var image = item.coverImage?.extraLarge || item.coverImage?.large || '';
        var description = item.description || '';
        var cleanDesc = description.replace(/<[^>]*>/g, '').trim();
        var genres = (item.genres || []).map(function (g) { return { name: g }; });
        
        var isAnime = String(type).toLowerCase() === 'anime';
        var isNovel = String(type).toLowerCase() === 'novelas' || item.format === 'NOVEL';
        var friendlyType = item.format || 'Manga';
        if (isNovel) {
            friendlyType = 'Novela';
        } else if (isAnime) {
            friendlyType = item.format || 'TV';
        } else {
            var origin = String(item.countryOfOrigin || '').toUpperCase();
            if (origin === 'KR') {
                friendlyType = 'Manhwa';
            } else if (origin === 'CN' || origin === 'TW') {
                friendlyType = 'Manhua';
            } else if (item.source === 'DOUJINSHI') {
                friendlyType = 'Doujinshi';
            } else if (item.format === 'ONE_SHOT') {
                friendlyType = 'One-shot';
            } else {
                friendlyType = 'Manga';
            }
        }

        return {
            id: item.id,
            mal_id: item.idMal,
            title: title,
            title_english: altTitle,
            synopsis: cleanDesc || 'Sin sinopsis disponible.',
            status: item.status || 'UNKNOWN',
            type: friendlyType,
            episodes: isAnime ? (item.episodes || 0) : 0,
            chapters: !isAnime ? (item.chapters || 0) : 0,
            volumes: !isAnime ? (item.volumes || 0) : 0,
            score: item.averageScore != null ? (item.averageScore / 10) : null,
            // Solo vienen en la query por id (MEDIA_BY_ID_QUERY), no en las de
            // catalogo: los usa la pagina de comparar. En items de MangaDex y en
            // las listas quedan en 0, y el que los muestra cae a "—".
            popularity: item.popularity || 0,
            favourites: item.favourites || 0,
            // El manga no tiene season/seasonYear (eso es solo de anime), asi que
            // sin startDate no habia forma de mostrarle el año.
            startYear: item.startDate?.year || item.seasonYear || null,
            endYear: item.endDate?.year || null,
            // Solo viene en la query por id, igual que popularity: lo usa la
            // pagina de comparar para mostrar el autor de un manga o novela.
            staff: (item.staff?.edges || []).map(function (e) {
                return { role: e.role || '', name: e.node?.name?.full || '' };
            }).filter(function (s) { return s.name; }),
            images: {
                webp: { large_image_url: image, image_url: image },
                jpg: { large_image_url: image, image_url: image }
            },
            genres: genres,
            themes: [],
            studios: (item.studios?.nodes || []).map(function (s) { return s.name; }),
            relations: (item.relations?.edges || []).map(function (edge) {
                var node = edge.node || {};
                return {
                    relationType: edge.relationType || 'OTHER',
                    id: node.id,
                    title: extractTitle(node.title),
                    episodes: node.episodes || 0,
                    chapters: node.chapters || 0,
                    volumes: node.volumes || 0,
                    format: node.format || null,
                    seasonYear: node.seasonYear || null,
                    // La portada la usan tanto "Relacionados" como la cadena de
                    // temporadas, que hasta ahora dibujaba huecos vacios hasta
                    // que la hidratacion traia las fichas completas.
                    img: node.coverImage?.large || ''
                };
            }),
            season: item.season || null,
            seasonYear: item.seasonYear || null,
            source: item.source || null,
            duration: item.duration || null,
            countryOfOrigin: item.countryOfOrigin || null,
            nextAiringEpisode: item.nextAiringEpisode || null,
            streamingEpisodes: item.streamingEpisodes || [],
            // Los tres campos de abajo solo vienen en MEDIA_BY_ID_QUERY: en las
            // listas del catalogo quedan vacios y la ficha simplemente no pinta
            // esas secciones.
            // Ojo con el nombre: normalizeDetailItem() usa `banner` como uno de
            // los fallbacks de portada, asi que llamarlo asi hacia que la ficha
            // mostrara la imagen ancha recortada a 2:3 en lugar del poster.
            bannerImage: item.bannerImage || null,
            // El id viene sucio en varias obras (Attack on Titan lo trae con un
            // tabulador al final), y ese mismo id es el que arma la URL del
            // embed y de la miniatura: sin el trim, ninguna de las dos carga.
            trailer: (item.trailer && item.trailer.id)
                ? { id: String(item.trailer.id).trim(), site: item.trailer.site || '' }
                : null,
            characters: (item.characters?.edges || []).map(function (e) {
                var va = (e.voiceActors || [])[0] || null;
                return {
                    id: e.node?.id || null,
                    name: e.node?.name?.full || '',
                    image: e.node?.image?.large || '',
                    role: e.role || '',
                    vaId: va?.id || null,
                    vaName: va?.name?.full || '',
                    vaImage: va?.image?.large || ''
                };
            }).filter(function (c) { return c.name; }),
            seasons: buildSeasonsFromItem(item, type)
        };
    }

    // ── Dynamic query builder ──
    // AniList genre_in only accepts their official genre list.
    // Tags like Isekai, Mecha etc. go into tag_in.
    var ANILIST_OFFICIAL_GENRES = [
        'Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Horror',
        'Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance',
        'Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'
    ];

    // ── MangaDex: cliente y helpers ──
    // Movidos a js/core/api-mangadex.js (va en el bundle junto a este archivo).
    // getTopMangas/getTopNovelas los consumen vía window.mdTagUuidsFromKeys,
    // window.fetchMangaDexPage y window.mergeAnilistAndMd.

    function splitGenresAndTags(genreKeys) {
        var genres = [];
        var tags = [];
        (genreKeys || []).forEach(function(g) {
            // Always use case-insensitive comparison — genre keys arrive normalized
            // (lowercase, no diacritics), while ANILIST_OFFICIAL_GENRES has proper casing
            var found = ANILIST_OFFICIAL_GENRES.find(function(og) {
                return og.toLowerCase().replace(/[\s-]/g, '') === String(g).toLowerCase().replace(/[\s-]/g, '');
            });
            if (found) genres.push(found);
            else tags.push(g);
        });
        return { genres: genres, tags: tags };
    }

    // Partes sueltas de una consulta de catalogo: declaraciones de variables,
    // argumentos de `media(...)` y campos a pedir. Se separo de
    // buildDynamicQuery para poder meter varias consultas en un mismo POST
    // (ver buildMultiPageQuery).
    function buildQueryParts(opts) {
        var type = opts.type || 'ANIME';
        var isAnime = type === 'ANIME';
        var fields = isAnime
            ? 'id idMal title { romaji english } coverImage { extraLarge large } episodes status genres averageScore description type format season seasonYear source duration countryOfOrigin studios { nodes { name } }'
            : 'id idMal title { romaji english } coverImage { extraLarge large } chapters volumes status genres averageScore description type format countryOfOrigin source';

        // Build variable declarations
        var varDecls = ['$page: Int', '$perPage: Int'];
        var sort = /^[A-Z_]+$/.test(String(opts.sort || '')) ? opts.sort : 'POPULARITY_DESC';
        var mediaArgs = ['type: ' + type, 'sort: ' + sort];

        // Temporada + año. La temporada es solo de anime; el año se aplica en
        // ambos: en anime como seasonYear y en manga/novelas como rango de
        // startDate (FuzzyDateInt YYYYMMDD, de YYYY0000 a YYYY9999).
        var seasonValid = isAnime && /^(WINTER|SPRING|SUMMER|FALL)$/.test(String(opts.season || ''));
        var yearNum = Number(opts.seasonYear || opts.year);
        var yearValid = Number.isFinite(yearNum) && yearNum > 1940 && yearNum < 2100;
        if (isAnime) {
            if (seasonValid) mediaArgs.push('season: ' + opts.season);
            if (yearValid) mediaArgs.push('seasonYear: ' + yearNum);
        } else if (yearValid) {
            mediaArgs.push('startDate_greater: ' + (yearNum * 10000));
            mediaArgs.push('startDate_lesser: ' + (yearNum * 10000 + 9999));
        }

        if (opts.search) {
            varDecls.push('$search: String');
            mediaArgs.push('search: $search');
        }
        if (opts.genreIn && opts.genreIn.length) {
            varDecls.push('$genre_in: [String]');
            mediaArgs.push('genre_in: $genre_in');
        }
        if (opts.tagIn && opts.tagIn.length) {
            varDecls.push('$tag_in: [String]');
            mediaArgs.push('tag_in: $tag_in');
        }
        if (opts.isAdult) {
            mediaArgs.push('isAdult: true');
        }
        if (opts.formatIn) {
            mediaArgs.push('format_in: [' + opts.formatIn.join(', ') + ']');
        }
        if (opts.formatNot) {
            mediaArgs.push('format_not: ' + opts.formatNot);
        }
        if (opts.countryOfOrigin) {
            mediaArgs.push('countryOfOrigin: "' + opts.countryOfOrigin + '"');
        }
        if (opts.source) {
            mediaArgs.push('source: ' + opts.source);
        }

        return { varDecls: varDecls, mediaArgs: mediaArgs, fields: fields };
    }

    function buildDynamicQuery(opts) {
        var p = buildQueryParts(opts);
        return 'query (' + p.varDecls.join(', ') + ') { Page(page: $page, perPage: $perPage) { media(' + p.mediaArgs.join(', ') + ') { ' + p.fields + ' } } }';
    }

    /**
     * Varias consultas de catalogo en un solo POST, aliasando el `Page` de cada
     * una (`jp: Page(...)`, `kr: Page(...)`, ...).
     *
     * AniList cobra por request, no por campo: tres Page aliasadas salen lo
     * mismo que una sola. El catalogo de manga se armaba con tres requests
     * paralelos y era, de lejos, lo que mas cuota gastaba de toda la app.
     *
     * Los bloques comparten $page y $perPage, y las declaraciones de variables
     * se unifican (todos filtran por lo mismo; lo unico que cambia son los
     * argumentos fijos: pais, formato, source).
     */
    function buildMultiPageQuery(bloques) {
        var varDecls = [];
        var cuerpo = bloques.map(function (b) {
            var p = buildQueryParts(b.opts);
            p.varDecls.forEach(function (v) {
                if (varDecls.indexOf(v) === -1) varDecls.push(v);
            });
            return b.alias + ': Page(page: $page, perPage: $perPage) { media(' +
                p.mediaArgs.join(', ') + ') { ' + p.fields + ' } }';
        }).join(' ');
        return 'query (' + varDecls.join(', ') + ') { ' + cuerpo + ' }';
    }

    // ─── Modos de descubrimiento del catálogo ───
    function getCurrentSeason() {
        var now = new Date();
        var m = now.getMonth() + 1;
        var season = m <= 3 ? 'WINTER' : (m <= 6 ? 'SPRING' : (m <= 9 ? 'SUMMER' : 'FALL'));
        return { season: season, year: now.getFullYear() };
    }
    window.getCurrentSeason = getCurrentSeason;

    // browse: 'populares' (default) | 'tendencias' | 'puntuados' | 'temporada' (solo anime)
    function browseToQueryOpts(browse, isAnime) {
        if (browse === 'tendencias') return { sort: 'TRENDING_DESC' };
        if (browse === 'puntuados') return { sort: 'SCORE_DESC' };
        if (browse === 'temporada' && isAnime) {
            var s = getCurrentSeason();
            return { sort: 'POPULARITY_DESC', season: s.season, seasonYear: s.year };
        }
        return {};
    }

    var MEDIA_BY_ID_QUERY = `
        query ($id: Int) {
            Media(id: $id) {
                id idMal title { romaji english } coverImage { extraLarge large }
                episodes chapters volumes status genres averageScore description type format
                season seasonYear source duration countryOfOrigin popularity favourites
                startDate { year } endDate { year }
                staff(perPage: 6) { edges { role node { name { full } } } }
                nextAiringEpisode { airingAt timeUntilAiring episode }
                streamingEpisodes { title thumbnail url site }
                studios { nodes { name } }
                bannerImage
                trailer { id site }
                characters(sort: [ROLE, RELEVANCE], perPage: 12) {
                    edges {
                        role
                        node { id name { full } image { large } }
                        voiceActors(language: JAPANESE, sort: [RELEVANCE]) { id name { full } image { large } }
                    }
                }
                relations {
                    edges {
                        relationType
                        node {
                            id
                            episodes
                            chapters
                            volumes
                            format
                            season
                            seasonYear
                            coverImage { large }
                            title { romaji english }
                        }
                    }
                }
            }
        }`;

    // ─── Search Cache Helpers ───
    function getSearchCache(key) {
        // key should already include type and query
        return getApiCache('search_' + key);
    }

    function setSearchCache(key, data, ttlMs) {
        setApiCache('search_' + key, data, ttlMs);
    }

    // ─── Cache Helpers ─────────────────────────────────────────────────────
    // L1: in-memory Map (ultra-fast, lost on navigation)
    // L2: localStorage (survives reload, TTL = 1 hour for catalog, 5 min for search)
    var _memCache = new Map();
    var CACHE_PREFIX = 'adApiCache_';

    // Ventana de gracia tras la expiración: la entrada sigue guardada (aunque ya
    // no se sirve como "fresca") para poder devolverla como respaldo si la API
    // falla. Sin esto, una caída de AniList dejaba la app en "API no disponible"
    // aunque el catálogo ya se hubiera cargado antes.
    var STALE_GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

    function _pruneOldCache() {
        // Solo se descartan las entradas más viejas que expiry + gracia, para no
        // perder el respaldo utilizable ante fallos de la API.
        var toRemove = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    try {
                        var p = JSON.parse(localStorage.getItem(k));
                        if (Date.now() > p.expiry + STALE_GRACE_MS) toRemove.push(k);
                    } catch (_) { toRemove.push(k); }
                }
            }
            toRemove.forEach(function(k) { localStorage.removeItem(k); });
        } catch (_) {}
    }

    // Prune once per session
    _pruneOldCache();

    function getApiCache(key) {
        // L1 hit
        var mem = _memCache.get(key);
        if (mem && Date.now() < mem.expiry) return mem.data;

        // L2 hit
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            // Expirada: NO se borra (queda como respaldo durante la gracia), pero
            // no se sirve como fresca.
            if (Date.now() > parsed.expiry) return null;
            // Promote to L1
            _memCache.set(key, parsed);
            return parsed.data;
        } catch (e) { return null; }
    }

    // Devuelve datos cacheados ignorando la expiración (respaldo ante fallos de
    // la API). No promueve a L1 ni altera el estado del cache.
    function getStaleApiCache(key) {
        var mem = _memCache.get(key);
        if (mem && mem.data != null) return mem.data;
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + key);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return parsed && parsed.data != null ? parsed.data : null;
        } catch (e) { return null; }
    }

    // JSON.stringify depende del orden de insercion de las propiedades, asi que
    // {genres,search} y {search,genres} generaban claves distintas para el mismo
    // filtro y fallaba el cache al pedo. Serializa con las claves ordenadas.
    function stableStringify(value) {
        if (value === null || typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
        return '{' + Object.keys(value).sort().map(function (k) {
            return JSON.stringify(k) + ':' + stableStringify(value[k]);
        }).join(',') + '}';
    }

    // Peticiones en vuelo: sin esto, dos componentes que piden lo mismo a la vez
    // (p.ej. dos carruseles, o navegar rapido) disparan dos requests identicos y
    // gastan cuota de la API al dopoble.
    var _inflight = new Map();

    /**
     * Devuelve del cache si hay; si no, ejecuta `producer` una sola vez aunque
     * lo llamen varias veces en paralelo. Si `producer` falla, se intenta
     * devolver la última copia cacheada (aunque esté expirada) como respaldo
     * ante caídas de la API; solo si no hay respaldo se propaga el error, para
     * que el llamador pueda distinguir "sin resultados" de "la API se cayó".
     */
    function fetchCached(cacheKey, ttlMs, producer) {
        var cached = getApiCache(cacheKey);
        if (cached) return Promise.resolve(cached);

        var pendiente = _inflight.get(cacheKey);
        if (pendiente) return pendiente;

        var p = Promise.resolve()
            .then(producer)
            .then(function (data) {
                if (Array.isArray(data) ? data.length : data) setApiCache(cacheKey, data, ttlMs);
                return data;
            })
            .catch(function (err) {
                // Respaldo: servir la copia expirada si existe. Mejor contenido
                // viejo que un cartel de "API no disponible".
                var stale = getStaleApiCache(cacheKey);
                if (stale != null && (Array.isArray(stale) ? stale.length : true)) {
                    console.warn('AniList falló; usando caché de respaldo para', cacheKey);
                    return stale;
                }
                throw err;
            })
            .finally(function () { _inflight.delete(cacheKey); });

        _inflight.set(cacheKey, p);
        return p;
    }

    function setApiCache(key, data, ttlMs) {
        var expiry = Date.now() + (ttlMs || 3600000);
        // L1
        _memCache.set(key, { data: data, expiry: expiry });
        // L2
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data: data, expiry: expiry }));
        } catch (e) {
            // Quota exceeded — clear old cache entries and retry once
            _pruneOldCache();
            try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data: data, expiry: expiry })); } catch (_) {}
        }
    }

    window.getTopAnimes = async function (page, filters) {
        filters = filters || {};
        var split = splitGenresAndTags(filters.genres);
        var browse = filters.browse || '';
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse || filters.year || filters.season || filters.format || filters.sort);
        var cacheKey = 'topAnimes_p' + (page || 1) + (hasFilters ? '_f' + stableStringify(filters) : '');

        return fetchCached(cacheKey, hasFilters ? 300000 : 3600000, async function () {
            // Con búsqueda de texto ignoramos el modo de descubrimiento: ordenar
            // por relevancia (SEARCH_MATCH) y NO limitar por temporada/tendencia,
            // que dejaban fuera títulos válidos (p. ej. buscar "Dxd" con
            // "Temporada actual" activo devolvía cero resultados).
            var animeSortOpts = filters.search ? { sort: 'SEARCH_MATCH' } : browseToQueryOpts(browse, true);
            var animeOpts = Object.assign({
                type: 'ANIME',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: filters.format ? [filters.format] : ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']
            }, animeSortOpts);
            // Los filtros avanzados (orden/año/temporada) pisan al modo de
            // descubrimiento, salvo cuando hay búsqueda por texto (ahí manda
            // SEARCH_MATCH para no perder relevancia).
            if (filters.sort && !filters.search) animeOpts.sort = filters.sort;
            if (filters.year) animeOpts.seasonYear = filters.year;
            if (filters.season) animeOpts.season = filters.season;
            var query = buildDynamicQuery(animeOpts);
            var vars = { page: page || 1, perPage: PER_PAGE };
            if (filters.search) vars.search = filters.search;
            if (split.genres.length) vars.genre_in = split.genres;
            if (split.tags.length) vars.tag_in = split.tags;

            var json = await anilistFetch(query, vars);
            var media = json?.data?.Page?.media || [];
            // El error NO se atrapa aca a proposito: antes se devolvia [] y el
            // llamador mostraba "sin resultados" cuando en realidad la API habia
            // fallado. cargarCatalogoDesdeApi y los carruseles ya tienen su
            // try/catch y muestran el estado de error correcto.
            return media.map(function (m) { return anilistItemToLocal(m, 'anime'); });
        });
    };

    window.getTopMangas = async function (page, filters) {
        filters = filters || {};
        var split = splitGenresAndTags(filters.genres);
        var browse = filters.browse || '';
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse || filters.year || filters.sort);
        var cacheKey = 'topMangas_mix_p' + (page || 1) + (hasFilters ? '_f' + stableStringify(filters) : '');

        return fetchCached(cacheKey, hasFilters ? 300000 : 3600000, async function () {
            var perPage = Math.floor(PER_PAGE / 3) || 13;
            // Ver getTopAnimes: al buscar por texto priorizamos relevancia y no
            // restringimos por modo de descubrimiento.
            var mangaSortOpts = filters.search ? { sort: 'SEARCH_MATCH' } : browseToQueryOpts(browse, false);
            var baseOpts = Object.assign({
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false
            }, mangaSortOpts);
            if (filters.sort && !filters.search) baseOpts.sort = filters.sort;
            if (filters.year) baseOpts.year = filters.year;
            var baseVars = {};
            if (filters.search) baseVars.search = filters.search;
            if (split.genres.length) baseVars.genre_in = split.genres;
            if (split.tags.length) baseVars.tag_in = split.tags;

            // Las tres consultas (manga JP, manhwa KR, doujinshi) van en un
            // unico POST aliasado. Antes eran tres requests paralelos: el
            // catalogo de manga costaba el triple de cuota que el de anime o el
            // de novelas, y era lo que primero rompia el rate limit.
            //
            // Un solo request tampoco pierde la tolerancia a fallas parciales:
            // si AniList devuelve error en uno de los tres alias, anilistFetch
            // resuelve igual con los que si trajeron datos (ver el manejo de
            // json.errors). Solo si no vino nada de nada propaga el error, para
            // que el llamador pueda distinguir "la API se cayo" de "la busqueda
            // no tuvo resultados".
            var query = buildMultiPageQuery([
                { alias: 'jp', opts: Object.assign({}, baseOpts, { formatIn: ['MANGA', 'ONE_SHOT'], countryOfOrigin: 'JP' }) },
                { alias: 'kr', opts: Object.assign({}, baseOpts, { formatIn: ['MANGA', 'ONE_SHOT'], countryOfOrigin: 'KR' }) },
                { alias: 'dj', opts: Object.assign({}, baseOpts, { source: 'DOUJINSHI' }) }
            ]);

            var pg = page || 1;
            var json = await anilistFetch(query, Object.assign({ page: pg, perPage: perPage }, baseVars));

            var mediaManga = json?.data?.jp?.media || [];
            var mediaManhwa = json?.data?.kr?.media || [];
            var mediaDoujin = json?.data?.dj?.media || [];

            var media = [];
            var seenIds = new Set();
            var maxLen = Math.max(mediaManga.length, mediaManhwa.length, mediaDoujin.length);
            for (var i = 0; i < maxLen; i++) {
                [mediaManga[i], mediaManhwa[i], mediaDoujin[i]].forEach(function(m) {
                    if (m && !seenIds.has(m.id)) { seenIds.add(m.id); media.push(m); }
                });
            }
            
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'manga'); });

            // Supplement with MangaDex. Con filtro de año activo lo omitimos:
            // MangaDex no filtra por año en esta ruta y colaría títulos de otros
            // años, rompiendo el filtro.
            var mdTagUuids = window.mdTagUuidsFromKeys(filters.genres);
            if ((mdTagUuids.length || filters.search) && !filters.year) {
                var mdPage = await window.fetchMangaDexPage(pg, PER_PAGE, mdTagUuids, filters.search);
                if (mdPage.length) mapped = window.mergeAnilistAndMd(mapped, mdPage);
            }

            return mapped;
        });
    };

    window.getTopNovelas = async function (page, filters) {
        filters = filters || {};
        var split = splitGenresAndTags(filters.genres);
        var browse = filters.browse || '';
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse || filters.year || filters.sort);
        var cacheKey = 'novonly_p' + (page || 1) + (hasFilters ? '_f' + stableStringify(filters) : '');

        return fetchCached(cacheKey, hasFilters ? 300000 : 3600000, async function () {
            // Ver getTopAnimes: al buscar por texto priorizamos relevancia y no
            // restringimos por modo de descubrimiento.
            var novelaSortOpts = filters.search ? { sort: 'SEARCH_MATCH' } : browseToQueryOpts(browse, false);
            var novelaOpts = Object.assign({
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['NOVEL']
            }, novelaSortOpts);
            if (filters.sort && !filters.search) novelaOpts.sort = filters.sort;
            if (filters.year) novelaOpts.year = filters.year;
            var query = buildDynamicQuery(novelaOpts);
            var vars = { page: page || 1, perPage: PER_PAGE };
            if (filters.search) vars.search = filters.search;
            if (split.genres.length) vars.genre_in = split.genres;
            if (split.tags.length) vars.tag_in = split.tags;

            var json = await anilistFetch(query, vars);
            var media = json?.data?.Page?.media || [];
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'novelas'); });

            // Supplement with MangaDex (omitido con filtro de año: ver getTopMangas).
            var mdTagUuids = window.mdTagUuidsFromKeys(filters.genres);
            if ((mdTagUuids.length || filters.search) && !filters.year) {
                var pg = page || 1;
                var mdPage = await window.fetchMangaDexPage(pg, PER_PAGE, mdTagUuids, filters.search);
                if (mdPage.length) mapped = window.mergeAnilistAndMd(mapped, mdPage);
            }

            return mapped;
        });
    };

    window.getAnimeById = async function (id) {
        var numId = Number(id);
        if (!Number.isFinite(numId)) return null;
        var cacheKey = 'animeDetail_' + numId;
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
            var json = await anilistFetch(MEDIA_BY_ID_QUERY, { id: numId });
            var media = json?.data?.Media;
            var mapped = anilistItemToLocal(media || null, 'anime');
            if (mapped) setApiCache(cacheKey, mapped);
            return mapped;
        } catch (err) {
            console.warn('AniList getAnimeById error:', err);
            return null;
        }
    };

    // ─── Calendario de emisión: próximos episodios de un set de animes ───
    var AIRING_QUERY = `
        query ($ids: [Int]) {
            Page(page: 1, perPage: 50) {
                media(id_in: $ids, type: ANIME, status: RELEASING) {
                    id
                    title { romaji english }
                    coverImage { large }
                    nextAiringEpisode { airingAt episode }
                }
            }
        }`;

    window.getAiringSchedule = async function (ids) {
        var numIds = (Array.isArray(ids) ? ids : [])
            .map(Number)
            .filter(function (n) { return Number.isFinite(n) && n > 0; });
        if (!numIds.length) return [];

        numIds.sort(function (a, b) { return a - b; });
        var cacheKey = 'airing_' + numIds.join(',');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
            var chunks = [];
            for (var i = 0; i < numIds.length; i += 50) chunks.push(numIds.slice(i, i + 50));

            var pages = await Promise.all(chunks.map(function (chunk) {
                return anilistFetch(AIRING_QUERY, { ids: chunk });
            }));

            var results = [];
            pages.forEach(function (json) {
                (json?.data?.Page?.media || []).forEach(function (m) {
                    if (!m?.nextAiringEpisode?.airingAt) return;
                    results.push({
                        id: m.id,
                        title: extractTitle(m.title),
                        img: m.coverImage?.large || '',
                        episode: Number(m.nextAiringEpisode.episode) || 0,
                        airingAt: Number(m.nextAiringEpisode.airingAt) || 0
                    });
                });
            });

            results.sort(function (a, b) { return a.airingAt - b.airingAt; });
            setApiCache(cacheKey, results, 30 * 60 * 1000);
            return results;
        } catch (err) {
            console.warn('getAiringSchedule error:', err);
            return [];
        }
    };

    window.getMangaById = async function (id) {
        var numId = Number(id);
        if (!Number.isFinite(numId)) return null;
        var cacheKey = 'mangaDetail_' + numId;
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
            var json = await anilistFetch(MEDIA_BY_ID_QUERY, { id: numId });
            var media = json?.data?.Media;
            var mapped = anilistItemToLocal(media || null, 'manga');
            if (mapped) setApiCache(cacheKey, mapped);
            return mapped;
        } catch (err) {
            console.warn('AniList getMangaById error:', err);
            return null;
        }
    };

    // ─── Portadas por lote: recupera coverImage de un set de ids ───
    // Se usa para reparar items guardados sin portada (metadatos viejos que
    // guardaban el id en vez de la URL). Un solo request por cada 50 ids en vez
    // de uno por item, para no chocar con el rate limit de AniList.
    var COVERS_BY_IDS_QUERY = `
        query ($ids: [Int]) {
            Page(page: 1, perPage: 50) {
                media(id_in: $ids) {
                    id
                    coverImage { extraLarge large }
                }
            }
        }`;

    window.getCoversByIds = async function (ids) {
        var numIds = (Array.isArray(ids) ? ids : [])
            .map(Number)
            .filter(function (n) { return Number.isFinite(n) && n > 0; });
        if (!numIds.length) return {};
        numIds = Array.from(new Set(numIds));

        var out = {};
        try {
            for (var i = 0; i < numIds.length; i += 50) {
                var chunk = numIds.slice(i, i + 50);
                var json = await anilistFetch(COVERS_BY_IDS_QUERY, { ids: chunk });
                (json?.data?.Page?.media || []).forEach(function (m) {
                    var url = m.coverImage?.extraLarge || m.coverImage?.large || '';
                    if (m && m.id != null && url) out[String(m.id)] = url;
                });
            }
        } catch (err) {
            console.warn('getCoversByIds error:', err);
        }
        return out;
    };

    window.buscarEnApi = async function (query, categoria) {
        var type = (categoria === 'manga' || categoria === 'novelas') ? 'MANGA' : 'ANIME';
        var cacheKey = type + '_' + query.trim().toLowerCase();
        var cached = getSearchCache(cacheKey);
        if (cached) return cached;
        try {
            var perPage = AnimeDestiny.Constants.SEARCH_PAGE_SIZE || 10;
            var opts = { type: type, search: query };
            if (categoria === 'manga') {
                opts.formatIn = ['MANGA', 'ONE_SHOT'];
            } else if (categoria === 'novelas') {
                opts.formatIn = ['NOVEL'];
            } else if (type === 'ANIME') {
                opts.formatIn = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
            } else {
                opts.formatNot = 'NOVEL';
            }
            var qry = buildDynamicQuery(opts);
            var vars = { page: 1, perPage: perPage, search: query };
            var json = await anilistFetch(qry, vars);
            var media = json?.data?.Page?.media || [];
            var result = media.map(function (m) { return anilistItemToLocal(m, categoria || type); });
            setSearchCache(cacheKey, result, 300000);
            return result;
        } catch (err) {
            console.warn('AniList search error:', err);
            if (cached) return cached;
            return [];
        }
    };


    window.buscarNovelasEnApi = async function (query) {
        var cacheKey = 'novela_' + query.trim().toLowerCase();
        var cached = getSearchCache(cacheKey);
        if (cached) return cached;
        try {
            var perPage = AnimeDestiny.Constants.SEARCH_PAGE_SIZE || 10;
            var qry = buildDynamicQuery({ type: 'MANGA', search: query, formatIn: ['NOVEL'] });
            var vars = { page: 1, perPage: perPage, search: query };
            var json = await anilistFetch(qry, vars);
            var media = json?.data?.Page?.media || [];
            var result = media.map(function (m) { return anilistItemToLocal(m, 'novelas'); });
            setSearchCache(cacheKey, result, 300000);
            return result;
        } catch (err) {
            console.warn('AniList novel search error:', err);
            if (cached) return cached;
            return [];
        }
    };

    // ─── Personajes y actores de voz (staff) por ID ──────────────────────────
    // Alimentan personaje.html. Son otra entidad de AniList (Character / Staff),
    // no Media, así que van en su propia query y no salen de la ficha de la obra.

    // La categoría de detalle.html se deriva del tipo/formato AniList del media,
    // igual que en relatedCategory (render-sections del detalle): así el enlace a
    // una aparición cae en el catálogo correcto (anime / manga / novelas).
    function mediaCatFromTypeFormat(type, format) {
        if (format === 'NOVEL') return 'novelas';
        if (type === 'MANGA') return 'manga';
        return 'anime';
    }

    function pickTitle(t) {
        if (!t) return '';
        return t.english || t.romaji || t.native || '';
    }

    // AniList da la fecha como { year, month, day } con nulls sueltos. Se arma
    // solo con lo que haya; si no hay año no vale la pena mostrarla.
    function formatFuzzyDate(d) {
        if (!d || !d.year) return '';
        var meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        var partes = [];
        if (d.day) partes.push(String(d.day));
        if (d.month && meses[d.month]) partes.push(meses[d.month]);
        partes.push(String(d.year));
        return partes.join(' ');
    }

    var CHARACTER_BY_ID_QUERY = `
        query ($id: Int) {
            Character(id: $id) {
                id
                name { full native alternative }
                image { large }
                description(asHtml: false)
                gender
                age
                bloodType
                dateOfBirth { year month day }
                favourites
                media(sort: [POPULARITY_DESC], perPage: 24) {
                    edges {
                        characterRole
                        voiceActors(language: JAPANESE, sort: [RELEVANCE]) { id name { full } image { large } }
                        node {
                            id
                            type
                            format
                            title { romaji english native }
                            coverImage { large }
                        }
                    }
                }
            }
        }`;

    var STAFF_BY_ID_QUERY = `
        query ($id: Int) {
            Staff(id: $id) {
                id
                name { full native alternative }
                image { large }
                description(asHtml: false)
                languageV2
                primaryOccupations
                gender
                age
                homeTown
                dateOfBirth { year month day }
                favourites
                characters(sort: [FAVOURITES_DESC], perPage: 24) {
                    edges {
                        role
                        node { id name { full } image { large } }
                        media { id type format title { romaji english native } coverImage { large } }
                    }
                }
            }
        }`;

    function normalizeCharacter(c) {
        if (!c) return null;
        return {
            kind: 'character',
            id: c.id,
            name: c.name?.full || c.name?.native || '',
            native: c.name?.native || '',
            alternative: Array.isArray(c.name?.alternative) ? c.name.alternative.filter(Boolean) : [],
            image: c.image?.large || '',
            description: c.description || '',
            gender: c.gender || '',
            age: c.age || '',
            bloodType: c.bloodType || '',
            dateOfBirth: formatFuzzyDate(c.dateOfBirth),
            favourites: c.favourites || 0,
            // Apariciones: cada obra donde sale el personaje, con su seiyū en esa obra.
            appearances: (c.media?.edges || []).map(function (e) {
                var va = (e.voiceActors || [])[0] || null;
                var node = e.node || {};
                return {
                    id: node.id || null,
                    title: pickTitle(node.title),
                    cover: node.coverImage?.large || '',
                    cat: mediaCatFromTypeFormat(node.type, node.format),
                    role: e.characterRole || '',
                    vaId: va?.id || null,
                    vaName: va?.name?.full || '',
                    vaImage: va?.image?.large || ''
                };
            }).filter(function (a) { return a.title; })
        };
    }

    function normalizeStaff(s) {
        if (!s) return null;
        return {
            kind: 'staff',
            id: s.id,
            name: s.name?.full || s.name?.native || '',
            native: s.name?.native || '',
            alternative: Array.isArray(s.name?.alternative) ? s.name.alternative.filter(Boolean) : [],
            image: s.image?.large || '',
            description: s.description || '',
            language: s.languageV2 || '',
            occupations: Array.isArray(s.primaryOccupations) ? s.primaryOccupations.filter(Boolean) : [],
            gender: s.gender || '',
            age: s.age || '',
            homeTown: s.homeTown || '',
            dateOfBirth: formatFuzzyDate(s.dateOfBirth),
            favourites: s.favourites || 0,
            // Personajes interpretados: cada rol con la obra en la que aparece.
            roles: (s.characters?.edges || []).map(function (e) {
                var node = e.node || {};
                var media = (e.media || [])[0] || null;
                return {
                    charId: node.id || null,
                    charName: node.name?.full || '',
                    charImage: node.image?.large || '',
                    role: e.role || '',
                    mediaId: media?.id || null,
                    mediaTitle: pickTitle(media?.title),
                    mediaCover: media?.coverImage?.large || '',
                    mediaCat: media ? mediaCatFromTypeFormat(media.type, media.format) : 'anime'
                };
            }).filter(function (r) { return r.charName; })
        };
    }

    window.getCharacterById = async function (id) {
        var numId = Number(id);
        if (!Number.isFinite(numId) || numId <= 0) return null;
        var cacheKey = 'characterDetail_' + numId;
        var cached = getApiCache(cacheKey);
        if (cached) return cached;
        try {
            var json = await anilistFetch(CHARACTER_BY_ID_QUERY, { id: numId });
            var mapped = normalizeCharacter(json?.data?.Character || null);
            if (mapped) setApiCache(cacheKey, mapped);
            return mapped;
        } catch (err) {
            console.warn('AniList getCharacterById error:', err);
            return null;
        }
    };

    window.getStaffById = async function (id) {
        var numId = Number(id);
        if (!Number.isFinite(numId) || numId <= 0) return null;
        var cacheKey = 'staffDetail_' + numId;
        var cached = getApiCache(cacheKey);
        if (cached) return cached;
        try {
            var json = await anilistFetch(STAFF_BY_ID_QUERY, { id: numId });
            var mapped = normalizeStaff(json?.data?.Staff || null);
            if (mapped) setApiCache(cacheKey, mapped);
            return mapped;
        } catch (err) {
            console.warn('AniList getStaffById error:', err);
            return null;
        }
    };

    // ─── Estudios de animación por ID ─────────────────────────────────────────
    // Alimentan estudio.html. Studio es otra entidad de AniList (no Media): trae
    // el nombre, si es un estudio de animación y todas las obras que produjo,
    // marcando en cuáles fue el estudio principal.
    var STUDIO_BY_ID_QUERY = `
        query ($id: Int) {
            Studio(id: $id) {
                id
                name
                isAnimationStudio
                favourites
                media(sort: [POPULARITY_DESC], perPage: 48) {
                    edges {
                        isMainStudio
                        node {
                            id
                            type
                            format
                            seasonYear
                            averageScore
                            popularity
                            title { romaji english native }
                            coverImage { large }
                        }
                    }
                }
            }
        }`;

    function normalizeStudio(s) {
        if (!s) return null;
        var works = (s.media?.edges || []).map(function (e) {
            var node = e.node || {};
            return {
                id: node.id || null,
                title: pickTitle(node.title),
                cover: node.coverImage?.large || '',
                cat: mediaCatFromTypeFormat(node.type, node.format),
                format: node.format || '',
                year: node.seasonYear || null,
                score: node.averageScore || 0,
                popularity: node.popularity || 0,
                isMain: !!e.isMainStudio
            };
        }).filter(function (w) { return w.title && w.id; });

        // De-duplicar por id (una obra puede venir repetida entre temporadas).
        var seen = {};
        works = works.filter(function (w) {
            if (seen[w.id]) return false;
            seen[w.id] = true;
            return true;
        });

        return {
            kind: 'studio',
            id: s.id,
            name: s.name || '',
            isAnimationStudio: !!s.isAnimationStudio,
            favourites: s.favourites || 0,
            works: works
        };
    }

    window.getStudioById = async function (id) {
        var numId = Number(id);
        if (!Number.isFinite(numId) || numId <= 0) return null;
        var cacheKey = 'studioDetail_' + numId;
        var cached = getApiCache(cacheKey);
        if (cached) return cached;
        try {
            var json = await anilistFetch(STUDIO_BY_ID_QUERY, { id: numId });
            var mapped = normalizeStudio(json?.data?.Studio || null);
            if (mapped) setApiCache(cacheKey, mapped);
            return mapped;
        } catch (err) {
            console.warn('AniList getStudioById error:', err);
            return null;
        }
    };

    // Busca un estudio por nombre y devuelve su id (para enlazar desde el
    // detalle, que solo guarda los nombres de estudio, no sus ids). Cachea el
    // resultado por nombre normalizado.
    var STUDIO_SEARCH_QUERY = `
        query ($search: String) {
            Page(page: 1, perPage: 1) {
                studios(search: $search) { id name }
            }
        }`;

    window.getStudioIdByName = async function (name) {
        var q = String(name || '').trim();
        if (!q) return null;
        var cacheKey = 'studioId_' + q.toLowerCase();
        var cached = getApiCache(cacheKey);
        if (cached) return cached.id || null;
        try {
            var json = await anilistFetch(STUDIO_SEARCH_QUERY, { search: q });
            var st = (json?.data?.Page?.studios || [])[0] || null;
            if (st && st.id) {
                setApiCache(cacheKey, { id: st.id }, 7 * 24 * 60 * 60 * 1000);
                return st.id;
            }
            return null;
        } catch (err) {
            console.warn('AniList getStudioIdByName error:', err);
            return null;
        }
    };

})();


/* ========================================== */
/* === FILE: js/core/api-mangadex.js === */
/* ========================================== */

// js/core/api-mangadex.js
// Cliente de MangaDex, extraído de js/core/api.js. Es su propio IIFE, con el
// mapa de tags, el fetch HTTP y los helpers de tarjeta/merge. Se expone en
// window lo que consumen otros módulos (mangadex-api.js, catalog/search.js,
// pages/comparar.js) y lo que api.js necesita para suplementar el catálogo
// (mdTagUuidsFromKeys, fetchMangaDexPage, mergeAnilistAndMd).
//
// Va en el bundle junto a api.js. Como api.js solo llama a estas funciones en
// tiempo de ejecución (dentro de getTopMangas/getTopNovelas), el orden de carga
// entre ambos no afecta la corrección.
(function () {
    "use strict";

    // Mismo timeout que usa api.js; se deriva de las constantes en vez de
    // depender del IIFE de api.js.
    var REQUEST_TIMEOUT = AnimeDestiny.Constants.REQUEST_TIMEOUT_MS || 12000;

    var MD_TAG_UUIDS = {
        '4-koma':'b11fda93-8f1d-4bef-b2ed-8803d3733170','action':'391b0423-d847-456f-aff0-8b0cfc03066b',
        'adaptation':'f4122d1c-3b44-44d0-9936-ff7502c39ad3','adventure':'87cc87cd-a395-47af-b27a-93258283bbc6',
        'aliens':'e64f6742-c834-471d-8d72-dd51fc02b835','animals':'3de8c75d-8ee3-48ff-98ee-e20a65c86451',
        'anthology':'51d83883-4103-437c-b4b1-731cb73d786c','award winning':'0a39b5a1-b235-4886-a747-1d05d216532d',
        'boys\' love':'5920b825-4181-4a17-beeb-9918b0ff7a30','comedy':'4d32cc48-9f00-4cca-9b5a-a839f0764984',
        'cooking':'ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869','crime':'5ca48985-9a9d-4bd8-be29-80dc0303db72',
        'crossdressing':'9ab53f92-3eed-4e9b-903a-917c86035ee3','delinquents':'da2d50ca-3018-4cc0-ac7a-6b7d472a29ea',
        'demons':'39730448-9a5f-48a2-85b0-a70db87b1233','doujinshi':'b13b2a48-c720-44a9-9c77-39c9979373fb',
        'drama':'b9af3a63-f058-46de-a9a0-e0c13906197a','fantasy':'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
        'full color':'f5ba408b-0e7a-484d-8d49-4e9125ac96de','genderswap':'2bd2e8d0-f146-434a-9b51-fc9ff2c5fe6a',
        'ghost':'3bb26d85-09d5-4d2e-880c-c34b974339e9','ghosts':'3bb26d85-09d5-4d2e-880c-c34b974339e9',
        'girls\' love':'a3c67850-4684-404e-9b7f-c69850ee5da6','gore':'b29d6a3d-1569-4e7a-8caf-7557bc92cd5d',
        'gyaru':'fad12b5e-68ba-460e-b933-9ae8318f5b65','harem':'aafb99c1-7f60-43fa-b75f-fc9502ce29c7',
        'historical':'33771934-028e-4cb3-8744-691e866a923e','horror':'cdad7e68-1419-41dd-bdce-27753074a640',
        'incest':'5bd0e105-4481-44ca-b6e7-7544da56b1a3','isekai':'ace04997-f6bd-436e-b261-779182193d3d',
        'loli':'2d1f5d56-a1e5-4d0d-a961-2193588b08ec','long strip':'3e2b8dae-350e-4ab8-a8ce-016e844b9f0d',
        'mafia':'85daba54-a71c-4554-8a28-9901a8b0afad','magic':'a1f53773-c69a-4ce5-8cab-fffcd90b1565',
        'magical girls':'81c836c9-914a-4eca-981a-560dad663e73','martial arts':'799c202e-7daa-44eb-9cf7-8a3c0441531e',
        'mecha':'50880a9d-5440-4732-9afb-8f457127e836','medical':'c8cbe35b-1b2b-4a3f-9c37-db84c4514856',
        'military':'ac72833b-c4e9-4878-b9db-6c8a4a99444a','monster':'36fd93ea-e8b8-445e-b836-358f02b3d33d',
        'monster girls':'dd1f77c5-dea9-4e2b-97ae-224af09caf99','monsters':'36fd93ea-e8b8-445e-b836-358f02b3d33d',
        'music':'f42fbf9e-188a-447b-9fdc-f19dc1e4d685','mystery':'ee968100-4191-4968-93d3-f82d72be7e46',
        'ninja':'489dd859-9b61-4c37-af75-5b18e88daafc','office workers':'92d6d951-ca5e-429c-ac78-451071cbf064',
        'oneshot':'0234a31e-a729-4e28-9d6a-3f87c4966b9e','philosophical':'b1e97889-25b4-4258-b28b-cd7f4d28ea9b',
        'police':'df33b754-73a3-4c54-80e6-1a74a8058539','post-apocalyptic':'9467335a-1b83-4497-9231-765337a00b96',
        'psychological':'3b60b75c-a2d7-4860-ab56-05f391bb889c','reincarnation':'0bc90acb-ccc1-44ca-a34a-b9f3a73259d0',
        'reverse harem':'65761a2a-415e-47f3-bef2-a9dababba7a6','romance':'423e2eae-a7a2-4a8b-ac03-a8351462d71d',
        'samurai':'81183756-1453-4c81-aa9e-f6e1b63be016','school life':'caaa44eb-cd40-4177-b930-79d3ef2afe87',
        'sci-fi':'256c8bd9-4904-4360-bf4f-508a76d67183','self-published':'891cf039-b895-47f0-9229-bef4c96eccd4',
        'shota':'ddefd648-5140-4e5f-ba18-4eca4071d19b','slice of life':'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
        'sports':'69964a64-2f90-4d33-beeb-f3ed2875eb4c','superhero':'7064a261-a137-4d3a-8848-2d385de3a99c',
        'supernatural':'eabc5b4c-6aff-42f3-b657-3e90cbd00b75','survival':'5fff9cde-849c-4d78-aab0-0d52b2ee1d25',
        'thriller':'07251805-a27e-4d59-b488-f0bfbec15168','time travel':'292e862b-2d17-4062-90a2-0356caa4ae27',
        'tragedy':'f8f62932-27da-4fe4-8ee1-6779a8c5edba','traditional games':'31932a7e-5b8e-49a6-9f12-2afa39dc544c',
        'vampire':'d7d1730f-6eb0-4ba6-9437-602cac38664c','vampires':'d7d1730f-6eb0-4ba6-9437-602cac38664c',
        'video games':'9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8','villainess':'d14322ac-4d6f-4e9b-afd9-629d5f4d8a41',
        'virtual reality':'8c86611e-fab7-4986-9dec-d1a2f44acdd5','web comic':'e197df38-d0e7-43b5-9b09-2842d0c326dd',
        'wuxia':'acc803a4-c95a-4c22-86fc-eb6b582d82a2','zombie':'631ef465-9aba-4afb-b0fc-ea10efe274a8',
        'zombies':'631ef465-9aba-4afb-b0fc-ea10efe274a8'
    };

    function mdFetch(path) {
        return new Promise(function (resolve, reject) {
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); reject(new Error('Timeout')); }, REQUEST_TIMEOUT);
            fetch('https://api.mangadex.org' + path, {
                method: 'GET', headers: { 'Accept': 'application/json' }, signal: controller.signal
            }).then(function (res) {
                clearTimeout(timer);
                if (!res.ok) return res.text().then(function (t) { reject(new Error('MD HTTP ' + res.status)); });
                return res.json();
            }).then(function (json) {
                if (json.errors) { reject(new Error('MD error: ' + (json.errors[0]?.detail || '?'))); return; }
                resolve(json);
            }).catch(function (err) { clearTimeout(timer); reject(err); });
        });
    }

    var MD_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Puntaje y seguidores de varias obras de MangaDex en un solo request
     * (`/statistics/manga` acepta hasta 100 ids por llamada).
     *
     * `/manga` no devuelve nada de esto, asi que las obras servidas por
     * MangaDex salian siempre con score null: en el catalogo quedaban con el
     * puntaje vacio al lado de las de AniList, que si lo traen.
     *
     * Se usa el bayesiano y no el promedio crudo: el crudo le da 10 a una obra
     * con tres votos y la pondria arriba de cualquier clasico.
     *
     * Vive aca (y no en js/core/mangadex-api.js) porque el catalogo lo necesita
     * en paginas que no cargan ese archivo, como los carruseles del index.
     */
    async function fetchMangaDexStats(ids) {
        var lista = (ids || []).filter(function (id) { return MD_UUID_RE.test(String(id || '')); });
        if (!lista.length) return {};
        var path = '/statistics/manga?' + lista.slice(0, 100).map(function (id) {
            return 'manga[]=' + encodeURIComponent(id);
        }).join('&');
        var json = await mdFetch(path);
        var stats = json?.statistics || {};
        var out = {};
        Object.keys(stats).forEach(function (id) {
            var s = stats[id] || {};
            var raw = s.rating?.bayesian ?? s.rating?.average;
            var score = Number(raw);
            out[id] = {
                score: Number.isFinite(score) && score > 0 ? Math.round(score * 10) / 10 : null,
                follows: Number(s.follows) || 0
            };
        });
        return out;
    }

    function mdItemToCard(data) {
        if (!data?.attributes) return null;
        var a = data.attributes;
        var id = data.id;
        var title = (a.title?.en || a.title?.['ja-ro'] || a.title?.ja || Object.values(a.title || {})[0] || '');
        var desc = (a.description?.en || a.description?.es || Object.values(a.description || {})[0] || '');
        var coverUrl = '';
        var rels = data.relationships || [];
        var coverArt = rels.find(function (r) { return r.type === 'cover_art'; });
        if (coverArt?.attributes?.fileName) coverUrl = 'https://uploads.mangadex.org/covers/' + id + '/' + coverArt.attributes.fileName;
        if (!coverUrl) coverUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect fill='%231a0a2e' width='200' height='300'/%3E%3Ctext x='50%25' y='50%25' fill='%23a855f7' font-family='sans-serif' font-size='13' text-anchor='middle' dominant-baseline='middle'%3ESin portada%3C/text%3E%3C/svg%3E";
        var genres = (a.tags || []).filter(function (t) { return t.attributes?.group === 'genre' || t.attributes?.group === 'theme'; }).map(function (t) { return { name: (t.attributes?.name?.en || '') }; }).filter(function (g) { return g.name; });
        var chCnt = a.lastChapter ? Math.ceil(Number(a.lastChapter)) || 0 : 0;
        var volCnt = a.lastVolume ? Math.ceil(Number(a.lastVolume)) || 0 : 0;
        var status = a.status === 'completed' ? 'FINISHED' : (a.status === 'ongoing' ? 'RELEASING' : (a.status === 'hiatus' ? 'HIATUS' : 'UNKNOWN'));
        var friendlyType = 'Manga';
        var lang = String(a.originalLanguage || '').toLowerCase();
        if (lang === 'ko') friendlyType = 'Manhwa';
        else if (lang === 'zh' || lang === 'zh-hk' || lang === 'zh-tw') friendlyType = 'Manhua';
        else {
            var hasD = (a.tags || []).some(function (t) { return String(t.attributes?.name?.en || '').toLowerCase() === 'doujinshi'; });
            var hasO = (a.tags || []).some(function (t) { var n = String(t.attributes?.name?.en || '').toLowerCase(); return n === 'one shot' || n === 'oneshot'; });
            if (hasD) friendlyType = 'Doujinshi';
            else if (hasO) friendlyType = 'One-shot';
        }
        return {
            id: id, mal_id: null, title: title, title_english: title, synopsis: desc || 'Sin sinopsis.',
            status: status, type: friendlyType, episodes: 0, chapters: chCnt, volumes: volCnt, score: null,
            images: { webp: { large_image_url: coverUrl, image_url: coverUrl }, jpg: { large_image_url: coverUrl, image_url: coverUrl } },
            genres: genres, themes: [], studios: [], relations: [],
            season: null, seasonYear: null, source: null, duration: null, countryOfOrigin: a.originalLanguage || null
        };
    }

    function mdTagUuidsFromKeys(keys) {
        var uuids = [];
        (keys || []).forEach(function (k) {
            var norm = String(k).toLowerCase().replace(/[\s-]/g, '');
            for (var name in MD_TAG_UUIDS) {
                if (name.toLowerCase().replace(/[\s-]/g, '') === norm) { uuids.push(MD_TAG_UUIDS[name]); break; }
            }
        });
        return uuids;
    }

    async function fetchMangaDexPage(page, perPage, tagUuids, search) {
        var params = '?limit=' + perPage + '&offset=' + ((page - 1) * perPage) + '&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica';
        if (search) params += '&title=' + encodeURIComponent(search);
        tagUuids.forEach(function (u) { params += '&includedTags[]=' + u; });
        try {
            var json = await mdFetch('/manga' + params);
            var cards = (json?.data || []).map(function (m) { return mdItemToCard(m); }).filter(Boolean);

            // Un request extra por pagina completa el puntaje de todas las cards
            // de una. Es best-effort: si falla, quedan como estaban (sin score).
            try {
                var stats = await fetchMangaDexStats(cards.map(function (c) { return c.id; }));
                cards.forEach(function (c) {
                    var s = stats[c.id];
                    if (s) { c.score = s.score; c.follows = s.follows; }
                });
            } catch (e) { console.warn('fetchMangaDexStats failed:', e); }

            return cards;
        } catch (e) { console.warn('fetchMangaDexPage failed:', e); return []; }
    }

    function normalizeTitle(t) {
        return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    }

    function mergeAnilistAndMd(anilistItems, mdItems) {
        var seen = new Set();
        anilistItems.forEach(function (item) { seen.add(normalizeTitle(item.title)); });
        mdItems.forEach(function (item) {
            var key = normalizeTitle(item.title);
            if (!seen.has(key)) { seen.add(key); anilistItems.push(item); }
        });
        return anilistItems;
    }

    // ── Exposición en window ──
    // Cliente HTTP de MangaDex compartido: js/core/mangadex-api.js tenia una
    // copia casi identica de mdFetch (mismo AbortController, timeout y manejo de
    // errores). Se expone la del bundle para no mantener dos. fetchMangaDexPage,
    // fetchMangaDexStats y mergeAnilistAndMd las usan catalog/search.js y
    // pages/comparar.js; mdTagUuidsFromKeys la usa api.js.
    window.mdFetch = mdFetch;
    window.fetchMangaDexPage = fetchMangaDexPage;
    window.fetchMangaDexStats = fetchMangaDexStats;
    window.mergeAnilistAndMd = mergeAnilistAndMd;
    window.mdTagUuidsFromKeys = mdTagUuidsFromKeys;

})();


/* ========================================== */
/* === FILE: js/datos.js === */
/* ========================================== */

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    };
}

if (typeof window.safeUrl !== 'function') {
    window.safeUrl = function(value) {
        if (!value) return '';
        var url = String(value).trim();
        // Rechazar caracteres que rompen un atributo src="..." (XSS breakout)
        if (/["`<>\\]/.test(url) || /[\x00-\x1f\x7f]/.test(url)) {
            return '';
        }
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === 'http:' ||
                parsed.protocol === 'https:' ||
                (parsed.protocol === 'data:' && url.toLowerCase().startsWith('data:image/'))
            ) {
                return url;
            }
        } catch (_) {}
        return '';
    };
}

/** Helper to capitalize first letter */
function _capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/** Obtiene los items de una categoría (anime, manga, novelas) delegando a la API */
function obtenerItemsCategoria(categoria) {
    const base = 'getTop' + _capitalize(categoria);
    // Algunas categorías usan plural en el nombre global
    const fn = window[base] || window[base + 's'];
    if (typeof fn === 'function') {
        return fn(); // devuelve una Promise de array
    }
    return [];
}

/** Obtiene un item específico de una categoría */
function obtenerItemCategoria(categoria, id) {
    return obtenerItemsCategoria(categoria).then(items => items.find(i => i.id == id) || null);
}

/** Obtiene el detalle de un item */
// Implementación completa de obtenerDetalleItem
function obtenerDetalleItem(categoria, id) {
    const fn = window['get' + _capitalize(categoria) + 'ById'];
    if (typeof fn === 'function') {
        return fn(id); // devuelve Promise
    }
    return Promise.resolve(null);
}





/* ========================================== */
/* === FILE: js/core/user-store.js === */
/* ========================================== */

(function(window) {
    "use strict";

    // UserStore — caché en memoria + notifica cambios para sync automático.
    // Los datos persistentes viven en Supabase (item_states, progress_keys, profiles).
    // No se escribe a localStorage para evitar divergencias.

    class MemoryStore {
        constructor() {
            this._data = new Map();
            this._subscribers = [];
        }

        subscribe(fn) {
            this._subscribers.push(fn);
            return () => {
                var idx = this._subscribers.indexOf(fn);
                if (idx !== -1) this._subscribers.splice(idx, 1);
            };
        }

        getItem(key)    { return this._data.has(key) ? String(this._data.get(key)) : null; }

        setItem(key, value) {
            this._data.set(String(key), String(value));
            this._notify(String(key), String(value));
        }

        removeItem(key) {
            this._data.delete(String(key));
            this._notify(String(key), null);
        }

        clear() {
            this._data.clear();
        }

        keys()          { return Array.from(this._data.keys()); }

        _notify(key, value) {
            for (var i = 0; i < this._subscribers.length; i++) {
                try { this._subscribers[i](key, value); } catch (e) { /* ignore */ }
            }
        }
    }

    window.UserStore = new MemoryStore();
})(window);


/* ========================================== */
/* === FILE: js/core/storage.js === */
/* ========================================== */

/**
 * storage.js — Wrapper de localStorage con soporte JSON.
 * Disponible como window.AppStorage para uso futuro (persistencia offline, cache).
 */
(function (window) {
    "use strict";

    var PREFIX = (window.AppConfig && window.AppConfig.cachePrefix) || "animeDestiny";

    function read(key) {
        try { return localStorage.getItem(PREFIX + ":" + key); } catch (_) { return null; }
    }

    function write(key, value) {
        try { localStorage.setItem(PREFIX + ":" + key, String(value)); } catch (_) {}
    }

    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(PREFIX + ":" + key);
            return raw ? JSON.parse(raw) : (fallback || null);
        } catch (_) { return fallback || null; }
    }

    function writeJson(key, obj) {
        try { localStorage.setItem(PREFIX + ":" + key, JSON.stringify(obj)); } catch (_) {}
    }

    function remove(key) {
        try { localStorage.removeItem(PREFIX + ":" + key); } catch (_) {}
    }

    window.AppStorage = Object.freeze({
        read: read,
        write: write,
        readJson: readJson,
        writeJson: writeJson,
        remove: remove
    });

})(window);


/* ========================================== */
/* === FILE: js/core/auth.js === */
/* ========================================== */

(function (window, document) {
    "use strict";

    // ─────────────────────────────────────────────
    // Supabase es la ÚNICA fuente de verdad de sesión.
    // No se usa localStorage para tokens ni usuarios.
    // ─────────────────────────────────────────────

async function waitForSupabase() {
        if (window.AppSupabase) return window.AppSupabase;

        // Carga diferida del SDK (~216 KB). Si no hay token guardado, no
        // estamos en Login y la URL no trae tokens, con certeza no hay sesión:
        // se devuelve null sin descargar nada. Cargarlo sólo para que conteste
        // "no hay usuario" era el motivo de que pesara en toda visita anónima.
        if (typeof window.__puedeHaberSesion === 'function' && !window.__puedeHaberSesion()) {
            return null;
        }
        if (typeof window.__loadSupabase === 'function') {
            var cliente = await window.__loadSupabase();
            if (cliente) return cliente;
        }

        var promises = [];
        if (window.AppSupabaseReady) promises.push(window.AppSupabaseReady);
        promises.push(new Promise(r => {
            var onReady = function () { window.removeEventListener('supabase-ready', onReady); r(window.AppSupabase); };
            window.addEventListener('supabase-ready', onReady, { once: true });
            setTimeout(function () { window.removeEventListener('supabase-ready', onReady); r(null); }, AnimeDestiny.Constants.SUPABASE_WAIT_TIMEOUT_MS || 12000);
        }));
        return await Promise.race(promises);
    }
    async function getCurrentUser() {
        const client = await waitForSupabase();
        if (!client?.client) return null;

        // getUser() verifica de forma segura la sesión persistida en el almacenamiento
        const { data } = await client.client.auth.getUser();
        return data?.user ?? null;
    }

    // Nombre visible basado en la metadata de Supabase
    function displayNameFromUser(user) {
        if (!user) return "Invitado";
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] || 
            "Usuario"
        );
    }
    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────

    function setMsg(text) {
        const msg = document.getElementById("userModalMsg");
        if (msg) msg.textContent = text || "";
    }

    function displayNameFromProfile(user, profile) {
        if (profile?.display_name) return profile.display_name;
        return displayNameFromUser(user);
    }

    function photoUrlFromProfile(user, profile) {
        if (profile?.photo_url) return profile.photo_url;
        return user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    }

    // Etiquetas de apodo para el badge del navbar. Debe seguir en sincronía
    // con APODOS en js/pages/mis-listas.js: un id que falte aca hace que el
    // badge desaparezca del navbar apenas el usuario equipa ese apodo.
    const APODO_LABELS = {
        novato: 'Novato',
        corazon: 'Corazón de Otaku',
        coleccionista: 'Coleccionista',
        observador: 'Observador',
        devorador: 'Devorador de Mundos',
        primer_paso: 'Un Pasito',
        maratonista: 'Maratonista',
        veterano: 'Veterano',
        leyenda: 'Leyenda Destiny',
        hechicero_actual: 'El Hechicero Más Fuerte Actual',
        hechicero_historia: 'El Hechicero Más Fuerte de la Historia',
        rey_piratas: 'El Próximo Rey de los Piratas',
        hokage: 'Séptimo Hokage',
        soldado: 'El Soldado Más Fuerte de la Humanidad',
        espadachin_negro: 'El Espadachín Negro',
        monarca: 'Monarca de las Sombras',
        simbolo_paz: 'El Símbolo de la Paz',
        pilar: 'Pilar del Agua',
        kira: 'Kira'
    };

    async function resolveGrade(profile) {
        // 1) Del perfil global si ya está cargado (usuario.html)
        let apodoId = (profile && profile.apodo) || null;
        // 2) Si no, intentar traerlo desde Supabase (consulta liviana)
        if (!apodoId && window.AppSupabase && typeof window.AppSupabase.loadApodo === 'function') {
            try { apodoId = await window.AppSupabase.loadApodo(); } catch (_) { apodoId = null; }
        }
        if (!apodoId) return '';
        return APODO_LABELS[apodoId] || '';
    }

  async function refreshUserUi() {
        const user = await getCurrentUser();
        // Intentar usar perfil guardado globalmente (lo setea usuario.html)
        const profile = window.__profileData || null;
        const username = displayNameFromProfile(user, profile);
        
        const userBtn = document.getElementById("auth-user-btn") || document.getElementById("userBtn") || document.getElementById("user-profile");
        if (userBtn) {
            if (user) {
                userBtn.textContent = username;
                userBtn.classList.add("logged-in");
            } else {
                userBtn.textContent = "Cuenta";
                userBtn.classList.remove("logged-in");
            }
        }

        // Área de usuario en navbar (avatar + nombre + botón de acción)
        const nameEl = document.getElementById('nav-user-name');
        const btnEl = document.getElementById('nav-user-btn');
        const avatarEl = document.getElementById('nav-user-avatar');
        const gradeEl = document.getElementById('nav-user-grade');
        if (nameEl && btnEl && avatarEl) {
            if (user) {
                nameEl.textContent = username;
                btnEl.textContent = 'Cuenta';
                btnEl.href = 'usuario.html';
                btnEl.setAttribute('aria-label', 'Ver perfil de ' + username);
                const photoUrl = photoUrlFromProfile(user, profile);
                if (photoUrl && (typeof window.safeUrl !== 'function' || window.safeUrl(photoUrl))) {
                    avatarEl.classList.add('has-image');
                    var cleanUrl = photoUrl.replace(/[\\"'()]/g, '');
                    avatarEl.style.backgroundImage = 'url("' + cleanUrl + '")';
                } else {
                    avatarEl.classList.remove('has-image');
                    avatarEl.style.removeProperty('background-image');
                }
                // Badge de apodo. Se resuelve async para no demorar el nombre.
                // Sin el prefijo "GRADO:": los apodos largos de franquicia ya
                // rozan el max-width del badge, y el nombre solo se entiende igual.
                if (gradeEl) {
                    resolveGrade(profile).then(function (label) {
                        if (label) {
                            gradeEl.textContent = label;
                            gradeEl.title = label;
                            gradeEl.hidden = false;
                        } else {
                            gradeEl.hidden = true;
                            gradeEl.textContent = '';
                            gradeEl.removeAttribute('title');
                        }
                    });
                }
            } else {
                nameEl.textContent = 'Invitado';
                btnEl.textContent = 'Ingresar';
                btnEl.href = 'Login.html';
                btnEl.setAttribute('aria-label', 'Iniciar sesión');
                avatarEl.classList.remove('has-image');
                avatarEl.style.removeProperty('background-image');
                if (gradeEl) { gradeEl.hidden = true; gradeEl.textContent = ''; }
            }
        }
    }

    function closeUserModal() {
        document.getElementById("userModal")?.classList.remove("is-open");
    }

    function isValidGmailAddress(value) {
        return /^[^\s@]+@gmail\.com$/i.test(String(value || "").trim());
    }

    async function loginWithPassword(mode) {
        const username  = String(document.getElementById("userNameInput")?.value  || "").trim();
        const email     = String(document.getElementById("userEmailInput")?.value || "").trim();
        const password  = String(document.getElementById("userPassInput")?.value  || "");

        const loginEmail = email || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(username) ? username : "");

        if (!username && !email) return setMsg("Escribí un nombre de usuario o correo.");
        if (mode === "create" && username.length < (AnimeDestiny.Constants.MIN_USERNAME_LENGTH || 3)) return setMsg("El usuario debe tener al menos 3 caracteres.");
        if (mode === "create" && !isValidGmailAddress(email)) return setMsg("Usá un correo @gmail.com válido.");
        if (!password || password.length < (AnimeDestiny.Constants.MIN_PASSWORD_LENGTH || 6)) return setMsg("La contraseña debe tener al menos 6 caracteres.");

        setMsg(mode === "create" ? "Creando cuenta..." : "Iniciando sesión...");

        const client = await waitForSupabase();
        if (!client?.client) {
            setMsg("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
            return;
        }

        if (mode === "create") {
            try {
                const { data, error } = await client.client.auth.signUp({
                    email,
                    password,
                    options: { data: { username, name: username, full_name: username } }
                });

                if (error) {
                    if (error.message?.toLowerCase().includes("already registered") ||
                        error.message?.toLowerCase().includes("already exists")) {
                        setMsg("Ese correo ya tiene una cuenta. Iniciá sesión en cambio.");
                    } else if (error.message?.toLowerCase().includes("invalid email")) {
                        setMsg("El correo ingresado no es válido.");
                    } else if (error.message?.toLowerCase().includes("password")) {
                        setMsg("La contraseña es muy débil. Usá al menos 6 caracteres.");
                    } else {
                        setMsg("Error al crear cuenta. Intentá de nuevo.");
                    }
                    return;
                }

                if (data?.user && !data?.session) {
                    setMsg("✅ Cuenta creada. Revisá tu correo para confirmarla.");
                    window.setTimeout(closeUserModal, 2500);
                    return;
                }

                if (data?.session) {
                    await refreshUserUi();
                    setMsg("✅ Cuenta creada exitosamente.");
                    window.setTimeout(closeUserModal, 800);
                    return;
                }

                setMsg("Cuenta creada. Iniciá sesión para continuar.");
                window.setTimeout(closeUserModal, 1500);

            } catch (err) {
                console.error("Error inesperado al crear cuenta:", err);
                setMsg("Sin conexión al servidor. Revisá tu internet e intentá de nuevo.");
            }
            return;
        }

        if (!loginEmail) {
            setMsg("Ingresá tu correo electrónico para iniciar sesión.");
            return;
        }

        try {
            const { data, error } = await client.client.auth.signInWithPassword({
                email: loginEmail,
                password
            });

            if (error) {
                if (error.message?.toLowerCase().includes("invalid login") ||
                    error.message?.toLowerCase().includes("invalid credentials")) {
                    setMsg("Correo o contraseña incorrectos.");
                } else if (error.message?.toLowerCase().includes("email not confirmed")) {
                    setMsg("Confirmá tu correo antes de iniciar sesión.");
                } else if (error.message?.toLowerCase().includes("network") ||
                           error.message?.toLowerCase().includes("fetch")) {
                    setMsg("Sin conexión al servidor. Revisá tu internet e intentá de nuevo.");
                } else {
                    setMsg("Error al iniciar sesión. Intentá de nuevo.");
                }
                return;
            }

            if (data?.user) {
                await refreshUserUi();
                setMsg("");
                window.setTimeout(closeUserModal, 600);
                return;
            }

            setMsg("No se pudo iniciar sesión. Intentá de nuevo.");

        } catch (err) {
            console.error("Error inesperado al iniciar sesión:", err);
            setMsg("Sin conexión al servidor. Revisá tu internet e intentá de nuevo.");
        }
    }

    async function logoutUser() {
        const client = await waitForSupabase();
        if (client?.client) {
            try {
                await client.client.auth.signOut();
            } catch (err) {
                console.warn("No se pudo cerrar sesión de Supabase:", err);
            }
        }
        if (window.UserStore) window.UserStore.clear();
        await refreshUserUi();
    }

    // ─────────────────────────────────────────────
    // Navbar
    // ─────────────────────────────────────────────

   function ensureUserUi() {
        const userBtn = document.getElementById("auth-user-btn") || document.getElementById("userBtn") || document.getElementById("user-profile");
        if (userBtn && !userBtn.dataset.authInitialized) {
            userBtn.textContent = "..."; // Estado de carga temporal seguro
            userBtn.dataset.authInitialized = "true";
        }
    }

    // ─────────────────────────────────────────────
    function grantDailyLoginBonus() {
        var client = window.AppSupabase;
        var user = client && typeof client.getCurrentUserSync === 'function' ? client.getCurrentUserSync() : null;
        if (!user) return;
        var today = new Date().toISOString().split('T')[0];
        var key = 'lastDailyLogin:' + user.id;
        if (localStorage.getItem(key) === today) return;
        localStorage.setItem(key, today);
        var delta = AnimeDestiny.Constants.XP_LOGIN || 10;
        if (typeof addUserPoints === 'function') {
            addUserPoints(user.id, delta);
        } else if (client && typeof client.addExperience === 'function') {
            client.addExperience(delta);
            var pts = Number(UserStore.getItem('u:' + user.id + '|points') || '0');
            UserStore.setItem('u:' + user.id + '|points', String(pts + delta));
        }
        if (window.Toast) {
            setTimeout(function () {
                window.Toast.success("¡Bienvenido! (+" + delta + " EXP por login diario)");
            }, 800);
        }
    }

    // Escuchar cambios de sesión de Supabase
    // ─────────────────────────────────────────────

    // Evento disparado por supabase-config.js
    window.addEventListener("supabase-auth-changed", function () {
        refreshUserUi();
        if (window.AppSupabase && !window.AppSupabase.isSignedIn()) {
            if (window.UserStore) window.UserStore.clear();
        } else if (window.AppSupabase && window.AppSupabase.isSignedIn()) {
            grantDailyLoginBonus();
        }
    });

    waitForSupabase().then((client) => {
        if (client && typeof client.onAuthChange === "function") {
            client.onAuthChange(() => {
                refreshUserUi();
                if (!client.isSignedIn()) {
                    if (window.UserStore) window.UserStore.clear();
                }
            });
        }
    }).catch((err) => console.error("Error al registrar onAuthChange:", err));
    // ─────────────────────────────────────────────
    // API pública mínima — solo lo que otros módulos necesitan
    // ─────────────────────────────────────────────
window.getCurrentUser      = getCurrentUser;
    window.waitForSupabase     = waitForSupabase;
    window.ensureUserUi        = ensureUserUi;
    window.refreshUserUi       = refreshUserUi;
    window.logoutUser          = logoutUser;
    // Traduce el id de apodo guardado en el perfil a su etiqueta visible.
    // Lo usa el ranking (y quien necesite mostrar apodos fuera de mis-listas)
    // para no mantener una tercera copia de APODO_LABELS.
    window.apodoLabel          = function (id) { return APODO_LABELS[id] || ''; };

    // Ejecución segura al cargar el DOM
    document.addEventListener('DOMContentLoaded', async () => {
        ensureUserUi();       // Crea el estado de carga neutro (...)
        await refreshUserUi(); // Espera a Supabase y pinta el usuario correcto o el botón de cuenta
    });

})(window, document);





/* ========================================== */
/* === FILE: js/security/sanitizer.js === */
/* ========================================== */

(function (window) {
    "use strict";

    function escapeHtml(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeUrl(value) {
        if (!value) return "";
        var url = String(value).trim();
        // Rechazar caracteres que rompen un atributo src="..." entrecomillado
        // o el tag (defensa XSS por breakout). Se permiten espacios y comillas
        // simples porque los data:image/svg de fallback los usan y son inocuos
        // dentro de un atributo con comillas dobles.
        if (/["`<>\\]/.test(url) || /[\x00-\x1f\x7f]/.test(url)) {
            return "";
        }
        // Permitir rutas relativas locales y data URIs de imagen usadas como fallback.
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === "http:" ||
                parsed.protocol === "https:" ||
                (parsed.protocol === "data:" && url.toLowerCase().startsWith("data:image/"))
            ) {
                return url;
            }
        } catch (_) { }
        return "";
    }

    window.escapeHtml = escapeHtml;
    window.safeUrl = safeUrl;
})(window);


/* ========================================== */
/* === FILE: js/security/validator.js === */
/* ========================================== */

(function (window) {
    "use strict";

    const CATEGORY_SET = new Set(["anime", "manga", "novelas", "detalle"]);

    function isValidCategory(value) {
        return CATEGORY_SET.has(String(value || "").toLowerCase());
    }

    function isValidId(value) {
        return /^[a-z]?\d+$/i.test(String(value || "").trim());
    }

    function getSafeCategory(value, fallback = "manga") {
        const category = String(value || "").toLowerCase();
        return isValidCategory(category) ? category : fallback;
    }

    function getSafeUrlParams(search = window.location.search) {
        const params = new URLSearchParams(search);
        const id = params.get("id") || "";
        const cat = params.get("cat") || params.get("categoria") || "";
        return {
            id: isValidId(id) ? id : "",
            nombre: params.get("nombre") || "",
            cat: getSafeCategory(cat, "manga")
        };
    }

    window.AppValidator = Object.freeze({
        isValidCategory,
        isValidId,
        getSafeCategory,
        getSafeUrlParams
    });
})(window);


/* ========================================== */
/* === FILE: js/utils.js === */
/* ========================================== */

(function (window) {
    "use strict";

    // Traduce los enums de estado de AniList/MangaDex para mostrarlos.
    // Cualquier valor no reconocido (datos locales viejos ya en español) pasa tal cual.
    // Vive en el bundle y no en detalle/render.js porque comparar.js tambien lo
    // necesita, y esa pagina no carga los scripts de detalle.
    function formatMediaStatus(status, categoria) {
        const enPublicacion = categoria === 'manga' || categoria === 'novelas';
        const map = {
            RELEASING: enPublicacion ? 'En publicación' : 'En emisión',
            FINISHED: 'Finalizado',
            NOT_YET_RELEASED: 'Próximamente',
            HIATUS: 'En pausa',
            CANCELLED: 'Cancelado'
        };
        return map[String(status || '').toUpperCase()] || status;
    }

    function formatDate(value, locale = "es-AR") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat(locale).format(date);
    }

    function truncateText(value, maxLength = AnimeDestiny.Constants.TRUNCATE_MAX_LENGTH || 140) {
        const text = String(value ?? "").trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
    }

    function parseUrlParams(search = window.location.search) {
        return Object.fromEntries(new URLSearchParams(search).entries());
    }

    function normalizeText(value) {
        return String(value ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "");
    }

    window.normalizeText = normalizeText;

    function getCurrentUserId() {
        const user = window.AppSupabase?.getCurrentUserSync?.()
                  || window.AppSupabase?.client?.auth?.user?.()
                  || null;
        if (!user) return 'Invitado';
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split('@')[0] : '') ||
            user.id ||
            'Usuario'
        );
    }

    function normalizeImageTitle(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function slugifyImageTitle(text, separator = '-') {
        return normalizeImageTitle(text).replace(/\s+/g, separator);
    }

    function buildCatalogImageCandidates(title, currentSrc = '') {
        const cleanTitle = String(title || '').trim();
        const current = String(currentSrc || '').trim();
        const variants = new Set([current]);
        const slug = slugifyImageTitle(cleanTitle);
        const compact = slugifyImageTitle(cleanTitle, '');
        const rawNoSymbols = cleanTitle
            .replace(/[\u2018\u2019\u201C\u201D\u2122']/g, '')
            .replace(/[:!?.,]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const dashed = slugifyImageTitle(rawNoSymbols);
        const noSpaces = slugifyImageTitle(rawNoSymbols, '');

        const bases = [cleanTitle, rawNoSymbols, slug, dashed, compact, noSpaces];
        bases.forEach(b => {
            if (!b) return;
            variants.add(`images/posters/${slugifyImageTitle(b)}.jpg`);
            variants.add(`images/posters/${slugifyImageTitle(b)}.png`);
            variants.add(`images/posters/${slugifyImageTitle(b)}.webp`);
        });
        return Array.from(variants);
    }

    function createFallbackPosterDataUrl(title, subtitle) {
        const rawTitle = String(title || 'Sin título').slice(0, 60);
        const safeSubtitle = String(subtitle || '').slice(0, 45);
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Word-wrap del título: sin esto los títulos largos (p. ej. "Demon
        // Slayer: Kimetsu no Yaiba") se dibujaban en una sola línea y se salían
        // del poster, quedando recortados por ambos lados. Repartimos en varias
        // líneas centradas y bajamos el tamaño de fuente según cuántas haya.
        const maxChars = 14;
        const words = rawTitle.split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';
        words.forEach((word) => {
            if (!current) {
                current = word.length > maxChars ? word.slice(0, maxChars) : word;
                return;
            }
            if ((current + ' ' + word).length <= maxChars) {
                current += ' ' + word;
            } else {
                lines.push(current);
                current = word.length > maxChars ? word.slice(0, maxChars) : word;
            }
        });
        if (current) lines.push(current);
        if (lines.length > 4) {
            lines.length = 4;
            lines[3] = lines[3].slice(0, maxChars - 1) + '…';
        }

        const fontSize = lines.length >= 4 ? 40 : (lines.length === 3 ? 46 : 54);
        const lineHeight = Math.round(fontSize * 1.18);
        const blockHeight = lines.length * lineHeight;
        // Centrado vertical del bloque de título alrededor de la mitad del poster.
        const firstBaseline = Math.round(400 - blockHeight / 2 + fontSize * 0.75);

        const titleTspans = lines.map((line, i) =>
            `<text x="300" y="${firstBaseline + i * lineHeight}" text-anchor="middle" fill="#00f2ff" font-size="${fontSize}" font-family="Orbitron, Arial, sans-serif" font-weight="700">${esc(line)}</text>`
        ).join('');
        const subtitleY = firstBaseline + blockHeight + 12;

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" height="100%">
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#0a051b"/>
                        <stop offset="100%" stop-color="#2b0a55"/>
                    </linearGradient>
                    <radialGradient id="glow1" cx="25%" cy="20%" r="70%">
                        <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.45"/>
                        <stop offset="100%" stop-color="#00f2ff" stop-opacity="0"/>
                    </radialGradient>
                    <radialGradient id="glow2" cx="75%" cy="80%" r="70%">
                        <stop offset="0%" stop-color="#bc13fe" stop-opacity="0.5"/>
                        <stop offset="100%" stop-color="#bc13fe" stop-opacity="0"/>
                    </radialGradient>
                </defs>
                <rect width="600" height="800" fill="url(#bg)"/>
                <rect width="600" height="800" fill="url(#glow1)"/>
                <rect width="600" height="800" fill="url(#glow2)"/>
                <rect x="36" y="36" width="528" height="728" rx="42" fill="none" stroke="#bc13fe" stroke-width="3"/>
                ${titleTspans}
                ${safeSubtitle ? `<text x="300" y="${subtitleY}" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Rajdhani, Arial, sans-serif">${esc(safeSubtitle)}</text>` : ''}
            </svg>
        `.trim();
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function fallbackCatalogImage(imgEl) {
        if (!(imgEl instanceof HTMLImageElement)) return;
        if (imgEl.dataset.fallbackReady === '1') return;
        imgEl.dataset.fallbackReady = '1';

        const title = imgEl.dataset.title || imgEl.alt || 'Sin título';
        const subtitle = imgEl.dataset.subtitle || '';
        const currentSrc = imgEl.getAttribute('src') || '';
        const candidates = buildCatalogImageCandidates(title, currentSrc);

        let index = 0;
        const tryNext = () => {
            if (index >= candidates.length) {
                imgEl.src = createFallbackPosterDataUrl(title, subtitle);
                return;
            }

            const candidate = candidates[index++];
            if (!candidate || candidate === currentSrc) {
                tryNext();
                return;
            }

            const probe = new Image();
            probe.onload = () => {
                imgEl.src = candidate;
            };
            probe.onerror = tryNext;
            probe.src = candidate;
        };

        tryNext();
    }

    function episodeStorageKey(userId, itemId, seasonIdx, ep) {
        return `u:${userId}|anime:${itemId}|s:${seasonIdx}|ep:${ep}`;
    }

    function volumeStorageKey(userId, itemId, vol, category) {
        const catSingular = category === 'novelas' ? 'novela' : category;
        return `u:${userId}|${catSingular}:${itemId}|vol:${vol}`;
    }

    const utils = {
        normalizeText,
        getCurrentUserId,
        getCurrentUserIdSafe: getCurrentUserId,
        fallbackCatalogImage,
        buildCatalogImageCandidates,
        createFallbackPosterDataUrl,
        episodeStorageKey,
        volumeStorageKey
    };

    window.AppUtils = Object.freeze(utils);
    
    // Bind to window as globals to avoid breaking any callers/HTML scripts
    window.getCurrentUserId = getCurrentUserId;
    window.getCurrentUserIdSafe = getCurrentUserId;
    window.formatMediaStatus = formatMediaStatus;
    window.fallbackCatalogImage = fallbackCatalogImage;
    window.episodeStorageKey = episodeStorageKey;
    window.volumeStorageKey = volumeStorageKey;
})(window);


/* ========================================== */
/* === FILE: js/ui/toast.js === */
/* ========================================== */

/**
 * toast.js
 * Componente modular de notificaciones flotantes premium (Toasts).
 * Expone window.Toast de forma global.
 */
(function (window) {
    "use strict";

    let container = null;

    function getContainer() {
        if (container) return container;
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
        return container;
    }

    const Icons = {
        success: "✓",
        error: "✕",
        info: "ℹ",
        warning: "⚠"
    };

    function showToast(message, type = "info", duration = AnimeDestiny.Constants.TOAST_DURATION_MS || 4000) {
        const parent = getContainer();

        const toast = document.createElement("div");
        toast.className = `toast-item toast-${type}`;

        const iconEl = document.createElement("span");
        iconEl.className = "toast-icon";
        iconEl.textContent = Icons[type] || "•";
        toast.appendChild(iconEl);

        const msgEl = document.createElement("span");
        msgEl.className = "toast-message";
        msgEl.textContent = message;
        toast.appendChild(msgEl);

        const closeBtn = document.createElement("button");
        closeBtn.className = "toast-close";
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.ariaLabel = "Cerrar notificación";
        closeBtn.addEventListener("click", () => dismissToast(toast));
        toast.appendChild(closeBtn);

        parent.appendChild(toast);

        // Disparar animación de entrada en el siguiente frame
        requestAnimationFrame(() => {
            toast.classList.add("is-visible");
        });

        // Temporizador de autodestrucción
        let timer = setTimeout(() => {
            dismissToast(toast);
        }, duration);

        // Pausar auto-dismiss al pasar el mouse por encima
        toast.addEventListener("mouseenter", () => clearTimeout(timer));
        toast.addEventListener("mouseleave", () => {
            timer = setTimeout(() => dismissToast(toast), duration / 2);
        });
    }

    function dismissToast(toast) {
        if (!toast || toast.classList.contains("is-leaving")) return;
        toast.classList.remove("is-visible");
        toast.classList.add("is-leaving");

        function remove() {
            clearTimeout(fallback);
            toast.remove();
            // Limpiar el contenedor si queda vacío
            if (container && container.childNodes.length === 0) {
                container.remove();
                container = null;
            }
        }

        // Remover del DOM al finalizar la animación. `once` porque la
        // transicion anima dos propiedades (opacity y transform) y el evento
        // llega una vez por cada una.
        toast.addEventListener("transitionend", remove, { once: true });

        // Red de seguridad: si el aviso no llega a transicionar (pestaña en
        // segundo plano, transiciones desactivadas por el sistema), el evento
        // no se dispara nunca y el nodo se queda en el DOM para siempre.
        var fallback = setTimeout(remove, 400);
    }

    // Exponer API global
    window.Toast = Object.freeze({
        success: (msg, dur) => showToast(msg, "success", dur),
        error:   (msg, dur) => showToast(msg, "error", dur),
        info:    (msg, dur) => showToast(msg, "info", dur),
        warning: (msg, dur) => showToast(msg, "warning", dur)
    });

})(window);


/* ========================================== */
/* === FILE: js/ui/mascots.js === */
/* ========================================== */

/**
 * mascots.js -- Registro de mascotas seleccionables (ademas de Rimuru).
 *
 * GENERADO por tools/slice-mascots.py a partir de las hojas de
 * tools/mascot-sheets/. No editar a mano: se sobrescribe.
 * mascot.js lee window.MascotRegistry y lo suma a la lista del selector.
 *
 * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una
 * imagen por fotograma), ya normalizadas a un lienzo cuadrado con los
 * pies anclados abajo-centro.
 */
window.MascotRegistry = [
    {
        "id": "ichigo",
        "name": "Ichigo Kurosaki",
        "anime": "Bleach",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/ichigo/idle-0.png",
                "images/mascots/ichigo/idle-1.png",
                "images/mascots/ichigo/idle-2.png"
            ],
            "walk": [
                "images/mascots/ichigo/walk-0.png",
                "images/mascots/ichigo/walk-1.png",
                "images/mascots/ichigo/walk-2.png"
            ],
            "attack": [
                "images/mascots/ichigo/attack-0.png",
                "images/mascots/ichigo/attack-1.png",
                "images/mascots/ichigo/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        }
    },
    {
        "id": "kenpachi",
        "name": "Kenpachi Zaraki",
        "anime": "Bleach",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kenpachi/idle-0.png"
            ],
            "walk": [
                "images/mascots/kenpachi/walk-0.png",
                "images/mascots/kenpachi/walk-1.png",
                "images/mascots/kenpachi/walk-2.png",
                "images/mascots/kenpachi/walk-3.png",
                "images/mascots/kenpachi/walk-4.png",
                "images/mascots/kenpachi/walk-5.png",
                "images/mascots/kenpachi/walk-6.png",
                "images/mascots/kenpachi/walk-7.png"
            ],
            "attack": [
                "images/mascots/kenpachi/attack-0.png",
                "images/mascots/kenpachi/attack-1.png",
                "images/mascots/kenpachi/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0
                ],
                "fps": 4
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7
                ],
                "fps": 11
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        }
    }
];


/* ========================================== */
/* === FILE: js/ui/characters.js === */
/* ========================================== */

/**
 * characters.js -- Registro de personajes seleccionables.
 *
 * GENERADO por tools/slice-characters.py a partir de las hojas de
 * tools/character-sheets/. No editar a mano: se sobrescribe.
 * mascot.js lee window.CharacterRegistry (ademas de MascotRegistry) y lo
 * suma a la lista del selector.
 *
 * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una
 * imagen por fotograma), normalizadas a un lienzo cuadrado con los pies
 * anclados abajo-centro, y —si aplica— un 'projectile' con el efecto del
 * ataque.
 */
window.CharacterRegistry = [
    {
        "id": "aurora",
        "name": "Aurora",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/aurora/idle-0.png",
                "images/mascots/aurora/idle-1.png",
                "images/mascots/aurora/idle-2.png"
            ],
            "walk": [
                "images/mascots/aurora/walk-0.png",
                "images/mascots/aurora/walk-1.png",
                "images/mascots/aurora/walk-2.png"
            ],
            "attack": [
                "images/mascots/aurora/attack-0.png",
                "images/mascots/aurora/attack-1.png",
                "images/mascots/aurora/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 9
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/aurora/projectile.png"
    },
    {
        "id": "escarlata",
        "name": "Escarlata",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/escarlata/idle-0.png",
                "images/mascots/escarlata/idle-1.png",
                "images/mascots/escarlata/idle-2.png"
            ],
            "walk": [
                "images/mascots/escarlata/walk-0.png",
                "images/mascots/escarlata/walk-1.png",
                "images/mascots/escarlata/walk-2.png"
            ],
            "attack": [
                "images/mascots/escarlata/attack-0.png",
                "images/mascots/escarlata/attack-1.png",
                "images/mascots/escarlata/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 11
            }
        }
    },
    {
        "id": "nix",
        "name": "Nix",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/nix/idle-0.png",
                "images/mascots/nix/idle-1.png",
                "images/mascots/nix/idle-2.png"
            ],
            "walk": [
                "images/mascots/nix/walk-0.png",
                "images/mascots/nix/walk-1.png",
                "images/mascots/nix/walk-2.png"
            ],
            "attack": [
                "images/mascots/nix/attack-0.png",
                "images/mascots/nix/attack-1.png",
                "images/mascots/nix/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        }
    },
    {
        "id": "corvina",
        "name": "Corvina",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/corvina/idle-0.png",
                "images/mascots/corvina/idle-1.png",
                "images/mascots/corvina/idle-2.png"
            ],
            "walk": [
                "images/mascots/corvina/walk-0.png",
                "images/mascots/corvina/walk-1.png",
                "images/mascots/corvina/walk-2.png"
            ],
            "attack": [
                "images/mascots/corvina/attack-0.png",
                "images/mascots/corvina/attack-1.png",
                "images/mascots/corvina/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/corvina/projectile.png"
    },
    {
        "id": "kitsune",
        "name": "Kitsune",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kitsune/idle-0.png",
                "images/mascots/kitsune/idle-1.png",
                "images/mascots/kitsune/idle-2.png"
            ],
            "walk": [
                "images/mascots/kitsune/walk-0.png",
                "images/mascots/kitsune/walk-1.png",
                "images/mascots/kitsune/walk-2.png"
            ],
            "attack": [
                "images/mascots/kitsune/attack-0.png",
                "images/mascots/kitsune/attack-1.png",
                "images/mascots/kitsune/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 9
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/kitsune/projectile.png"
    },
    {
        "id": "vampi",
        "name": "Vampi",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/vampi/idle-0.png",
                "images/mascots/vampi/idle-1.png",
                "images/mascots/vampi/idle-2.png"
            ],
            "walk": [
                "images/mascots/vampi/walk-0.png",
                "images/mascots/vampi/walk-1.png",
                "images/mascots/vampi/walk-2.png"
            ],
            "attack": [
                "images/mascots/vampi/attack-0.png",
                "images/mascots/vampi/attack-1.png",
                "images/mascots/vampi/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/vampi/projectile.png"
    },
    {
        "id": "marea",
        "name": "Marea",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/marea/idle-0.png",
                "images/mascots/marea/idle-1.png",
                "images/mascots/marea/idle-2.png"
            ],
            "walk": [
                "images/mascots/marea/walk-0.png",
                "images/mascots/marea/walk-1.png",
                "images/mascots/marea/walk-2.png"
            ],
            "attack": [
                "images/mascots/marea/attack-0.png",
                "images/mascots/marea/attack-1.png",
                "images/mascots/marea/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 9
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/marea/projectile.png"
    },
    {
        "id": "infernal",
        "name": "Infernal",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/infernal/idle-0.png",
                "images/mascots/infernal/idle-1.png",
                "images/mascots/infernal/idle-2.png"
            ],
            "walk": [
                "images/mascots/infernal/walk-0.png",
                "images/mascots/infernal/walk-1.png",
                "images/mascots/infernal/walk-2.png"
            ],
            "attack": [
                "images/mascots/infernal/attack-0.png",
                "images/mascots/infernal/attack-1.png",
                "images/mascots/infernal/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/infernal/projectile.png"
    },
    {
        "id": "kurenai",
        "name": "Kurenai",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kurenai/idle-0.png",
                "images/mascots/kurenai/idle-1.png",
                "images/mascots/kurenai/idle-2.png"
            ],
            "walk": [
                "images/mascots/kurenai/walk-0.png",
                "images/mascots/kurenai/walk-1.png",
                "images/mascots/kurenai/walk-2.png"
            ],
            "attack": [
                "images/mascots/kurenai/attack-0.png",
                "images/mascots/kurenai/attack-1.png",
                "images/mascots/kurenai/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 6
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 11
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/kurenai/projectile.png"
    },
    {
        "id": "kazuha",
        "name": "Kazuha",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kazuha/idle-0.png",
                "images/mascots/kazuha/idle-1.png",
                "images/mascots/kazuha/idle-2.png"
            ],
            "walk": [
                "images/mascots/kazuha/walk-0.png",
                "images/mascots/kazuha/walk-1.png",
                "images/mascots/kazuha/walk-2.png"
            ],
            "attack": [
                "images/mascots/kazuha/attack-0.png",
                "images/mascots/kazuha/attack-1.png",
                "images/mascots/kazuha/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 6
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 11
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/kazuha/projectile.png"
    },
    {
        "id": "diablilla",
        "name": "Diablilla",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/diablilla/idle-0.png",
                "images/mascots/diablilla/idle-1.png",
                "images/mascots/diablilla/idle-2.png"
            ],
            "walk": [
                "images/mascots/diablilla/walk-0.png",
                "images/mascots/diablilla/walk-1.png",
                "images/mascots/diablilla/walk-2.png"
            ],
            "attack": [
                "images/mascots/diablilla/attack-0.png",
                "images/mascots/diablilla/attack-1.png",
                "images/mascots/diablilla/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/diablilla/projectile.png"
    },
    {
        "id": "valkiria",
        "name": "Valkiria",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/valkiria/idle-0.png",
                "images/mascots/valkiria/idle-1.png",
                "images/mascots/valkiria/idle-2.png"
            ],
            "walk": [
                "images/mascots/valkiria/walk-0.png",
                "images/mascots/valkiria/walk-1.png",
                "images/mascots/valkiria/walk-2.png"
            ],
            "attack": [
                "images/mascots/valkiria/attack-0.png",
                "images/mascots/valkiria/attack-1.png",
                "images/mascots/valkiria/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/valkiria/projectile.png"
    }
];


/* ========================================== */
/* === FILE: js/ui/mascot.js === */
/* ========================================== */

/**
 * mascot.js
 * Mascota 2D (Rimuru, el slime de "Tensei Shitara Slime Datta Ken") que vive en
 * una esquina de la pantalla y, cuando está activada, ANUNCIA las notificaciones
 * "hablando" por un bocadillo en vez de mostrar el toast clásico. Envuelve a
 * window.Toast: si la mascota está apagada, delega en el toast de siempre; si
 * está encendida, Rimuru habla.
 *
 * El sprite es pixel-art animado a partir de un spritesheet (8×5 celdas de
 * 96×96) embebido como data-URI, así no dependemos de ningún asset externo.
 * Las "expresiones" y estados (reposo, caminar, salto, festejo…) se consiguen
 * eligiendo el grupo de fotogramas y desplazando el background-position.
 *
 * Preferencia: localStorage 'pref:mascot' = 'on' | 'off' (default: on).
 * Expone window.Mascot { say, setEnabled, isEnabled }.
 */
(function (window) {
    "use strict";

    var document = window.document;

    // ── Preferencia ────────────────────────────────────────────────────────
    var PREF_KEY = "pref:mascot";

    var POS_KEY = "pref:mascotPos";

    // Modo "paseo": el slime camina y salta solo por la pantalla, con gravedad,
    // y se posa sobre la estructura real de la página (navbar, cards, títulos…).
    // Preferencia independiente para poder tener la mascota quieta si molesta.
    var ROAM_KEY = "pref:mascotRoam";

    function readPref() {
        try { return localStorage.getItem(PREF_KEY); } catch (_) { return null; }
    }
    function isEnabled() {
        // Default ON: si nunca se tocó, la mascota está encendida.
        return readPref() !== "off";
    }
    function roamPref() {
        // Default ON: el slime se mueve salvo que lo apaguen explícitamente.
        try { return localStorage.getItem(ROAM_KEY) !== "off"; } catch (_) { return true; }
    }
    // El paseo requiere que el usuario no haya pedido reducir el movimiento.
    function roamEnabled() {
        return roamPref() && !reducedMotion();
    }
    function readPos() {
        try {
            var v = localStorage.getItem(POS_KEY);
            return v ? JSON.parse(v) : null;
        } catch (_) { return null; }
    }
    function writePos(p) {
        try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (_) {}
    }
    function reducedMotion() {
        try {
            if (localStorage.getItem("pref:reduceMotion") === "true") return true;
        } catch (_) {}
        try {
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (_) { return false; }
    }

    // ── Spritesheet ─────────────────────────────────────────────────────────
    // Hoja de 8 columnas × 5 filas, celdas de 96×96, con el personaje anclado
    // al PIE (borde inferior de cada celda). Embebida como data-URI (PNG
    // indexado de 8 colores) para no depender de ningún asset externo.
    var SHEET_COLS = 8, SHEET_ROWS = 5;
    var SHEET_SRC = "data:image/png;base64,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";

    // Grupos de fotogramas por estado/expresión (índices en la hoja, 0..35):
    //  fila0 0-7  reposo/respiración · fila1 8-15 alt · fila2 16-17 brazos
    //  arriba (festejo), 18-20 embestida, 21-23 recompone · fila3 24-31 caminar
    //  · fila4 32-35 agazapado.
    var ANIMS = {
        idle:      { f: [0, 1, 2, 3, 4, 5, 6, 7], fps: 8 },
        walk:      { f: [24, 25, 26, 27, 28, 29, 30, 31], fps: 11 },
        air:       { f: [17], fps: 1 },              // salto (brazos arriba)
        happy:     { f: [16, 17], fps: 6 },          // festejo
        love:      { f: [16, 17], fps: 7 },
        surprised: { f: [17], fps: 1 },
        sad:       { f: [32, 33], fps: 3 },          // agazapado
        sleep:     { f: [5], fps: 1 }                // pose baja, "asentado"
    };
    // Expresiones que mandan sobre el estado de movimiento mientras están activas.
    var EXPR_ANIM = {
        happy: "happy", love: "love", surprised: "surprised", sad: "sad"
    };

    // Cada tipo de notificación se mapea a una expresión.
    var TYPE_FACE = {
        success: "happy",
        error: "sad",
        warning: "surprised",
        info: "normal"
    };

    // ── Personajes seleccionables ─────────────────────────────────────────────
    // Rimuru es el personaje embebido por defecto (modo 'sheet': un spritesheet
    // con índices de fotogramas). Otras mascotas — generadas con PixelLab por
    // tools/generate-mascots.js — se publican en window.MascotRegistry y usan el
    // modo 'frames': cada animación es una lista de imágenes que se intercambian.
    var CHAR_KEY = "pref:mascotChar";
    var RIMURU = {
        id: "rimuru", name: "Rimuru", anime: "Tensei Slime",
        mode: "sheet", src: SHEET_SRC, cols: SHEET_COLS, rows: SHEET_ROWS, anims: ANIMS
    };
    // Personajes seleccionables: los históricos de window.MascotRegistry
    // (js/ui/mascots.js) más los de window.CharacterRegistry (js/ui/characters.js,
    // generado por tools/slice-characters.py). Se concatenan en un único listado.
    function registry() {
        var m = Array.isArray(window.MascotRegistry) ? window.MascotRegistry : [];
        var c = Array.isArray(window.CharacterRegistry) ? window.CharacterRegistry : [];
        return m.concat(c);
    }
    function allChars() { return [RIMURU].concat(registry()); }
    function readChar() { try { return localStorage.getItem(CHAR_KEY) || "rimuru"; } catch (_) { return "rimuru"; } }
    function findChar(id) {
        var l = allChars();
        for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
        return RIMURU;
    }

    // Modo de render y, en modo 'frames', las listas de imágenes por animación.
    var MASCOT_MODE = "sheet";
    var FRAME_IMGS = null;
    // Ruta del sprite de proyectil del personaje activo (si trae 'attack' con
    // efecto propio); "" cuando no tiene y el golpe usa la marca de corte CSS.
    var MASCOT_PROJECTILE = "";

    // Deriva un mapa ANIMS (índice+fps por estado) desde las listas de frames.
    function framesToAnims(f) {
        var out = {};
        for (var k in f) {
            if (!f.hasOwnProperty(k) || !f[k] || !f[k].length) continue;
            var seq = [];
            for (var i = 0; i < f[k].length; i++) seq.push(i);
            out[k] = { f: seq, fps: (k === "walk" ? 10 : 6) };
        }
        if (!out.idle) out.idle = { f: [0], fps: 1 };
        if (!out.walk) out.walk = out.idle;
        if (!out.air)  out.air  = { f: [out.idle.f[0]], fps: 1 };
        return out;
    }

    // Precarga en caché todas las imágenes de un personaje (idle/walk/attack) y
    // su proyectil. En modo 'frames' cada fotograma es una imagen distinta que se
    // asigna a background-image; si no está cacheada, al cambiar de fotograma se
    // ve un parpadeo (el sprite "desaparece" un instante hasta que carga). Al
    // precargarlas, el cambio de fotograma es inmediato y el sprite no desaparece.
    var _preloaded = {};
    function preloadFrames(c) {
        if (!c || c.mode !== "frames" || !c.frames || _preloaded[c.id]) return;
        _preloaded[c.id] = true;
        var f = c.frames, urls = [];
        for (var k in f) {
            if (!f.hasOwnProperty(k) || !f[k] || !f[k].length) continue;
            for (var i = 0; i < f[k].length; i++) urls.push(f[k][i]);
        }
        if (c.projectile) urls.push(c.projectile);
        for (var j = 0; j < urls.length; j++) { var im = new Image(); im.src = urls[j]; }
    }

    // Aplica un personaje: fija modo, hoja/frames y ANIMS. Si el sprite ya existe
    // en el DOM, repinta al vuelo (permite cambiar de mascota sin recargar).
    function applyChar(id) {
        var c = findChar(id);
        preloadFrames(c);           // evita el parpadeo al cambiar de fotograma
        MASCOT_PROJECTILE = c.projectile || "";
        MASCOT_MODE = c.mode === "frames" ? "frames" : "sheet";
        if (MASCOT_MODE === "frames") {
            FRAME_IMGS = c.frames || {};
            ANIMS = c.anims || framesToAnims(FRAME_IMGS);
        } else {
            SHEET_SRC  = c.src  || RIMURU.src;
            SHEET_COLS = c.cols || 8;
            SHEET_ROWS = c.rows || 5;
            ANIMS = c.anims || RIMURU.anims;
        }
        if (sprite) {
            if (MASCOT_MODE === "frames") {
                sprite.style.backgroundSize = "100% 100%";
                sprite.style.backgroundPosition = "center bottom";
                // Sprites de anime (con antialiasing): se ven mejor suavizados al
                // escalar que con nearest-neighbor. Rimuru (pixel-art) sí quiere
                // pixelado, así que solo el modo 'frames' pisa el image-rendering.
                sprite.style.imageRendering = "auto";
            } else {
                sprite.style.backgroundImage = "url(" + SHEET_SRC + ")";
                sprite.style.backgroundSize = "";      // vuelve al valor del CSS (800% 500%)
                sprite.style.backgroundPosition = "0 0";
                sprite.style.imageRendering = "";      // vuelve a 'pixelated' del CSS
            }
            animName = null; animFrame = -1; _lastFrameKey = "";
            setFrame(0, "idle");
        }
    }

    // ── Animador de fotogramas ───────────────────────────────────────────────
    // Un único rAF desplaza el background-position del <div.mascot-sprite> según
    // el grupo activo. El grupo sale de: dormido → 'sleep'; si hay expresión
    // especial → esa; si no, del estado de movimiento que fija la física
    // (motionAnim: 'idle' | 'walk' | 'air').
    var motionAnim = "idle";
    var animRAF = null, animStart = 0, animName = null, animFrame = -1;
    var _lastFrameKey = "";  // dedupe en modo 'frames' (nombre+idx)

    function activeAnim() {
        if (sleeping) return "sleep";
        // El golpe manda sobre expresión y movimiento mientras dura (solo las
        // mascotas que traen animación 'attack', p. ej. las de Bleach).
        if (attacking && ANIMS.attack) return "attack";
        var e = EXPR_ANIM[currentExpr];
        if (e) return e;
        return motionAnim;
    }

    // Coloca el fotograma `idx` (0..35) moviendo el fondo. Con background-size
    // de 800%×500% y el elemento del tamaño de UNA celda, la posición en % es
    // col/(cols-1) y row/(rows-1).
    function setFrame(idx, name) {
        if (!sprite) return;
        // Modo 'frames' (mascotas generadas): cada fotograma es una imagen
        // distinta; `idx` es la posición dentro de la lista de esa animación.
        if (MASCOT_MODE === "frames") {
            var list = (FRAME_IMGS && (FRAME_IMGS[name] || FRAME_IMGS.idle)) || [];
            var src = list[idx] || list[0];
            if (src) sprite.style.backgroundImage = "url(" + src + ")";
            return;
        }
        // Modo 'sheet' (Rimuru): se desplaza el background-position dentro de la
        // hoja. Con background-size cols×rows y el elemento del tamaño de UNA
        // celda, la posición en % es col/(cols-1) y row/(rows-1).
        var col = idx % SHEET_COLS, row = (idx / SHEET_COLS) | 0;
        var px = SHEET_COLS > 1 ? (col / (SHEET_COLS - 1)) * 100 : 0;
        var py = SHEET_ROWS > 1 ? (row / (SHEET_ROWS - 1)) * 100 : 0;
        sprite.style.backgroundPosition = px + "% " + py + "%";
    }

    function animTick(ts) {
        if (!sprite) { animRAF = null; return; }
        animRAF = requestAnimationFrame(animTick);
        var name = activeAnim();
        var a = ANIMS[name] || ANIMS.idle;
        if (name !== animName) { animName = name; animStart = ts; }
        // Con movimiento reducido, congelamos en el primer fotograma del estado.
        var i = reducedMotion() ? 0 : Math.floor((ts - animStart) * a.fps / 1000) % a.f.length;
        var frame = a.f[i];
        if (MASCOT_MODE === "frames") {
            // El índice de frame se repite entre animaciones (idle[0], walk[0]…):
            // hay que redibujar también cuando cambia la animación, no solo el idx.
            var key = name + ":" + frame;
            if (key !== _lastFrameKey) { _lastFrameKey = key; animFrame = frame; setFrame(frame, name); }
        } else if (frame !== animFrame) {
            animFrame = frame; setFrame(frame, name);
        }
    }

    function startAnim() {
        if (animRAF != null) return;
        animName = null; animFrame = -1;
        animStart = performance.now();
        animRAF = requestAnimationFrame(animTick);
    }

    function stopAnim() {
        if (animRAF != null) { cancelAnimationFrame(animRAF); animRAF = null; }
    }

    // ── DOM ────────────────────────────────────────────────────────────────
    var root = null;     // contenedor fijo
    var pet = null;      // el botón que contiene al sprite
    var sprite = null;   // <div> con el spritesheet de fondo
    var bubble = null;   // bocadillo
    var bubbleText = null;
    var hideTimer = null;
    var blinkTimer = null;
    var currentExpr = "normal";
    var drag = null;        // estado del arrastre en curso
    var justDragged = false; // para no disparar el saludo al soltar tras mover
    var zzz = null;         // "Zzz" flotante cuando duerme

    // ── Cariño / mimos ─────────────────────────────────────────────────────
    var petStreak = 0;      // clicks encadenados (mimos seguidos)
    var lastPetAt = 0;      // timestamp del último mimo, para encadenar
    var loveTimer = null;   // vuelve a la cara normal tras enamorarse

    // ── Sueño por inactividad ──────────────────────────────────────────────
    var sleeping = false;      // el slime está dormido
    var lastActivity = 0;      // último movimiento/tecla/scroll del usuario
    var sleepTimer = null;     // vigía que lo duerme tras un rato quieto
    var IDLE_SLEEP_MS = 45000; // inactividad para empezar a dormir

    // ── Estado del motor de movimiento (paseo con física) ──────────────────
    // Todo en coordenadas de viewport (position: fixed), refiriéndose a la
    // esquina superior-izquierda del sprite (mismo sistema que place()).
    var phys = null;         // { x, y, vx, vy, w, h, face, ground }
    var rafId = null;        // id del requestAnimationFrame en curso
    var lastT = 0;           // timestamp del frame anterior (para dt)
    var running = false;     // motor activo (paseo encendido y pestaña visible)
    var platCache = { list: [], t: 0 };   // plataformas detectadas (con caché)
    var mouse = { x: -1, y: -1, t: 0 };   // último puntero conocido
    var nextDecision = 0;    // cuándo el slime vuelve a elegir qué hacer
    var attentionUntil = 0;  // pausa el paseo (habla / click) hasta este tiempo
    var lastReact = 0;       // cooldown de reacciones al contenido
    var lastFlee = 0;        // cooldown del "susto" al acercar el cursor
    var mouseWired = false;  // para no duplicar el listener global de puntero

    // ── Ataque a elementos de la página ────────────────────────────────────
    // De vez en cuando, las mascotas con animación 'attack' (las de Bleach) se
    // orientan hacia un elemento real cercano (card, título, navbar…), pegan el
    // golpe y le aplican un "impacto": el elemento tiembla y aparece una marca
    // de corte encima. Rimuru no tiene 'attack', así que nunca ataca.
    var attacking = false;   // reproduciendo el golpe ahora mismo
    var attackUntil = 0;     // fin del golpe actual (timestamp)
    var attackTarget = null; // { el, rect, cx, cy } del blanco en curso
    var attackHit = false;   // ya se aplicó el impacto de este golpe (una vez)
    var lastAttack = 0;      // cooldown entre golpes

    // ── Rival (otro personaje que aparece y desafía a la mascota) ───────────
    // Mientras hay un rival en pantalla, la mascota fija se planta, lo mira y
    // acusa los golpes (no deambula ni ataca cartas de la página). Ver el
    // subsistema "Rival" más abajo.
    var rivalActive = false;

    // Fija la expresión: el animador de fotogramas reflejará el cambio en el
    // próximo frame (ya no se redibuja nada a mano).
    function setExpr(expr) {
        currentExpr = expr;
    }

    function ensureDom() {
        if (root) return;

        root = document.createElement("div");
        root.className = "mascot-root";
        if (reducedMotion()) root.classList.add("mascot-reduced");

        bubble = document.createElement("div");
        bubble.className = "mascot-bubble";
        // Anuncia a lectores de pantalla, igual que haría un toast.
        bubble.setAttribute("role", "status");
        bubble.setAttribute("aria-live", "polite");

        bubbleText = document.createElement("span");
        bubbleText.className = "mascot-bubble-text";
        bubble.appendChild(bubbleText);

        var close = document.createElement("button");
        close.className = "mascot-bubble-close";
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar mensaje");
        close.innerHTML = "&times;";
        close.addEventListener("click", function (e) {
            e.stopPropagation();
            hideBubble();
        });
        bubble.appendChild(close);

        pet = document.createElement("button");
        pet.className = "mascot-pet";
        pet.type = "button";
        pet.setAttribute("aria-label", "Rimuru — tu mascota slime. Tocá para saludar.");
        sprite = document.createElement("div");
        sprite.className = "mascot-sprite";
        sprite.setAttribute("aria-hidden", "true");
        pet.appendChild(sprite);
        // Pinta el personaje elegido (Rimuru por defecto): imagen, modo y 1er frame.
        applyChar(readChar());
        pet.addEventListener("click", onPetClick);
        // Pausar el auto-ocultado mientras el mouse está sobre la mascota.
        pet.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
        bubble.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
        // Al pasar el cursor por encima, si estaba dormido, despierta.
        pet.addEventListener("mouseenter", wakeUp);
        // Arrastre para reubicar la mascota (no tapar botones).
        wireDrag();

        // "Zzz" flotante para el modo dormido (oculto por CSS salvo al dormir).
        zzz = document.createElement("div");
        zzz.className = "mascot-zzz";
        zzz.setAttribute("aria-hidden", "true");
        zzz.textContent = "z";

        root.appendChild(bubble);
        root.appendChild(zzz);
        root.appendChild(pet);
        document.body.appendChild(root);

        applyPosition();
        startAnim();
        scheduleBlink();
        wireActivity();
        // Arranca el paseo (si está permitido); si no, queda quieta y arrastrable.
        startEngine();
        // Programa las apariciones aleatorias de rivales que la desafían.
        scheduleRival();
    }

    // ── Arrastrar / posición ────────────────────────────────────────────────
    var MARGIN = 8; // margen mínimo con los bordes de la ventana

    // Rango de píxeles disponible para el borde superior-izquierdo del sprite.
    function availX() { return Math.max(0, window.innerWidth - root.offsetWidth - MARGIN * 2); }
    function availY() { return Math.max(0, window.innerHeight - root.offsetHeight - MARGIN * 2); }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    // Fija la mascota en (left, top) recortada a la ventana para que nunca quede
    // fuera de pantalla, y ancla el bocadillo al lado que corresponda.
    function place(left, top) {
        var w = root.offsetWidth;
        left = Math.max(MARGIN, Math.min(left, MARGIN + availX()));
        top = Math.max(MARGIN, Math.min(top, MARGIN + availY()));
        root.style.left = left + "px";
        root.style.top = top + "px";
        root.style.right = "auto";
        root.style.bottom = "auto";
        // Si su centro cae en la mitad izquierda, el bocadillo abre a la derecha.
        root.classList.toggle("mascot-left", (left + w / 2) < window.innerWidth / 2);
    }

    // Ubica por proporción (0..1) del área disponible: así la posición es
    // responsive y sobrevive a rotar el móvil o cambiar de tamaño de pantalla.
    function placeByRatio(rx, ry) {
        place(MARGIN + rx * availX(), MARGIN + ry * availY());
    }

    // Proporción actual del sprite dentro del área disponible.
    function currentRatio() {
        var r = root.getBoundingClientRect();
        var ax = availX() || 1, ay = availY() || 1;
        return { rx: clamp01((r.left - MARGIN) / ax), ry: clamp01((r.top - MARGIN) / ay) };
    }

    function applyPosition() {
        var p = readPos();
        if (!p) return; // sin posición guardada → default de CSS (abajo-derecha)
        if (typeof p.rx === "number") placeByRatio(p.rx, p.ry);
        else if (typeof p.left === "number") place(p.left, p.top); // formato viejo
    }

    function wireDrag() {
        pet.addEventListener("pointerdown", function (e) {
            if (e.button != null && e.button !== 0) return; // solo botón primario
            justDragged = false;
            var r = root.getBoundingClientRect();
            drag = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, id: e.pointerId, moved: false };
            try { pet.setPointerCapture(e.pointerId); } catch (_) {}
        });
        pet.addEventListener("pointermove", function (e) {
            if (!drag || e.pointerId !== drag.id) return;
            var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
            if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < 4) return; // umbral: click vs arrastre
            if (!drag.moved) {
                drag.moved = true;
                justDragged = true;
                root.classList.add("mascot-dragging");
                clearTimeout(hideTimer);
                hideBubble();
            }
            place(drag.left + dx, drag.top + dy);
        });
        function endDrag(e) {
            if (!drag || (e && e.pointerId !== drag.id)) return;
            try { pet.releasePointerCapture(drag.id); } catch (_) {}
            root.classList.remove("mascot-dragging");
            if (drag.moved) writePos(currentRatio());
            drag = null;
            // Al soltarlo, si el paseo está activo lo dejamos caer desde donde
            // quedó: la física lo lleva a posarse sobre la repisa más cercana.
            if (running && phys) {
                var r = root.getBoundingClientRect();
                phys.x = r.left; phys.y = r.top; phys.vx = 0; phys.vy = 0; phys.tvx = 0;
                phys.ground = null;
                nextDecision = performance.now() + 500;
            }
        }
        pet.addEventListener("pointerup", endDrag);
        pet.addEventListener("pointercancel", endDrag);
    }

    // Al cambiar el tamaño/orientación, reubicar por proporción si hay posición
    // manual (o re-encajar la posición vieja en px). Se hace en rAF para leer
    // el tamaño ya recalculado por el clamp de CSS.
    function reflow() {
        if (!root || !root.style.left) return;
        requestAnimationFrame(function () {
            // Con el paseo activo el motor controla la posición: solo refrescamos
            // el tamaño del sprite y las plataformas, y re-encajamos la física
            // dentro de la ventana (que pudo achicarse).
            if (running && phys) {
                refreshMetrics();
                phys.x = Math.max(MARGIN, Math.min(phys.x, window.innerWidth - phys.w - MARGIN));
                phys.ground = null; // recalcula dónde apoyarse tras el resize
                return;
            }
            var p = readPos();
            if (p && typeof p.rx === "number") placeByRatio(p.rx, p.ry);
            else { var r = root.getBoundingClientRect(); place(r.left, r.top); }
        });
    }
    // Reescanear plataformas al hacer scroll (las repisas se mueven con la página).
    window.addEventListener("scroll", function () { platCache.t = 0; }, { passive: true });
    window.addEventListener("resize", reflow);
    window.addEventListener("orientationchange", reflow);

    // ── Motor de movimiento: paseo, gravedad e interacción con la página ────
    //
    // El slime deja de estar clavado en una esquina y pasa a "vivir" en la
    // pantalla: camina, salta y cae con gravedad, aterrizando sobre el borde
    // superior de elementos reales (navbar inferior, cards, títulos, footer…)
    // que se detectan con getBoundingClientRect. También mira/sigue/esquiva el
    // cursor y, al posarse sobre una card, comenta por el bocadillo.
    //
    // Todo con un único requestAnimationFrame; sin librerías (respeta el CSP).

    var GRAV = 2600;         // aceleración de la gravedad (px/s²)
    var WALK = 82;           // velocidad al caminar (px/s)
    var ACCEL = 950;         // aceleración horizontal en el piso (px/s²): el slime
                             // no salta de golpe a la velocidad máxima, arranca y
                             // frena de a poco → paso a paso más natural y con
                             // "fricción" al aterrizar.
    var JUMP_VY = -900;      // impulso de un salto normal (px/s) → alcanza ~155px
    var JUMP_MAX = 1220;     // impulso máximo para trepar a repisas altas (px/s)

    // Elementos que sirven de "repisa". Selectores robustos y genéricos: si un
    // rect no cumple los filtros (ancho, altura, estar a la vista) se descarta,
    // así funciona en cualquier página sin mantener una lista por vista.
    var PLATFORM_SEL = [
        ".mobile-bottom-nav", ".card-container", ".catalog-neon-card",
        ".card", ".hero-section", ".cfg-panel", "footer",
        "h1.title", "h2.title", ".section-title"
    ].join(",");

    // Elementos "atacables": lo visible y con entidad de la página. Se filtran
    // luego por tamaño, visibilidad y cercanía a la mascota.
    var ATTACK_SEL = [
        ".catalog-neon-card", ".card-container", ".card", ".hero-section",
        ".cfg-panel", "h1.title", "h2.title", ".section-title",
        ".destiny-navbar", ".mobile-bottom-nav"
    ].join(",");
    var ATTACK_MS = 720;          // cuánto dura la animación del golpe
    var ATTACK_COOLDOWN = 12000;  // tiempo mínimo entre golpes ("de vez en cuando")
    var ATTACK_CHANCE = 0.5;      // probabilidad de atacar cuando ya pasó el cooldown
    var ATTACK_RANGE = 200;       // alcance horizontal (px) para elegir blanco

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function rand(a, b) { return a + Math.random() * (b - a); }

    // Refresca el tamaño del sprite (cambia con el ancho de pantalla por el
    // clamp() del CSS) e invalida la caché de plataformas.
    function refreshMetrics() {
        if (!root || !phys) return;
        phys.w = root.offsetWidth || 72;
        phys.h = root.offsetHeight || 66;
        platCache.t = 0;
    }

    // Detecta las repisas visibles (con caché corta para no escanear cada frame).
    // Cada plataforma guarda `top` ya convertido a la Y del BORDE SUPERIOR del
    // sprite cuando está parado encima, para que el aterrizaje sea una simple
    // comparación. Se incluye el piso de la ventana como plataforma base.
    function scanPlatforms() {
        var now = performance.now();
        if (platCache.list.length && now - platCache.t < 350) return platCache.list;

        var W = window.innerWidth, H = window.innerHeight;
        var floorTop = H - phys.h - MARGIN;
        var out = [{ left: 0, right: W, top: floorTop, floor: true }];

        var els = document.querySelectorAll(PLATFORM_SEL);
        for (var i = 0; i < els.length && out.length < 60; i++) {
            var el = els[i];
            if (el === root || root.contains(el)) continue;
            var r = el.getBoundingClientRect();
            if (r.width < phys.w * 1.1 || r.height < 10) continue; // muy chico
            if (r.right < 0 || r.left > W) continue;                // fuera de X
            var top = r.top - phys.h;                               // Y del sprite parado
            if (top < MARGIN + 2 || top > floorTop - 2) continue;   // fuera de Y útil
            out.push({ left: Math.max(0, r.left), right: Math.min(W, r.right), top: top, el: el });
        }
        platCache = { list: out, t: now };
        return out;
    }

    // Al caer (prevY→newY), busca la repisa MÁS ALTA que el sprite cruza con su
    // centro horizontal dentro del rango de la repisa. Devuelve null si no toca.
    function landingFor(prevY, newY, cx) {
        var list = scanPlatforms(), best = null;
        for (var i = 0; i < list.length; i++) {
            var p = list[i];
            if (cx < p.left - 6 || cx > p.right + 6) continue;
            if (prevY <= p.top && newY >= p.top && (!best || p.top < best.top)) best = p;
        }
        return best;
    }

    // Pausa el paseo un rato (mientras habla o tras un click): se queda quieto.
    function pauseRoam(ms) {
        attentionUntil = performance.now() + (ms || DURATION());
        if (phys) phys.tvx = 0; // frena suave (la física lo lleva a 0 en step)
    }

    // Aplica el "mirar hacia" (flip horizontal) sobre el sprite, sin pelear con
    // las animaciones de la mascota (talk/land viven en .mascot-pet; el flip, en
    // .mascot-sprite).
    function applyFace() {
        if (sprite && sprite.style) sprite.style.transform = "scaleX(" + ((phys && phys.face) || 1) + ")";
    }

    // Reacción contextual al posarse sobre un elemento real de la página.
    function reactTo(plat, ts) {
        if (!plat || plat.floor || !plat.el) return;
        if (ts - lastReact < 9000 || Math.random() < 0.35) return; // sin spamear
        var el = plat.el, title = null;
        if (el.getAttribute) title = el.getAttribute("data-title");
        if (!title && el.querySelector) {
            var t = el.querySelector("[data-title]");
            if (t) title = t.getAttribute("data-title");
        }
        var msg = null;
        if (title) {
            msg = pick([
                "¿'" + title + "' a tu lista? 👀",
                "¡'" + title + "' tiene buena pinta!",
                "Marcá '" + title + "' como visto 👁"
            ]);
        } else if (el.matches && el.matches(".mobile-bottom-nav")) {
            msg = "Tocá un ícono para navegar 📱";
        } else if (el.matches && el.matches(".hero-section, h1, h2, .title, .section-title")) {
            msg = pick(["¿Exploramos? 🚀", "¡Vamos a maratonear! ✨"]);
        } else if (el.matches && el.matches("footer")) {
            msg = "Llegaste al final 👋";
        }
        if (msg) { lastReact = ts; speak(msg); }
    }

    // Se ejecuta al aterrizar: squash de impacto + posible reacción.
    function onLand(plat, ts) {
        if (pet) {
            pet.classList.remove("mascot-land");
            void pet.offsetWidth;
            pet.classList.add("mascot-land");
        }
        reactTo(plat, ts);
    }

    // Empieza a caminar en una dirección durante un tiempo. Fija una velocidad
    // OBJETIVO (con una pizca de variación para que el andar no sea metronómico);
    // la física acelera hacia ella suavemente en step().
    function walk(dir, ms, ts) {
        phys.tvx = dir * WALK * rand(0.85, 1.12);
        phys.face = dir < 0 ? -1 : 1;
        nextDecision = ts + ms;
    }

    // Salto simple: impulso vertical fijo. El aterrizaje lo resuelve la física.
    function jump(ts) {
        if (!phys.ground) return;
        phys.vy = JUMP_VY;
        phys.ground = null;
        nextDecision = ts + 600;
    }

    // Busca una repisa MÁS ALTA que la actual, alcanzable de un salto (por altura
    // y por distancia horizontal), para "trepar" la estructura de la página.
    function reachableTarget() {
        var list = scanPlatforms();
        var cx = phys.x + phys.w / 2;
        var maxRise = (JUMP_MAX * JUMP_MAX) / (2 * GRAV);   // altura máx alcanzable
        var best = null, bestScore = Infinity;
        for (var i = 0; i < list.length; i++) {
            var p = list[i];
            if (p === phys.ground) continue;
            var rise = phys.y - p.top;                       // cuánto hay que subir
            if (rise < 12 || rise > maxRise) continue;       // ni plana ni imposible
            var tx = Math.max(p.left, Math.min(cx, p.right)); // punto más cercano
            var dx = Math.abs(tx - cx);
            if (dx > 320) continue;                          // demasiado lejos
            var score = rise + dx * 0.6;                     // prioriza cerca y bajo
            if (score < bestScore) { bestScore = score; best = p; }
        }
        return best;
    }

    // Salto dirigido hacia una repisa concreta: calcula el impulso justo para
    // superar su altura y se orienta hacia ella. La física + landingFor la posan.
    function hopTo(plat, ts) {
        if (!phys.ground) return;
        var cx = phys.x + phys.w / 2;
        var tx = Math.max(plat.left, Math.min(cx, plat.right));
        var rise = phys.y - plat.top + 26;                  // + holgura para pasarla
        var vy = Math.min(JUMP_MAX, Math.sqrt(2 * GRAV * Math.max(rise, 20)));
        phys.vy = -vy;
        var dir = tx < cx ? -1 : (tx > cx ? 1 : (Math.random() < 0.5 ? -1 : 1));
        phys.vx = dir * WALK * 1.4;      // impulso balístico durante el salto
        phys.tvx = 0;                    // al posarse en la repisa se asienta (frena)
        phys.face = dir < 0 ? -1 : 1;
        phys.ground = null;
        nextDecision = ts + 700;
    }

    // ── Ataque a objetos de la página ──────────────────────────────────────
    // Frases al atacar, según el personaje activo.
    var ATTACK_LINES = {
        ichigo:    ["¡Getsuga Tenshō! ⚔️", "¡Toma esto!", "¡Hyah!"],
        kenpachi:  ["¡A cortar! ⚔️", "¡Nada mal!", "¡Toma esto!"],
        aurora:    ["¡Destello floral! 🌸", "¡Brilla!", "¡Hyah!"],
        escarlata: ["¡Tormenta escarlata! 🌪️", "¡No escaparás!", "¡Toma!"],
        nix:       ["¡Fuego cruzado! 🔫", "¡A cubierto!", "¡Bang!"],
        corvina:   ["¡Descarga! ⚡", "¡Se acabó!", "¡Toma esto!"],
        kitsune:   ["¡Fuego zorruno! 🦊", "¡Kon!", "¡Ardé!"],
        vampi:     ["¡Zarpazo nocturno! 🦇", "¡Sangre!", "¡Hyah!"],
        marea:     ["¡Marea alta! 🌊", "¡Ola va!", "¡Splash!"],
        infernal:  ["¡Llama infernal! 🔥", "¡Ardé!", "¡Toma esto!"],
        kurenai:   ["¡Corte carmesí! ⚔️", "¡Silencio!", "¡Hyah!"],
        kazuha:    ["¡Filo del viento! 🍃", "¡Rápido como el viento!", "¡Toma!"],
        diablilla: ["¡Travesura! 😈", "¡Jiji!", "¡Toma esto!"],
        valkiria:  ["¡Alas de guerra! 🪽", "¡Cae!", "¡Hyah!"]
    };
    function attackLine() {
        return pick(ATTACK_LINES[readChar()] || ["¡Hyah!"]);
    }

    // ¿El personaje activo sabe atacar? (tiene fotogramas de 'attack').
    function hasAttack() {
        return !!(ANIMS && ANIMS.attack && ANIMS.attack.f && ANIMS.attack.f.length);
    }

    // Elige el elemento atacable más cercano a la mascota (o null). Debe estar a
    // la vista, con tamaño suficiente y cerca en horizontal y en altura.
    function findAttackTarget() {
        var els = document.querySelectorAll(ATTACK_SEL);
        var cx = phys.x + phys.w / 2, feet = phys.y + phys.h;
        var W = window.innerWidth, H = window.innerHeight;
        var best = null, bestD = Infinity;
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el === root || root.contains(el) || el.contains(root)) continue;
            var r = el.getBoundingClientRect();
            if (r.width < 24 || r.height < 16) continue;          // muy chico
            if (r.right < 0 || r.left > W || r.bottom < 0 || r.top > H) continue; // fuera de vista
            var nx = Math.max(r.left, Math.min(cx, r.right));
            var dx = Math.abs(nx - cx);
            if (dx > ATTACK_RANGE) continue;                       // lejos en X
            if (feet < r.top - 140 || feet > r.bottom + 90) continue; // muy arriba/abajo
            var ny = Math.max(r.top, Math.min(feet, r.bottom));
            var d = dx + Math.abs(ny - feet) * 0.5;
            if (d < bestD) {
                bestD = d;
                best = { el: el, rect: r, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 };
            }
        }
        return best;
    }

    // ¿Toca atacar ahora? (sabe atacar, no está ocupado y ya pasó el cooldown).
    function canAttack(ts) {
        return hasAttack() && !attacking && !sleeping && !rivalActive &&
            ts - lastAttack > ATTACK_COOLDOWN && Math.random() < ATTACK_CHANCE;
    }

    // Arranca el golpe: mira al blanco, pega un pequeño lunge y fija el estado
    // 'attacking' (que el animador refleja con la animación 'attack').
    function startAttack(t, ts) {
        attacking = true;
        attackHit = false;
        attackTarget = t;
        attackUntil = ts + ATTACK_MS;
        lastAttack = ts;
        var cx = phys.x + phys.w / 2;
        var dir = t.cx < cx ? -1 : 1;
        phys.face = dir;
        phys.tvx = 0;
        if (phys.ground) phys.vx = dir * WALK * 1.1;   // impulso hacia el blanco
        nextDecision = attackUntil + 300;
        attentionUntil = Math.max(attentionUntil, attackUntil); // no deambular durante el golpe
        // El proyectil sale un instante después (deja ver la pose de ataque) y
        // aterriza justo cuando se aplica el impacto (a ~55% de la animación).
        if (MASCOT_PROJECTILE) {
            var travel = ATTACK_MS * 0.45;
            setTimeout(function () { launchProjectile(t, travel); }, ATTACK_MS * 0.1);
        }
        if (Math.random() < 0.5) speak(attackLine(), "happy");
    }

    // Lanza el sprite de proyectil del personaje activo desde donde está la
    // mascota hacia el blanco. Vuela durante 'travelMs' y se autodestruye. Solo
    // se usa cuando el personaje trae 'projectile'; si no, el golpe se resuelve
    // con la marca de corte CSS en hitElement.
    function launchProjectile(t, travelMs) {
        if (!MASCOT_PROJECTILE || !t || reducedMotion() || !root) return;
        var from = root.getBoundingClientRect();
        var sx = from.left + from.width / 2;
        var sy = from.top + from.height * 0.45;   // a la altura de las manos
        var tx = t.cx, ty = t.cy;
        var ang = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;
        var size = Math.min(Math.max(from.width * 0.9, 46), 120);

        var img = document.createElement("img");
        img.className = "mascot-projectile";
        img.src = MASCOT_PROJECTILE;
        img.setAttribute("aria-hidden", "true");
        img.style.width = size + "px";
        img.style.left = (sx - size / 2) + "px";
        img.style.top = (sy - size / 2) + "px";
        // El sprite mira a la derecha; se voltea si el blanco está a la izquierda
        // y se orienta hacia él.
        var flip = tx < sx ? -1 : 1;
        img.style.transform = "translate3d(0,0,0) rotate(" + ang + "deg) scaleX(" + flip + ")";
        document.body.appendChild(img);

        // Fuerza reflow y arranca la transición hacia el blanco.
        void img.offsetWidth;
        img.style.transition = "transform " + travelMs + "ms cubic-bezier(0.35,0.15,0.6,1), opacity " + travelMs + "ms ease-in";
        img.style.transform = "translate3d(" + (tx - sx) + "px," + (ty - sy) + "px,0) rotate(" + ang + "deg) scaleX(" + flip + ")";
        setTimeout(function () { img.style.opacity = "0"; }, Math.max(0, travelMs - 90));
        setTimeout(function () { img.remove(); }, travelMs + 140);
    }

    // Impacto: sacude el elemento golpeado y dibuja una marca de corte encima.
    // Si el personaje trae proyectil, el efecto de corte se omite (ya voló el
    // sprite del proyectil desde startAttack) y solo se aplica la sacudida.
    function hitElement(t) {
        if (!t || !t.el) return;
        var el = t.el;
        el.classList.remove("mascot-hit");
        void el.offsetWidth;             // reinicia la animación de sacudida
        el.classList.add("mascot-hit");
        setTimeout(function () { el.classList.remove("mascot-hit"); }, 520);

        if (reducedMotion()) return;     // sin efectos extra con movimiento reducido
        if (MASCOT_PROJECTILE) return;   // el golpe ya lo marca el proyectil
        var r = el.getBoundingClientRect();
        var size = Math.min(Math.max(Math.min(r.width, r.height) * 0.9, 60), 190);
        var slash = document.createElement("div");
        slash.className = "mascot-slash";
        // Rojo Getsuga para Ichigo; blanco para el corte de Kenpachi.
        slash.style.setProperty("--slash-color", readChar() === "ichigo" ? "#ff2d55" : "#eafff8");
        slash.style.left = (r.left + r.width / 2 - size / 2) + "px";
        slash.style.top = (r.top + r.height / 2 - size / 2) + "px";
        slash.style.width = size + "px";
        slash.style.height = size + "px";
        slash.setAttribute("aria-hidden", "true");
        slash.addEventListener("animationend", function () { slash.remove(); });
        document.body.appendChild(slash);
    }

    // Avanza el golpe en curso: aplica el impacto a mitad de la animación (una
    // sola vez) y lo termina cuando vence su tiempo.
    function stepAttack(ts) {
        // Durante un duelo con rival, el ataque de la mascota lo gobierna el
        // subsistema Rival (por turnos); acá no tocamos nada para no cortarlo.
        if (rivalActive) return;
        if (!attacking) return;
        if (!attackHit && ts >= attackUntil - ATTACK_MS * 0.45) {
            attackHit = true;
            hitElement(attackTarget);
        }
        if (ts >= attackUntil) {
            attacking = false;
            attackTarget = null;
            if (phys) phys.tvx = 0;
        }
    }

    // "Cerebro": decide la próxima acción cuando está parado y no está ocupado.
    function decide(ts) {
        // Con un rival en pantalla manda el duelo: la mascota no deambula ni
        // ataca cartas por su cuenta; su movimiento lo dirige rivalTick (la pelea
        // se desplaza por la página), así que aquí no se toca `tvx`.
        if (rivalActive) { nextDecision = ts + 500; return; }

        // Antes que nada: de vez en cuando, atacar un objeto cercano de la página.
        if (canAttack(ts)) {
            var target = findAttackTarget();
            if (target) { startAttack(target, ts); return; }
        }

        var cx = phys.x + phys.w / 2;
        var mouseFresh = mouse.x >= 0 && ts - mouse.t < 2500;
        var r = Math.random();

        if (mouseFresh && r < 0.28) {
            // Seguir el cursor: camina hacia su X (y salta si está más arriba).
            var dir = mouse.x < cx ? -1 : 1;
            walk(dir, rand(700, 1400), ts);
            if (mouse.y < phys.y - 20 && Math.random() < 0.5) jump(ts);
        } else if (r < 0.55) {
            // Deambular: dirección al azar (o hacia el centro si está en un borde).
            var d = cx < window.innerWidth * 0.15 ? 1 :
                    cx > window.innerWidth * 0.85 ? -1 : (Math.random() < 0.5 ? -1 : 1);
            walk(d, rand(800, 1800), ts);
            if (Math.random() < 0.3) jump(ts); // saltito exploratorio
        } else if (r < 0.72) {
            // Trepar: si hay una repisa alcanzable más arriba, salta hacia ella;
            // si no, un salto simple exploratorio.
            var target = reachableTarget();
            if (target) hopTo(target, ts); else jump(ts);
        } else {
            // Descansar un momento (frena suave hacia 0).
            phys.tvx = 0;
            nextDecision = ts + rand(900, 2200);
        }
    }

    // Susto: si el cursor se mete muy cerca y en movimiento, pega un salto para
    // el lado contrario (con cooldown para que no sea epiléptico).
    function maybeFlee(ts) {
        if (!phys.ground || ts - lastFlee < 1500) return;
        if (mouse.x < 0 || ts - mouse.t > 400) return;
        var cx = phys.x + phys.w / 2, cy = phys.y + phys.h / 2;
        if (Math.hypot(mouse.x - cx, mouse.y - cy) > phys.w * 0.9) return;
        lastFlee = ts;
        var dir = mouse.x < cx ? 1 : -1; // huir del cursor
        phys.face = dir < 0 ? -1 : 1;
        phys.vx = dir * WALK * 1.8;      // salto de susto (impulso)
        phys.tvx = 0;                    // al caer, frena el correteo del susto
        phys.vy = JUMP_VY * 0.85;
        phys.ground = null;
        nextDecision = ts + 700;
        setExpr("surprised");
        setTimeout(function () { if (currentExpr === "surprised") setExpr("normal"); }, 500);
    }

    // Un paso de simulación.
    function step(dt, ts) {
        var W = window.innerWidth;

        // Golpe en curso: resuelve impacto y fin del ataque antes que nada.
        stepAttack(ts);

        // Decisiones y reacciones solo cuando está parado y sin bocadillo activo.
        if (ts >= attentionUntil) {
            if (!attacking && !rivalActive) maybeFlee(ts);
            if (phys.ground && ts >= nextDecision) decide(ts);
        } else {
            phys.tvx = 0; // "viene a hablarte": frena suave y se queda a decir algo
        }

        // Suavizado horizontal: en el piso, la velocidad se acerca a la deseada
        // (tvx) con una aceleración limitada, así arranca y frena con naturalidad
        // en vez de saltar de golpe a la velocidad máxima. En el aire se conserva
        // el impulso balístico (no hay "control aéreo"); al aterrizar, la fricción
        // del piso lo frena hacia tvx.
        if (phys.ground) {
            var tvx = phys.tvx || 0, dv = tvx - phys.vx, maxDv = ACCEL * dt;
            if (dv > maxDv) phys.vx += maxDv;
            else if (dv < -maxDv) phys.vx -= maxDv;
            else phys.vx = tvx;
        }

        // Mirar hacia el cursor cuando está (casi) quieto (salvo si hay un rival:
        // en ese caso la mascota mira al rival, no al cursor — lo fija rivalTick).
        if (!rivalActive && Math.abs(phys.vx) < 6 && mouse.x >= 0 && ts - mouse.t < 3000) {
            phys.face = mouse.x < (phys.x + phys.w / 2) ? -1 : 1;
        }

        // Horizontal + rebote contra los bordes de la ventana (se invierte también
        // la velocidad objetivo para que reencare hacia adentro, no hacia el muro).
        phys.x += phys.vx * dt;
        if (phys.x < MARGIN) {
            phys.x = MARGIN;
            phys.vx = Math.abs(phys.vx); phys.tvx = Math.abs(phys.tvx || 0); phys.face = 1;
        }
        var maxX = W - phys.w - MARGIN;
        if (phys.x > maxX) {
            phys.x = maxX;
            phys.vx = -Math.abs(phys.vx); phys.tvx = -Math.abs(phys.tvx || 0); phys.face = -1;
        }

        // Vertical: si está apoyado, comprueba que no se pasó del borde (si sí,
        // cae); si está en el aire, integra gravedad y busca dónde aterrizar.
        var prevY = phys.y, cx = phys.x + phys.w / 2;
        if (phys.ground) {
            if (cx < phys.ground.left - 3 || cx > phys.ground.right + 3) {
                phys.ground = null; // caminó fuera de la repisa → cae
            } else {
                phys.y = phys.ground.top;
            }
        }
        if (!phys.ground) {
            phys.vy += GRAV * dt;
            phys.y += phys.vy * dt;
            if (phys.vy > 0) {
                var land = landingFor(prevY, phys.y, cx);
                if (land) { phys.y = land.top; phys.vy = 0; phys.ground = land; onLand(land, ts); }
            }
        }

        // Estado de movimiento para el animador de fotogramas.
        motionAnim = !phys.ground ? "air" : (Math.abs(phys.vx) > 1 ? "walk" : "idle");

        place(phys.x, phys.y);
        applyFace();
    }

    function tick(ts) {
        // Solo reagenda mientras el motor está activo: si se detuvo (pestaña
        // oculta, paseo apagado, DOM removido) el bucle muere en vez de girar.
        if (!running || !phys) { rafId = null; return; }
        rafId = requestAnimationFrame(tick);

        // Mientras se arrastra, el usuario manda: sincronizamos la física con el
        // DOM y no simulamos (al soltar, endDrag la deja caer y aterrizar).
        if (drag) {
            var rr = root.getBoundingClientRect();
            phys.x = rr.left; phys.y = rr.top; phys.vx = 0; phys.vy = 0; phys.tvx = 0;
            phys.ground = null; lastT = ts;
            return;
        }

        if (!lastT) lastT = ts;
        var dt = Math.min(0.05, (ts - lastT) / 1000); // clamp para saltos de pestaña
        lastT = ts;
        if (dt > 0) step(dt, ts);
    }

    function startEngine() {
        if (!root || running || !roamEnabled()) return;
        var r = root.getBoundingClientRect();
        phys = { x: r.left, y: r.top, vx: 0, vy: 0, tvx: 0, w: root.offsetWidth || 72,
                 h: root.offsetHeight || 66, face: 1, ground: null };
        root.classList.add("mascot-roaming");
        running = true;
        lastT = 0;
        nextDecision = performance.now() + 600;
        wireMouse();
        if (rafId == null) rafId = requestAnimationFrame(tick);
    }

    function stopEngine() {
        running = false;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
        if (root) root.classList.remove("mascot-roaming");
        if (sprite && sprite.style) sprite.style.transform = ""; // mira de frente
        motionAnim = "idle";
        attacking = false; attackTarget = null; // corta cualquier golpe en curso
        despawnRival();                         // corta cualquier duelo en curso
        phys = null;
    }

    function wireMouse() {
        if (mouseWired) return;
        mouseWired = true;
        window.addEventListener("mousemove", function (e) {
            mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now();
        }, { passive: true });
        // Pausar el motor cuando la pestaña no se ve (ahorra batería/CPU).
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) {
                if (running) { running = false; if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }
            } else if (root && roamEnabled() && !running) {
                startEngine();
            }
        });
    }

    // API para configuración: encender/apagar el paseo en vivo.
    function setRoaming(on) {
        try { localStorage.setItem(ROAM_KEY, on ? "on" : "off"); } catch (_) {}
        if (on) { if (root) startEngine(); }
        else { stopEngine(); }
    }

    function removeDom() {
        if (!root) return;
        stopEngine();
        stopAnim();
        clearTimeout(rivalTimer);
        despawnRival();
        clearTimeout(hideTimer);
        clearTimeout(blinkTimer);
        clearTimeout(loveTimer);
        clearInterval(sleepTimer);
        sleeping = false;
        root.remove();
        root = pet = sprite = bubble = bubbleText = zzz = null;
    }

    // El spritesheet ya trae su propia animación de reposo (respiración), así
    // que el parpadeo dibujado a mano dejó de tener sentido. Se conserva la
    // función como no-op para no tocar sus llamadores.
    function scheduleBlink() {
        clearTimeout(blinkTimer);
    }

    // ── Hablar ─────────────────────────────────────────────────────────────
    var DURATION = function () {
        return (window.AnimeDestiny && window.AnimeDestiny.Constants &&
            window.AnimeDestiny.Constants.TOAST_DURATION_MS) || 4000;
    };

    // Muestra el bocadillo con un texto y reinicia la animación de "hablar".
    // Mientras el slime habla, se detiene su paseo para que "venga a decirte".
    function showBubble(message, dur) {
        // Si llega algo que decir mientras duerme, despierta sin el respingo
        // (la cara ya la fijó quien llama a hablar).
        if (sleeping) {
            sleeping = false;
            root.classList.remove("mascot-sleeping");
            attentionUntil = 0;
            lastActivity = performance.now();
        }
        bubbleText.textContent = String(message);
        bubble.classList.remove("is-leaving");
        // Reinicia la animación de "hablar".
        pet.classList.remove("mascot-talking");
        void pet.offsetWidth; // reflow para reiniciar la animación
        pet.classList.add("mascot-talking");

        requestAnimationFrame(function () {
            bubble.classList.add("is-visible");
        });

        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideBubble, dur);

        // Pausa el paseo mientras hay algo en pantalla que leer.
        pauseRoam(dur);

        // Al salir el mouse, reanuda el cierre con la mitad del tiempo.
        bubble.onmouseleave = pet.onmouseleave = function () {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideBubble, dur / 2);
        };
    }

    function say(message, type, duration) {
        if (!isEnabled()) return;
        ensureDom();
        setExpr(TYPE_FACE[type] || "normal");
        showBubble(message, duration || DURATION());
    }

    // Reacción espontánea del slime al posarse sobre un elemento de la página.
    function speak(message, expr) {
        if (!bubble || bubble.classList.contains("is-visible")) return;
        setExpr(expr || "happy");
        showBubble(message, DURATION());
    }

    function hideBubble() {
        if (!bubble) return;
        clearTimeout(hideTimer);
        bubble.classList.remove("is-visible");
        bubble.classList.add("is-leaving");
        if (pet) pet.classList.remove("mascot-talking");
        setExpr("normal");
        scheduleBlink();
    }

    // ── Corazones flotantes (feedback de cariño) ───────────────────────────
    // Suelta unos corazones que suben y se desvanecen desde el slime. Puro CSS
    // para la animación; JS solo los crea y los limpia al terminar.
    function emitHearts(n) {
        if (!root || reducedMotion()) return;
        for (var i = 0; i < n; i++) {
            (function (i) {
                var h = document.createElement("span");
                h.className = "mascot-heart";
                h.setAttribute("aria-hidden", "true");
                h.textContent = "❤";
                // Dispersión horizontal y arranque escalonado por corazón.
                h.style.setProperty("--hx", (Math.random() * 40 - 20).toFixed(0) + "px");
                h.style.animationDelay = (i * 90) + "ms";
                h.addEventListener("animationend", function () { h.remove(); });
                root.appendChild(h);
            })(i);
        }
    }

    // ── Interacción: tocar la mascota ──────────────────────────────────────
    var GREETINGS = [
        "¡Hola! Soy Rimuru. ¿Qué vas a ver hoy?",
        "¡Blop! Estoy aquí si me necesitás.",
        "¿Sumamos algo a tus listas?",
        "¡Ánimo con tu maratón! ✨",
        "Toca una noti y te la leo.",
        "¡Soy Rimuru, tu slime de confianza!"
    ];

    // Saludos según la página: el slime "sabe" dónde estás y lo comenta.
    var PAGE_GREETINGS = {
        "index":         ["¡Bienvenido a Anime Destiny! ✨", "¿Descubrimos algo nuevo hoy?"],
        "anime":         ["¿Qué anime maratoneamos? 🍿", "¡Buenísimo el catálogo de hoy!"],
        "manga":         ["¿Un buen manga para leer? 📖", "Pasá página conmigo 📚"],
        "novelas":       ["¿Nos clavamos una novela? 📓", "Historias largas, las mejores ✨"],
        "detalle":       ["¿Te tiño esta ficha de tu color? 🎨", "¿A tu lista con esta?"],
        "mis-listas":    ["¡Ordenemos tus listas! 🗂️", "¿Qué seguís viendo?"],
        "ranking":       ["¡Al top del ranking! 🏆", "¿Quién manda hoy?"],
        "top":           ["Los más grandes de todos 🏆", "¿Coincidís con el top?"],
        "comparar":      ["Enfrentá dos obras ⚔️", "¿Cuál gana el duelo?"],
        "configuracion": ["Toqueteá los ajustes 🛠️", "¿Me apagás? ¡No seas malo! 🥺"]
    };

    // Nombre de la página actual (sin extensión) para elegir el saludo.
    function currentPage() {
        try {
            var p = (location.pathname.split("/").pop() || "index").toLowerCase();
            p = p.replace(/\.html?$/, "");
            return p || "index";
        } catch (_) { return "index"; }
    }

    // Pool de saludos: los de la página + los genéricos, sin repetir.
    function greetingPool() {
        var page = PAGE_GREETINGS[currentPage()] || [];
        return page.concat(GREETINGS);
    }
    var greetIdx = 0;

    // Frases de cariño cuando lo miman varias veces seguidas.
    var LOVE_LINES = ["¡Me hacés cosquillas! 😆", "¡Te quiero! ❤", "¡Blop blop! 💕", "¡Más mimos, más! 🥰"];

    function onPetClick() {
        // Si el click viene de terminar un arrastre, no saludar.
        if (justDragged) { justDragged = false; return; }
        wakeUp();

        var now = performance.now();
        // Mimos encadenados: si tocás rápido varias veces, el slime se enamora.
        petStreak = (now - lastPetAt < 1600) ? petStreak + 1 : 1;
        lastPetAt = now;

        if (petStreak >= 3) {
            setExpr("love");
            emitHearts(Math.min(3 + petStreak, 7));
            showBubble(pick(LOVE_LINES), DURATION());
            clearTimeout(loveTimer);
            loveTimer = setTimeout(function () {
                if (currentExpr === "love") setExpr("normal");
            }, DURATION());
            return;
        }

        setExpr("happy");
        var pool = greetingPool();
        showBubble(pool[greetIdx % pool.length], DURATION());
        greetIdx++;
    }

    // ── Sueño por inactividad ──────────────────────────────────────────────
    // Tras un rato sin actividad del usuario, el slime cabecea y se duerme con
    // un "Zzz". Cualquier interacción (mover el mouse, teclear, tocarlo) lo
    // despierta con un pequeño respingo.
    var activityWired = false; // para no duplicar listeners al reactivar la mascota
    function wireActivity() {
        lastActivity = performance.now();
        clearInterval(sleepTimer);
        sleepTimer = setInterval(checkIdle, 5000);
        if (activityWired) return;
        activityWired = true;
        var mark = function () { lastActivity = performance.now(); wakeUp(); };
        var opts = { passive: true };
        window.addEventListener("mousemove", mark, opts);
        window.addEventListener("keydown", mark, opts);
        window.addEventListener("scroll", mark, opts);
        window.addEventListener("touchstart", mark, opts);
        window.addEventListener("pointerdown", mark, opts);
    }

    function checkIdle() {
        if (sleeping || !root) return;
        if (bubble && bubble.classList.contains("is-visible")) return; // hablando
        if (drag) return;                                              // en la mano
        if (performance.now() - lastActivity < IDLE_SLEEP_MS) return;
        goToSleep();
    }

    function goToSleep() {
        if (sleeping || !root) return;
        sleeping = true;
        clearTimeout(blinkTimer);
        if (phys) { phys.vx = 0; phys.tvx = 0; phys.face = 1; applyFace(); }
        pauseRoam(3.6e6); // no deambula mientras duerme (se corta al despertar)
        setExpr("sleep");
        root.classList.add("mascot-sleeping");
    }

    function wakeUp() {
        if (!sleeping) return;
        sleeping = false;
        root.classList.remove("mascot-sleeping");
        attentionUntil = 0; // corta la pausa larga del paseo
        lastActivity = performance.now();
        // Pequeño respingo al despertar y vuelta a la normalidad.
        setExpr("surprised");
        setTimeout(function () { if (currentExpr === "surprised" && !sleeping) setExpr("normal"); }, 550);
        scheduleBlink();
        if (phys) nextDecision = performance.now() + 700;
    }

    // ── Encender / apagar en vivo (desde configuración) ────────────────────
    function setEnabled(on) {
        try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch (_) {}
        if (on) {
            ensureDom();
        } else {
            removeDom();
        }
    }

    // ── Envolver window.Toast ──────────────────────────────────────────────
    // toast.js corre antes en el bundle, así que window.Toast ya existe. Si la
    // mascota está encendida, el slime habla en lugar del toast; si está
    // apagada, cae al toast original.
    var Original = window.Toast;

    function relay(type) {
        return function (msg, dur) {
            if (isEnabled()) {
                say(msg, type, dur);
            } else if (Original && Original[type]) {
                Original[type](msg, dur);
            }
        };
    }

    if (Original) {
        window.Toast = Object.freeze({
            success: relay("success"),
            error: relay("error"),
            info: relay("info"),
            warning: relay("warning")
        });
    }

    // Cambia el personaje activo, lo persiste y repinta al vuelo si está en pantalla.
    function setCharacter(id) {
        try { localStorage.setItem(CHAR_KEY, id); } catch (_) { /* storage bloqueado */ }
        applyChar(id);
        return id;
    }

    // Lista para el selector: datos mínimos + una miniatura utilizable.
    // 'sheet' → src de la hoja + cols/rows (el selector recorta la celda 0);
    // 'frames' → la primera imagen de idle como miniatura directa.
    function listCharacters() {
        return allChars().map(function (c) {
            var mode = c.mode === "frames" ? "frames" : "sheet";
            var thumb = mode === "frames"
                ? (c.frames && c.frames.idle && c.frames.idle[0]) || ""
                : c.src;
            return {
                id: c.id, name: c.name, anime: c.anime || "",
                mode: mode, thumb: thumb,
                cols: c.cols || 8, rows: c.rows || 5
            };
        });
    }

    // ── Rival: un personaje sale de forma aleatoria y DUELA con la mascota ──
    //
    // De vez en cuando, OTRO personaje del registro aparece por un borde de la
    // pantalla y desafía a la mascota. NO hay vida ni barras: la pelea es una
    // riña coreografiada que se DESPLAZA POR TODA LA PÁGINA — tras cada golpe el
    // "escenario" salta a un punto nuevo al azar y ambos corren hasta ahí antes
    // del siguiente intercambio. Dura un puñado de rondas y al final gana uno al
    // azar; el rival festeja o se queja y se retira por el borde más cercano.
    //
    // REGLA: si el personaje elegido NO tiene habilidades de ataque (sin
    // animación 'attack'), no hay pelea — ni siquiera aparece.
    var RIVAL_MIN_MS = 22000;   // espera mínima entre apariciones
    var RIVAL_MAX_MS = 55000;   // espera máxima
    var RIVAL_SPEED  = 150;     // px/s al acercarse / retirarse
    var RIVAL_ATTACK_MS = 620;  // duración de cada golpe (más ágil = más fluido)
    var RIVAL_HIT_GAP_MS = 300; // pausa entre turnos (respira la pelea)
    var RIVAL_GAP    = 30;      // holgura (px) entre rival y mascota al golpear
    var RIVAL_MAX_ROUNDS = 24;  // tope de medios-turnos (evita duelos eternos)
    var RIVAL_MOVE_MAX_MS = 2600; // tope para llegar al nuevo escenario (anti-atasco)
    var RIVAL_ARRIVE_EPS = 46;  // margen (px) para dar por llegada a la mascota
    var RIVAL_DUEL_RUN = 140;   // px/s de la mascota corriendo al nuevo escenario

    var rivalEl = null, rivalSprite = null;
    var rivalChar = null, rivalAnims = null, rivalFrames = null, rivalMode = "frames";
    var rivalRAF = null, rivalLastT = 0;
    var rivalX = 0, rivalY = 0, rivalW = 72, rivalH = 66, rivalFace = 1;
    var rivalState = "";        // "enter" | "chase" | "attack" | "ko" | "leave"
    var rivalStateUntil = 0, rivalHitDone = false;
    var rivalAnimName = "", rivalAnimStart = 0, rivalLastKey = "";
    var rivalTimer = null;
    // Estado del duelo por turnos.
    var duelTurn = "rival";     // quién pega en el turno actual: "rival" | "mascot"
    var duelRounds = 0;         // medios-turnos restantes antes del tope
    var battleAnchorX = 0;      // punto de la página al que corre la pelea ahora
    var rivalMinAt = 0;         // no golpear antes de esto (respira entre golpes)

    // ¿Este personaje sabe atacar? Devuelve su mapa ANIMS si trae 'attack', o
    // null si no. Es la comprobación que decide si hay pelea o no.
    function charAttackAnims(c) {
        if (!c) return null;
        var a = c.anims;
        if (!a) a = c.mode === "frames" ? framesToAnims(c.frames || {}) : (c.id === "rimuru" ? RIMURU.anims : null);
        return (a && a.attack && a.attack.f && a.attack.f.length) ? a : null;
    }

    // Coloca el fotograma del rival (misma lógica que setFrame pero sobre su
    // propio sprite): modo 'frames' cambia la imagen; modo 'sheet' desplaza el
    // background-position.
    function rivalSetFrame(idx, name) {
        if (!rivalSprite) return;
        if (rivalMode === "frames") {
            var list = (rivalFrames && (rivalFrames[name] || rivalFrames.idle)) || [];
            var src = list[idx] || list[0];
            if (src) rivalSprite.style.backgroundImage = "url(" + src + ")";
            return;
        }
        var cols = (rivalChar && rivalChar.cols) || 8, rows = (rivalChar && rivalChar.rows) || 5;
        var col = idx % cols, row = (idx / cols) | 0;
        rivalSprite.style.backgroundPosition =
            (cols > 1 ? (col / (cols - 1)) * 100 : 0) + "% " +
            (rows > 1 ? (row / (rows - 1)) * 100 : 0) + "%";
    }

    // Anima el rival según su estado (walk/attack/idle) recorriendo su animación.
    function rivalDrawAnim(name, ts) {
        var a = (rivalAnims && rivalAnims[name]) || (rivalAnims && rivalAnims.idle) || { f: [0], fps: 1 };
        if (name !== rivalAnimName) { rivalAnimName = name; rivalAnimStart = ts; }
        var i = reducedMotion() ? 0 : Math.floor((ts - rivalAnimStart) * a.fps / 1000) % a.f.length;
        var frame = a.f[i];
        var key = name + ":" + frame;
        if (key !== rivalLastKey) { rivalLastKey = key; rivalSetFrame(frame, name); }
    }

    function rivalPlace() {
        if (!rivalEl) return;
        rivalEl.style.left = rivalX + "px";
        rivalEl.style.top = rivalY + "px";
        if (rivalSprite) rivalSprite.style.transform = "scaleX(" + rivalFace + ")";
    }

    // Centro X de la mascota fija (para que el rival la busque / apunte).
    function mascotCenterX() {
        if (phys) return phys.x + phys.w / 2;
        if (root) { var r = root.getBoundingClientRect(); return r.left + r.width / 2; }
        return window.innerWidth / 2;
    }

    // Lanza el proyectil del rival (si lo trae) desde el rival hacia la mascota.
    function rivalProjectile(travelMs) {
        var src = rivalChar && rivalChar.projectile;
        if (!src || reducedMotion() || !root) return;
        var mr = root.getBoundingClientRect();
        var sx = rivalX + rivalW / 2, sy = rivalY + rivalH * 0.45;
        var tx = mr.left + mr.width / 2, ty = mr.top + mr.height * 0.45;
        var ang = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;
        var size = Math.min(Math.max(rivalW * 0.9, 46), 120);
        var img = document.createElement("img");
        img.className = "mascot-projectile";
        img.src = src; img.setAttribute("aria-hidden", "true");
        img.style.width = size + "px";
        img.style.left = (sx - size / 2) + "px";
        img.style.top = (sy - size / 2) + "px";
        var flip = tx < sx ? -1 : 1;
        img.style.transform = "translate3d(0,0,0) rotate(" + ang + "deg) scaleX(" + flip + ")";
        document.body.appendChild(img);
        void img.offsetWidth;
        img.style.transition = "transform " + travelMs + "ms cubic-bezier(0.35,0.15,0.6,1), opacity " + travelMs + "ms ease-in";
        img.style.transform = "translate3d(" + (tx - sx) + "px," + (ty - sy) + "px,0) rotate(" + ang + "deg) scaleX(" + flip + ")";
        setTimeout(function () { img.style.opacity = "0"; }, Math.max(0, travelMs - 90));
        setTimeout(function () { img.remove(); }, travelMs + 140);
    }

    // El proyectil de la MASCOTA hacia el rival (reusa launchProjectile con un
    // blanco falso en el centro del rival).
    function mascotDuelProjectile() {
        if (!MASCOT_PROJECTILE || !rivalEl || reducedMotion()) return;
        launchProjectile({ cx: rivalX + rivalW / 2, cy: rivalY + rivalH * 0.45, el: null }, RIVAL_ATTACK_MS * 0.45);
    }

    // Marca de corte genérica centrada en un rect (mascota o rival).
    function slashOver(r, color) {
        if (reducedMotion() || !r) return;
        var size = Math.min(Math.max(Math.min(r.width, r.height) * 1.1, 60), 190);
        var slash = document.createElement("div");
        slash.className = "mascot-slash";
        slash.style.setProperty("--slash-color", color);
        slash.style.left = (r.left + r.width / 2 - size / 2) + "px";
        slash.style.top = (r.top + r.height / 2 - size / 2) + "px";
        slash.style.width = size + "px"; slash.style.height = size + "px";
        slash.setAttribute("aria-hidden", "true");
        slash.addEventListener("animationend", function () { slash.remove(); });
        document.body.appendChild(slash);
    }
    function slashColorFor(id) { return id === "ichigo" ? "#ff2d55" : "#eafff8"; }
    function slashOverMascot() {
        if (!root) return;
        slashOver(root.getBoundingClientRect(), slashColorFor(rivalChar && rivalChar.id));
    }
    function slashOverRival() {
        if (!rivalEl) return;
        slashOver(rivalEl.getBoundingClientRect(), slashColorFor(readChar()));
    }

    // La mascota acusa el golpe: retrocede, cara triste y se queja (sin vida).
    var RIVAL_HURT_LINES = ["¡Auch! 😖", "¡Ey! 😵", "¡Blop! 💥", "¡No vale! 😤"];
    function mascotTakeHit() {
        if (pet) {
            pet.classList.remove("mascot-flinch"); void pet.offsetWidth;
            pet.classList.add("mascot-flinch");
            setTimeout(function () { if (pet) pet.classList.remove("mascot-flinch"); }, 480);
        }
        slashOverMascot();
        setExpr("sad");
        setTimeout(function () { if (currentExpr === "sad" && !sleeping && rivalActive) setExpr("normal"); }, 900);
        if (Math.random() < 0.45) speak(pick(RIVAL_HURT_LINES), "sad");
    }

    // El rival acusa el golpe de la mascota: se sacude y marca de corte (sin vida).
    function rivalTakeHit() {
        if (rivalEl) {
            rivalEl.classList.remove("mascot-rival-hurt"); void rivalEl.offsetWidth;
            rivalEl.classList.add("mascot-rival-hurt");
            setTimeout(function () { if (rivalEl) rivalEl.classList.remove("mascot-rival-hurt"); }, 460);
        }
        slashOverRival();
    }

    // Aplica un golpe: el atacante del turno pega al otro (solo efecto visual).
    function duelHit() {
        if (duelTurn === "rival") mascotTakeHit();
        else rivalTakeHit();
    }

    // Arranca un turno de ataque para `who` ("rival" | "mascot").
    function startTurn(who, ts) {
        duelTurn = who;
        rivalState = "attack";
        rivalHitDone = false;
        rivalStateUntil = ts + RIVAL_ATTACK_MS;
        rivalLastKey = "";
        var rcx = rivalX + rivalW / 2, mcx = mascotCenterX();
        rivalFace = rcx < mcx ? 1 : -1;                 // el rival mira a la mascota
        if (phys) phys.face = rcx < mcx ? -1 : 1;       // la mascota mira al rival
        if (who === "mascot") {
            // La mascota embiste hacia el rival; si tiene fotogramas de ataque,
            // los reproduce (attacking) y, si trae proyectil, lo lanza.
            if (pet) {
                pet.style.setProperty("--lx", rcx < mcx ? "-1" : "1");
                pet.classList.remove("mascot-lunge"); void pet.offsetWidth;
                pet.classList.add("mascot-lunge");
            }
            if (ANIMS && ANIMS.attack) attacking = true;
            if (MASCOT_PROJECTILE) setTimeout(mascotDuelProjectile, RIVAL_ATTACK_MS * 0.1);
            if (Math.random() < 0.4) speak(attackLine(), "happy");
        } else if (rivalChar && rivalChar.projectile) {
            setTimeout(function () { rivalProjectile(RIVAL_ATTACK_MS * 0.45); }, RIVAL_ATTACK_MS * 0.1);
        }
    }

    // Cierra el duelo al agotarse las rondas: como no hay vida, el ganador sale
    // al azar; festejo/queja y salida del rival.
    var WIN_LINES  = ["¡Gané! 🎉", "¡Blop victorioso! 💪", "¡Nadie me vence! ✨"];
    var LOSE_LINES = ["¡Me venciste! 😵", "Uf… la próxima gano 😤", "¡Ay, mi vida! 💔"];
    function endMascotAttack() {
        attacking = false;
        if (pet) pet.classList.remove("mascot-lunge");
    }
    function beginKO(ts) {
        rivalState = "ko";
        rivalStateUntil = ts + 1500;
        endMascotAttack();
        var mascotWins = Math.random() < 0.5;
        if (mascotWins) {
            setExpr("happy");
            if (Math.random() < 0.9) speak(pick(WIN_LINES), "happy");
        } else {
            setExpr("sad");
            if (Math.random() < 0.9) speak(pick(LOSE_LINES), "sad");
        }
    }

    // Elige un nuevo "escenario": un punto al azar a lo ancho de la página (dentro
    // de los márgenes) al que va a correr la pelea antes del próximo golpe.
    function pickBattleAnchor() {
        var w = phys ? phys.w : rivalW;
        var lo = MARGIN + w, hi = window.innerWidth - MARGIN - w;
        battleAnchorX = hi > lo ? rand(lo, hi) : window.innerWidth / 2;
    }

    // Empuja a la mascota (vía física) hacia un centro X y la hace mirar hacia allá.
    function driveMascotTo(cx) {
        if (!phys) return;
        var mc = phys.x + phys.w / 2, d = cx - mc;
        if (Math.abs(d) <= 6) { phys.tvx = 0; return; }
        var dir = d < 0 ? -1 : 1;
        phys.tvx = dir * RIVAL_DUEL_RUN;
        phys.face = dir;
    }

    // Bucle del duelo: el rival entra, la pelea se DESPLAZA por la página (mascota
    // y rival corren de un escenario al siguiente entre golpe y golpe) y el rival
    // se retira al agotarse las rondas.
    function rivalTick(ts) {
        if (!rivalEl) { rivalRAF = null; return; }
        rivalRAF = requestAnimationFrame(rivalTick);
        if (!rivalLastT) rivalLastT = ts;
        var dt = Math.min(0.05, (ts - rivalLastT) / 1000);
        rivalLastT = ts;

        var mcx = mascotCenterX();
        var rcx = rivalX + rivalW / 2;
        var reach = rivalW / 2 + RIVAL_GAP + (phys ? phys.w / 2 : 36);

        if (rivalState === "enter" || rivalState === "chase") {
            // La pelea corre al nuevo escenario: la mascota va al punto y el rival
            // la persigue de cerca (a la misma altura de pies aunque cambie de
            // repisa). Se golpea al llegar, o al vencer el tope anti-atasco.
            if (phys) rivalY = phys.y;
            driveMascotTo(battleAnchorX);
            var dir = rcx < mcx ? 1 : -1;
            rivalFace = dir;
            rivalX += dir * RIVAL_SPEED * dt;
            rivalDrawAnim("walk", ts);
            var mascotLlego = !phys || Math.abs((phys.x + phys.w / 2) - battleAnchorX) <= RIVAL_ARRIVE_EPS;
            var rivalCerca = Math.abs((rivalX + rivalW / 2) - mcx) <= reach;
            var deadline = rivalState === "chase" && ts >= rivalStateUntil;
            if (deadline || (rivalCerca && mascotLlego && ts >= rivalMinAt)) {
                startTurn(duelTurn === "rival" ? "mascot" : "rival", ts);
            }
        } else if (rivalState === "attack") {
            // Durante el golpe ambos se plantan: la mascota mira al rival y espera.
            if (phys) { phys.tvx = 0; phys.face = rcx < mcx ? -1 : 1; }
            attentionUntil = ts + 400;
            // El que pega reproduce 'attack'; el que recibe espera en 'idle'.
            if (duelTurn === "rival") rivalDrawAnim("attack", ts);
            else rivalDrawAnim("idle", ts);
            if (!rivalHitDone && ts >= rivalStateUntil - RIVAL_ATTACK_MS * 0.45) {
                rivalHitDone = true;
                duelHit();
            }
            if (ts >= rivalStateUntil) {
                if (duelTurn === "mascot") endMascotAttack();
                if (--duelRounds <= 0) { beginKO(ts); }
                else {
                    // Nuevo escenario: la pelea se muda a otro punto de la página.
                    rivalState = "chase"; rivalLastKey = "";
                    pickBattleAnchor();
                    rivalStateUntil = ts + RIVAL_MOVE_MAX_MS;
                    rivalMinAt = ts + RIVAL_HIT_GAP_MS;
                }
            }
        } else if (rivalState === "ko") {
            if (phys) phys.tvx = 0;
            attentionUntil = ts + 400;
            rivalDrawAnim("idle", ts);
            if (ts >= rivalStateUntil) { rivalState = "leave"; rivalLastKey = ""; }
        } else if (rivalState === "leave") {
            var out = rcx < window.innerWidth / 2 ? -1 : 1; // sale por el borde más cercano
            rivalFace = out;
            rivalX += out * RIVAL_SPEED * dt;
            rivalDrawAnim("walk", ts);
            if (rivalX < -rivalW - 10 || rivalX > window.innerWidth + 10) { despawnRival(); return; }
        }
        rivalPlace();
    }

    // Crea el rival y arranca su bucle. Asume que `c` ya pasó el filtro de ataque.
    function spawnRival(c) {
        if (!root || rivalActive) return;
        rivalAnims = charAttackAnims(c);
        if (!rivalAnims) return;          // doble seguro: sin ataque, no pelea
        rivalChar = c;
        rivalMode = c.mode === "frames" ? "frames" : "sheet";
        rivalFrames = c.frames || null;
        rivalActive = true;
        preloadFrames(c);                 // evita el parpadeo del rival al animar

        // Corta cualquier ataque a la página en curso: ahora manda el duelo.
        attacking = false; attackTarget = null;

        rivalEl = document.createElement("div");
        rivalEl.className = "mascot-rival";
        rivalEl.setAttribute("aria-hidden", "true");
        rivalSprite = document.createElement("div");
        rivalSprite.className = "mascot-rival-sprite";
        if (rivalMode === "frames") {
            rivalSprite.style.backgroundSize = "100% 100%";
            rivalSprite.style.imageRendering = "auto";
        } else {
            rivalSprite.style.backgroundImage = "url(" + (c.src || "") + ")";
            rivalSprite.style.backgroundSize = ((c.cols || 8) * 100) + "% " + ((c.rows || 5) * 100) + "%";
            rivalSprite.style.imageRendering = "pixelated";
        }
        rivalEl.appendChild(rivalSprite);
        document.body.appendChild(rivalEl);

        // Mismo tamaño y línea de pies que la mascota (pelean "a la par").
        var mr = root.getBoundingClientRect();
        rivalW = mr.width; rivalH = mr.height;
        rivalEl.style.width = rivalW + "px";
        rivalEl.style.height = rivalH + "px";
        rivalY = mr.top;
        // Aparece por el borde OPUESTO al lado de la mascota y camina hacia ella.
        var mcx = mr.left + mr.width / 2;
        if (mcx < window.innerWidth / 2) rivalX = window.innerWidth + 8; // mascota a la izq → entra por la der
        else rivalX = -rivalW - 8;                                        // mascota a la der → entra por la izq
        rivalFace = (rivalX + rivalW / 2) < mcx ? 1 : -1;

        // Sin vida: el duelo dura un puñado de rondas y luego gana uno al azar.
        duelRounds = RIVAL_MAX_ROUNDS;
        // `duelTurn` arranca en "mascot" para que el primer golpe lo dé el rival
        // (rivalTick alterna al pasar de escenario).
        duelTurn = "mascot";

        // Primer escenario: la pelea corre hacia ese punto mientras el rival entra.
        pickBattleAnchor();

        rivalState = "enter";
        rivalStateUntil = 0; rivalMinAt = 0; rivalHitDone = false;
        rivalAnimName = ""; rivalLastKey = ""; rivalLastT = 0;
        rivalPlace();
        if (rivalRAF == null) rivalRAF = requestAnimationFrame(rivalTick);
    }

    // Quita el rival y devuelve la mascota a su vida normal.
    function despawnRival() {
        if (rivalRAF != null) { cancelAnimationFrame(rivalRAF); rivalRAF = null; }
        if (rivalEl) rivalEl.remove();
        rivalEl = rivalSprite = null;
        rivalChar = rivalAnims = rivalFrames = null;
        rivalState = ""; rivalActive = false;
        endMascotAttack();
        attentionUntil = 0;
        if (currentExpr === "sad" || currentExpr === "happy") setExpr("normal");
        if (phys) nextDecision = performance.now() + 500;
    }

    // Elige un personaje al azar (distinto del activo) y, SOLO si sabe atacar,
    // lo hace aparecer para desafiar a la mascota. Si no sabe atacar, no pelea.
    function tryRival() {
        if (!root || !isEnabled() || rivalActive) return;
        if (!roamEnabled() || reducedMotion()) return; // atado a la "vida"/paseo de la mascota
        if (document.hidden || !running || sleeping || drag) return;
        var cur = readChar();
        var pool = allChars().filter(function (c) { return c.id !== cur; });
        if (!pool.length) return;
        var c = pick(pool);
        // REGLA: si el personaje no tiene habilidades de ataque, no se pelean.
        if (!charAttackAnims(c)) return;
        spawnRival(c);
    }

    function scheduleRival() {
        clearTimeout(rivalTimer);
        rivalTimer = setTimeout(function () {
            tryRival();
            scheduleRival();
        }, rand(RIVAL_MIN_MS, RIVAL_MAX_MS));
    }

    // API pública.
    window.Mascot = Object.freeze({
        say: say,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        setRoaming: setRoaming,
        isRoaming: roamPref,
        setCharacter: setCharacter,
        getCharacter: readChar,
        listCharacters: listCharacters
    });

    // Mostrar la mascota al cargar si está activada (es una mascota que "vive"
    // en pantalla, no solo aparece con las notificaciones).
    function init() {
        if (isEnabled()) ensureDom();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

})(window);


/* ========================================== */
/* === FILE: js/catalog/states.js === */
/* ========================================== */

// ==========================================
// catalog/states.js
// SISTEMA DE FAVORITOS, VISTOS Y SINCRONIZACIÓN
// ==========================================

(function (window) {
    "use strict";

    const SYNC_QUEUE_KEY = "syncQueue";

    function getSyncQueue() {
        try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || []; }
        catch (e) { console.warn('getSyncQueue: corrupt data, resetting:', e); return []; }
    }

    function saveSyncQueue(queue) {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }

    function enqueueSync(op) {
        const queue = getSyncQueue();
        queue.push({ ...op, ts: Date.now() });
        saveSyncQueue(queue);
    }

    async function drainSyncQueue() {
        const client = window.AppSupabase;
        if (!client?.isSignedIn?.()) return;
        const queue = getSyncQueue();
        if (!queue.length) return;
        const remaining = [];
        for (const op of queue) {
            try {
                if (op.type === "item_state") {
                    await client.saveItemState(op.payload);
                } else if (op.type === "experience") {
                    await client.addExperience(op.payload.delta);
                }
            } catch (error) {
                if (isSessionExpired(error)) showSyncToast('Sesión expirada. Los cambios pendientes se reintentarán automáticamente.', 'session-expired');
                remaining.push(op);
            }
        }
        saveSyncQueue(remaining);
    }

    function isSessionExpired(error) {
        return error?.status === 401
            || String(error?.message || '').toLowerCase().includes('expir')
            || String(error?.message || '').toLowerCase().includes('jwt')
            || String(error?.code || '').toLowerCase().includes('pgrst301');
    }

    function syncItemStateToSupabase(category, itemId, fav, viewed, meta = {}, watchStatus) {
        const client = window.AppSupabase;
        const payload = { category, itemId, fav, viewed, meta };
        if (watchStatus !== undefined) payload.watchStatus = watchStatus;
        if (!client?.saveItemState) {
            enqueueSync({ type: "item_state", payload });
            return;
        }
        client.saveItemState(payload).catch((error) => {
            if (isSessionExpired(error)) showSyncToast('Sesión expirada. Tu progreso se guardó y se sincronizará al reconectar.', 'session-expired');
            console.warn('No se pudo sincronizar estado a Supabase:', error);
            enqueueSync({ type: "item_state", payload });
        });
    }

    // ─── Estados de seguimiento (viendo / pendiente / pausado / abandonado) ──
    const WATCH_STATUSES = ['viendo', 'pendiente', 'pausado', 'abandonado'];
    const WATCH_STATUS_LABELS = {
        viendo: 'Viendo',
        pendiente: 'Pendiente',
        pausado: 'En pausa',
        abandonado: 'Abandonado'
    };

    function watchStatusKey(userId, itemId) {
        return `u:${userId}|item:${itemId}|wstatus`;
    }

    function getWatchStatus(userId, itemId) {
        const v = UserStore.getItem(watchStatusKey(userId, itemId)) || '';
        return WATCH_STATUSES.includes(v) ? v : '';
    }

    // status: '' para quitar. meta opcional {titulo, img, info, total, __category}.
    function setWatchStatus(itemId, status, meta) {
        const userId = getCurrentUserId();
        if (userId === 'Invitado') {
            window.location.href = 'Login.html';
            return '';
        }
        const clean = WATCH_STATUSES.includes(status) ? status : '';
        const key = watchStatusKey(userId, itemId);
        if (clean) UserStore.setItem(key, clean);
        else UserStore.removeItem(key);
        UserStore.setItem(`u:${userId}|item:${itemId}|ts`, new Date().toISOString());

        const metaKey = `u:${userId}|itemMeta:${itemId}`;
        const fav = !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav'));
        const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));

        if (meta && meta.titulo && (clean || fav || viewed)) {
            UserStore.setItem(metaKey, JSON.stringify({
                id: String(itemId),
                titulo: String(meta.titulo).trim(),
                img: meta.img || '',
                info: meta.info || '',
                total: Number(meta.total || 0),
                __category: meta.__category || getCategoriaActual() || 'listas'
            }));
        } else if (!clean && !fav && !viewed) {
            UserStore.removeItem(metaKey);
        }

        var metaObj = {};
        try {
            var metaRaw = UserStore.getItem(metaKey);
            if (metaRaw) metaObj = JSON.parse(metaRaw);
        } catch { /* meta corrupta: sync sin datos de item */ }

        syncItemStateToSupabase(
            (metaObj && metaObj.__category) || 'listas',
            String(itemId), fav, viewed, metaObj, clean
        );

        if (window.Toast) {
            if (clean) window.Toast.success('Estado: ' + WATCH_STATUS_LABELS[clean]);
            else window.Toast.info('Estado de seguimiento quitado');
        }
        return clean;
    }

    function addUserPoints(userId, delta) {
        if (!userId || userId === 'Invitado') return;
        const currentPoints = getUserPoints(userId);
        const oldLevelInfo = levelFromPoints(currentPoints);

        const next = Math.max(0, currentPoints + delta);
        // Delta efectivo: clamp a 0 para que la EXP nunca baje de 0 en el server
        // (evita romper el CHECK exp >= 0 al restar EXP por desmarcar).
        const effectiveDelta = next - currentPoints;
        UserStore.setItem(pointsKey(userId), String(next));

        const newLevelInfo = levelFromPoints(next);
        if (newLevelInfo.level > oldLevelInfo.level) {
            if (window.Toast) {
                const translatedMsg = window.AppI18n
                    ? window.AppI18n.t("notification.levelup", { level: newLevelInfo.level })
                    : `¡Subiste de Nivel! 🎉 ¡Ahora eres Nivel ${newLevelInfo.level}! 🌟`;
                window.Toast.success(translatedMsg, 6000);
            }
        }

        if (effectiveDelta === 0) return; // nada real que sincronizar

        const client = window.AppSupabase;
        if (!client?.addExperience) {
            enqueueSync({ type: "experience", payload: { delta: effectiveDelta } });
            return;
        }
        client.addExperience(effectiveDelta).catch((error) => {
            if (isSessionExpired(error)) showSyncToast('Sesión expirada. La experiencia se sincronizará al reconectar.', 'session-expired');
            enqueueSync({ type: "experience", payload: { delta: effectiveDelta } });
        });
    }

    // ─── Toast auto-contenido para alertas de sincronización ──────────
    var _sessionToastShown = false;

    function showSyncToast(message, type) {
        if (type === 'session-expired' && _sessionToastShown) return;
        if (type === 'session-expired') _sessionToastShown = true;

        var existing = document.getElementById('_syncToast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = '_syncToast';
        toast.className = 'sync-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('is-visible');
        });

        setTimeout(function () {
            toast.classList.remove('is-visible');
            setTimeout(function () { toast.remove(); }, 300);
        }, 5000);
    }

    function getCategoriaActual() {
        const pathName = String(window.location.pathname || '').toLowerCase();
        if (pathName.includes('manga.html')) return 'manga';
        if (pathName.includes('anime.html')) return 'anime';
        if (pathName.includes('novelas.html')) return 'novelas';
        const fromBody = document.body.getAttribute('data-page');
        return fromBody ? String(fromBody) : '';
    }

    function statusStorageKey(userId, itemId, type) {
        return `u:${userId}|item:${itemId}|${type}`;
    }

    function pointsKey(userId) {
        return `u:${userId}|points`;
    }

    function getUserPoints(userId) {
        const n = Number(UserStore.getItem(pointsKey(userId)) || '0');
        return Number.isFinite(n) ? n : 0;
    }

    function levelFromPoints(points) {
        const p = Number(points) || 0;
        const maxLevel = AnimeDestiny.Constants.XP_MAX_LEVEL || 50;
        let level = 1;
        let need = AnimeDestiny.Constants.XP_BASE || 100;
        let remaining = p;
        // Se corta al llegar al nivel máximo ANTES de subir, para no devolver un
        // nivel por encima del tope ni un "next" desalineado con el nivel real.
        while (remaining >= need && level < maxLevel) {
            remaining -= need;
            level += 1;
            need = Math.floor(need * (AnimeDestiny.Constants.XP_MULTIPLIER || 1.2));
        }
        const atMax = level >= maxLevel;
        return { level, current: remaining, next: need, atMax };
    }

    // Cuánta EXP hace falta para pasar del nivel `level` al siguiente.
    // Sigue la misma progresión que levelFromPoints (base ×1.2 por nivel).
    function needForLevel(level) {
        const base = AnimeDestiny.Constants.XP_BASE || 100;
        const mult = AnimeDestiny.Constants.XP_MULTIPLIER || 1.2;
        let need = base;
        for (let l = 1; l < level; l++) need = Math.floor(need * mult);
        return need;
    }

    // Nivel "de verdad" del usuario para la UI.
    // El servidor (add_user_exp) es la fuente de autoridad: guarda level y exp por
    // SEPARADO, donde exp es solo el sobrante dentro del nivel actual (ya se le
    // restó lo consumido al subir). Al sincronizar, ese sobrante queda en `points`,
    // así que levelFromPoints(points) daría ≈ nivel 1 para un usuario avanzado.
    // Por eso, si hay un nivel guardado (u:<id>|level) mayor al derivado del
    // sobrante, mandan el nivel guardado y el sobrante como progreso del nivel.
    function resolveUserLevel(userId) {
        const maxLevel = AnimeDestiny.Constants.XP_MAX_LEVEL || 50;
        const points = getUserPoints(userId);
        const lv = levelFromPoints(points);
        const storedLevel = Number(UserStore.getItem(`u:${userId}|level`) || '0');
        if (Number.isFinite(storedLevel) && storedLevel > lv.level) {
            const level = Math.min(storedLevel, maxLevel);
            const next = needForLevel(level);
            const current = Math.max(0, Math.min(points, next));
            return { level, current, next, atMax: level >= maxLevel, points };
        }
        return { level: lv.level, current: lv.current, next: lv.next, atMax: lv.atMax, points };
    }

    function countKeysWithPrefix(prefix) {
        try {
            let count = 0;
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!k) continue;
                if (k.startsWith(prefix) && UserStore.getItem(k)) count++;
            }
            return count;
        } catch (e) {
            console.warn('countKeysWithPrefix failed:', e);
            return 0;
        }
    }

    function countUserStatesBoth(userId) {
        if (!userId || userId === 'Invitado') return { fav: 0, viewed: 0 };
        let fav = 0, viewed = 0;
        const prefix = `u:${userId}|item:`;
        try {
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (!key || !key.startsWith(prefix) || !UserStore.getItem(key)) continue;
                if (key.endsWith('|fav'))         fav++;
                else if (key.endsWith('|viewed')) viewed++;
            }
        } catch (e) { console.warn('countUserStatesBoth failed:', e); }
        return { fav, viewed };
    }

    function getPreference(key, fallback = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return fallback;
            return value === 'true';
        } catch {
            return fallback;
        }
    }

    function applyUserPreferences() {
        if (typeof document === 'undefined' || !document.body) return;
        document.body.classList.toggle('compact-cards', getPreference('pref:compactCards', false));
        document.body.classList.toggle('reduce-motion', getPreference('pref:reduceMotion', false));
    }

    function getPreferenceValue(key, fallback = '') {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch {
            return fallback;
        }
    }

    function clearInlineBackgroundStyle(body) {
        body.style.removeProperty('background');
        body.style.removeProperty('background-image');
        body.style.removeProperty('background-color');
        body.style.removeProperty('background-repeat');
        body.style.removeProperty('background-size');
        body.style.removeProperty('background-position');
        body.style.removeProperty('background-attachment');
    }

    function applyBackgroundPreference() {
        if (typeof document === 'undefined' || !document.body) return;
        const body = document.body;
        const mode = getPreferenceValue('pref:bgMode', 'default');
        clearInlineBackgroundStyle(body);

        if (mode === 'color') {
            const color = getPreferenceValue('pref:bgColor', '#2b0a55');
            body.style.background = `linear-gradient(180deg, #000000 0%, ${color} 100%)`;
            body.style.backgroundAttachment = 'fixed';
        } else if (mode === 'image') {
            const imageUrl = getPreferenceValue('pref:bgImage', '');
            if (imageUrl) {
                body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.76)), url("${safeUrl(imageUrl) || ''}")`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center center';
                body.style.backgroundRepeat = 'no-repeat';
                body.style.backgroundAttachment = 'fixed';
            }
        }
    }

    function getUserStateSummary(userId) {
        const points = getUserPoints(userId);
        const level = levelFromPoints(points);
        const { fav: favorites, viewed } = countUserStatesBoth(userId);
        return { points, level, favorites, viewed };
    }

    function buildSearchIndexForItem(category, item) {
        const parts = [
            item?.titulo,
            item?.info,
            item?.status,
            item?.demografia
        ];

        // Aca habia otra llamada a `obtenerDetalleItem` con el mismo problema:
        // devuelve una Promise, `if (detail)` daba siempre true, y todos los
        // campos que se empujaban (estudio, editor, resumen, temporadas...) eran
        // undefined y terminaban descartados por el filter(Boolean) de abajo.
        // O sea: no aportaba ni un caracter al indice y costaba una request por
        // item. El indice de los catalogos de API ya se arma en cards.js con los
        // datos que la propia respuesta trae.

        return parts
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
            .join(' ');
    }

    // Ojo con `obtenerDetalleItem`: devuelve una Promise (pega a AniList por id),
    // y aca se la usaba como si fuera un objeto plano. `det?.volumenes` sobre una
    // Promise es undefined, con lo cual el total siempre daba 0 y la funcion
    // retornaba 0 sin mirar nada — pero igual gastaba UNA request por card.
    // En un catalogo de manga eso eran ~40 requests de mas por carga, y el
    // presupuesto de AniList es de 30 por minuto: alcanzaba para agotarlo solo.
    //
    // El total real ya viaja en el atributo data-total de la card, que es lo que
    // resolveCatalogProgress consulta antes de caer aca. Si no hay total, no hay
    // porcentaje posible: se devuelve null y el llamador muestra la card
    // alternativa (mismo resultado visual que antes, sin peticiones).
    function getProgressPercentForItem(userId, category, itemId) {
        try {
            const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
            if (viewed) return 100;
        } catch (e) {
            console.warn('getProgressPercentForItem failed:', e);
        }
        return null;
    }

    function updateCardProgressIndicators() {
        const mainContainer = document.getElementById('main-content');
        if (!mainContainer) return;
        const category = document.body.getAttribute('data-page') || '';
        const userId = getCurrentUserId();
        const cards = mainContainer.querySelectorAll('.card-container[data-item-id]');

        cards.forEach((card) => {
            try {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;
            const progressBox = card.querySelector('[data-progress]');
            if (!progressBox) return;

            const meta = resolveCatalogProgress(userId, String(category), String(itemId), card);

            if (!meta.show) {
                progressBox.style.display = 'none';
                return;
            }

            const dataTotal = Number(progressBox.getAttribute('data-total') || 0);
            if (dataTotal === 0) {
                // Caso: Progreso Libre (safeTotal === 0)
                const noProgCard = progressBox.querySelector('.card-back-no-progress-card');
                const viewedFooter = progressBox.querySelector('[data-viewed-footer]');
                if (meta.pct === 100) {
                    if (noProgCard) noProgCard.style.display = 'none';
                    if (viewedFooter) viewedFooter.style.display = '';
                } else {
                    if (noProgCard) noProgCard.style.display = '';
                    if (viewedFooter) viewedFooter.style.display = 'none';
                }
            } else {
                // Caso normal con barra de progreso
                const fillEl = progressBox.querySelector('.card-back-progress-fill');
                const pctEl = progressBox.querySelector('[data-pct-text]');
                const pctOnlyEl = progressBox.querySelector('[data-pct-only]');
                const metaEl = progressBox.querySelector('[data-meta-text]');

                if (fillEl) fillEl.style.width = `${meta.pct}%`;
                if (pctEl) pctEl.textContent = `${meta.pct}% VISTO`;
                if (pctOnlyEl) pctOnlyEl.textContent = `${meta.pct}%`;
                if (metaEl) {
                    const pr = progressBox.getAttribute('data-prefix') || 'EP';
                    metaEl.textContent = meta.total
                        ? `${pr} ${meta.watched}/${meta.total}`
                        : `${meta.pct}%`;
                }
            }

            progressBox.style.display = '';
            } catch (e) {
                console.warn('updateCardProgressIndicators: card failed:', e);
            }
        });
    }

    function toggleStatus(btn, type, itemId) {
        const userId = getCurrentUserId();
        if (userId === 'Invitado') {
            window.location.href = 'Login.html';
            return;
        }

        const storageKey = statusStorageKey(userId, itemId, type);

        const xp = type === 'viewed'
            ? (AnimeDestiny.Constants.XP_VIEWED || 10)
            : (AnimeDestiny.Constants.XP_FAV || 5);

        const enabled = !UserStore.getItem(storageKey);
        if (enabled) {
            UserStore.setItem(storageKey, '1');
            if (typeof window._invalidateProgressIndex === 'function') window._invalidateProgressIndex();
            addUserPoints(userId, xp);
            if (window.Toast) {
                if (type === 'fav') window.Toast.success(`¡Agregado a Favoritos! ❤️ (+${xp} EXP)`);
                if (type === 'viewed') window.Toast.success(`¡Marcado como Visto! 👁️ (+${xp} EXP)`);
            }
        } else {
            UserStore.removeItem(storageKey);
            addUserPoints(userId, -xp);
            if (window.Toast) {
                if (type === 'fav') window.Toast.info(`Quitado de Favoritos (-${xp} EXP)`);
                if (type === 'viewed') window.Toast.info(`Marcado como no visto (-${xp} EXP)`);
            }
        }

        btn.classList.toggle('active', enabled);
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');

        UserStore.setItem(`u:${userId}|item:${itemId}|ts`, new Date().toISOString());

        const card = btn.closest('.card-container') || btn.closest('[data-item-id]');

        const metaKey = `u:${userId}|itemMeta:${itemId}`;

        if (card && userId !== 'Invitado') {
            const fav = !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav'));
            const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
            const wstatus = getWatchStatus(userId, itemId);
            const category = card.getAttribute('data-category') || getCategoriaActual() || '';
            const img = card.getAttribute('data-img') || card.querySelector('img')?.getAttribute('src') || '';
            const titulo = card.getAttribute('data-title') || card.querySelector('.catalog-card-title, .card-back-title')?.textContent || itemId;
            const info = card.getAttribute('data-genres') || card.getAttribute('data-search-index') || '';

            if (fav || viewed || wstatus) {
                var total = card.getAttribute('data-total') || '0';
                var finalCat = String(category);
                if (!finalCat) finalCat = 'listas';
                UserStore.setItem(metaKey, JSON.stringify({
                    id: String(itemId),
                    titulo: String(titulo).trim(),
                    img,
                    info,
                    total: Number(total),
                    __category: finalCat
                }));
            } else {
                UserStore.removeItem(metaKey);
            }
        }

        var metaRaw = UserStore.getItem(metaKey);
        var metaObj = {};
        try { if (metaRaw) metaObj = JSON.parse(metaRaw); } catch { console.warn('Invalid meta JSON for', metaKey); }

        var syncCat = (metaObj && metaObj.__category) || 'listas';
        syncItemStateToSupabase(
            syncCat,
            String(itemId),
            !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav')),
            !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed')),
            metaObj,
            getWatchStatus(userId, itemId)
        );

        updateCardProgressIndicators();
    }

    function applyRemoteStateToCards(cards, userId) {
        if (!cards || !cards.length) return;
        const favSet = new Set();
        const viewedSet = new Set();
        const prefix = `u:${userId}|item:`;
        try {
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!k || !k.startsWith(prefix) || !UserStore.getItem(k)) continue;
                if (k.endsWith('|fav'))         favSet.add(k.slice(prefix.length, k.length - 4));
                else if (k.endsWith('|viewed')) viewedSet.add(k.slice(prefix.length, k.length - 7));
            }
        } catch (e) { console.warn('applyRemoteStateToCards scan failed:', e); }
        cards.forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;
            const isFav    = favSet.has(itemId);
            const isViewed = viewedSet.has(itemId);
            const favBtn     = card.querySelector('.fav-btn');
            const viewedBtn  = card.querySelector('.viewed-btn');
            if (favBtn)    favBtn.classList.toggle('active', isFav);
            if (viewedBtn) viewedBtn.classList.toggle('active', isViewed);
        });
        updateCardProgressIndicators();
    }

    function syncStatesFromSupabase(category, userId, cards) {
        const client = window.AppSupabase;
        if (!client?.loadItemStates || !client?.isSignedIn?.()) return;
        const validCategories = ['anime', 'manga', 'novelas'];
        const filter = validCategories.includes(category) ? category : '';
        client.loadItemStates(filter).then((states) => {
            if (!Array.isArray(states)) return;
            states.forEach((state) => {
                const key = state.item_id;
                if (!key) return;
                if (state.fav)    UserStore.setItem(statusStorageKey(userId, key, 'fav'), '1');
                if (state.viewed) UserStore.setItem(statusStorageKey(userId, key, 'viewed'), '1');
                if (state.watch_status && WATCH_STATUSES.includes(state.watch_status)) {
                    UserStore.setItem(watchStatusKey(userId, key), state.watch_status);
                }
            });
            applyRemoteStateToCards(cards, userId);
        }).catch((error) => {
            console.warn('No se pudo cargar estados desde Supabase:', error);
        });
    }

    function cargarEstadosBotones() {
        const userId = getCurrentUserId();
        const cards = document.querySelectorAll('[data-item-id]');
        if (!cards.length) return;

        const favSet = new Set();
        const viewedSet = new Set();
        const prefix = `u:${userId}|item:`;
        try {
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!k || !k.startsWith(prefix)) continue;
                const val = UserStore.getItem(k);
                if (!val) continue;
                if (k.endsWith('|fav'))    favSet.add(k.slice(prefix.length, k.length - 4));
                if (k.endsWith('|viewed')) viewedSet.add(k.slice(prefix.length, k.length - 7));
            }
        } catch (e) { console.warn('cargarEstadosBotones scan failed:', e); }

        cards.forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;

            const isFav    = favSet.has(itemId);
            const isViewed = viewedSet.has(itemId);

            const favBtn  = card.querySelector('.fav-btn');
            const viewedBtn = card.querySelector('.viewed-btn');
            if (favBtn)    favBtn.classList.toggle('active', isFav);
            if (viewedBtn) viewedBtn.classList.toggle('active', isViewed);

            const statusSel = card.querySelector('.watch-status-select');
            if (statusSel) statusSel.value = getWatchStatus(userId, itemId);
        });

        updateCardProgressIndicators();
        syncStatesFromSupabase(getCategoriaActual(), userId, cards);
    }

    // ─── Inicializar cola de reintentos ─────────────────────────────────
    (function initSyncQueue() {
        drainSyncQueue();
        window.addEventListener("supabase-auth-changed", () => {
            if (window.AppSupabase?.isSignedIn?.()) {
                drainSyncQueue();
            }
        });
        window.addEventListener("online", drainSyncQueue);
    })();

    // ─── Aplicar preferencias de usuario al cargar ──────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        applyUserPreferences();
        applyBackgroundPreference();
    });

    window.addEventListener('pageshow', function (e) {
        if (e.persisted) cargarEstadosBotones();
    });

    window.addEventListener('storage', function (e) {
        if (e.key && e.key.startsWith('u:')) cargarEstadosBotones();
    });

    // ─── Event delegation para acciones de catálogo ─────────────────────
    (function initCatalogDelegation() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var itemId = btn.getAttribute('data-item-id');
            var action = btn.getAttribute('data-action');
            if (!itemId || !action) return;
            toggleStatus(btn, action, itemId);
        });

        // Select de estado de seguimiento en el dorso de las cards
        document.addEventListener('change', function (e) {
            var sel = e.target;
            if (!sel || !sel.classList || !sel.classList.contains('watch-status-select')) return;
            var itemId = sel.getAttribute('data-item-id');
            if (!itemId) return;
            // parentElement: el select también tiene data-item-id y closest lo matchearía
            var card = sel.parentElement ? sel.parentElement.closest('[data-item-id]') : null;
            var meta = card ? {
                titulo: card.getAttribute('data-title') || card.querySelector('.catalog-card-title, .card-back-title')?.textContent || itemId,
                img: card.querySelector('img')?.getAttribute('src') || '',
                info: card.getAttribute('data-genres') || '',
                total: card.getAttribute('data-total') || 0,
                __category: card.getAttribute('data-category') || getCategoriaActual() || ''
            } : null;
            var applied = setWatchStatus(itemId, sel.value, meta);
            if (applied !== sel.value) sel.value = applied;
        });
    })();

    // Exports
    window.addUserPoints = addUserPoints;
    window.cargarEstadosBotones = cargarEstadosBotones;
    window.getProgressPercentForItem = getProgressPercentForItem;
    window.buildSearchIndexForItem = buildSearchIndexForItem;
    window.getCategoriaActual = getCategoriaActual;
    window.statusStorageKey = statusStorageKey;
    window.syncItemStateToSupabase = syncItemStateToSupabase;
    window.getUserPoints = getUserPoints;
    window.levelFromPoints = levelFromPoints;
    window.needForLevel = needForLevel;
    window.resolveUserLevel = resolveUserLevel;
    window.pointsKey = pointsKey;
    window.setWatchStatus = setWatchStatus;
    window.getWatchStatus = getWatchStatus;
    window.WATCH_STATUSES = WATCH_STATUSES;
    window.WATCH_STATUS_LABELS = WATCH_STATUS_LABELS;

})(window);


/* ========================================== */
/* === FILE: js/catalog/cards.js === */
/* ========================================== */

// ==========================================
// catalog/cards.js
// Render de tarjetas, progreso y carga de catálogo desde API
// ==========================================

const CATALOG_FLIP_ICON_SVG = '<svg class="catalog-flip-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>';

var SKELETON_COUNT = AnimeDestiny.Constants.SKELETON_COUNT || 40;

function renderSkeletonCards(container, count) {
    if (!container) return;
    const skeletonHTML = `
        <div class="skeleton-card">
            <div class="skeleton-card-shell">
                <div class="skeleton-card-inner">
                    <div class="skeleton-card-poster"></div>
                    <div class="skeleton-card-bar">
                        <div class="skeleton-card-bar-line"></div>
                        <div class="skeleton-card-bar-icon"></div>
                    </div>
                </div>
            </div>
        </div>`;
    container.innerHTML = skeletonHTML.repeat(count);
}

function getApiPoster(item) {
    return item?.images?.webp?.large_image_url
        || item?.images?.jpg?.large_image_url
        || item?.images?.jpg?.image_url
        || item?.images?.webp?.image_url
        || '';
}


function getApiCatalogInfo(categoria, item) {
    if (categoria === 'anime') {
        const parts = [item?.type, item?.episodes ? `${item.episodes} eps` : '', item?.status].filter(Boolean);
        return parts.join(' / ') || 'Anime';
    }

    const typeLabel = String(item?.type || '').toLowerCase().includes('light')
        ? 'Novela ligera'
        : (String(item?.type || '').toLowerCase() === 'novel' ? 'Novela' : (item?.type || 'Manga'));
    const volcap = item?.volumes ? `${item.volumes} vol.` : (item?.chapters ? `${item.chapters} cap.` : '');
    const parts = [typeLabel, volcap, item?.status].filter(Boolean);
    if (categoria === 'novelas') return parts.join(' / ') || 'Novela';
    return parts.join(' / ') || 'Manga';
}


function normalizeCatalogGenre(text) {
    return normalizeText(text).trim();
}


function getApiGenresList(item) {
    const genres = Array.isArray(item?.genres)
        ? item.genres.map((genre) => typeof genre === 'string' ? genre : genre?.name)
        : [];
    const themes = Array.isArray(item?.themes)
        ? item.themes.map((theme) => typeof theme === 'string' ? theme : theme?.name)
        : [];

    if (item?.type) {
        genres.push(item.type);
    }

    const seen = new Set();
    return [...genres, ...themes]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => {
            const norm = normalizeCatalogGenre(value);
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
        });
}





function buildCatalogBackProgressHtml(categoria, total, volCount, chCount) {
    var prefix, label;
    if (categoria === 'anime') {
        prefix = 'EP';
        label = 'capítulos';
    } else if (volCount > 0) {
        prefix = 'VOL';
        label = 'volúmenes';
    } else {
        prefix = 'CH';
        label = 'capítulos';
    }
    const safeTotal = Number(total) > 0 ? Number(total) : 0;
    
    // Si no hay total, mostramos una interfaz alternativa simplificada
    if (safeTotal === 0) {
        return `
        <div class="card-back-progress-wrapper" data-progress data-total="0" data-label="${label}" data-prefix="${prefix}">
            <div class="card-back-progress-card card-back-no-progress-card">
                <span class="no-progress-text">Progreso libre</span>
                <span class="no-progress-subtext">Marcá como visto completo usando el botón 👁</span>
            </div>
            <div class="card-back-footer-status" style="display:none" data-viewed-footer>
                <div class="footer-line"></div>
                <span>100% VISTO</span>
                <div class="footer-line"></div>
            </div>
        </div>`;
    }

    return `
        <div class="card-back-progress-wrapper" data-progress data-total="${safeTotal}" data-label="${label}" data-prefix="${prefix}" style="display:none">
            <div class="card-back-progress-card">
                <div class="card-back-progress-head" data-meta-text>
                    ${prefix} 0/${safeTotal}
                </div>
                <div class="card-back-progress-row">
                    <div class="card-back-progress-track">
                        <div class="card-progress-fill card-back-progress-fill" style="width:0%"></div>
                    </div>
                    <div class="card-back-progress-pct" data-pct-only>0%</div>
                </div>
            </div>
            <div class="card-back-footer-status">
                <div class="footer-line"></div>
                <span data-pct-text>0% VISTO</span>
                <div class="footer-line"></div>
            </div>
        </div>`;
}


// ─── In-memory progress index (built once per render, cleared on state change) ──
// Maps "userId|prefix" → Map<itemId, Set<episodeNums>>
var _progressIndex = null;
var _progressIndexUser = null;

function _buildProgressIndex(userId) {
    if (_progressIndex && _progressIndexUser === userId) return _progressIndex;
    // Scan UserStore once, partition by item type
    var index = { anime: new Map(), manga: new Map(), novelas: new Map() };
    try {
        var keys = UserStore.keys();
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (!k || !k.startsWith('u:' + userId + '|')) continue;
            if (!UserStore.getItem(k)) continue;

            // Anime episodes: u:{uid}|anime:{id}|s:{s}|ep:{ep}
            var aM = k.match(/\|anime:(\d+)\|s:\d+\|ep:(\d+)$/);
            if (aM) {
                var animeId = aM[1], ep = Number(aM[2]);
                if (!index.anime.has(animeId)) index.anime.set(animeId, new Set());
                index.anime.get(animeId).add(ep);
                continue;
            }
            // Manga chapters/vols: u:{uid}|manga:{id}|ch:{n} or |vol:{n}
            var mgM = k.match(/\|manga:(\d+)\|(?:ch|vol):(\d+)$/);
            if (mgM) {
                var mId = mgM[1], num = Number(mgM[2]);
                if (!index.manga.has(mId)) index.manga.set(mId, new Set());
                index.manga.get(mId).add(num);
                continue;
            }
            // Novels: u:{uid}|novela:{id}|vol:{n}
            var nvM = k.match(/\|novela:(\d+)\|vol:(\d+)$/);
            if (nvM) {
                var nvId = nvM[1], nvNum = Number(nvM[2]);
                if (!index.novelas.has(nvId)) index.novelas.set(nvId, new Set());
                index.novelas.get(nvId).add(nvNum);
            }
        }
    } catch (e) { console.warn('_buildProgressIndex failed:', e); }
    _progressIndex = index;
    _progressIndexUser = userId;
    return index;
}

// Invalidate index whenever a state changes
window._invalidateProgressIndex = function() { _progressIndex = null; };

function countAnimeEpisodesWatched(userId, animeId, totalEps) {
    if (!totalEps) return 0;
    var index = _buildProgressIndex(userId);
    var eps = index.anime.get(String(animeId));
    if (!eps) return 0;
    var count = 0;
    eps.forEach(function(ep) { if (ep <= totalEps) count++; });
    return count;
}


function resolveCatalogProgress(userId, category, itemId, card) {
    const box = card.querySelector('[data-progress]');
    const dataTotal = Number(box?.getAttribute('data-total') || 0);
    const label = box?.getAttribute('data-label') || (category === 'anime' ? 'capítulos' : 'volúmenes');
    const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));

    if (!dataTotal) {
        const legacyPct = (typeof getProgressPercentForItem === 'function')
            ? getProgressPercentForItem(userId, category, itemId)
            : null;
        if (viewed) {
            return { show: true, pct: 100, watched: 0, total: 0, label };
        }
        if (legacyPct !== null) {
            return { show: true, pct: legacyPct, watched: 0, total: 0, label };
        }
        return { show: true, pct: 0, watched: 0, total: 0, label }; // Show alternative card
    }

    let watched = 0;
    if (category === 'anime') {
        watched = countAnimeEpisodesWatched(userId, itemId, dataTotal);
    } else if (category === 'manga' || category === 'novelas') {
        var index = _buildProgressIndex(userId);
        var items = index[category]?.get(String(itemId));
        if (items) {
            items.forEach(function(num) { if (num <= dataTotal) watched++; });
        }
    }

    const pct = viewed ? 100 : Math.min(100, Math.round((watched / dataTotal) * 100));
    if (viewed) watched = dataTotal;

    return { show: true, pct, watched, total: dataTotal, label };
}


window.toggleCardComplete = function (input, itemId) {
    const card = input?.closest('[data-item-id]');
    const viewedBtn = card?.querySelector('.viewed-btn');
    if (!viewedBtn) return;
    const isActive = viewedBtn.classList.contains('active');
    if (Boolean(input.checked) !== isActive) viewedBtn.click();
};


// Traduce el estado crudo de la API (AniList/MAL, en ingles) a una etiqueta
// corta en espanol para la banda superior de la card.
function translateCatalogStatus(status) {
    const s = String(status || '').trim().toUpperCase();
    const map = {
        'RELEASING': 'En emisión',
        'CURRENTLY AIRING': 'En emisión',
        'CURRENTLY PUBLISHING': 'Publicándose',
        'PUBLISHING': 'Publicándose',
        'FINISHED': 'Finalizado',
        'FINISHED AIRING': 'Finalizado',
        'COMPLETED': 'Finalizado',
        'NOT_YET_RELEASED': 'Próximamente',
        'NOT YET AIRED': 'Próximamente',
        'CANCELLED': 'Cancelado',
        'HIATUS': 'En pausa',
        'ON HIATUS': 'En pausa'
    };
    return map[s] || String(status || '').trim();
}

// Linea secundaria de la card (tipo · episodios), sin el estado: ese ya se
// muestra en la banda superior, asi no se repite.
function captionFromInfo(info, status) {
    if (!info) return '';
    const st = translateCatalogStatus(status).toLowerCase();
    const raw = String(status || '').trim().toLowerCase();
    return String(info)
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => {
            const low = s.toLowerCase();
            return low !== st && low !== raw;
        })
        .join(' · ');
}

function buildCatalogCardHtml(options) {
    const {
        id,
        title,
        image = '',
        detailUrl = '#',
        status = '',
        showDetail = true,
        searchIndex = '',
        genres = '',
        genresNorm = '',
        imageExtraAttrs = '',
        categoria = 'manga',
        progressTotal = 0,
        volCount = 0,
        chCount = 0,
        info = ''
    } = options;

    const flipId = `flip-${id}`;
    const safeId = escapeHtml(String(id));
    const bandLabel = translateCatalogStatus(status) || 'En emisión';
    const captionInfo = captionFromInfo(info, status);
    const detailBtn = showDetail
        ? `<a class="details-btn card-back-detail-btn" href="${escapeHtml(detailUrl)}" data-remember-catalog="1">DETALLE</a>`
        : '';
    const statusHtml = bandLabel
        ? `<span class="card-back-status-badge">${escapeHtml(bandLabel)}</span>`
        : '';
    const captionHtml = captionInfo
        ? `<span class="cband-info">${escapeHtml(captionInfo)}</span>`
        : '';
    const genresAttr = genres ? ` data-genres="${escapeHtml(genres)}"` : '';
    const genresNormAttr = genresNorm ? ` data-genres-norm="${escapeHtml(genresNorm)}"` : '';
    const totalAttr = progressTotal > 0 ? ` data-total="${progressTotal}"` : '';

    var safeImg = safeUrl(image);
    // Card vertical con banda de estado arriba (cian->purpura) y flip 3D. El
    // frente muestra la portada + el titulo sobre un degradado inferior; el
    // boton gira la card y el dorso trae las acciones (favorito, visto,
    // seguimiento, detalle y progreso), con un boton para volver al frente.
    // Se conservan los hooks funcionales: .catalog-neon-card para busqueda y
    // generos, .flip-toggle + label para el giro, .fav-btn/.viewed-btn con
    // data-action para la delegacion, .watch-status-select y el bloque
    // [data-progress] que states.js actualiza.
    return `
    <div class="card-container catalog-neon-card catalog-band-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}" data-img="${escapeHtml(safeImg)}" data-search-index="${escapeHtml(searchIndex)}"${totalAttr}${genresAttr}${genresNormAttr}>
        <input class="flip-toggle" type="checkbox" id="${flipId}">
        <div class="cband-inner">
            <div class="cband-face cband-front">
                <div class="cband-media">
                    <img src="${safeImg}" alt="${escapeHtml(title)}" width="230" height="345" decoding="async" loading="lazy"${imageExtraAttrs}>
                </div>
                <div class="cband-topbar">
                    <span class="cband-dot"></span>
                    <span class="cband-status">${escapeHtml(bandLabel)}</span>
                </div>
                <div class="cband-caption">
                    <span class="catalog-card-title cband-title">${escapeHtml(title)}</span>
                    ${captionHtml}
                </div>
                <label class="catalog-card-flip-btn cband-flip" for="${flipId}" aria-label="Ver información de ${escapeHtml(title)}" title="Ver info">
                    ${CATALOG_FLIP_ICON_SVG}
                </label>
            </div>
            <div class="cband-face cband-back">
                <div class="cband-back-head">
                    <h2 class="card-back-title">${escapeHtml(title)}</h2>
                    <label class="catalog-card-flip-btn cband-flip" for="${flipId}" aria-label="Volver al frente" title="Volver">
                        ${CATALOG_FLIP_ICON_SVG}
                    </label>
                </div>
                <div class="cband-back-controls">
                    ${statusHtml}
                    <select class="watch-status-select" data-item-id="${safeId}" aria-label="Estado de seguimiento">
                        <option value="">— Seguimiento —</option>
                        <option value="viendo">Viendo</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="pausado">En pausa</option>
                        <option value="abandonado">Abandonado</option>
                    </select>
                </div>
                ${buildCatalogBackProgressHtml(categoria, progressTotal, volCount, chCount)}
                <div class="cband-back-actions">
                    <button class="action-btn fav-btn" type="button" aria-label="Favorito" data-item-id="${safeId}" data-action="fav">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                    <button class="action-btn viewed-btn" type="button" aria-label="Visto" data-item-id="${safeId}" data-action="viewed">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    ${detailBtn}
                </div>
            </div>
        </div>
    </div>`;
}


// Traduce el error crudo de la capa de API al cartel que ve el usuario.
// Antes todo caia en un unico "API no disponible / revisa tu conexion", que es
// enganoso: la causa mas comun es el rate limit de AniList, donde la conexion
// del usuario esta perfecta y lo unico que hay que hacer es esperar.
function describirErrorDeApi(error) {
    const msg = String(error?.message || error || '');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
            kicker: 'Sin conexión',
            detalle: 'Parece que te quedaste sin internet. Reconectate y recargá la página.'
        };
    }
    if (msg.includes('429') || msg.includes('Límite de peticiones')) {
        return {
            kicker: 'Demasiadas peticiones',
            detalle: 'AniList está limitando las peticiones por exceso de uso. Esperá un minuto y recargá — no es un problema de tu conexión.'
        };
    }
    if (msg.includes('Timeout')) {
        return {
            kicker: 'La API tardó demasiado',
            detalle: 'AniList no respondió a tiempo. Puede estar saturada; probá de nuevo en unos segundos.'
        };
    }
    return {
        kicker: 'API no disponible',
        detalle: 'Revisá tu conexión, esperá unos segundos y recargá la página.'
    };
}

// Construye la entrada del índice de búsqueda local (filtrado en cliente y
// sugerencias) a partir de un item de la API.
function _catalogSearchEntry(categoria, item) {
    return {
        item: {
            id: item.id ?? item.mal_id,
            titulo: item.title,
            imagen: getApiPoster(item),
            info: getApiCatalogInfo(categoria, item)
        },
        searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
    };
}

// Pinta un conjunto de items como tarjetas del catálogo. Separado de
// cargarCatalogoDesdeApi para reutilizarlo desde el respaldo de búsqueda
// (cuando la carga principal falla o vuelve vacía).
function renderCatalogItems(categoria, mainContainer, items, append) {
    if (!append) {
        window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems =
            items.map((item) => _catalogSearchEntry(categoria, item));
    } else {
        const existing = window.__catalogSearchItems || [];
        const existingIds = new Set(existing.map(function (e) { return String(e.item.id); }));
        items.filter(function (item) { return !existingIds.has(String(item.id ?? item.mal_id)); })
            .forEach(function (item) { existing.push(_catalogSearchEntry(categoria, item)); });
    }

    var cardsHtml = items.map((item) => {
        const id = item.id ?? item.mal_id;
        const title = item.title || 'Sin título';
        const image = getApiPoster(item);
        const info = getApiCatalogInfo(categoria, item);
        const genres = getApiGenresList(item);
        const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
        const detailCat = categoria === 'novelas' ? 'novelas' : categoria;
        const detailUrl = 'detalle.html?cat=' + encodeURIComponent(detailCat) + '&id=' + encodeURIComponent(id) + '&nombre=' + encodeURIComponent(title);
        const searchIndex = [title, item.title_english, info, item.synopsis, item.type].concat(genres).filter(Boolean).join(' ').toLowerCase();

        const volCount = categoria !== 'anime' ? (item.volumes || 0) : 0;
        const chCount = categoria !== 'anime' ? (item.chapters || 0) : 0;
        return buildCatalogCardHtml({
            id: id,
            title: title,
            image: image,
            detailUrl: detailUrl,
            status: item.status || 'En emisión',
            searchIndex: searchIndex,
            genres: genres.join('|'),
            genresNorm: genresNorm,
            categoria: detailCat,
            info: info,
            progressTotal: categoria === 'anime' ? (item.episodes || 0) : (volCount || chCount || 0),
            volCount: volCount,
            chCount: chCount,
            imageExtraAttrs: ' data-title="' + escapeHtml(title) + '" data-fallback-catalog="1"'
        });
    }).join('');

    mainContainer.querySelector('.empty-state')?.remove();
    if (append) {
        mainContainer.insertAdjacentHTML('beforeend', cardsHtml);
    } else {
        mainContainer.innerHTML = cardsHtml;
    }

    try { cargarEstadosBotones(); } catch (e) { console.warn('Error en botones:', e); }
    if (!append) {
        try { inicializarBusquedaCatalogo(); } catch (e) { console.warn('Error en busqueda:', e); }
        try { inicializarGeneroWidgets(); } catch (e) { console.warn('Error en generos:', e); }
    } else if (typeof window.__renderDropdownGenres === 'function') {
        try { window.__renderDropdownGenres(); } catch (e) { console.warn('Error en generos dropdown:', e); }
    }
    return items.length > 0;
}

// Respaldo de búsqueda: usa la búsqueda liviana (menos peticiones y con caché
// propia) cuando la carga del catálogo falla o no trae resultados, para que una
// búsqueda válida no quede en "no se pudo cargar" por un rate limit puntual.
async function buscarCatalogoLiviano(categoria, search) {
    const q = String(search || '').trim();
    if (!q) return [];
    try {
        let alt = [];
        if (categoria === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
            alt = await window.buscarNovelasEnApi(q);
        } else if (typeof window.buscarEnApi === 'function') {
            alt = await window.buscarEnApi(q, categoria);
        }
        return Array.isArray(alt) ? alt : [];
    } catch (_) {
        return [];
    }
}

async function cargarCatalogoDesdeApi(categoria, mainContainer, page = 1, append = false) {
    const loaderLabel = categoria === 'anime'
        ? 'animes'
        : (categoria === 'novelas' ? 'novelas' : 'mangas');
    const getTopItems = categoria === 'anime'
        ? window.getTopAnimes
        : (categoria === 'novelas' ? window.getTopNovelas : window.getTopMangas);

    if (typeof getTopItems !== 'function') return false;

    if (!append) {
        renderSkeletonCards(mainContainer, SKELETON_COUNT);
    }

    // Read global filter state
    const filters = window.__catalogFilters || {};
    const perPage = AnimeDestiny.Constants.PER_PAGE || 40;

    try {
        const timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('Timeout')); }, AnimeDestiny.Constants.API_TIMEOUT_MS || 15000);
        });
        const listaItems = await Promise.race([getTopItems(page, filters), timeoutPromise]);
        const items = Array.isArray(listaItems) ? listaItems.slice(0, perPage) : [];

        // Búsqueda sin resultados en la carga principal: reintentar con la
        // búsqueda liviana antes de declarar "sin resultados".
        if (!append && !items.length && filters.search) {
            const alt = await buscarCatalogoLiviano(categoria, filters.search);
            if (alt.length) return renderCatalogItems(categoria, mainContainer, alt.slice(0, perPage), false);
        }

        if (!items.length) {
            if (!append) {
                window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = [];
                mainContainer.innerHTML = `
                    <section class="empty-state">
                        <span class="empty-state-kicker">Sin resultados</span>
                        <h2>La API no devolvió ${escapeHtml(loaderLabel)} para esta página.</h2>
                        <p>Posible límite de velocidad (rate limit). Esperá unos segundos y recargá.</p>
                    </section>
                `;
                try { inicializarBusquedaCatalogo(); } catch (e) {}
                try { inicializarGeneroWidgets(); } catch (e) {}
            }
            return false;
        }

        return renderCatalogItems(categoria, mainContainer, items, append);
    } catch (error) {
        console.warn('Error cargando API:', error);
        // Respaldo: si la carga fall\u00F3 durante una b\u00FAsqueda, intentar la b\u00FAsqueda
        // liviana (puede resolver desde cach\u00E9 aunque la API est\u00E9 limitando).
        if (!append && filters.search) {
            const alt = await buscarCatalogoLiviano(categoria, filters.search);
            if (alt.length) return renderCatalogItems(categoria, mainContainer, alt.slice(0, perPage), false);
        }
        if (!append) {
            const causa = describirErrorDeApi(error);
            mainContainer.innerHTML = `
                <section class="empty-state">
                    <span class="empty-state-kicker">${escapeHtml(causa.kicker)}</span>
                    <h2>No se pudo cargar el catálogo de ${escapeHtml(loaderLabel)}.</h2>
                    <p>${escapeHtml(causa.detalle)}</p>
                </section>
            `;
            try { inicializarBusquedaCatalogo(); } catch (e) {}
            try { inicializarGeneroWidgets(); } catch (e) {}
        }
        return false;
    }
}


function renderCatalogCardsFromLocalData(categoria, mainContainer, items, append) {
    var existingIds;
    if (append) {
        existingIds = new Set();
        document.querySelectorAll('.catalog-neon-card[data-item-id]').forEach(function (el) {
            existingIds.add(el.getAttribute('data-item-id'));
        });
    }

    var list = [];
    items.forEach(function (item) {
        var id = String(item.id || item.item_id || item.mal_id || item.itemId || 0);
        if (append && existingIds.has(id)) return;
        var title = item.titulo || item.title || item.name || 'Sin t\u00EDtulo';
        var image = item.img || item.image || item.cover_image || '';
        var genres = String(item.info || item.synopsis || '').split('/').map(function (g) { return g.trim(); }).filter(Boolean);
        var genresNorm = genres.map(function (g) { return normalizeCatalogGenre(g); }).join('|');
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(categoria) + '&id=' + encodeURIComponent(id) + '&nombre=' + encodeURIComponent(title);
        var searchIndex = [title, item.title_english, item.info, item.synopsis].concat(genres).filter(Boolean).join(' ').toLowerCase();
        var volCount = Number(item.volumes || 0);
        var chCount = Number(item.chapters || 0);
        list.push(buildCatalogCardHtml({
            id: id,
            title: title,
            image: image,
            detailUrl: detailUrl,
            status: item.status || '',
            searchIndex: searchIndex,
            genres: genres.join('|'),
            genresNorm: genresNorm,
            categoria: categoria,
            info: item.info || genres.join(' / '),
            progressTotal: volCount || chCount || Number(item.episodes || 0),
            volCount: volCount,
            chCount: chCount,
            imageExtraAttrs: ' data-title="' + escapeHtml(title) + '" data-fallback-catalog="1"'
        }));
    });

    if (append) {
        mainContainer.insertAdjacentHTML('beforeend', list.join(''));
    } else {
        mainContainer.innerHTML = list.join('');
        window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = items.map(function (item) {
            var entry = { item: item, searchIndex: buildSearchIndexForItem(categoria, item) };
            if (!item.imagen) {
                item.imagen = item.img || item.image || item.cover_image || '';
            }
            return entry;
        });
    }

    try { cargarEstadosBotones(); } catch (e) { console.warn('Error en botones:', e); }
    if (!append) {
        try { inicializarBusquedaCatalogo(); } catch (e) { console.warn('Error en busqueda:', e); }
        try { inicializarGeneroWidgets(); } catch (e) { console.warn('Error en generos:', e); }
    } else if (typeof window.__renderDropdownGenres === 'function') {
        try { window.__renderDropdownGenres(); } catch (e) { console.warn('Error en generos dropdown:', e); }
    }
    return true;
}





/* ========================================== */
/* === FILE: js/catalog/search.js === */
/* ========================================== */

// ==========================================
// catalog/search.js
// Búsqueda en catálogo y filtros por género
// ==========================================

window.__activeStateFilter = AnimeDestiny.internals.__activeStateFilter = 'all';
window.__catalogFilters = { search: '', genres: [], isAdult: false, browse: '' };

// Modo de descubrimiento persistido por categoría
function getBrowsePref(categoria) {
    try {
        var v = localStorage.getItem('pref:browse:' + categoria) || '';
        return ['tendencias', 'puntuados', 'temporada'].includes(v) ? v : '';
    } catch (_) { return ''; }
}

function setBrowsePref(categoria, value) {
    try {
        if (value) localStorage.setItem('pref:browse:' + categoria, value);
        else localStorage.removeItem('pref:browse:' + categoria);
    } catch (_) {}
}

// Aplicar el modo guardado antes de la primera carga del catálogo
try {
    window.__catalogFilters.browse = getBrowsePref(document.body?.getAttribute('data-page') || '');
} catch (_) {}
var _genreWidgetsListenersAdded = false;
var _searchListenersAdded = false;

/* ─── NSFW Age Gate Modal ─── */
function showNsfwAgeGate(onConfirm) {
    if (document.getElementById('ageGateOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'ageGateOverlay';
    overlay.className = 'age-gate-overlay';
    overlay.innerHTML =
        '<div class="age-gate-modal">' +
            '<div class="age-gate-icon">⚠️</div>' +
            '<h3 class="age-gate-title">Contenido para adultos</h3>' +
            '<p class="age-gate-text">Este contenido puede no ser apto para menores de edad.</p>' +
            '<p class="age-gate-question">¿Sos mayor de edad?</p>' +
            '<div class="age-gate-actions">' +
                '<button class="age-gate-btn age-gate-yes" type="button">Sí, tengo edad</button>' +
                '<button class="age-gate-btn age-gate-no" type="button">No</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.age-gate-yes').addEventListener('click', function () {
        overlay.remove();
        if (typeof onConfirm === 'function') onConfirm(true);
    });
    overlay.querySelector('.age-gate-no').addEventListener('click', function () {
        overlay.remove();
        if (typeof onConfirm === 'function') onConfirm(false);
    });
}

/* ─── Resalta la coincidencia de la búsqueda dentro del título ───
   Escapa cada tramo por separado para no romper el marcado al insertar <mark>.
   La coincidencia es case-insensitive sobre el texto original: si no aparece
   de forma literal (p. ej. difiere por acentos), devuelve el título escapado
   sin resaltar, sin corromperlo nunca. */
function highlightMatch(text, query) {
    const t = String(text ?? '');
    const q = String(query ?? '').trim();
    if (!q) return escapeHtml(t);
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escapeHtml(t);
    const before = t.slice(0, idx);
    const match = t.slice(idx, idx + q.length);
    const after = t.slice(idx + q.length);
    return escapeHtml(before) +
        '<mark class="catalog-suggestion-mark">' + escapeHtml(match) + '</mark>' +
        escapeHtml(after);
}


function inicializarBusquedaCatalogo() {
    const categoria = document.body.getAttribute('data-page');
    const input = document.getElementById('catalogSearch');
    const mainContainer = document.getElementById('main-content');
    if (!input || !mainContainer) return;

    // Inject suggestion box as sibling of .catalog-search-wrap inside the main container
    const searchContainer = input.closest('.catalog-search-filter-container');
    const inputWrap = input.closest('.nav-search') || input.parentElement;
    let suggestionBox = document.getElementById('catalogSuggestions');
    if (!suggestionBox && searchContainer) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'catalogSuggestions';
        suggestionBox.className = 'catalog-suggestions';
        searchContainer.appendChild(suggestionBox);
    } else if (!suggestionBox && inputWrap) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'catalogSuggestions';
        suggestionBox.className = 'catalog-suggestions';
        inputWrap.appendChild(suggestionBox);
    }

    // ── Accesibilidad: patrón combobox + listbox ──
    if (suggestionBox) {
        suggestionBox.setAttribute('role', 'listbox');
        suggestionBox.setAttribute('aria-label', 'Sugerencias de búsqueda');
    }
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'catalogSuggestions');

    // ── Botón para limpiar la búsqueda (×), inyectado para las 3 páginas ──
    let clearSearchBtn = document.getElementById('catalogSearchClear');
    if (!clearSearchBtn && inputWrap) {
        clearSearchBtn = document.createElement('button');
        clearSearchBtn.id = 'catalogSearchClear';
        clearSearchBtn.type = 'button';
        clearSearchBtn.className = 'catalog-search-clear';
        clearSearchBtn.setAttribute('aria-label', 'Limpiar búsqueda');
        clearSearchBtn.hidden = true;
        clearSearchBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        inputWrap.appendChild(clearSearchBtn);
    }
    function syncClearBtn() {
        if (clearSearchBtn) clearSearchBtn.hidden = !input.value;
    }

    // Toggle overflow on the container when suggestions open/close
    function setSuggestionsOpen(open) {
        if (searchContainer) searchContainer.classList.toggle('has-suggestions', open);
        input.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) clearActiveSuggestion();
    }

    // ── Estado de navegación por teclado dentro del listado de sugerencias ──
    let activeIndex = -1;
    function getSuggestionItems() {
        return suggestionBox ? Array.from(suggestionBox.querySelectorAll('.catalog-suggestion')) : [];
    }
    function clearActiveSuggestion() {
        activeIndex = -1;
        if (!suggestionBox) return;
        suggestionBox.querySelectorAll('.catalog-suggestion.is-active').forEach((el) => {
            el.classList.remove('is-active');
            el.setAttribute('aria-selected', 'false');
        });
        input.removeAttribute('aria-activedescendant');
    }
    function setActiveSuggestion(index) {
        const items = getSuggestionItems();
        if (!items.length) { clearActiveSuggestion(); return; }
        // Envolver el índice para que ↓ desde el último vuelva al primero y viceversa.
        activeIndex = (index + items.length) % items.length;
        items.forEach((el, i) => {
            const on = i === activeIndex;
            el.classList.toggle('is-active', on);
            el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        const current = items[activeIndex];
        if (current) {
            if (!current.id) current.id = 'catalogSuggestion-' + activeIndex;
            input.setAttribute('aria-activedescendant', current.id);
            current.scrollIntoView({ block: 'nearest' });
        }
    }
    function setSuggestionStatus(type, text) {
        if (!suggestionBox) return;
        let el = suggestionBox.querySelector('.catalog-suggestion-status');
        if (type === 'none') { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('div');
            el.className = 'catalog-suggestion-status';
            suggestionBox.appendChild(el);
        }
        // Mantener el estado siempre como último hijo, debajo de los resultados.
        suggestionBox.appendChild(el);
        el.setAttribute('data-status', type);
        el.setAttribute('role', 'status');
        if (type === 'loading') {
            el.innerHTML = '<span class="catalog-suggestion-spinner" aria-hidden="true"></span><span>' + escapeHtml(text || 'Buscando…') + '</span>';
        } else {
            el.innerHTML = '<svg class="catalog-suggestion-status-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>' + escapeHtml(text || 'Sin resultados.') + '</span>';
        }
        ensureHint();
    }

    // ── Pie con atajos de teclado (se mantiene como último hijo del desplegable) ──
    function ensureHint() {
        if (!suggestionBox) return;
        const has = suggestionBox.querySelectorAll('.catalog-suggestion').length > 0;
        let h = suggestionBox.querySelector('.catalog-suggestion-hint');
        if (!has) { if (h) h.remove(); return; }
        if (!h) {
            h = document.createElement('div');
            h.className = 'catalog-suggestion-hint';
            h.setAttribute('aria-hidden', 'true');
            h.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> cerrar</span>';
        }
        suggestionBox.appendChild(h); // reubicar como último hijo
    }

    // ── Búsquedas recientes (persistidas por categoría) ──
    const RECENT_KEY = 'catalog:recent:' + (categoria || 'all');
    const RECENT_MAX = 6;
    function getRecent() {
        try {
            const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
            return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim()).slice(0, RECENT_MAX) : [];
        } catch (_) { return []; }
    }
    function commitRecent(query) {
        const q = String(query || '').trim();
        if (!q) return;
        try {
            const list = getRecent().filter((s) => normalizeText(s) !== normalizeText(q));
            list.unshift(q);
            localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
        } catch (_) {}
    }
    function clearRecent() {
        try { localStorage.removeItem(RECENT_KEY); } catch (_) {}
    }
    function renderRecent() {
        if (!suggestionBox) return;
        const recents = getRecent();
        if (!recents.length) {
            suggestionBox.classList.remove('is-open');
            suggestionBox.innerHTML = '';
            setSuggestionsOpen(false);
            return;
        }
        suggestionBox.innerHTML =
            '<div class="catalog-suggestion-head">' +
                '<span class="catalog-suggestion-head-label">Búsquedas recientes</span>' +
                '<button type="button" class="catalog-suggestion-recent-clear">Borrar</button>' +
            '</div>' +
            recents.map((q, i) =>
                '<button type="button" class="catalog-suggestion catalog-suggestion--recent" id="catalogSuggestion-recent-' + i + '" role="option" aria-selected="false" data-query="' + escapeHtml(q) + '">' +
                    '<span class="catalog-suggestion-recent-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg></span>' +
                    '<span class="catalog-suggestion-title">' + escapeHtml(q) + '</span>' +
                '</button>'
            ).join('');
        clearActiveSuggestion();
        ensureHint();
        suggestionBox.classList.add('is-open');
        setSuggestionsOpen(true);
    }
    // Rellena el input con una búsqueda reciente y recarga el catálogo.
    function applyRecent(query) {
        input.value = query;
        syncClearBtn();
        if (suggestionBox) suggestionBox.classList.remove('is-open');
        setSuggestionsOpen(false);
        reloadCatalog();
    }

    let emptyMsg = document.getElementById('searchEmptyMsg');
    if (!emptyMsg) {
        emptyMsg = document.createElement('section');
        emptyMsg.id = 'searchEmptyMsg';
        emptyMsg.className = 'empty-state empty-state-inline';
        emptyMsg.style.display = 'none';
        const nombreCategoria = categoria ? String(categoria) : 'contenido';
        emptyMsg.innerHTML = `
            <span class="empty-state-kicker">Sin resultados</span>
            <h2>No encontramos coincidencias en ${escapeHtml(nombreCategoria)}.</h2>
            <p>Probá con otro título, género o estado.</p>
        `;
        mainContainer.parentElement?.appendChild(emptyMsg);
    }

    function getCatalogItems() {
        return Array.isArray(window.__catalogSearchItems) ? window.__catalogSearchItems : [];
    }

    function renderSuggestions(query) {
        if (!suggestionBox) return;
        const q = normalizeText(query);
        if (!q) {
            suggestionBox.classList.remove('is-open');
            suggestionBox.innerHTML = '';
            setSuggestionsOpen(false);
            return;
        }

        const rawQuery = String(query || '').trim();
        const matches = getCatalogItems()
            .filter((entry) => normalizeText(entry.searchIndex || '').includes(q))
            .slice(0, AnimeDestiny.Constants.SUGGESTION_LIMIT || 6);

        suggestionBox.innerHTML = matches.map((entry, i) => `
            <a class="catalog-suggestion" id="catalogSuggestion-local-${i}" role="option" aria-selected="false" href="detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(entry.item.id)}&nombre=${encodeURIComponent(entry.item.titulo)}">
                ${entry.item.imagen ? `<img class="catalog-suggestion-img" src="${safeUrl(entry.item.imagen)}" alt="" width="36" height="50" decoding="async" loading="lazy">` : ''}
                <span class="catalog-suggestion-body">
                    <span class="catalog-suggestion-title">${highlightMatch(entry.item.titulo, rawQuery)}</span>
                    <span class="catalog-suggestion-meta">${escapeHtml(entry.item.info || entry.item.status || '')}</span>
                </span>
            </a>
        `).join('');

        // Sin coincidencias locales todavía mostramos el desplegable con un estado
        // "Buscando…" porque la búsqueda en la API se dispara tras el debounce y
        // sus resultados se anexan después.
        if (!matches.length) setSuggestionStatus('loading', 'Buscando…');

        clearActiveSuggestion();
        ensureHint();
        suggestionBox.classList.add('is-open');
        setSuggestionsOpen(true);
    }

    function applyFilter() {
        const q = normalizeText(input.value);
        const cards = mainContainer.querySelectorAll('.card-container');
        const selectedGenres = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        const stateFilter = window.__activeStateFilter || 'all';
        const uid = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'Invitado';
        
        // Optimize: read DOM state once instead of inside card loop
        const nsfwToggle = document.getElementById('nsfwToggle');
        const nsfwEnabled = !!(nsfwToggle && nsfwToggle.checked);
        
        // Optimize: build Sets for state filters to avoid per-card UserStore lookup overhead
        const favSet = new Set();
        const viewedSet = new Set();
        if (stateFilter !== 'all') {
            const prefix = `u:${uid}|item:`;
            try {
                const keys = UserStore.keys();
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    if (!k || !k.startsWith(prefix) || !UserStore.getItem(k)) continue;
                    if (k.endsWith('|fav'))         favSet.add(k.slice(prefix.length, k.length - 4));
                    else if (k.endsWith('|viewed')) viewedSet.add(k.slice(prefix.length, k.length - 7));
                }
            } catch (e) { console.warn('State filter scan failed:', e); }
        }
        
        let visible = 0;

        cards.forEach(card => {
            const indexText = normalizeText(card.getAttribute('data-search-index') || '');
            const matchQuery = !q || indexText.includes(q);
            
            if (!matchQuery) {
                card.style.display = 'none';
                return;
            }

            const genres = card.getAttribute('data-genres-norm');
            const genreArr = genres ? genres.split('|') : [];
            const matchGenre = selectedGenres.length === 0 || selectedGenres.some((g) => genreArr.includes(String(g)));
            
            if (!matchGenre) {
                card.style.display = 'none';
                return;
            }

            // If NSFW is disabled, hide cards that have 'Adult' genre
            const genresList = genreArr.map(g => g.toLowerCase());
            const isAdult = genresList.includes('adult');
            const matchNsfw = nsfwEnabled || !isAdult;
            let matchStateFlag = true;
            
            if (stateFilter !== 'all') {
                const itemId = card.getAttribute('data-item-id');
                if (itemId) {
                    if (stateFilter === 'watched') matchStateFlag = viewedSet.has(itemId);
                    else if (stateFilter === 'unwatched') matchStateFlag = !viewedSet.has(itemId);
                    else if (stateFilter === 'fav') matchStateFlag = favSet.has(itemId);
                }
            }
            // Combine state, genre, and NSFW filters
            const finalMatch = matchStateFlag && matchGenre && matchNsfw;
            if (finalMatch) {
                card.style.display = '';
                visible++;
            } else {
                card.style.display = 'none';
            }
        });

        emptyMsg.style.display = (cards.length > 0 && visible === 0) ? '' : 'none';
        renderSuggestions(input.value);
    }

    // ── API Suggestions (debounced, AniList + MangaDex) ──
    let apiSearchTimer = null;
    let lastApiQuery = '';

    function renderApiSuggestions(rawQuery, items) {
        if (!suggestionBox) return;
        const q = normalizeText(rawQuery);
        if (!q) return;

        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        const filtered = items.filter(item => normalizeText(item.title || '').includes(q)).slice(0, AnimeDestiny.Constants.API_SUGGESTION_LIMIT || 8);
        if (!filtered.length) { if (prev) prev.remove(); return; }

        const section = prev || document.createElement('div');
        section.className = 'catalog-suggestion-api-section';
        section.setAttribute('role', 'group');
        section.setAttribute('aria-label', 'Más resultados');
        const seenIds = new Set();
        section.querySelectorAll('a').forEach(a => { const m = a.href.match(/[?&]id=([^&]+)/); if (m) seenIds.add(m[1]); });
        let apiIdx = section.querySelectorAll('a').length;

        filtered.forEach(item => {
            const rawId = String(item.id);
            if (seenIds.has(rawId)) return;
            seenIds.add(rawId);
            const id = encodeURIComponent(rawId);
            const imgUrl = item.images?.jpg?.image_url || item.images?.webp?.image_url || '';
            const title = highlightMatch(item.title || '', rawQuery);
            const meta = escapeHtml(item.type || item.status || '');
            const a = document.createElement('a');
            a.className = 'catalog-suggestion catalog-suggestion--api';
            a.id = 'catalogSuggestion-api-' + (apiIdx++);
            a.setAttribute('role', 'option');
            a.setAttribute('aria-selected', 'false');
            a.href = `detalle.html?cat=${encodeURIComponent(String(categoria))}&id=${id}&nombre=${encodeURIComponent(String(item.title || ''))}`;
            a.innerHTML = `${imgUrl ? `<img class="catalog-suggestion-img" src="${safeUrl(imgUrl)}" alt="" loading="lazy">` : ''}<span class="catalog-suggestion-body"><span class="catalog-suggestion-title">${title}</span><span class="catalog-suggestion-meta">${escapeHtml(meta)}</span></span>`;
            section.appendChild(a);
        });

        if (!section.querySelectorAll('a').length) { if (prev) prev.remove(); return; }
        // Etiqueta de sección "En línea" como primer hijo (una sola vez).
        if (!section.querySelector('.catalog-suggestion-api-header')) {
            const header = document.createElement('div');
            header.className = 'catalog-suggestion-api-header';
            header.innerHTML = '<span class="catalog-suggestion-api-dot" aria-hidden="true"></span>En línea';
            section.insertBefore(header, section.firstChild);
        }
        if (!prev) suggestionBox.appendChild(section);
        // Llegaron resultados de la API: quitar el "Buscando…" / "Sin resultados".
        setSuggestionStatus('none');
        ensureHint();
        if (suggestionBox.classList.contains('is-open') || section.querySelectorAll('a').length) {
            suggestionBox.classList.add('is-open');
            setSuggestionsOpen(true);
        }
    }

    // Cuenta cuántas sugerencias locales hay actualmente en el desplegable.
    function hasLocalSuggestions() {
        return !!suggestionBox && !!suggestionBox.querySelector('.catalog-suggestion:not(.catalog-suggestion--api):not(.catalog-suggestion--recent)');
    }

    async function fetchApiSuggestions(rawQuery) {
        const q = normalizeText(rawQuery);
        if (!q || q.length < 1) return;

        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        if (prev) prev.remove();
        // Feedback inmediato mientras la API responde.
        setSuggestionStatus('loading', 'Buscando…');

        try {
            let resultados = [];
            if (categoria === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
                resultados = await window.buscarNovelasEnApi(rawQuery);
            } else if (typeof window.buscarEnApi === 'function') {
                resultados = await window.buscarEnApi(rawQuery, categoria);
            }
            if ((categoria === 'manga' || categoria === 'novelas') && typeof window.fetchMangaDexPage === 'function') {
                try {
                    var mdResults = await window.fetchMangaDexPage(1, 5, [], rawQuery);
                    if (mdResults.length) {
                        resultados = window.mergeAnilistAndMd(Array.isArray(resultados) ? resultados : [], mdResults);
                    }
                } catch (_) {}
            }
            if (normalizeText(input.value) !== q) return;
            if (Array.isArray(resultados) && resultados.length) {
                renderApiSuggestions(rawQuery, resultados);
            } else if (!hasLocalSuggestions()) {
                // Ni local ni API: estado vacío explícito en vez de un desplegable colgado.
                setSuggestionStatus('empty', 'No encontramos coincidencias.');
            } else {
                setSuggestionStatus('none');
            }
        } catch (e) {
            // Ante un error de red no dejamos el "Buscando…" para siempre.
            if (normalizeText(input.value) === q && !hasLocalSuggestions()) {
                setSuggestionStatus('empty', 'No pudimos buscar. Reintentá.');
            } else {
                setSuggestionStatus('none');
            }
        }
    }

    function debouncedApiSearch() {
        if (apiSearchTimer) clearTimeout(apiSearchTimer);
        const q = input.value;
        lastApiQuery = q;
        if (!normalizeText(q)) {
            const s = suggestionBox?.querySelector('.catalog-suggestion-api-section');
            if (s) s.remove();
            return;
        }
        apiSearchTimer = setTimeout(() => {
            if (lastApiQuery === input.value) fetchApiSuggestions(input.value);
        }, AnimeDestiny.Constants.SEARCH_DEBOUNCE_MS || 400);
    }

    window.__applyCatalogFilter = AnimeDestiny.internals.__applyCatalogFilter = applyFilter;

    // ── Server-side reload when filters change ──
    function reloadCatalog() {
        // Guardar el término buscado en el historial reciente.
        commitRecent(input.value);
        const cat = document.body.getAttribute('data-page');
        const usaApi = cat === 'anime' || cat === 'manga' || cat === 'novelas';
        if (!usaApi) { applyFilter(); return; }

        // Update global filter state
        const nsfwCheck = document.getElementById('nsfwToggle');
        const advSort = document.getElementById('filterSort');
        const advYear = document.getElementById('filterYear');
        const advSeason = document.getElementById('filterSeason');
        const advFormat = document.getElementById('filterFormat');
        const isAnimeCat = cat === 'anime';
        window.__catalogFilters = {
            search: input.value.trim() || '',
            genres: Array.isArray(window.__selectedGenres) ? [...window.__selectedGenres] : [],
            isAdult: nsfwCheck ? nsfwCheck.checked : false,
            browse: getBrowsePref(cat),
            sort: advSort && advSort.value ? advSort.value : '',
            year: advYear && advYear.value ? Number(advYear.value) : '',
            // Temporada y formato son solo de anime.
            season: (isAnimeCat && advSeason && advSeason.value) ? advSeason.value : '',
            format: (isAnimeCat && advFormat && advFormat.value) ? advFormat.value : ''
        };

        // Reset pagination and reload
        if (typeof resetInfiniteScroll === 'function') resetInfiniteScroll();
        mainContainer.innerHTML = '';
        if (typeof currentPage !== 'undefined') currentPage = 1;
        if (typeof hasMorePages !== 'undefined') hasMorePages = true;
        cargarCatalogoDesdeApi(cat, mainContainer, 1, false);
    }
    window.__reloadCatalog = reloadCatalog;

    // ── Guard: prevent duplicate listeners on repeated calls ──
    if (_searchListenersAdded) {
        applyFilter();
        return;
    }
    _searchListenersAdded = true;

    // ── NSFW pref: read from localStorage and set toggle ──
    var nsfwToggle = document.getElementById('nsfwToggle');
    var nsfwPrefStored = false;
    try { nsfwPrefStored = localStorage.getItem('pref:nsfw') === 'true'; } catch (_) {}
    if (nsfwToggle) {
        nsfwToggle.checked = nsfwPrefStored;
        window.__catalogFilters.isAdult = nsfwPrefStored;
        // Intercept toggle: age gate on enable + reload catalog
        nsfwToggle.addEventListener('change', function () {
            if (nsfwToggle.checked) {
                showNsfwAgeGate(function (confirmed) {
                    if (confirmed) {
                        try { localStorage.setItem('pref:nsfw', 'true'); } catch (_) {}
                        window.__catalogFilters.isAdult = true;
                        if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
                        else applyFilter();
                    } else {
                        nsfwToggle.checked = false;
                        window.__catalogFilters.isAdult = false;
                    }
                });
            } else {
                try { localStorage.setItem('pref:nsfw', 'false'); } catch (_) {}
                window.__catalogFilters.isAdult = false;
                if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
                else applyFilter();
            }
        });
    }

    // ── Modos de descubrimiento (Populares / Tendencias / etc.) ──
    var browseTabs = document.getElementById('browseTabs');
    if (browseTabs) {
        var syncBrowseTabs = function () {
            var current = getBrowsePref(categoria);
            browseTabs.querySelectorAll('.browse-tab').forEach(function (tab) {
                tab.classList.toggle('is-active', (tab.getAttribute('data-browse') || '') === current);
            });
        };
        syncBrowseTabs();
        browseTabs.addEventListener('click', function (e) {
            var tab = e.target.closest('.browse-tab');
            if (!tab) return;
            setBrowsePref(categoria, tab.getAttribute('data-browse') || '');
            syncBrowseTabs();
            reloadCatalog();
        });
    }

    // ── Filtros avanzados: Orden / Año / Temporada / Formato ──
    (function initAdvancedFilters() {
        var yearSel = document.getElementById('filterYear');
        if (yearSel && yearSel.options.length <= 1) {
            var current = new Date().getFullYear() + 1; // incluye la temporada que viene
            var frag = document.createDocumentFragment();
            for (var y = current; y >= 1960; y--) {
                var opt = document.createElement('option');
                opt.value = String(y);
                opt.textContent = String(y);
                frag.appendChild(opt);
            }
            yearSel.appendChild(frag);
        }
        ['filterSort', 'filterYear', 'filterSeason', 'filterFormat'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', function () {
                if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
            });
        });
    })();

    // ── Input: local filter + API suggestions ──
    input.addEventListener('input', () => {
        syncClearBtn();
        applyFilter();
        debouncedApiSearch();
    });
    input.addEventListener('keydown', (e) => {
        const open = !!suggestionBox && suggestionBox.classList.contains('is-open');
        const items = open ? getSuggestionItems() : [];

        if (e.key === 'ArrowDown') {
            if (items.length) {
                e.preventDefault();
                setActiveSuggestion(activeIndex + 1);
            }
            return;
        }
        if (e.key === 'ArrowUp') {
            if (items.length) {
                e.preventDefault();
                setActiveSuggestion(activeIndex - 1);
            }
            return;
        }
        if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                suggestionBox.classList.remove('is-open');
                setSuggestionsOpen(false);
            }
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            // Con una sugerencia resaltada, Enter la abre; una búsqueda reciente
            // rellena el campo; si no hay nada activo, recarga el catálogo.
            const current = activeIndex >= 0 ? items[activeIndex] : null;
            if (current && current.dataset && current.dataset.query != null) {
                applyRecent(current.dataset.query);
                return;
            }
            if (current && current.href) {
                commitRecent(input.value);
                window.location.href = current.href;
                return;
            }
            if (suggestionBox) {
                suggestionBox.classList.remove('is-open');
                setSuggestionsOpen(false);
            }
            reloadCatalog();
        }
    });
    // Al enfocar: con texto, sugerencias; vacío, búsquedas recientes.
    input.addEventListener('focus', () => {
        syncClearBtn();
        if (normalizeText(input.value)) renderSuggestions(input.value);
        else renderRecent();
    });
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (suggestionBox) {
                suggestionBox.classList.remove('is-open');
                setSuggestionsOpen(false);
            }
        }, 180);
    });

    // ── Puntero: resaltar la sugerencia bajo el mouse para navegación coherente ──
    if (suggestionBox) {
        suggestionBox.addEventListener('mousemove', (e) => {
            const item = e.target.closest('.catalog-suggestion');
            if (!item) return;
            const idx = getSuggestionItems().indexOf(item);
            if (idx >= 0 && idx !== activeIndex) setActiveSuggestion(idx);
        });
        // mousedown (no click) para ganarle al blur que cierra el desplegable.
        suggestionBox.addEventListener('mousedown', (e) => {
            // Botón "Borrar" del historial de búsquedas recientes.
            if (e.target.closest('.catalog-suggestion-recent-clear')) {
                e.preventDefault();
                clearRecent();
                renderRecent();
                return;
            }
            const item = e.target.closest('.catalog-suggestion');
            if (!item) return;
            if (item.dataset && item.dataset.query != null) {
                e.preventDefault();
                applyRecent(item.dataset.query);
                return;
            }
            if (item.href) {
                e.preventDefault();
                commitRecent(input.value);
                window.location.href = item.href;
            }
        });
    }

    // ── Botón limpiar (×) ──
    if (clearSearchBtn) {
        // mousedown para actuar antes del blur del input.
        clearSearchBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            input.value = '';
            syncClearBtn();
            if (suggestionBox) {
                suggestionBox.innerHTML = '';
                suggestionBox.classList.remove('is-open');
            }
            setSuggestionsOpen(false);
            input.focus();
            reloadCatalog();
            renderRecent();
        });
    }
    syncClearBtn();

    // ── Búsqueda por URL (?q=) ──
    // Habilita el SearchAction del sitio (cajita de búsqueda de sitelinks en
    // Google) y hace que las búsquedas sean compartibles por link. Se aplica una
    // sola vez: inicializarBusquedaCatalogo se llama en cada re-render del catálogo.
    if (!window.__catalogQueryApplied) {
        try {
            const q0 = new URLSearchParams(window.location.search).get('q');
            if (q0 && q0.trim() && !input.value) {
                window.__catalogQueryApplied = true;
                input.value = q0.trim();
                syncClearBtn();
                reloadCatalog();
            }
        } catch (e) { /* no-op (?q= opcional) */ }
    }

    var searchIcon = inputWrap?.querySelector('.catalog-search-icon');
    if (searchIcon) {
        searchIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            reloadCatalog();
        });
    }

    // ── Filter block ──
    const filterToggle = document.getElementById('mainFilterToggle');
    const filterDropdown = document.getElementById('filterDropdown');

    function showFilter(show) {
        filterDropdown.style.display = show ? '' : 'none';
        if (filterToggle) {
            filterToggle.classList.toggle('is-active', show);
            filterToggle.setAttribute('aria-expanded', String(show));
        }
    }

    if (filterToggle && filterDropdown) {
        filterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            showFilter(filterDropdown.style.display === 'none');
        });
        
        document.addEventListener('click', (e) => {
            if (filterDropdown.style.display === 'none') return;
            if (!filterToggle.contains(e.target) && !filterDropdown.contains(e.target)) {
                showFilter(false);
            }
        });
    }

    if (filterDropdown) {
        filterDropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.filter-option');
            if (option) {
                const filter = option.getAttribute('data-filter');
                if (!filter) return;
                window.__activeStateFilter = AnimeDestiny.internals.__activeStateFilter = filter;
                filterDropdown.querySelectorAll('.filter-option').forEach((b) => {
                    b.classList.toggle('is-active', b.getAttribute('data-filter') === filter);
                });
                applyFilter();
                if (filterToggle && !filterToggle.classList.contains('inline-filter-mode')) {
                    showFilter(false);
                }
                return;
            }
        });
    }

    applyFilter();
}


function inicializarGeneroWidgets() {
    const categoria = document.body.getAttribute('data-page');
    const mainContainer = document.getElementById('main-content');
    if (!categoria || !mainContainer) return;

    const counts = new Map();

    const cardGenreRows = [...mainContainer.querySelectorAll('.card-container[data-genres]')]
        .map((card) => String(card.getAttribute('data-genres') || '').split('|').map((genre) => genre.trim()).filter(Boolean))
        .filter((genres) => genres.length);

    const localList = (() => {
        if (cardGenreRows.length) return [];
        if (typeof obtenerItemsCategoria === 'function') {
            var result = obtenerItemsCategoria(categoria);
            return Array.isArray(result) ? result : [];
        }
        return [];
    })();

    const rows = cardGenreRows.length
        ? cardGenreRows
        : localList.map((item) => String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean));

    rows.forEach((genres) => {
        genres.forEach((g) => {
            const key = normalizeText(g);
            if (!key) return;
            counts.set(key, { label: g, count: (counts.get(key)?.count || 0) + 1 });
        });
    });

    var fixedGenres = (function () {
        var base = [
            'Action','Adventure','Comedy','Drama','Fantasy','Horror',
            'Mystery','Romance','Sci-Fi','Slice of Life','Sports',
            'Supernatural','Thriller','Psychological','Tragedy',
            'Magic','Mythology','Parody','Satire',
            'Superhero','Demons','Vampire','Zombie','Ghost','Aliens',
            'Post-Apocalyptic','Cyberpunk','Steampunk',
            'Reincarnation','Time Travel',
            'Harem','School','Military','Martial Arts',
            'Ninja','Samurai','Pirates','Mafia','Survival',
            'Music','Idol','Band',
            'Detective','Espionage','Noir','Crime',
            'War','Guns','Swordplay',
            'Revenge','Amnesia','Gambling',
            'Cultivation','Villainess','Anti-Hero',
            'Work','Medicine','Politics',
            'Family Life','Love Triangle',
            'Battle Royale','Dystopian',
            'Female Protagonist','Male Protagonist',
            'Ensemble Cast',
            'Food','Historical'
        ];
        var animes = base.concat([
            'Shounen','Shoujo','Seinen','Josei',
            'Ecchi','Gore',
            'Isekai','Mecha',
            'Police',
            'Mahou Shoujo',
            'Monster Girl','Animals',
            'Space','Space Opera','Urban Fantasy',
            'Crossdressing','Gender Bending',
            'Fairy Tale',
            'Fitness','Swimming',
            'Video Games','Virtual World',
            'Tokusatsu',
            'Delinquents','Gyaru',
            'Rehabilitation','Fugitive',
            'Trains','Ships','Motorcycles','Tanks',
            'Photography','Drawing','Calligraphy',
            'Incest',
            'Hikikomori','Otaku Culture','Chuunibyou',
            'Chibi','Nekomimi','Youkai','Kaiju',
            'Iyashikei','Denpa',
            'Real Robot','Super Robot','Robots',
            'Lost Civilization','Rural','Urban',
            'Witch','Werewolf','Dragon','Skeleton',
            'Primarily Adult Cast',
            'Slavery',
            'Boys\' Love','LGBTQ+ Themes',
            'Office','Economics','Philosophy',
            'Surreal Comedy','Time Manipulation',
            'Found Family',
            'Card Battle'
        ]);
        var mangas = base.concat([
            'Shounen','Shoujo','Seinen','Josei',
            'Ecchi','Gore',
            'Isekai','Mecha',
            'Police',
            'Medical','Wuxia',
            'Mahou Shoujo',
            'Monster Girl','Monster Girls','Animals',
            'Space','Space Opera','Urban Fantasy',
            'Crossdressing','Gender Bending','Genderswap',
            'Fairy Tale',
            'Fitness','Swimming',
            'Video Games','Virtual World','Virtual Reality',
            'Tokusatsu',
            'Delinquents','Gyaru',
            'Rehabilitation','Fugitive',
            'Trains','Ships','Motorcycles','Tanks',
            'Photography','Drawing','Calligraphy',
            'Incest','Loli','Shota',
            'Hikikomori','Otaku Culture','Chuunibyou',
            'Chibi','Nekomimi','Youkai','Kaiju',
            'Iyashikei','Denpa',
            'Real Robot','Super Robot','Robots',
            'Lost Civilization','Rural','Urban',
            'Witch','Werewolf','Dragon','Skeleton',
            'Primarily Adult Cast',
            'Slavery',
            '4-koma','Full Color','Long Strip','Anthology',
            'Doujinshi','Web Comic','Self-Published',
            'Award Winning','Adaptation',
            'School Life',
            'Reverse Harem',
            'Girls\' Love',
            'Cooking',
            'Office Workers','Office','Economics','Philosophy',
            'Surreal Comedy','Time Manipulation',
            'Found Family',
            'Card Battle','Traditional Games'
        ]);
        var novelas = base.concat([
            'Gore','Isekai',
            'Police',
            'Monster Girl','Monster Girls',
            'Space','Space Opera','Urban Fantasy',
            'Demons','Vampire','Ghost','Aliens',
            'Survival',
            'Crime',
            'Revenge','Amnesia','Gambling',
            'Superhero',
            'School','Martial Arts',
            'Ninja',
            'Delinquents','Gyaru',
            'Witch','Werewolf','Dragon',
            'Slavery','Rehabilitation','Fugitive',
            'Hikikomori','Otaku Culture',
            'Boys\' Love','Girls\' Love','LGBTQ+ Themes',
            'Office Workers','Office','Economics','Philosophy',
            'Found Family',
            'Card Battle',
            'Idol','Band',
            'Video Games','Virtual World','Virtual Reality',
            'Female Protagonist','Male Protagonist',
            'Family Life','Love Triangle',
            'Dystopian',
            'Historical',
            'School Life',
            'Reverse Harem',
            'Award Winning','Adaptation',
            'Cooking'
        ]);
        if (categoria === 'anime') return animes;
        if (categoria === 'novelas') return novelas;
        return mangas;
    })();
    fixedGenres.forEach(function(g) {
        var key = normalizeText(g);
        if (!counts.has(key)) {
            counts.set(key, { label: g, count: 0 });
        }
    });

    const sorted = [...counts.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

    const filterGenres = sorted;

    const selectedKey = `ui:selectedGenres:${categoria}`;
    const selectedGenres = (() => {
        try {
            const raw = UserStore.getItem(selectedKey) || '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch { return []; }
    })();

    window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = selectedGenres;

    // ── Populate dropdown genre chips ──
    const filterGenresContainer = document.getElementById('filterGenres');
    const genreSearchInput = document.getElementById('filterGenreSearch');
    const genreToggleBtn = document.getElementById('toggleGenresBtn');
    // Con >100 géneros, mostrar todos de golpe abruma. Colapsamos a los más
    // populares (ya vienen ordenados por conteo desc) y ofrecemos "Ver todos".
    const GENRE_COLLAPSED_COUNT = 24;

    function renderDropdownGenres() {
        if (!filterGenresContainer) return;
        const arr = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        const q = (window.__genreQuery || '').trim().toLowerCase();

        // Filtrado por texto del buscador (coincide con la etiqueta).
        const list = q
            ? filterGenres.filter((g) => g.label.toLowerCase().includes(q))
            : filterGenres;

        // Colapsar salvo que se esté buscando o el usuario haya expandido.
        const canCollapse = !q && !window.__genreExpanded && list.length > GENRE_COLLAPSED_COUNT;
        let visible = canCollapse ? list.slice(0, GENRE_COLLAPSED_COUNT) : list;

        // Los géneros ya seleccionados siempre se muestran, aunque queden fuera
        // del recorte colapsado.
        if (canCollapse && arr.length) {
            const shownKeys = new Set(visible.map((g) => g.key));
            visible = visible.concat(list.filter((g) => arr.includes(g.key) && !shownKeys.has(g.key)));
        }

        if (!visible.length) {
            filterGenresContainer.innerHTML = '<div class="ff-genre-empty">Sin géneros que coincidan.</div>';
        } else {
            filterGenresContainer.innerHTML = visible.map((g) => {
                const active = arr.includes(g.key) ? ' is-active' : '';
                return `<button class="ff-genre-chip${active}" type="button" data-genre="${escapeHtml(g.key)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(g.label)}</button>`;
            }).join('');
        }

        if (genreToggleBtn) {
            if (q || list.length <= GENRE_COLLAPSED_COUNT) {
                genreToggleBtn.hidden = true;
            } else {
                genreToggleBtn.hidden = false;
                genreToggleBtn.textContent = window.__genreExpanded
                    ? 'Ver menos ▲'
                    : 'Ver todos · ' + list.length + ' géneros ▼';
            }
        }
    }

    // Expose globally so external code (e.g. on scroll-append) can sync chips
    window.__renderDropdownGenres = renderDropdownGenres;

    // Guard: add event listeners only ONCE — prevents duplicate handlers
    // on subsequent calls from cargarCatalogoDesdeApi / reloadCatalog
    if (_genreWidgetsListenersAdded) {
        if (filterGenresContainer && filterGenres.length) renderDropdownGenres();
        return;
    }
    _genreWidgetsListenersAdded = true;

    if (genreSearchInput) {
        genreSearchInput.addEventListener('input', () => {
            window.__genreQuery = genreSearchInput.value || '';
            if (typeof window.__renderDropdownGenres === 'function') window.__renderDropdownGenres();
        });
    }

    if (genreToggleBtn) {
        genreToggleBtn.addEventListener('click', () => {
            window.__genreExpanded = !window.__genreExpanded;
            if (typeof window.__renderDropdownGenres === 'function') window.__renderDropdownGenres();
        });
    }

    const clearBtn = document.getElementById('clearFiltersBtn');

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
            UserStore.setItem(selectedKey, JSON.stringify([]));
            // Reset de los filtros avanzados (Orden / Año / Temporada / Formato).
            ['filterSort', 'filterYear', 'filterSeason', 'filterFormat'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            if (typeof window.__renderDropdownGenres === 'function') window.__renderDropdownGenres();
            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
        });
    }

    if (filterGenresContainer && filterGenres.length) {
        renderDropdownGenres();

        filterGenresContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.ff-genre-chip');
            if (!chip) return;
            const genreKey = String(chip.getAttribute('data-genre') || '');
            if (!genreKey) return;

            const next = new Set(Array.isArray(window.__selectedGenres) ? window.__selectedGenres : []);
            if (next.has(genreKey)) next.delete(genreKey);
            else next.add(genreKey);
            const arr = [...next];
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = arr;
            UserStore.setItem(selectedKey, JSON.stringify(arr));

            renderDropdownGenres();
            // Trigger server reload instead of local filter
            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
        });
    }
}



/* ========================================== */
/* === FILE: js/catalog/pagination.js === */
/* ========================================== */

let currentPage = 1;
let isLoadingPage = false;
let hasMorePages = true;
let scrollObserver = null;

// Puerta de scroll: el sentinel queda dentro del viewport apenas termina el
// primer render (pantalla alta, pocos resultados, o zoom out), asi que el
// observer encadenaba paginas sin que el usuario tocara nada — hasta 6 en manga,
// que son 18 requests a AniList en segundos y el rate limit garantizado.
// Ahora la carga automatica no arranca hasta que haya un scroll real.
let usuarioScrolleo = false;
let sentinelALaVista = false;

function alScrollearPorPrimeraVez() {
    if (usuarioScrolleo) return;
    usuarioScrolleo = true;
    // El observer no vuelve a dispararse si el sentinel ya estaba visible (no
    // hay cambio de interseccion que notificar), asi que hay que reintentar.
    if (sentinelALaVista) loadNextPage();
}

function getSentinel() {
    let el = document.getElementById("scroll-sentinel");
    if (!el) {
        el = document.createElement("div");
        el.id = "scroll-sentinel";
        el.className = "scroll-sentinel";
        document.querySelector(".gallery")?.appendChild(el);
    }
    return el;
}

function hideLoadingIndicator() {
    const sentinel = getSentinel();
    sentinel.innerHTML = "";
}

function showNoMoreMessage() {
    const sentinel = getSentinel();
    sentinel.innerHTML = '<div class="scroll-end">No hay m\u00E1s resultados</div>';
}

async function loadNextPage() {
    if (isLoadingPage || !hasMorePages) return;
    isLoadingPage = true;

    const categoria = document.body.getAttribute("data-page");
    const mainContainer = document.getElementById("main-content");
    if (!mainContainer) { isLoadingPage = false; return; }

    // Tope de nodos: evita acumular miles de cards en el DOM al scrollear.
    const MAX_RENDERED = AnimeDestiny.Constants.MAX_RENDERED_CARDS || 240;
    if (document.querySelectorAll(".catalog-neon-card").length >= MAX_RENDERED) {
        hasMorePages = false;
        const sentinel = getSentinel();
        sentinel.innerHTML = '<div class="scroll-end">Usá la búsqueda o los filtros para acotar los resultados.</div>';
        isLoadingPage = false;
        return;
    }

    var skelWrapper;
    if (typeof renderSkeletonCards === "function") {
        skelWrapper = document.createElement("div");
        skelWrapper.className = "skeleton-batch";
        renderSkeletonCards(skelWrapper, AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20);
        mainContainer.appendChild(skelWrapper);
    }

    const usaCatalogoApi = categoria === "anime" || categoria === "manga" || categoria === "novelas";

    if (usaCatalogoApi) {
        currentPage++;
        // cargarCatalogoDesdeApi reads window.__catalogFilters internally
        const ok = await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage, true);
        if (skelWrapper) skelWrapper.remove();
        if (!ok || currentPage >= (AnimeDestiny.Constants.MAX_PAGES || 250)) {
            hasMorePages = false;
            showNoMoreMessage();
        }
        if (ok && document.querySelectorAll(".catalog-neon-card").length < (AnimeDestiny.Constants.PER_PAGE || 40)) {
            hasMorePages = false;
            showNoMoreMessage();
        }
    } else {
        const listaItems = (typeof obtenerItemsCategoria === "function")
            ? obtenerItemsCategoria(categoria)
            : [];
        const perPage = AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20;
        const totalLoaded = document.querySelectorAll(".catalog-neon-card").length;
        if (totalLoaded >= listaItems.length) {
            hasMorePages = false;
            showNoMoreMessage();
            isLoadingPage = false;
            if (skelWrapper) skelWrapper.remove();
            return;
        }
        currentPage++;
        const nextBatch = listaItems.slice(0, totalLoaded + perPage);
        renderCatalogCardsFromLocalData(categoria, mainContainer, nextBatch, true);
        if (skelWrapper) skelWrapper.remove();
        if (nextBatch.length >= listaItems.length) {
            hasMorePages = false;
            showNoMoreMessage();
        }
    }

    isLoadingPage = false;
}

function initScrollObserver() {
    disconnectScrollObserver();
    const sentinel = getSentinel();
    scrollObserver = new IntersectionObserver(function (entries) {
        sentinelALaVista = entries[0].isIntersecting;
        if (sentinelALaVista && usuarioScrolleo) {
            loadNextPage();
        }
    }, { rootMargin: "200px" });
    scrollObserver.observe(sentinel);
}

function disconnectScrollObserver() {
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
}

function resetInfiniteScroll() {
    currentPage = 1;
    hasMorePages = true;
    isLoadingPage = false;
    hideLoadingIndicator();
    const sentinel = getSentinel();
    sentinel.innerHTML = "";
    // Se rearma en cada reset (carga inicial y cambio de filtros): un catalogo
    // recien renderizado no debe encadenar paginas solo porque el usuario ya
    // habia scrolleado antes de buscar.
    usuarioScrolleo = false;
    sentinelALaVista = false;
    window.addEventListener("scroll", alScrollearPorPrimeraVez, { passive: true, once: true });
    initScrollObserver();
}

async function inicializarPagina() {
    const mainContainer = document.getElementById("main-content");
    if (!mainContainer) return;
    const categoria = document.body.getAttribute("data-page");
    // Páginas que NO son catálogo: no deben ser sobreescritas por el catálogo.
    if (["listas", "top", "ranking", "comparar", "detalle", "index", "usuario", "configuracion", "login", "personaje", "personajes"].indexOf(categoria) !== -1) return;
    currentPage = 1;
    const usaCatalogoApi = categoria === "anime" || categoria === "manga" || categoria === "novelas";

    if (usaCatalogoApi) {
        await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage);
        resetInfiniteScroll();
        return;
    }

    const listaItems = (typeof obtenerItemsCategoria === "function")
        ? obtenerItemsCategoria(categoria)
        : [];
    window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = listaItems.map(function (item) {
        return { item: item, searchIndex: buildSearchIndexForItem(categoria, item) };
    });

    if (listaItems.length === 0) {
        mainContainer.innerHTML = '<section class="empty-state"><span class="empty-state-kicker">Cat\u00E1logo en preparaci\u00F3n</span><h2>Pr\u00F3ximamente m\u00E1s contenido.</h2><p>Cuando cargues nuevos t\u00EDtulos, van a aparecer ac\u00E1.</p></section>';
        return;
    }

    function getGenres(item) {
        return String(item?.info || "").split("/").map(function (s) { return s.trim(); }).filter(Boolean);
    }

    const perPage = AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20;
    const batch = listaItems.slice(0, perPage);

    mainContainer.innerHTML = batch.map(function (item) {
        const genres = getGenres(item);
        const genresNorm = genres.map(function (g) { return normalizeText(g); }).join("|");
        const searchIndex = buildSearchIndexForItem(categoria, item);
        const detailUrl = "detalle.html?cat=" + encodeURIComponent(categoria) + "&id=" + encodeURIComponent(item.id) + "&nombre=" + encodeURIComponent(item.titulo);
        // Aca habia dos llamadas mas a `obtenerDetalleItem` (dos requests por
        // item) con el mismo defecto que las de states.js: devuelve una Promise,
        // asi que `hasDetail` daba siempre true y `detalle?.temporadas` /
        // `detalle?.volumenes` siempre undefined. El progressTotal ya sale de los
        // campos del propio item, que es de donde salia en los hechos.
        const hasDetail = true;
        var volCount = Number(item.volumenes || item.volumes || 0);
        var chCount = Number(item.capitulos || item.chapters || 0);
        return buildCatalogCardHtml({
            id: item.id,
            title: item.titulo,
            image: item.img,
            detailUrl: detailUrl,
            status: item.status || "",
            showDetail: hasDetail,
            searchIndex: searchIndex,
            genres: genres.join("|"),
            genresNorm: genresNorm,
            categoria: categoria,
            progressTotal: volCount || chCount || 0,
            volCount: volCount,
            chCount: chCount,
            imageExtraAttrs: ' data-title="' + escapeHtml(item.titulo) + '" data-fallback-catalog="1"'
        });
    }).join("");

    try { cargarEstadosBotones(); } catch (e) { console.warn('Error en botones:', e); }
    try { inicializarBusquedaCatalogo(); } catch (e) { console.warn('Error en busqueda:', e); }
    try { inicializarGeneroWidgets(); } catch (e) { console.warn('Error en generos:', e); }
    resetInfiniteScroll();
}

document.addEventListener("DOMContentLoaded", inicializarPagina);

function rememberCatalogPosition() {
    try {
        sessionStorage.setItem("lastCatalogUrl", window.location.href);
        sessionStorage.setItem("lastCatalogScrollY", String(window.scrollY || 0));
    } catch (e) {}
}

function restoreCatalogPosition() {
    try {
        var url = sessionStorage.getItem("lastCatalogUrl");
        var y = Number(sessionStorage.getItem("lastCatalogScrollY") || "0");
        var shouldRestore = sessionStorage.getItem("shouldRestoreCatalog") === "1";
        if (!shouldRestore) return;
        if (url && url === window.location.href) {
            sessionStorage.removeItem("shouldRestoreCatalog");
            window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: "instant" });
        }
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", restoreCatalogPosition);

window.addEventListener("supabase-auth-changed", function () {
    cargarEstadosBotones();
});




/* ========================================== */
/* === FILE: js/core/common-ui.js === */
/* ========================================== */

(() => {
    "use strict";

    const path = window.location.pathname.toLowerCase();

    /**
     * Nombre del archivo actual, sin carpeta ni extension ("manga", "index").
     *
     * Todo lo que depende de "en que pagina estoy" se resuelve con esto y no
     * con path.includes(...): el substring encendia el item equivocado apenas
     * el nombre de una pagina aparecia dentro del de otra o de una carpeta del
     * deploy. Ademas "ranking.html" no contenia ninguno de los nombres
     * buscados, asi que la pagina quedaba sin marcar en la barra.
     */
    const archivo = (path.split("/").pop() || "index.html").replace(/\.html?$/, "") || "index";

    const t = (clave, porDefecto) => (window.AppI18n ? window.AppI18n.t(clave) : porDefecto);

    /**
     * Destinos de la barra, partidos en dos niveles.
     *
     * Los primarios son los cuatro que se usan todo el tiempo; el resto vive en
     * el desplegable "Mas". Con todo suelto la barra de arriba se apretaba en
     * pantallas medianas y el bottom nav de mobile no da para siete pestañas,
     * asi que comparar.html y top.html habian quedado fuera de la navegacion:
     * solo se llegaba a ellas desde una card del index.
     */
    const NAV_PRIMARIOS = [
        { id: "anime", href: "anime.html", icon: "clapperboard", i18n: "nav.anime", corto: "nav.anime", def: "Anime" },
        { id: "manga", href: "manga.html", icon: "book-open", i18n: "nav.manga", corto: "nav.manga", def: "Manga" },
        { id: "novelas", href: "novelas.html", icon: "book", i18n: "nav.novelas", corto: "nav.novelas", def: "Novelas" },
        // "Mis Listas" no entra en una linea en el tab de mobile y desalinea el
        // icono, asi que ahi se rotula con la clave corta.
        { id: "mis-listas", href: "mis-listas.html", icon: "heart", i18n: "nav.mis_listas", corto: "nav.listas", def: "Mis Listas", defCorto: "Listas" }
    ];

    const NAV_SECUNDARIOS = [
        { id: "ranking", href: "ranking.html", icon: "trophy", i18n: "nav.ranking", def: "Ranking" },
        { id: "comparar", href: "comparar.html", icon: "columns-2", i18n: "nav.comparar", def: "Comparar" },
        { id: "top", href: "top.html", icon: "crown", i18n: "nav.top_jugadores", def: "Top de jugadores" },
        { id: "configuracion", href: "configuracion.html", icon: "settings", i18n: "nav.configuracion", def: "Configuración" }
    ];

    const paginaActiva = NAV_PRIMARIOS.some((l) => l.id === archivo) ? archivo : null;
    // Estando en una pagina del desplegable, el que se marca es el boton "Mas":
    // si no, la barra queda sin ningun item encendido y no se sabe donde uno esta.
    const secundarioActivo = NAV_SECUNDARIOS.some((l) => l.id === archivo) ? archivo : null;

    // Paginas con texto propio en el pie; el resto (404, privacidad, terminos)
    // cae al generico de index.
    const PAGINAS_CON_PIE = [
        "mis-listas", "anime", "manga", "novelas", "comparar",
        "detalle", "configuracion", "usuario", "login", "ranking", "top"
    ];
    const pageKey = PAGINAS_CON_PIE.indexOf(archivo) !== -1 ? archivo : "index";


    const ensureMainTarget = () => {
        if (document.getElementById('main-content')) return;
        const candidates = [
            document.querySelector('main'),
            document.querySelector('.login-shell'),
            document.querySelector('.profile-dashboard'),
            document.querySelector('.catalog-layout'),
            document.querySelector('.menu-container'),
            document.querySelector('.featured'),
            document.querySelector('.hero-menu')
        ].filter(Boolean);
        if (!candidates.length) return;
        const target = candidates[0];
        if (target.id) return; // no sobrescribir id existente (ej: main-container)
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    };

    // ── NAV BRAND ──
    const injectNavBrand = () => {
        const el = document.getElementById("nav-brand-container");
        if (!el) return;
        el.innerHTML = `<a class="nav-brand" href="index.html" aria-label="Anime Destiny">
<span class="nav-brand-mark"><img src="images/Logo.png" alt="Anime Destiny logo" aria-hidden="true"></span>
<span class="nav-brand-copy">
<span class="nav-brand-anime">Anime</span>
<span class="nav-brand-destiny">Destiny</span>
<span class="nav-brand-jp">&gt; \u30A2\u30CB\u30E1\u306E\u904B\u547D &lt;</span>
</span>
</a>`;
    };

    // ── NAV LINKS ──
    const injectNavLinks = () => {
        const el = document.getElementById("nav-links-container");
        if (!el) return;

        const isDetail = archivo === "detalle";

        let html = "";
        for (let i = 0; i < NAV_PRIMARIOS.length; i++) {
            const l = NAV_PRIMARIOS[i];
            let cls = "nav-btn";
            let current = "";
            let dataCat = "";
            if (l.id === paginaActiva) {
                cls += " active";
                current = ' aria-current="page"';
            }
            if (isDetail && i < 3) {
                dataCat = ` data-nav-cat="${l.id}"`;
            }
            html += `<a href="${l.href}" class="${cls}"${current}${dataCat}>
<span class="nav-icon" aria-hidden="true"><i data-lucide="${l.icon}"></i></span><span data-i18n="${l.i18n}">${t(l.i18n, l.def)}</span>
</a>`;
        }

        // Saliendo de un catálogo (anime/manga/novelas) hacia una página del
        // "Más", se guarda la posición del scroll para devolverla al volver.
        // Solo ahí tiene sentido: es donde vive rememberCatalogPosition y donde
        // hay una lista larga que perder. data-remember-catalog guarda la
        // posición al click; data-restore-catalog pide restaurarla al volver
        // (ambos los maneja installSecurityHandlers + restoreCatalogPosition).
        const enCatalogo = archivo === "anime" || archivo === "manga" || archivo === "novelas";
        const detourAttrs = enCatalogo ? ' data-remember-catalog="1" data-restore-catalog="1"' : '';

        const itemsMas = NAV_SECUNDARIOS.map((l) => {
            const current = l.id === secundarioActivo ? ' aria-current="page"' : '';
            const cls = l.id === secundarioActivo ? ' is-active' : '';
            return `<a href="${l.href}" class="nav-more-item${cls}"${current}${detourAttrs}>
<span class="nav-more-icon" aria-hidden="true"><i data-lucide="${l.icon}"></i></span><span data-i18n="${l.i18n}">${t(l.i18n, l.def)}</span>
</a>`;
        }).join("");

        html += `<div class="nav-more">
<button class="nav-btn nav-more-btn${secundarioActivo ? " active" : ""}" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="nav-more-menu">
<span class="nav-icon" aria-hidden="true"><i data-lucide="chevron-down"></i></span><span data-i18n="nav.mas">${t("nav.mas", "Más")}</span>
</button>
<div class="nav-more-menu" id="nav-more-menu" role="menu" hidden>${itemsMas}</div>
</div>`;

        el.innerHTML = `<div class="nav-links" aria-label="Navegación principal">${html}</div>`;
        wireNavMore(el);
    };

    // ── DESPLEGABLE "MÁS" ──
    const wireNavMore = (scope) => {
        const wrap = scope.querySelector(".nav-more");
        if (!wrap) return;
        const btn = wrap.querySelector(".nav-more-btn");
        const menu = wrap.querySelector(".nav-more-menu");
        if (!btn || !menu) return;

        const abrir = (estado) => {
            menu.hidden = !estado;
            wrap.classList.toggle("is-open", estado);
            btn.setAttribute("aria-expanded", String(estado));
        };

        // Solo por click. Antes tambien abria con hover, y como el panel esta
        // pegado a "Más", con solo rozar el boton se desplegaba y quedaba
        // tapando el contenido de abajo sin que nadie lo pidiera. Ahora se abre
        // al tocarlo y se contrae al volver a tocarlo (o al clickear afuera, con
        // Escape, o al scrollear).
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            abrir(menu.hidden);
        });

        // Cerrar al clickear afuera o con Escape: sin esto el panel queda
        // abierto tapando el contenido despues de navegar con el teclado.
        document.addEventListener("click", (e) => {
            if (!menu.hidden && !wrap.contains(e.target)) abrir(false);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !menu.hidden) {
                abrir(false);
                btn.focus();
            }
        });

        // Los usa el botón "Más" del bottom nav, que vive en otro contenedor.
        window.__navMoreOpen = () => abrir(true);
        window.__navMoreClose = () => abrir(false);
    };

    /**
     * Cerrar el desplegable "Más" al hacer scroll.
     *
     * La navbar superior NO se contrae ni se esconde: queda siempre visible a su
     * alto normal. Lo único que "se contrae" con el scroll es el botón "Más": si
     * su desplegable quedó abierto y el lector empieza a moverse por la página,
     * se cierra para no seguir tapando lo que se está leyendo.
     *
     * Solo aplica en desktop: por debajo de 700px la navbar de arriba vive fuera
     * de pantalla y el "Más" lo maneja el bottom nav.
     */
    const wireNavMoreAutoClose = () => {
        const nav = document.querySelector('.destiny-navbar');
        if (!nav) return;

        const esMobile = () => window.matchMedia('(max-width: 700px)').matches;

        // La barra nunca queda contraída/escondida: limpiamos cualquier resto de
        // esos estados por si una versión previa los dejó puestos.
        nav.classList.remove('is-hidden', 'is-scrolled');

        const MINIMO_GESTO = 8;
        let ultimo = window.scrollY;
        let pendiente = false;

        const evaluar = () => {
            pendiente = false;
            const y = Math.max(0, window.scrollY);
            const delta = y - ultimo;
            ultimo = y;

            if (esMobile()) return;
            if (Math.abs(delta) < MINIMO_GESTO) return;

            // Único efecto del scroll sobre la barra: cerrar el desplegable "Más".
            if (nav.querySelector('.nav-more.is-open') && typeof window.__navMoreClose === 'function') {
                window.__navMoreClose();
            }
        };

        // El handler corre en cada frame como mucho: el evento de scroll se
        // dispara muchisimo mas seguido que eso y no hace falta.
        window.addEventListener('scroll', () => {
            if (pendiente) return;
            pendiente = true;
            requestAnimationFrame(evaluar);
        }, { passive: true });
    };

    // ── MOBILE BOTTOM NAV ──
    const injectMobileBottomNav = () => {
        if (document.querySelector('.mobile-bottom-nav')) return;

        // No inyectar en páginas de auth ni en el 404 (en el resto siempre debe
        // haber navegación visible: en mobile la navbar superior queda oculta)
        if (archivo === "login" || archivo === "404") return;

        // Las mismas cuatro pestañas que la barra de arriba; el resto queda
        // detrás del botón "Más", que despliega la navbar superior (en mobile
        // hace de hoja) con el menú secundario ya abierto.
        let html = '';
        for (let i = 0; i < NAV_PRIMARIOS.length; i++) {
            const tab = NAV_PRIMARIOS[i];
            const activeClass = tab.id === paginaActiva ? ' active' : '';
            const currentAttr = tab.id === paginaActiva ? ' aria-current="page"' : '';
            const clave = tab.corto || tab.i18n;
            html += `<a href="${tab.href}" class="bottom-tab${activeClass}"${currentAttr}>
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="${tab.icon}"></i></span>
<span data-i18n="${clave}">${t(clave, tab.defCorto || tab.def)}</span>
</a>`;
        }

        html += `<button class="bottom-tab-more${secundarioActivo ? " active" : ""}" aria-label="${t("nav.mas", "Más")}" type="button">
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="menu"></i></span>
<span data-i18n="nav.mas">${t("nav.mas", "Más")}</span>
</button>`;

        const nav = document.createElement('nav');
        nav.className = 'mobile-bottom-nav';
        nav.setAttribute('aria-label', 'Navegación móvil');
        nav.innerHTML = html;
        document.body.appendChild(nav);
        document.body.classList.add('has-bottom-nav');

        // Cerrar navbar top al hacer click en cualquier link del bottom bar
        nav.addEventListener('click', (e) => {
            const link = e.target.closest('.bottom-tab');
            if (!link) return;
            const navbar = document.querySelector('.destiny-navbar');
            if (navbar) navbar.classList.remove('is-open');
            const moreBtn = nav.querySelector('.bottom-tab-more');
            if (moreBtn) moreBtn.classList.remove('is-open');
        });

        // "Más": despliega la navbar superior, que en mobile entra desde arriba
        // y trae el buscador, el usuario y el menú secundario.
        const moreBtn = nav.querySelector('.bottom-tab-more');
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                const navbar = document.querySelector('.destiny-navbar');
                if (!navbar) return;
                // Sin esto el click sigue subiendo hasta el listener que cierra
                // el desplegable al tocar afuera, y el menú se abriría y
                // cerraría en el mismo gesto.
                e.stopPropagation();
                const isOpen = navbar.classList.toggle('is-open');
                moreBtn.classList.toggle('is-open', isOpen);
                if (!isOpen && typeof window.__navMoreClose === 'function') window.__navMoreClose();
                if (isOpen) {
                    // El menú secundario se abre solo: si no, el que viene
                    // buscando Comparar o Ranking tiene que adivinar que hay
                    // que tocar otro botón más.
                    if (typeof window.__navMoreOpen === 'function') window.__navMoreOpen();
                    const input = navbar.querySelector('.nav-search-input');
                    if (input) setTimeout(() => input.focus(), 100);
                }
            });
        }
    };

    // ── LOGIN / USER AREA ──
    const injectLoginButton = () => {
        const el = document.getElementById("nav-login-container");
        if (!el) return;
        if (archivo === "login") return;

        const ingresarText = window.AppI18n ? window.AppI18n.t("nav.ingresar") : "Ingresar";
        const invitadoText = window.AppI18n ? window.AppI18n.t("nav.usuario_invitado") : "...";
        el.innerHTML = `<div class="nav-user" id="nav-user">
<div class="nav-user-info">
<span id="nav-user-name" class="nav-user-name" data-i18n="nav.usuario_invitado">${invitadoText}</span>
<span id="nav-user-grade" class="nav-user-grade" hidden></span>
<a id="nav-user-btn" href="Login.html" class="nav-user-btn" data-i18n="nav.ingresar">${ingresarText}</a>
</div>
<div id="nav-user-avatar" class="nav-user-avatar"></div>
</div>`;

        // Refrescar la UI del usuario si auth.js ya cargó
        if (typeof window.refreshUserUi === 'function') {
            window.refreshUserUi();
        }

        // Cuando Supabase cargue, actualizar la UI del usuario
        window.addEventListener('supabase-ready', () => {
            if (typeof window.refreshUserUi === 'function') {
                window.refreshUserUi();
            }
        }, { once: true });
    };

    // ── FOOTER ──
    const FOOTER_DATA = {
        anime: {
            col1: { title: "Tips", text: 'Us\u00E1 la b\u00FAsqueda para filtrar r\u00E1pido y abr\u00ED "Detalle" para marcar cap\u00EDtulos.' },
            col2: { title: "Cuenta", text: 'Entr\u00E1 desde el bot\u00F3n <strong>Cuenta</strong> para guardar tus listas.' }
        },
        manga: {
            col1: { title: "Tips", text: 'Entr\u00E1 a "Detalle" para marcar vol\u00FAmenes en verde y llevar progreso.' },
            col2: { title: "Cuenta", text: 'Si quer\u00E9s guardar tus listas, inici\u00E1 sesi\u00F3n desde <strong>Cuenta</strong>.' }
        },
        novelas: {
            col1: { title: "Tips", text: "Us\u00E1 la b\u00FAsqueda para filtrar por t\u00EDtulo." },
            col2: { title: "Cuenta", text: 'Inici\u00E1 sesi\u00F3n para guardar tus "Me gusta" y "Vistos".' }
        },
        index: {
            col1: { title: "Anime Destiny", text: "Cat\u00E1logo de anime, manga y novelas con detalle, progreso y listas por usuario." },
            col2: { title: "Contacto", text: "Soporte: contacto@animedestiny.local<br>Buenos Aires, AR" }
        },
        comparar: {
            col1: { title: "Tip", text: "Pod\u00E9s comparar t\u00EDtulos de distintas categor\u00EDas." },
            col2: { title: "Detalle", text: "Desde la comparaci\u00F3n pod\u00E9s abrir el detalle de cada uno." }
        },
        detalle: {
            col1: { title: "PROGRESO", text: "Toc\u00E1 los cuadrados (vol\u00FAmenes/cap\u00EDtulos) para marcarlos en verde." },
            col2: { title: "LISTAS", text: "Us\u00E1 \u2764 y \uD83D\uDC41 en las cards para armar tus listas." }
        },
        configuracion: {
            col1: { title: "Configuraci\u00F3n", text: "Tus cambios se guardan localmente en este navegador." },
            col2: { title: "Consejo", text: "Activ\u00E1 cards compactas si quer\u00E9s ver m\u00E1s t\u00EDtulos sin hacer tanto scroll." },
            col3: { title: "Seguridad", text: "Si elimin\u00E1s el usuario, se borra su sesi\u00F3n y progreso local." }
        },
        usuario: {
            col1: { title: "Perfil", text: "Gestion\u00E1 tu informaci\u00F3n, preferencias y estad\u00EDsticas de uso." },
            col2: { title: "Acciones", text: "Us\u00E1 Mis listas para revisar guardados y el comparador para analizar dos t\u00EDtulos." }
        },
        "mis-listas": {
            col1: { title: "Tus listas", text: "Revis\u00E1 tus Me gusta, Vistos y progreso de cap\u00EDtulos/vol\u00FAmenes." },
            col2: { title: "Cuenta", text: "Todo se guarda con tu cuenta de Supabase. Nunca perd\u00E9s tu progreso." }
        },
        top: {
            col1: { title: "Ranking", text: "Jugadores ordenados por nivel y experiencia total acumulada." },
            col2: { title: "F2P / P2W", text: "Pr\u00F3ximamente m\u00E1s categor\u00EDas de ranking." }
        },
        ranking: {
            col1: { title: "Top Ranking", text: "Anime, manga y novelas ordenados por la puntuaci\u00F3n de la comunidad." },
            col2: { title: "Detalle", text: "Toc\u00E1 cualquier fila para abrir la ficha completa del t\u00EDtulo." }
        }
    };

    const injectFooter = () => {
        const el = document.getElementById("footer-container");
        if (!el) return;

        const lang = window.AppI18n ? window.AppI18n.getLang() : "es";

        // Translate static footer titles/links
        const redesTitle = lang === "en" ? "Social" : "Redes";
        const privacidadText = lang === "en" ? "Privacy" : "Privacidad";
        const terminosText = lang === "en" ? "Terms" : "Términos";

        const data = FOOTER_DATA[pageKey];
        if (!data) return;

        let cols = "";
        const entries = data.col3 ? [data.col1, data.col2, data.col3] : [data.col1, data.col2];

        for (let i = 0; i < entries.length; i++) {
            const c = entries[i];
            let title = c.title;
            let text = c.text;

            // Apply translations dynamically for footer if language is set to English
            if (lang === "en") {
                if (title === "Tips" || title === "Tip" || title === "Consejo") title = "Tips";
                else if (title === "Cuenta") title = "Account";
                else if (title === "Contacto") title = "Contact";
                else if (title === "PROGRESO") title = "PROGRESS";
                else if (title === "LISTAS") title = "LISTS";
                else if (title === "Configuraci\u00F3n" || title === "Configuracion") title = "Settings";
                else if (title === "Seguridad") title = "Security";
                else if (title === "Perfil") title = "Profile";
                else if (title === "Acciones") title = "Actions";
                else if (title === "Tus listas") title = "Your lists";
                else if (title === "Ranking") title = "Ranking";
                else if (title === "F2P / P2W") title = "F2P / P2W";

                if (text.includes("b\u00FAsqueda para filtrar")) {
                    text = "Use search to filter quickly and open \"Detail\" to track chapters.";
                } else if (text.includes("Entr\u00E1 desde el bot\u00F3n")) {
                    text = "Log in using the <strong>Account</strong> button to save your lists.";
                } else if (text.includes("marcar vol\u00FAmenes")) {
                    text = "Open \"Detail\" to mark green volumes and track progress.";
                } else if (text.includes("guardar tus listas, inici\u00E1 sesi\u00F3n")) {
                    text = "If you want to save your lists, log in from <strong>Account</strong>.";
                } else if (text.includes("filtrar por t\u00EDtulo")) {
                    text = "Use search to filter by title.";
                } else if (text.includes("guardar tus \"Me gusta\"")) {
                    text = "Log in to save your \"Likes\" and \"Watched\" items.";
                } else if (text.includes("Cat\u00E1logo de anime")) {
                    text = "Anime, manga and novel catalog with detail, progress and lists per user.";
                } else if (text.includes("contacto@animedestiny")) {
                    text = "Support: contacto@animedestiny.local<br>Buenos Aires, AR";
                } else if (text.includes("comparar t\u00EDtulos de distintas")) {
                    text = "You can compare titles of different categories.";
                } else if (text.includes("comparaci\u00F3n pod\u00E9s abrir")) {
                    text = "From the comparison you can open the detail of each.";
                } else if (text.includes("cuadrados (vol\u00FAmenes")) {
                    text = "Tap the squares (volumes/chapters) to mark them green.";
                } else if (text.includes(" cards para armar")) {
                    text = "Use \u2764 and \uD83D\uDC41 on cards to build your lists.";
                } else if (text.includes("guardan localmente")) {
                    text = "Your changes are saved locally in this browser.";
                } else if (text.includes("cards compactas si quer\u00E9s")) {
                    text = "Enable compact cards if you want to see more titles without scrolling.";
                } else if (text.includes("elimin\u00E1s el usuario")) {
                    text = "If you delete the user, their session and local progress are deleted.";
                } else if (text.includes("Gestion\u00E1 tu informaci\u00F3n")) {
                    text = "Manage your info, preferences, and usage statistics.";
                } else if (text.includes("comparador para analizar")) {
                    text = "Use My lists to review saved items and comparison to analyze two titles.";
                } else if (text.includes("Revis\u00E1 tus Me gusta")) {
                    text = "Review your Likes, Watched and progress of chapters/volumes.";
                } else if (text.includes("Supabase. Nunca perd\u00E9s")) {
                    text = "Everything is saved to your Supabase account. You never lose your progress.";
                } else if (text.includes("nivel y experiencia total acumulada")) {
                    text = "Players sorted by level and total accumulated experience.";
                } else if (text.includes("categor\u00EDas de ranking")) {
                    text = "More ranking categories coming soon.";
                }
            }

            cols += `<div class="app-footer-col">
<div class="app-footer-title">${title}</div>
<p class="app-footer-text">${text}</p>
</div>`;
        }

        if (!data.col3) {
            cols += `<div class="app-footer-col">
<div class="app-footer-title">${redesTitle}</div>
<div class="app-footer-social">
<a class="app-footer-icon" href="#" aria-label="X">\uD835\uDD4F</a>
<a class="app-footer-icon" href="#" aria-label="Instagram">IG</a>
<a class="app-footer-icon" href="#" aria-label="YouTube">YT</a>
</div>
</div>`;
        }

        el.innerHTML = `<footer class="app-footer">
<div class="app-footer-inner">${cols}</div>
<div class="app-footer-bottom">
    <span>© 2026 Anime Destiny</span>
    <span style="margin: 0 10px;">•</span>
    <a class="app-footer-link app-footer-link-cyan" href="privacidad.html">${privacidadText}</a>
    <span style="margin: 0 10px;">•</span>
    <a class="app-footer-link app-footer-link-purple" href="terminos.html">${terminosText}</a>
</div>
</footer>`;
    };

    // ── Custom colors (leer desde localStorage y aplicar en :root) ──
    (() => {
        const colorKeys = {
            '--neon-purple':  'pref:color:neonPurple',
            '--nav-accent':   'pref:color:navAccent',
            '--accent-cyan':  'pref:color:cyan',
            '--dark-bg':      'pref:color:darkBg',
            '--text-main':    'pref:color:textMain',
            '--text-muted':   'pref:color:textMuted'
        };
        const root = document.documentElement;
        let navAccentPref = null;
        for (const name in colorKeys) {
            if (!colorKeys.hasOwnProperty(name)) continue;
            let val = null;
            try { val = localStorage.getItem(colorKeys[name]); } catch { val = null; }
            // Sólo forzamos el color inline si el usuario lo personalizó. Aplicar
            // los defaults inline pisaba las variables del tema claro (los estilos
            // inline ganan a la hoja de estilos), dejando p. ej. --text-main en
            // blanco sobre fondos claros: texto invisible en todo el sitio,
            // incluido el desplegable de sugerencias del buscador. Sin preferencia
            // dejamos decidir al tema (claro/oscuro) del CSS.
            if (val) {
                root.style.setProperty(name, val);
                if (name === '--nav-accent') navAccentPref = val;
            }
        }
        if (navAccentPref) {
            root.style.setProperty('--nav-accent-soft', `${navAccentPref}3d`);
        }
    })();

    // ── Cards per row (localStorage → body class) ──
    (() => {
        try {
            const cpr = localStorage.getItem('pref:cardsPerRow');
            if (cpr && cpr !== 'auto') {
                const n = parseInt(cpr, 10);
                if (n >= (AnimeDestiny.Constants.CARDS_PER_ROW_MIN || 2) && n <= (AnimeDestiny.Constants.CARDS_PER_ROW_MAX || 8)) {
                    document.documentElement.style.setProperty('--cards-per-row', String(n));
                    document.body.classList.add('fixed-cards-row');
                }
            }
        } catch { /* no-op (prefs) */ }
    })();

    // ── RUN ──
    const installSecurityHandlers = () => {
        if (window.__adSecurityHandlersInstalled) return;
        window.__adSecurityHandlersInstalled = true;

        document.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            var rememberLink = target.closest('a[data-remember-catalog="1"]');
            if (rememberLink) {
                if (typeof window.rememberCatalogPosition === 'function') {
                    window.rememberCatalogPosition();
                }
                // Los items del "Más" desde un catálogo llevan ambos data-attrs:
                // como este `return` corta la rama de restore de más abajo, se
                // marca acá que al volver al catálogo hay que restaurar.
                if (rememberLink.getAttribute('data-restore-catalog') === '1') {
                    try { sessionStorage.setItem('shouldRestoreCatalog', '1'); } catch (_) {}
                }
                return;
            }

            var restoreLink = target.closest('a[data-restore-catalog="1"]');
            if (restoreLink) {
                try { sessionStorage.setItem('shouldRestoreCatalog', '1'); } catch (_) {}
                return;
            }

            var activityLink = target.closest('a[data-open-tab="actividad"]');
            if (activityLink) {
                event.preventDefault();
                var tab = document.querySelector('.sidebar-link[data-tab="actividad"]');
                if (tab) tab.click();
                return;
            }

            var closeResumen = target.closest('button[data-close-modal="resumen"]');
            if (closeResumen) {
                var modal = document.getElementById('resumenModal');
                if (modal) modal.style.display = 'none';
            }
        }, true);

        document.addEventListener('error', function (event) {
            var target = event.target;
            if (!(target instanceof HTMLImageElement)) return;

            if (target.dataset.fallbackCatalog === '1') {
                if (typeof window.fallbackCatalogImage === 'function') {
                    window.fallbackCatalogImage(target);
                }
                return;
            }

            if (target.dataset.avatarFallback === '1') {
                target.style.display = 'none';
                var sibling = target.nextElementSibling;
                if (sibling) sibling.style.display = 'flex';
            }
        }, true);
    };
    ensureMainTarget();
    injectNavBrand();
    injectNavLinks();
    wireNavMoreAutoClose();
    injectMobileBottomNav();
    injectLoginButton();
    injectFooter();
    installSecurityHandlers();

})();
