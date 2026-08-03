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
    if (Number.isFinite(numScore) && numScore > 0) {
        datos.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue: numScore,
            bestRating: 10,
            worstRating: 0,
            ratingCount: 1
        };
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'ld-json-item';
    // textContent (no innerHTML): el contenido va como texto plano, sin
    // riesgo de inyeccion con titulos o sinopsis raros.
    script.textContent = JSON.stringify(datos);
    document.head.appendChild(script);
}
