/**
 * info.js — Secciones "Información" y "Etiquetas" de la ficha.
 *
 * Junta en una tabla los datos que AniList ya manda en MEDIA_BY_ID_QUERY y que
 * la ficha no mostraba: formato, títulos alternativos, fechas, temporada,
 * duración, fuente original, país, autores, popularidad y rankings. Las
 * etiquetas son los tags de AniList sin spoilers.
 *
 * `filas` y `etiquetas` son puras (item → datos) para poder testearlas sin
 * DOM. Cada fila sin dato se omite: en obras de MangaDex o items viejos del
 * cache (TTL 1 h) faltan casi todos los campos y la sección se achica sola, o
 * no se pinta.
 */
(function (window) {
    "use strict";

    var FORMATOS = {
        TV: 'Serie de TV', TV_SHORT: 'Serie corta', MOVIE: 'Película',
        SPECIAL: 'Especial', OVA: 'OVA', ONA: 'ONA (web)', MUSIC: 'Video musical',
        MANGA: 'Manga', NOVEL: 'Novela ligera', ONE_SHOT: 'One-shot'
    };

    var TEMPORADAS = { WINTER: 'Invierno', SPRING: 'Primavera', SUMMER: 'Verano', FALL: 'Otoño' };

    var FUENTES = {
        ORIGINAL: 'Original', MANGA: 'Manga', LIGHT_NOVEL: 'Novela ligera',
        VISUAL_NOVEL: 'Novela visual', VIDEO_GAME: 'Videojuego', OTHER: 'Otra',
        NOVEL: 'Novela', DOUJINSHI: 'Doujinshi', ANIME: 'Anime',
        WEB_NOVEL: 'Novela web', LIVE_ACTION: 'Live action', GAME: 'Juego',
        COMIC: 'Cómic', MULTIMEDIA_PROJECT: 'Proyecto multimedia', PICTURE_BOOK: 'Libro ilustrado'
    };

    // AniList usa ISO 3166 (JP, KR...) y MangaDex códigos de idioma (ja, ko...).
    var PAISES = {
        JP: 'Japón', JA: 'Japón', KR: 'Corea del Sur', KO: 'Corea del Sur',
        CN: 'China', ZH: 'China', 'ZH-HK': 'China', TW: 'Taiwán', EN: 'Internacional'
    };

    // Roles de staff de AniList (en inglés) → etiqueta. El primero que matchea gana.
    var ROLES = [
        [/original creator|original story/i, 'Autor original'],
        [/story\s*&\s*art/i, 'Historia y arte'],
        [/^story/i, 'Historia'],
        [/^art/i, 'Arte'],
        [/director/i, 'Dirección'],
        [/illustrat/i, 'Ilustración']
    ];

    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    function formatearFecha(f) {
        if (!f || !f.year) return '';
        var mes = Number(f.month);
        if (!mes || mes < 1 || mes > 12) return String(f.year);
        var dia = Number(f.day);
        return (dia ? dia + ' ' : '') + MESES[mes - 1] + ' ' + f.year;
    }

    function numero(n) {
        return Number(n).toLocaleString('es-AR');
    }

    function rangoFechas(item, enCurso) {
        var inicio = formatearFecha(item.startDate) || (item.startYear ? String(item.startYear) : '');
        if (!inicio) return '';
        var fin = formatearFecha(item.endDate) || (item.endYear ? String(item.endYear) : '');
        if (fin && fin !== inicio) return inicio + ' – ' + fin;
        if (!fin && enCurso) return inicio + ' – actualidad';
        return inicio;
    }

    function autores(staff) {
        if (!Array.isArray(staff)) return '';
        var vistos = {};
        var partes = [];
        staff.forEach(function (s) {
            if (!s || !s.name || vistos[s.name]) return;
            var rol = '';
            for (var i = 0; i < ROLES.length; i++) {
                if (ROLES[i][0].test(String(s.role || ''))) { rol = ROLES[i][1]; break; }
            }
            if (!rol) return;
            vistos[s.name] = true;
            partes.push(s.name + ' (' + rol + ')');
        });
        return partes.slice(0, 4).join(', ');
    }

    function rankings(lista) {
        if (!Array.isArray(lista)) return [];
        var out = [];
        ['RATED', 'POPULAR'].forEach(function (tipo) {
            var r = lista.find(function (x) { return x && x.type === tipo && x.allTime && Number(x.rank) > 0; });
            if (!r) return;
            out.push('#' + numero(r.rank) + (tipo === 'RATED' ? ' mejor puntuado' : ' más popular'));
        });
        return out;
    }

    function titulosAlternativos(item) {
        var principal = String(item.titulo || item.title || '').toLowerCase();
        var vistos = {};
        vistos[principal] = true;
        var out = [];
        [item.title_romaji, item.title_english, item.title_native]
            .concat(Array.isArray(item.synonyms) ? item.synonyms : [])
            .forEach(function (t) {
                var s = String(t || '').trim();
                if (!s || vistos[s.toLowerCase()]) return;
                vistos[s.toLowerCase()] = true;
                out.push(s);
            });
        return out.slice(0, 6);
    }

    // item (ya normalizado) + categoría → [{ label, valor }] sin filas vacías.
    function filas(item, categoria) {
        if (!item) return [];
        var isAnime = categoria === 'anime';
        var enCurso = String(item.status || '').toUpperCase() === 'RELEASING';
        var out = [];
        function push(label, valor) {
            if (valor != null && valor !== '' && valor !== 0) out.push({ label: label, valor: String(valor) });
        }

        var fmt = String(item.format || '').toUpperCase();
        var formato = FORMATOS[fmt];
        if (fmt === 'NOVEL') {
            // Misma regla que los catalogos (api.js): AniList no distingue
            // novela ligera de novela web, se deriva del pais de origen.
            var origenNovela = String(item.countryOfOrigin || '').toUpperCase();
            formato = origenNovela === 'JP' ? 'Novela ligera'
                : origenNovela === 'KR' ? 'Novela coreana'
                : (origenNovela === 'CN' || origenNovela === 'TW') ? 'Novela china'
                : 'Novela';
        }
        push('Formato', formato || (isAnime ? '' : item.type) || '');

        var alt = titulosAlternativos(item);
        push('Otros títulos', alt.join(' · '));

        push(isAnime ? 'Emisión' : 'Publicación', rangoFechas(item, enCurso));

        if (isAnime && item.season && item.seasonYear) {
            push('Temporada', (TEMPORADAS[String(item.season).toUpperCase()] || item.season) + ' ' + item.seasonYear);
        }

        var dur = Number(item.duration) || 0;
        if (isAnime && dur > 0) {
            // En películas es la duración total; en series, la de cada episodio.
            var texto = dur >= 60
                ? Math.floor(dur / 60) + ' h' + (dur % 60 ? ' ' + (dur % 60) + ' min' : '')
                : dur + ' min';
            push('Duración', fmt === 'MOVIE' ? texto : texto + ' por episodio');
        }

        var fuente = String(item.source || '').toUpperCase();
        if (fuente) push('Fuente', FUENTES[fuente] || item.source);

        var pais = String(item.countryOfOrigin || '').toUpperCase();
        if (pais) push('Origen', PAISES[pais] || pais);

        if (!isAnime) push('Autores', autores(item.staff));

        var media = Number(item.meanScore) || 0;
        if (media > 0) push('Puntaje medio', media.toFixed(1) + ' / 10');

        var pop = Number(item.popularity) || 0;
        if (pop > 0) push('Popularidad', numero(pop) + ' usuarios en AniList');

        var favs = Number(item.favourites) || 0;
        if (favs > 0) push('Favoritos', numero(favs));

        push('Ranking', rankings(item.rankings).join(' · '));

        return out;
    }

    // Tags de AniList sin spoilers, ordenados por relevancia (rank 0-100).
    function etiquetas(item, max) {
        if (!item || !Array.isArray(item.tags)) return [];
        return item.tags
            .filter(function (t) { return t && t.name && !t.isMediaSpoiler; })
            .sort(function (a, b) { return (Number(b.rank) || 0) - (Number(a.rank) || 0); })
            .slice(0, max || 12)
            .map(function (t) { return { name: String(t.name), rank: Number(t.rank) || 0 }; });
    }

    function html(item, categoria) {
        var esc = window.escapeHtml;
        var lista = filas(item, categoria);
        var tags = etiquetas(item);
        var out = '';
        if (lista.length) {
            out += '<div class="detail-section detail-section-info">' +
                '<h2 class="detail-section-title">INFORMACIÓN</h2>' +
                '<dl class="detail-info-list">' +
                lista.map(function (f) {
                    return '<div class="detail-info-row"><dt>' + esc(f.label) + '</dt><dd>' + esc(f.valor) + '</dd></div>';
                }).join('') +
                '</dl></div>';
        }
        if (tags.length) {
            out += '<div class="detail-section detail-section-tags">' +
                '<h2 class="detail-section-title">ETIQUETAS</h2>' +
                '<div class="detail-chips">' +
                tags.map(function (t) {
                    return '<span class="detail-chip detail-chip-tag" title="Relevancia ' + t.rank + '%">' + esc(t.name) + '</span>';
                }).join('') +
                '</div></div>';
        }
        return out;
    }

    window.DetalleInfo = {
        filas: filas,
        etiquetas: etiquetas,
        formatearFecha: formatearFecha,
        html: html
    };
})(window);
