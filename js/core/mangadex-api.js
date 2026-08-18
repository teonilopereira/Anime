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
            staff: staffList,
            // Idiomas con traduccion disponible (para mostrar si hay 'es', etc.).
            availableTranslatedLanguages: (attrs.availableTranslatedLanguages || []).filter(Boolean)
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

    // MangaDex nombra las relaciones distinto que AniList. Se mapean a los mismos
    // tipos (en mayúscula) que usa buildRelatedHtml del detalle, así la sección
    // "Relacionados" los pinta igual sin distinguir la fuente.
    var MD_RELATED_TO_TYPE = {
        sequel: 'SEQUEL', prequel: 'PREQUEL', side_story: 'SIDE_STORY',
        spin_off: 'SPIN_OFF', main_story: 'PARENT', adapted_from: 'ADAPTATION',
        based_on: 'ADAPTATION', alternate_story: 'ALTERNATIVE',
        alternate_version: 'ALTERNATIVE', doujinshi: 'OTHER',
        same_franchise: 'OTHER', shared_universe: 'OTHER',
        colored: 'ALTERNATIVE', monochrome: 'ALTERNATIVE',
        serialization: 'OTHER', preserialization: 'OTHER'
    };

    // Relaciones de una obra: los relationships de tipo 'manga' traen id + el
    // tipo de relación pero NO el título/portada, así que se completan con un
    // único request batch (`/manga?ids[]=...`). Best-effort: sin títulos no se
    // pinta nada. Devuelve el formato de `relations` que espera el detalle.
    async function fetchMangaDexRelations(relationships) {
        var rels = (relationships || []).filter(function (r) {
            return r && r.type === 'manga' && r.related && MD_RELATED_TO_TYPE[r.related];
        });
        if (!rels.length) return [];
        var relType = {};
        var ids = [];
        rels.forEach(function (r) {
            if (ids.indexOf(r.id) === -1) { ids.push(r.id); relType[r.id] = MD_RELATED_TO_TYPE[r.related]; }
        });
        ids = ids.slice(0, 20);
        try {
            var params = '/manga?includes[]=cover_art&limit=' + ids.length +
                '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica';
            ids.forEach(function (id) { params += '&ids[]=' + encodeURIComponent(id); });
            var json = await mdFetch(params);
            return (json && json.data ? json.data : []).map(function (m) {
                var a = m.attributes || {};
                var title = getMangaDexTitle(a);
                if (!title) return null;
                return {
                    relationType: relType[m.id] || 'OTHER',
                    id: m.id,
                    title: title,
                    // format vacío para MangaDex → buildRelatedHtml lo cataloga como manga.
                    format: null,
                    chapters: chapterCount(a),
                    volumes: volumeCount(a),
                    img: getMangaDexCoverUrl(m, m.id)
                };
            }).filter(Boolean);
        } catch (e) {
            console.warn('MangaDex relations error:', e);
            return [];
        }
    }

    window.getMangaDexById = async function (id) {
        try {
            var json = await mdFetch('/manga/' + encodeURIComponent(id) + '?includes[]=cover_art&includes[]=author&includes[]=artist');
            var item = mdItemToLocal(json);
            if (!item) return null;

            // Los extras van en paralelo y son best-effort: si alguno falla la
            // ficha se muestra igual, solo que sin puntaje, sin cuadrícula o sin
            // relacionados.
            var extras = await Promise.allSettled([
                fetchMangaDexStats([id]),
                fetchMangaDexAggregate(id),
                fetchMangaDexRelations(json && json.data ? json.data.relationships : [])
            ]);

            if (extras[0].status === 'fulfilled') {
                var st = extras[0].value[id];
                if (st) {
                    item.score = st.score;
                    item.follows = st.follows;
                    // Distribución de votos: mismo formato que AniList (item 17).
                    if (Array.isArray(st.distribution) && st.distribution.length) {
                        item.scoreDistribution = st.distribution;
                    }
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

            if (extras[2].status === 'fulfilled' && Array.isArray(extras[2].value)) {
                item.relations = extras[2].value;
            } else if (extras[2].status === 'rejected') {
                console.warn('MangaDex relations error:', extras[2].reason);
            }

            return item;
        } catch (err) {
            console.warn('MangaDex getById error:', err);
            return null;
        }
    };

    // ─── Lista de capítulos (feed) y páginas (at-home) ───────────────────────
    // Habilitan el lector propio: el feed lista los capítulos publicados en un
    // idioma; at-home entrega los nombres de archivo de las páginas de un
    // capítulo, que se arman contra el baseUrl que devuelve MangaDex.

    // Capítulos de una obra en un idioma. Pagina hasta un tope razonable y
    // devuelve los capítulos "leíbles" (los que tienen páginas en MangaDex; los
    // marcados con externalUrl viven en otro sitio y no se pueden abrir acá).
    async function getMangaDexFeed(mangaId, lang, maxChapters) {
        if (!isMangaDexUuid(mangaId)) return [];
        var idioma = String(lang || getUserLang() || 'es').slice(0, 5);
        var tope = Number(maxChapters) > 0 ? Number(maxChapters) : 500;
        var PAGE = 100;
        var offset = 0;
        var total = Infinity;
        var out = [];
        try {
            while (offset < total && out.length < tope) {
                var path = '/manga/' + encodeURIComponent(mangaId) + '/feed' +
                    '?translatedLanguage[]=' + encodeURIComponent(idioma) +
                    '&order[volume]=asc&order[chapter]=asc' +
                    '&limit=' + PAGE + '&offset=' + offset +
                    '&includes[]=scanlation_group' +
                    '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica' +
                    '&contentRating[]=pornographic';
                var json = await mdFetch(path);
                total = Number(json && json.total) || 0;
                var items = (json && json.data) || [];
                if (!items.length) break;
                items.forEach(function (ch) {
                    var a = ch.attributes || {};
                    // externalUrl: el capítulo se lee en otra web (p.ej. la
                    // oficial). Sin páginas propias no se puede abrir en el lector.
                    if (a.externalUrl) return;
                    var grupo = '';
                    (ch.relationships || []).forEach(function (r) {
                        if (r.type === 'scanlation_group' && r.attributes && r.attributes.name) grupo = r.attributes.name;
                    });
                    out.push({
                        id: ch.id,
                        chapter: a.chapter || '',
                        volume: a.volume || '',
                        title: a.title || '',
                        lang: a.translatedLanguage || idioma,
                        pages: Number(a.pages) || 0,
                        publishAt: a.publishAt || a.readableAt || '',
                        group: grupo
                    });
                });
                offset += PAGE;
            }
        } catch (e) {
            console.warn('getMangaDexFeed error:', e);
        }
        // De-duplicar por número de capítulo (varios grupos suben el mismo): se
        // queda el primero, que por el orden es el de volumen/capítulo más bajo.
        var visto = {};
        return out.filter(function (c) {
            var k = (c.volume || '?') + '|' + (c.chapter || '?');
            if (visto[k]) return false;
            visto[k] = true;
            return true;
        });
    }
    window.getMangaDexFeed = getMangaDexFeed;

    // Idiomas de traducción disponibles para una obra, ordenados con 'es'/'en'
    // primero (los que más le sirven al lector). Se deriva de la ficha.
    window.getMangaDexLanguages = async function (mangaId) {
        if (!isMangaDexUuid(mangaId)) return [];
        try {
            var json = await mdFetch('/manga/' + encodeURIComponent(mangaId) + '?includes[]=cover_art');
            var langs = ((json && json.data && json.data.attributes && json.data.attributes.availableTranslatedLanguages) || [])
                .filter(Boolean);
            var pref = ['es', 'es-la', 'en'];
            langs.sort(function (a, b) {
                var ia = pref.indexOf(a); var ib = pref.indexOf(b);
                if (ia === -1) ia = 99; if (ib === -1) ib = 99;
                return ia - ib;
            });
            return langs;
        } catch (e) {
            console.warn('getMangaDexLanguages error:', e);
            return [];
        }
    };

    // Páginas de un capítulo. Devuelve las URLs completas listas para <img>.
    // dataSaver = versión comprimida (más liviana), útil en conexiones lentas.
    window.getMangaDexChapterPages = async function (chapterId, dataSaver) {
        if (!isMangaDexUuid(chapterId)) return [];
        try {
            var json = await mdFetch('/at-home/server/' + encodeURIComponent(chapterId));
            var base = json && json.baseUrl;
            var chap = json && json.chapter;
            if (!base || !chap || !chap.hash) return [];
            var modo = dataSaver ? 'data-saver' : 'data';
            var files = dataSaver ? (chap.dataSaver || []) : (chap.data || []);
            return files.map(function (fn) {
                return base + '/' + modo + '/' + chap.hash + '/' + fn;
            });
        } catch (e) {
            console.warn('getMangaDexChapterPages error:', e);
            return [];
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

    // El endpoint /cover de MangaDex no filtra por volumen, así que
    // traemos la lista de portadas del manga y armamos un mapa volumen → archivo.
    async function fetchMangaDexCoverMap(mangaId) {
        var map = {};
        var PAGE = 100;
        var MAX_COVERS = 300;
        var offset = 0;
        var total = 0;
        do {
            var json = await mdFetch('/cover?manga[]=' + encodeURIComponent(mangaId) + '&limit=' + PAGE + '&offset=' + offset + '&order[volume]=asc');
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

    async function getMangaDexVolumeCover(mangaId, volNum) {
        if (!mangaId || !volNum) return null;
        try {
            var mapKey = 'md_cov_map_' + mangaId;
            var map = null;
            try {
                var cachedMap = localStorage.getItem(mapKey);
                if (cachedMap) map = JSON.parse(cachedMap);
            } catch (_) { map = null; }

            if (!map) {
                map = await fetchMangaDexCoverMap(mangaId);
                safeCacheSet(mapKey, JSON.stringify(map));
            }

            var fileName = map[normalizeVolKey(volNum)];
            if (fileName) return MD_COVER_BASE + '/' + mangaId + '/' + fileName;
        } catch (err) {
            console.warn('getMangaDexVolumeCover error:', err);
        }
        return null;
    }

    async function resolveMangaDexId(item) {
        if (!item) return null;
        if (isMangaDexUuid(item.id)) return item.id;
        if (isMangaDexUuid(item.mangadex_id)) return item.mangadex_id;
        if (isMangaDexUuid(item.mangaDexId)) return item.mangaDexId;
        var title = item?.titulo || item?.title || '';
        if (!title) return null;

        var cacheKey = 'md_id_' + title.replace(/\s+/g, '_').toLowerCase();
        try {
            var cached = localStorage.getItem(cacheKey);
            if (cached) return cached;
        } catch (_) {}

        try {
            var results = await searchMangaDex(title, 1);
            if (results.length > 0 && isMangaDexUuid(results[0].id)) {
                var mdId = results[0].id;
                safeCacheSet(cacheKey, mdId);
                return mdId;
            }
        } catch (err) {
            console.warn('resolveMangaDexId search error:', err);
        }
        return null;
    }
    // Expuesto para el lector (lector.js): resuelve el UUID de MangaDex a partir
    // del item de la ficha (id de AniList o título).
    window.resolveMangaDexId = resolveMangaDexId;

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

