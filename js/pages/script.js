// El escenario "Seguí donde lo dejaste" y las recomendaciones de la portada se
// arman en js/pages/inicio.js (necesitan datos de Supabase). Aquí solo queda la
// tira pública de "Más populares".


/* ──────────────────────────────────────────────────────────────
   Tira de "Más populares" (solo en index.html)

   Una sola tira con pestañas Anime / Manga / Novelas: el puesto 1 va grande y
   los siguientes como pósters angostos. Cada categoría se pide recién cuando
   se elige su pestaña y queda en memoria, así cambiar de pestaña no vuelve a
   llamar a la API (AniList/MangaDex limitan con HTTP 429).
────────────────────────────────────────────────────────────── */
(function () {
    const tira = document.getElementById('homeTopStrip');
    if (!tira) return; // Este script tambien corre en otras paginas.

    const POR_TIRA = 7;

    const CATEGORIAS = {
        anime:   { href: 'anime.html',   api: 'getTopAnimes',  verTodo: 'Ver todo el anime' },
        manga:   { href: 'manga.html',   api: 'getTopMangas',  verTodo: 'Ver todo el manga' },
        novelas: { href: 'novelas.html', api: 'getTopNovelas', verTodo: 'Ver todas las novelas' }
    };

    const tabs = Array.from(document.querySelectorAll('.home-top-tab'));
    const verTodo = document.getElementById('homeTopMore');
    const cache = {};
    let actual = 'anime';

    function esc(s) {
        return window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
    }

    function esqueleto() {
        let html = '<li class="home-top-item is-feature"><span class="home-top-slat home-carousel-skeleton"></span></li>';
        for (let i = 1; i < POR_TIRA; i++) {
            html += '<li class="home-top-item"><span class="home-top-slat home-carousel-skeleton"></span></li>';
        }
        return html;
    }

    function detalle(cat, item) {
        if (cat === 'anime') {
            return item.episodes ? item.episodes + ' episodios' : '';
        }
        if (item.volumes) return item.volumes + ' volúmenes';
        if (item.chapters) return item.chapters + ' capítulos';
        return '';
    }

    function itemHtml(cat, item, i) {
        const id = item.id != null ? item.id : item.mal_id;
        const title = item.title || 'Sin título';
        const img = window.getApiPoster ? window.getApiPoster(item) : '';
        const href = 'detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(id);
        const media = img
            ? '<img class="home-top-img" src="' + esc(img) + '" alt="" loading="' + (i < 3 ? 'eager' : 'lazy') + '">'
            : '';
        const extra = i === 0 ? detalle(cat, item) : '';

        return '<li class="home-top-item' + (i === 0 ? ' is-feature' : '') + '">' +
                    '<a class="home-top-slat" href="' + esc(href) + '">' +
                        media +
                        '<span class="home-top-copy">' +
                            '<span class="home-top-rank"><span class="home-sr">Puesto </span>' + (i + 1) + '</span>' +
                            '<span class="home-top-title">' + esc(title) + '</span>' +
                            (extra ? '<span class="home-top-meta">' + esc(extra) + '</span>' : '') +
                        '</span>' +
                    '</a>' +
                '</li>';
    }

    function vacio(mensaje) {
        return '<li class="home-top-empty">' + esc(mensaje) + '</li>';
    }

    // Una portada que no carga se saca: el póster queda con su color de fondo
    // y el título encima, en vez del ícono de imagen rota.
    function quitarSiFalla(img) {
        img.addEventListener('error', function () { img.remove(); }, { once: true });
    }

    function pintar(cat, html) {
        if (cat !== actual) return; // el usuario ya cambió de pestaña
        tira.innerHTML = html;
        tira.querySelectorAll('img').forEach(quitarSiFalla);
        tira.setAttribute('aria-busy', 'false');
        tira.scrollLeft = 0;
    }

    async function cargar(cat) {
        if (cache[cat]) { pintar(cat, cache[cat]); return; }
        tira.setAttribute('aria-busy', 'true');
        tira.innerHTML = esqueleto();

        const fn = window[CATEGORIAS[cat].api];
        if (typeof fn !== 'function') {
            pintar(cat, vacio('No se pudo cargar el catálogo.'));
            return;
        }
        try {
            const lista = await fn(1, {});
            const items = (Array.isArray(lista) ? lista : []).slice(0, POR_TIRA);
            if (!items.length) {
                pintar(cat, vacio('Sin resultados por ahora.'));
                return;
            }
            cache[cat] = items.map(function (item, i) { return itemHtml(cat, item, i); }).join('');
            pintar(cat, cache[cat]);
        } catch (e) {
            console.warn('[inicio] Error cargando populares de ' + cat + ':', e);
            pintar(cat, vacio('No se pudo cargar. Revisá tu conexión y recargá.'));
        }
    }

    function elegir(cat) {
        if (!CATEGORIAS[cat]) return;
        actual = cat;
        tabs.forEach(function (t) { t.classList.toggle('is-active', t.dataset.cat === cat); });
        if (verTodo) {
            verTodo.href = CATEGORIAS[cat].href;
            verTodo.textContent = CATEGORIAS[cat].verTodo;
        }
        cargar(cat);
    }

    tabs.forEach(function (t) {
        t.addEventListener('click', function () { elegir(t.dataset.cat); });
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    elegir('anime');
})();
