(function () {
    "use strict";

    var ANILIST_ENDPOINT = 'https://graphql.anilist.co';

    function getEl(id) { return document.getElementById(id); }

    function malFetch(query, variables) {
        return fetch(ANILIST_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: query, variables: variables })
        }).then(function (res) {
            if (!res.ok) throw new Error('AniList HTTP ' + res.status);
            return res.json();
        }).then(function (json) {
            if (json.errors) throw new Error(json.errors[0]?.message || 'AniList error');
            return json;
        });
    }

    var BATCH_QUERY = '\
        query ($ids: [Int], $type: MediaType) {\
            Page(page: 1, perPage: 50) {\
                media(idMal_in: $ids, type: $type) {\
                    id\
                    idMal\
                }\
            }\
        }';

    function parseMalXml(xmlText) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'text/xml');
        var parseError = doc.querySelector('parsererror');
        if (parseError) throw new Error('XML inválido: ' + parseError.textContent);

        var animeList = [], mangaList = [];
        var animeNodes = doc.querySelectorAll('anime');
        var mangaNodes = doc.querySelectorAll('manga');

        animeNodes.forEach(function (node) {
            var id = Number(node.querySelector('series_animedb_id')?.textContent);
            if (!id) return;
            animeList.push({
                malId: id,
                title: node.querySelector('series_title')?.textContent || '',
                status: node.querySelector('my_status')?.textContent || '',
                watchedEp: Number(node.querySelector('my_watched_episodes')?.textContent) || 0,
                totalEp: Number(node.querySelector('my_episodes')?.textContent) || 0
            });
        });

        mangaNodes.forEach(function (node) {
            var id = Number(node.querySelector('series_mangadb_id')?.textContent);
            if (!id) return;
            mangaList.push({
                malId: id,
                title: node.querySelector('series_title')?.textContent || '',
                status: node.querySelector('my_status')?.textContent || '',
                readCh: Number(node.querySelector('my_read_chapters')?.textContent) || 0,
                readVol: Number(node.querySelector('my_read_volumes')?.textContent) || 0,
                totalVol: Number(node.querySelector('my_volumes')?.textContent) || 0
            });
        });

        return { anime: animeList, manga: mangaList };
    }

    function shouldMarkViewed(status) {
        return status === 'Completed';
    }

    // MAL my_status → estado de seguimiento de la app
    function malStatusToWatchStatus(status) {
        switch (status) {
            case 'Watching':
            case 'Reading':       return 'viendo';
            case 'Plan to Watch':
            case 'Plan to Read':  return 'pendiente';
            case 'On-Hold':       return 'pausado';
            case 'Dropped':       return 'abandonado';
            default:              return '';
        }
    }

    function batchLookupAnilistIds(entries, mediaType) {
        if (!entries.length) return Promise.resolve({});
        var ids = entries.map(function (e) { return e.malId; });
        var chunks = [];
        for (var i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

        return chunks.reduce(function (chain, chunk) {
            return chain.then(function (acc) {
                return malFetch(BATCH_QUERY, { ids: chunk, type: mediaType }).then(function (json) {
                    var media = json?.data?.Page?.media || [];
                    media.forEach(function (m) {
                        if (m.idMal) acc[m.idMal] = m.id;
                    });
                    return acc;
                }).catch(function () { return acc; });
            });
        }, Promise.resolve({}));
    }

    function saveItemState(supabase, category, anilistId, viewed, watchStatus) {
        return supabase.saveItemState({
            category: category,
            itemId: String(anilistId),
            fav: false,
            viewed: viewed,
            meta: {},
            watchStatus: watchStatus || ''
        });
    }

    function saveProgressesSequential(client, category, itemId, keys, value) {
        if (!keys.length) return Promise.resolve();
        return keys.reduce(function (chain, key) {
            return chain.then(function () {
                return client.setProgress({ category: category, itemId: itemId, key: key, value: value });
            });
        }, Promise.resolve());
    }

    var importState = { running: false };

    function initMalImport() {
        var fileInput = getEl('malFileInput');
        var previewBtn = getEl('previewMalBtn');
        var importBtn = getEl('importMalBtn');
        var previewArea = getEl('malPreviewArea');
        var progressArea = getEl('malImportProgress');
        var resultArea = getEl('malImportResult');

        if (!fileInput || !previewBtn) return;

        var parsedData = null;

        previewBtn.addEventListener('click', function () {
            var file = fileInput.files[0];
            if (!file) { alert('Seleccioná un archivo XML primero.'); return; }

            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    parsedData = parseMalXml(e.target.result);
                    renderPreview(parsedData, previewArea);
                    resultArea.hidden = true;
                    progressArea.hidden = true;
                } catch (err) {
                    previewArea.innerHTML = '<p style="color:#ff6b6b">Error al leer el archivo: ' + escapeHtml(err.message) + '</p>';
                    previewArea.hidden = false;
                }
            };
            reader.readAsText(file);
        });

        if (importBtn) {
            importBtn.addEventListener('click', function () {
                if (!parsedData || importState.running) return;
                importState.running = true;
                importBtn.disabled = true;
                importBtn.textContent = 'Importando...';
                runImport(parsedData, progressArea, resultArea, function () {
                    importState.running = false;
                    importBtn.disabled = false;
                    importBtn.textContent = '\u2B07 IMPORTAR TODO';
                });
            });
        }
    }

    function renderPreview(data, container) {
        var totalAnime = data.anime.length;
        var totalManga = data.manga.length;
        var completedAnime = data.anime.filter(function (e) { return shouldMarkViewed(e.status); }).length;
        var completedManga = data.manga.filter(function (e) { return shouldMarkViewed(e.status); }).length;

        container.hidden = false;
        container.innerHTML = '\
            <div class="mal-preview">\
                <div class="mal-preview-header">Vista previa</div>\
                <div class="mal-preview-grid">\
                    <div class="mal-preview-stat">\
                        <span class="mal-preview-num">' + totalAnime + '</span>\
                        <span class="mal-preview-label">Anime</span>\
                    </div>\
                    <div class="mal-preview-stat">\
                        <span class="mal-preview-num">' + totalManga + '</span>\
                        <span class="mal-preview-label">Manga</span>\
                    </div>\
                    <div class="mal-preview-stat">\
                        <span class="mal-preview-num">' + (completedAnime + completedManga) + '</span>\
                        <span class="mal-preview-label">Completados (se marcarán como vistos)</span>\
                    </div>\
                </div>\
                <button class="perfil-panel-btn" id="importMalBtn">\u2B07 IMPORTAR TODO</button>\
            </div>';

        // Re-bind import button
        var importBtn = getEl('importMalBtn');
        if (importBtn) {
            importBtn.addEventListener('click', function () {
                if (importState.running) return;
                importState.running = true;
                importBtn.disabled = true;
                importBtn.textContent = 'Importando...';
                runImport(data, getEl('malImportProgress'), getEl('malImportResult'), function () {
                    importState.running = false;
                });
            });
        }
    }

    function runImport(data, progressArea, resultArea, onDone) {
        progressArea.hidden = false;
        resultArea.hidden = true;
        progressArea.innerHTML = '<div class="mal-progress"><div class="mal-progress-bar"><div class="mal-progress-fill" style="width:0%"></div></div><div class="mal-progress-text">Preparando...</div></div>';

        var supabase = window.AppSupabase;
        if (!supabase || !supabase.saveItemState) {
            progressArea.innerHTML = '<p style="color:#ff6b6b">Supabase no está disponible. Iniciá sesión primero.</p>';
            if (onDone) onDone();
            return;
        }

        var fill = progressArea.querySelector('.mal-progress-fill');
        var text = progressArea.querySelector('.mal-progress-text');

        function setProgress(pct, msg) {
            if (fill) fill.style.width = pct + '%';
            if (text) text.textContent = msg;
        }

        var allEntries = [];
        data.anime.forEach(function (e) { allEntries.push({ entry: e, category: 'anime' }); });
        data.manga.forEach(function (e) { allEntries.push({ entry: e, category: 'manga' }); });

        if (!allEntries.length) {
            progressArea.innerHTML = '<p>No se encontraron entradas en el archivo.</p>';
            if (onDone) onDone();
            return;
        }

        var total = allEntries.length;
        var done = 0;
        var results = { ok: 0, skipped: 0, errors: 0 };

        setProgress(5, 'Consultando AniList para convertir IDs...');

        // Batch lookup MAL → AniList by category
        Promise.all([
            batchLookupAnilistIds(data.anime, 'ANIME'),
            batchLookupAnilistIds(data.manga, 'MANGA')
        ]).then(function (lookups) {
            var anilistByMal = {};
            anilistByMal.anime = lookups[0];
            anilistByMal.manga = lookups[1];

            setProgress(20, 'Guardando en Supabase...');

            var chain = Promise.resolve();
            allEntries.forEach(function (item) {
                chain = chain.then(function () {
                    var anilistId = anilistByMal[item.category][item.entry.malId];
                    if (!anilistId) {
                        results.skipped++;
                        done++;
                        setProgress(20 + Math.round((done / total) * 70), 'Saltando ' + escapeHtml(item.entry.title) + ' (sin ID en AniList)');
                        return;
                    }
                    var viewed = shouldMarkViewed(item.entry.status);
                    var wstatus = malStatusToWatchStatus(item.entry.status);
                    if (wstatus) {
                        // Copia local para que el estado se vea aunque la
                        // migración watch_status no esté aplicada en Supabase
                        try {
                            var uid = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null;
                            if (uid && uid !== 'Invitado') UserStore.setItem('u:' + uid + '|item:' + anilistId + '|wstatus', wstatus);
                        } catch (_) {}
                    }
                    return saveItemState(supabase, item.category, anilistId, viewed, wstatus).then(function () {
                        results.ok++;
                        done++;
                        var title = item.entry.title;

                        // Save progress keys after item state
                        var progressPromise = Promise.resolve();
                        if (item.category === 'anime' && item.entry.watchedEp > 0) {
                            var epKeys = [];
                            for (var e = 1; e <= item.entry.watchedEp; e++) epKeys.push('s:0|ep:' + e);
                            progressPromise = saveProgressesSequential(supabase, 'anime', String(anilistId), epKeys, true);
                        } else if ((item.category === 'manga' || item.category === 'novelas') && item.entry.readVol > 0) {
                            var volKeys = [];
                            for (var v = 1; v <= item.entry.readVol; v++) volKeys.push('vol:' + v);
                            progressPromise = saveProgressesSequential(supabase, item.category, String(anilistId), volKeys, true);
                        }

                        return progressPromise.then(function () {
                            setProgress(20 + Math.round((done / total) * 70), '✓ ' + escapeHtml(title));
                        }).catch(function () {
                            setProgress(20 + Math.round((done / total) * 70), '✓ ' + escapeHtml(title) + ' (sin progreso detallado)');
                        });
                    }).catch(function () {
                        results.errors++;
                        done++;
                        setProgress(20 + Math.round((done / total) * 70), '✗ Error: ' + escapeHtml(item.entry.title));
                    });
                });
            });

            return chain;
        }).then(function () {
            setProgress(100, 'Importación completada');
            progressArea.hidden = true;
            resultArea.hidden = false;
            resultArea.innerHTML = '\
                <div class="mal-result">\
                    <div class="mal-result-title">Resultado de la importación</div>\
                    <div class="mal-result-stats">\
                        <span class="mal-result-ok">✓ ' + results.ok + ' importados</span>\
                        <span class="mal-result-skip">– ' + results.skipped + ' saltados</span>\
                        <span class="mal-result-err">✗ ' + results.errors + ' errores</span>\
                    </div>\
                    <p class="mal-result-note">Los cambios se ven reflejados de inmediato. Se importaron también los episodios y volúmenes marcados como progreso. Recargá el catálogo para verlos.</p>\
                </div>';
            var uId = null;
            var _user = window.AppSupabase && typeof window.AppSupabase.getCurrentUserSync === 'function' ? window.AppSupabase.getCurrentUserSync() : null;
            if (_user && _user.id) uId = _user.id;
            if (uId) {
                var malKey = 'u:' + uId + '|mal_imported';
                if (!UserStore.getItem(malKey)) {
                    UserStore.setItem(malKey, '1');
                    var delta = AnimeDestiny.Constants.XP_MAL_IMPORT || 100;
                    if (typeof addUserPoints === 'function') {
                        addUserPoints(uId, delta);
                    } else if (window.AppSupabase && typeof window.AppSupabase.addExperience === 'function') {
                        window.AppSupabase.addExperience(delta);
                        var pts = Number(UserStore.getItem('u:' + uId + '|points') || '0');
                        UserStore.setItem('u:' + uId + '|points', String(pts + delta));
                    }
                    if (window.Toast) window.Toast.success("¡Importación completada! (+" + delta + " EXP)");
                }
            }
            if (onDone) onDone();
        }).catch(function (err) {
            setProgress(0, 'Error: ' + escapeHtml(err.message));
            if (onDone) onDone();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMalImport);
    } else {
        initMalImport();
    }
})();
