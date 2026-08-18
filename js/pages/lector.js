/**
 * lector.js — Lector de manga sobre la API de MangaDex.
 *
 * Resuelve la obra (por UUID de MangaDex o por título), lista los capítulos de
 * un idioma (feed) y muestra las páginas de cada capítulo (at-home). Navega
 * entre capítulos y recuerda el último leído por obra.
 *
 * Todas las funciones de datos viven en js/core/mangadex-api.js:
 *   window.getMangaDexFeed / getMangaDexChapterPages / getMangaDexLanguages /
 *   resolveMangaDexId / searchMangaDex.
 */
(function () {
    'use strict';

    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    var _mangaId = null;   // UUID de MangaDex resuelto
    var _title = '';
    var _lang = 'es';
    var _chapters = [];    // feed del idioma actual
    var _current = -1;     // índice del capítulo abierto

    function esc(s) { return window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
    function el(id) { return document.getElementById(id); }

    function getParams() {
        var p = new URLSearchParams(window.location.search);
        return {
            id: (p.get('id') || '').trim(),
            nombre: (p.get('nombre') || p.get('title') || '').trim(),
            cap: (p.get('cap') || '').trim()
        };
    }

    function showState(which) {
        ['lectorLoading', 'lectorError', 'lectorChapters', 'lectorReader'].forEach(function (id) {
            var node = el(id);
            if (node) node.hidden = (id !== which);
        });
    }

    function showError(title, msg) {
        var t = el('lectorErrorTitle'); if (t) t.textContent = title || 'No hay capítulos disponibles.';
        var m = el('lectorErrorMsg'); if (m) m.textContent = msg || '';
        showState('lectorError');
    }

    var LANG_NAMES = {
        es: 'Español', 'es-la': 'Español (LatAm)', en: 'Inglés', ja: 'Japonés',
        ko: 'Coreano', zh: 'Chino', 'zh-hk': 'Chino (HK)', 'pt-br': 'Portugués (BR)',
        fr: 'Francés', it: 'Italiano', de: 'Alemán', ru: 'Ruso'
    };

    function populateLangs(langs) {
        var sel = el('lectorLang');
        if (!sel) return;
        // Siempre ofrecer al menos el idioma actual.
        if (!langs.length) langs = [_lang];
        sel.innerHTML = langs.map(function (l) {
            return '<option value="' + esc(l) + '"' + (l === _lang ? ' selected' : '') + '>' + esc(LANG_NAMES[l] || l) + '</option>';
        }).join('');
    }

    function lastReadKey() { return 'md_lastread_' + _mangaId; }

    function chapterListHtml() {
        var last = '';
        try { last = localStorage.getItem(lastReadKey()) || ''; } catch (_) {}
        return '<div class="lector-chapter-list">' +
            _chapters.map(function (c, i) {
                var label = c.chapter ? ('Capítulo ' + c.chapter) : (c.volume ? ('Volumen ' + c.volume) : 'Capítulo');
                var extra = c.title ? '<span class="lch-title">' + esc(c.title) + '</span>' : '';
                var grupo = c.group ? '<span class="lch-group">' + esc(c.group) + '</span>' : '';
                var leido = (last && last === c.id) ? ' is-last' : '';
                return '<button type="button" class="lector-chapter-item' + leido + '" data-idx="' + i + '">' +
                    '<span class="lch-main">' + esc(label) + extra + '</span>' + grupo +
                    '</button>';
            }).join('') +
            '</div>';
    }

    function renderChapterList() {
        var host = el('lectorChapters');
        if (!host) return;
        if (!_chapters.length) {
            showError('Sin capítulos', 'No hay capítulos leíbles en MangaDex para el idioma elegido.');
            return;
        }
        host.innerHTML = '<h2 class="lector-section-title">' + esc(_chapters.length) + ' capítulos</h2>' + chapterListHtml();
        showState('lectorChapters');
    }

    async function openChapter(idx) {
        if (idx < 0 || idx >= _chapters.length) return;
        _current = idx;
        var ch = _chapters[idx];
        var label = (ch.chapter ? 'Capítulo ' + ch.chapter : (ch.volume ? 'Volumen ' + ch.volume : 'Capítulo'));

        var lbl = el('lectorReaderLabel'); if (lbl) lbl.textContent = label + (ch.title ? ' · ' + ch.title : '');
        var pagesHost = el('lectorPages');
        if (pagesHost) pagesHost.innerHTML = '<p class="lector-loading-pages">Cargando páginas…</p>';
        syncNavButtons();
        showState('lectorReader');
        window.scrollTo({ top: 0, behavior: 'instant' });

        try { localStorage.setItem(lastReadKey(), ch.id); } catch (_) {}

        var pages = [];
        try {
            pages = await window.getMangaDexChapterPages(ch.id, false);
        } catch (e) {
            console.warn('lector openChapter:', e);
        }
        if (_current !== idx) return; // el usuario cambió de capítulo mientras cargaba
        if (!pagesHost) return;
        if (!pages.length) {
            pagesHost.innerHTML = '<p class="lector-loading-pages">No se pudieron cargar las páginas de este capítulo.</p>';
            return;
        }
        pagesHost.innerHTML = pages.map(function (url, i) {
            return '<img class="lector-page-img" src="' + (window.safeUrl ? window.safeUrl(url) : url) + '" alt="Página ' + (i + 1) + '" loading="lazy" decoding="async">';
        }).join('');
    }

    function syncNavButtons() {
        // El feed está en orden ascendente: "siguiente" = índice mayor.
        var hasPrev = _current > 0;
        var hasNext = _current >= 0 && _current < _chapters.length - 1;
        ['lectorPrev', 'lectorPrev2'].forEach(function (id) { var b = el(id); if (b) b.disabled = !hasPrev; });
        ['lectorNext', 'lectorNext2'].forEach(function (id) { var b = el(id); if (b) b.disabled = !hasNext; });
    }

    async function loadFeed() {
        showState('lectorLoading');
        try {
            _chapters = await window.getMangaDexFeed(_mangaId, _lang, 500);
        } catch (e) {
            console.warn('lector loadFeed:', e);
            _chapters = [];
        }
        _current = -1;
        renderChapterList();
    }

    function bindControls() {
        var back = el('lectorBack');
        if (back) {
            var ref = document.referrer;
            if (ref && /detalle\.html/.test(ref)) back.setAttribute('href', ref);
        }

        var sel = el('lectorLang');
        if (sel) {
            sel.addEventListener('change', function () {
                _lang = sel.value || 'es';
                loadFeed();
            });
        }

        el('lectorChapters') && el('lectorChapters').addEventListener('click', function (e) {
            var btn = e.target.closest('.lector-chapter-item');
            if (!btn) return;
            var idx = Number(btn.getAttribute('data-idx'));
            if (Number.isFinite(idx)) openChapter(idx);
        });

        function prev() { if (_current > 0) openChapter(_current - 1); }
        function next() { if (_current >= 0 && _current < _chapters.length - 1) openChapter(_current + 1); }
        ['lectorPrev', 'lectorPrev2'].forEach(function (id) { var b = el(id); if (b) b.addEventListener('click', prev); });
        ['lectorNext', 'lectorNext2'].forEach(function (id) { var b = el(id); if (b) b.addEventListener('click', next); });
        var toList = el('lectorToList');
        if (toList) toList.addEventListener('click', function () { showState('lectorChapters'); window.scrollTo({ top: 0, behavior: 'instant' }); });

        // Teclado: flechas para navegar capítulos.
        document.addEventListener('keydown', function (e) {
            if (el('lectorReader') && el('lectorReader').hidden) return;
            if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
        });
    }

    async function resolveManga(params) {
        if (UUID_RE.test(params.id)) return params.id;
        // AniList id numérico o título: se resuelve por nombre contra MangaDex.
        if (typeof window.resolveMangaDexId === 'function') {
            return await window.resolveMangaDexId({ id: params.id, title: params.nombre });
        }
        return null;
    }

    async function start() {
        var params = getParams();
        _title = params.nombre || 'Lector';
        var titleEl = el('lectorTitle');
        if (titleEl) titleEl.textContent = _title;
        document.title = 'Leer ' + _title + ' | Anime Destiny';

        try { _lang = (localStorage.getItem('pref:lang') || 'es').slice(0, 2); } catch (_) { _lang = 'es'; }

        bindControls();
        showState('lectorLoading');

        if (typeof window.getMangaDexFeed !== 'function') {
            showError('Lector no disponible', 'No se pudo cargar el cliente de MangaDex.');
            return;
        }

        _mangaId = await resolveManga(params);
        if (!_mangaId) {
            showError('No encontrado', 'No pudimos ubicar esta obra en MangaDex para leerla.');
            return;
        }

        // Idiomas disponibles: si el preferido no está, se cae al primero.
        var langs = [];
        try { langs = await window.getMangaDexLanguages(_mangaId); } catch (_) { langs = []; }
        if (langs.length && langs.indexOf(_lang) === -1) _lang = langs[0];
        populateLangs(langs);

        await loadFeed();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
