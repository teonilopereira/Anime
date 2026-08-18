// js/detalle/render-sections.js
// Builders de secciones y SEO del detalle, extraídos de renderDetalle (render.js)
// para achicar esa función. Son funciones puras (entrada → string) salvo
// applyDetailSeo, que escribe meta tags en <head>. Solo dependen de globales ya
// cargados (escapeHtml, safeUrl, window.DetalleTemporadas), así que este archivo
// se carga antes que render.js pero no necesita ningún estado suyo.

// ── Banner ──
// Imagen ancha de AniList (bannerImage). No todas las obras tienen una.
function buildBannerHtml(item) {
    return item.bannerImage
        ? '<div class="detail-banner"><img src="' + safeUrl(item.bannerImage) + '" alt="" loading="lazy" decoding="async"></div>'
        : '';
}

// ── Tráiler ──
// AniList devuelve site 'youtube' o 'dailymotion'. Solo se embebe YouTube
// (es el unico host abierto en el CSP de detalle.html) y con nocookie, para
// no dejarle una cookie de tracking al visitante que ni le da play.
//
// Va como fachada: se pinta la miniatura y el iframe recien se inserta al
// hacer clic. Cargarlo de entrada suma ~1 MB de JS de YouTube a una ficha
// donde la mayoria nunca toca play.
function buildTrailerHtml(item) {
    const trailer = item.trailer || null;
    const trailerId = (trailer && trailer.site === 'youtube' && /^[\w-]{5,20}$/.test(String(trailer.id)))
        ? String(trailer.id)
        : '';
    return trailerId ? `
        <div class="detail-section detail-section-trailer">
            <h2 class="detail-section-title">TRÁILER</h2>
            <div class="trailer-box">
                <button class="trailer-facade" type="button" data-yt="${escapeHtml(trailerId)}" aria-label="Reproducir tráiler de ${escapeHtml(item.titulo)}">
                    <img class="trailer-thumb" src="${safeUrl('https://img.youtube.com/vi/' + trailerId + '/hqdefault.jpg')}" alt="" loading="lazy">
                    <span class="trailer-play"><i data-lucide="play"></i></span>
                </button>
            </div>
        </div>
    ` : '';
}

// ── Related items ──
// Secuelas/precuelas en formato de serie ya salen en la sección "Temporadas",
// así que se filtran acá (cadenaTemporadas) para no repetirlas.
function buildRelatedHtml(item, cadenaTemporadas) {
    var Temporadas = window.DetalleTemporadas;
    var relationTypeLabels = {
        'SEQUEL': 'Secuela', 'PREQUEL': 'Precuela', 'SIDE_STORY': 'Historia paralela',
        'SPIN_OFF': 'Spin-off', 'ADAPTATION': 'Adaptación', 'SUMMARY': 'Resumen',
        'ALTERNATIVE': 'Alternativa', 'PARENT': 'Principal', 'CONTAINS': 'Contiene', 'OTHER': 'Otro'
    };
    function relatedCategory(fmt) {
        if (fmt === 'NOVEL') return 'novelas';
        return ['TV','TV_SHORT','MOVIE','SPECIAL','OVA','ONA','MUSIC'].indexOf(fmt) !== -1 ? 'anime' : 'manga';
    }
    var relatedMap = {};
    function pushRelated(src) {
        if (!src || String(src.id) === String(item.id) || !src.title) return;
        // Las temporadas ya tienen su propia sección: repetirlas acá era
        // justamente el amontonamiento que se vino a arreglar.
        if (cadenaTemporadas && (src.relationType === 'SEQUEL' || src.relationType === 'PREQUEL') &&
            Temporadas.esFormatoDeTemporada(src.format)) return;
        var key = String(src.id);
        if (relatedMap[key]) return;
        relatedMap[key] = src;
    }
    (Array.isArray(item.relations) ? item.relations : []).forEach(pushRelated);
    if (Array.isArray(item.seasons)) {
        item.seasons.forEach(function (s, i) {
            if (i === 0) return;
            pushRelated({ relationType: 'SEQUEL', id: s.id, title: s.title, episodes: s.episodes || 0, format: s.format, seasonYear: s.seasonYear, img: s.img });
        });
    }
    // Segunda linea de la card: año y cantidad de episodios/capitulos, lo que
    // haya. Sin esto dos secuelas del mismo año eran indistinguibles.
    function relatedMeta(r) {
        var partes = [];
        if (r.seasonYear) partes.push(r.seasonYear);
        if (r.episodes) partes.push(r.episodes + (r.episodes === 1 ? ' ep' : ' eps'));
        else if (r.chapters) partes.push(r.chapters + ' caps');
        else if (r.volumes) partes.push(r.volumes + (r.volumes === 1 ? ' vol' : ' vols'));
        return partes.join(' · ');
    }
    var relatedList = Object.keys(relatedMap).map(function (k) { return relatedMap[k]; }).slice(0, 12);
    if (!relatedList.length) return '';
    return '<div class="detail-section detail-section-related"><h2 class="detail-h2">Relacionados</h2><div class="related-grid">' +
        relatedList.map(function (r) {
            var cat = relatedCategory(r.format);
            var label = relationTypeLabels[r.relationType] || r.relationType || 'Relacionado';
            var meta = relatedMeta(r);
            // Sin portada la card queda igual de alta que el resto: el hueco
            // se rellena con la inicial del titulo en vez de descuadrar la
            // grilla.
            var portada = r.img
                ? '<img src="' + safeUrl(r.img) + '" alt="" loading="lazy" decoding="async" data-fallback-catalog="1" data-title="' + escapeHtml(r.title) + '">'
                : '<span class="related-cover-empty" aria-hidden="true">' + escapeHtml(String(r.title).charAt(0)) + '</span>';
            return '<a class="related-card" href="detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(r.id) + '">' +
                '<span class="related-cover">' + portada +
                    '<span class="related-type-badge">' + escapeHtml(label) + '</span>' +
                '</span>' +
                '<span class="related-body">' +
                    '<span class="related-title">' + escapeHtml(r.title) + '</span>' +
                    (meta ? '<span class="related-meta">' + escapeHtml(meta) + '</span>' : '') +
                '</span>' +
                '</a>';
        }).join('') +
        '</div></div>';
}

// ── Personajes y seiyuus ──
// Vienen en la misma query por id que el resto del detalle, asi que la
// seccion no cuesta un request extra. Solo AniList los tiene: en obras de
// MangaDex la lista llega vacia y la seccion no se pinta.
function buildCharactersHtml(item) {
    var characterRoleLabels = { MAIN: 'Principal', SUPPORTING: 'Secundario', BACKGROUND: 'Fondo' };
    var characters = Array.isArray(item.characters) ? item.characters : [];
    if (!characters.length) return '';
    return '<div class="detail-section detail-section-chars"><h2 class="detail-h2">Personajes</h2><div class="char-grid">' +
        characters.map(function (c) {
            var roleLabel = characterRoleLabels[c.role] || '';
            // Cada mitad enlaza a su ficha en personaje.html cuando hay id: el
            // personaje (tipo=character) a la izquierda y el seiyū (tipo=staff) a
            // la derecha. Sin id se cae a un <div> no clicable (obras de MangaDex,
            // personajes sin actor cargado). El tag y el href se calculan aparte
            // para no repetir el markup interno de cada card.
            var charTag = c.id
                ? '<a class="char-side" href="personaje.html?tipo=character&id=' + escapeHtml(String(c.id)) + '">'
                : '<div class="char-side">';
            var charTagEnd = c.id ? '</a>' : '</div>';
            // La ficha del actor de voz ocupa la mitad derecha de la card y
            // se omite entera cuando el personaje no tiene uno cargado
            // (pasa en manga y en personajes de fondo).
            var vaTag = c.vaId
                ? '<a class="char-side char-side-va" href="personaje.html?tipo=staff&id=' + escapeHtml(String(c.vaId)) + '">'
                : '<div class="char-side char-side-va">';
            var vaTagEnd = c.vaId ? '</a>' : '</div>';
            var vaHtml = c.vaName
                ? vaTag +
                    '<div class="char-text char-text-right">' +
                        '<span class="char-name">' + escapeHtml(c.vaName) + '</span>' +
                        '<span class="char-role">Seiyū</span>' +
                    '</div>' +
                    (c.vaImage ? '<img class="char-face" src="' + safeUrl(c.vaImage) + '" alt="" loading="lazy">' : '') +
                  vaTagEnd
                : '';
            return '<div class="char-card">' +
                charTag +
                    (c.image ? '<img class="char-face" src="' + safeUrl(c.image) + '" alt="" loading="lazy">' : '') +
                    '<div class="char-text">' +
                        '<span class="char-name">' + escapeHtml(c.name) + '</span>' +
                        (roleLabel ? '<span class="char-role">' + escapeHtml(roleLabel) + '</span>' : '') +
                    '</div>' +
                charTagEnd +
                vaHtml +
                '</div>';
        }).join('') +
        '</div></div>';
}

// ── Categoría de destino a partir del formato/tipo (para enlazar fichas) ──
// Compartido por Recomendaciones y Relacionados de otras fuentes.
function _detailCatFromFormat(fmt, type) {
    if (fmt === 'NOVEL') return 'novelas';
    if (['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'].indexOf(fmt) !== -1) return 'anime';
    if (type === 'ANIME') return 'anime';
    return 'manga';
}

// ── Rankings (badges de AniList) ──
// "#1 más popular de 2021", "#3 mejor puntuado all-time", etc. Se traduce el
// contexto de AniList (viene en inglés) a algo legible. Se muestran los más
// relevantes primero (rank bajo = mejor) y como máximo cuatro.
function buildRankingsHtml(item) {
    var rankings = Array.isArray(item.rankings) ? item.rankings : [];
    if (!rankings.length) return '';

    function contextoES(r) {
        var esRated = r.type === 'RATED' || /rated/i.test(r.context);
        var base = esRated ? 'mejor puntuado' : 'más popular';
        if (r.allTime || /all\s*time/i.test(r.context)) return base + ' de la historia';
        if (r.year && r.season) {
            var estaciones = { WINTER: 'invierno', SPRING: 'primavera', SUMMER: 'verano', FALL: 'otoño' };
            return base + ' de ' + (estaciones[r.season] || '') + ' ' + r.year;
        }
        if (r.year) return base + ' de ' + r.year;
        return base;
    }

    var badges = rankings
        .slice()
        .sort(function (a, b) { return a.rank - b.rank; })
        .slice(0, 4)
        .map(function (r) {
            var esRated = r.type === 'RATED' || /rated/i.test(r.context);
            var icono = esRated ? 'star' : 'flame';
            return '<span class="detail-rank-badge' + (r.rank === 1 ? ' is-top' : '') + '">' +
                '<i data-lucide="' + icono + '"></i>' +
                '<strong>#' + escapeHtml(String(r.rank)) + '</strong>' +
                '<span>' + escapeHtml(contextoES(r)) + '</span>' +
                '</span>';
        }).join('');

    return '<div class="detail-rankings">' + badges + '</div>';
}

// ── Tags de AniList ──
// Más específicos que los géneros (Isekai, Time Loop, …), con su % de relevancia.
// Se ocultan los +18 salvo en modo NSFW. Solo los trae AniList.
function buildTagsHtml(item, showAdult) {
    var tags = (Array.isArray(item.tags) ? item.tags : [])
        .filter(function (t) { return showAdult || !t.isAdult; })
        .slice(0, 16);
    if (!tags.length) return '';
    return '<div class="detail-section detail-section-tags">' +
        '<h2 class="detail-section-title">TAGS</h2>' +
        '<div class="detail-chips detail-tag-chips">' +
        tags.map(function (t) {
            var pct = t.rank ? '<span class="detail-tag-rank">' + escapeHtml(String(t.rank)) + '%</span>' : '';
            return '<span class="detail-chip detail-tag-chip">' + escapeHtml(t.name) + pct + '</span>';
        }).join('') +
        '</div></div>';
}

// ── Distribución de notas y estados de la comunidad ──
// scoreDistribution: barras verticales (histograma de votos). Sirve tanto para
// AniList (buckets 10..100) como para MangaDex (1..10). statusDistribution: solo
// AniList — cuánta gente lo tiene viendo/completado/etc.
function buildStatsDistributionHtml(item) {
    var score = Array.isArray(item.scoreDistribution) ? item.scoreDistribution : [];
    var estados = Array.isArray(item.statusDistribution) ? item.statusDistribution : [];
    if (!score.length && !estados.length) return '';

    var scoreHtml = '';
    if (score.length) {
        var maxAmount = score.reduce(function (m, s) { return Math.max(m, s.amount); }, 0) || 1;
        // AniList da la nota como 10..100; MangaDex como 1..10. Se muestra /10.
        var esCien = score.some(function (s) { return s.score > 10; });
        var barras = score.map(function (s) {
            var alto = Math.max(4, Math.round((s.amount / maxAmount) * 100));
            var etiqueta = esCien ? Math.round(s.score / 10) : s.score;
            return '<div class="dist-bar-col" title="' + escapeHtml(String(etiqueta)) + '/10: ' + escapeHtml(s.amount.toLocaleString('es-AR')) + '">' +
                '<div class="dist-bar" style="height:' + alto + '%"></div>' +
                '<span class="dist-bar-label">' + escapeHtml(String(etiqueta)) + '</span>' +
                '</div>';
        }).join('');
        scoreHtml = '<div class="dist-block"><h3 class="dist-title">Distribución de notas</h3>' +
            '<div class="dist-bars">' + barras + '</div></div>';
    }

    var estadoHtml = '';
    if (estados.length) {
        var statusLabels = {
            CURRENT: 'Viendo', PLANNING: 'Pendiente', COMPLETED: 'Completado',
            DROPPED: 'Abandonado', PAUSED: 'En pausa', REPEATING: 'Repitiendo'
        };
        var totalEstados = estados.reduce(function (a, s) { return a + s.amount; }, 0) || 1;
        var filas = estados
            .slice()
            .sort(function (a, b) { return b.amount - a.amount; })
            .map(function (s) {
                var pct = Math.round((s.amount / totalEstados) * 100);
                var label = statusLabels[s.status] || s.status;
                return '<div class="dist-status-row">' +
                    '<span class="dist-status-name">' + escapeHtml(label) + '</span>' +
                    '<span class="dist-status-track"><span class="dist-status-fill dist-status-' + escapeHtml(String(s.status).toLowerCase()) + '" style="width:' + pct + '%"></span></span>' +
                    '<span class="dist-status-pct">' + pct + '%</span>' +
                    '</div>';
            }).join('');
        estadoHtml = '<div class="dist-block"><h3 class="dist-title">Estado en la comunidad</h3>' +
            '<div class="dist-status-list">' + filas + '</div></div>';
    }

    return '<div class="detail-section detail-section-dist">' +
        '<h2 class="detail-h2">Estadísticas</h2>' +
        '<div class="dist-grid">' + scoreHtml + estadoHtml + '</div></div>';
}

// ── Recomendaciones de la comunidad ──
// "Si te gustó esto, mirá…". Votadas por usuarios de AniList. Se pintan como
// una grilla de portadas que enlazan a la ficha correspondiente.
function buildRecommendationsHtml(item) {
    var recos = (Array.isArray(item.recommendations) ? item.recommendations : []).slice(0, 12);
    if (!recos.length) return '';
    return '<div class="detail-section detail-section-recos"><h2 class="detail-h2">Recomendados</h2><div class="related-grid">' +
        recos.map(function (r) {
            var cat = _detailCatFromFormat(r.format, r.type);
            var portada = r.img
                ? '<img src="' + safeUrl(r.img) + '" alt="" loading="lazy" decoding="async" data-fallback-catalog="1" data-title="' + escapeHtml(r.title) + '">'
                : '<span class="related-cover-empty" aria-hidden="true">' + escapeHtml(String(r.title).charAt(0)) + '</span>';
            var meta = r.score ? '<span class="related-meta">★ ' + escapeHtml(String(r.score)) + '</span>' : '';
            return '<a class="related-card" href="detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(r.id) + '">' +
                '<span class="related-cover">' + portada + '</span>' +
                '<span class="related-body">' +
                    '<span class="related-title">' + escapeHtml(r.title) + '</span>' +
                    meta +
                '</span>' +
                '</a>';
        }).join('') +
        '</div></div>';
}

// ── Calendario de emisión de la obra (próximos episodios) ──
// Lista completa de próximos episodios (no solo el siguiente). Solo anime en
// emisión. airingAt es epoch absoluto, así que el cálculo aguanta el cache.
function buildAiringScheduleHtml(item) {
    var lista = (Array.isArray(item.airingScheduleList) ? item.airingScheduleList : [])
        .filter(function (n) { return n.airingAt * 1000 > Date.now(); })
        .slice(0, 8);
    if (lista.length < 2) return '';
    var filas = lista.map(function (n) {
        var fecha = new Date(n.airingAt * 1000).toLocaleString('es-AR', {
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
        });
        return '<li class="airing-row">' +
            '<span class="airing-ep">EP ' + escapeHtml(String(n.episode || '?')) + '</span>' +
            '<span class="airing-when">' + escapeHtml(fecha) + ' hs</span>' +
            '</li>';
    }).join('');
    return '<div class="detail-section detail-section-airing">' +
        '<h2 class="detail-h2">Próximos episodios</h2>' +
        '<ul class="airing-list">' + filas + '</ul></div>';
}

// ── Idiomas de traducción (MangaDex) ──
// Chips con los idiomas donde hay scanlation. Destaca español e inglés.
function buildTranslatedLangsHtml(item) {
    var langs = (Array.isArray(item.availableTranslatedLanguages) ? item.availableTranslatedLanguages : [])
        .filter(Boolean);
    if (!langs.length) return '';
    var nombres = {
        es: 'Español', 'es-la': 'Español (LatAm)', en: 'Inglés', ja: 'Japonés',
        ko: 'Coreano', zh: 'Chino', 'zh-hk': 'Chino (HK)', 'pt-br': 'Portugués (BR)',
        fr: 'Francés', it: 'Italiano', de: 'Alemán', ru: 'Ruso'
    };
    var destacados = { es: 1, 'es-la': 1, en: 1 };
    var ordenados = langs.slice().sort(function (a, b) {
        return (destacados[b] || 0) - (destacados[a] || 0);
    }).slice(0, 16);
    return '<div class="detail-section detail-section-langs">' +
        '<h2 class="detail-section-title">TRADUCCIONES</h2>' +
        '<div class="detail-chips">' +
        ordenados.map(function (l) {
            var dest = destacados[l] ? ' detail-chip-link' : '';
            return '<span class="detail-chip' + dest + '">' + escapeHtml(nombres[l] || l) + '</span>';
        }).join('') +
        '</div></div>';
}

// ── SEO / meta tags / datos estructurados ──
// Escribe en <head> las meta de description/Open Graph/Twitter, el canonical y
// el JSON-LD de la obra. El canonical se arma solo con cat + id (los únicos
// parámetros que cambian qué ficha se muestra) para que la misma obra no tenga
// una URL canónica distinta por cada variante de link del catálogo.
function _detailSetMetaTag(name, content, attrName = 'name') {
    if (!content) return;
    let meta = document.querySelector(`meta[${attrName}="${name}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attrName, name);
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
}

function _detailSetCanonical(url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
    }
    link.setAttribute('href', url);
}

// Google corta las descripciones cerca de los 155 caracteres; mandar la
// sinopsis entera no suma y se ve truncada.
function _detailRecortarDescripcion(texto, max = 155) {
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
    if (limpio.length <= max) return limpio;
    const corte = limpio.slice(0, max - 1);
    const ultimoEspacio = corte.lastIndexOf(' ');
    return (ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trim() + '…';
}

// Nombre legible de la categoría para migas de pan y textos de las FAQ.
function _detailCatLabel(categoria) {
    if (categoria === 'anime') return 'Anime';
    if (categoria === 'novelas') return 'Novelas';
    return 'Manga';
}

function _detailCatHref(categoria) {
    if (categoria === 'anime') return 'anime.html';
    if (categoria === 'novelas') return 'novelas.html';
    return 'manga.html';
}

function applyDetailSeo(item, ctx) {
    const { categoria, isAnime, generos, summaryText, pageTitle } = ctx;
    const metaDesc = _detailRecortarDescripcion(summaryText);

    const canonicalParams = new URLSearchParams();
    if (categoria) canonicalParams.set('cat', categoria);
    canonicalParams.set('id', String(item.id));
    const canonicalUrl = window.location.origin + window.location.pathname
        + '?' + canonicalParams.toString();

    _detailSetMetaTag('description', metaDesc);
    _detailSetMetaTag('og:title', pageTitle, 'property');
    _detailSetMetaTag('og:description', metaDesc, 'property');
    _detailSetMetaTag('og:image', item.img, 'property');
    _detailSetMetaTag('og:url', canonicalUrl, 'property');
    _detailSetMetaTag('og:type', isAnime ? 'video.tv_show' : 'book', 'property');
    _detailSetMetaTag('twitter:card', 'summary_large_image');
    _detailSetMetaTag('twitter:title', pageTitle);
    _detailSetMetaTag('twitter:description', metaDesc);
    _detailSetMetaTag('twitter:image', item.img);
    _detailSetCanonical(canonicalUrl);

    // Datos estructurados: habilitan los resultados enriquecidos de Google
    // (imagen, puntuacion, cantidad de episodios) en vez de un link pelado.
    const previo = document.getElementById('ld-json-item');
    if (previo) previo.remove();

    const numScore = Number(item.score ?? item.puntaje);
    const datos = {
        '@context': 'https://schema.org',
        '@type': isAnime ? 'TVSeries' : 'Book',
        name: item.titulo,
        url: canonicalUrl,
        description: metaDesc,
        inLanguage: 'es'
    };
    if (item.img) datos.image = item.img;
    if (generos.length) datos.genre = generos;
    if (isAnime && Number(item.capitulos || item.episodios || item.episodes)) {
        datos.numberOfEpisodes = Number(item.capitulos || item.episodios || item.episodes);
    }
    // ratingCount debe ser un conteo REAL de valoraciones: Google ignora (o
    // marca como spam) un AggregateRating con ratingCount inventado. Se usa la
    // popularidad de AniList (usuarios que la tienen en su lista) como conteo, o
    // los favoritos si falta; si no hay ninguno, no se emite aggregateRating.
    const ratingCount = Number(item.popularity) || Number(item.favourites) || 0;
    if (Number.isFinite(numScore) && numScore > 0 && ratingCount > 0) {
        datos.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: numScore,
            bestRating: 10,
            worstRating: 1,
            ratingCount: ratingCount
        };
    }

    _detailWriteLdJson('ld-json-item', datos);

    // ── Migas de pan (BreadcrumbList) ──
    // Le dan a Google la jerarquía Inicio › Categoría › Obra: en los resultados
    // reemplaza la URL pelada por la ruta navegable y refuerza el enlazado interno.
    _detailWriteLdJson('ld-json-breadcrumb', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: window.location.origin + '/index.html' },
            { '@type': 'ListItem', position: 2, name: _detailCatLabel(categoria), item: window.location.origin + '/' + _detailCatHref(categoria) },
            { '@type': 'ListItem', position: 3, name: item.titulo, item: canonicalUrl }
        ]
    });

    // ── FAQ (FAQPage) ──
    // El texto único de las preguntas es justo el contenido "long-tail" que
    // busca la gente ("cuántos capítulos tiene…", "de qué trata…"): habilita el
    // rich result de FAQ y le da a la ficha texto indexable propio.
    const faqEntries = Array.isArray(ctx.faqEntries) ? ctx.faqEntries : [];
    if (faqEntries.length) {
        _detailWriteLdJson('ld-json-faq', {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqEntries.map(e => ({
                '@type': 'Question',
                name: e.q,
                acceptedAnswer: { '@type': 'Answer', text: e.a }
            }))
        });
    } else {
        const prevFaq = document.getElementById('ld-json-faq');
        if (prevFaq) prevFaq.remove();
    }
}

// Reemplaza (o crea) un <script type="application/ld+json"> por id. textContent
// (no innerHTML): el JSON va como texto plano, sin riesgo de inyección con
// títulos o sinopsis raros.
function _detailWriteLdJson(id, data) {
    const previo = document.getElementById(id);
    if (previo) previo.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
}

// Arma las preguntas frecuentes de la obra a partir de los datos que ya se
// mostraron en la ficha (sin pedir nada nuevo). Devuelve las entradas para el
// JSON-LD y el HTML visible (un <details> por pregunta). Solo incluye una
// pregunta si hay dato real que la responda.
function buildDetailFaq(ctx) {
    const {
        titulo, categoria, isAnime, isMangaOrNovela,
        countLabel, countValue, status, anio, generos, studios, summaryText, score
    } = ctx;
    const entries = [];
    const t = titulo || 'esta obra';

    const sinopsisReal = summaryText && summaryText !== 'Sin sinopsis disponible.';
    if (sinopsisReal) {
        entries.push({ q: `¿De qué trata ${t}?`, a: _detailRecortarDescripcion(summaryText, 300) });
    }

    const countNum = Number(countValue);
    if (Number.isFinite(countNum) && countNum > 0) {
        const unidad = String(countLabel || '').toLowerCase();
        entries.push({
            q: `¿Cuántos ${unidad} tiene ${t}?`,
            a: `${t} tiene ${countNum} ${unidad}.`
        });
    }

    if (anio) {
        const verbo = isMangaOrNovela ? 'se publicó por primera vez' : 'se estrenó';
        entries.push({ q: `¿En qué año ${isMangaOrNovela ? 'se publicó' : 'se estrenó'} ${t}?`, a: `${t} ${verbo} en ${anio}.` });
    }

    if (status && status !== 'No especificado') {
        entries.push({ q: `¿${t} ya terminó?`, a: `Estado de ${t}: ${status}.` });
    }

    if (Array.isArray(generos) && generos.length) {
        entries.push({ q: `¿De qué género es ${t}?`, a: `${t} pertenece a los géneros: ${generos.join(', ')}.` });
    }

    if (isAnime && Array.isArray(studios) && studios.length) {
        entries.push({ q: `¿Qué estudio animó ${t}?`, a: `${t} fue producido por ${studios.join(', ')}.` });
    }

    const scoreNum = Number(score);
    if (Number.isFinite(scoreNum) && scoreNum > 0) {
        entries.push({ q: `¿Qué puntuación tiene ${t}?`, a: `${t} tiene una puntuación de ${scoreNum} sobre 10 según AniList.` });
    }

    if (entries.length < 2) return { html: '', entries: [] };

    const detalles = entries.map(e => `
                <details class="detail-faq-item">
                    <summary>${escapeHtml(e.q)}</summary>
                    <p>${escapeHtml(e.a)}</p>
                </details>`).join('');

    const html = `
        <section class="detail-section detail-faq" aria-labelledby="faq-heading">
            <h2 class="detail-h2" id="faq-heading">Preguntas frecuentes</h2>
            ${detalles}
        </section>`;

    return { html, entries };
}
