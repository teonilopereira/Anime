let currentPage = 1;
let isLoadingPage = false;
let hasMorePages = true;
let scrollObserver = null;

// Puerta de scroll: el sentinel queda dentro del viewport apenas termina el
// primer render (pantalla alta, pocos resultados, o zoom out), asi que el
// observer encadenaba paginas sin que el usuario tocara nada — hasta 6 en manga,
// que son 18 requests a AniList en segundos y el rate limit garantizado.
// Ahora la carga automatica no arranca hasta que haya un scroll real.
let usuarioScrolleo = false;
let sentinelALaVista = false;

function alScrollearPorPrimeraVez() {
    if (usuarioScrolleo) return;
    usuarioScrolleo = true;
    // El observer no vuelve a dispararse si el sentinel ya estaba visible (no
    // hay cambio de interseccion que notificar), asi que hay que reintentar.
    if (sentinelALaVista) loadNextPage();
}

function getSentinel() {
    let el = document.getElementById("scroll-sentinel");
    if (!el) {
        el = document.createElement("div");
        el.id = "scroll-sentinel";
        el.className = "scroll-sentinel";
        document.querySelector(".gallery")?.appendChild(el);
    }
    return el;
}

function hideLoadingIndicator() {
    const sentinel = getSentinel();
    sentinel.innerHTML = "";
}

function showNoMoreMessage() {
    const sentinel = getSentinel();
    sentinel.innerHTML = '<div class="scroll-end">No hay m\u00E1s resultados</div>';
}

async function loadNextPage() {
    if (isLoadingPage || !hasMorePages) return;
    isLoadingPage = true;

    const categoria = document.body.getAttribute("data-page");
    const mainContainer = document.getElementById("main-content");
    if (!mainContainer) { isLoadingPage = false; return; }

    // Tope de nodos: evita acumular miles de cards en el DOM al scrollear.
    const MAX_RENDERED = AnimeDestiny.Constants.MAX_RENDERED_CARDS || 240;
    if (document.querySelectorAll(".catalog-neon-card").length >= MAX_RENDERED) {
        hasMorePages = false;
        const sentinel = getSentinel();
        sentinel.innerHTML = '<div class="scroll-end">Usá la búsqueda o los filtros para acotar los resultados.</div>';
        isLoadingPage = false;
        return;
    }

    var skelWrapper;
    if (typeof renderSkeletonCards === "function") {
        skelWrapper = document.createElement("div");
        skelWrapper.className = "skeleton-batch";
        renderSkeletonCards(skelWrapper, AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20);
        mainContainer.appendChild(skelWrapper);
    }

    const usaCatalogoApi = categoria === "anime" || categoria === "manga" || categoria === "novelas";

    if (usaCatalogoApi) {
        currentPage++;
        // cargarCatalogoDesdeApi reads window.__catalogFilters internally
        const ok = await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage, true);
        if (skelWrapper) skelWrapper.remove();
        if (!ok || currentPage >= (AnimeDestiny.Constants.MAX_PAGES || 250)) {
            hasMorePages = false;
            showNoMoreMessage();
        }
        if (ok && document.querySelectorAll(".catalog-neon-card").length < (AnimeDestiny.Constants.PER_PAGE || 40)) {
            hasMorePages = false;
            showNoMoreMessage();
        }
    } else {
        const listaItems = (typeof obtenerItemsCategoria === "function")
            ? obtenerItemsCategoria(categoria)
            : [];
        const perPage = AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20;
        const totalLoaded = document.querySelectorAll(".catalog-neon-card").length;
        if (totalLoaded >= listaItems.length) {
            hasMorePages = false;
            showNoMoreMessage();
            isLoadingPage = false;
            if (skelWrapper) skelWrapper.remove();
            return;
        }
        currentPage++;
        const nextBatch = listaItems.slice(0, totalLoaded + perPage);
        renderCatalogCardsFromLocalData(categoria, mainContainer, nextBatch, true);
        if (skelWrapper) skelWrapper.remove();
        if (nextBatch.length >= listaItems.length) {
            hasMorePages = false;
            showNoMoreMessage();
        }
    }

    isLoadingPage = false;
}

function initScrollObserver() {
    disconnectScrollObserver();
    const sentinel = getSentinel();
    scrollObserver = new IntersectionObserver(function (entries) {
        sentinelALaVista = entries[0].isIntersecting;
        if (sentinelALaVista && usuarioScrolleo) {
            loadNextPage();
        }
    }, { rootMargin: "200px" });
    scrollObserver.observe(sentinel);
}

function disconnectScrollObserver() {
    if (scrollObserver) {
        scrollObserver.disconnect();
        scrollObserver = null;
    }
}

function resetInfiniteScroll() {
    currentPage = 1;
    hasMorePages = true;
    isLoadingPage = false;
    hideLoadingIndicator();
    const sentinel = getSentinel();
    sentinel.innerHTML = "";
    // Se rearma en cada reset (carga inicial y cambio de filtros): un catalogo
    // recien renderizado no debe encadenar paginas solo porque el usuario ya
    // habia scrolleado antes de buscar.
    usuarioScrolleo = false;
    sentinelALaVista = false;
    window.addEventListener("scroll", alScrollearPorPrimeraVez, { passive: true, once: true });
    initScrollObserver();
}

async function inicializarPagina() {
    const mainContainer = document.getElementById("main-content");
    if (!mainContainer) return;
    const categoria = document.body.getAttribute("data-page");
    // Páginas que NO son catálogo: no deben ser sobreescritas por el catálogo.
    if (["listas", "top", "comparar", "detalle", "index", "usuario", "configuracion", "login"].indexOf(categoria) !== -1) return;
    currentPage = 1;
    const usaCatalogoApi = categoria === "anime" || categoria === "manga" || categoria === "novelas";

    if (usaCatalogoApi) {
        await cargarCatalogoDesdeApi(categoria, mainContainer, currentPage);
        resetInfiniteScroll();
        return;
    }

    const listaItems = (typeof obtenerItemsCategoria === "function")
        ? obtenerItemsCategoria(categoria)
        : [];
    window.__catalogSearchItems = AnimeDestiny.internals.__catalogSearchItems = listaItems.map(function (item) {
        return { item: item, searchIndex: buildSearchIndexForItem(categoria, item) };
    });

    if (listaItems.length === 0) {
        mainContainer.innerHTML = '<section class="empty-state"><span class="empty-state-kicker">Cat\u00E1logo en preparaci\u00F3n</span><h2>Pr\u00F3ximamente m\u00E1s contenido.</h2><p>Cuando cargues nuevos t\u00EDtulos, van a aparecer ac\u00E1.</p></section>';
        return;
    }

    function getGenres(item) {
        return String(item?.info || "").split("/").map(function (s) { return s.trim(); }).filter(Boolean);
    }

    const perPage = AnimeDestiny.Constants.LOCAL_PAGE_SIZE || 20;
    const batch = listaItems.slice(0, perPage);

    mainContainer.innerHTML = batch.map(function (item) {
        const genres = getGenres(item);
        const genresNorm = genres.map(function (g) { return normalizeText(g); }).join("|");
        const searchIndex = buildSearchIndexForItem(categoria, item);
        const detailUrl = "detalle.html?cat=" + encodeURIComponent(categoria) + "&id=" + encodeURIComponent(item.id) + "&nombre=" + encodeURIComponent(item.titulo);
        // Aca habia dos llamadas mas a `obtenerDetalleItem` (dos requests por
        // item) con el mismo defecto que las de states.js: devuelve una Promise,
        // asi que `hasDetail` daba siempre true y `detalle?.temporadas` /
        // `detalle?.volumenes` siempre undefined. El progressTotal ya sale de los
        // campos del propio item, que es de donde salia en los hechos.
        const hasDetail = true;
        var volCount = Number(item.volumenes || item.volumes || 0);
        var chCount = Number(item.capitulos || item.chapters || 0);
        return buildCatalogCardHtml({
            id: item.id,
            title: item.titulo,
            image: item.img,
            detailUrl: detailUrl,
            status: item.status || "",
            showDetail: hasDetail,
            searchIndex: searchIndex,
            genres: genres.join("|"),
            genresNorm: genresNorm,
            categoria: categoria,
            progressTotal: volCount || chCount || 0,
            volCount: volCount,
            chCount: chCount,
            imageExtraAttrs: ' data-title="' + escapeHtml(item.titulo) + '" data-fallback-catalog="1"'
        });
    }).join("");

    try { cargarEstadosBotones(); } catch (e) { console.warn('Error en botones:', e); }
    try { inicializarBusquedaCatalogo(); } catch (e) { console.warn('Error en busqueda:', e); }
    try { inicializarGeneroWidgets(); } catch (e) { console.warn('Error en generos:', e); }
    resetInfiniteScroll();
}

document.addEventListener("DOMContentLoaded", inicializarPagina);

function rememberCatalogPosition() {
    try {
        sessionStorage.setItem("lastCatalogUrl", window.location.href);
        sessionStorage.setItem("lastCatalogScrollY", String(window.scrollY || 0));
    } catch (e) {}
}

function restoreCatalogPosition() {
    try {
        var url = sessionStorage.getItem("lastCatalogUrl");
        var y = Number(sessionStorage.getItem("lastCatalogScrollY") || "0");
        var shouldRestore = sessionStorage.getItem("shouldRestoreCatalog") === "1";
        if (!shouldRestore) return;
        if (url && url === window.location.href) {
            sessionStorage.removeItem("shouldRestoreCatalog");
            window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: "instant" });
        }
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", restoreCatalogPosition);

window.addEventListener("supabase-auth-changed", function () {
    cargarEstadosBotones();
});


