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

        if (isAnime && /^(WINTER|SPRING|SUMMER|FALL)$/.test(String(opts.season || '')) && Number(opts.seasonYear) > 1950) {
            mediaArgs.push('season: ' + opts.season);
            mediaArgs.push('seasonYear: ' + Number(opts.seasonYear));
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
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse);
        var cacheKey = 'topAnimes_p' + (page || 1) + (hasFilters ? '_f' + stableStringify(filters) : '');

        return fetchCached(cacheKey, hasFilters ? 300000 : 3600000, async function () {
            // Con búsqueda de texto ignoramos el modo de descubrimiento: ordenar
            // por relevancia (SEARCH_MATCH) y NO limitar por temporada/tendencia,
            // que dejaban fuera títulos válidos (p. ej. buscar "Dxd" con
            // "Temporada actual" activo devolvía cero resultados).
            var animeSortOpts = filters.search ? { sort: 'SEARCH_MATCH' } : browseToQueryOpts(browse, true);
            var query = buildDynamicQuery(Object.assign({
                type: 'ANIME',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']
            }, animeSortOpts));
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
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse);
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

            // Supplement with MangaDex
            var mdTagUuids = window.mdTagUuidsFromKeys(filters.genres);
            if (mdTagUuids.length || filters.search) {
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
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse);
        var cacheKey = 'novonly_p' + (page || 1) + (hasFilters ? '_f' + stableStringify(filters) : '');

        return fetchCached(cacheKey, hasFilters ? 300000 : 3600000, async function () {
            // Ver getTopAnimes: al buscar por texto priorizamos relevancia y no
            // restringimos por modo de descubrimiento.
            var novelaSortOpts = filters.search ? { sort: 'SEARCH_MATCH' } : browseToQueryOpts(browse, false);
            var query = buildDynamicQuery(Object.assign({
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['NOVEL']
            }, novelaSortOpts));
            var vars = { page: page || 1, perPage: PER_PAGE };
            if (filters.search) vars.search = filters.search;
            if (split.genres.length) vars.genre_in = split.genres;
            if (split.tags.length) vars.tag_in = split.tags;

            var json = await anilistFetch(query, vars);
            var media = json?.data?.Page?.media || [];
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'novelas'); });

            // Supplement with MangaDex
            var mdTagUuids = window.mdTagUuidsFromKeys(filters.genres);
            if (mdTagUuids.length || filters.search) {
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

})();
