// ==========================================
// catalog/cards.js
// Render de tarjetas, progreso y carga de catálogo desde API
// ==========================================

function getApiPoster(item) {
    return item?.images?.webp?.large_image_url
        || item?.images?.jpg?.large_image_url
        || item?.images?.jpg?.image_url
        || item?.images?.webp?.image_url
        || '';
}


window.changePage = async function(delta) {
    const mainContainer = document.getElementById("main-container");
    const categoria = document.body.getAttribute("data-page");
    
    // Si no estamos en anime o manga, no hacemos nada
    if (!mainContainer || (categoria !== 'anime' && categoria !== 'manga' && categoria !== 'novelas')) return;

    // Sumamos o restamos, asegurando que nunca baje de la página 1
    currentPage = Math.max(1, currentPage + delta);
    
    // Actualizamos el numerito en el HTML
    const pageNum = document.getElementById('page-num');
    if (pageNum) pageNum.innerText = currentPage;

    // Volvemos a pedir los datos a la API con la página nueva
    await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage);
};


function getApiCatalogInfo(categoria, item) {
    if (categoria === 'anime') {
        const parts = [item?.type, item?.episodes ? `${item.episodes} eps` : '', item?.status].filter(Boolean);
        return parts.join(' / ') || 'Anime';
    }

    const typeLabel = String(item?.type || '').toLowerCase().includes('light')
        ? 'Novela ligera'
        : (String(item?.type || '').toLowerCase() === 'novel' ? 'Novela' : (item?.type || 'Manga'));
    const parts = [typeLabel, item?.volumes ? `${item.volumes} vol.` : '', item?.status].filter(Boolean);
    if (categoria === 'novelas') return parts.join(' / ') || 'Novela';
    return parts.join(' / ') || 'Manga';
}


function normalizeCatalogGenre(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();
}


function getApiGenresList(item) {
    const genres = Array.isArray(item?.genres)
        ? item.genres.map((genre) => typeof genre === 'string' ? genre : genre?.name)
        : [];
    const themes = Array.isArray(item?.themes)
        ? item.themes.map((theme) => typeof theme === 'string' ? theme : theme?.name)
        : [];

    return [...genres, ...themes]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.findIndex((x) => normalizeCatalogGenre(x) === normalizeCatalogGenre(value)) === index);
}





function getCatalogProgressPrefix(categoria) {
    if (categoria === 'anime') return 'EP';
    if (categoria === 'manga' || categoria === 'novelas') return 'VOL';
    return 'VOL';
}


function buildCatalogBackProgressHtml(categoria, total) {
    const prefix = getCatalogProgressPrefix(categoria);
    const safeTotal = Number(total) > 0 ? Number(total) : 0;
    return `
        <div class="card-back-progress-box" data-progress data-total="${safeTotal}" data-prefix="${prefix}" style="display:none">
            <div class="card-back-progress-top" data-progress-label>${prefix} 0/${safeTotal}</div>
            <div class="card-back-progress-row">
                <div class="card-back-progress-track">
                    <div class="card-progress-fill card-back-progress-fill" style="width:0%"></div>
                </div>
                <span class="card-back-progress-pct" data-progress-pct>0%</span>
            </div>
        </div>
        <div class="card-back-completion" data-completion-footer style="display:none">
            <span class="card-back-hud-line" aria-hidden="true"></span>
            <span class="card-back-completion-text" data-completion-text>0% VISTO</span>
            <span class="card-back-hud-line" aria-hidden="true"></span>
        </div>`;
}


function countAnimeEpisodesWatched(userId, animeId, totalEps) {
    if (!totalEps) return 0;
    let watched = 0;
    for (let ep = 1; ep <= totalEps; ep++) {
        let found = false;
        for (let i = 0; i < UserStore.length; i++) {
            const key = UserStore.key(i) || '';
            if (!key.startsWith(`u:${userId}|anime:${animeId}|s:`) || !UserStore.getItem(key)) continue;
            const m = key.match(/ep:(\d+)$/);
            if (m && Number(m[1]) === ep) {
                found = true;
                break;
            }
        }
        if (found) watched += 1;
    }
    return watched;
}


function resolveCatalogProgress(userId, category, itemId, card) {
    const box = card.querySelector('[data-progress]');
    const dataTotal = Number(box?.getAttribute('data-total') || 0);
    const prefix = box?.getAttribute('data-prefix') || getCatalogProgressPrefix(category);

    if (!dataTotal) {
        const legacyPct = getProgressPercentForItem(userId, category, itemId);
        if (legacyPct === null) return { show: false };
        return {
            show: true,
            pct: legacyPct,
            watched: 0,
            total: 0,
            prefix,
            completionText: `${legacyPct}% VISTO`
        };
    }

    const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
    let watched = 0;
    if (category === 'anime') {
        watched = countAnimeEpisodesWatched(userId, itemId, dataTotal);
    } else if (category === 'manga' || category === 'novelas') {
        for (let n = 1; n <= dataTotal; n++) {
            if (UserStore.getItem(`u:${userId}|manga:${itemId}|ch:${n}`) ||
                UserStore.getItem(`u:${userId}|manga:${itemId}|vol:${n}`)) {
                watched += 1;
            }
        }
    }

    const pct = viewed ? 100 : Math.min(100, Math.round((watched / dataTotal) * 100));
    if (viewed) watched = dataTotal;

    return {
        show: true,
        pct,
        watched,
        total: dataTotal,
        prefix,
        completionText: `${pct}% VISTO`
    };
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
        progressTotal = 0
    } = options;

    const flipId = `flip-${id}`;
    const safeId = escapeHtml(String(id));
    const detailBtn = showDetail
        ? `<a class="details-btn card-back-detail-btn" href="${escapeHtml(detailUrl)}" onclick="rememberCatalogPosition()">DETALLE</a>`
        : '';
    const statusHtml = status
        ? `<span class="card-back-status-badge">${escapeHtml(status)}</span>`
        : '';
    const genresAttr = genres ? ` data-genres="${escapeHtml(genres)}"` : '';
    const genresNormAttr = genresNorm ? ` data-genres-norm="${escapeHtml(genresNorm)}"` : '';

    return `
    <div class="card-container catalog-neon-card" data-item-id="${safeId}" data-category="${escapeHtml(categoria)}" data-title="${escapeHtml(title)}" data-img="${escapeHtml(image)}" data-search-index="${escapeHtml(searchIndex)}"${genresAttr}${genresNormAttr}>
        <input class="flip-toggle" type="checkbox" id="${flipId}">
        <div class="catalog-card-shell">
            <div class="catalog-card-inner">
                <div class="catalog-card-media">
                    <div class="card-inner">
                        <div class="card-front">
                            <div class="catalog-card-poster">
                                <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy"${imageExtraAttrs}>
                            </div>
                        </div>
                        <div class="card-back card-back-neon">
                            <h2 class="card-back-title">${escapeHtml(title)}</h2>
                            ${detailBtn}
                            ${statusHtml}
                            <label class="card-back-complete">
                                <input class="card-complete-input" type="checkbox" onchange="toggleCardComplete(this, '${safeId}')">
                                <span class="card-back-toggle-switch" aria-hidden="true"></span>
                                <span class="card-back-toggle-label">Completado</span>
                            </label>
                            <div class="card-back-actions">
                                <button class="action-btn fav-btn" type="button" aria-label="Favorito" onclick="toggleStatus(this, 'fav', '${safeId}')">❤</button>
                                <button class="action-btn viewed-btn" type="button" aria-label="Visto" onclick="toggleStatus(this, 'viewed', '${safeId}')">👁</button>
                            </div>
                            ${buildCatalogBackProgressHtml(categoria, progressTotal)}
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


async function cargarCatalogoDesdeApi(categoria, mainContainer, page = 1) {
    const loaderLabel = categoria === 'anime'
        ? 'animes'
        : (categoria === 'novelas' ? 'novelas' : 'mangas');
    const getTopItems = categoria === 'anime'
        ? window.getTopAnimes
        : (categoria === 'novelas' ? window.getTopNovelas : window.getTopMangas);

    if (typeof getTopItems !== 'function') return false;

    mainContainer.innerHTML = `
        <section class="empty-state empty-state-inline">
            <span class="empty-state-kicker">Cargando Página ${page}</span>
            <h2>Buscando los 40 ${escapeHtml(loaderLabel)} principales...</h2>
        </section>
    `;

    try {
        // AQUÍ le pasamos el número de página a tu api.js
        const listaItems = await getTopItems(page);
        const items = Array.isArray(listaItems) ? listaItems.slice(0, 40) : [];

        if (!items.length) {
            const fallbackItems = Array.isArray(window.DATOS_WEB?.[categoria])
                ? window.DATOS_WEB[categoria].slice(0, 40)
                : [];

            if (fallbackItems.length) {
                return renderCatalogCardsFromLocalData(categoria, mainContainer, fallbackItems);
            }
        }

        window.__catalogSearchItems = items.map((item) => ({
            item: {
                id: item.mal_id,
                titulo: item.title,
                info: getApiCatalogInfo(categoria, item)
            },
            searchIndex: [item.title, item.title_english, item.type, item.status, item.synopsis]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
        }));

        if (!items.length) {
            mainContainer.innerHTML = `
                <section class="empty-state">
                    <span class="empty-state-kicker">Sin resultados</span>
                    <h2>La API no devolvio ${escapeHtml(loaderLabel)} para esta pagina.</h2>
                    <p>Proba con otra pagina o usa el buscador.</p>
                </section>
            `;
            return false;
        }

        mainContainer.innerHTML = items.map((item) => {
            const id = item.mal_id;
            const title = item.title || 'Sin título';
            const image = getApiPoster(item);
            const info = getApiCatalogInfo(categoria, item);
            const genres = getApiGenresList(item);
            const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
            const detailCat = categoria === 'novelas' ? 'novelas' : categoria;
            const detailUrl = `detalle.html?cat=${encodeURIComponent(detailCat)}&id=${encodeURIComponent(id)}`;
            const searchIndex = [title, item.title_english, info, item.synopsis, item.type, ...genres].filter(Boolean).join(' ').toLowerCase();

            return buildCatalogCardHtml({
                id,
                title,
                image,
                detailUrl,
                status: item.status || 'En emisión',
                searchIndex,
                genres: genres.join('|'),
                genresNorm,
                categoria: detailCat,
                progressTotal: categoria === 'anime' ? (item.episodes || 0) : (item.volumes || item.chapters || 0),
                imageExtraAttrs: ` data-title="${escapeHtml(title)}" onerror="fallbackCatalogImage(this)"`
            });
        }).join('');

        cargarEstadosBotones();
        inicializarBusquedaCatalogo();
        inicializarGeneroWidgets();
        return true;
    } catch (error) {
        console.warn('Error cargando API:', error);
        mainContainer.innerHTML = `
            <section class="empty-state">
                <span class="empty-state-kicker">API no disponible</span>
                <h2>No se pudo cargar el catalogo de ${escapeHtml(loaderLabel)}.</h2>
                <p>Revisa tu conexion y recarga la pagina.</p>
            </section>
        `;
        return false;
    }
}


function renderCatalogCardsFromLocalData(categoria, mainContainer, items) {
    const list = items.map((item) => {
        const id = item.id || item.item_id || item.mal_id || item.itemId || 0;
        const title = item.titulo || item.title || item.name || 'Sin título';
        const image = item.img || item.image || item.cover_image || '';
        const genres = String(item.info || item.synopsis || '').split('/').map((genre) => genre.trim()).filter(Boolean);
        const genresNorm = genres.map((genre) => normalizeCatalogGenre(genre)).join('|');
        const detailUrl = `detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(id)}`;
        const searchIndex = [title, item.title_english, item.info, item.synopsis, ...genres]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return buildCatalogCardHtml({
            id,
            title,
            image,
            detailUrl,
            status: item.status || '',
            searchIndex,
            genres: genres.join('|'),
            genresNorm,
            categoria,
            progressTotal: Number(item.volumes || item.chapters || item.episodes || 0),
            imageExtraAttrs: ` data-title="${escapeHtml(title)}" onerror="fallbackCatalogImage(this)"`
        });
    });

    mainContainer.innerHTML = list.join('');
    window.__catalogSearchItems = items.map((item) => ({
        item,
        searchIndex: buildSearchIndexForItem(categoria, item)
    }));

    cargarEstadosBotones();
    inicializarBusquedaCatalogo();
    inicializarGeneroWidgets();
    return true;
}

