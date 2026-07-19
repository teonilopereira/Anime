// ==========================================
// catalog/cards.js
// Render de tarjetas, progreso y carga de catálogo desde API
// ==========================================

const CATALOG_FLIP_ICON_SVG = '<svg class="catalog-flip-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>';

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
        const parts = [item?.type, item?.episodes ? `${item.episodes} eps` : '', item?.status].filter(Boolean);
        return parts.join(' / ') || 'Anime';
    }

    const typeLabel = String(item?.type || '').toLowerCase().includes('light')
        ? 'Novela ligera'
        : (String(item?.type || '').toLowerCase() === 'novel' ? 'Novela' : (item?.type || 'Manga'));
    const volcap = item?.volumes ? `${item.volumes} vol.` : (item?.chapters ? `${item.chapters} cap.` : '');
    const parts = [typeLabel, volcap, item?.status].filter(Boolean);
    if (categoria === 'novelas') return parts.join(' / ') || 'Novela';
    return parts.join(' / ') || 'Manga';
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





function buildCatalogBackProgressHtml(categoria, total, volCount, chCount) {
    var prefix, label;
    if (categoria === 'anime') {
        prefix = 'EP';
        label = 'capítulos';
    } else if (volCount > 0) {
        prefix = 'VOL';
        label = 'volúmenes';
    } else {
        prefix = 'CH';
        label = 'capítulos';
    }
    const safeTotal = Number(total) > 0 ? Number(total) : 0;
    
    // Si no hay total, mostramos una interfaz alternativa simplificada
    if (safeTotal === 0) {
        return `
        <div class="card-back-progress-wrapper" data-progress data-total="0" data-label="${label}" data-prefix="${prefix}">
            <div class="card-back-progress-card card-back-no-progress-card">
                <span class="no-progress-text">Progreso libre</span>
                <span class="no-progress-subtext">Marcá como visto completo usando el botón 👁</span>
            </div>
            <div class="card-back-footer-status" style="display:none" data-viewed-footer>
                <div class="footer-line"></div>
                <span>100% VISTO</span>
                <div class="footer-line"></div>
            </div>
        </div>`;
    }

    return `
        <div class="card-back-progress-wrapper" data-progress data-total="${safeTotal}" data-label="${label}" data-prefix="${prefix}" style="display:none">
            <div class="card-back-progress-card">
                <div class="card-back-progress-head" data-meta-text>
                    ${prefix} 0/${safeTotal}
                </div>
                <div class="card-back-progress-row">
                    <div class="card-back-progress-track">
                        <div class="card-progress-fill card-back-progress-fill" style="width:0%"></div>
                    </div>
                    <div class="card-back-progress-pct" data-pct-only>0%</div>
                </div>
            </div>
            <div class="card-back-footer-status">
                <div class="footer-line"></div>
                <span data-pct-text>0% VISTO</span>
                <div class="footer-line"></div>
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
    const label = box?.getAttribute('data-label') || (category === 'anime' ? 'capítulos' : 'volúmenes');
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
        chCount = 0
    } = options;

    const flipId = `flip-${id}`;
    const safeId = escapeHtml(String(id));
    const detailBtn = showDetail
        ? `<a class="details-btn card-back-detail-btn" href="${escapeHtml(detailUrl)}" data-remember-catalog="1">DETALLE</a>`
        : '';
    const statusHtml = status
        ? `<span class="card-back-status-badge">${escapeHtml(status)}</span>`
        : '';
    const genresAttr = genres ? ` data-genres="${escapeHtml(genres)}"` : '';
    const genresNormAttr = genresNorm ? ` data-genres-norm="${escapeHtml(genresNorm)}"` : '';
    const totalAttr = progressTotal > 0 ? ` data-total="${progressTotal}"` : '';

    var safeImg = safeUrl(image);
    return `
    <div class="card-container catalog-neon-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}" data-img="${safeId}" data-search-index="${escapeHtml(searchIndex)}"${totalAttr}${genresAttr}${genresNormAttr}>
        <input class="flip-toggle" type="checkbox" id="${flipId}">
        <div class="catalog-card-shell">
            <div class="card-corner card-corner-tr"></div>
            <div class="card-corner card-corner-br"></div>
            <div class="catalog-card-inner">
                <div class="catalog-card-media">
                    <div class="catalog-card-poster card-inner">
                        <div class="card-front">
                            <img src="${safeImg}" alt="${escapeHtml(title)}" width="230" height="345" decoding="async" loading="lazy"${imageExtraAttrs}>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${escapeHtml(title)}</h2>
                            <div class="card-back-buttons-stack">
                                ${detailBtn}
                                ${statusHtml}
                            </div>
                            <select class="watch-status-select" data-item-id="${safeId}" aria-label="Estado de seguimiento">
                                <option value="">— Seguimiento —</option>
                                <option value="viendo">Viendo</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="pausado">En pausa</option>
                                <option value="abandonado">Abandonado</option>
                            </select>
                            <div class="card-back-actions">
                                <button class="action-btn fav-btn" type="button" aria-label="Favorito" data-item-id="${safeId}" data-action="fav">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                </button>
                                <button class="action-btn viewed-btn" type="button" aria-label="Visto" data-item-id="${safeId}" data-action="viewed">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </button>
                            </div>
                            ${buildCatalogBackProgressHtml(categoria, progressTotal, volCount, chCount)}
                        </div>
                    </div>
                </div>
                <div class="catalog-card-bar">
                    <span class="catalog-card-title">${escapeHtml(title)}</span>
                    <label class="catalog-card-flip-btn" for="${flipId}" aria-label="Ver información de ${escapeHtml(title)}" title="Ver info">
                        ${CATALOG_FLIP_ICON_SVG}
                    </label>
                </div>
            </div>
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
            kicker: 'Sin conexión',
            detalle: 'Parece que te quedaste sin internet. Reconectate y recargá la página.'
        };
    }
    if (msg.includes('429') || msg.includes('Límite de peticiones')) {
        return {
            kicker: 'Demasiadas peticiones',
            detalle: 'AniList está limitando las peticiones por exceso de uso. Esperá un minuto y recargá — no es un problema de tu conexión.'
        };
    }
    if (msg.includes('Timeout')) {
        return {
            kicker: 'La API tardó demasiado',
            detalle: 'AniList no respondió a tiempo. Puede estar saturada; probá de nuevo en unos segundos.'
        };
    }
    return {
        kicker: 'API no disponible',
        detalle: 'Revisá tu conexión, esperá unos segundos y recargá la página.'
    };
}

async function cargarCatalogoDesdeApi(categoria, mainContainer, page = 1, append = false) {
    const loaderLabel = categoria === 'anime'
        ? 'animes'
        : (categoria === 'novelas' ? 'novelas' : 'mangas');
    const getTopItems = categoria === 'anime'
        ? window.getTopAnimes
        : (categoria === 'novelas' ? window.getTopNovelas : window.getTopMangas);

    if (typeof getTopItems !== 'function') return false;

    if (!append) {
        renderSkeletonCards(mainContainer, SKELETON_COUNT);
    }

    // Read global filter state
    const filters = window.__catalogFilters || {};

    try {
        const timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('Timeout')); }, AnimeDestiny.Constants.API_TIMEOUT_MS || 15000);
        });
        const listaItems = await Promise.race([getTopItems(page, filters), timeoutPromise]);
        const items = Array.isArray(listaItems) ? listaItems.slice(0, AnimeDestiny.Constants.PER_PAGE || 40) : [];

        if (!append) {
            window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = items.map((item) => ({
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
            }));
        } else {
            const existing = window.__catalogSearchItems || [];
            const existingIds = new Set(existing.map(function (e) { return String(e.item.id); }));
            const newItems = items.filter(function (item) { return !existingIds.has(String(item.id ?? item.mal_id)); });
            newItems.forEach(function (item) {
                existing.push({
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
                });
            });
        }

        if (!items.length) {
            if (!append) {
                mainContainer.innerHTML = `
                    <section class="empty-state">
                        <span class="empty-state-kicker">Sin resultados</span>
                        <h2>La API no devolvió ${escapeHtml(loaderLabel)} para esta página.</h2>
                        <p>Posible límite de velocidad (rate limit). Esperá unos segundos y recargá.</p>
                    </section>
                `;
            }
            if (!append) { try { inicializarBusquedaCatalogo(); } catch (e) {} try { inicializarGeneroWidgets(); } catch (e) {} }
            return false;
        }

        var cardsHtml = items.map((item) => {
            const id = item.id ?? item.mal_id;
            const title = item.title || 'Sin t\u00EDtulo';
            const image = getApiPoster(item);
            const info = getApiCatalogInfo(categoria, item);
            const genres = getApiGenresList(item);
            const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
            const detailCat = categoria === 'novelas' ? 'novelas' : categoria;
            const detailUrl = 'detalle.html?cat=' + encodeURIComponent(detailCat) + '&id=' + encodeURIComponent(id);
            const searchIndex = [title, item.title_english, info, item.synopsis, item.type].concat(genres).filter(Boolean).join(' ').toLowerCase();

            const volCount = categoria !== 'anime' ? (item.volumes || 0) : 0;
            const chCount = categoria !== 'anime' ? (item.chapters || 0) : 0;
            return buildCatalogCardHtml({
                id: id,
                title: title,
                image: image,
                detailUrl: detailUrl,
                status: item.status || 'En emisi\u00F3n',
                searchIndex: searchIndex,
                genres: genres.join('|'),
                genresNorm: genresNorm,
                categoria: detailCat,
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
        } catch (error) {
        console.warn('Error cargando API:', error);
        if (!append) {
            const causa = describirErrorDeApi(error);
            mainContainer.innerHTML = `
                <section class="empty-state">
                    <span class="empty-state-kicker">${escapeHtml(causa.kicker)}</span>
                    <h2>No se pudo cargar el catálogo de ${escapeHtml(loaderLabel)}.</h2>
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
        var title = item.titulo || item.title || item.name || 'Sin t\u00EDtulo';
        var image = item.img || item.image || item.cover_image || '';
        var genres = String(item.info || item.synopsis || '').split('/').map(function (g) { return g.trim(); }).filter(Boolean);
        var genresNorm = genres.map(function (g) { return normalizeCatalogGenre(g); }).join('|');
        var detailUrl = 'detalle.html?cat=' + encodeURIComponent(categoria) + '&id=' + encodeURIComponent(id);
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



