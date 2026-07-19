

// Mostrar/ocultar "Continuar viendo" según haya contenido
const _continueSection = document.getElementById('continueWatching');
const _continueDivider = document.getElementById('continueWatchingDivider');
if (_continueSection && _continueDivider) {
    const _obs = new MutationObserver(function () {
        _continueDivider.style.display = _continueSection.children.length > 0 ? '' : 'none';
    });
    _obs.observe(_continueSection, { childList: true });
    _continueDivider.style.display = _continueSection.children.length > 0 ? '' : 'none';
}


/* ──────────────────────────────────────────────────────────────
   Carruseles de "Más populares" (solo en index.html)

   Reutiliza los helpers del bundle (getTopAnimes/Mangas/Novelas,
   buildCatalogCardHtml, getApiPoster...) para que las tarjetas sean
   idénticas a las del catálogo: mismo escapado, mismos botones de
   favorito/visto y mismo enlace a detalle.
────────────────────────────────────────────────────────────── */
(function () {
    const contenedor = document.getElementById('homeCarousels');
    if (!contenedor) return; // Este script tambien corre en otras paginas.

    const POR_CARRUSEL = 12;

    const CARRUSELES = [
        { cat: 'anime',   titulo: 'Anime',   icono: 'clapperboard', href: 'anime.html',   api: 'getTopAnimes' },
        { cat: 'manga',   titulo: 'Manga',   icono: 'book-open',    href: 'manga.html',   api: 'getTopMangas' },
        { cat: 'novelas', titulo: 'Novelas', icono: 'book',         href: 'novelas.html', api: 'getTopNovelas' }
    ];

    function esqueleto() {
        let html = '';
        for (let i = 0; i < 6; i++) {
            html += '<div class="home-carousel-skeleton"></div>';
        }
        return html;
    }

    function armarSeccion(cfg) {
        const sec = document.createElement('section');
        sec.className = 'home-carousel';
        sec.dataset.cat = cfg.cat;
        sec.innerHTML =
            '<header class="home-carousel-head">' +
                '<h2 class="home-carousel-title">' +
                    '<i data-lucide="' + cfg.icono + '"></i>' +
                    '<span>' + cfg.titulo + '</span>' +
                '</h2>' +
                '<a class="home-carousel-more" href="' + cfg.href + '">Ver todo</a>' +
            '</header>' +
            '<div class="home-carousel-viewport">' +
                '<button class="home-carousel-nav prev" type="button" aria-label="Anterior" hidden>&#8249;</button>' +
                '<div class="home-carousel-track">' + esqueleto() + '</div>' +
                '<button class="home-carousel-nav next" type="button" aria-label="Siguiente" hidden>&#8250;</button>' +
            '</div>';
        return sec;
    }

    function tarjetas(cfg, items) {
        return items.slice(0, POR_CARRUSEL).map(function (item) {
            const id = item.id != null ? item.id : item.mal_id;
            const title = item.title || 'Sin título';
            const genres = window.getApiGenresList ? window.getApiGenresList(item) : [];
            const volCount = cfg.cat !== 'anime' ? (item.volumes || 0) : 0;
            const chCount  = cfg.cat !== 'anime' ? (item.chapters || 0) : 0;

            return window.buildCatalogCardHtml({
                id: id,
                title: title,
                image: window.getApiPoster ? window.getApiPoster(item) : '',
                detailUrl: 'detalle.html?cat=' + encodeURIComponent(cfg.cat) + '&id=' + encodeURIComponent(id),
                status: item.status || '',
                genres: genres.join('|'),
                categoria: cfg.cat,
                progressTotal: cfg.cat === 'anime' ? (item.episodes || 0) : (volCount || chCount || 0),
                volCount: volCount,
                chCount: chCount,
                imageExtraAttrs: ' data-title="' + window.escapeHtml(title) + '" data-fallback-catalog="1"'
            });
        }).join('');
    }

    // Muestra las flechas solo si hay desborde, y las desactiva en los extremos.
    function sincronizarFlechas(viewport) {
        const track = viewport.querySelector('.home-carousel-track');
        const prev  = viewport.querySelector('.prev');
        const next  = viewport.querySelector('.next');
        const hayDesborde = track.scrollWidth > track.clientWidth + 4;
        prev.hidden = next.hidden = !hayDesborde;
        if (!hayDesborde) return;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }

    function conectarNavegacion(sec) {
        const viewport = sec.querySelector('.home-carousel-viewport');
        const track    = viewport.querySelector('.home-carousel-track');

        viewport.querySelectorAll('.home-carousel-nav').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const salto = Math.max(track.clientWidth * 0.8, 200);
                track.scrollBy({ left: btn.classList.contains('prev') ? -salto : salto, behavior: 'smooth' });
            });
        });

        // scroll y resize disparan decenas de veces por segundo, y
        // sincronizarFlechas lee scrollLeft/clientWidth/scrollWidth: cada
        // lectura obliga al navegador a recalcular el layout. Con rAF se
        // ejecuta como mucho una vez por frame, que es lo unico que se ve.
        let pendiente = false;
        function sincronizarEnElProximoFrame() {
            if (pendiente) return;
            pendiente = true;
            requestAnimationFrame(function () {
                pendiente = false;
                sincronizarFlechas(viewport);
            });
        }

        track.addEventListener('scroll', sincronizarEnElProximoFrame, { passive: true });
        window.addEventListener('resize', sincronizarEnElProximoFrame);
        sincronizarFlechas(viewport);
    }

    function vacio(mensaje) {
        return '<p class="home-carousel-empty">' + window.escapeHtml(mensaje) + '</p>';
    }

    async function cargar(cfg, sec) {
        const track = sec.querySelector('.home-carousel-track');
        const fn = window[cfg.api];
        if (typeof fn !== 'function') {
            track.innerHTML = vacio('No se pudo cargar el catálogo.');
            return;
        }
        try {
            const lista = await fn(1, {});
            const items = Array.isArray(lista) ? lista : [];
            if (!items.length) {
                track.innerHTML = vacio('Sin resultados por ahora.');
                return;
            }
            track.innerHTML = tarjetas(cfg, items);
            // Hidrata los botones de favorito/visto igual que en el catálogo.
            if (typeof window.cargarEstadosBotones === 'function') {
                try { window.cargarEstadosBotones(); } catch (e) { /* no romper el resto */ }
            }
            conectarNavegacion(sec);
        } catch (e) {
            console.warn('[inicio] Error cargando carrusel de ' + cfg.cat + ':', e);
            track.innerHTML = vacio('No se pudo cargar. Revisá tu conexión y recargá.');
        }
    }

    const secciones = CARRUSELES.map(function (cfg) {
        const sec = armarSeccion(cfg);
        contenedor.appendChild(sec);
        return { cfg: cfg, sec: sec };
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    // En serie, no en paralelo: tres consultas simultáneas a AniList/MangaDex
    // disparan el rate limit (HTTP 429) con facilidad.
    (async function () {
        for (const { cfg, sec } of secciones) {
            await cargar(cfg, sec);
        }
    })();
})();
