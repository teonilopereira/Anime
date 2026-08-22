// ==========================================
// pages/volumenes.js
// Página de volúmenes (volumenes.html). Reemplaza al modal que antes se abría
// por encima de las cards del catálogo: ahora cada volumen (o capítulo /
// episodio) ocupa una fila completa con su portada, la información de ese tomo
// (capítulos que incluye y rango) y el estado de lectura. Es de solo lectura:
// para marcar progreso está el enlace al detalle completo.
// ==========================================

(function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function param(name) {
        try {
            return new URLSearchParams(window.location.search).get(name) || '';
        } catch (e) {
            return '';
        }
    }

    // Conjunto de números (episodios / volúmenes / capítulos) ya marcados por el
    // usuario para este ítem, con el mismo formato de claves de UserStore que usa
    // el resto de la app.
    function watchedSet(userId, id, category) {
        var set = new Set();
        if (!window.UserStore || typeof UserStore.keys !== 'function') return set;
        var catS = category === 'novelas' ? 'novela' : (category === 'anime' ? 'anime' : 'manga');
        var reAnime = new RegExp('\\|anime:' + id + '\\|s:\\d+\\|ep:(\\d+)$');
        var reOther = new RegExp('\\|' + catS + ':' + id + '\\|(?:ch|vol):(\\d+)$');
        var re = category === 'anime' ? reAnime : reOther;
        var keys = UserStore.keys();
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (!k) continue;
            var m = k.match(re);
            if (m && UserStore.getItem(k)) set.add(Number(m[1]));
        }
        return set;
    }

    function unitWord(category, prefix) {
        if (category === 'anime') return 'Episodio';
        if (prefix === 'CH') return 'Capítulo';
        return 'Volumen';
    }

    // Trae los detalles reales por volumen (capítulos que incluye cada tomo y su
    // portada) desde MangaDex y los vuelca en cada fila. Best-effort: si el
    // título no resuelve o MangaDex no responde, la fila conserva la información
    // genérica. Se pasa también el título alternativo (inglés) para que el
    // emparejado no dependa de un solo idioma.
    function loadVolumeDetails(id, title, titleAlt, list) {
        if (typeof window.resolveMangaDexVolumeDetails !== 'function') return;
        try {
            window.resolveMangaDexVolumeDetails({ id: id, title: title, title_english: titleAlt })
                .then(function (details) {
                    if (!details) return;
                    var rows = list.querySelectorAll('.vols-row[data-vol]');
                    for (var i = 0; i < rows.length; i++) {
                        var vol = String(parseInt(rows[i].getAttribute('data-vol'), 10));
                        var info = details[vol];
                        if (!info) continue;
                        if (info.cover) {
                            var img = rows[i].querySelector('.vols-row-cover');
                            if (img) img.src = info.cover;
                        }
                        var metaEl = rows[i].querySelector('[data-vol-meta]');
                        if (metaEl) {
                            var parts = [];
                            if (info.count) {
                                parts.push(info.count + (info.count === 1 ? ' capítulo' : ' capítulos'));
                            }
                            if (info.first != null && info.last != null) {
                                parts.push(info.first === info.last
                                    ? ('Cap. ' + info.first)
                                    : ('Caps. ' + info.first + '–' + info.last));
                            }
                            if (parts.length) metaEl.textContent = parts.join(' · ');
                        }
                    }
                })
                .catch(function () {});
        } catch (e) {}
    }

    // Portada del volumen que contiene cada capítulo (MangaDex no tiene portada
    // por capítulo). Best-effort, igual que en el detalle.
    function loadChapterCovers(id, title, titleAlt, list) {
        if (typeof window.applyMangaDexChapterCovers !== 'function') return;
        try {
            window.applyMangaDexChapterCovers({
                item: { id: id, title: title, title_english: titleAlt },
                grid: list,
                selector: '.vols-row-cover[data-chap]'
            });
        } catch (e) {}
    }

    function render() {
        var id = param('id');
        var category = param('cat') || 'manga';
        var title = param('nombre') || 'Sin título';
        var titleAlt = param('alt');
        var img = param('img');
        var total = Number(param('total') || 0);
        var prefix = param('prefix') || (category === 'anime' ? 'EP' : 'VOL');
        var estado = param('estado');
        var tipo = param('tipo');

        var isAnime = category === 'anime';
        var isManga = !isAnime;
        var isChapter = isManga && prefix === 'CH';

        document.title = 'Anime Destiny | ' + title;

        var q = function (sel) { return document.querySelector(sel); };

        // Enlace de volver: al catálogo correspondiente.
        var backHref = category === 'anime' ? 'anime.html'
            : (category === 'novelas' ? 'novelas.html' : 'manga.html');
        var back = document.getElementById('volsBack');
        if (back) back.setAttribute('href', backHref);

        // Progreso del usuario
        var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'Invitado';
        var viewedAll = false;
        try {
            var vk = (typeof statusStorageKey === 'function')
                ? statusStorageKey(userId, id, 'viewed')
                : ('u:' + userId + '|item:' + id + '|viewed');
            viewedAll = !!(window.UserStore && UserStore.getItem(vk));
        } catch (e) {}
        var watched = viewedAll ? null : watchedSet(userId, id, category);
        var doneCount = viewedAll ? total : (watched ? Math.min(watched.size, total) : 0);
        var pct = viewedAll ? 100 : (total ? Math.round((doneCount / total) * 100) : 0);

        // Hero
        if (q('[data-hero-bg]')) q('[data-hero-bg]').style.backgroundImage = img ? ('url("' + img + '")') : 'none';
        var coverImg = q('[data-hero-cover]');
        if (coverImg) { coverImg.src = img || ''; coverImg.alt = 'Portada de ' + title; }
        var tipoTxt = (isAnime ? 'Anime' : (category === 'novelas' ? 'Novela' : 'Manga')) + (tipo ? (' · ' + tipo) : '');
        if (q('[data-hero-tipo]')) q('[data-hero-tipo]').textContent = tipoTxt;
        if (q('[data-hero-title]')) q('[data-hero-title]').textContent = title;
        if (q('[data-hero-estado]')) q('[data-hero-estado]').textContent = estado || '—';
        if (q('[data-dl1]')) q('[data-dl1]').textContent = isAnime ? 'Episodios' : (prefix === 'CH' ? 'Capítulos' : 'Volúmenes');
        if (q('[data-dv1]')) q('[data-dv1]').textContent = total > 0 ? String(total) : '?';
        if (q('[data-dl2]')) q('[data-dl2]').textContent = isAnime ? 'Vistos' : 'Leídos';
        if (q('[data-dv2]')) q('[data-dv2]').textContent = doneCount + '/' + (total > 0 ? total : '?');
        if (q('[data-dv3]')) q('[data-dv3]').textContent = pct + '%';

        var word = unitWord(category, prefix);
        if (q('[data-caps-title]')) q('[data-caps-title]').textContent = isAnime ? 'EPISODIOS' : (prefix === 'CH' ? 'CAPÍTULOS' : 'VOLÚMENES');
        if (q('[data-caps-count]')) q('[data-caps-count]').textContent = doneCount + '/' + (total > 0 ? total : '?') + ' completados';

        // Enlace al detalle completo
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(category) + '&id=' + encodeURIComponent(id) + '&nombre=' + encodeURIComponent(title);
        if (q('[data-detail-link]')) q('[data-detail-link]').setAttribute('href', detailUrl);

        // Lista: una fila por volumen / capítulo / episodio
        var list = q('[data-caps-list]');
        var empty = q('[data-caps-empty]');
        if (!list) return;

        if (total > 0) {
            if (empty) empty.hidden = true;
            var rows = '';
            for (var n = 1; n <= total; n++) {
                var done = viewedAll || (watched && watched.has(n));
                var nn = (n < 10 ? '0' + n : String(n));
                // Miniatura: en manga arranca con la portada principal y se
                // reemplaza por la real (del tomo, o del tomo que contiene al
                // capítulo). En anime se muestra el número del episodio.
                var numAttr = isChapter ? ' data-chap="' + n + '"' : ' data-vol="' + n + '"';
                var thumb = isManga
                    ? '<img class="vols-row-cover"' + numAttr + ' src="' + esc(img) + '" alt="' + esc(word + ' ' + n) + '" loading="lazy" referrerpolicy="no-referrer">'
                    : '<span class="vols-row-num">' + nn + '</span>';
                // Meta: en volúmenes de manga se rellena luego con los capítulos
                // reales del tomo (loadVolumeDetails); mientras tanto y en el
                // resto de casos, la referencia genérica de la unidad.
                var metaGeneric = isChapter ? ('Capítulo ' + n) : (isAnime ? ('Episodio ' + n) : ('Tomo ' + n));
                rows += '<div class="vols-row' + (isManga ? ' vols-row--cover' : '') + (done ? ' vista' : '') + '"' + numAttr + '>'
                    + thumb
                    + '<div class="vols-row-body">'
                    + '<span class="vols-row-name">' + esc(word + ' ' + n) + '</span>'
                    + '<span class="vols-row-meta" data-vol-meta>' + esc(metaGeneric) + '</span>'
                    + '</div>'
                    + '<span class="vols-row-status">' + (done ? (isAnime ? 'Visto' : 'Leído') : '—') + '</span>'
                    + '<span class="vols-row-chk"></span>'
                    + '</div>';
            }
            list.innerHTML = rows;

            if (isChapter) {
                loadChapterCovers(id, title, titleAlt, list);
            } else if (isManga) {
                loadVolumeDetails(id, title, titleAlt, list);
            }
        } else {
            list.innerHTML = '';
            if (empty) empty.hidden = false;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
