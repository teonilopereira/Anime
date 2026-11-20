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

    function reEsc(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Conjunto de números (episodios / volúmenes / capítulos) ya marcados por el
    // usuario para este ítem, con el mismo formato de claves de UserStore que usa
    // el resto de la app. Solo cuenta las claves de ESTE usuario y de la unidad
    // que muestra la página (`vol:` en volúmenes, `ch:` en capítulos): antes se
    // mezclaban las dos, así que el tomo 3 marcado en el detalle aparecía como
    // "Capítulo 3 · Leído" (y los capítulos importados de MAL como tomos).
    function watchedSet(userId, id, category, prefix) {
        var set = new Set();
        if (!window.UserStore || typeof UserStore.keys !== 'function') return set;
        var catS = category === 'novelas' ? 'novela' : (category === 'anime' ? 'anime' : 'manga');
        var unitKey = prefix === 'CH' ? 'ch' : 'vol';
        var userPrefix = 'u:' + userId + '|';
        var re = category === 'anime'
            ? new RegExp('^anime:' + reEsc(id) + '\\|s:\\d+\\|ep:(\\d+)$')
            : new RegExp('^' + catS + ':' + reEsc(id) + '\\|' + unitKey + ':(\\d+)$');
        var keys = UserStore.keys();
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (!k || k.indexOf(userPrefix) !== 0) continue;
            var m = k.slice(userPrefix.length).match(re);
            if (m && UserStore.getItem(k)) set.add(Number(m[1]));
        }
        return set;
    }

    // Marcados dentro de 1..total: lo mismo que pinta la lista (y que cuenta el
    // detalle). Antes el hero usaba el tamaño del Set, que incluía tomos fuera
    // de rango (p. ej. el 15 de una obra que ahora informa 12) y no coincidía
    // con las filas marcadas.
    function countInRange(set, total) {
        var c = 0;
        if (!set) return c;
        set.forEach(function (n) { if (n >= 1 && n <= total) c++; });
        return c;
    }

    // `total` llega por la URL: se acepta solo un entero >= 0 ("12.5" → 12,
    // "abc" / "-3" → 0) para que el hero, la lista y el % usen el mismo número.
    function parseTotal(raw) {
        var n = Math.floor(Number(raw));
        return Number.isFinite(n) && n > 0 ? n : 0;
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
                    var covers = [];
                    for (var i = 0; i < rows.length; i++) {
                        var vol = String(parseInt(rows[i].getAttribute('data-vol'), 10));
                        var info = details[vol];
                        if (!info) continue;
                        if (info.cover) {
                            var img = rows[i].querySelector('.vols-row-cover');
                            if (img) covers.push({ img: img, url: info.cover });
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
                    paintCovers(covers);
                })
                .catch(function () {});
        } catch (e) {}
    }

    // Antes se ponía la tapa original (1-3 MB por tomo) en una miniatura de
    // 62 px. paintMangaDexCovers usa la miniatura de 256 px de MangaDex y cae
    // al original si no existe.
    function paintCovers(targets) {
        if (!targets.length) return;
        if (typeof window.paintMangaDexCovers === 'function') {
            window.paintMangaDexCovers(targets);
            return;
        }
        for (var i = 0; i < targets.length; i++) targets[i].img.src = targets[i].url;
    }

    // Solo URLs http(s) o rutas del propio sitio: el parámetro `img` llega de
    // la query string y se usa dentro de url("...") en el fondo del hero.
    function safeImg(url) {
        var u = String(url || '').trim();
        if (/^https?:\/\//i.test(u) || /^(?:\/(?!\/)|images\/)/.test(u) || /^data:image\//i.test(u)) return u;
        return '';
    }

    function cssUrl(url) {
        return 'url("' + url.replace(/["\\\n\r]/g, function (c) { return encodeURIComponent(c); }) + '")';
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

    // La card manda el estado crudo de la API (RELEASING, FINISHED...); antes
    // se mostraba tal cual en el hero.
    var ESTADOS = {
        RELEASING: 'En emisión', FINISHED: 'Finalizado', NOT_YET_RELEASED: 'Próximamente',
        CANCELLED: 'Cancelado', HIATUS: 'En pausa', UNKNOWN: 'Sin estado'
    };
    function estadoLegible(estado) {
        var raw = String(estado || '').trim();
        return ESTADOS[raw.toUpperCase()] || raw;
    }

    // Total desconocido: si la obra sigue en curso lo dice; si no, "sin dato".
    // Nunca se inventa un número.
    function totalDesconocido(estado) {
        return /RELEASING|EMISI|PUBLIC/i.test(String(estado || ''))
            ? 'En emisión (sin total)'
            : 'Sin dato';
    }

    function render() {
        var id = param('id');
        var category = param('cat') || 'manga';
        var title = param('nombre') || 'Sin título';
        var titleAlt = param('alt');
        var img = safeImg(param('img'));
        var total = parseTotal(param('total'));
        var prefix = param('prefix') || (category === 'anime' ? 'EP' : 'VOL');
        var estado = param('estado');
        var tipo = param('tipo');

        var isAnime = category === 'anime';
        var isManga = !isAnime;
        var isChapter = isManga && prefix === 'CH';

        document.title = 'Mirudoku | ' + title;

        var q = function (sel) { return document.querySelector(sel); };

        // Sin id no hay de qué mostrar volúmenes: antes se pintaba una ficha rota
        // ("Sin título", portada vacía, "?" y "0/?"). Ahora, un estado "No encontrado".
        if (!id) {
            var nf = q('[data-vols-notfound]');
            var hero = q('.vols-hero');
            var listWrap = q('.vols-list-wrap');
            var nfBack = q('[data-vols-notfound-back]');
            if (hero) hero.hidden = true;
            if (listWrap) listWrap.hidden = true;
            if (nfBack) nfBack.setAttribute('href', category === 'anime' ? 'anime.html'
                : (category === 'novelas' ? 'novelas.html' : 'manga.html'));
            if (nf) nf.hidden = false;
            document.title = 'Mirudoku | No encontrado';
            return;
        }

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
        var watched = viewedAll ? null : watchedSet(userId, id, category, prefix);
        var doneCount = viewedAll ? total : countInRange(watched, total);
        var pct = viewedAll ? 100 : (total ? Math.round((doneCount / total) * 100) : 0);

        // Hero
        if (q('[data-hero-bg]')) q('[data-hero-bg]').style.backgroundImage = img ? cssUrl(img) : 'none';
        var coverImg = q('[data-hero-cover]');
        if (coverImg) {
            // Sin portada (o si no carga) el manejador global de common-ui la
            // reemplaza por el póster generado con el título, una sola vez.
            coverImg.setAttribute('data-title', title);
            coverImg.alt = 'Portada de ' + title;
            coverImg.src = img;
        }
        var tipoTxt = (isAnime ? 'Anime' : (category === 'novelas' ? 'Novela' : 'Manga')) + (tipo ? (' · ' + tipo) : '');
        if (q('[data-hero-tipo]')) q('[data-hero-tipo]').textContent = tipoTxt;
        if (q('[data-hero-title]')) q('[data-hero-title]').textContent = title;
        if (q('[data-hero-estado]')) q('[data-hero-estado]').textContent = estadoLegible(estado) || '—';
        var sinTotal = totalDesconocido(estado);
        if (q('[data-dl1]')) q('[data-dl1]').textContent = isAnime ? 'Episodios' : (prefix === 'CH' ? 'Capítulos' : 'Volúmenes');
        if (q('[data-dv1]')) q('[data-dv1]').textContent = total > 0 ? String(total) : sinTotal;
        if (q('[data-dl2]')) q('[data-dl2]').textContent = isAnime ? 'Vistos' : 'Leídos';
        if (q('[data-dv2]')) q('[data-dv2]').textContent = total > 0 ? (doneCount + '/' + total) : '—';
        if (q('[data-dv3]')) q('[data-dv3]').textContent = pct + '%';

        var word = unitWord(category, prefix);
        if (q('[data-caps-title]')) q('[data-caps-title]').textContent = isAnime ? 'EPISODIOS' : (prefix === 'CH' ? 'CAPÍTULOS' : 'VOLÚMENES');
        if (q('[data-caps-count]')) q('[data-caps-count]').textContent = total > 0 ? (doneCount + '/' + total + ' completados') : sinTotal;

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
                    ? '<img class="vols-row-cover"' + numAttr + ' src="' + esc(img) + '" alt="' + esc('Portada del ' + word.toLowerCase() + ' ' + n) + '" width="62" height="93" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback-catalog="1" data-title="' + esc(title) + '" data-subtitle="' + esc(word + ' ' + n) + '">'
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
            if (empty) {
                var unidad = isAnime ? 'episodios' : (isChapter ? 'capítulos' : 'volúmenes');
                empty.textContent = sinTotal === 'Sin dato'
                    ? 'La API no informó ' + unidad + ' para este título.'
                    : 'En emisión: la API todavía no informa el total de ' + unidad + '.';
                empty.hidden = false;
            }
        }
    }

    // Expuesto para tests (tests/unit/volumenes.test.js).
    window.VolumenesPage = { watchedSet: watchedSet, countInRange: countInRange, parseTotal: parseTotal, render: render };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
