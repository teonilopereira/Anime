(function () {
    "use strict";

    // Ruta de portadas (proxy propio en el sitio publicado): la define
    // js/core/api-mangadex.js, que carga antes en el bundle.
    var MD_COVER_BASE = window.MD_COVER_BASE || 'https://uploads.mangadex.org/covers';

    var NO_COVER_PLACEHOLDER =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect fill='%231a0a2e' width='200' height='300'/%3E%3Ctext x='50%25' y='50%25' fill='%23a855f7' font-family='sans-serif' font-size='13' text-anchor='middle' dominant-baseline='middle'%3ESin portada%3C/text%3E%3C/svg%3E";

    // Caché de MangaDex en localStorage.
    // Las resoluciones (id de MangaDex, ediciones alternativas y mapa de
    // portadas por tomo) vencen a los 7 días: antes no vencían nunca, así que
    // un tomo nuevo o una portada corregida en MangaDex no llegaban jamás.
    // Se guardan envueltas como {"t": <ms>, "v": "<valor>"}; un valor viejo sin
    // envoltorio se trata como vencido y se vuelve a pedir una vez.
    var MD_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    var MD_TTL_PREFIXES = ['md_cov_map_v2_', 'md_alt_v1_', 'md_id_v3_'];
    var MD_PRUNE_PREFIXES = ['md_cov_', 'md_id_', 'md_alt_', 'md_chapvol_'];

    function startsWithAny(key, prefixes) {
        for (var i = 0; i < prefixes.length; i++) {
            if (String(key).indexOf(prefixes[i]) === 0) return true;
        }
        return false;
    }

    function parseEnvelope(raw) {
        if (!raw || raw.charAt(0) !== '{') return null;
        try {
            var o = JSON.parse(raw);
            if (o && typeof o.t === 'number' && typeof o.v === 'string') return o;
        } catch (_) {}
        return null;
    }

    // Lee una entrada; null si falta, venció o es del formato viejo.
    function cacheGet(key) {
        var raw;
        try { raw = localStorage.getItem(key); } catch (_) { return null; }
        if (raw == null) return null;
        if (!startsWithAny(key, MD_TTL_PREFIXES)) return raw;
        var env = parseEnvelope(raw);
        if (!env || Date.now() - env.t > MD_CACHE_TTL_MS) {
            try { localStorage.removeItem(key); } catch (_) {}
            return null;
        }
        return env.v;
    }

    // Antigüedad de una entrada para la poda: las que no tienen fecha
    // (formato viejo, portadas por tomo, mapa capítulo→tomo) cuentan como
    // las más viejas y se van primero.
    function entryTime(key) {
        try {
            var env = parseEnvelope(localStorage.getItem(key));
            return env ? env.t : 0;
        } catch (_) { return 0; }
    }

    // Ante cuota llena borra entradas de MangaDex de a tandas, de la más vieja
    // a la más nueva, hasta que entra el valor. Antes se borraba toda la caché
    // de portadas e ids de una, aunque bastara con liberar un poco.
    function safeCacheSet(key, value) {
        var stored = startsWithAny(key, MD_TTL_PREFIXES)
            ? JSON.stringify({ t: Date.now(), v: String(value) })
            : value;
        try {
            localStorage.setItem(key, stored);
            return true;
        } catch (e) {
            if (!(e && (e.name === 'QuotaExceededError' || e.code === 22))) return false;
        }
        var candidatas = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k !== key && startsWithAny(k, MD_PRUNE_PREFIXES)) candidatas.push({ k: k, t: entryTime(k) });
            }
        } catch (_) { return false; }
        candidatas.sort(function (a, b) { return a.t - b.t; });
        var tanda = Math.max(5, Math.ceil(candidatas.length * 0.2));
        while (candidatas.length) {
            candidatas.splice(0, tanda).forEach(function (c) {
                try { localStorage.removeItem(c.k); } catch (_) {}
            });
            try {
                localStorage.setItem(key, stored);
                return true;
            } catch (_) { /* sigue podando */ }
        }
        return false;
    }

    if (window.AnimeDestiny) {
        window.AnimeDestiny.internals = window.AnimeDestiny.internals || {};
        window.AnimeDestiny.internals.mdCache = {
            get: cacheGet, set: safeCacheSet, TTL_MS: MD_CACHE_TTL_MS
        };
    }

    /**
     * Cliente HTTP de MangaDex: la implementacion vive en js/core/api-mangadex.js
     * (bundle), que siempre carga antes que este archivo y ademas reintenta por
     * el proxy CORS cuando MangaDex bloquea el fetch directo. Antes aca habia una
     * copia de respaldo sin ese proxy que nunca llegaba a usarse.
     */
    function mdFetch(path) {
        return window.mdFetch(path);
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
            synopsis: desc || window.SIN_SINOPSIS || 'Sin sinopsis disponible.',
            status: typeof window.mdStatusToLocal === 'function'
                ? window.mdStatusToLocal(status)
                : ({ completed: 'FINISHED', ongoing: 'RELEASING', hiatus: 'HIATUS', cancelled: 'CANCELLED' }[status] || 'UNKNOWN'),
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
            staff: staffList,
            // Tiendas y sitio de la traducción oficial (attributes.links). Los
            // usa la sección "Dónde leer" de la ficha (js/detalle/watch-links.js).
            mangadexLinks: attrs.links || null
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

    // Idioma elegido en la app (Configuración → i18n). Default español.
    function currentUiLang() {
        try {
            if (window.AppI18n && typeof window.AppI18n.getLang === 'function') {
                return window.AppI18n.getLang();
            }
            return localStorage.getItem('pref:lang') || 'es';
        } catch (_) {
            return 'es';
        }
    }

    // Bucket de idioma para la portada: 'en' si la app está en inglés, 'es' si no.
    // Se usa además en la clave de caché para que al cambiar de idioma se
    // resuelva la portada del nuevo idioma en vez de servir la cacheada.
    function coverLangTag() {
        return String(currentUiLang() || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
    }

    // Prioridad de idioma para elegir la portada de un tomo cuando hay varias
    // ediciones (MangaDex guarda portadas por idioma). Sin esto se tomaba la
    // primera que llegara, que podía ser una edición en un idioma cualquiera
    // (p. ej. kazajo/cirílico). Se prioriza el idioma seleccionado en la app
    // (inglés o español), luego el otro, luego la original japonesa; cualquier
    // otro idioma queda de último recurso.
    function coverLocalePriority() {
        return coverLangTag() === 'en'
            ? ['en', 'es-la', 'es', 'es-419', 'ja', 'ja-ro']
            : ['es-la', 'es', 'es-419', 'en', 'ja', 'ja-ro'];
    }
    function coverLocaleRank(priority, locale) {
        var i = priority.indexOf(String(locale == null ? '' : locale).toLowerCase());
        return i === -1 ? priority.length + 1 : i;
    }

    // El endpoint /cover de MangaDex no filtra por volumen, así que traemos la
    // lista de portadas del manga y armamos un mapa volumen → archivo, quedándonos
    // con la portada del idioma de mayor prioridad para cada tomo.
    //
    // El orden `order[volume]=asc` es opcional: el mapa se completa igual
    // recorriendo todas las páginas. Se pide con orden y, si esa variante falla
    // (algunos proxies/redes rechazan el corchete anidado), se reintenta sin él
    // en vez de quedarse sin ninguna portada.
    async function fetchMangaDexCoverMap(mangaId) {
        var PAGE = 100;
        var MAX_COVERS = 300;

        async function pull(withOrder) {
            var map = {};
            var bestRank = {}; // volKey → rango de idioma ya elegido (menor = mejor)
            var priority = coverLocalePriority();
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
                    if (!volKey || !attrs.fileName) continue;
                    var rank = coverLocaleRank(priority, attrs.locale);
                    // Se guarda la primera de cada tomo y luego solo se reemplaza
                    // por una de idioma de mayor prioridad.
                    if (!(volKey in map) || rank < bestRank[volKey]) {
                        map[volKey] = attrs.fileName;
                        bestRank[volKey] = rank;
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
        // La v2 invalida los mapas cacheados antes de priorizar idioma (que
        // podían tener guardada la portada en un idioma cualquiera, p. ej. kazajo).
        // El bucket de idioma va en la clave: al cambiar es↔en se resuelve la
        // portada del nuevo idioma en vez de servir la del anterior.
        var mapKey = 'md_cov_map_v2_' + coverLangTag() + '_' + mangaId;
        try {
            var cachedMap = cacheGet(mapKey);
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
            var map = await getCoverUrlMapCached(mangaId);
            return map[normalizeVolKey(volNum)] || null;
        } catch (err) {
            console.warn('getMangaDexVolumeCover error:', err);
        }
        return null;
    }

    // Tipos de relación de MangaDex que son la MISMA obra en otra edición, así
    // que sus portadas por tomo sirven para completar huecos.
    var ALT_RELATION_TYPES = { alternate_version: 1, colored: 1 };
    var MAX_ALT_ENTRIES = 3;

    // IDs de las ediciones alternativas de un manga (p. ej. "Solo Leveling
    // (Book Version)" para el webtoon). Cacheado en localStorage; una lista
    // vacía también se cachea porque es una respuesta válida de MangaDex, pero
    // un error de red no (se reintenta en la próxima carga).
    var altIdsInFlight = {};
    function getAlternateMangaIds(mangaId) {
        var key = 'md_alt_v1_' + mangaId;
        try {
            var cached = cacheGet(key);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) return Promise.resolve(parsed);
            }
        } catch (_) { /* caché corrupta: se reintenta */ }
        if (!altIdsInFlight[mangaId]) {
            altIdsInFlight[mangaId] = mdFetch('/manga/' + encodeURIComponent(mangaId))
                .then(function (json) {
                    var rels = json?.data?.relationships || [];
                    var ids = [];
                    for (var i = 0; i < rels.length; i++) {
                        var r = rels[i];
                        if (r && r.type === 'manga' && ALT_RELATION_TYPES[r.related] &&
                            isMangaDexUuid(r.id) && ids.indexOf(r.id) < 0) {
                            ids.push(r.id);
                        }
                    }
                    ids = ids.slice(0, MAX_ALT_ENTRIES);
                    safeCacheSet(key, JSON.stringify(ids));
                    return ids;
                })
                .catch(function () { return []; })
                .finally(function () { delete altIdsInFlight[mangaId]; });
        }
        return altIdsInFlight[mangaId];
    }

    // Mapa { volKey: URL completa } de un manga. Primero las portadas de la
    // propia entrada; los tomos que no tienen portada se completan con las de
    // sus ediciones alternativas. Sin esto, obras cuya entrada principal solo
    // trae portadas de los primeros tomos (Solo Leveling webtoon: tomos 1-4,
    // mientras la Book Version tiene 1-18) mostraban la tapa de la serie, que
    // es la del tomo 1, en todos los demás.
    async function getCoverUrlMapCached(mangaId) {
        var out = {};
        var own = await getCoverMapCached(mangaId);
        for (var k in own) {
            if (own.hasOwnProperty(k) && own[k]) out[k] = MD_COVER_BASE + '/' + mangaId + '/' + own[k];
        }
        var altIds = [];
        try { altIds = await getAlternateMangaIds(mangaId); } catch (_) { altIds = []; }
        for (var i = 0; i < altIds.length; i++) {
            var altMap = {};
            try { altMap = await getCoverMapCached(altIds[i]); } catch (_) { altMap = {}; }
            for (var ak in altMap) {
                if (altMap.hasOwnProperty(ak) && altMap[ak] && !(ak in out)) {
                    out[ak] = MD_COVER_BASE + '/' + altIds[i] + '/' + altMap[ak];
                }
            }
        }
        return out;
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

        // IDs externos del ítem (AniList / MAL). MangaDex los publica en
        // attributes.links (al / mal), así que sirven para elegir la obra exacta
        // entre los resultados de la búsqueda por título.
        var alId = /^\d+$/.test(String(item.id || '')) ? String(item.id) : '';
        var malId = item.mal_id != null && /^\d+$/.test(String(item.mal_id)) ? String(item.mal_id) : '';

        // v2: antes se tomaba el PRIMER resultado de la búsqueda y quedaba
        // cacheado para siempre. En obras con varias entradas parecidas (novela,
        // spin-offs, ediciones a color) ese primero solía ser otra obra sin
        // portadas por tomo, y todos los tomos mostraban la misma tapa. La clave
        // nueva descarta esas resoluciones viejas; si hay id de AniList va por él.
        // v3: la v2 cacheaba la entrada vinculada a AniList aunque fuera la
        // edición a color, casi sin portadas por tomo.
        var cacheKey = alId
            ? 'md_id_v3_al_' + alId
            : 'md_id_v3_' + candidates[0].replace(/\s+/g, '_').toLowerCase();
        try {
            var cached = cacheGet(cacheKey);
            if (cached) return cached;
        } catch (_) {}

        // La ficha pide el id varias veces (portadas, conteo de tomos, "Mostrar
        // más"): se comparte la misma búsqueda en curso en vez de repetirla.
        // Si la búsqueda no encontró nada (p. ej. MangaDex no respondió), no se
        // guarda la promesa: el próximo pedido de la misma ficha vuelve a
        // intentar en vez de heredar el null hasta recargar la página.
        if (!resolveIdInFlight[cacheKey]) {
            resolveIdInFlight[cacheKey] = searchMangaDexIdByTitles(candidates, alId, malId, cacheKey)
                .then(function (id) {
                    if (!id) delete resolveIdInFlight[cacheKey];
                    return id;
                });
        }
        return resolveIdInFlight[cacheKey];
    }

    var resolveIdInFlight = {};

    async function searchMangaDexIdByTitles(candidates, alId, malId, cacheKey) {
        function linksMatch(result) {
            var links = result && result.mangadexLinks;
            if (!links) return false;
            if (alId && String(links.al || '') === alId) return true;
            if (malId && String(links.mal || '') === malId) return true;
            return false;
        }

        // Candidatos, en orden de preferencia: los que MangaDex vincula al id
        // de AniList/MAL, los de título idéntico a uno de los buscados, los que
        // lo contienen ("Demon Slayer: Kimetsu no Yaiba", "Bleach (Official
        // Colored)") y el resto de los resultados.
        var strong = [];
        var exact = [];
        var related = [];
        var others = [];
        var wantedList = candidates.map(function (c) { return c.toLowerCase(); });
        var seen = {};
        var wanted = {};
        candidates.forEach(function (c) { wanted[c.toLowerCase()] = 1; });
        for (var i = 0; i < candidates.length; i++) {
            try {
                var results = await searchMangaDex(candidates[i], 10);
                for (var j = 0; j < results.length; j++) {
                    var r = results[j];
                    if (!isMangaDexUuid(r.id) || seen[r.id]) continue;
                    seen[r.id] = 1;
                    var t = String(r.title || '').trim().toLowerCase();
                    if (linksMatch(r)) strong.push(r.id);
                    else if (wanted[t]) exact.push(r.id);
                    else if (wantedList.some(function (w) { return t.indexOf(w) >= 0; })) related.push(r.id);
                    else others.push(r.id);
                }
                // Con una coincidencia por id, o sin ids con qué desempatar,
                // alcanza con los resultados del primer título que responda.
                if (strong.length || ((exact.length || others.length) && !alId && !malId)) break;
            } catch (err) {
                console.warn('resolveMangaDexId search error:', err);
            }
        }
        var pool = strong.concat(exact, related).slice(0, 4);
        if (!pool.length) pool = others.slice(0, 3);
        if (pool.length <= 1) {
            if (strong.length) safeCacheSet(cacheKey, strong[0]);
            return pool[0] || null;
        }

        // MangaDex suele tener varias entradas de la misma obra: la normal, la
        // "Official Colored", la digital a color. Tomar la primera (o la única
        // vinculada a AniList, que a veces es la edición a color) dejaba a
        // Bleach y Kimetsu no Yaiba con portada solo para el tomo 1, y el resto
        // de los tomos con la tapa principal. Entre los candidatos se elige el
        // que tiene portadas para más tomos (los mapas quedan en caché y se
        // reusan); a igualdad gana el de mayor preferencia. Solo se cachea el id
        // si el elegido está vinculado por id.
        var best = pool[0];
        var bestCount = -1;
        for (var k = 0; k < pool.length; k++) {
            var count = 0;
            try {
                var map = await getCoverMapCached(pool[k]);
                for (var key in map) { if (map.hasOwnProperty(key)) count++; }
            } catch (_) { /* sin mapa: cuenta 0 */ }
            if (count > bestCount) { best = pool[k]; bestCount = count; }
        }
        if (strong.indexOf(best) >= 0) safeCacheSet(cacheKey, best);
        return best;
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
            return await getCoverUrlMapCached(mdId);
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
            try { covers = await getCoverUrlMapCached(mdId); } catch (_) { covers = {}; }

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
                    cover: file || null
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
            var covers = await getCoverUrlMapCached(mdId);
            if (!mapHasEntries(covers)) return null;
            var out = {};
            for (var cap in chapVol) {
                if (!chapVol.hasOwnProperty(cap)) continue;
                var file = covers[chapVol[cap]];
                if (file) out[cap] = file;
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
    // MangaDex genera miniaturas de cada tapa (<archivo>.256.jpg / .512.jpg).
    // En las grillas se usa la de 256 px (~15 KB contra 1-3 MB del original) y
    // el original queda en data-full para verla en grande.
    function mdThumbUrl(url) {
        return /\.(jpe?g|png|webp)$/i.test(url) ? url + '.256.jpg' : url;
    }

    // Pinta las tapas de a una, en orden de volumen y con pocas descargas a la
    // vez: cada cuadro cambia apenas su imagen terminó de bajar (sin quedar en
    // blanco mientras tanto), en vez de esperar a que lleguen todas.
    function paintCoversProgressively(targets, concurrency) {
        var next = 0;
        function worker() {
            if (next >= targets.length) return Promise.resolve();
            var t = targets[next++];
            return new Promise(function (resolve) {
                var thumb = mdThumbUrl(t.url);
                var pre = new Image();
                pre.referrerPolicy = 'no-referrer';
                pre.onload = function () {
                    t.img.src = thumb;
                    t.img.setAttribute('data-full', t.url);
                    resolve();
                };
                // Sin miniatura: se usa el original.
                pre.onerror = function () {
                    t.img.src = t.url;
                    t.img.setAttribute('data-full', t.url);
                    resolve();
                };
                pre.src = thumb;
            }).then(worker);
        }
        var workers = [];
        for (var w = 0; w < concurrency; w++) workers.push(worker());
        return Promise.all(workers);
    }

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
            // Primera carga con MangaDex saturado: un segundo intento a los
            // pocos segundos evita tener que recargar la página.
            if (!mapHasEntries(map) && !opts._retried) {
                await new Promise(function (resolve) { setTimeout(resolve, 3000); });
                return window.applyMangaDexVolumeCovers(Object.assign({}, opts, { _retried: true }));
            }
            if (!map) return;
            var imgs = grid.querySelectorAll(selector);
            var targets = [];
            for (var i = 0; i < imgs.length; i++) {
                var v = String(parseInt(imgs[i].getAttribute('data-vol'), 10));
                // Ya pintada (p. ej. al volver a llamar tras "Mostrar más").
                if (map[v] && imgs[i].getAttribute('data-full') !== map[v]) targets.push({ img: imgs[i], url: map[v] });
            }
            await paintCoversProgressively(targets, 4);
        } catch (e) { /* silencioso: queda la portada principal */ }
    };

    window.resolveMangaDexCoverForVolume = async function (item, volNum) {
        if (!item) return NO_COVER_PLACEHOLDER;

        if (volNum) {
            var mdId = await resolveMangaDexId(item);
            if (mdId) {
                var cacheKey = 'md_cov_v2_' + coverLangTag() + '_' + mdId + '_v' + volNum;
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

