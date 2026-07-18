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
        var cacheKey = 'topAnimes_p' + (page || 1) + (hasFilters ? '_f' + JSON.stringify(filters) : '');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
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
        var browse = filters.browse || '';
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse);
        var cacheKey = 'topMangas_mix_p' + (page || 1) + (hasFilters ? '_f' + JSON.stringify(filters) : '');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
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

            // Supplement with MangaDex
            var mdTagUuids = mdTagUuidsFromKeys(filters.genres);
            if (mdTagUuids.length || filters.search) {
                var mdPage = await fetchMangaDexPage(pg, PER_PAGE, mdTagUuids, filters.search);
                if (mdPage.length) mapped = mergeAnilistAndMd(mapped, mdPage);
            }

            if (mapped.length) setApiCache(cacheKey, mapped, hasFilters ? 300000 : 3600000);
            return mapped;
        } catch (err) {
            console.warn('getTopMangas error:', err);
            return [];
        }
    };

    window.getTopNovelas = async function (page, filters) {
        filters = filters || {};
        var split = splitGenresAndTags(filters.genres);
        var browse = filters.browse || '';
        var hasFilters = !!(filters.search || (filters.genres && filters.genres.length) || filters.isAdult || browse);
        var cacheKey = 'novonly_p' + (page || 1) + (hasFilters ? '_f' + JSON.stringify(filters) : '');
        var cached = getApiCache(cacheKey);
        if (cached) return cached;

        try {
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

            if (mapped.length) setApiCache(cacheKey, mapped, hasFilters ? 300000 : 3600000);
            return mapped;
        } catch (err) {
            console.warn('getTopNovelas error:', err);
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
                if (photoUrl && (typeof window.safeUrl !== 'function' || window.safeUrl(photoUrl))) {
                    avatarEl.classList.add('has-image');
                    var cleanUrl = photoUrl.replace(/[\\"'()]/g, '');
                    avatarEl.style.backgroundImage = 'url("' + cleanUrl + '")';
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

        // Remover del DOM al finalizar la animación
        toast.addEventListener("transitionend", () => {
            toast.remove();
            // Limpiar el contenedor si queda vacío
            if (container && container.childNodes.length === 0) {
                container.remove();
                container = null;
            }
        });
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
        chCount = 0
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
    <div class="card-container catalog-neon-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}" data-img="${safeId}" data-search-index="${escapeHtml(searchIndex)}"${totalAttr}${genresAttr}${genresNormAttr}>
        <input class="flip-toggle" type="checkbox" id="${flipId}">
        <div class="catalog-card-shell">
            <div class="card-corner card-corner-tr"></div>
            <div class="card-corner card-corner-br"></div>
            <div class="catalog-card-inner">
                <div class="catalog-card-media">
                    <div class="catalog-card-poster card-inner">
                        <div class="card-front">
                            <img src="${safeImg}" alt="${escapeHtml(title)}" width="230" height="345" decoding="async" loading="lazy"${imageExtraAttrs}>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${escapeHtml(title)}</h2>
                            <div class="card-back-buttons-stack">
                                ${detailBtn}
                                ${statusHtml}
                            </div>
                            <select class="watch-status-select" data-item-id="${safeId}" aria-label="Estado de seguimiento">
                                <option value="">— Seguimiento —</option>
                                <option value="viendo">Viendo</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="pausado">En pausa</option>
                                <option value="abandonado">Abandonado</option>
                            </select>
                            <div class="card-back-actions">
                                <button class="action-btn fav-btn" type="button" aria-label="Favorito" data-item-id="${safeId}" data-action="fav">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                </button>
                                <button class="action-btn viewed-btn" type="button" aria-label="Visto" data-item-id="${safeId}" data-action="viewed">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </button>
                            </div>
                            ${buildCatalogBackProgressHtml(categoria, progressTotal, volCount, chCount)}
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
                    imagen: getApiPoster(item),
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
                        imagen: getApiPoster(item),
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
            if (!append) { try { inicializarBusquedaCatalogo(); } catch (e) {} try { inicializarGeneroWidgets(); } catch (e) {} }
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

            const volCount = categoria !== 'anime' ? (item.volumes || 0) : 0;
            const chCount = categoria !== 'anime' ? (item.chapters || 0) : 0;
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
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(categoria) + '&id=' + encodeURIComponent(id);
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

    // Toggle overflow on the container when suggestions open/close
    function setSuggestionsOpen(open) {
        if (searchContainer) searchContainer.classList.toggle('has-suggestions', open);
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
            return;
        }

        const matches = getCatalogItems()
            .filter((entry) => normalizeText(entry.searchIndex || '').includes(q))
            .slice(0, AnimeDestiny.Constants.SUGGESTION_LIMIT || 6);

        if (!matches.length) {
            suggestionBox.classList.remove('is-open');
            setSuggestionsOpen(false);
            suggestionBox.innerHTML = '';
            return;
        }

        suggestionBox.innerHTML = matches.map((entry) => `
            <a class="catalog-suggestion" href="detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(entry.item.id)}&nombre=${encodeURIComponent(entry.item.titulo)}">
                ${entry.item.imagen ? `<img class="catalog-suggestion-img" src="${safeUrl(entry.item.imagen)}" alt="" width="36" height="50" decoding="async" loading="lazy">` : ''}
                <span class="catalog-suggestion-body">
                    <span class="catalog-suggestion-title">${escapeHtml(entry.item.titulo)}</span>
                    <span class="catalog-suggestion-meta">${escapeHtml(entry.item.info || entry.item.status || '')}</span>
                </span>
            </a>
        `).join('');
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
        const seenIds = new Set();
        section.querySelectorAll('a').forEach(a => { const m = a.href.match(/[?&]id=([^&]+)/); if (m) seenIds.add(m[1]); });

        filtered.forEach(item => {
            const rawId = String(item.id);
            if (seenIds.has(rawId)) return;
            seenIds.add(rawId);
            const id = encodeURIComponent(rawId);
            const imgUrl = item.images?.jpg?.image_url || item.images?.webp?.image_url || '';
            const title = escapeHtml(item.title || '');
            const meta = escapeHtml(item.type || item.status || '');
            const a = document.createElement('a');
            a.className = 'catalog-suggestion catalog-suggestion--api';
            a.href = `detalle.html?cat=${encodeURIComponent(String(categoria))}&id=${id}&nombre=${encodeURIComponent(String(item.title || ''))}`;
            a.innerHTML = `${imgUrl ? `<img class="catalog-suggestion-img" src="${safeUrl(imgUrl)}" alt="" loading="lazy">` : ''}<span class="catalog-suggestion-body"><span class="catalog-suggestion-title">${title}</span><span class="catalog-suggestion-meta">${escapeHtml(meta)}</span></span>`;
            section.appendChild(a);
        });

        if (!section.children.length) { if (prev) prev.remove(); return; }
        if (!prev) suggestionBox.appendChild(section);
        if (suggestionBox.classList.contains('is-open') || section.children.length) {
            suggestionBox.classList.add('is-open');
            setSuggestionsOpen(true);
        }
    }

    async function fetchApiSuggestions(rawQuery) {
        const q = normalizeText(rawQuery);
        if (!q || q.length < 1) return;

        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        if (prev) prev.remove();

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
            }
        } catch (e) {
            // ignore
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
        const cat = document.body.getAttribute('data-page');
        const usaApi = cat === 'anime' || cat === 'manga' || cat === 'novelas';
        if (!usaApi) { applyFilter(); return; }

        // Update global filter state
        const nsfwCheck = document.getElementById('nsfwToggle');
        window.__catalogFilters = {
            search: input.value.trim() || '',
            genres: Array.isArray(window.__selectedGenres) ? [...window.__selectedGenres] : [],
            isAdult: nsfwCheck ? nsfwCheck.checked : false,
            browse: getBrowsePref(cat)
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
            if (suggestionBox) {
                suggestionBox.classList.remove('is-open');
                setSuggestionsOpen(false);
            }
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

    function renderDropdownGenres() {
        if (!filterGenresContainer) return;
        const arr = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        filterGenresContainer.innerHTML = filterGenres.map((g) => {
            const active = arr.includes(g.key) ? ' is-active' : '';
            return `<button class="ff-genre-chip${active}" type="button" data-genre="${escapeHtml(g.key)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(g.label)}</button>`;
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
    const mainContainer = document.getElementById("main-content");
    if (!mainContainer) return;
    const categoria = document.body.getAttribute("data-page");
    if (["listas", "top", "comparar", "detalle", "index"].indexOf(categoria) !== -1) return;
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
        const hasDetail = typeof obtenerDetalleItem === "function" && !!obtenerDetalleItem(categoria, item.id);
        const detalle = (typeof obtenerDetalleItem === "function") ? obtenerDetalleItem(categoria, item.id) : null;
        let progressTotal = 0;
        if (categoria === "anime" && detalle?.temporadas) {
            progressTotal = detalle.temporadas.reduce(function (acc, t) { return acc + (Number(t.episodios) || 0); }, 0);
        } else if (categoria === "manga" || categoria === "novelas") {
            progressTotal = Number(detalle?.volumenes || 0);
        }
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
            progressTotal: volCount || chCount || progressTotal,
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

    // ── NAV TOGGLE (Hamburger) ──
    const injectNavToggle = () => {
        const nav = document.querySelector('.destiny-navbar');
        if (!nav || nav.querySelector('.nav-toggle')) return;

        const toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-label', 'Menú de navegación');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<span class="nav-toggle-icon" aria-hidden="true"></span><span class="nav-toggle-text">Menú</span>';

        toggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });

        nav.insertBefore(toggle, document.getElementById('nav-links-container'));
    };

    // ── NAV LINKS ──
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
            { id: "anime", href: "anime.html", icon: "clapperboard", label: window.AppI18n ? window.AppI18n.t("nav.anime") : "Anime" },
            { id: "manga", href: "manga.html", icon: "book-open", label: window.AppI18n ? window.AppI18n.t("nav.manga") : "Manga" },
            { id: "novelas", href: "novelas.html", icon: "book", label: window.AppI18n ? window.AppI18n.t("nav.novelas") : "Novelas" },
            { id: "mis-listas", href: "mis-listas.html", icon: "heart", label: window.AppI18n ? window.AppI18n.t("nav.mis_listas") : "Mis Listas" },
            { id: "top", href: "top.html", icon: "trophy", label: window.AppI18n ? window.AppI18n.t("nav.top") : "Ranking" }
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
<span class="nav-icon" aria-hidden="true"><i data-lucide="${l.icon}"></i></span><span data-i18n="nav.${l.id.replace('-', '_')}">${l.label}</span>
</a>`;
        }
        el.innerHTML = `<div class="nav-links" aria-label="Navegación principal">${html}</div>`;
    };

    // ── MOBILE BOTTOM NAV ──
    const injectMobileBottomNav = () => {
        if (document.querySelector('.mobile-bottom-nav')) return;

        // No inyectar en páginas de auth (en el resto siempre debe haber
        // navegación visible: en mobile la navbar superior queda oculta)
        const skipPages = ["login"];
        for (let i = 0; i < skipPages.length; i++) {
            if (path.includes(skipPages[i])) return;
        }
        if (path.includes("404")) return;

        const isAnime = path.includes("anime");
        const isManga = path.includes("manga");
        const isNovelas = path.includes("novelas");
        const isMisListas = path.includes("mis-listas");

        const isTop = path.includes("top");
        const isIndex = path.endsWith("index.html") || path.endsWith("/") || path === "";

        let activePage = isAnime ? "anime" : isManga ? "manga" : isNovelas ? "novelas" : isMisListas ? "mis-listas" : isTop ? "top" : null;
        if (isIndex) activePage = null;

        // "mis-listas" usa la clave corta nav.listas: "Mis Listas" no entra
        // en una línea y desalinea el icono del tab en pantallas chicas
        const tabs = [
            { id: "anime", href: "anime.html", icon: "clapperboard", i18n: "nav.anime", label: window.AppI18n ? window.AppI18n.t("nav.anime") : "Anime" },
            { id: "manga", href: "manga.html", icon: "book-open", i18n: "nav.manga", label: window.AppI18n ? window.AppI18n.t("nav.manga") : "Manga" },
            { id: "novelas", href: "novelas.html", icon: "book", i18n: "nav.novelas", label: window.AppI18n ? window.AppI18n.t("nav.novelas") : "Novelas" },
            { id: "mis-listas", href: "mis-listas.html", icon: "heart", i18n: "nav.listas", label: window.AppI18n ? window.AppI18n.t("nav.listas") : "Listas" },
            { id: "top", href: "top.html", icon: "trophy", i18n: "nav.top", label: window.AppI18n ? window.AppI18n.t("nav.top") : "Top" }
        ];

        let html = '';
        for (let i = 0; i < tabs.length; i++) {
            const t = tabs[i];
            const activeClass = t.id === activePage ? ' active' : '';
            const currentAttr = t.id === activePage ? ' aria-current="page"' : '';
            html += `<a href="${t.href}" class="bottom-tab${activeClass}"${currentAttr}>
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="${t.icon}"></i></span>
<span data-i18n="${t.i18n}">${t.label}</span>
</a>`;
        }

        const searchText = window.AppI18n ? window.AppI18n.t("nav.menu") : "Menú";
        html += `<button class="bottom-tab-search" aria-label="Buscar" type="button">
<span class="bottom-tab-icon" aria-hidden="true"><i data-lucide="menu"></i></span>
<span data-i18n="nav.menu">${searchText}</span>
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
            const searchBtn = nav.querySelector('.bottom-tab-search');
            if (searchBtn) searchBtn.classList.remove('is-open');
        });

        // Search toggle: show top navbar search
        const searchBtn = nav.querySelector('.bottom-tab-search');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const navbar = document.querySelector('.destiny-navbar');
                if (!navbar) return;
                const isOpen = navbar.classList.toggle('is-open');
                searchBtn.classList.toggle('is-open', isOpen);
                if (isOpen) {
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
        if (path.includes("login")) return;

        const ingresarText = window.AppI18n ? window.AppI18n.t("nav.ingresar") : "Ingresar";
        const invitadoText = window.AppI18n ? window.AppI18n.t("nav.usuario_invitado") : "...";
        el.innerHTML = `<div class="nav-user" id="nav-user">
<div id="nav-user-avatar" class="nav-user-avatar"></div>
<div class="nav-user-info">
<span id="nav-user-name" class="nav-user-name" data-i18n="nav.usuario_invitado">${invitadoText}</span>
<a id="nav-user-btn" href="Login.html" class="nav-user-btn" data-i18n="nav.ingresar">${ingresarText}</a>
</div>
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
        for (const name in colorKeys) {
            if (colorKeys.hasOwnProperty(name)) {
                const val = r(colorKeys[name], defaults[name]);
                root.style.setProperty(name, val);
            }
        }
        const navAccent = root.style.getPropertyValue('--nav-accent') || defaults['--nav-accent'];
        root.style.setProperty('--nav-accent-soft', `${navAccent}3d`);
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
    injectNavToggle();
    injectNavLinks();
    injectMobileBottomNav();
    injectLoginButton();
    injectFooter();
    installSecurityHandlers();

})();
