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

    function mdFetch(path) {
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
            countryOfOrigin: attrs.originalLanguage || null
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

    window.buscarEnMangaDex = async function (query, type) {
        try {
            return await searchMangaDex(query, AnimeDestiny.Constants.MANGADEX_SEARCH_LIMIT || 5);
        } catch (err) {
            console.warn('MangaDex search error:', err);
            return [];
        }
    };

    window.getMangaDexById = async function (id) {
        try {
            var json = await mdFetch('/manga/' + encodeURIComponent(id) + '?includes[]=cover_art');
            return mdItemToLocal(json);
        } catch (err) {
            console.warn('MangaDex getById error:', err);
            return null;
        }
    };

    function isMangaDexUuid(str) {
        return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    }

    async function getMangaDexVolumeCover(mangaId, volNum) {
        if (!mangaId || !volNum) return null;
        try {
            var json = await mdFetch('/cover?manga[]=' + encodeURIComponent(mangaId) + '&volume[]=' + encodeURIComponent(String(volNum)) + '&limit=1');
            var items = json?.data || [];
            if (items.length > 0) {
                var fileName = items[0]?.attributes?.fileName;
                if (fileName) return MD_COVER_BASE + '/' + mangaId + '/' + fileName;
            }
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

