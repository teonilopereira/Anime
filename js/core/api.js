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
                    format: item.format || null
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
                    seasonYear: node.seasonYear || null
                };
            }),
            season: item.season || null,
            seasonYear: item.seasonYear || null,
            source: item.source || null,
            duration: item.duration || null,
            countryOfOrigin: item.countryOfOrigin || null,
            nextAiringEpisode: item.nextAiringEpisode || null,
            streamingEpisodes: item.streamingEpisodes || [],
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
            return (json?.data || []).map(function (m) { return mdItemToCard(m); }).filter(Boolean);
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

        return 'query (' + varDecls.join(', ') + ') { Page(page: $page, perPage: $perPage) { media(' + mediaArgs.join(', ') + ') { ' + fields + ' } } }';
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
                season seasonYear source duration countryOfOrigin
                nextAiringEpisode { airingAt timeUntilAiring episode }
                streamingEpisodes { title thumbnail url site }
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
     * lo llamen varias veces en paralelo. Si `producer` falla, el error se
     * propaga (no se cachea) para que el llamador pueda distinguir "sin
     * resultados" de "la API se cayo".
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
            var query = buildDynamicQuery(Object.assign({
                type: 'ANIME',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']
            }, browseToQueryOpts(browse, true)));
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
            var baseOpts = Object.assign({
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false
            }, browseToQueryOpts(browse, false));
            var baseVars = {};
            if (filters.search) baseVars.search = filters.search;
            if (split.genres.length) baseVars.genre_in = split.genres;
            if (split.tags.length) baseVars.tag_in = split.tags;

            var qManga = buildDynamicQuery(Object.assign({}, baseOpts, { formatIn: ['MANGA', 'ONE_SHOT'], countryOfOrigin: 'JP' }));
            var qManhwa = buildDynamicQuery(Object.assign({}, baseOpts, { formatIn: ['MANGA', 'ONE_SHOT'], countryOfOrigin: 'KR' }));
            var qDoujin = buildDynamicQuery(Object.assign({}, baseOpts, { source: 'DOUJINSHI' }));

            var pg = page || 1;
            // allSettled y no all: las tres queries son independientes, pero con
            // `all` un 429 en la de doujinshi (la menos importante de las tres)
            // rechazaba el lote entero y el catalogo quedaba en "API no
            // disponible" aunque manga y manhwa ya hubieran respondido bien.
            var resultados = await Promise.allSettled([
                anilistFetch(qManga, Object.assign({ page: pg, perPage: perPage }, baseVars)),
                anilistFetch(qManhwa, Object.assign({ page: pg, perPage: perPage }, baseVars)),
                // Sin reintentos (retries = 0). Cada 429 se reintenta 2 veces, o sea
                // que una query que falla cuesta 3 requests y empuja el rate limit
                // mas hondo. La de doujinshi es la que menos aporta al catalogo y
                // desde el allSettled su fallo ya no rompe nada: no vale la pena
                // gastarle cuota justo cuando la cuota es el problema.
                anilistFetch(qDoujin, Object.assign({ page: pg, perPage: perPage }, baseVars), 0)
            ]);

            // Si fallaron las tres no hay nada parcial que rescatar: se propaga
            // el error para que el llamador pueda distinguir "la API se cayo" de
            // "la busqueda no tuvo resultados".
            if (resultados.every(function (r) { return r.status === 'rejected'; })) {
                throw resultados[0].reason;
            }

            function mediaDeResultado(r) {
                return r.status === 'fulfilled' ? (r.value?.data?.Page?.media || []) : [];
            }
            var mediaManga = mediaDeResultado(resultados[0]);
            var mediaManhwa = mediaDeResultado(resultados[1]);
            var mediaDoujin = mediaDeResultado(resultados[2]);
            
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
            var mdTagUuids = mdTagUuidsFromKeys(filters.genres);
            if (mdTagUuids.length || filters.search) {
                var mdPage = await fetchMangaDexPage(pg, PER_PAGE, mdTagUuids, filters.search);
                if (mdPage.length) mapped = mergeAnilistAndMd(mapped, mdPage);
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
            var query = buildDynamicQuery(Object.assign({
                type: 'MANGA',
                search: filters.search || null,
                genreIn: split.genres.length ? split.genres : null,
                tagIn: split.tags.length ? split.tags : null,
                isAdult: filters.isAdult || false,
                formatIn: ['NOVEL']
            }, browseToQueryOpts(browse, false)));
            var vars = { page: page || 1, perPage: PER_PAGE };
            if (filters.search) vars.search = filters.search;
            if (split.genres.length) vars.genre_in = split.genres;
            if (split.tags.length) vars.tag_in = split.tags;

            var json = await anilistFetch(query, vars);
            var media = json?.data?.Page?.media || [];
            var mapped = media.map(function (m) { return anilistItemToLocal(m, 'novelas'); });

            // Supplement with MangaDex
            var mdTagUuids = mdTagUuidsFromKeys(filters.genres);
            if (mdTagUuids.length || filters.search) {
                var pg = page || 1;
                var mdPage = await fetchMangaDexPage(pg, PER_PAGE, mdTagUuids, filters.search);
                if (mdPage.length) mapped = mergeAnilistAndMd(mapped, mdPage);
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

    // Cliente HTTP de MangaDex compartido: js/core/mangadex-api.js tenia una
    // copia casi identica de esta funcion (mismo AbortController, timeout y
    // manejo de errores). Se expone la del bundle para no mantener dos.
    window.mdFetch = mdFetch;
    window.fetchMangaDexPage = fetchMangaDexPage;
    window.mergeAnilistAndMd = mergeAnilistAndMd;

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
