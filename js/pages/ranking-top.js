/**
 * ranking-top.js — Ranking de titulos (ranking.html).
 *
 * Tres rankings separados (anime / manga / novelas), uno por pestaña, todos
 * ordenados por puntuacion de la comunidad. No confundir con ranking.js, que
 * es el ranking de JUGADORES de top.html.
 *
 * Los datos salen de los mismos helpers del catalogo (getTopAnimes/Mangas/
 * Novelas con browse:'puntuados'), asi que comparten cache: entrar al ranking
 * despues del catalogo no gasta cuota extra de AniList.
 */
(function () {
    "use strict";

    var lista = document.getElementById("rankingLista");
    if (!lista) return;

    var tabsEl = document.querySelector(".trk-tabs");
    var escapeHtml = window.escapeHtml || function (s) { return s == null ? "" : String(s); };

    var CATEGORIAS = {
        anime:   { api: "getTopAnimes",  label: "Anime" },
        manga:   { api: "getTopMangas",  label: "Manga" },
        novelas: { api: "getTopNovelas", label: "Novelas" }
    };

    // Un estado por pestaña: al volver a una ya cargada se re-renderiza de
    // memoria, sin pedirle nada a la API.
    var estados = {};
    Object.keys(CATEGORIAS).forEach(function (cat) {
        estados[cat] = { items: [], ids: new Set(), pagina: 0, hayMas: true, cargando: false, error: false };
    });

    var catActual = "anime";

    function refrescarIconos() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            try { window.lucide.createIcons(); } catch (_) { /* no bloquear el render */ }
        }
    }

    // Podio: corona para el 1 y medalla para 2 y 3, igual que el ranking de
    // jugadores. Del 4 en adelante, el numero pelado.
    function posHtml(pos) {
        var icono = pos === 1 ? "crown" : (pos === 2 || pos === 3 ? "medal" : "");
        return '<div class="trk-pos trk-pos--' + (pos <= 3 ? pos : "n") + '">' +
            (icono ? '<i data-lucide="' + icono + '"></i>' : "") +
            "<span>" + pos + "</span>" +
        "</div>";
    }

    function metaHtml(cat, item) {
        var partes = [];
        if (item.type) partes.push(item.type);
        if (item.startYear) partes.push(item.startYear);
        var cantidad = cat === "anime" ? item.episodes : (item.chapters || item.volumes);
        // Singular para las peliculas y los one-shots: "1 eps" quedaba feo.
        if (cantidad) {
            var unidad = cat === "anime" ? "ep" : "cap";
            partes.push(cantidad + " " + unidad + (cantidad === 1 ? "" : "s"));
        }
        return partes.map(function (p) { return escapeHtml(String(p)); }).join(" · ");
    }

    function generosHtml(item) {
        var generos = (item.genres || []).map(function (g) { return g && g.name; }).filter(Boolean).slice(0, 3);
        if (!generos.length) return "";
        return '<div class="trk-generos">' + generos.map(function (g) {
            return '<span class="trk-genero">' + escapeHtml(g) + "</span>";
        }).join("") + "</div>";
    }

    function puntajeHtml(item) {
        var tiene = typeof item.score === "number" && item.score > 0;
        return '<div class="trk-score' + (tiene ? "" : " trk-score--vacio") + '">' +
            '<span class="trk-score-num">' + (tiene ? item.score.toFixed(1) : "—") + "</span>" +
            '<span class="trk-score-label">SCORE</span>' +
        "</div>";
    }

    function filaHtml(cat, item, pos) {
        var titulo = item.title || "Sin título";
        var poster = window.getApiPoster ? window.getApiPoster(item) : "";
        var url = "detalle.html?cat=" + encodeURIComponent(cat) + "&id=" + encodeURIComponent(item.id);

        return '<a class="trk-fila' + (pos <= 3 ? " trk-fila--podio" : "") + '" href="' + url + '">' +
            posHtml(pos) +
            '<span class="trk-poster">' +
                '<img src="' + escapeHtml(window.safeUrl ? window.safeUrl(poster) : poster) + '" alt="" ' +
                    'width="46" height="66" loading="lazy" decoding="async" ' +
                    'data-fallback-catalog="1" data-title="' + escapeHtml(titulo) + '">' +
            "</span>" +
            '<div class="trk-info">' +
                '<span class="trk-titulo" title="' + escapeHtml(titulo) + '">' + escapeHtml(titulo) + "</span>" +
                '<span class="trk-meta">' + metaHtml(cat, item) + "</span>" +
                generosHtml(item) +
            "</div>" +
            puntajeHtml(item) +
        "</a>";
    }

    function esqueletoHtml() {
        var html = "";
        var filas = (window.AnimeDestiny && AnimeDestiny.Constants && AnimeDestiny.Constants.RANKING_SKELETON_ROWS) || 8;
        for (var i = 0; i < filas; i++) {
            html += '<div class="trk-fila trk-fila--skeleton">' +
                '<span class="skeleton" style="width:24px;height:20px;margin:0 auto;"></span>' +
                '<span class="skeleton" style="width:46px;height:66px;border-radius:8px;"></span>' +
                '<div class="trk-info">' +
                    '<span class="skeleton" style="width:60%;height:15px;"></span>' +
                    '<span class="skeleton" style="width:35%;height:12px;margin-top:8px;"></span>' +
                "</div>" +
                '<span class="skeleton" style="width:62px;height:44px;border-radius:12px;justify-self:end;"></span>' +
            "</div>";
        }
        return '<div class="trk-lista">' + html + "</div>";
    }

    function render() {
        var estado = estados[catActual];

        if (estado.cargando && !estado.items.length) {
            lista.innerHTML = esqueletoHtml();
            return;
        }

        if (estado.error && !estado.items.length) {
            lista.innerHTML = '<div class="trk-estado">' +
                '<i data-lucide="wifi-off"></i>' +
                "<p>No se pudo cargar el ranking. Puede ser un límite temporal de la API.</p>" +
                '<button type="button" class="trk-btn" id="trkReintentar">Reintentar</button>' +
            "</div>";
            refrescarIconos();
            return;
        }

        if (!estado.items.length) {
            lista.innerHTML = '<div class="trk-estado"><p>Sin resultados.</p></div>';
            return;
        }

        // Contenedor <div> y no <ol>: las filas son <a> y un <ol> solo admite
        // <li> como hijo directo (y el :nth-child del podio necesita que las
        // filas sean hijas directas).
        var html = '<div class="trk-lista">';
        for (var i = 0; i < estado.items.length; i++) {
            html += filaHtml(catActual, estado.items[i], i + 1);
        }
        html += "</div>";

        html += '<div class="trk-pie">' +
            '<span class="trk-total"><i data-lucide="list-ordered"></i> ' +
                estado.items.length + " " + CATEGORIAS[catActual].label.toLowerCase() + " en el ranking</span>" +
            (estado.hayMas
                ? '<button type="button" class="trk-btn" id="trkCargarMas"' + (estado.cargando ? " disabled" : "") + ">" +
                    (estado.cargando ? "Cargando..." : (estado.error ? "Reintentar" : "Cargar más")) + "</button>"
                : "") +
        "</div>";

        lista.innerHTML = html;
        refrescarIconos();
    }

    async function cargarPagina() {
        var estado = estados[catActual];
        if (estado.cargando || !estado.hayMas) return;

        var cat = catActual;
        estado.cargando = true;
        estado.error = false;
        render();

        try {
            var fetcher = window[CATEGORIAS[cat].api];
            if (typeof fetcher !== "function") throw new Error("API no disponible");

            var datos = await fetcher(estado.pagina + 1, { browse: "puntuados" });

            if (!datos || !datos.length) {
                estado.hayMas = false;
            } else {
                estado.pagina++;
                datos.forEach(function (item) {
                    if (!item || item.id == null || estado.ids.has(item.id)) return;
                    estado.ids.add(item.id);
                    estado.items.push(item);
                });
                // getTopMangas intercala manga/manhwa/doujinshi, asi que lo que
                // llega NO viene en orden global de puntuacion. Se reordena
                // siempre para que el numero de posicion signifique lo mismo en
                // las tres pestañas.
                estado.items.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
            }
        } catch (e) {
            console.warn("Ranking: falló la carga de " + cat, e);
            estado.error = true;
        } finally {
            estado.cargando = false;
            // Si el usuario cambió de pestaña mientras cargaba, el render de la
            // pestaña nueva ya corrió: no le pisamos la vista con esta.
            if (cat === catActual) render();
        }
    }

    function activarTab(cat) {
        if (!CATEGORIAS[cat]) return;
        catActual = cat;

        if (tabsEl) {
            tabsEl.querySelectorAll(".trk-tab").forEach(function (btn) {
                var activo = btn.dataset.cat === cat;
                btn.classList.toggle("is-active", activo);
                btn.setAttribute("aria-selected", activo ? "true" : "false");
            });
        }

        var estado = estados[cat];
        if (!estado.items.length && !estado.cargando) {
            cargarPagina();
        } else {
            render();
        }
    }

    if (tabsEl) {
        tabsEl.addEventListener("click", function (e) {
            var btn = e.target.closest(".trk-tab");
            if (!btn || btn.dataset.cat === catActual) return;
            var cat = btn.dataset.cat;
            // El hash deja compartir/recargar la pestaña abierta.
            if (history.replaceState) history.replaceState(null, "", "#" + cat);
            activarTab(cat);
        });
    }

    lista.addEventListener("click", function (e) {
        if (e.target.closest("#trkCargarMas") || e.target.closest("#trkReintentar")) {
            cargarPagina();
        }
    });

    var inicial = (location.hash || "").replace("#", "");
    activarTab(CATEGORIAS[inicial] ? inicial : "anime");
})();
