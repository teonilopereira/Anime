// Mismos formatos de id que acepta detalle/data.js: el numerico de AniList y el
// UUID de MangaDex. Sin el UUID, cualquier titulo servido por MangaDex perdia el
// id al validarse y no se podia comparar.
const CMP_ID_NUMERICO = /^[a-z]?\d+$/i;
const CMP_ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esIdValido(id) {
    return CMP_ID_NUMERICO.test(id) || CMP_ID_UUID.test(id);
}

function parseParams() {
    const p = new URLSearchParams(window.location.search);
    const VALID_CATS = new Set(['anime', 'manga', 'novelas']);
    const cat1 = (p.get('cat1') || 'anime').toLowerCase();
    const cat2 = (p.get('cat2') || 'anime').toLowerCase();
    const id1 = p.get('id1') || '';
    const id2 = p.get('id2') || '';
    return {
        cat1: VALID_CATS.has(cat1) ? cat1 : 'anime',
        id1: esIdValido(id1) ? id1 : '',
        cat2: VALID_CATS.has(cat2) ? cat2 : 'anime',
        id2: esIdValido(id2) ? id2 : ''
    };
}

// Detalle por id, directo a la API que corresponde. No se usa obtenerDetalleItem
// porque arma el nombre del global por categoria ('get' + Cat + 'ById') y para
// 'novelas' eso da getNovelasById, que no existe: las novelas son MANGA en
// AniList y se piden con getMangaById.
async function getDetallesFor(cat, id) {
    if (CMP_ID_UUID.test(String(id))) {
        return (typeof window.getMangaDexById === 'function') ? window.getMangaDexById(id) : null;
    }
    const porId = cat === 'anime' ? window.getAnimeById : window.getMangaById;
    return (typeof porId === 'function') ? porId(id) : null;
}

// Resuelve el id que llega por URL (links compartidos). Va por id y no por el
// listado del catalogo: el top-40 no alcanza para un titulo que salio de una
// busqueda, y los UUID de MangaDex directamente no figuran ahi.
async function getItem(cat, id) {
    if (!id) return null;
    return getDetallesFor(cat, id);
}

// Los items pueden venir del catálogo local ({titulo, img, info}) o de la
// API AniList/MangaDex ({title, images, ...}) — normalizamos los campos acá.
function compareItemTitle(item) {
    return item?.titulo || item?.title || 'Sin título';
}

function compareItemImage(item) {
    return item?.img || item?.imagen || item?.image
        || (typeof getApiPoster === 'function' ? getApiPoster(item) : '')
        || '';
}

function compareItemInfo(cat, item) {
    if (typeof item?.info === 'string' && item.info) return item.info;
    return (typeof getApiCatalogInfo === 'function') ? getApiCatalogInfo(cat, item) : '';
}

function detailLink(cat, item) {
    return `detalle.html?cat=${encodeURIComponent(cat)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(compareItemTitle(item))}`;
}

const SIN_DATO = '—';

// Cuentas grandes a algo legible de un vistazo: 1200000 -> "1.2M".
function formatCompactNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return SIN_DATO;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
}

// AniList da la duracion por episodio, en minutos.
function formatMinutes(mins) {
    const n = Number(mins);
    if (!Number.isFinite(n) || n <= 0) return SIN_DATO;
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

function formatScore(score) {
    const n = Number(score);
    if (!Number.isFinite(n) || n <= 0) return SIN_DATO;
    return `${n.toFixed(1)}/10`;
}

function formatCount(value) {
    const n = Number(value);
    return (Number.isFinite(n) && n > 0) ? String(n) : SIN_DATO;
}

/**
 * Las tres metricas que se muestran dependen del catalogo: un anime se compara
 * por episodios y duracion, un manga o una novela por volumenes y capitulos.
 * La cuarta (usuarios) es comun y sirve para medir cuan conocido es cada uno.
 *
 * Siempre son cuatro casillas, aunque falte el dato: las dos cards quedan
 * alineadas fila a fila, que es lo unico que hace comparable una comparacion.
 */
function compareStatsFor(cat, item) {
    const puntaje = { icon: 'star', value: formatScore(item?.score), label: 'Puntaje' };
    const usuarios = { icon: 'trending-up', value: formatCompactNumber(item?.popularity), label: 'Usuarios' };

    if (cat === 'anime') {
        const episodios = Number(item?.episodes) || 0;
        return [
            puntaje,
            { icon: 'play', value: formatCount(episodios), label: 'Episodios' },
            {
                icon: 'clock',
                value: formatMinutes(item?.duration),
                // Con un solo episodio (peliculas, especiales) el numero ya es la
                // duracion total; con varios es lo que dura cada uno.
                label: episodios > 1 ? 'Por episodio' : 'Duración'
            },
            usuarios
        ];
    }

    return [
        puntaje,
        { icon: 'book', value: formatCount(item?.volumes), label: 'Volúmenes' },
        { icon: 'book-open', value: formatCount(item?.chapters), label: 'Capítulos' },
        usuarios
    ];
}

// Los formatos de anime llegan como el enum crudo de AniList (MOVIE, TV_SHORT).
// Los de manga y novela ya vienen legibles desde anilistItemToLocal.
const FORMATOS = {
    TV: 'Serie',
    TV_SHORT: 'Serie corta',
    MOVIE: 'Película',
    SPECIAL: 'Especial',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'Musical',
    MANGA: 'Manga',
    NOVEL: 'Novela',
    ONE_SHOT: 'One-shot'
};

function formatMediaFormat(tipo) {
    const clave = String(tipo || '').toUpperCase().replace(/[\s-]/g, '_');
    return FORMATOS[clave] || tipo;
}

// De que material salio la obra (enum `source` de AniList).
const FUENTES = {
    ORIGINAL: 'Original', MANGA: 'Manga', LIGHT_NOVEL: 'Novela ligera',
    VISUAL_NOVEL: 'Novela visual', VIDEO_GAME: 'Videojuego', NOVEL: 'Novela',
    WEB_NOVEL: 'Novela web', DOUJINSHI: 'Doujinshi', ANIME: 'Anime',
    GAME: 'Juego', COMIC: 'Cómic', MULTIMEDIA_PROJECT: 'Proyecto multimedia',
    PICTURE_BOOK: 'Libro ilustrado', LIVE_ACTION: 'Live action', OTHER: 'Otro'
};

// countryOfOrigin llega como codigo de pais en AniList y como codigo de idioma
// en MangaDex; se contemplan ambos.
const PAISES = {
    JP: 'Japón', JA: 'Japón', KR: 'Corea del Sur', KO: 'Corea del Sur',
    CN: 'China', ZH: 'China', 'ZH-HK': 'China', TW: 'Taiwán'
};

function autorDe(item) {
    const staff = Array.isArray(item?.staff) ? item.staff : [];
    const porRol = (frag) => staff.find((s) => String(s.role || '').toLowerCase().includes(frag));
    // "Story & Art" / "Story" es el autor; "Original Creator" cubre spin-offs.
    const elegido = porRol('story') || porRol('original creator') || staff[0];
    return elegido?.name || SIN_DATO;
}

// "1989 – hoy", "2016 – 2019", o el año solo si empezo y termino en el mismo.
function periodoDe(item) {
    const desde = item?.startYear || item?.seasonYear || item?.anio || null;
    if (!desde) return SIN_DATO;
    const hasta = item?.endYear || null;
    if (hasta) return hasta === desde ? String(desde) : `${desde} – ${hasta}`;
    return String(item?.status || '').toUpperCase() === 'RELEASING' ? `${desde} – hoy` : String(desde);
}

// Cuanto falta para el proximo episodio, en el mayor par de unidades util.
function formatoRestante(ms) {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/**
 * Fila de fichas bajo la sinopsis. Igual que con las metricas: siempre son
 * cuatro, con "—" si falta el dato, para que las dos cards queden alineadas.
 */
function detallesPara(cat, item) {
    const favoritos = { label: 'Favoritos', value: formatCompactNumber(item?.favourites) };
    if (cat === 'anime') {
        return [
            { label: 'Estudio', value: (Array.isArray(item?.studios) && item.studios.filter(Boolean)[0]) || SIN_DATO },
            { label: 'Basado en', value: FUENTES[String(item?.source || '').toUpperCase()] || SIN_DATO },
            { label: 'Emisión', value: periodoDe(item) },
            favoritos
        ];
    }
    return [
        { label: 'Autor', value: autorDe(item) },
        { label: 'Origen', value: PAISES[String(item?.countryOfOrigin || '').toUpperCase()] || SIN_DATO },
        { label: 'Publicación', value: periodoDe(item) },
        favoritos
    ];
}

function categoryIcon(cat) {
    if (cat === 'anime') return 'clapperboard';
    if (cat === 'novelas') return 'book-open';
    return 'book';
}

function categoryLabel(cat) {
    if (cat === 'anime') return 'Anime';
    if (cat === 'novelas') return 'Novela';
    return 'Manga';
}

async function renderCompareCard(host, cat, item) {
    if (!host) return;
    if (!item) {
        host.innerHTML = `<div class="cmp-empty">Seleccioná un ítem para comparar</div>`;
        return;
    }

    // El item del listado trae lo justo para la card del catalogo; el detalle por
    // id es el que tiene puntaje, duracion, capitulos y popularidad. Se combinan
    // con el detalle arriba, y si la llamada falla igual se pinta con lo que hay.
    const det = (await getDetallesFor(cat, item.id)) || {};
    const full = Object.assign({}, item, det);

    const titulo = compareItemTitle(full);
    const img = compareItemImage(full);
    const generos = (typeof getApiGenresList === 'function' ? getApiGenresList(full) : [])
        .filter((g) => g && g !== full.type)
        .slice(0, 3);
    const anio = full.startYear || full.seasonYear || full.anio || null;
    const tipo = formatMediaFormat(full.type) || categoryLabel(cat);
    const estado = (typeof formatMediaStatus === 'function')
        ? formatMediaStatus(full.status, cat)
        : (full.status || '');
    const sinopsis = String(full.synopsis || full.sinopsis || '').trim();

    const metaParts = [tipo, anio, generos.join(', ')].filter(Boolean);
    const stats = compareStatsFor(cat, full);
    const detalles = detallesPara(cat, full);

    // Si esta al aire, cuanto falta para el proximo episodio (dato de AniList,
    // solo anime). airingAt es absoluto, asi que el calculo aguanta el cache.
    let proximoEp = '';
    const nextEp = full.nextAiringEpisode;
    if (cat === 'anime' && nextEp?.airingAt) {
        const ms = nextEp.airingAt * 1000 - Date.now();
        if (ms > 0) proximoEp = `Ep. ${Number(nextEp.episode) || '?'} en ${formatoRestante(ms)}`;
    }

    const coverHtml = img
        ? `<img src="${safeUrl(img)}" alt="${escapeHtml(titulo)}" width="460" height="290" decoding="async" loading="lazy">`
        : `<span class="cmp-cover-empty">Sin portada</span>`;

    host.innerHTML = `
        <article class="cmp-card cmp-card--${escapeHtml(cat)}">
            <div class="cmp-cover">
                ${coverHtml}
                <span class="cmp-badge cmp-badge--score">
                    <i data-lucide="star"></i>${escapeHtml(formatScore(full.score))}
                </span>
                <span class="cmp-badge cmp-badge--kind">
                    <i data-lucide="${escapeHtml(categoryIcon(cat))}"></i>${escapeHtml(categoryLabel(cat))}
                </span>
            </div>
            <div class="cmp-body">
                <h3 class="cmp-title" title="${escapeHtml(titulo)}">${escapeHtml(titulo)}</h3>
                <p class="cmp-meta">${metaParts.map((p) => `<span>${escapeHtml(p)}</span>`).join('<i class="cmp-sep"></i>')}</p>
                <p class="cmp-synopsis">${escapeHtml(sinopsis || 'Sin sinopsis disponible.')}</p>
                <div class="cmp-details">
                    ${detalles.map((d) => `
                        <div class="cmp-detail">
                            <span class="cmp-detail-label">${escapeHtml(d.label)}</span>
                            <span class="cmp-detail-value" title="${escapeHtml(d.value)}">${escapeHtml(d.value)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="cmp-stats">
                    ${stats.map((s) => `
                        <div class="cmp-stat">
                            <i data-lucide="${escapeHtml(s.icon)}"></i>
                            <span class="cmp-stat-value">${escapeHtml(s.value)}</span>
                            <span class="cmp-stat-label">${escapeHtml(s.label)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="cmp-footer">
                    <span class="cmp-status" data-estado="${escapeHtml(String(full.status || '').toUpperCase())}">${escapeHtml(estado || SIN_DATO)}</span>
                    ${proximoEp ? `<span class="cmp-next-ep">${escapeHtml(proximoEp)}</span>` : ''}
                    <a class="cmp-open" href="${escapeHtml(detailLink(cat, full))}">Abrir detalle</a>
                </div>
            </div>
        </article>
    `;

    // Las cards se inyectan despues del createIcons() del arranque, asi que los
    // data-lucide recien agregados hay que resolverlos a mano.
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons(); } catch (e) { /* no bloquear el render */ }
    }
}

function syncUrl(cat1, id1, cat2, id2) {
    const p = new URLSearchParams();
    p.set('cat1', cat1);
    p.set('id1', id1);
    p.set('cat2', cat2);
    p.set('id2', id2);
    history.replaceState({}, '', `comparar.html?${p.toString()}`);
}

// ── Buscadores con sugerencias ──────────────────────────────────────────
// Antes cada lado era un <select> con los 40 titulos del top del catalogo:
// no se podia comparar nada que no estuviera en esa primera pagina. Ahora es
// un buscador como el de los catalogos (AniList + MangaDex, con debounce),
// y el <select> queda solo para elegir el catalogo.

document.addEventListener('DOMContentLoaded', () => {
    const params = parseParams();
    const doCompare = document.getElementById('doCompare');
    const lados = [
        { cat: document.getElementById('cat1'), input: document.getElementById('search1'), sug: document.getElementById('sug1'), host: document.getElementById('compareA'), catInicial: params.cat1, idInicial: params.id1, elegido: null, resultados: [], timer: null },
        { cat: document.getElementById('cat2'), input: document.getElementById('search2'), sug: document.getElementById('sug2'), host: document.getElementById('compareB'), catInicial: params.cat2, idInicial: params.id2, elegido: null, resultados: [], timer: null }
    ];

    if (!doCompare || lados.some((l) => !l.cat || !l.input || !l.sug || !l.host)) return;

    function actualizarUrl() {
        syncUrl(
            lados[0].cat.value, lados[0].elegido?.id ?? '',
            lados[1].cat.value, lados[1].elegido?.id ?? ''
        );
    }

    function cerrarSugerencias(lado) {
        lado.sug.classList.remove('is-open');
        lado.sug.innerHTML = '';
    }

    async function elegir(lado, item) {
        lado.elegido = item;
        lado.input.value = compareItemTitle(item);
        cerrarSugerencias(lado);
        await renderCompareCard(lado.host, lado.cat.value, item);
        actualizarUrl();
    }

    function pintarSugerencias(lado) {
        if (!lado.resultados.length) { cerrarSugerencias(lado); return; }
        lado.sug.innerHTML = lado.resultados.map((it, i) => {
            const img = compareItemImage(it);
            const meta = compareItemInfo(lado.cat.value, it);
            return `<button type="button" class="cmp-suggestion" data-idx="${i}">
                ${img ? `<img src="${safeUrl(img)}" alt="" width="34" height="48" loading="lazy" decoding="async">` : ''}
                <span class="cmp-suggestion-body">
                    <span class="cmp-suggestion-title">${escapeHtml(compareItemTitle(it))}</span>
                    <span class="cmp-suggestion-meta">${escapeHtml(meta || '')}</span>
                </span>
            </button>`;
        }).join('');
        lado.sug.classList.add('is-open');
    }

    async function buscar(lado) {
        const query = lado.input.value.trim();
        // Con una sola letra la busqueda quema cuota de AniList para devolver
        // cualquier cosa; desde dos ya es una consulta con intencion.
        if (query.length < 2) { cerrarSugerencias(lado); return; }
        const cat = lado.cat.value;
        let resultados = [];
        try {
            if (cat === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
                resultados = await window.buscarNovelasEnApi(query);
            } else if (typeof window.buscarEnApi === 'function') {
                resultados = await window.buscarEnApi(query, cat);
            }
            if ((cat === 'manga' || cat === 'novelas') && typeof window.fetchMangaDexPage === 'function') {
                try {
                    const md = await window.fetchMangaDexPage(1, 5, [], query);
                    if (md.length) resultados = window.mergeAnilistAndMd(Array.isArray(resultados) ? resultados : [], md);
                } catch (_) { /* MangaDex caido: con AniList alcanza */ }
            }
        } catch (_) { resultados = []; }

        // Si mientras respondia la API el usuario siguio tipeando, esto quedo viejo.
        if (lado.input.value.trim() !== query) return;
        lado.resultados = (Array.isArray(resultados) ? resultados : []).slice(0, AnimeDestiny.Constants.API_SUGGESTION_LIMIT || 8);
        pintarSugerencias(lado);
    }

    lados.forEach((lado) => {
        lado.cat.value = lado.catInicial;

        lado.input.addEventListener('input', () => {
            lado.elegido = null;
            if (lado.timer) clearTimeout(lado.timer);
            lado.timer = setTimeout(() => buscar(lado), AnimeDestiny.Constants.SEARCH_DEBOUNCE_MS || 400);
        });

        lado.input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (lado.resultados.length) elegir(lado, lado.resultados[0]);
            else buscar(lado);
        });

        lado.input.addEventListener('blur', () => {
            window.setTimeout(() => cerrarSugerencias(lado), 180);
        });

        // mousedown y no click: corre antes que el blur del input, que si no
        // cierra el desplegable justo antes de que el click llegue al boton.
        lado.sug.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('.cmp-suggestion');
            if (!btn) return;
            e.preventDefault();
            const it = lado.resultados[Number(btn.getAttribute('data-idx'))];
            if (it) elegir(lado, it);
        });

        lado.cat.addEventListener('change', () => {
            lado.elegido = null;
            lado.input.value = '';
            lado.resultados = [];
            cerrarSugerencias(lado);
            renderCompareCard(lado.host, lado.cat.value, null);
            actualizarUrl();
        });
    });

    doCompare.addEventListener('click', async () => {
        // Si hay texto sin elegir, comparar toma el primer resultado: apretar
        // el boton con "berserk" tipeado tiene que comparar Berserk, no exigir
        // que ademas hayas clickeado la sugerencia.
        for (const lado of lados) {
            if (!lado.elegido && lado.input.value.trim().length >= 2) {
                await buscar(lado);
                if (lado.resultados.length) { await elegir(lado, lado.resultados[0]); continue; }
            }
            await renderCompareCard(lado.host, lado.cat.value, lado.elegido);
        }
        actualizarUrl();
    });

    // Estado inicial: ids de la URL (links compartidos) o cards vacias.
    lados.forEach(async (lado) => {
        if (!lado.idInicial) { renderCompareCard(lado.host, lado.cat.value, null); return; }
        const item = await getItem(lado.cat.value, lado.idInicial);
        if (item) elegir(lado, item);
        else renderCompareCard(lado.host, lado.cat.value, null);
    });
});
