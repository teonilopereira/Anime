/**
 * watch-links.js — Sección "Dónde ver" / "Dónde leer" de la ficha.
 *
 * Solo se enlazan fuentes oficiales: los externalLinks de AniList (que la
 * comunidad de AniList modera y marca con isDisabled cuando un sitio deja de
 * tener la obra) y los `links` oficiales de MangaDex (tiendas y el sitio de la
 * traducción oficial). Nunca se arman URLs hacia sitios de terceros por título:
 * eso sería la puerta a enlazar piratería y a reclamos DMCA.
 *
 * `recolectar` es pura (item → lista de enlaces) para poder testearla sin DOM;
 * `html` pinta la sección y devuelve '' si no hay nada, así la ficha no deja
 * un hueco en obras viejas o sin licencia.
 */
(function (window) {
    "use strict";

    // Sitios de lectura oficiales que AniList a veces carga con type INFO en
    // vez de STREAMING. Se comparan en minúscula.
    var LECTORES_OFICIALES = [
        'manga plus', 'mangaplus', 'viz', 'k manga', 'kmanga', 'webtoon',
        'webtoons', 'line webtoon', 'tapas', 'comikey', 'azuki', 'inkr',
        'mangamo', 'j-novel club', 'shonen jump', 'kodansha', 'yen press',
        'bookwalker', 'global comic', 'piccoma', 'lezhin', 'tappytoon',
        'pocket comics', 'manga up!', 'crunchyroll manga'
    ];

    // `links` de MangaDex: clave → [nombre, base de URL]. Las que ya son URL
    // completa llevan base ''. Se dejan afuera los catálogos (al, mu, mal, kt,
    // ap, nu): no sirven para leer.
    var MANGADEX_LINKS = {
        engtl: ['Sitio oficial (inglés)', ''],
        raw: ['Sitio oficial (original)', ''],
        bw: ['BookWalker', 'https://bookwalker.jp/'],
        amz: ['Amazon', ''],
        ebj: ['eBookJapan', ''],
        cdj: ['CDJapan', '']
    };

    var IDIOMAS = {
        spanish: 'Español', english: 'Inglés', japanese: 'Japonés',
        portuguese: 'Portugués', french: 'Francés', german: 'Alemán',
        italian: 'Italiano', korean: 'Coreano', chinese: 'Chino'
    };

    function urlSegura(valor) {
        try {
            var u = new URL(String(valor || '').trim());
            return u.protocol === 'https:' ? u.href : '';
        } catch (_) {
            return '';
        }
    }

    function esLectorOficial(site) {
        var s = String(site || '').toLowerCase().trim();
        return LECTORES_OFICIALES.indexOf(s) !== -1;
    }

    function desdeAniList(item, esAnime) {
        return (Array.isArray(item.externalLinks) ? item.externalLinks : [])
            .filter(function (l) {
                if (!l || l.isDisabled) return false;
                if (l.type === 'STREAMING') return true;
                return !esAnime && esLectorOficial(l.site);
            })
            .map(function (l) {
                var idioma = l.language ? (IDIOMAS[String(l.language).toLowerCase()] || String(l.language)) : '';
                return { site: String(l.site || ''), url: urlSegura(l.url), idioma: idioma };
            });
    }

    // Respaldo para anime: streamingEpisodes trae el sitio de cada episodio
    // pero no el de la serie, así que se usa el primer episodio de cada sitio.
    function desdeEpisodios(item) {
        return (Array.isArray(item.streamingEpisodes) ? item.streamingEpisodes : [])
            .map(function (e) { return { site: String(e && e.site || ''), url: urlSegura(e && e.url), idioma: '' }; });
    }

    function desdeMangaDex(item) {
        var links = item.mangadexLinks;
        if (!links || typeof links !== 'object') return [];
        return Object.keys(MANGADEX_LINKS).filter(function (k) { return links[k]; }).map(function (k) {
            var def = MANGADEX_LINKS[k];
            return { site: def[0], url: urlSegura(def[1] + links[k]), idioma: '' };
        });
    }

    function recolectar(item, esAnime) {
        if (!item || typeof item !== 'object') return [];
        var lista = desdeAniList(item, esAnime);
        if (esAnime && !lista.some(function (l) { return l.url; })) lista = desdeEpisodios(item);
        if (!esAnime) lista = lista.concat(desdeMangaDex(item));

        var vistos = {};
        var unicos = lista.filter(function (l) {
            if (!l.url || !l.site) return false;
            var clave = l.site.toLowerCase() + '|' + l.idioma.toLowerCase();
            if (vistos[clave]) return false;
            vistos[clave] = true;
            return true;
        });
        // El público de la app es hispanohablante: lo que está en español va
        // primero; el resto conserva el orden de la fuente.
        return unicos.filter(function (l) { return l.idioma === 'Español'; })
            .concat(unicos.filter(function (l) { return l.idioma !== 'Español'; }));
    }

    function html(item, esAnime) {
        var enlaces = recolectar(item, esAnime);
        if (!enlaces.length) return '';
        var esc = window.escapeHtml;
        var titulo = esAnime ? 'DÓNDE VER' : 'DÓNDE LEER';
        var chips = enlaces.map(function (l) {
            var texto = l.idioma ? l.site + ' · ' + l.idioma : l.site;
            return '<a class="detail-chip detail-chip-link detail-watch-link" href="' + esc(l.url) +
                '" target="_blank" rel="noopener noreferrer nofollow">' + esc(texto) + '</a>';
        }).join('');
        return '<div class="detail-section detail-section-watch">' +
            '<h2 class="detail-section-title">' + titulo + '</h2>' +
            '<div class="detail-chips">' + chips + '</div>' +
            '<p class="detail-watch-note">Enlaces oficiales. La disponibilidad puede variar según tu región.</p>' +
            '</div>';
    }

    window.DetalleWatchLinks = {
        recolectar: recolectar,
        html: html
    };
})(window);
