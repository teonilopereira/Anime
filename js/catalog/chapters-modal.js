// ==========================================
// catalog/chapters-modal.js
// Vista rápida (modal tipo "detalle recortado") con la lista de episodios o
// volúmenes de una tarjeta del catálogo y su estado de visto. Se abre desde el
// botón data-action="chapters" del dorso de la card. Es de solo lectura: para
// marcar progreso se abre el detalle completo con el botón inferior.
// ==========================================

(function () {
    'use strict';

    var MODAL_ID = 'chaptersModal';
    var injected = false;
    var lastFocus = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Inyecta el contenedor del modal una sola vez.
    function ensureModal() {
        if (injected) return document.getElementById(MODAL_ID);
        var el = document.createElement('div');
        el.className = 'cmodal-overlay';
        el.id = MODAL_ID;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'cmodalTitle');
        el.hidden = true;
        el.innerHTML = [
            '<div class="cmodal">',
            '  <section class="cmodal-hero">',
            '    <div class="cmodal-hero-bg" data-hero-bg></div>',
            '    <div class="cmodal-hero-ov"></div>',
            '    <button class="cmodal-close" type="button" aria-label="Cerrar" data-cmodal-close>&#10005;</button>',
            '    <div class="cmodal-hero-in">',
            '      <div class="cmodal-portada"><img alt="" data-hero-cover loading="lazy"></div>',
            '      <div class="cmodal-hero-info">',
            '        <span class="cmodal-tipo" data-hero-tipo></span>',
            '        <h2 class="cmodal-title" id="cmodalTitle" data-hero-title></h2>',
            '        <span class="cmodal-badge"><span class="cmodal-badge-dot"></span><span data-hero-estado></span></span>',
            '        <div class="cmodal-datos">',
            '          <div class="cmodal-dato"><span class="cmodal-dl" data-dl1></span><span class="cmodal-dv" data-dv1></span></div>',
            '          <div class="cmodal-dato"><span class="cmodal-dl" data-dl2></span><span class="cmodal-dv" data-dv2></span></div>',
            '          <div class="cmodal-dato"><span class="cmodal-dl">Progreso</span><span class="cmodal-dv" data-dv3></span></div>',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </section>',
            '  <section class="cmodal-caps">',
            '    <div class="cmodal-caps-head">',
            '      <h3 data-caps-title></h3>',
            '      <span class="cmodal-contador"><span class="cmodal-dot-ok"></span><span data-caps-count></span></span>',
            '    </div>',
            '    <div class="cmodal-grid" data-caps-grid></div>',
            '    <p class="cmodal-empty" data-caps-empty hidden>La API no informó episodios/volúmenes para este título.</p>',
            '    <a class="cmodal-detail-link" data-detail-link href="#">Abrir detalle completo &rsaquo;</a>',
            '  </section>',
            '</div>'
        ].join('');
        document.body.appendChild(el);

        // Cierre: botón X, click en el fondo, Escape.
        el.addEventListener('click', function (e) {
            if (e.target === el || (e.target.closest && e.target.closest('[data-cmodal-close]'))) close();
        });
        injected = true;
        return el;
    }

    // Devuelve el conjunto de números (episodios/volúmenes) ya marcados por el
    // usuario para este ítem, reutilizando el mismo formato de claves de
    // UserStore que usa el resto de la app.
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

    // Trae la portada REAL de cada volumen desde MangaDex y la inserta en su
    // fila, para que no quede la portada genérica del tomo 1 repetida. Funciona
    // tanto con títulos de MangaDex (UUID directo) como con los de AniList (id
    // numérico), que se resuelven por título contra MangaDex. Se pasa también el
    // título alternativo (inglés) de la card para que el emparejado no dependa
    // de un solo idioma. Silencioso ante error: queda la portada principal.
    function loadVolumeCovers(id, grid, title, titleAlt) {
        if (typeof window.applyMangaDexVolumeCovers !== 'function') return;
        try {
            window.applyMangaDexVolumeCovers({
                item: { id: id, title: title, title_english: titleAlt },
                grid: grid,
                selector: '.cmodal-cap-cover[data-vol]'
            });
        } catch (e) {}
    }

    var _epTitleCache = {};

    // Limpia el título que trae AniList en streamingEpisodes, que suele venir
    // como "Episode 12 - El título real" o solo "Episode 12" (sin título). Se
    // queda con el texto después del guion; si no hay más que "Episode N",
    // devuelve '' para caer al genérico "Episodio N".
    function cleanEpisodeTitle(raw) {
        var t = String(raw == null ? '' : raw).trim();
        if (!t) return '';
        var m = t.match(/^\s*Episode\s+\d+\s*[-–—:.\)]+\s*(.+)$/i);
        if (m) return m[1].trim();
        if (/^\s*Episode\s+\d+\s*$/i.test(t)) return '';
        return t;
    }

    // Trae los títulos reales de cada episodio desde AniList (streamingEpisodes,
    // ya permitido por la CSP del catálogo y cacheado por getAnimeById) y los
    // inserta en su fila. Silencioso ante error: queda "Episodio N".
    function loadEpisodeTitles(id, grid) {
        if (typeof window.getAnimeById !== 'function') return;
        var apply = function (map) {
            if (!map) return;
            var names = grid.querySelectorAll('.cmodal-cap-name[data-ep]');
            for (var i = 0; i < names.length; i++) {
                var ep = names[i].getAttribute('data-ep');
                if (!map[ep]) continue;
                names[i].textContent = map[ep];
                names[i].setAttribute('title', map[ep]);
                var sub = grid.querySelector('.cmodal-cap-sub[data-ep-sub="' + ep + '"]');
                if (sub) sub.textContent = 'Episodio ' + ep;
            }
        };
        if (_epTitleCache[id]) { apply(_epTitleCache[id]); return; }
        try {
            Promise.resolve(window.getAnimeById(id)).then(function (item) {
                var eps = (item && item.streamingEpisodes) || [];
                var map = {};
                for (var i = 0; i < eps.length; i++) {
                    var raw = eps[i] && eps[i].title;
                    if (!raw) continue;
                    var mm = String(raw).match(/Episode\s+(\d+)/i);
                    var num = mm ? String(parseInt(mm[1], 10)) : String(i + 1);
                    var clean = cleanEpisodeTitle(raw);
                    if (clean && !map[num]) map[num] = clean;
                }
                _epTitleCache[id] = map;
                apply(map);
            }).catch(function () {});
        } catch (e) {}
    }

    function open(btn) {
        var card = btn.closest('.card-container');
        if (!card) return;
        var modal = ensureModal();

        var id = card.getAttribute('data-item-id') || '';
        var category = card.getAttribute('data-category') || 'manga';
        var title = card.getAttribute('data-title') || 'Sin título';
        var titleAlt = card.getAttribute('data-title-alt') || '';
        var img = card.getAttribute('data-img') || '';
        var progBox = card.querySelector('[data-progress]');
        var total = Number(card.getAttribute('data-total') || (progBox && progBox.getAttribute('data-total')) || 0);
        var prefix = (progBox && progBox.getAttribute('data-prefix')) || (category === 'anime' ? 'EP' : 'VOL');
        var estado = (card.querySelector('.cband-status') && card.querySelector('.cband-status').textContent.trim()) || '';
        var tipoLinea = (card.querySelector('.cband-info') && card.querySelector('.cband-info').textContent.trim()) || '';

        var isAnime = category === 'anime';
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

        // Cabecera
        var q = function (sel) { return modal.querySelector(sel); };
        q('[data-hero-bg]').style.backgroundImage = img ? ('url("' + img + '")') : 'none';
        var coverImg = q('[data-hero-cover]');
        coverImg.src = img || '';
        coverImg.alt = 'Portada de ' + title;
        q('[data-hero-tipo]').textContent = (isAnime ? 'Anime' : (category === 'novelas' ? 'Novela' : 'Manga')) + (tipoLinea ? (' · ' + tipoLinea) : '');
        q('[data-hero-title]').textContent = title;
        q('[data-hero-estado]').textContent = estado || '—';
        q('[data-dl1]').textContent = isAnime ? 'Episodios' : (prefix === 'CH' ? 'Capítulos' : 'Volúmenes');
        q('[data-dv1]').textContent = total > 0 ? String(total) : '?';
        q('[data-dl2]').textContent = isAnime ? 'Vistos' : 'Leídos';
        q('[data-dv2]').textContent = doneCount + '/' + (total > 0 ? total : '?');
        q('[data-dv3]').textContent = pct + '%';

        var word = unitWord(category, prefix);
        q('[data-caps-title]').textContent = isAnime ? 'EPISODIOS' : (prefix === 'CH' ? 'CAPÍTULOS' : 'VOLÚMENES');
        q('[data-caps-count]').textContent = doneCount + '/' + (total > 0 ? total : '?') + ' completados';

        // Lista
        var grid = q('[data-caps-grid]');
        var empty = q('[data-caps-empty]');
        var isManga = !isAnime;
        if (total > 0) {
            empty.hidden = true;
            var rows = '';
            for (var n = 1; n <= total; n++) {
                var done = viewedAll || (watched && watched.has(n));
                var nn = (n < 10 ? '0' + n : String(n));
                // En manga cada ítem muestra una foto del volumen: arranca con la
                // portada principal y, si es un título de MangaDex, se reemplaza
                // por la portada real de ese número (loadVolumeCovers).
                var head = isManga
                    ? '<img class="cmodal-cap-cover" data-vol="' + n + '" src="' + esc(img) + '" alt="' + esc(word + ' ' + n) + '" loading="lazy">'
                    : '<span class="cmodal-cap-num">' + nn + '</span>';
                // El nombre arranca genérico ("Episodio N" / "Volumen N"). En
                // anime, loadEpisodeTitles lo reemplaza luego por el título real
                // del episodio (data-ep) y baja "Episodio N" al subtítulo
                // (data-ep-sub). En manga el subtítulo muestra "#NN".
                var nameAttr = isAnime ? ' data-ep="' + n + '"' : '';
                var sub = isManga
                    ? '<span class="cmodal-cap-sub">#' + nn + '</span>'
                    : '<span class="cmodal-cap-sub" data-ep-sub="' + n + '"></span>';
                rows += '<div class="cmodal-cap' + (isManga ? ' cmodal-cap--cover' : '') + (done ? ' vista' : '') + '">'
                    + head
                    + '<span class="cmodal-cap-b"><span class="cmodal-cap-name"' + nameAttr + '>' + esc(word + ' ' + n) + '</span>' + sub + '</span>'
                    + '<span class="cmodal-cap-chk"></span>'
                    + '</div>';
            }
            grid.innerHTML = rows;
            if (isManga) loadVolumeCovers(id, grid, title, titleAlt);
            else loadEpisodeTitles(id, grid);
        } else {
            grid.innerHTML = '';
            empty.hidden = false;
        }

        // Enlace al detalle completo
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(category) + '&id=' + encodeURIComponent(id) + '&nombre=' + encodeURIComponent(title);
        q('[data-detail-link]').setAttribute('href', detailUrl);

        // Mostrar
        lastFocus = document.activeElement;
        modal.hidden = false;
        // fuerza reflow para la transición
        void modal.offsetWidth;
        modal.classList.add('on');
        document.body.classList.add('cmodal-locked');
        var closeBtn = q('[data-cmodal-close]');
        if (closeBtn) closeBtn.focus();
        modal.scrollTop = 0;
    }

    function close() {
        var modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        modal.classList.remove('on');
        document.body.classList.remove('cmodal-locked');
        var hideAfter = function () { modal.hidden = true; modal.removeEventListener('transitionend', hideAfter); };
        modal.addEventListener('transitionend', hideAfter);
        // Respaldo por si no dispara transitionend (reduce-motion)
        setTimeout(function () { if (!modal.classList.contains('on')) modal.hidden = true; }, 260);
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    // Delegación global: abre el modal desde cualquier tarjeta del catálogo.
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-action="chapters"]');
        if (!btn) return;
        e.preventDefault();
        open(btn);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var modal = document.getElementById(MODAL_ID);
        if (modal && modal.classList.contains('on')) close();
    });

    window.AnimeDestiny = window.AnimeDestiny || {};
    window.AnimeDestiny.openChaptersModal = open;
})();
