/**
 * escena.js — "¿Qué anime es?" (escena.html).
 *
 * Busca de qué anime es una captura con trace.moe: devuelve el anime (con su
 * id de AniList, el mismo que usa la ficha), el episodio y el minuto. No pide
 * API key; la cuota anónima es por IP y alcanza para uso normal. Si se agota,
 * la API responde 402/429 y se avisa en vez de fallar callado.
 *
 * La imagen viaja directo del navegador a trace.moe: Mirudoku no la sube a
 * ningún lado ni la guarda.
 */
(function (window, document) {
    "use strict";

    var API = 'https://api.trace.moe/search?cutBorders&anilistInfo';
    var MAX_BYTES = 25 * 1024 * 1024;
    // trace.moe avisa que por debajo de ~87% de similitud el resultado suele
    // ser otro anime. Se muestra igual, pero marcado como dudoso.
    var SIMILITUD_CONFIABLE = 0.87;
    var MAX_RESULTADOS = 5;

    function esc(v) {
        return window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v);
    }

    /** Segundos → "m:ss" o "h:mm:ss". */
    function formatoTiempo(seg) {
        var s = Math.max(0, Math.floor(Number(seg) || 0));
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var r = s % 60;
        var mm = h ? String(m).padStart(2, '0') : String(m);
        return (h ? h + ':' : '') + mm + ':' + String(r).padStart(2, '0');
    }

    /** Solo se aceptan previews servidas por trace.moe. */
    function urlMedia(u, extra) {
        try {
            var url = new URL(String(u));
            if (url.protocol !== 'https:' || url.hostname !== 'media.trace.moe') return '';
            Object.keys(extra || {}).forEach(function (k) { url.searchParams.set(k, extra[k]); });
            return url.toString();
        } catch (e) { return ''; }
    }

    /**
     * Respuesta de trace.moe → lista para pintar. Descarta los +18 (el
     * catálogo los oculta por defecto) y repite un mismo anime solo una vez,
     * con su mejor coincidencia.
     */
    function normalizarResultados(json) {
        var lista = (json && Array.isArray(json.result)) ? json.result : [];
        var vistos = new Set();
        var out = [];
        lista.forEach(function (r) {
            if (!r) return;
            var al = (r.anilist && typeof r.anilist === 'object') ? r.anilist : { id: r.anilist };
            var id = Number(al.id);
            if (!id || al.isAdult || vistos.has(id)) return;
            vistos.add(id);
            var t = al.title || {};
            var ep = r.episode;
            if (Array.isArray(ep)) ep = ep.join('-');
            out.push({
                anilistId: id,
                titulo: t.english || t.romaji || t.native || ('AniList #' + id),
                nativo: t.native || '',
                episodio: (ep === null || ep === undefined || ep === '') ? null : String(ep),
                desde: Number(r.from) || 0,
                hasta: Number(r.to) || 0,
                similitud: Math.max(0, Math.min(1, Number(r.similarity) || 0)),
                imagen: urlMedia(r.image, { size: 'm' }),
                video: urlMedia(r.video, { size: 's', mute: '' })
            });
        });
        return out.slice(0, MAX_RESULTADOS);
    }

    function htmlResultado(r, idx) {
        var pct = Math.round(r.similitud * 1000) / 10;
        var baja = r.similitud < SIMILITUD_CONFIABLE;
        var media = r.video
            ? '<video src="' + esc(r.video) + '" poster="' + esc(r.imagen) + '" muted loop playsinline preload="none" aria-label="Escena encontrada"></video>'
            : (r.imagen ? '<img src="' + esc(r.imagen) + '" alt="Escena encontrada" loading="lazy">' : '');
        var meta = [];
        if (r.episodio) meta.push('Episodio ' + r.episodio);
        meta.push('Minuto ' + formatoTiempo(r.desde) + (r.hasta > r.desde ? ' – ' + formatoTiempo(r.hasta) : ''));
        return '<article class="escena-result' + (idx === 0 && !baja ? ' is-top' : '') + '">' +
            '<div class="escena-result-media">' + media + '</div>' +
            '<div class="escena-result-info">' +
                '<span class="escena-sim' + (baja ? ' is-baja' : '') + '">' + esc(pct) + '% de coincidencia' + (baja ? ' · dudoso' : '') + '</span>' +
                '<h2 class="escena-result-title">' + esc(r.titulo) + '</h2>' +
                (r.nativo && r.nativo !== r.titulo ? '<span class="escena-result-native">' + esc(r.nativo) + '</span>' : '') +
                '<span class="escena-result-meta">' + esc(meta.join(' · ')) + '</span>' +
                '<a class="escena-result-link" href="detalle.html?cat=anime&id=' + encodeURIComponent(r.anilistId) + '">Ver ficha →</a>' +
            '</div>' +
        '</article>';
    }

    /** Mensaje para el usuario según la respuesta de error de la API. */
    function mensajeError(status) {
        if (status === 402 || status === 429) return 'Se alcanzó el límite de búsquedas gratis de trace.moe. Probá de nuevo en un rato.';
        if (status === 413) return 'La imagen es demasiado grande (máximo 25 MB).';
        if (status === 400) return 'No se pudo leer esa imagen. Probá con otra captura o con otro link.';
        if (status >= 500) return 'trace.moe no está respondiendo. Probá de nuevo más tarde.';
        return 'No se pudo hacer la búsqueda.';
    }

    async function buscar(fuente) {
        var resp;
        if (fuente.archivo) {
            var fd = new FormData();
            fd.append('image', fuente.archivo);
            resp = await fetch(API, { method: 'POST', body: fd });
        } else {
            resp = await fetch(API + '&url=' + encodeURIComponent(fuente.url));
        }
        if (!resp.ok) {
            var err = new Error('trace.moe HTTP ' + resp.status);
            err.status = resp.status;
            throw err;
        }
        var json = await resp.json();
        if (json && json.error) {
            var e2 = new Error(json.error);
            e2.status = 400;
            throw e2;
        }
        return normalizarResultados(json);
    }

    function init() {
        var form = document.getElementById('escenaForm');
        if (!form) return;
        var input = document.getElementById('escenaFile');
        var drop = document.getElementById('escenaDrop');
        var preview = document.getElementById('escenaPreview');
        var urlInput = document.getElementById('escenaUrl');
        var boton = document.getElementById('escenaBuscar');
        var estado = document.getElementById('escenaEstado');
        var cont = document.getElementById('escenaResultados');
        var buscando = false;

        function setEstado(texto, esError) {
            estado.textContent = texto || '';
            estado.classList.toggle('is-error', !!esError);
        }

        async function ejecutar(fuente) {
            if (buscando) return;
            buscando = true;
            boton.disabled = true;
            cont.innerHTML = '';
            setEstado('Buscando la escena…');
            try {
                var resultados = await buscar(fuente);
                if (!resultados.length) {
                    setEstado('No encontramos ningún anime para esa imagen.');
                    return;
                }
                setEstado(resultados[0].similitud < SIMILITUD_CONFIABLE
                    ? 'No hay una coincidencia segura. Estos son los más parecidos:'
                    : 'Encontrado:');
                cont.innerHTML = resultados.map(htmlResultado).join('');
                // Los videos se reproducen al pasar el mouse o al tocarlos:
                // con preload="none" no se baja nada hasta entonces.
                cont.querySelectorAll('video').forEach(function (v) {
                    var play = function () { try { v.play().catch(function () {}); } catch (e) { /* no-op */ } };
                    v.addEventListener('mouseenter', play);
                    v.addEventListener('mouseleave', function () { v.pause(); });
                    v.addEventListener('click', function () { if (v.paused) play(); else v.pause(); });
                });
            } catch (e) {
                console.warn('trace.moe:', e);
                setEstado(e && e.status ? mensajeError(e.status) : 'No se pudo conectar con trace.moe. Revisá tu conexión.', true);
            } finally {
                buscando = false;
                boton.disabled = false;
            }
        }

        function usarArchivo(archivo) {
            if (!archivo) return;
            if (!/^image\//.test(archivo.type)) { setEstado('Eso no es una imagen.', true); return; }
            if (archivo.size > MAX_BYTES) { setEstado(mensajeError(413), true); return; }
            urlInput.value = '';
            // data: y no blob:, porque el CSP permite data: en img-src.
            var lector = new FileReader();
            lector.onload = function () {
                preview.src = String(lector.result);
                preview.hidden = false;
            };
            lector.readAsDataURL(archivo);
            ejecutar({ archivo: archivo });
        }

        input.addEventListener('change', function () {
            usarArchivo(input.files && input.files[0]);
            input.value = '';
        });

        ['dragenter', 'dragover'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            drop.addEventListener(ev, function () { drop.classList.remove('is-over'); });
        });
        drop.addEventListener('drop', function (e) {
            e.preventDefault();
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            usarArchivo(f);
        });

        document.addEventListener('paste', function (e) {
            var items = (e.clipboardData && e.clipboardData.items) || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
                    e.preventDefault();
                    usarArchivo(items[i].getAsFile());
                    return;
                }
            }
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var u = urlInput.value.trim();
            if (!u) { setEstado('Elegí una imagen o pegá un link.', true); return; }
            if (!/^https?:\/\/\S+$/i.test(u)) { setEstado('Ese link no es válido.', true); return; }
            preview.hidden = true;
            preview.removeAttribute('src');
            ejecutar({ url: u });
        });
    }

    window.Escena = {
        formatoTiempo: formatoTiempo,
        normalizarResultados: normalizarResultados,
        htmlResultado: htmlResultado,
        mensajeError: mensajeError
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window, document);
