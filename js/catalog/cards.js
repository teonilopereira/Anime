// ==========================================
// catalog/cards.js
// Render de tarjetas, progreso y carga de catálogo desde API
// ==========================================

// Traducción con fallback: si i18n aún no cargó (o la clave no existe),
// devolvemos el texto en español para no dejar la tarjeta en blanco.
function catTr(key, fallback, args) {
    if (window.AppI18n && typeof window.AppI18n.t === 'function') {
        const out = window.AppI18n.t(key, args);
        if (out && out.charAt(0) !== '[') return out;
    }
    return fallback;
}

var SKELETON_COUNT = AnimeDestiny.Constants.SKELETON_COUNT || 40;

function renderSkeletonCards(container, count) {
    if (!container) return;
    const skeletonHTML = `
        <div class="skeleton-card">
            <div class="skeleton-card-shell">
                <div class="skeleton-card-inner">
                    <div class="skeleton-card-poster"></div>
                    <div class="skeleton-card-bar">
                        <div class="skeleton-card-bar-line"></div>
                        <div class="skeleton-card-bar-icon"></div>
                    </div>
                </div>
            </div>
        </div>`;
    container.innerHTML = skeletonHTML.repeat(count);
}

function getApiPoster(item) {
    return item?.images?.webp?.large_image_url
        || item?.images?.jpg?.large_image_url
        || item?.images?.jpg?.image_url
        || item?.images?.webp?.image_url
        || '';
}


function getApiCatalogInfo(categoria, item) {
    if (categoria === 'anime') {
        const eps = item?.episodes ? `${item.episodes} ${catTr('card.unit.eps', 'eps')}` : '';
        const parts = [item?.type, eps, item?.status].filter(Boolean);
        return parts.join(' / ') || catTr('card.type.anime', 'Anime');
    }

    const typeLabel = String(item?.type || '').toLowerCase().includes('light')
        ? catTr('card.type.novela_ligera', 'Novela ligera')
        : (String(item?.type || '').toLowerCase() === 'novel'
            ? catTr('card.type.novela', 'Novela')
            : (item?.type || catTr('card.type.manga', 'Manga')));
    const volcap = item?.volumes
        ? `${item.volumes} ${catTr('card.unit.vol', 'vol.')}`
        : (item?.chapters ? `${item.chapters} ${catTr('card.unit.cap', 'cap.')}` : '');
    const parts = [typeLabel, volcap, item?.status].filter(Boolean);
    if (categoria === 'novelas') return parts.join(' / ') || catTr('card.type.novela', 'Novela');
    return parts.join(' / ') || catTr('card.type.manga', 'Manga');
}


function normalizeCatalogGenre(text) {
    return normalizeText(text).trim();
}


function getApiGenresList(item) {
    const genres = Array.isArray(item?.genres)
        ? item.genres.map((genre) => typeof genre === 'string' ? genre : genre?.name)
        : [];
    const themes = Array.isArray(item?.themes)
        ? item.themes.map((theme) => typeof theme === 'string' ? theme : theme?.name)
        : [];

    if (item?.type) {
        genres.push(item.type);
    }

    const seen = new Set();
    return [...genres, ...themes]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => {
            const norm = normalizeCatalogGenre(value);
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
        });
}





// Progreso de la card: la etiqueta (EP 3/12) va en el riel inferior de la
// portada y la línea de avance en el borde de abajo. La línea se posiciona
// contra .crail-media, así que puede vivir dentro de este mismo bloque
// [data-progress], que es el que states.js actualiza.
function buildCatalogProgressHtml(categoria, total, volCount, chCount) {
    var prefix, label;
    if (categoria === 'anime') {
        prefix = 'EP';
        label = catTr('card.label.capitulos', 'capítulos');
    } else if (volCount > 0) {
        prefix = 'VOL';
        label = catTr('card.label.volumenes', 'volúmenes');
    } else {
        prefix = 'CH';
        label = catTr('card.label.capitulos', 'capítulos');
    }
    const safeTotal = Number(total) > 0 ? Number(total) : 0;

    // Sin total conocido: "Progreso libre" hasta que se marque como visto.
    if (safeTotal === 0) {
        return `
        <div class="crail-progress" data-progress data-total="0" data-label="${label}" data-prefix="${prefix}">
            <span class="crail-progress-label card-back-no-progress-card">${escapeHtml(catTr('card.progreso_libre', 'Progreso libre'))}</span>
            <span class="crail-progress-label" data-viewed-footer style="display:none">${escapeHtml(catTr('card.pct_visto', '100% VISTO', { pct: 100 }))}</span>
        </div>`;
    }

    return `
        <div class="crail-progress" data-progress data-total="${safeTotal}" data-label="${label}" data-prefix="${prefix}">
            <span class="crail-progress-label" data-meta-text>${prefix} 0/${safeTotal}</span>
            <div class="crail-line" aria-hidden="true">
                <div class="card-back-progress-fill crail-line-fill" style="width:0%"></div>
            </div>
        </div>`;
}


// ─── In-memory progress index (built once per render, cleared on state change) ──
// Maps "userId|prefix" → Map<itemId, Set<episodeNums>>
var _progressIndex = null;
var _progressIndexUser = null;

function _buildProgressIndex(userId) {
    if (_progressIndex && _progressIndexUser === userId) return _progressIndex;
    // Scan UserStore once, partition by item type
    var index = { anime: new Map(), manga: new Map(), novelas: new Map() };
    try {
        var keys = UserStore.keys();
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (!k || !k.startsWith('u:' + userId + '|')) continue;
            if (!UserStore.getItem(k)) continue;

            // Anime episodes: u:{uid}|anime:{id}|s:{s}|ep:{ep}
            var aM = k.match(/\|anime:(\d+)\|s:\d+\|ep:(\d+)$/);
            if (aM) {
                var animeId = aM[1], ep = Number(aM[2]);
                if (!index.anime.has(animeId)) index.anime.set(animeId, new Set());
                index.anime.get(animeId).add(ep);
                continue;
            }
            // Manga chapters/vols: u:{uid}|manga:{id}|ch:{n} or |vol:{n}
            var mgM = k.match(/\|manga:(\d+)\|(?:ch|vol):(\d+)$/);
            if (mgM) {
                var mId = mgM[1], num = Number(mgM[2]);
                if (!index.manga.has(mId)) index.manga.set(mId, new Set());
                index.manga.get(mId).add(num);
                continue;
            }
            // Novels: u:{uid}|novela:{id}|vol:{n}
            var nvM = k.match(/\|novela:(\d+)\|vol:(\d+)$/);
            if (nvM) {
                var nvId = nvM[1], nvNum = Number(nvM[2]);
                if (!index.novelas.has(nvId)) index.novelas.set(nvId, new Set());
                index.novelas.get(nvId).add(nvNum);
            }
        }
    } catch (e) { console.warn('_buildProgressIndex failed:', e); }
    _progressIndex = index;
    _progressIndexUser = userId;
    return index;
}

// Invalidate index whenever a state changes
window._invalidateProgressIndex = function() { _progressIndex = null; };

function countAnimeEpisodesWatched(userId, animeId, totalEps) {
    if (!totalEps) return 0;
    var index = _buildProgressIndex(userId);
    var eps = index.anime.get(String(animeId));
    if (!eps) return 0;
    var count = 0;
    eps.forEach(function(ep) { if (ep <= totalEps) count++; });
    return count;
}


function resolveCatalogProgress(userId, category, itemId, card) {
    const box = card.querySelector('[data-progress]');
    const dataTotal = Number(box?.getAttribute('data-total') || 0);
    const label = box?.getAttribute('data-label') || (category === 'anime' ? catTr('card.label.capitulos', 'capítulos') : catTr('card.label.volumenes', 'volúmenes'));
    const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));

    if (!dataTotal) {
        const legacyPct = (typeof getProgressPercentForItem === 'function')
            ? getProgressPercentForItem(userId, category, itemId)
            : null;
        if (viewed) {
            return { show: true, pct: 100, watched: 0, total: 0, label };
        }
        if (legacyPct !== null) {
            return { show: true, pct: legacyPct, watched: 0, total: 0, label };
        }
        return { show: true, pct: 0, watched: 0, total: 0, label }; // Show alternative card
    }

    let watched = 0;
    if (category === 'anime') {
        watched = countAnimeEpisodesWatched(userId, itemId, dataTotal);
    } else if (category === 'manga' || category === 'novelas') {
        var index = _buildProgressIndex(userId);
        var items = index[category]?.get(String(itemId));
        if (items) {
            items.forEach(function(num) { if (num <= dataTotal) watched++; });
        }
    }

    const pct = viewed ? 100 : Math.min(100, Math.round((watched / dataTotal) * 100));
    if (viewed) watched = dataTotal;

    return { show: true, pct, watched, total: dataTotal, label };
}


window.toggleCardComplete = function (input, itemId) {
    const card = input?.closest('[data-item-id]');
    const viewedBtn = card?.querySelector('.viewed-btn');
    if (!viewedBtn) return;
    const isActive = viewedBtn.classList.contains('active');
    if (Boolean(input.checked) !== isActive) viewedBtn.click();
};


// Traduce el estado crudo de la API (AniList/MAL, en ingles) a una etiqueta
// corta en espanol para la banda superior de la card.
function translateCatalogStatus(status) {
    const s = String(status || '').trim().toUpperCase();
    const map = {
        'RELEASING': 'card.status.releasing',
        'CURRENTLY AIRING': 'card.status.releasing',
        'CURRENTLY PUBLISHING': 'card.status.publishing',
        'PUBLISHING': 'card.status.publishing',
        'FINISHED': 'card.status.finished',
        'FINISHED AIRING': 'card.status.finished',
        'COMPLETED': 'card.status.finished',
        'NOT_YET_RELEASED': 'card.status.upcoming',
        'NOT YET AIRED': 'card.status.upcoming',
        'CANCELLED': 'card.status.cancelled',
        'HIATUS': 'card.status.hiatus',
        'ON HIATUS': 'card.status.hiatus'
    };
    const fallbacks = {
        'card.status.releasing': 'En emisión',
        'card.status.publishing': 'Publicándose',
        'card.status.finished': 'Finalizado',
        'card.status.upcoming': 'Próximamente',
        'card.status.cancelled': 'Cancelado',
        'card.status.hiatus': 'En pausa'
    };
    const key = map[s];
    return key ? catTr(key, fallbacks[key]) : String(status || '').trim();
}

// Linea secundaria de la card (tipo · episodios), sin el estado: ese ya se
// muestra en la banda superior, asi no se repite.
function captionFromInfo(info, status) {
    if (!info) return '';
    const st = translateCatalogStatus(status).toLowerCase();
    const raw = String(status || '').trim().toLowerCase();
    return String(info)
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => {
            const low = s.toLowerCase();
            return low !== st && low !== raw;
        })
        .join(' · ');
}

// Tono del punto de estado (color por estado, además del texto).
function catalogStatusTone(status) {
    const s = String(status || '').trim().toUpperCase();
    if (/FINISHED|COMPLETED/.test(s)) return 'finished';
    if (/HIATUS/.test(s)) return 'hiatus';
    if (/CANCELLED/.test(s)) return 'cancelled';
    if (/NOT_YET|NOT YET|UPCOMING/.test(s)) return 'upcoming';
    return 'releasing';
}

function buildCatalogCardHtml(options) {
    const {
        id,
        title,
        image = '',
        detailUrl = '#',
        status = '',
        showDetail = true,
        searchIndex = '',
        genres = '',
        genresNorm = '',
        imageExtraAttrs = '',
        categoria = 'manga',
        progressTotal = 0,
        volCount = 0,
        chCount = 0,
        info = '',
        titleAlt = ''
    } = options;

    const safeId = escapeHtml(String(id));
    const bandLabel = translateCatalogStatus(status) || catTr('card.status.releasing', 'En emisión');
    const tone = catalogStatusTone(status);
    const captionInfo = captionFromInfo(info, status);
    // Página de volúmenes/episodios (volumenes.html): una lista donde cada
    // volumen ocupa una fila con su portada, capítulos y estado de lectura. Se
    // navega con todos los datos de la obra en la query string.
    const chaptersLabel = categoria === 'anime' ? catTr('card.btn.ver_episodios', 'Ver episodios') : catTr('card.btn.ver_vols', 'Ver volúmenes y capítulos');
    // Prefijo (EP/VOL/CH) coherente con buildCatalogProgressHtml, para que la
    // página muestre el mismo tipo de unidad que la card.
    const volsPrefix = categoria === 'anime' ? 'EP' : (volCount > 0 ? 'VOL' : 'CH');
    const volsUrl = 'volumenes.html?cat=' + encodeURIComponent(categoria)
        + '&id=' + encodeURIComponent(String(id))
        + '&nombre=' + encodeURIComponent(title)
        + '&img=' + encodeURIComponent(image || '')
        + '&total=' + encodeURIComponent(String(progressTotal || 0))
        + '&prefix=' + encodeURIComponent(volsPrefix)
        + '&estado=' + encodeURIComponent(status || '')
        + (captionInfo ? '&tipo=' + encodeURIComponent(captionInfo) : '')
        + (titleAlt ? '&alt=' + encodeURIComponent(String(titleAlt)) : '');
    const chaptersBtn = `<a class="card-back-chapters-btn crail-chapters" href="${escapeHtml(volsUrl)}" aria-label="${escapeHtml(chaptersLabel)}" title="${escapeHtml(chaptersLabel)}" data-remember-catalog="1">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </a>`;
    const titleHtml = showDetail
        ? `<a class="catalog-card-title crail-title" href="${escapeHtml(detailUrl)}" data-remember-catalog="1">${escapeHtml(title)}</a>`
        : `<span class="catalog-card-title crail-title">${escapeHtml(title)}</span>`;
    const captionHtml = captionInfo
        ? `<span class="cband-info crail-info">${escapeHtml(captionInfo)}</span>`
        : '';
    const genresAttr = genres ? ` data-genres="${escapeHtml(genres)}"` : '';
    const genresNormAttr = genresNorm ? ` data-genres-norm="${escapeHtml(genresNorm)}"` : '';
    const totalAttr = progressTotal > 0 ? ` data-total="${progressTotal}"` : '';
    // Título alternativo (inglés) para que la página de volúmenes pueda pasar
    // más de un nombre al emparejado de portadas contra MangaDex.
    const titleAltAttr = titleAlt ? ` data-title-alt="${escapeHtml(String(titleAlt))}"` : '';

    var safeImg = safeUrl(image);
    // Card "portada con riel": todo a la vista, sin giro. La portada lleva el
    // estado arriba a la izquierda, favorito y visto arriba a la derecha y un
    // riel abajo con el progreso y el seguimiento; debajo van el título (que
    // lleva al detalle), la línea de tipo/episodios y el botón de episodios o
    // volúmenes. Se conservan los hooks funcionales: .catalog-neon-card para
    // búsqueda y géneros, .fav-btn/.viewed-btn con data-action para la
    // delegación, .watch-status-select, el bloque [data-progress] que states.js
    // actualiza y .cband-status/.cband-info que lee chapters-modal.js.
    return `
    <div class="card-container catalog-neon-card catalog-rail-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}"${titleAltAttr} data-img="${escapeHtml(safeImg)}" data-search-index="${escapeHtml(searchIndex)}"${totalAttr}${genresAttr}${genresNormAttr}>
        <div class="crail-media">
            <img src="${safeImg}" alt="${escapeHtml(title)}" width="230" height="345" decoding="async" loading="lazy"${imageExtraAttrs}>
            <span class="crail-status" data-tone="${tone}"><span class="crail-dot" aria-hidden="true"></span><span class="cband-status">${escapeHtml(bandLabel)}</span></span>
            <div class="crail-quick">
                <button class="action-btn fav-btn" type="button" aria-label="${escapeHtml(catTr('card.aria.favorito', 'Favorito'))}" data-item-id="${safeId}" data-action="fav">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
                <button class="action-btn viewed-btn" type="button" aria-label="${escapeHtml(catTr('card.aria.visto', 'Visto'))}" data-item-id="${safeId}" data-action="viewed">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>
            <div class="crail-rail">
                ${buildCatalogProgressHtml(categoria, progressTotal, volCount, chCount)}
                <select class="watch-status-select crail-select" data-item-id="${safeId}" aria-label="${escapeHtml(catTr('card.aria.seguimiento', 'Estado de seguimiento'))}">
                    <option value="">${escapeHtml(catTr('card.seguimiento.placeholder', '— Seguimiento —'))}</option>
                    <option value="viendo">${escapeHtml(catTr('card.seguimiento.viendo', 'Viendo'))}</option>
                    <option value="pendiente">${escapeHtml(catTr('card.seguimiento.pendiente', 'Pendiente'))}</option>
                    <option value="pausado">${escapeHtml(catTr('card.seguimiento.pausado', 'En pausa'))}</option>
                    <option value="abandonado">${escapeHtml(catTr('card.seguimiento.abandonado', 'Abandonado'))}</option>
                </select>
            </div>
        </div>
        <div class="crail-text">
            ${titleHtml}
            ${chaptersBtn}
            ${captionHtml}
        </div>
    </div>`;
}


// Traduce el error crudo de la capa de API al cartel que ve el usuario.
// Antes todo caia en un unico "API no disponible / revisa tu conexion", que es
// enganoso: la causa mas comun es el rate limit de AniList, donde la conexion
// del usuario esta perfecta y lo unico que hay que hacer es esperar.
function describirErrorDeApi(error) {
    const msg = String(error?.message || error || '');

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
            kicker: catTr('card.err.sin_conexion.kicker', 'Sin conexión'),
            detalle: catTr('card.err.sin_conexion.detalle', 'Parece que te quedaste sin internet. Reconectate y recargá la página.')
        };
    }
    if (msg.includes('429') || msg.includes('Límite de peticiones')) {
        return {
            kicker: catTr('card.err.rate.kicker', 'Demasiadas peticiones'),
            detalle: catTr('card.err.rate.detalle', 'AniList está limitando las peticiones por exceso de uso. Esperá un minuto y recargá — no es un problema de tu conexión.')
        };
    }
    if (msg.includes('Timeout')) {
        return {
            kicker: catTr('card.err.timeout.kicker', 'La API tardó demasiado'),
            detalle: catTr('card.err.timeout.detalle', 'AniList no respondió a tiempo. Puede estar saturada; probá de nuevo en unos segundos.')
        };
    }
    return {
        kicker: catTr('card.err.generico.kicker', 'API no disponible'),
        detalle: catTr('card.err.generico.detalle', 'Revisá tu conexión, esperá unos segundos y recargá la página.')
    };
}

// Construye la entrada del índice de búsqueda local (filtrado en cliente y
// sugerencias) a partir de un item de la API.
function _catalogSearchEntry(categoria, item) {
    return {
        item: {
            id: item.id ?? item.mal_id,
            titulo: item.title,
            imagen: getApiPoster(item),
            info: getApiCatalogInfo(categoria, item)
        },
        searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
    };
}

// Pinta un conjunto de items como tarjetas del catálogo. Separado de
// cargarCatalogoDesdeApi para reutilizarlo desde el respaldo de búsqueda
// (cuando la carga principal falla o vuelve vacía).
function renderCatalogItems(categoria, mainContainer, items, append) {
    if (!append) {
        window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems =
            items.map((item) => _catalogSearchEntry(categoria, item));
    } else {
        const existing = window.__catalogSearchItems || [];
        const existingIds = new Set(existing.map(function (e) { return String(e.item.id); }));
        items.filter(function (item) { return !existingIds.has(String(item.id ?? item.mal_id)); })
            .forEach(function (item) { existing.push(_catalogSearchEntry(categoria, item)); });
    }

    var cardsHtml = items.map((item) => {
        const id = item.id ?? item.mal_id;
        const title = item.title || catTr('card.sin_titulo', 'Sin título');
        const image = getApiPoster(item);
        const info = getApiCatalogInfo(categoria, item);
        const genres = getApiGenresList(item);
        const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
        const detailCat = categoria === 'novelas' ? 'novelas' : categoria;
        const detailUrl = 'detalle.html?cat=' + encodeURIComponent(detailCat) + '&id=' + encodeURIComponent(id) + '&nombre=' + encodeURIComponent(title);
        const searchIndex = [title, item.title_english, info, item.synopsis, item.type].concat(genres).filter(Boolean).join(' ').toLowerCase();

        const volCount = categoria !== 'anime' ? (item.volumes || 0) : 0;
        const chCount = categoria !== 'anime' ? (item.chapters || 0) : 0;
        return buildCatalogCardHtml({
            id: id,
            title: title,
            image: image,
            detailUrl: detailUrl,
            status: item.status || 'RELEASING',
            searchIndex: searchIndex,
            genres: genres.join('|'),
            genresNorm: genresNorm,
            categoria: detailCat,
            info: info,
            titleAlt: item.title_english || '',
            progressTotal: categoria === 'anime' ? (item.episodes || 0) : (volCount || chCount || 0),
            volCount: volCount,
            chCount: chCount,
            imageExtraAttrs: ' data-title="' + escapeHtml(title) + '" data-fallback-catalog="1"'
        });
    }).join('');

    mainContainer.querySelector('.empty-state')?.remove();
    if (append) {
        mainContainer.insertAdjacentHTML('beforeend', cardsHtml);
    } else {
        mainContainer.innerHTML = cardsHtml;
    }

    try { cargarEstadosBotones(); } catch (e) { console.warn('Error en botones:', e); }
    if (!append) {
        try { inicializarBusquedaCatalogo(); } catch (e) { console.warn('Error en busqueda:', e); }
        try { inicializarGeneroWidgets(); } catch (e) { console.warn('Error en generos:', e); }
    } else if (typeof window.__renderDropdownGenres === 'function') {
        try { window.__renderDropdownGenres(); } catch (e) { console.warn('Error en generos dropdown:', e); }
    }
    return items.length > 0;
}

// Respaldo de búsqueda: usa la búsqueda liviana (menos peticiones y con caché
// propia) cuando la carga del catálogo falla o no trae resultados, para que una
// búsqueda válida no quede en "no se pudo cargar" por un rate limit puntual.
async function buscarCatalogoLiviano(categoria, search) {
    const q = String(search || '').trim();
    if (!q) return [];
    try {
        let alt = [];
        if (categoria === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
            alt = await window.buscarNovelasEnApi(q);
        } else if (typeof window.buscarEnApi === 'function') {
            alt = await window.buscarEnApi(q, categoria);
        }
        return Array.isArray(alt) ? alt : [];
    } catch (_) {
        return [];
    }
}

async function cargarCatalogoDesdeApi(categoria, mainContainer, page = 1, append = false) {
    const loaderLabel = categoria === 'anime'
        ? catTr('card.loader.animes', 'animes')
        : (categoria === 'novelas' ? catTr('card.loader.novelas', 'novelas') : catTr('card.loader.mangas', 'mangas'));
    const getTopItems = categoria === 'anime'
        ? window.getTopAnimes
        : (categoria === 'novelas' ? window.getTopNovelas : window.getTopMangas);

    if (typeof getTopItems !== 'function') return false;

    if (!append) {
        renderSkeletonCards(mainContainer, SKELETON_COUNT);
    }

    // Read global filter state
    const filters = window.__catalogFilters || {};
    const perPage = AnimeDestiny.Constants.PER_PAGE || 40;

    try {
        const timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('Timeout')); }, AnimeDestiny.Constants.API_TIMEOUT_MS || 15000);
        });
        const listaItems = await Promise.race([getTopItems(page, filters), timeoutPromise]);
        const items = Array.isArray(listaItems) ? listaItems.slice(0, perPage) : [];

        // Búsqueda sin resultados en la carga principal: reintentar con la
        // búsqueda liviana antes de declarar "sin resultados".
        if (!append && !items.length && filters.search) {
            const alt = await buscarCatalogoLiviano(categoria, filters.search);
            if (alt.length) return renderCatalogItems(categoria, mainContainer, alt.slice(0, perPage), false);
        }

        if (!items.length) {
            if (!append) {
                window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = [];
                mainContainer.innerHTML = `
                    <section class="empty-state">
                        <span class="empty-state-kicker">${escapeHtml(catTr('card.empty.kicker', 'Sin resultados'))}</span>
                        <h2>${escapeHtml(catTr('card.empty.titulo', 'La API no devolvió {tipo} para esta página.', { tipo: loaderLabel }))}</h2>
                        <p>${escapeHtml(catTr('card.empty.detalle', 'Posible límite de velocidad (rate limit). Esperá unos segundos y recargá.'))}</p>
                    </section>
                `;
                try { inicializarBusquedaCatalogo(); } catch (e) {}
                try { inicializarGeneroWidgets(); } catch (e) {}
            }
            return false;
        }

        return renderCatalogItems(categoria, mainContainer, items, append);
    } catch (error) {
        console.warn('Error cargando API:', error);
        // Respaldo: si la carga fall\u00F3 durante una b\u00FAsqueda, intentar la b\u00FAsqueda
        // liviana (puede resolver desde cach\u00E9 aunque la API est\u00E9 limitando).
        if (!append && filters.search) {
            const alt = await buscarCatalogoLiviano(categoria, filters.search);
            if (alt.length) return renderCatalogItems(categoria, mainContainer, alt.slice(0, perPage), false);
        }
        if (!append) {
            const causa = describirErrorDeApi(error);
            mainContainer.innerHTML = `
                <section class="empty-state">
                    <span class="empty-state-kicker">${escapeHtml(causa.kicker)}</span>
                    <h2>${escapeHtml(catTr('card.err.titulo', 'No se pudo cargar el catálogo de {tipo}.', { tipo: loaderLabel }))}</h2>
                    <p>${escapeHtml(causa.detalle)}</p>
                </section>
            `;
            try { inicializarBusquedaCatalogo(); } catch (e) {}
            try { inicializarGeneroWidgets(); } catch (e) {}
        }
        return false;
    }
}


function renderCatalogCardsFromLocalData(categoria, mainContainer, items, append) {
    var existingIds;
    if (append) {
        existingIds = new Set();
        document.querySelectorAll('.catalog-neon-card[data-item-id]').forEach(function (el) {
            existingIds.add(el.getAttribute('data-item-id'));
        });
    }

    var list = [];
    items.forEach(function (item) {
        var id = String(item.id || item.item_id || item.mal_id || item.itemId || 0);
        if (append && existingIds.has(id)) return;
        var title = item.titulo || item.title || item.name || catTr('card.sin_titulo', 'Sin t\u00EDtulo');
        var image = item.img || item.image || item.cover_image || '';
        var genres = String(item.info || item.synopsis || '').split('/').map(function (g) { return g.trim(); }).filter(Boolean);
        var genresNorm = genres.map(function (g) { return normalizeCatalogGenre(g); }).join('|');
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(categoria) + '&id=' + encodeURIComponent(id) + '&nombre=' + encodeURIComponent(title);
        var searchIndex = [title, item.title_english, item.info, item.synopsis].concat(genres).filter(Boolean).join(' ').toLowerCase();
        var volCount = Number(item.volumes || 0);
        var chCount = Number(item.chapters || 0);
        list.push(buildCatalogCardHtml({
            id: id,
            title: title,
            image: image,
            detailUrl: detailUrl,
            status: item.status || '',
            searchIndex: searchIndex,
            genres: genres.join('|'),
            genresNorm: genresNorm,
            categoria: categoria,
            info: item.info || genres.join(' / '),
            titleAlt: item.title_english || '',
            progressTotal: volCount || chCount || Number(item.episodes || 0),
            volCount: volCount,
            chCount: chCount,
            imageExtraAttrs: ' data-title="' + escapeHtml(title) + '" data-fallback-catalog="1"'
        }));
    });

    if (append) {
        mainContainer.insertAdjacentHTML('beforeend', list.join(''));
    } else {
        mainContainer.innerHTML = list.join('');
        window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = items.map(function (item) {
            var entry = { item: item, searchIndex: buildSearchIndexForItem(categoria, item) };
            if (!item.imagen) {
                item.imagen = item.img || item.image || item.cover_image || '';
            }
            return entry;
        });
    }

    try { cargarEstadosBotones(); } catch (e) { console.warn('Error en botones:', e); }
    if (!append) {
        try { inicializarBusquedaCatalogo(); } catch (e) { console.warn('Error en busqueda:', e); }
        try { inicializarGeneroWidgets(); } catch (e) { console.warn('Error en generos:', e); }
    } else if (typeof window.__renderDropdownGenres === 'function') {
        try { window.__renderDropdownGenres(); } catch (e) { console.warn('Error en generos dropdown:', e); }
    }
    return true;
}



