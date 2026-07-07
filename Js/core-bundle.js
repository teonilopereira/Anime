/* === Anime Destiny Core Bundle === */

/* ========================================== */
/* === FILE: js/core/config.js === */
/* ========================================== */

// ⚠️  ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR MANUALMENTE
// Generado por: tools/generate-config.js
// Fuente:       .env  (excluido de Git)
// Este archivo también está excluido de Git via .gitignore

(function (window) {
    "use strict";

    const config = {
        supabaseUrl:     "https://llytokoztnjuczuppzgs.supabase.co",
        supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxseXRva296dG5qdWN6dXBwemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTE2MTcsImV4cCI6MjA5NTU4NzYxN30.jKU5ZoweR3v5TPyn_4TNs6W01Cns3xEZOkleZGg1UNg",
        defaultPageSize: 40,
        maxCatalogItems: 40,
        debug:           false,
        cachePrefix:     "animeDestiny"
    };

    window.AppConfig = Object.freeze(config);
})(window);


/* ========================================== */
/* === FILE: js/core/i18n.js === */
/* ========================================== */

(function () {
    "use strict";

    var translations = {
        es: {
            "nav.inicio": "Inicio",
            "nav.anime": "Anime",
            "nav.manga": "Manga",
            "nav.novelas": "Novelas",
            "nav.comparar": "Comparar",
            "nav.top": "Top",
            "nav.mis_listas": "Mis Listas",
            "nav.configuracion": "Configuración",
            "nav.cuenta": "Cuenta",
            "nav.ingresar": "Ingresar",
            "nav.perfil": "Perfil",
            "nav.cerrar_sesion": "Cerrar Sesión",

            "catalog.buscar": "Buscar...",
            "catalog.sin_resultados": "No se encontraron resultados.",
            "catalog.cargando": "Cargando...",
            "catalog.error": "Error al cargar el catálogo.",
            "catalog.continuar_viendo": "Continuar viendo",
            "catalog.favoritos": "Favoritos",
            "catalog.vistos": "Vistos",
            "catalog.filtrar_estado": "Filtrar por estado",

            "detail.cargando": "Buscando detalle en la API...",
            "detail.no_encontrado": "No se encontró este título.",
            "detail.sin_sinopsis": "Sin sinopsis disponible.",
            "detail.sinopsis": "SINOPSIS",
            "detail.generos": "GÉNEROS",
            "detail.capitulos": "CAPÍTULOS",
            "detail.episodios": "EPISODIOS",
            "detail.volumenes": "VOLÚMENES",
            "detail.estado": "Estado",
            "detail.puntaje": "Puntaje",
            "detail.sin_capitulos": "Sin capítulos especificados en la API.",
            "detail.progreso_general": "PROGRESO GENERAL",
            "detail.completados": "{vistos}/{total} completados",
            "detail.volver": "Volver al catálogo",
            "detail.compartir": "Compartir con conocidos o amigos",
            "detail.favorito": "Agregar a favoritos",
            "detail.marcar_visto": "Marcar como visto",
            "detail.ver_mas": "Ver más",

            "rank.cargando": "Cargando ranking...",
            "rank.cargar_mas": "Cargar más",
            "rank.no_resultados": "Sin resultados.",

            "lists.cargando": "Cargando tus listas...",
            "lists.titulo": "MIS LISTAS",
            "lists.subtitulo": "Tus \"Me gusta\" y \"Vistos\" separados por categoría.",
            "lists.vacio": "No tenés elementos en esta categoría.",

            "login.titulo": "Iniciar Sesión",
            "login.usuario": "Nombre de usuario",
            "login.email": "Correo electrónico",
            "login.contrasena": "Contraseña",
            "login.ingresar": "Ingresar",
            "login.crear": "Crear Cuenta",
            "login.google": "Continuar con Google",
            "login.cerrar": "Cerrar",

            "config.titulo": "Configuración",
            "config.fondo": "Fondo",
            "config.color": "Color de fondo",
            "config.imagen": "Imagen de fondo",
            "config.idioma": "Idioma",
            "config.guardado": "Configuración guardada.",

            "user.perfil": "Perfil",
            "user.puntos": "Puntos",
            "user.nivel": "Nivel",
            "user.vistos": "Vistos",
            "user.favoritos": "Favoritos",

            "state.visto": "Visto",
            "state.favorito": "Favorito",
            "state.pendiente": "Pendiente",

            "error.generico": "Algo salió mal. Intentá de nuevo en unos minutos.",
            "error.conexion": "Sin conexión al servidor. Revisá tu internet.",
            "error.no_encontrado": "No encontrado.",
            "error.sesion_expirada": "Sesión expirada. Tus cambios se guardaron y se sincronizarán al reconectar.",
            "error.volver_inicio": "Volver al inicio",

            "general.cargando": "Cargando...",
            "general.guardando": "Guardando...",
            "general.hecho": "Hecho",
            "general.cancelar": "Cancelar",
            "general.cerrar": "Cerrar"
        },
        en: {}
    };

    function resolveKey(obj, key) {
        var parts = key.split(".");
        var current = obj;
        for (var i = 0; i < parts.length && current != null; i++) {
            current = current[parts[i]];
        }
        return current != null ? current : null;
    }

    function interpolate(text, args) {
        if (!args) return text;
        return text.replace(/\{(\w+)\}/g, function (_, k) {
            return args[k] != null ? String(args[k]) : _;
        });
    }

    window.applyTranslations = function (lang) {
        lang = lang || localStorage.getItem("pref:lang") || "es";
        var dict = translations[lang];
        if (!dict) {
            if (lang !== "es") { window.applyTranslations("es"); return; }
            return;
        }

        var elements = document.querySelectorAll("[data-i18n]");
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var key = el.getAttribute("data-i18n");
            if (!key) continue;

            var value = resolveKey(dict, key);
            if (value == null) value = "[missing: " + key + "]";

            var argsAttr = el.getAttribute("data-i18n-args");
            var args = null;
            if (argsAttr) { try { args = JSON.parse(argsAttr); } catch (e) { args = null; } }

            var text = interpolate(value, args);
            var attrList = el.getAttribute("data-i18n-attr");

            if (attrList) {
                var attrs = attrList.split(",");
                for (var j = 0; j < attrs.length; j++) {
                    var attr = attrs[j].trim();
                    if (attr) el.setAttribute(attr, text);
                }
            } else {
                el.textContent = text;
            }
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { window.applyTranslations(); });
    } else {
        window.applyTranslations();
    }
})();


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
        MODAL_CLOSE_LONG_DELAY_MS: 2500
    };
    window.AnimeDestiny = window.AnimeDestiny || {};
    window.AnimeDestiny.Constants = C;
})();



/* ========================================== */
/* === FILE: js/core/namespace.js === */
/* ========================================== */

(function () {
    var AD = window.AnimeDestiny = window.AnimeDestiny || {};
    AD.internals = AD.internals || {};
    AD.Constants = AD.Constants || {};
    AD.config = window.AppConfig || {};

    AD.migrate = function (source, target, keys) {
        if (!source || !target) return;
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k in source) target[k] = source[k];
        }
    };

    AD.reportError = function (namespace, message, data) {
        var prefix = '[AnimeDestiny:' + namespace + ']';
        if (data) {
            console.warn(prefix, message, data);
        } else {
            console.warn(prefix, message);
        }
    };
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


/* ========================================== */
/* === FILE: js/datos.js === */
/* ========================================== */

window.DATOS_WEB = { manga: [], anime: [], novelas: [] };

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
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === 'http:' ||
                parsed.protocol === 'https:' ||
                (parsed.protocol === 'data:' && /^data:image\//i.test(url))
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
    const fn = window['getTop' + _capitalize(categoria)];
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

document.dispatchEvent(new CustomEvent('datosCargados'));



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

        key(index)      { var keys = Array.from(this._data.keys()); return keys[index] || null; }
        get length()    { return this._data.size; }
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
/* === FILE: js/core/data-sync.js === */
/* ========================================== */

(() => {
    "use strict";

    let pendingSync = null;
    let changedItems = {};

    const scheduleSync = (itemId) => {
        changedItems[itemId] = true;
        if (pendingSync) return;
        pendingSync = setTimeout(flushSync, AnimeDestiny.Constants.SYNC_DEBOUNCE_MS || 250);
    };

    const flushSync = () => {
        pendingSync = null;

        const username = getUsername();
        if (!username || username === "Invitado") {
            // Auth aún no listo — reintentar cuando llegue la sesión
            const onReady = () => {
                window.removeEventListener('supabase-auth-changed', onReady);
                flushSync();
            };
            window.addEventListener('supabase-auth-changed', onReady, { once: true });
            return;
        }

        const fn = window.syncItemStateToSupabase;
        if (typeof fn !== "function") {
            pendingSync = setTimeout(flushSync, AnimeDestiny.Constants.SYNC_DEBOUNCE_MS || 250);
            return;
        }

        const ids = Object.keys(changedItems);
        if (!ids.length) return;
        changedItems = {};

        const metaPrefix = `u:${username}|itemMeta:`;
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const fav = window.UserStore.getItem(`u:${username}|item:${id}|fav`) === "1";
            const viewed = window.UserStore.getItem(`u:${username}|item:${id}|viewed`) === "1";

            const metaRaw = window.UserStore.getItem(`${metaPrefix}${id}`);
            let meta = {};
            try { if (metaRaw) meta = JSON.parse(metaRaw); } catch { console.warn('data-sync: invalid meta JSON for', id); }

            fn(meta.__category || guessCategory(), String(id), fav, viewed, meta);
        }
    };

    const getUsername = () => {
        const user = window.AppSupabase?.getCurrentUserSync?.() || null;
        if (!user) return "Invitado";
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split("@")[0] : "") ||
            user.id ||
            "Invitado"
        );
    };

    const guessCategory = () => {
        const path = String(window.location.pathname || "").toLowerCase();
        if (path.includes("anime")) return "anime";
        if (path.includes("manga")) return "manga";
        if (path.includes("novelas")) return "novelas";
        return document.body.getAttribute("data-page") || "unknown";
    };

    // ─── Exportar scheduleSync para uso externo ──────────────────
    window.__dataSyncSchedule = AnimeDestiny.internals.__dataSyncSchedule = scheduleSync;

})();


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
        if (nameEl && btnEl && avatarEl) {
            if (user) {
                nameEl.textContent = username;
                btnEl.textContent = 'Cuenta';
                btnEl.href = 'usuario.html';
                btnEl.setAttribute('aria-label', 'Ver perfil de ' + username);
                const photoUrl = photoUrlFromProfile(user, profile);
                if (photoUrl && safeUrl(photoUrl)) {
                    avatarEl.classList.add('has-image');
                    avatarEl.style.backgroundImage = 'url("' + photoUrl.replace(/[\\"()]/g, '') + '")';
                } else {
                    avatarEl.classList.remove('has-image');
                    avatarEl.style.removeProperty('background-image');
                }
            } else {
                nameEl.textContent = 'Invitado';
                btnEl.textContent = 'Ingresar';
                btnEl.href = 'Login.html';
                btnEl.setAttribute('aria-label', 'Iniciar sesión');
                avatarEl.classList.remove('has-image');
                avatarEl.style.removeProperty('background-image');
            }
        }
    }
    function openUserModal() {
        const modal = document.getElementById("userModal");
        const input = document.getElementById("userNameInput");
        if (!modal || !input) return;
        input.value = "";
        document.getElementById("userEmailInput")?.value && (document.getElementById("userEmailInput").value = "");
        document.getElementById("userPassInput")?.value && (document.getElementById("userPassInput").value = "");
        setMsg("");
        modal.classList.add("is-open");
        input.focus();
    }

    function closeUserModal() {
        document.getElementById("userModal")?.classList.remove("is-open");
    }

    function isValidGmailAddress(value) {
        return /^[^\s@]+@gmail\.com$/i.test(String(value || "").trim());
    }

    // ─────────────────────────────────────────────
    // Autenticación — solo Supabase
    // ─────────────────────────────────────────────

    async function signInWithGoogle() {
        setMsg("Abriendo Google...");
        const client = await waitForSupabase();
        if (!client?.signInWithGoogle) {
            setMsg("Supabase todavía no está listo. Intentá de nuevo.");
            return;
        }
        try {
            await client.signInWithGoogle();
            // La sesión llega via onAuthStateChange; el modal se cierra solo.
        } catch (err) {
            console.error(err);
            setMsg("No se pudo iniciar sesión con Google.");
        }
    }

    async function loginWithPassword(mode) {
        const username  = String(document.getElementById("userNameInput")?.value  || "").trim();
        const email     = String(document.getElementById("userEmailInput")?.value || "").trim();
        const password  = String(document.getElementById("userPassInput")?.value  || "");

        // El campo "usuario" puede contener un email en modo login
        const loginEmail = email || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(username) ? username : "");

        // — Validaciones —
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
            // ── REGISTRO ─────────────────────────────────────────────
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
                        setMsg("Error al crear cuenta: " + error.message);
                    }
                    return;
                }

                if (data?.user && !data?.session) {
                    setMsg("✅ Cuenta creada. Revisá tu correo para confirmarla.");
                    window.setTimeout(closeUserModal, 2500);
                    return;
                }

                // Sesión activa inmediata (email confirmation desactivado en Supabase)
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

        // ── INICIO DE SESIÓN ─────────────────────────────────────────
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
                    setMsg("Error al iniciar sesión: " + error.message);
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
    // Escuchar cambios de sesión de Supabase
    // ─────────────────────────────────────────────

    // Evento disparado por supabase-config.js
    window.addEventListener("supabase-auth-changed", () => {
        refreshUserUi();
        if (window.AppSupabase && !window.AppSupabase.isSignedIn()) {
            if (window.UserStore) window.UserStore.clear();
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

    // Ejecución segura al cargar el DOM
    document.addEventListener('DOMContentLoaded', async () => {
        ensureUserUi();       // Crea el estado de carga neutro (...)
        await refreshUserUi(); // Espera a Supabase y pinta el usuario correcto o el botón de cuenta
    });

})(window, document);





/* ========================================== */
/* === FILE: js/core/storage.js === */
/* ========================================== */

/**
 * storage.js
 * AppStorage — wrapper en memoria sobre UserStore.
 * No persiste nada en localStorage; Supabase es la única fuente de verdad.
 */
(function (window) {
    "use strict";

    function read(key, fallback = null) {
        const value = window.UserStore?.getItem(key) ?? null;
        return value === null ? fallback : value;
    }

    function write(key, value) {
        try {
            window.UserStore?.setItem(key, String(value));
            return true;
        } catch {
            return false;
        }
    }

    function readJson(key, fallback = null) {
        const value = window.UserStore?.getItem(key) ?? null;
        if (value === null) return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            window.UserStore?.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    function remove(key) {
        try {
            window.UserStore?.removeItem(key);
            return true;
        } catch {
            return false;
        }
    }

    window.AppStorage = Object.freeze({
        read,
        write,
        readJson,
        writeJson,
        remove
    });
})(window);


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

    function stripTags(value) {
        const template = document.createElement("template");
        template.innerHTML = String(value ?? "");
        return template.content.textContent || "";
    }

    function sanitizeText(value) {
        return escapeHtml(stripTags(value)).trim();
    }

    function safeUrl(value) {
        if (!value) return "";
        var url = String(value).trim();
        // Permitir rutas relativas locales y data URIs de imagen usadas como fallback.
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === "http:" ||
                parsed.protocol === "https:" ||
                (parsed.protocol === "data:" && /^data:image\//i.test(url))
            ) {
                return url;
            }
        } catch (_) { }
        return "";
    }

    window.AppSanitizer = Object.freeze({
        escapeHtml,
        stripTags,
        sanitizeText,
        safeUrl
    });

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
        const safeTitle = String(title || 'Sin título').slice(0, 40);
        const safeSubtitle = String(subtitle || '').slice(0, 45);
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
                <text x="300" y="230" text-anchor="middle" fill="#00f2ff" font-size="44" font-family="Orbitron, Arial, sans-serif" font-weight="700">${safeTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
                ${safeSubtitle ? `<text x="300" y="290" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Rajdhani, Arial, sans-serif">${safeSubtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>` : ''}
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
        formatDate,
        truncateText,
        parseUrlParams,
        normalizeText,
        escapeHtml: function (v) { return window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''); },
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
    window.fallbackCatalogImage = fallbackCatalogImage;
    window.episodeStorageKey = episodeStorageKey;
    window.volumeStorageKey = volumeStorageKey;
})(window);


/* ========================================== */
/* === FILE: js/ui.js === */
/* ========================================== */

(function (window, document) {
    "use strict";

    function showElement(element) {
        if (element) element.hidden = false;
    }

    function hideElement(element) {
        if (element) element.hidden = true;
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.display = "flex";
        modal.removeAttribute("hidden");
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.display = "none";
        modal.setAttribute("hidden", "");
    }

    function setLoading(element, isLoading, text = "Cargando...") {
        if (!element) return;
        element.setAttribute("aria-busy", isLoading ? "true" : "false");
        if (isLoading) element.dataset.loadingText = text;
    }

    // Cargar dinámicamente estilos y script de Toasts
    (function initToasts() {
        if (typeof document !== "undefined" && !document.getElementById("toast-styles-link")) {
            const link = document.createElement("link");
            link.id = "toast-styles-link";
            link.rel = "stylesheet";
            link.href = "css/toast.css";
            document.head.appendChild(link);
            
            const script = document.createElement("script");
            script.src = "js/ui/toast.js";
            document.head.appendChild(script);
        }
    })();

    window.AppUI = Object.freeze({
        showElement,
        hideElement,
        openModal,
        closeModal,
        setLoading
    });
})(window, document);


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
        catch { return []; }
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

    function syncItemStateToSupabase(category, itemId, fav, viewed, meta = {}) {
        const client = window.AppSupabase;
        if (!client?.saveItemState) {
            enqueueSync({ type: "item_state", payload: { category, itemId, fav, viewed, meta } });
            return;
        }
        client.saveItemState({ category, itemId, fav, viewed, meta }).catch((error) => {
            if (isSessionExpired(error)) showSyncToast('Sesión expirada. Tu progreso se guardó y se sincronizará al reconectar.', 'session-expired');
            console.warn('No se pudo sincronizar estado a Supabase:', error);
            enqueueSync({ type: "item_state", payload: { category, itemId, fav, viewed, meta } });
        });
    }

    function addUserPoints(userId, delta) {
        if (!userId || userId === 'Invitado') return;
        const next = Math.max(0, getUserPoints(userId) + delta);
        UserStore.setItem(pointsKey(userId), String(next));
        const client = window.AppSupabase;
        if (!client?.addExperience) {
            enqueueSync({ type: "experience", payload: { delta } });
            return;
        }
        client.addExperience(delta).catch((error) => {
            if (isSessionExpired(error)) showSyncToast('Sesión expirada. La experiencia se sincronizará al reconectar.', 'session-expired');
            enqueueSync({ type: "experience", payload: { delta } });
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
        let level = 1;
        let need = AnimeDestiny.Constants.XP_BASE || 100;
        let remaining = p;
        while (remaining >= need) {
            remaining -= need;
            level += 1;
            need = Math.floor(need * (AnimeDestiny.Constants.XP_MULTIPLIER || 1.2));
            if (level > (AnimeDestiny.Constants.XP_MAX_LEVEL || 50)) break;
        }
        return { level, current: remaining, next: need };
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
        } catch {
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
        } catch (_) {}
        return { fav, viewed };
    }

    function countUserStates(userId, type) {
        const counts = countUserStatesBoth(userId);
        return type === 'fav' ? counts.fav : counts.viewed;
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

        const detail = (typeof obtenerDetalleItem === 'function')
            ? obtenerDetalleItem(category, item?.id)
            : null;

        if (detail) {
            parts.push(
                detail.estudio,
                detail.desarrollador,
                detail.editor,
                detail.plataforma,
                detail.resumen
            );
            if (Array.isArray(detail.temporadas)) {
                detail.temporadas.forEach((season) => {
                    parts.push(season?.nombre, season?.episodios);
                });
            }
            if (Array.isArray(detail.franquicia)) {
                parts.push(...detail.franquicia);
            }
            if (category === 'manga' || category === 'novelas') parts.push(detail.volumenes);
        }

        return parts
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
            .join(' ');
    }

    function getProgressPercentForItem(userId, category, itemId) {
        try {
            const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
            if (viewed) return 100;
            const det = (typeof obtenerDetalleItem === 'function')
                ? obtenerDetalleItem(category, itemId)
                : null;

            if (category === 'manga' || category === 'novelas') {
                const vols = Number(det?.volumenes || 0);
                const total = Number.isFinite(vols) ? vols : 0;
                if (!total) return 0;
                const prefix = category === 'novelas' ? 'novela' : 'manga';
                const read = countKeysWithPrefix(`u:${userId}|${prefix}:${itemId}|vol:`);
                return Math.min(100, Math.round((read / total) * 100));
            }
            if (category === 'anime') {
                const temporadas = Array.isArray(det?.temporadas) ? det.temporadas : [];
                const total = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
                if (!total) return 0;
                const watched = countKeysWithPrefix(`u:${userId}|anime:${itemId}|s:`);
                return Math.min(100, Math.round((watched / total) * 100));
            }
        } catch {
            // ignore
        }
        return null;
    }

    function updateCardProgressIndicators() {
        const mainContainer = document.getElementById('main-container');
        if (!mainContainer) return;
        const category = document.body.getAttribute('data-page') || '';
        const userId = getCurrentUserId();
        const cards = mainContainer.querySelectorAll('.card-container[data-item-id]');

        cards.forEach((card) => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;
            const progressBox = card.querySelector('[data-progress]');
            if (!progressBox) return;

            const meta = resolveCatalogProgress(userId, String(category), String(itemId), card);

            if (!meta.show) {
                progressBox.style.display = 'none';
                return;
            }

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

            progressBox.style.display = '';
        });
    }

    function toggleStatus(btn, type, itemId) {
        const userId = getCurrentUserId();
        if (userId === 'Invitado') {
            window.location.href = 'Login.html';
            return;
        }

        const storageKey = statusStorageKey(userId, itemId, type);

        const enabled = !UserStore.getItem(storageKey);
        if (enabled) {
            UserStore.setItem(storageKey, '1');
            if (typeof window._invalidateProgressIndex === 'function') window._invalidateProgressIndex();
            addUserPoints(userId, type === 'viewed' ? (AnimeDestiny.Constants.XP_VIEWED || 10) : (AnimeDestiny.Constants.XP_FAV || 5));
            if (window.Toast) {
                if (type === 'fav') window.Toast.success("¡Agregado a Favoritos! ❤️");
                if (type === 'viewed') window.Toast.success("¡Marcado como Visto! 👁️ (+10 EXP)");
            }
        } else {
            UserStore.removeItem(storageKey);
            if (window.Toast) {
                if (type === 'fav') window.Toast.info("Quitado de Favoritos");
                if (type === 'viewed') window.Toast.info("Marcado como no visto");
            }
        }

        btn.classList.toggle('active', enabled);
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');

        UserStore.setItem(`u:${userId}|item:${itemId}|ts`, new Date().toISOString());

        const card = btn.closest('.card-container') || btn.closest('[data-item-id]');
        const completeInput = card?.querySelector('.card-complete-input');
        if (completeInput && type === 'viewed') {
            completeInput.checked = enabled;
        }

        const metaKey = `u:${userId}|itemMeta:${itemId}`;

        if (card && userId !== 'Invitado') {
            const fav = !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav'));
            const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
            const category = card.getAttribute('data-category') || getCategoriaActual() || 'listas';
            const img = card.getAttribute('data-img') || card.querySelector('img')?.getAttribute('src') || '';
            const titulo = card.getAttribute('data-title') || card.querySelector('.catalog-card-title, .card-back-title')?.textContent || itemId;
            const info = card.getAttribute('data-genres') || card.getAttribute('data-search-index') || '';

            if (fav || viewed) {
                var total = card.getAttribute('data-total') || '0';
                UserStore.setItem(metaKey, JSON.stringify({
                    id: String(itemId),
                    titulo: String(titulo).trim(),
                    img,
                    info,
                    total: Number(total),
                    __category: String(category)
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
            metaObj
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
        } catch (_) {}
        cards.forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;
            const isFav    = favSet.has(itemId);
            const isViewed = viewedSet.has(itemId);
            const favBtn     = card.querySelector('.fav-btn');
            const viewedBtn  = card.querySelector('.viewed-btn');
            if (favBtn)    favBtn.classList.toggle('active', isFav);
            if (viewedBtn) viewedBtn.classList.toggle('active', isViewed);
            const completeInput = card.querySelector('.card-complete-input');
            if (completeInput) completeInput.checked = isViewed;
        });
        updateCardProgressIndicators();
    }

    function syncStatesFromSupabase(category, userId, cards) {
        const client = window.AppSupabase;
        if (!client?.loadItemStates || !client?.isSignedIn?.()) return;
        client.loadItemStates('').then((states) => {
            if (!Array.isArray(states)) return;
            states.forEach((state) => {
                const key = state.item_id;
                if (!key) return;
                if (state.fav)    UserStore.setItem(statusStorageKey(userId, key, 'fav'), '1');
                if (state.viewed) UserStore.setItem(statusStorageKey(userId, key, 'viewed'), '1');
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
        } catch (_) {}

        cards.forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;

            const isFav    = favSet.has(itemId);
            const isViewed = viewedSet.has(itemId);

            const favBtn  = card.querySelector('.fav-btn');
            const viewedBtn = card.querySelector('.viewed-btn');
            if (favBtn)    favBtn.classList.toggle('active', isFav);
            if (viewedBtn) viewedBtn.classList.toggle('active', isViewed);

            const completeInput = card.querySelector('.card-complete-input');
            if (completeInput) completeInput.checked = isViewed;
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

        document.addEventListener('change', function (e) {
            var input = e.target;
            if (!input.classList.contains('card-complete-input')) return;
            var itemId = input.getAttribute('data-item-id');
            if (!itemId) return;
            if (typeof window.toggleCardComplete === 'function') {
                window.toggleCardComplete(input, itemId);
            }
        });
    })();

    // Exports
    window.addUserPoints = addUserPoints;
    window.cargarEstadosBotones = cargarEstadosBotones;
    window.toggleStatus = toggleStatus;
    window.getUserStateSummary = getUserStateSummary;
    window.buildSearchIndexForItem = buildSearchIndexForItem;
    window.getCategoriaActual = getCategoriaActual;
    window.statusStorageKey = statusStorageKey;
    window.applyUserPreferences = applyUserPreferences;
    window.applyBackgroundPreference = applyBackgroundPreference;
    window.updateCardProgressIndicators = updateCardProgressIndicators;
    window.getUserPoints = getUserPoints;
    window.levelFromPoints = levelFromPoints;
    window.pointsKey = pointsKey;

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
    const parts = [typeLabel, item?.volumes ? `${item.volumes} vol.` : '', item?.status].filter(Boolean);
    if (categoria === 'novelas') return parts.join(' / ') || 'Novela';
    return parts.join(' / ') || 'Manga';
}


function normalizeCatalogGenre(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();
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





function getCatalogProgressPrefix(categoria) {
    if (categoria === 'anime') return 'EP';
    if (categoria === 'manga' || categoria === 'novelas') return 'VOL';
    return 'VOL';
}


function buildCatalogBackProgressHtml(categoria, total) {
    const prefix = getCatalogProgressPrefix(categoria);
    const label = categoria === 'anime' ? 'capítulos' : 'volúmenes';
    const safeTotal = Number(total) > 0 ? Number(total) : 0;
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
    } catch (_) {}
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

    if (!dataTotal) {
        const legacyPct = getProgressPercentForItem(userId, category, itemId);
        if (legacyPct === null) return { show: false };
        return { show: true, pct: legacyPct, watched: 0, total: 0, label };
    }

    const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
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
        progressTotal = 0
    } = options;

    const flipId = `flip-${id}`;
    const safeId = escapeHtml(String(id));
    const detailBtn = showDetail
        ? `<a class="details-btn card-back-detail-btn" href="${escapeHtml(detailUrl)}" data-remember-catalog="1">DETALLE</a>`
        : '';
    const statusHtml = status
        ? `<span class="card-back-status-badge">${escapeHtml(status)}</span>`
        : '';
    const genresAttr = genres ? ` data-genres="${escapeHtml(genres)}"` : '';
    const genresNormAttr = genresNorm ? ` data-genres-norm="${escapeHtml(genresNorm)}"` : '';
    const totalAttr = progressTotal > 0 ? ` data-total="${progressTotal}"` : '';

    var safeImg = safeUrl(image);
    return `
    <div class="card-container catalog-neon-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}" data-img="${escapeHtml(safeImg)}" data-search-index="${escapeHtml(searchIndex)}"${totalAttr}${genresAttr}${genresNormAttr}>
        <input class="flip-toggle" type="checkbox" id="${flipId}">
        <div class="catalog-card-shell">
            <div class="catalog-card-inner">
                <div class="catalog-card-media">
                    <div class="card-inner">
                        <div class="card-front">
                            <div class="catalog-card-poster">
                                <img src="${escapeHtml(safeImg)}" alt="${escapeHtml(title)}" loading="lazy"${imageExtraAttrs}>
                            </div>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${escapeHtml(title)}</h2>
                            <div class="card-back-buttons-stack">
                                ${detailBtn}
                                ${statusHtml}
                            </div>
                            <div class="card-back-actions">
                                <button class="action-btn fav-btn" type="button" aria-label="Favorito" data-item-id="${safeId}" data-action="fav">❤</button>
                                <button class="action-btn viewed-btn" type="button" aria-label="Visto" data-item-id="${safeId}" data-action="viewed">👁</button>
                            </div>
                            ${buildCatalogBackProgressHtml(categoria, progressTotal)}
                        </div>
                    </div>
                </div>
                <div class="catalog-card-bar">
                    <span class="catalog-card-title">${escapeHtml(title)}</span>
                    <label class="catalog-card-flip-btn" for="${flipId}" aria-label="Ver información de ${escapeHtml(title)}" title="Ver info">
                        ${CATALOG_FLIP_ICON_SVG}
                    </label>
                </div>
            </div>
        </div>
    </div>`;
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

    try {
        const timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('Timeout')); }, AnimeDestiny.Constants.API_TIMEOUT_MS || 15000);
        });
        const listaItems = await Promise.race([getTopItems(page, filters), timeoutPromise]);
        const items = Array.isArray(listaItems) ? listaItems.slice(0, AnimeDestiny.Constants.PER_PAGE || 40) : [];

        if (!append) {
            window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = items.map((item) => ({
                item: {
                    id: item.id ?? item.mal_id,
                    titulo: item.title,
                    info: getApiCatalogInfo(categoria, item)
                },
                searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
            }));
        } else {
            const existing = window.__catalogSearchItems || [];
            const existingIds = new Set(existing.map(function (e) { return String(e.item.id); }));
            const newItems = items.filter(function (item) { return !existingIds.has(String(item.id ?? item.mal_id)); });
            newItems.forEach(function (item) {
                existing.push({
                    item: {
                        id: item.id ?? item.mal_id,
                        titulo: item.title,
                        info: getApiCatalogInfo(categoria, item)
                    },
                    searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                });
            });
        }

        if (!items.length) {
            if (!append) {
                mainContainer.innerHTML = `
                    <section class="empty-state">
                        <span class="empty-state-kicker">Sin resultados</span>
                        <h2>La API no devolvió ${escapeHtml(loaderLabel)} para esta página.</h2>
                        <p>Posible límite de velocidad (rate limit). Esperá unos segundos y recargá.</p>
                    </section>
                `;
            }
            return false;
        }

        var cardsHtml = items.map((item) => {
            const id = item.id ?? item.mal_id;
            const title = item.title || 'Sin t\u00EDtulo';
            const image = getApiPoster(item);
            const info = getApiCatalogInfo(categoria, item);
            const genres = getApiGenresList(item);
            const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
            const detailCat = categoria === 'novelas' ? 'novelas' : categoria;
            const detailUrl = 'detalle.html?cat=' + encodeURIComponent(detailCat) + '&id=' + encodeURIComponent(id);
            const searchIndex = [title, item.title_english, info, item.synopsis, item.type].concat(genres).filter(Boolean).join(' ').toLowerCase();

            return buildCatalogCardHtml({
                id: id,
                title: title,
                image: image,
                detailUrl: detailUrl,
                status: item.status || 'En emisi\u00F3n',
                searchIndex: searchIndex,
                genres: genres.join('|'),
                genresNorm: genresNorm,
                categoria: detailCat,
                progressTotal: categoria === 'anime' ? (item.episodes || 0) : (item.volumes || item.chapters || 0),
                imageExtraAttrs: ' data-title="' + escapeHtml(title) + '" data-fallback-catalog="1"'
            });
        }).join('');

        mainContainer.querySelector('.empty-state')?.remove();
        if (append) {
            mainContainer.insertAdjacentHTML('beforeend', cardsHtml);
        } else {
            mainContainer.innerHTML = cardsHtml;
        }

        cargarEstadosBotones();
        if (!append) {
            inicializarBusquedaCatalogo();
            inicializarGeneroWidgets();
        } else if (typeof window.__renderDropdownGenres === 'function') {
            window.__renderDropdownGenres();
        }
        return items.length > 0;
        } catch (error) {
        console.warn('Error cargando API:', error);
        if (!append) {
            mainContainer.innerHTML = `
                <section class="empty-state">
                    <span class="empty-state-kicker">API no disponible</span>
                    <h2>No se pudo cargar el catálogo de ${escapeHtml(loaderLabel)}.</h2>
                    <p>Revisá tu conexión, esperá unos segundos y recargá la página.</p>
                </section>
            `;
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
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(categoria) + '&id=' + encodeURIComponent(id);
        var searchIndex = [title, item.title_english, item.info, item.synopsis].concat(genres).filter(Boolean).join(' ').toLowerCase();
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
            progressTotal: Number(item.volumes || item.chapters || item.episodes || 0),
            imageExtraAttrs: ' data-title="' + escapeHtml(title) + '" data-fallback-catalog="1"'
        }));
    });

    if (append) {
        mainContainer.insertAdjacentHTML('beforeend', list.join(''));
    } else {
        mainContainer.innerHTML = list.join('');
        window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = items.map(function (item) {
            return { item: item, searchIndex: buildSearchIndexForItem(categoria, item) };
        });
    }

    cargarEstadosBotones();
    if (!append) {
        inicializarBusquedaCatalogo();
        inicializarGeneroWidgets();
    } else if (typeof window.__renderDropdownGenres === 'function') {
        window.__renderDropdownGenres();
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
window.__catalogFilters = { search: '', genres: [], isAdult: false };
var _genreWidgetsListenersAdded = false;
var _searchListenersAdded = false;


function inicializarBusquedaCatalogo() {
    const categoria = document.body.getAttribute('data-page');
    const input = document.getElementById('catalogSearch');
    const mainContainer = document.getElementById('main-container');
    if (!input || !mainContainer) return;

    const inputWrap = input.closest('.nav-search') || input.parentElement;
    let suggestionBox = document.getElementById('catalogSuggestions');
    if (!suggestionBox && inputWrap) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'catalogSuggestions';
        suggestionBox.className = 'catalog-suggestions';
        inputWrap.appendChild(suggestionBox);
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

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    function getCatalogItems() {
        return Array.isArray(window.__catalogSearchItems) ? window.__catalogSearchItems : [];
    }

    function renderSuggestions(query) {
        if (!suggestionBox) return;
        const q = normalize(query);
        if (!q) {
            suggestionBox.classList.remove('is-open');
            suggestionBox.innerHTML = '';
            return;
        }

        const matches = getCatalogItems()
            .filter((entry) => normalize(entry.searchIndex || '').includes(q))
            .slice(0, AnimeDestiny.Constants.SUGGESTION_LIMIT || 6);

        if (!matches.length) {
            suggestionBox.innerHTML = `
                <div class="catalog-suggestion empty">
                    <span class="catalog-suggestion-title">Sin sugerencias</span>
                    <span class="catalog-suggestion-meta">Probá con menos palabras o revisá el género.</span>
                </div>
            `;
            suggestionBox.classList.add('is-open');
            return;
        }

        suggestionBox.innerHTML = matches.map((entry) => `
            <a class="catalog-suggestion" href="detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(entry.item.id)}&nombre=${encodeURIComponent(entry.item.titulo)}">
                <span class="catalog-suggestion-title">${escapeHtml(entry.item.titulo)}</span>
                <span class="catalog-suggestion-meta">${escapeHtml(entry.item.info || entry.item.status || '')}</span>
            </a>
        `).join('');
        suggestionBox.classList.add('is-open');
    }

    function applyFilter() {
        const q = normalize(input.value);
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
            } catch (_) {}
        }
        
        let visible = 0;

        cards.forEach(card => {
            const indexText = normalize(card.getAttribute('data-search-index') || '');
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
        const q = normalize(rawQuery);
        if (!q) return;

        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        const filtered = items.filter(item => normalize(item.title || '').includes(q)).slice(0, AnimeDestiny.Constants.API_SUGGESTION_LIMIT || 8);
        if (!filtered.length) { if (prev) prev.remove(); return; }

        const section = prev || document.createElement('div');
        section.className = 'catalog-suggestion-api-section';

        let html = '<div class="catalog-suggestion-api-header">Relacionados</div>';
        filtered.forEach(item => {
            const imgUrl = item.images?.jpg?.image_url || item.images?.webp?.image_url || '';
            const id = encodeURIComponent(String(item.id));
            const title = escapeHtml(item.title || '');
            const meta = escapeHtml(item.type || item.status || '');
            html += `
                <a class="catalog-suggestion catalog-suggestion--api" href="detalle.html?cat=${encodeURIComponent(String(categoria))}&id=${id}&nombre=${encodeURIComponent(String(item.title || ''))}">
                    ${imgUrl ? `<img class="catalog-suggestion-img" src="${safeUrl(imgUrl)}" alt="" loading="lazy">` : ''}
                    <span class="catalog-suggestion-body">
                        <span class="catalog-suggestion-title">${title}</span>
                        <span class="catalog-suggestion-meta">${escapeHtml(meta)}</span>
                    </span>
                </a>`;
        });

        section.innerHTML = html;
        if (!prev) suggestionBox.appendChild(section);
    }

    async function fetchApiSuggestions(rawQuery) {
        const q = normalize(rawQuery);
        if (!q || q.length < 1) return;

        const loading = document.createElement('div');
        loading.className = 'catalog-suggestion-api-section';
        loading.id = 'catalogSearchLoading';
        loading.innerHTML = '<div class="catalog-suggestion-api-header">Buscando…</div>';
        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        if (prev) prev.remove();
        suggestionBox.appendChild(loading);

        try {
            let resultados;
            if (categoria === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
                resultados = await window.buscarNovelasEnApi(rawQuery);
            } else if (typeof window.buscarEnApi === 'function') {
                resultados = await window.buscarEnApi(rawQuery, categoria);
            } else {
                resultados = [];
            }
            const loadingEl = document.getElementById('catalogSearchLoading');
            if (loadingEl) loadingEl.remove();
            if (normalize(input.value) !== q) return;
            if (Array.isArray(resultados) && resultados.length) {
                renderApiSuggestions(rawQuery, resultados);
            }
        } catch (e) {
            const loadingEl = document.getElementById('catalogSearchLoading');
            if (loadingEl) loadingEl.remove();
        }
    }

    function debouncedApiSearch() {
        if (apiSearchTimer) clearTimeout(apiSearchTimer);
        const q = input.value;
        lastApiQuery = q;
        if (!normalize(q)) {
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
        const cat = document.body.getAttribute('data-page');
        const usaApi = cat === 'anime' || cat === 'manga' || cat === 'novelas';
        if (!usaApi) { applyFilter(); return; }

        // Update global filter state
        const nsfwCheck = document.getElementById('nsfwToggle');
        window.__catalogFilters = {
            search: input.value.trim() || '',
            genres: Array.isArray(window.__selectedGenres) ? [...window.__selectedGenres] : [],
            isAdult: nsfwCheck ? nsfwCheck.checked : false
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

    // ── Input: local filter + API suggestions ──
    input.addEventListener('input', () => {
        applyFilter();
        debouncedApiSearch();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            reloadCatalog();
        }
    });
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (suggestionBox) suggestionBox.classList.remove('is-open');
        }, 180);
    });

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

    if (filterToggle && filterDropdown) {
        filterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const next = filterDropdown.hidden;
            filterDropdown.hidden = !next;
            filterToggle.classList.toggle('is-active', !next);
            filterToggle.setAttribute('aria-expanded', !next);
        });
        
        document.addEventListener('click', (e) => {
            if (filterDropdown.hidden) return;
            if (!filterToggle.contains(e.target) && !filterDropdown.contains(e.target)) {
                filterDropdown.hidden = true;
                filterToggle.classList.remove('is-active');
                filterToggle.setAttribute('aria-expanded', 'false');
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
                    filterDropdown.hidden = true;
                    filterToggle.classList.remove('is-active');
                    filterToggle.setAttribute('aria-expanded', 'false');
                }
                return;
            }
        });
    }

    // ── NSFW toggle → server reload ──
    const nsfwCheckbox = document.getElementById('nsfwToggle');
    if (nsfwCheckbox) {
        nsfwCheckbox.addEventListener('change', () => {
            reloadCatalog();
        });
    }

    applyFilter();
}


function inicializarGeneroWidgets() {
    const categoria = document.body.getAttribute('data-page');
    const sidebarHost = document.getElementById('genreSidebar');
    const mainContainer = document.getElementById('main-container');
    if (!categoria || !mainContainer) return;

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    const counts = new Map();

    const cardGenreRows = [...mainContainer.querySelectorAll('.card-container[data-genres]')]
        .map((card) => String(card.getAttribute('data-genres') || '').split('|').map((genre) => genre.trim()).filter(Boolean))
        .filter((genres) => genres.length);

    const localList = (() => {
        if (cardGenreRows.length) return [];
        if (typeof obtenerItemsCategoria === 'function') return obtenerItemsCategoria(categoria);
        return [];
    })();

    const rows = cardGenreRows.length
        ? cardGenreRows
        : localList.map((item) => String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean));

    rows.forEach((genres) => {
        genres.forEach((g) => {
            const key = normalize(g);
            if (!key) return;
            counts.set(key, { label: g, count: (counts.get(key)?.count || 0) + 1 });
        });
    });

    // ── Géneros fijos: unión completa de AniList + MangaDex ──
    // Demografía
    // AniList géneros (GenreCollection)
    // MangaDex géneros + temas
    // AniList tags populares (MediaTagCollection)
    var fixedGenres = [
        // ── Demografía ──
        'Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kodomo', 'Adult',
        // ── Géneros principales (AniList + MangaDex) ──
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
        'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
        'Supernatural', 'Thriller', 'Ecchi', 'Psychological', 'Tragedy',
        'Suspense',
        // ── Géneros MangaDex ──
        'Crime', 'Historical', 'Medical', 'Philosophical', 'Wuxia',
        'Superhero', 'Magical Girls', 'Mahou Shoujo',
        // ── Temas comunes (AniList + MangaDex) ──
        'Isekai', 'Mecha', 'Music', 'Harem', 'Reverse Harem',
        'School', 'School Life', 'Military', 'Police', 'Martial Arts',
        'Demons', 'Vampires', 'Zombies', 'Ghosts', 'Monsters',
        'Monster Girls', 'Aliens', 'Animals', 'Ninja', 'Samurai',
        'Pirates', 'Mafia', 'Delinquents', 'Gyaru', 'Survival',
        'Post-Apocalyptic', 'Cyberpunk', 'Steampunk', 'Space',
        'Space Opera', 'Urban Fantasy', 'Gore',
        // ── Temas AniList ──
        'Reincarnation', 'Time Travel', 'Time Manipulation',
        'Genderswap', 'Crossdressing', 'Gender Bending',
        'Magic', 'Mythology', 'Fairy Tale',
        'Parody', 'Satire', 'Surreal Comedy',
        'Cooking', 'Food', 'Fitness', 'Swimming',
        'Video Games', 'Virtual World', 'Virtual Reality',
        'Idol', 'Band', 'Musical',
        'Detective', 'Espionage', 'Noir',
        'War', 'Terrorism', 'Guns', 'Swordplay',
        'Revenge', 'Amnesia', 'Gambling',
        'Cultivation', 'Villainess', 'Anti-Hero',
        'Boys\' Love', 'Girls\' Love', 'LGBTQ+ Themes',
        'Incest', 'Loli', 'Shota',
        'Hikikomori', 'Otaku Culture', 'Chuunibyou',
        'Chibi', 'Nekomimi', 'Youkai', 'Kaiju',
        'Iyashikei', 'Denpa', 'Tokusatsu',
        'Work', 'Office Workers', 'Economics',
        'Medicine', 'Philosophy', 'Politics',
        'Family Life', 'Found Family', 'Love Triangle',
        'Battle Royale', 'Card Battle', 'Traditional Games',
        'Robots', 'Real Robot', 'Super Robot',
        'Dystopia', 'Lost Civilization', 'Rural', 'Urban',
        'Superhero', 'Witch', 'Werewolf', 'Vampire',
        'Dragon', 'Skeleton',
        'Female Protagonist', 'Male Protagonist',
        'Ensemble Cast', 'Primarily Adult Cast',
        'Slavery', 'Rehabilitation', 'Fugitive',
        'Trains', 'Ships', 'Motorcycles', 'Tanks',
        'Photography', 'Drawing', 'Calligraphy',
        // ── Formato y Origen ──
        'Manga', 'Manhwa', 'Manhua', 'Doujinshi', 'One-shot', 'Novela',
        'TV', 'OVA', 'ONA', 'Movie', 'Special',
        'Oneshot', '4-Koma', 'Full Color', 'Long Strip',
        'Web Comic', 'Anthology', 'Adaptation',
        'Award Winning', 'Self-Published',
        // ── Extra / Custom ──
        'Fanfic'
    ];
    fixedGenres.forEach(function(g) {
        var key = normalize(g);
        if (!counts.has(key)) {
            counts.set(key, { label: g, count: 0 });
        }
    });

    const sorted = [...counts.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

    const max = sorted.length ? sorted[0].count : 1;
    const top = sorted.slice(0, 6);

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

    function renderSidebar(host) {
        const openKey = `ui:genreDrawerOpen:${categoria}`;
        const isOpen = UserStore.getItem(openKey) === '1';
        const topHtml = top.length
            ? `
                <div class="genre-stats">
                    <div class="top-genres-title">Popularidad</div>
                    ${top.map((g) => {
                        const pct = Math.max(6, Math.round((g.count / max) * 100));
                        return `
                            <div class="genre-bar" role="listitem" aria-label="${g.label}">
                                <div class="genre-bar-label">${g.label}</div>
                                <div class="genre-bar-track" aria-hidden="true">
                                    <div class="genre-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <div class="genre-bar-count">${g.count}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `
            : '';

        host.innerHTML = `
            <div class="genre-sidebar-head">
                <div>
                    <div class="genre-sidebar-title">Géneros</div>
                    <div class="genre-sidebar-help">Elegí 1 o más géneros.</div>
                </div>
                <button class="genre-collapse-btn" type="button" id="toggleGenreSidebar" aria-expanded="${isOpen ? 'true' : 'false'}">
                    ${isOpen ? 'Cerrar' : 'Abrir'}
                </button>
            </div>
            ${topHtml}
            <div class="genre-filters">
                <button class="genre-chip${selectedGenres.length ? '' : ' is-active'}" type="button" data-genre="" aria-pressed="${selectedGenres.length ? 'false' : 'true'}">Todos</button>
                ${filterGenres.map((g) => {
                    const isActive = selectedGenres.includes(g.key);
                    const active = isActive ? ' is-active' : '';
                    return `<button class="genre-chip${active}" type="button" data-genre="${g.key}" aria-pressed="${isActive ? 'true' : 'false'}">${g.label}</button>`;
                }).join('')}
            </div>
            <div class="genre-actions">
                <button class="genre-clear-btn" type="button" id="clearGenres">Limpiar</button>
            </div>
        `;

        host.classList.toggle('is-open', isOpen);

        const toggleBtn = host.querySelector('#toggleGenreSidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const nextOpen = !host.classList.contains('is-open');
                host.classList.toggle('is-open', nextOpen);
                UserStore.setItem(openKey, nextOpen ? '1' : '0');
                toggleBtn.textContent = nextOpen ? 'Cerrar' : 'Abrir';
                toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            });
        }

        host.addEventListener('click', (e) => {
            const clearBtn = e.target instanceof HTMLElement ? e.target.closest('button.genre-clear-btn') : null;
            if (clearBtn) {
                window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
                else if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                if (typeof renderDropdownGenres === 'function') renderDropdownGenres();
                return;
            }

            const btn = e.target instanceof HTMLElement ? e.target.closest('button.genre-chip') : null;
            if (!btn) return;
            const genreKey = String(btn.getAttribute('data-genre') || '');

            if (!genreKey) {
                window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
                else if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                if (typeof renderDropdownGenres === 'function') renderDropdownGenres();
                return;
            }

            const next = new Set(Array.isArray(window.__selectedGenres) ? window.__selectedGenres : []);
            if (next.has(genreKey)) next.delete(genreKey);
            else next.add(genreKey);

            const arr = [...next];
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = arr;
            UserStore.setItem(selectedKey, JSON.stringify(arr));

            host.querySelectorAll('button.genre-chip').forEach((b) => {
                const k = String(b.getAttribute('data-genre') || '');
                if (!k) {
                    const activeTodos = arr.length === 0;
                    b.classList.toggle('is-active', activeTodos);
                    b.setAttribute('aria-pressed', activeTodos ? 'true' : 'false');
                    return;
                }
                const active = next.has(k);
                b.classList.toggle('is-active', active);
                b.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
            else if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
            if (typeof renderDropdownGenres === 'function') renderDropdownGenres();
        }, { passive: true });
    }

    if (sidebarHost) {
        renderSidebar(sidebarHost);
    }

    // ── Populate dropdown genre chips ──
    const filterGenresContainer = document.getElementById('filterGenres');

    function renderDropdownGenres() {
        if (!filterGenresContainer) return;
        const arr = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        filterGenresContainer.innerHTML = filterGenres.map((g) => {
            const active = arr.includes(g.key) ? ' is-active' : '';
            return `<button class="ff-genre-chip${active}" type="button" data-genre="${g.key}" aria-pressed="${active ? 'true' : 'false'}">${g.label}</button>`;
        }).join('');
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

    const clearBtn = document.getElementById('clearFiltersBtn');

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
            UserStore.setItem(selectedKey, JSON.stringify([]));
            renderDropdownGenres();
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

            // Sync sidebar chips
            const sidebar = document.getElementById('genreSidebar');
            if (sidebar) {
                sidebar.querySelectorAll('button.genre-chip').forEach((b) => {
                    const k = String(b.getAttribute('data-genre') || '');
                    if (!k) {
                        b.classList.toggle('is-active', arr.length === 0);
                        b.setAttribute('aria-pressed', arr.length === 0 ? 'true' : 'false');
                        return;
                    }
                    const active = arr.includes(k);
                    b.classList.toggle('is-active', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
            }

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
    const mainContainer = document.getElementById("main-container");
    if (!mainContainer) { isLoadingPage = false; return; }

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
        if (entries[0].isIntersecting) {
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
    initScrollObserver();
}

async function inicializarPagina() {
    const mainContainer = document.getElementById("main-container");
    if (!mainContainer) return;
    const categoria = document.body.getAttribute("data-page");
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

    function normalize(text) {
        return String(text || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    }

    function getGenres(item) {
        return String(item?.info || "").split("/").map(function (s) { return s.trim(); }).filter(Boolean);
    }

    const perPage = AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20;
    const batch = listaItems.slice(0, perPage);

    mainContainer.innerHTML = batch.map(function (item) {
        const genres = getGenres(item);
        const genresNorm = genres.map(function (g) { return normalize(g); }).join("|");
        const searchIndex = buildSearchIndexForItem(categoria, item);
        const detailUrl = "detalle.html?cat=" + encodeURIComponent(categoria) + "&id=" + encodeURIComponent(item.id) + "&nombre=" + encodeURIComponent(item.titulo);
        const hasDetail = typeof obtenerDetalleItem === "function" && !!obtenerDetalleItem(categoria, item.id);
        const detalle = (typeof obtenerDetalleItem === "function") ? obtenerDetalleItem(categoria, item.id) : null;
        let progressTotal = 0;
        if (categoria === "anime" && detalle?.temporadas) {
            progressTotal = detalle.temporadas.reduce(function (acc, t) { return acc + (Number(t.episodios) || 0); }, 0);
        } else if (categoria === "manga" || categoria === "novelas") {
            progressTotal = Number(detalle?.volumenes || 0);
        }
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
            progressTotal: progressTotal,
            imageExtraAttrs: ' data-title="' + escapeHtml(item.titulo) + '" data-fallback-catalog="1"'
        });
    }).join("");

    cargarEstadosBotones();
    inicializarBusquedaCatalogo();
    inicializarGeneroWidgets();
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
    const pageKey = path.includes("mis-listas") ? "mis-listas" :
        path.includes("anime") ? "anime" :
        path.includes("manga") ? "manga" :
        path.includes("novelas") ? "novelas" :
        path.includes("comparar") ? "comparar" :
        path.includes("detalle") ? "detalle" :
        path.includes("configuracion") ? "configuracion" :
        path.includes("usuario") ? "usuario" :
        path.includes("login") ? "login" :
        path.includes("top") ? "top" :
        "index";

    const ensureSkipLink = () => {
        if (document.querySelector('.skip-link')) return;
        const skip = document.createElement('a');
        skip.className = 'skip-link';
        skip.href = '#main-content';
        skip.textContent = 'Saltar al contenido';
        document.body.prepend(skip);
    };

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

    // ââ NAV BRAND ââ
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

    // ââ NAV LINKS ââ
    const injectNavLinks = () => {
        const el = document.getElementById("nav-links-container");
        if (!el) return;

        const isAnime = path.includes("anime");
        const isManga = path.includes("manga");
        const isNovelas = path.includes("novelas");
        const isMisListas = path.includes("mis-listas");
        const isTop = path.includes("top");
        const isIndex = path.endsWith("index.html") || path.endsWith("/") || path === "";
        const isDetail = path.includes("detalle");

        let activePage = isAnime ? "anime" : isManga ? "manga" : isNovelas ? "novelas" : isMisListas ? "mis-listas" : isTop ? "top" : null;
        if (isIndex) activePage = null;

        const links = [
            { id: "anime", href: "anime.html", icon: "\uD83C\uDFAC", label: "Anime" },
            { id: "manga", href: "manga.html", icon: "\uD83D\uDCDA", label: "Manga" },
            { id: "novelas", href: "novelas.html", icon: "\uD83D\uDCD6", label: "Novelas" },
            { id: "mis-listas", href: "mis-listas.html", icon: "\uD83D\uDC96", label: "Mis Listas" },
            { id: "top", href: "top.html", icon: "\uD83C\uDFC6", label: "Ranking" }
        ];

        let html = "";
        for (let i = 0; i < links.length; i++) {
            const l = links[i];
            let cls = "nav-btn";
            let current = "";
            let dataCat = "";
            if (l.id === activePage) {
                cls += " active";
                current = ' aria-current="page"';
            }
            if (isDetail && i < 3) {
                dataCat = ` data-nav-cat="${l.id}"`;
            }
            html += `<a href="${l.href}" class="${cls}"${current}${dataCat}>
<span class="nav-icon" aria-hidden="true">${l.icon}</span><span>${l.label}</span>
</a>`;
        }
        el.innerHTML = `<div class="nav-links" aria-label="Navegaci\u00F3n principal">${html}</div>`;
    };

    // ââ LOGIN / USER AREA ââ
    const injectLoginButton = () => {
        const el = document.getElementById("nav-login-container");
        if (!el) return;
        if (path.includes("login")) return;

        el.innerHTML = `<div class="nav-user" id="nav-user">
<div id="nav-user-avatar" class="nav-user-avatar"></div>
<div class="nav-user-info">
<span id="nav-user-name" class="nav-user-name">Invitado</span>
<a id="nav-user-btn" href="Login.html" class="nav-user-btn">Ingresar</a>
</div>
</div>`;

        // Refrescar la UI del usuario si auth.js ya cargÃ³
        if (typeof window.refreshUserUi === 'function') {
            window.refreshUserUi();
        }
    };

    // ââ FOOTER ââ
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
        }
    };

    const injectFooter = () => {
        const el = document.getElementById("footer-container");
        if (!el) return;

        const data = FOOTER_DATA[pageKey];
        if (!data) return;

        let cols = "";
        const entries = data.col3 ? [data.col1, data.col2, data.col3] : [data.col1, data.col2];

        for (let i = 0; i < entries.length; i++) {
            const c = entries[i];
            cols += `<div class="app-footer-col">
<div class="app-footer-title">${c.title}</div>
<p class="app-footer-text">${c.text}</p>
</div>`;
        }

        if (!data.col3) {
            cols += `<div class="app-footer-col">
<div class="app-footer-title">Redes</div>
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
    <span>Â© 2026 Anime Destiny</span>
    <span style="margin: 0 10px;">â¢</span>
    <a class="app-footer-link app-footer-link-cyan" href="privacidad.html">Privacidad</a>
    <span style="margin: 0 10px;">â¢</span>
    <a class="app-footer-link app-footer-link-purple" href="terminos.html">Términos</a>
</div>
</footer>`;
    };

    // ââ Custom colors (leer desde localStorage y aplicar en :root) ââ
    (() => {
        const r = (key, def) => {
            try { return localStorage.getItem(key) || def; } catch { return def; }
        };
        const colorKeys = {
            '--neon-purple':  'pref:color:neonPurple',
            '--nav-accent':   'pref:color:navAccent',
            '--accent-cyan':  'pref:color:cyan',
            '--dark-bg':      'pref:color:darkBg',
            '--text-main':    'pref:color:textMain',
            '--text-muted':   'pref:color:textMuted'
        };
        const defaults = {
            '--neon-purple':  '#bc13fe',
            '--nav-accent':   '#a855f7',
            '--accent-cyan':  '#00f2ff',
            '--dark-bg':      '#050505',
            '--text-main':    '#ffffff',
            '--text-muted':   '#b0b0b0'
        };
        const root = document.documentElement;
        let hasCustom = false;
        for (const name in colorKeys) {
            if (colorKeys.hasOwnProperty(name)) {
                const val = r(colorKeys[name], defaults[name]);
                root.style.setProperty(name, val);
                if (val !== defaults[name]) hasCustom = true;
            }
        }
        const navAccent = root.style.getPropertyValue('--nav-accent') || defaults['--nav-accent'];
        root.style.setProperty('--nav-accent-soft', `${navAccent}3d`);
    })();

    // ââ Cards per row (localStorage â body class) ââ
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

    // ââ RUN ââ
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
    ensureSkipLink();
    ensureMainTarget();
    injectNavBrand();
    injectNavLinks();
    injectLoginButton();
    injectFooter();
    installSecurityHandlers();

})();




