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
                    reject(new Error('AniList error: ' + (json.errors[0]?.message || 'Unknown')));
                    return;
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
        var mainCount = isAnime ? (item.episodes || 0) : (!isAnime ? (item.chapters || item.volumes || 0) : 0);

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
                    format: item.format || null
                });
                sequelEdges.forEach(function (edge) {
                    var node = edge.node;
                    var count = isAnime ? (node.episodes || 0) : (!isAnime ? (node.chapters || node.volumes || 0) : 0);
                    if (count > 0) {
                        seasons.push({
                            id: node.id,
                            episodes: count,
                            season: node.season || null,
                            seasonYear: node.seasonYear || null,
                            title: extractTitle(node.title) || 'Secuela',
                            format: node.format || null
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
            images: {
                webp: { large_image_url: image, image_url: image },
                jpg: { large_image_url: image, image_url: image }
            },
            genres: genres,
            themes: [],
            studios: (item.studios?.nodes || []).map(function (s) { return s.name; }),
            streamingEpisodes: [],
            relations: [],
            season: item.season || null,
            seasonYear: item.seasonYear || null,
            source: item.source || null,
            duration: item.duration || null,
            countryOfOrigin: item.countryOfOrigin || null,
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

    function buildDynamicQuery(opts) {
        var type = opts.type || 'ANIME';
        var isAnime = type === 'ANIME';
        var fields = isAnime
            ? 'id idMal title { romaji english } coverImage { extraLarge large } episodes status genres averageScore description type format season seasonYear source duration countryOfOrigin studios { nodes { name } }'
            : 'id idMal title { romaji english } coverImage { extraLarge large } chapters volumes status genres averageScore description type format countryOfOrigin source';

        // Build variable declarations
        var varDecls = ['$page: Int', '$perPage: Int'];
        var mediaArgs = ['type: ' + type, 'sort: POPULARITY_DESC'];

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

        return 'query (' + varDecls.join(', ') + ') { Page(page: $page, perPage: $perPage) { media(' + mediaArgs.join(', ') + ') { ' + fields + ' } } }';
    }

    var MEDIA_BY_ID_QUERY = `
        query ($id: Int) {
            Media(id: $id) {
                id idMal title { romaji english } coverImage { extraLarge large }
                episodes chapters volumes status genres averageScore description type format
                season seasonYear source duration countryOfOrigin
                studios { nodes { name } }
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

    function _pruneOldCache() {
        // Remove expired localStorage entries to avoid quota overflow
        var toRemove = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    try {
                        var p = JSON.parse(localStorage.getItem(k));
                        if (Date.now() > p.expiry) toRemove.push(k);
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
            if (Date.now() > parsed.expiry) {
                localStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }
            // Promote to L1
            _memCache.set(key, parsed);
            return parsed.data;
        } catch (e) { return null; }
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
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult);
        var cacheKey = 'topAnimes_p' + (page || 1) + (hasFilters ? '_f' + JSON.stringify(filters) : '');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
            var query = buildDynamicQuery({
                type: 'ANIME',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']
            });
            var vars = { page: page || 1, perPage: PER_PAGE };
            if (filters.search) vars.search = filters.search;
            if (split.genres.length) vars.genre_in = split.genres;
            if (split.tags.length) vars.tag_in = split.tags;

            var json = await anilistFetch(query, vars);
            var media = json?.data?.Page?.media || [];
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'anime'); });
            if (mapped.length) setApiCache(cacheKey, mapped, hasFilters ? 300000 : 3600000);
            return mapped;
        } catch (err) {
            console.warn('AniList getTopAnimes error:', err);
            return [];
        }
    };

    window.getTopMangas = async function (page, filters) {
        filters = filters || {};
        var split = splitGenresAndTags(filters.genres);
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult);
        var cacheKey = 'topMangas_mix_p' + (page || 1) + (hasFilters ? '_f' + JSON.stringify(filters) : '');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
            var perPage = Math.floor(PER_PAGE / 3) || 13;
            var baseOpts = {
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false
            };
            var baseVars = {};
            if (filters.search) baseVars.search = filters.search;
            if (split.genres.length) baseVars.genre_in = split.genres;
            if (split.tags.length) baseVars.tag_in = split.tags;

            var qManga = buildDynamicQuery(Object.assign({}, baseOpts, { formatIn: ['MANGA', 'ONE_SHOT'], countryOfOrigin: 'JP' }));
            var qManhwa = buildDynamicQuery(Object.assign({}, baseOpts, { formatIn: ['MANGA', 'ONE_SHOT'], countryOfOrigin: 'KR' }));
            var qDoujin = buildDynamicQuery(Object.assign({}, baseOpts, { source: 'DOUJINSHI' }));

            var pg = page || 1;
            var [resManga, resManhwa, resDoujinshi] = await Promise.all([
                anilistFetch(qManga, Object.assign({ page: pg, perPage: perPage }, baseVars)),
                anilistFetch(qManhwa, Object.assign({ page: pg, perPage: perPage }, baseVars)),
                anilistFetch(qDoujin, Object.assign({ page: pg, perPage: perPage }, baseVars))
            ]);
            var mediaManga = resManga?.data?.Page?.media || [];
            var mediaManhwa = resManhwa?.data?.Page?.media || [];
            var mediaDoujin = resDoujinshi?.data?.Page?.media || [];
            
            var media = [];
            var seenIds = new Set();
            var maxLen = Math.max(mediaManga.length, mediaManhwa.length, mediaDoujin.length);
            for (var i = 0; i < maxLen; i++) {
                [mediaManga[i], mediaManhwa[i], mediaDoujin[i]].forEach(function(m) {
                    if (m && !seenIds.has(m.id)) { seenIds.add(m.id); media.push(m); }
                });
            }
            
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'manga'); });
            if (mapped.length) setApiCache(cacheKey, mapped, hasFilters ? 300000 : 3600000);
            return mapped;
        } catch (err) {
            console.warn('AniList getTopMangas error:', err);
            return [];
        }
    };

    window.getTopNovelas = async function (page, filters) {
        filters = filters || {};
        var split = splitGenresAndTags(filters.genres);
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult);
        var cacheKey = 'topNovelas_p' + (page || 1) + (hasFilters ? '_f' + JSON.stringify(filters) : '');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
            var query = buildDynamicQuery({
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['NOVEL']
            });
            var vars = { page: page || 1, perPage: PER_PAGE };
            if (filters.search) vars.search = filters.search;
            if (split.genres.length) vars.genre_in = split.genres;
            if (split.tags.length) vars.tag_in = split.tags;

            var json = await anilistFetch(query, vars);
            var media = json?.data?.Page?.media || [];
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'novelas'); });
            if (mapped.length) setApiCache(cacheKey, mapped, hasFilters ? 300000 : 3600000);
            return mapped;
        } catch (err) {
            console.warn('AniList getTopNovelas error:', err);
            return [];
        }
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

})();
