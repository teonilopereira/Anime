(function () {
    "use strict";

    var MD_BASE = 'https://api.mangadex.org';
    var MD_COVER_BASE = 'https://uploads.mangadex.org/covers';
    var REQUEST_TIMEOUT = AnimeDestiny.Constants.REQUEST_TIMEOUT_MS || 12000;

    var NO_COVER_PLACEHOLDER =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect fill='%231a0a2e' width='200' height='300'/%3E%3Ctext x='50%25' y='50%25' fill='%23a855f7' font-family='sans-serif' font-size='13' text-anchor='middle' dominant-baseline='middle'%3ESin portada%3C/text%3E%3C/svg%3E";

    function safeCacheSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // Si el almacenamiento local se llena (QuotaExceededError)
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // Eliminar claves antiguas de MangaDex para liberar espacio
                try {
                    for (var i = localStorage.length - 1; i >= 0; i--) {
                        var k = localStorage.key(i);
                        if (k && (k.indexOf('md_cov_') === 0 || k.indexOf('md_id_') === 0)) {
                            localStorage.removeItem(k);
                        }
                    }
                    // Reintentar guardar
                    localStorage.setItem(key, value);
                } catch (_) {}
            }
        }
    }

    /**
     * Cliente HTTP de MangaDex.
     *
     * Este archivo tenia su propia copia, practicamente identica a la de
     * js/core/api.js (mismo AbortController, mismo timeout, mismo manejo de
     * errores): dos implementaciones que habia que arreglar por duplicado.
     * Ahora se usa la del bundle, que siempre esta cargada antes que este
     * script. El fallback local queda por si alguien carga este archivo suelto.
     */
    function mdFetch(path) {
        if (typeof window.mdFetch === 'function') return window.mdFetch(path);

        return new Promise(function (resolve, reject) {
            var controller = new AbortController();
            var timer = setTimeout(function () {
                controller.abort();
                reject(new Error('Timeout'));
            }, REQUEST_TIMEOUT);

            fetch(MD_BASE + path, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            }).then(function (res) {
                clearTimeout(timer);
                if (!res.ok) {
                    return res.text().then(function (text) {
                        reject(new Error('MangaDex HTTP ' + res.status + ': ' + text.slice(0, 200)));
                    });
                }
                return res.json();
            }).then(function (json) {
                if (json.errors) {
                    reject(new Error('MangaDex error: ' + (json.errors[0]?.detail || 'Unknown')));
                    return;
                }
                resolve(json);
            }).catch(function (err) {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    function getUserLang() {
        return (localStorage.getItem('pref:lang') || 'es').slice(0, 2);
    }

    function getMangaDexTitle(attrs) {
        var title = attrs?.title;
        if (!title) return '';
        var lang = getUserLang();
        return title[lang] || title?.en || title?.['ja-ro'] || title?.ja || title?.['ko-ro'] || title?.ko || title?.['zh-ro'] || title?.zh || Object.values(title)[0] || '';
    }

    function getMangaDexDescription(attrs) {
        var desc = attrs?.description;
        if (!desc) return '';
        var lang = getUserLang();
        return desc[lang] || desc?.en || Object.values(desc)[0] || '';
    }

    function getMangaDexCoverUrl(data, mangaId) {
        if (!data) return NO_COVER_PLACEHOLDER;
        var rels = data.relationships || [];
        var coverArt = rels.find(function (r) { return r.type === 'cover_art'; });
        if (coverArt?.attributes?.fileName) {
            return MD_COVER_BASE + '/' + mangaId + '/' + coverArt.attributes.fileName;
        }
        return NO_COVER_PLACEHOLDER;
    }

    function chapterCount(attrs) {
        var lastChapter = attrs?.lastChapter;
        if (lastChapter) {
            var n = Number(lastChapter);
            if (Number.isFinite(n) && n > 0) return Math.ceil(n);
        }
        return 0;
    }

    function volumeCount(attrs) {
        var lastVolume = attrs?.lastVolume;
        if (lastVolume) {
            var n = Number(lastVolume);
            if (Number.isFinite(n) && n > 0) return Math.ceil(n);
        }
        return 0;
    }

    function tagsToGenres(tags) {
        return (tags || []).filter(function (t) {
            return t.attributes?.group === 'genre' || t.attributes?.group === 'theme';
        }).map(function (t) {
            var name = t.attributes?.name;
            return { name: (name?.en || Object.values(name || {})[0] || '') };
        }).filter(function (g) { return g.name; });
    }

    function mdItemToLocal(mangaJson) {
        if (!mangaJson?.data) return null;
        var data = mangaJson.data;
        if (data.type !== 'manga') return null;
        var attrs = data.attributes || {};
        var mangaId = data.id;
        var title = getMangaDexTitle(attrs);
        var desc = getMangaDexDescription(attrs);
        var coverUrl = getMangaDexCoverUrl(data, mangaId);
        var genreList = tagsToGenres(attrs.tags);
        var chCnt = chapterCount(attrs);
        var volCnt = volumeCount(attrs);
        var status = attrs.status || 'unknown';

        var friendlyType = 'Manga';
        var lang = String(attrs.originalLanguage || '').toLowerCase();
        if (lang === 'ko') {
            friendlyType = 'Manhwa';
        } else if (lang === 'zh' || lang === 'zh-hk' || lang === 'zh-tw') {
            friendlyType = 'Manhua';
        } else {
            var hasDoujinshi = (attrs.tags || []).some(function (t) {
                var nameEn = String(t.attributes?.name?.en || '').toLowerCase();
                return nameEn === 'doujinshi';
            });
            var hasOneShot = (attrs.tags || []).some(function (t) {
                var nameEn = String(t.attributes?.name?.en || '').toLowerCase();
                return nameEn === 'one shot' || nameEn === 'oneshot';
            });
            if (hasDoujinshi) {
                friendlyType = 'Doujinshi';
            } else if (hasOneShot) {
                friendlyType = 'One-shot';
            }
        }

        // Autor y artista vienen como relationships, con nombre solo si la
        // peticion los pidio con includes[] (getMangaDexById lo hace). Mismo
        // formato que el staff de AniList para que quien lo muestre no tenga
        // que distinguir fuentes.
        var staffList = [];
        (data.relationships || []).forEach(function (r) {
            if ((r.type === 'author' || r.type === 'artist') && r.attributes?.name) {
                staffList.push({ role: r.type === 'author' ? 'Story' : 'Art', name: r.attributes.name });
            }
        });

        return {
            id: mangaId,
            mal_id: null,
            title: title,
            title_english: title,
            synopsis: desc || 'Sin sinopsis disponible.',
            status: status === 'completed' ? 'FINISHED' : (status === 'ongoing' ? 'RELEASING' : (status === 'hiatus' ? 'HIATUS' : 'UNKNOWN')),
            type: friendlyType,
            episodes: 0,
            chapters: chCnt,
            volumes: volCnt,
            score: null,
            images: {
                webp: { large_image_url: coverUrl, image_url: coverUrl },
                jpg: { large_image_url: coverUrl, image_url: coverUrl }
            },
            genres: genreList,
            themes: [],
            studios: [],
            relations: [],
            season: null,
            seasonYear: null,
            source: null,
            duration: null,
            countryOfOrigin: attrs.originalLanguage || null,
            // MangaDex trae el año de publicacion directo en attributes.year.
            startYear: Number(attrs.year) || null,
            endYear: null,
            staff: staffList
        };
    }

    function searchMangaDex(query, limit) {
        var q = encodeURIComponent(String(query || '').trim());
        if (!q) return Promise.resolve([]);
        var path = '/manga?title=' + q + '&limit=' + (limit || AnimeDestiny.Constants.MANGADEX_SEARCH_LIMIT || 5) + '&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica';
        return mdFetch(path).then(function (json) {
            var results = json?.data || [];
            return results.map(function (manga) {
                return mdItemToLocal({ data: manga });
            }).filter(Boolean);
        });
    }
    // Expuesto para el fallback por titulo de la ficha (interactions.js): cuando
    // el id no resuelve, se rescata la obra buscandola por nombre.
    window.searchMangaDex = searchMangaDex;

    // Puntaje y seguidores: la implementacion vive en js/core/api.js (bundle),
    // igual que mdFetch, porque el catalogo la necesita en paginas que no cargan
    // este archivo. Aca solo se usa.
    function fetchMangaDexStats(ids) {
        if (typeof window.fetchMangaDexStats !== 'function') return Promise.resolve({});
        return window.fetchMangaDexStats(ids);
    }

    /**
     * Volumenes y capitulos reales de una obra (`/manga/{id}/aggregate`).
     *
     * `attributes.lastVolume` / `lastChapter` vienen vacios en la mayoria de las
     * obras en publicacion, asi que la ficha se quedaba en 0 volumenes y no
     * dibujaba la cuadricula de progreso. El aggregate lista lo que existe de
     * verdad, capitulo por capitulo.
     */
    async function fetchMangaDexAggregate(id) {
        var json = await mdFetch('/manga/' + encodeURIComponent(id) + '/aggregate');
        var volumes = json?.volumes || {};
        var maxVol = 0;
        var maxCap = 0;
        var capsDistintos = 0;
        Object.keys(volumes).forEach(function (volKey) {
            var v = Number(volKey);
            if (Number.isFinite(v) && v > maxVol) maxVol = v;
            var caps = volumes[volKey]?.chapters || {};
            Object.keys(caps).forEach(function (capKey) {
                capsDistintos++;
                var c = Number(capKey);
                if (Number.isFinite(c) && c > maxCap) maxCap = c;
            });
        });
        return {
            volumes: Math.floor(maxVol),
            // El numero del ultimo capitulo describe mejor el avance que la
            // cantidad de entradas: los capitulos .5 y los huecos sin subir
            // harian que el total no coincida con la numeracion real.
            chapters: Math.floor(maxCap) || capsDistintos
        };
    }
    window.fetchMangaDexAggregate = fetchMangaDexAggregate;

    window.getMangaDexById = async function (id) {
        try {
            var json = await mdFetch('/manga/' + encodeURIComponent(id) + '?includes[]=cover_art&includes[]=author&includes[]=artist');
            var item = mdItemToLocal(json);
            if (!item) return null;

            // Los dos extras van en paralelo y son best-effort: si alguno falla
            // la ficha se muestra igual, solo que sin puntaje o sin cuadricula.
            var extras = await Promise.allSettled([
                fetchMangaDexStats([id]),
                fetchMangaDexAggregate(id)
            ]);

            if (extras[0].status === 'fulfilled') {
                var st = extras[0].value[id];
                if (st) {
                    item.score = st.score;
                    item.follows = st.follows;
                }
            } else {
                console.warn('MangaDex statistics error:', extras[0].reason);
            }

            if (extras[1].status === 'fulfilled') {
                var agg = extras[1].value;
                // Solo se completa lo que falta: si la obra declara lastVolume,
                // ese dato es el oficial y le gana al conteo de subidas.
                if (!item.volumes && agg.volumes) item.volumes = agg.volumes;
                if (!item.chapters && agg.chapters) item.chapters = agg.chapters;
            } else {
                console.warn('MangaDex aggregate error:', extras[1].reason);
            }

            return item;
        } catch (err) {
            console.warn('MangaDex getById error:', err);
            return null;
        }
    };

    function isMangaDexUuid(str) {
        return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    }

    function normalizeVolKey(value) {
        if (value === null || value === undefined) return '';
        var num = Number(value);
        if (!isNaN(num)) return String(num);
        return String(value).trim().toLowerCase();
    }

    // El endpoint /cover de MangaDex no filtra por volumen, así que traemos la
    // lista de portadas del manga y armamos un mapa volumen → archivo.
    //
    // El orden `order[volume]=asc` es opcional: solo decide qué portada se elige
    // cuando un tomo tiene varias (ediciones/idiomas); el mapa se completa igual
    // recorriendo todas las páginas. Se pide con orden y, si esa variante falla
    // (algunos proxies/redes rechazan el corchete anidado), se reintenta sin él
    // en vez de quedarse sin ninguna portada.
    async function fetchMangaDexCoverMap(mangaId) {
        var PAGE = 100;
        var MAX_COVERS = 300;

        async function pull(withOrder) {
            var map = {};
            var offset = 0;
            var total = 0;
            do {
                var path = '/cover?manga[]=' + encodeURIComponent(mangaId) +
                    '&limit=' + PAGE + '&offset=' + offset +
                    (withOrder ? '&order[volume]=asc' : '');
                var json = await mdFetch(path);
                var items = json?.data || [];
                total = Number(json?.total || 0);
                for (var i = 0; i < items.length; i++) {
                    var attrs = items[i]?.attributes || {};
                    var volKey = normalizeVolKey(attrs.volume);
                    if (volKey && attrs.fileName && !(volKey in map)) {
                        map[volKey] = attrs.fileName;
                    }
                }
                if (!items.length) break;
                offset += PAGE;
            } while (offset < total && offset < MAX_COVERS);
            return map;
        }

        try {
            return await pull(true);
        } catch (err) {
            console.warn('fetchMangaDexCoverMap: reintento sin order[volume]:', err);
            return await pull(false);
        }
    }

    function mapHasEntries(map) {
        if (!map || typeof map !== 'object') return false;
        for (var k in map) { if (map.hasOwnProperty(k)) return true; }
        return false;
    }

    // Lee el mapa de portadas por volumen (cacheado en localStorage). NUNCA
    // cachea un mapa vacío: si el fetch falla o vuelve sin portadas, dejar `{}`
    // guardado lo envenenaba para siempre (un objeto vacío es "truthy", así que
    // la caché nunca se consideraba un miss y no se reintentaba). Ahora un mapa
    // vacío se trata como miss, se reintenta en la próxima carga y solo se
    // cachea cuando trae portadas de verdad.
    async function getCoverMapCached(mangaId) {
        var mapKey = 'md_cov_map_' + mangaId;
        try {
            var cachedMap = localStorage.getItem(mapKey);
            if (cachedMap) {
                var parsed = JSON.parse(cachedMap);
                if (mapHasEntries(parsed)) return parsed;
            }
        } catch (_) { /* caché corrupta: se reintenta */ }

        var map = await fetchMangaDexCoverMap(mangaId);
        if (mapHasEntries(map)) safeCacheSet(mapKey, JSON.stringify(map));
        return map || {};
    }

    async function getMangaDexVolumeCover(mangaId, volNum) {
        if (!mangaId || !volNum) return null;
        try {
            var map = await getCoverMapCached(mangaId);
            var fileName = map[normalizeVolKey(volNum)];
            if (fileName) return MD_COVER_BASE + '/' + mangaId + '/' + fileName;
        } catch (err) {
            console.warn('getMangaDexVolumeCover error:', err);
        }
        return null;
    }

    // Junta todos los títulos que trae el ítem (principal, inglés, romaji,
    // nativo), sin repetir y sin vacíos. AniList entrega el título en un idioma
    // y MangaDex indexa por otro, así que buscar por uno solo fallaba en obras
    // cuyo nombre difiere entre fuentes; probar varios sube mucho el acierto.
    function mangaTitleCandidates(item) {
        if (!item) return [];
        var raw = [
            item.titulo, item.title, item.title_english, item.titleEnglish,
            item.romaji, item.title_romaji, item.native, item.title_native
        ];
        var seen = {};
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var t = String(raw[i] == null ? '' : raw[i]).trim();
            if (!t) continue;
            var key = t.toLowerCase();
            if (seen[key]) continue;
            seen[key] = 1;
            out.push(t);
        }
        return out;
    }

    async function resolveMangaDexId(item) {
        if (!item) return null;
        if (isMangaDexUuid(item.id)) return item.id;
        if (isMangaDexUuid(item.mangadex_id)) return item.mangadex_id;
        if (isMangaDexUuid(item.mangaDexId)) return item.mangaDexId;

        var candidates = mangaTitleCandidates(item);
        if (!candidates.length) return null;

        // La caché va por el título principal para no desincronizarse con las
        // claves ya guardadas: si ese título ya se resolvió antes, listo.
        var cacheKey = 'md_id_' + candidates[0].replace(/\s+/g, '_').toLowerCase();
        try {
            var cached = localStorage.getItem(cacheKey);
            if (cached) return cached;
        } catch (_) {}

        for (var i = 0; i < candidates.length; i++) {
            try {
                var results = await searchMangaDex(candidates[i], 1);
                if (results.length > 0 && isMangaDexUuid(results[0].id)) {
                    var mdId = results[0].id;
                    safeCacheSet(cacheKey, mdId);
                    return mdId;
                }
            } catch (err) {
                console.warn('resolveMangaDexId search error:', err);
            }
        }
        return null;
    }

    // Resuelve el manga en MangaDex (por UUID directo o por título) y devuelve el
    // mapa completo { volKey: urlPortada } de una sola vez, reutilizando el mismo
    // mapa cacheado que usa getMangaDexVolumeCover. Pensado para pintar la lista
    // de volúmenes del modal con la portada específica de cada uno, incluso
    // cuando el ítem viene de AniList (id numérico) y no trae el UUID.
    window.resolveMangaDexVolumeCoverMap = async function (item) {
        if (!item) return null;
        var mdId = await resolveMangaDexId(item);
        if (!mdId) return null;
        try {
            var map = await getCoverMapCached(mdId);
            var out = {};
            for (var k in map) {
                if (map.hasOwnProperty(k) && map[k]) {
                    out[k] = MD_COVER_BASE + '/' + mdId + '/' + map[k];
                }
            }
            return out;
        } catch (err) {
            console.warn('resolveMangaDexVolumeCoverMap error:', err);
            return null;
        }
    };

    // Detalle por VOLUMEN para la página de volúmenes (volumenes.html): resuelve
    // el manga (UUID directo o por título AniList) y combina el aggregate
    // (capítulos que incluye cada tomo) con el mapa volumen → portada. Devuelve
    // un objeto { volKey: { count, first, last, cover } } donde `count` es la
    // cantidad de capítulos del tomo, `first`/`last` el rango de capítulos y
    // `cover` la URL de la portada real del tomo (o null). Best-effort: si el
    // título no resuelve o MangaDex no responde, devuelve null y la página cae a
    // la información genérica.
    window.resolveMangaDexVolumeDetails = async function (item) {
        if (!item) return null;
        var mdId = await resolveMangaDexId(item);
        if (!mdId) return null;
        try {
            var json = await mdFetch('/manga/' + encodeURIComponent(mdId) + '/aggregate');
            var volumes = json?.volumes || {};
            var covers = {};
            try { covers = await getCoverMapCached(mdId); } catch (_) { covers = {}; }

            var out = {};
            Object.keys(volumes).forEach(function (volKey) {
                var volNum = normalizeVolKey(volKey);
                if (!volNum || volNum === 'none') return;
                var caps = volumes[volKey]?.chapters || {};
                var capNums = Object.keys(caps)
                    .map(function (c) { return Number(c); })
                    .filter(function (c) { return Number.isFinite(c); })
                    .sort(function (a, b) { return a - b; });
                var file = covers[volNum];
                out[volNum] = {
                    count: Object.keys(caps).length,
                    first: capNums.length ? capNums[0] : null,
                    last: capNums.length ? capNums[capNums.length - 1] : null,
                    cover: file ? (MD_COVER_BASE + '/' + mdId + '/' + file) : null
                };
            });
            return out;
        } catch (err) {
            console.warn('resolveMangaDexVolumeDetails error:', err);
            return null;
        }
    };

    // MangaDex solo tiene portadas por VOLUMEN, nunca por capítulo. Para que un
    // capítulo muestre "su" foto usamos la del tomo que lo contiene. El endpoint
    // /manga/{id}/aggregate lista, tomo por tomo, qué capítulos incluye; con eso
    // armamos el mapa capítulo → volumen. Cacheado en localStorage (nunca un mapa
    // vacío, mismo criterio que getCoverMapCached) para no repegarle al aggregate
    // en cada apertura del modal.
    async function fetchMangaDexChapterVolumeMap(mangaId) {
        var json = await mdFetch('/manga/' + encodeURIComponent(mangaId) + '/aggregate');
        var volumes = json?.volumes || {};
        var map = {};
        Object.keys(volumes).forEach(function (volKey) {
            var volNum = normalizeVolKey(volKey);
            // "none" / vacío = capítulos sueltos sin tomo asignado: no tienen
            // portada de volumen que mostrar, así que se saltan.
            if (!volNum || volNum === 'none') return;
            var caps = volumes[volKey]?.chapters || {};
            Object.keys(caps).forEach(function (capKey) {
                var capNum = String(parseInt(capKey, 10));
                if (capNum !== 'NaN' && !(capNum in map)) map[capNum] = volNum;
            });
        });
        return map;
    }

    async function getChapterVolumeMapCached(mangaId) {
        var mapKey = 'md_chapvol_map_' + mangaId;
        try {
            var cached = localStorage.getItem(mapKey);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (mapHasEntries(parsed)) return parsed;
            }
        } catch (_) { /* caché corrupta: se reintenta */ }

        var map = await fetchMangaDexChapterVolumeMap(mangaId);
        if (mapHasEntries(map)) safeCacheSet(mapKey, JSON.stringify(map));
        return map || {};
    }

    // Resuelve el manga (por UUID directo o por título AniList) y devuelve el mapa
    // { capítulo → URL de portada del tomo que lo contiene }, combinando el mapa
    // capítulo→volumen (aggregate) con el mapa volumen→portada que ya usa la
    // grilla de volúmenes. Silencioso ante error: devuelve null y cada capítulo
    // se queda con la portada principal.
    window.resolveMangaDexChapterCoverMap = async function (item) {
        if (!item) return null;
        var mdId = await resolveMangaDexId(item);
        if (!mdId) return null;
        try {
            var chapVol = await getChapterVolumeMapCached(mdId);
            if (!mapHasEntries(chapVol)) return null;
            var covers = await getCoverMapCached(mdId);
            if (!mapHasEntries(covers)) return null;
            var out = {};
            for (var cap in chapVol) {
                if (!chapVol.hasOwnProperty(cap)) continue;
                var file = covers[chapVol[cap]];
                if (file) out[cap] = MD_COVER_BASE + '/' + mdId + '/' + file;
            }
            return out;
        } catch (err) {
            console.warn('resolveMangaDexChapterCoverMap error:', err);
            return null;
        }
    };

    // Pinta sobre las <img data-chap> la portada del volumen que contiene cada
    // capítulo. Mismo contrato best-effort que applyMangaDexVolumeCovers.
    window.applyMangaDexChapterCovers = async function (opts) {
        opts = opts || {};
        var grid = opts.grid;
        var item = opts.item;
        if (!grid || !item || typeof window.resolveMangaDexChapterCoverMap !== 'function') return;
        var selector = opts.selector || 'img[data-chap]';
        try {
            var map = await window.resolveMangaDexChapterCoverMap(item);
            if (!map) return;
            var imgs = grid.querySelectorAll(selector);
            for (var i = 0; i < imgs.length; i++) {
                var c = String(parseInt(imgs[i].getAttribute('data-chap'), 10));
                if (map[c]) imgs[i].src = map[c];
            }
        } catch (e) { /* silencioso: queda la portada principal */ }
    };

    // Pinta la portada REAL de cada volumen (MangaDex) sobre las <img data-vol>
    // que haya dentro de `grid`. Best-effort y silencioso: si el título no
    // resuelve, MangaDex no responde o no tiene portada de ese tomo, cada imagen
    // se queda con el src que ya traía (la portada principal). Lo comparten el
    // modal de la card (chapters-modal.js) y la grilla de volúmenes del detalle
    // (render.js) para no duplicar la lógica ni la caché.
    window.applyMangaDexVolumeCovers = async function (opts) {
        opts = opts || {};
        var grid = opts.grid;
        var item = opts.item;
        if (!grid || !item || typeof window.resolveMangaDexVolumeCoverMap !== 'function') return;
        var selector = opts.selector || 'img[data-vol]';
        try {
            var map = await window.resolveMangaDexVolumeCoverMap(item);
            if (!map) return;
            var imgs = grid.querySelectorAll(selector);
            for (var i = 0; i < imgs.length; i++) {
                var v = String(parseInt(imgs[i].getAttribute('data-vol'), 10));
                if (map[v]) imgs[i].src = map[v];
            }
        } catch (e) { /* silencioso: queda la portada principal */ }
    };

    window.resolveMangaDexCoverForVolume = async function (item, volNum) {
        if (!item) return NO_COVER_PLACEHOLDER;

        if (volNum) {
            var mdId = await resolveMangaDexId(item);
            if (mdId) {
                var cacheKey = 'md_cov_' + mdId + '_v' + volNum;
                try {
                    var cached = localStorage.getItem(cacheKey);
                    if (cached) return cached;
                } catch (_) {}

                var volCover = await getMangaDexVolumeCover(mdId, volNum);
                if (volCover) {
                    safeCacheSet(cacheKey, volCover);
                    return volCover;
                }
            }
        }

        return null;
    };

})();

