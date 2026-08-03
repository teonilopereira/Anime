// js/estudio/render.js
// Ficha de un estudio de animación. Consume window.getStudioById (definido en
// js/core/api.js, dentro del core-bundle) y pinta el resultado en estudio.html.
// Es autocontenido: no depende de los scripts del catálogo ni del detalle.
(function () {
    'use strict';

    var esc = window.escapeHtml || function (v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
    var url = window.safeUrl || function (v) { return v ? String(v) : ''; };

    var FORMAT_LABELS = {
        TV: 'Serie TV', TV_SHORT: 'TV corta', MOVIE: 'Película',
        SPECIAL: 'Especial', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Musical',
        MANGA: 'Manga', NOVEL: 'Novela', ONE_SHOT: 'One-shot'
    };

    // ── Estados de la vista ──
    function setState(state, title, msg) {
        var loading = document.getElementById('estudio-loading');
        var error = document.getElementById('estudio-error');
        var content = document.getElementById('estudio-content');
        if (loading) loading.hidden = state !== 'loading';
        if (content) content.hidden = state !== 'content';
        if (error) {
            error.hidden = state !== 'error';
            if (state === 'error') {
                var t = document.getElementById('estudio-error-title');
                var m = document.getElementById('estudio-error-msg');
                if (t && title) t.textContent = title;
                if (m) m.textContent = msg || '';
            }
        }
    }

    // ── Helpers de markup ──
    function metaChip(label, value) {
        if (!value) return '';
        return '<div class="persona-meta-item">' +
            '<span class="persona-meta-label">' + esc(label) + '</span>' +
            '<span class="persona-meta-value">' + esc(value) + '</span>' +
            '</div>';
    }

    // Card de una obra producida por el estudio (enlaza al detalle).
    function workCard(w) {
        var href = w.id ? 'detalle.html?cat=' + esc(w.cat) + '&id=' + esc(String(w.id)) : '';
        var cover = w.cover
            ? '<img class="persona-card-cover" src="' + url(w.cover) + '" alt="" loading="lazy">'
            : '<span class="persona-card-cover persona-card-cover--empty"></span>';
        var badges = [];
        var fmt = FORMAT_LABELS[w.format] || w.format || '';
        var sub = [];
        if (fmt) sub.push(esc(fmt));
        if (w.year) sub.push(esc(String(w.year)));
        if (w.score) badges.push('<span class="estudio-score">★ ' + esc(String((w.score / 10).toFixed(1))) + '</span>');
        if (w.isMain) badges.push('<span class="estudio-main-badge">Estudio principal</span>');

        var inner =
            cover +
            '<span class="persona-card-body">' +
                '<span class="persona-card-title">' + esc(w.title) + '</span>' +
                (sub.length ? '<span class="persona-card-role">' + sub.join(' · ') + '</span>' : '') +
                (badges.length ? '<span class="estudio-badges">' + badges.join('') + '</span>' : '') +
            '</span>';
        return href
            ? '<a class="persona-card estudio-card" href="' + href + '">' + inner + '</a>'
            : '<div class="persona-card estudio-card">' + inner + '</div>';
    }

    function heroBlock(data) {
        var kind = data.isAnimationStudio ? 'Estudio de animación' : 'Productora';
        var initials = (data.name || '?').trim().slice(0, 2).toUpperCase();
        return '<section class="persona-hero estudio-hero">' +
            '<div class="estudio-hero-mark" aria-hidden="true">' + esc(initials) + '</div>' +
            '<div class="persona-hero-info">' +
                '<span class="persona-kicker">' + esc(kind) + '</span>' +
                '<h1 class="persona-name">' + esc(data.name) + '</h1>' +
                '<div class="persona-meta-grid" id="estudio-meta"></div>' +
            '</div>' +
        '</section>';
    }

    // Separa las obras: donde el estudio fue principal, y donde solo participó.
    function buildWorkSections(works) {
        var main = works.filter(function (w) { return w.isMain; });
        var other = works.filter(function (w) { return !w.isMain; });
        var html = '';
        if (main.length) {
            html += '<section class="persona-section">' +
                '<h2 class="persona-h2">Obras principales<span class="persona-count">' + main.length + '</span></h2>' +
                '<div class="persona-grid estudio-grid">' + main.map(workCard).join('') + '</div>' +
            '</section>';
        }
        if (other.length) {
            html += '<section class="persona-section">' +
                '<h2 class="persona-h2">Participaciones<span class="persona-count">' + other.length + '</span></h2>' +
                '<div class="persona-grid estudio-grid">' + other.map(workCard).join('') + '</div>' +
            '</section>';
        }
        return html;
    }

    function paint(data) {
        var content = document.getElementById('estudio-content');
        if (!content) return;

        var sections = data.works.length
            ? buildWorkSections(data.works)
            : '<p class="persona-native">Este estudio no tiene obras registradas en AniList.</p>';

        content.innerHTML =
            heroBlock(data) +
            sections +
            '<div class="persona-back"><a class="detail-back" href="index.html">Volver al inicio</a></div>';

        var meta =
            metaChip('Obras', data.works.length ? String(data.works.length) : '') +
            metaChip('Favoritos', data.favourites ? '♥ ' + data.favourites.toLocaleString('es') : '');
        var metaHost = document.getElementById('estudio-meta');
        if (metaHost) metaHost.innerHTML = meta;

        document.title = 'Anime Destiny | ' + data.name;
        setCanonical(data);
        setState('content');
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    // Canonical con id: el contenido depende del query string, así que la URL
    // canónica se arma en runtime (el build no la pisa).
    function setCanonical(data) {
        var href = 'https://animedestiny.netlify.app/estudio.html?id=' + data.id;
        var link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'canonical');
            document.head.appendChild(link);
        }
        link.setAttribute('href', href);
    }

    // ── Bootstrap ──
    async function init() {
        var params = new URLSearchParams(window.location.search);
        var id = params.get('id') || '';
        var name = params.get('name') || '';
        if (typeof window.getStudioById !== 'function') {
            setState('error', 'No disponible', 'No se pudo inicializar la búsqueda. Recargá la página.');
            return;
        }
        setState('loading');

        // Sin id pero con nombre (enlace desde el detalle): resolvemos el id.
        var numId = Number(id);
        if ((!id || !Number.isFinite(numId) || numId <= 0) && name && typeof window.getStudioIdByName === 'function') {
            try {
                var resolved = await window.getStudioIdByName(name);
                if (resolved) numId = Number(resolved);
            } catch (_) {}
        }

        if (!Number.isFinite(numId) || numId <= 0) {
            setState('error', name ? 'No encontrado' : 'Faltan parámetros',
                name ? 'No se encontró el estudio "' + name + '" en AniList.'
                     : 'Abrí una ficha de estudio desde la página de un anime.');
            return;
        }
        try {
            var data = await window.getStudioById(numId);
            if (!data) {
                setState('error', 'No encontrado', 'No se encontró este estudio en AniList.');
                return;
            }
            paint(data);
        } catch (err) {
            console.warn('estudio init error:', err);
            setState('error', 'Error', 'Hubo un problema al cargar el estudio. Probá de nuevo.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
