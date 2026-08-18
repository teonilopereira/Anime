/**
 * import-anilist.js — Importa la lista de un usuario de AniList.
 *
 * Dos caminos:
 *   1. Por nombre de usuario (listas PÚBLICAS): no necesita login ni registrar
 *      una app; AniList expone MediaListCollection(userName) sin token. Es el
 *      camino por defecto y el que funciona sin configurar nada.
 *   2. Con token OAuth (listas privadas): si hay un client_id configurado
 *      (window.AppConfig.anilistClientId) se ofrece "Conectar con AniList"
 *      (implicit grant); el token vuelve en el fragment de la URL y se usa el
 *      Viewer autenticado en vez del nombre.
 *
 * La gran ventaja frente a la importación de MAL: el id de AniList YA es el id
 * nativo de la app, así que no hace falta convertir ids (no hay lookup extra).
 */
(function () {
    'use strict';

    var ANILIST_ENDPOINT = 'https://graphql.anilist.co';
    var ANILIST_AUTHORIZE = 'https://anilist.co/api/v2/oauth/authorize';
    var TOKEN_STORE_KEY = 'ad:anilistToken';

    function getEl(id) { return document.getElementById(id); }
    function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }

    function anilistFetch(query, variables, token) {
        var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        return fetch(ANILIST_ENDPOINT, {
            method: 'POST', headers: headers,
            body: JSON.stringify({ query: query, variables: variables })
        }).then(function (res) {
            if (!res.ok) throw new Error('AniList HTTP ' + res.status);
            return res.json();
        }).then(function (json) {
            if (json.errors) throw new Error(json.errors[0] && json.errors[0].message || 'AniList error');
            return json;
        });
    }

    // Listas por nombre de usuario (público) o por Viewer autenticado (token).
    var LIST_QUERY_BY_NAME = '\
        query ($name: String, $type: MediaType) {\
            MediaListCollection(userName: $name, type: $type) {\
                lists { entries {\
                    status progress progressVolumes score\
                    media { id idMal episodes chapters volumes format title { romaji english } }\
                } }\
            }\
        }';

    var LIST_QUERY_BY_VIEWER = '\
        query ($type: MediaType) {\
            MediaListCollection(userName: null, type: $type) {\
                lists { entries {\
                    status progress progressVolumes score\
                    media { id idMal episodes chapters volumes format title { romaji english } }\
                } }\
            }\
        }';

    var VIEWER_QUERY = 'query { Viewer { id name } }';

    // AniList list status → estado de seguimiento de la app.
    function statusToWatchStatus(status) {
        switch (status) {
            case 'CURRENT':
            case 'REPEATING': return 'viendo';
            case 'PLANNING':  return 'pendiente';
            case 'PAUSED':    return 'pausado';
            case 'DROPPED':   return 'abandonado';
            default:          return '';
        }
    }

    function shouldMarkViewed(status) { return status === 'COMPLETED'; }

    // Aplana lists → entries y le pega la categoría de la app a cada uno.
    function flattenEntries(collection, baseCategory) {
        var out = [];
        var lists = (collection && collection.lists) || [];
        lists.forEach(function (l) {
            (l.entries || []).forEach(function (e) {
                if (!e || !e.media || !e.media.id) return;
                var cat = baseCategory;
                if (baseCategory === 'manga') {
                    cat = (e.media.format === 'NOVEL') ? 'novelas' : 'manga';
                }
                out.push({
                    id: e.media.id,
                    title: (e.media.title && (e.media.title.english || e.media.title.romaji)) || '',
                    status: e.status || '',
                    progress: Number(e.progress) || 0,
                    progressVolumes: Number(e.progressVolumes) || 0,
                    category: cat
                });
            });
        });
        return out;
    }

    function saveItemState(supabase, category, id, viewed, watchStatus) {
        return supabase.saveItemState({
            category: category, itemId: String(id), fav: false,
            viewed: viewed, meta: {}, watchStatus: watchStatus || ''
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

    // ── Token OAuth (opcional) ──
    function readTokenFromHash() {
        var h = window.location.hash || '';
        var m = h.match(/access_token=([^&]+)/);
        if (m && m[1]) {
            var token = decodeURIComponent(m[1]);
            try { sessionStorage.setItem(TOKEN_STORE_KEY, token); } catch (_) {}
            // Limpiar el fragment para no dejar el token en la URL/historial.
            try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}
            return token;
        }
        try { return sessionStorage.getItem(TOKEN_STORE_KEY) || ''; } catch (_) { return ''; }
    }

    function anilistClientId() {
        return (window.AppConfig && window.AppConfig.anilistClientId) || '';
    }

    function initAniListImport() {
        var section = getEl('anilistImportSection');
        if (!section) return;

        var input = getEl('anilistUserInput');
        var previewBtn = getEl('anilistPreviewBtn');
        var connectBtn = getEl('anilistConnectBtn');
        var previewArea = getEl('anilistPreviewArea');
        var progressArea = getEl('anilistImportProgress');
        var resultArea = getEl('anilistImportResult');

        var token = readTokenFromHash();
        var clientId = anilistClientId();

        // El botón OAuth solo tiene sentido si hay un client_id configurado.
        if (connectBtn) {
            if (clientId) {
                connectBtn.hidden = false;
                if (token) connectBtn.textContent = '✓ Conectado con AniList';
                connectBtn.addEventListener('click', function () {
                    window.location.href = ANILIST_AUTHORIZE + '?client_id=' + encodeURIComponent(clientId) + '&response_type=token';
                });
            } else {
                connectBtn.hidden = true;
            }
        }

        var parsed = null;

        function doPreview() {
            var useToken = token && (!input || !input.value.trim());
            var name = input ? input.value.trim() : '';
            if (!useToken && !name) { alert('Escribí tu nombre de usuario de AniList.'); return; }

            previewArea.hidden = false;
            previewArea.innerHTML = '<p>Consultando AniList…</p>';
            resultArea.hidden = true;
            progressArea.hidden = true;

            var animeVars = useToken ? { type: 'ANIME' } : { name: name, type: 'ANIME' };
            var mangaVars = useToken ? { type: 'MANGA' } : { name: name, type: 'MANGA' };
            var q = useToken ? LIST_QUERY_BY_VIEWER : LIST_QUERY_BY_NAME;

            Promise.all([
                anilistFetch(q, animeVars, useToken ? token : null),
                anilistFetch(q, mangaVars, useToken ? token : null)
            ]).then(function (res) {
                var anime = flattenEntries(res[0] && res[0].data && res[0].data.MediaListCollection, 'anime');
                var manga = flattenEntries(res[1] && res[1].data && res[1].data.MediaListCollection, 'manga');
                parsed = { anime: anime, manga: manga };
                renderPreview(parsed);
            }).catch(function (err) {
                previewArea.innerHTML = '<p style="color:#ff6b6b">No se pudo leer la lista: ' + esc(err.message) +
                    '. Verificá el nombre de usuario y que tu lista sea pública.</p>';
            });
        }

        function renderPreview(data) {
            var totalAnime = data.anime.length;
            var totalManga = data.manga.filter(function (e) { return e.category === 'manga'; }).length;
            var totalNovelas = data.manga.filter(function (e) { return e.category === 'novelas'; }).length;
            var completados = data.anime.concat(data.manga).filter(function (e) { return shouldMarkViewed(e.status); }).length;

            previewArea.innerHTML = '\
                <div class="mal-preview">\
                    <div class="mal-preview-header">Vista previa</div>\
                    <div class="mal-preview-grid">\
                        <div class="mal-preview-stat"><span class="mal-preview-num">' + totalAnime + '</span><span class="mal-preview-label">Anime</span></div>\
                        <div class="mal-preview-stat"><span class="mal-preview-num">' + totalManga + '</span><span class="mal-preview-label">Manga</span></div>\
                        <div class="mal-preview-stat"><span class="mal-preview-num">' + totalNovelas + '</span><span class="mal-preview-label">Novelas</span></div>\
                        <div class="mal-preview-stat"><span class="mal-preview-num">' + completados + '</span><span class="mal-preview-label">Completados (se marcan como vistos)</span></div>\
                    </div>\
                    <button class="perfil-panel-btn" id="anilistImportBtn">⬇ IMPORTAR TODO</button>\
                </div>';

            var importBtn = getEl('anilistImportBtn');
            if (importBtn) {
                importBtn.addEventListener('click', function () {
                    if (importState.running) return;
                    importState.running = true;
                    importBtn.disabled = true;
                    importBtn.textContent = 'Importando…';
                    runImport(parsed, progressArea, resultArea, function () {
                        importState.running = false;
                    });
                });
            }
        }

        if (previewBtn) previewBtn.addEventListener('click', doPreview);

        // Si volvimos del OAuth con token, disparar la vista previa sola.
        if (token && clientId) doPreview();
    }

    function runImport(data, progressArea, resultArea, onDone) {
        progressArea.hidden = false;
        resultArea.hidden = true;
        progressArea.innerHTML = '<div class="mal-progress"><div class="mal-progress-bar"><div class="mal-progress-fill" style="width:0%"></div></div><div class="mal-progress-text">Preparando…</div></div>';

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

        var allEntries = data.anime.concat(data.manga);
        if (!allEntries.length) {
            progressArea.innerHTML = '<p>No se encontraron entradas en la lista.</p>';
            if (onDone) onDone();
            return;
        }

        var total = allEntries.length;
        var done = 0;
        var results = { ok: 0, errors: 0 };
        var uid = null;
        try { uid = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : null; } catch (_) {}

        var chain = Promise.resolve();
        allEntries.forEach(function (entry) {
            chain = chain.then(function () {
                var viewed = shouldMarkViewed(entry.status);
                var wstatus = statusToWatchStatus(entry.status);
                if (wstatus && uid && uid !== 'Invitado') {
                    try { UserStore.setItem('u:' + uid + '|item:' + entry.id + '|wstatus', wstatus); } catch (_) {}
                }
                return saveItemState(supabase, entry.category, entry.id, viewed, wstatus).then(function () {
                    results.ok++;
                    done++;
                    // Progreso detallado: episodios (anime) o volúmenes (manga/novelas).
                    var progressPromise = Promise.resolve();
                    if (entry.category === 'anime' && entry.progress > 0) {
                        var epKeys = [];
                        for (var e = 1; e <= entry.progress; e++) epKeys.push('s:0|ep:' + e);
                        progressPromise = saveProgressesSequential(supabase, 'anime', String(entry.id), epKeys, true);
                    } else if ((entry.category === 'manga' || entry.category === 'novelas') && entry.progressVolumes > 0) {
                        var volKeys = [];
                        for (var v = 1; v <= entry.progressVolumes; v++) volKeys.push('vol:' + v);
                        progressPromise = saveProgressesSequential(supabase, entry.category, String(entry.id), volKeys, true);
                    }
                    return progressPromise.then(function () {
                        setProgress(Math.round((done / total) * 100), '✓ ' + esc(entry.title));
                    }).catch(function () {
                        setProgress(Math.round((done / total) * 100), '✓ ' + esc(entry.title) + ' (sin progreso detallado)');
                    });
                }).catch(function () {
                    results.errors++;
                    done++;
                    setProgress(Math.round((done / total) * 100), '✗ ' + esc(entry.title));
                });
            });
        });

        chain.then(function () {
            setProgress(100, 'Importación completada');
            progressArea.hidden = true;
            resultArea.hidden = false;
            resultArea.innerHTML = '\
                <div class="mal-result">\
                    <div class="mal-result-title">Resultado de la importación</div>\
                    <div class="mal-result-stats">\
                        <span class="mal-result-ok">✓ ' + results.ok + ' importados</span>\
                        <span class="mal-result-err">✗ ' + results.errors + ' errores</span>\
                    </div>\
                    <p class="mal-result-note">Se importaron episodios y volúmenes como progreso. Recargá el catálogo para verlos.</p>\
                </div>';

            // XP por importar (una sola vez, igual que la importación de MAL).
            if (uid && uid !== 'Invitado') {
                var key = 'u:' + uid + '|anilist_imported';
                if (!UserStore.getItem(key)) {
                    UserStore.setItem(key, '1');
                    var delta = AnimeDestiny.Constants.XP_MAL_IMPORT || 100;
                    if (typeof addUserPoints === 'function') addUserPoints(uid, delta);
                    if (window.Toast) window.Toast.success('¡Importación completada! (+' + delta + ' EXP)');
                }
            }
            if (onDone) onDone();
        }).catch(function (err) {
            setProgress(0, 'Error: ' + esc(err.message));
            if (onDone) onDone();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAniListImport);
    } else {
        initAniListImport();
    }
})();
