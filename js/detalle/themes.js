/**
 * themes.js — Sección "Openings y endings" de la ficha de anime.
 *
 * Los datos salen de AnimeThemes.moe, que indexa por ID de AniList: no hace
 * falta mapear nada ni pedir API key, se le pasa el mismo id que ya tiene la
 * ficha abierta.
 *
 * Se reproduce el AUDIO (.ogg, ~3 MB) y no el video (.webm, 30-50 MB). Un
 * opening en video es lindo pero son 30 MB por click en una sección que
 * mucha gente va a tocar de curiosa; para eso está el link a AnimeThemes.
 * Además nada se descarga hasta que el usuario le da play: el <audio> se crea
 * vacío y recién ahí se le pone el src.
 *
 * Safari no reproduce OGG Vorbis. En vez de esconder la sección se muestra
 * igual (el listado de temas ya vale por sí solo) pero sin botón de play, con
 * el link a AnimeThemes como salida.
 */
(function (window) {
    "use strict";

    var API = 'https://api.animethemes.moe/anime';

    // Los temas de un anime terminado no cambian nunca, y los de uno en
    // emisión cambian una vez por temporada. 24 h es holgado y evita pegarle a
    // la API en cada visita a la misma ficha.
    var TTL_MS = 24 * 60 * 60 * 1000;

    // Mismo prefijo y misma forma que el caché de api.js, así el pruneo que
    // corre ahí al arrancar también limpia estas entradas cuando vencen.
    var CACHE_PREFIX = 'adApiCache_';

    // Un token por render, igual que en seasons.js: si el usuario abre otra
    // ficha mientras esto viaja, la respuesta vieja no pisa la nueva.
    var tokenActual = 0;

    // Los iconos van como literales enteros y no armados por concatenación:
    // tools/build.js decide qué iconos de lucide entran al bundle buscando
    // data-lucide="..." en el fuente, y un nombre concatenado no lo encuentra.
    var ICONO = {
        play: '<i data-lucide="play"></i>',
        pause: '<i data-lucide="pause"></i>'
    };

    // Requests en vuelo, para que dos llamadas seguidas a hidratar() sobre la
    // misma ficha no disparen dos fetch.
    var _inflight = new Map();

    function leerCache(clave) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + clave);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (Date.now() > parsed.expiry) {
                localStorage.removeItem(CACHE_PREFIX + clave);
                return null;
            }
            return parsed.data;
        } catch (e) { return null; }
    }

    function guardarCache(clave, data) {
        try {
            localStorage.setItem(CACHE_PREFIX + clave, JSON.stringify({
                data: data,
                expiry: Date.now() + TTL_MS
            }));
        } catch (e) { /* quota llena: seguir sin cachear */ }
    }

    /**
     * La respuesta cruda trae la biblioteca entera de videos por tema (varias
     * resoluciones, versiones y cortes). Se piden solo los campos que se usan
     * porque One Piece sin recortar son ~200 KB de JSON contra ~25 KB.
     */
    function url(anilistId) {
        return API +
            '?filter[has]=resources' +
            '&filter[site]=AniList' +
            '&filter[external_id]=' + encodeURIComponent(anilistId) +
            '&include=animethemes.song.artists,animethemes.animethemeentries.videos.audio' +
            '&fields[anime]=name,slug' +
            '&fields[animetheme]=type,sequence,slug' +
            '&fields[song]=title' +
            '&fields[artist]=name' +
            '&fields[animethemeentry]=version,spoiler,nsfw' +
            '&fields[video]=id' +
            '&fields[audio]=link';
    }

    function artistasDe(song) {
        var arts = (song && Array.isArray(song.artists)) ? song.artists : [];
        return arts.map(function (a) { return a && a.name; })
                   .filter(Boolean)
                   .join(', ');
    }

    /**
     * Primer audio utilizable de un tema. Un mismo tema tiene varias "entries"
     * (v1, v2, versión sin créditos...) y casi siempre apuntan al mismo .ogg,
     * así que alcanza con quedarse con la primera. Se descartan las marcadas
     * NSFW: son cortes con desnudos y esto se muestra sin advertencia.
     */
    function audioDe(tema) {
        var entries = Array.isArray(tema && tema.animethemeentries) ? tema.animethemeentries : [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e || e.nsfw) continue;
            var videos = Array.isArray(e.videos) ? e.videos : [];
            for (var j = 0; j < videos.length; j++) {
                var link = videos[j] && videos[j].audio && videos[j].audio.link;
                if (link) return link;
            }
        }
        return '';
    }

    // OP antes que ED, y dentro de cada tipo por número. La API los devuelve
    // agrupados pero sin garantía de orden entre tipos.
    function ordenar(temas) {
        var peso = { OP: 0, ED: 1 };
        return temas.sort(function (a, b) {
            var pa = peso[a.tipo] != null ? peso[a.tipo] : 2;
            var pb = peso[b.tipo] != null ? peso[b.tipo] : 2;
            if (pa !== pb) return pa - pb;
            return (a.secuencia || 0) - (b.secuencia || 0);
        });
    }

    function normalizar(json) {
        var lista = (json && Array.isArray(json.anime)) ? json.anime : [];
        if (!lista.length) return null;

        var anime = lista[0];
        var temas = (Array.isArray(anime.animethemes) ? anime.animethemes : [])
            .map(function (t) {
                if (!t) return null;
                var titulo = (t.song && t.song.title) || '';
                if (!titulo) return null;
                return {
                    etiqueta: t.slug || ((t.type || '') + (t.sequence || '')),
                    tipo: String(t.type || '').toUpperCase(),
                    secuencia: t.sequence || 0,
                    titulo: titulo,
                    artistas: artistasDe(t.song),
                    audio: audioDe(t)
                };
            })
            .filter(Boolean);

        if (!temas.length) return null;

        return {
            temas: ordenar(temas),
            // Link a la página del anime en AnimeThemes: es la salida para ver
            // los videos y para los navegadores que no reproducen OGG.
            pagina: anime.slug ? 'https://animethemes.moe/anime/' + anime.slug : 'https://animethemes.moe'
        };
    }

    /**
     * Trae los temas de un anime por su id de AniList. Devuelve null cuando el
     * anime no está en AnimeThemes (pasa seguido con obras viejas, ONAs y
     * cosas recién estrenadas) — no es un error, es que no hay nada que mostrar.
     */
    function obtenerTemas(anilistId) {
        if (anilistId == null || anilistId === '') return Promise.resolve(null);

        var clave = 'themes_' + anilistId;
        var cacheado = leerCache(clave);
        if (cacheado) return Promise.resolve(cacheado);

        var pendiente = _inflight.get(clave);
        if (pendiente) return pendiente;

        var p = fetch(url(anilistId), { headers: { 'Accept': 'application/json' } })
            .then(function (r) {
                if (!r.ok) throw new Error('AnimeThemes respondió ' + r.status);
                return r.json();
            })
            .then(function (json) {
                var data = normalizar(json);
                if (data) guardarCache(clave, data);
                return data;
            })
            .finally(function () { _inflight.delete(clave); });

        _inflight.set(clave, p);
        return p;
    }

    // Safari no soporta OGG Vorbis. canPlayType devuelve '' cuando no puede,
    // 'maybe' o 'probably' cuando sí; cualquier cosa que no sea '' sirve.
    function puedeReproducirOgg() {
        try {
            var a = document.createElement('audio');
            return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"'));
        } catch (e) { return false; }
    }

    function htmlFila(tema, conAudio) {
        var esc = window.escapeHtml;
        var url_ = window.safeUrl;

        var meta = tema.artistas
            ? '<span class="theme-row-artist">' + esc(tema.artistas) + '</span>'
            : '';

        var control = (conAudio && tema.audio)
            ? '<button class="theme-play" type="button" data-audio="' + esc(url_(tema.audio)) + '" ' +
              'aria-label="Reproducir ' + esc(tema.titulo) + '">' + ICONO.play + '</button>'
            : '';

        return '<li class="theme-row">' +
            '<span class="theme-row-tag">' + esc(tema.etiqueta) + '</span>' +
            '<span class="theme-row-info">' +
                '<span class="theme-row-title">' + esc(tema.titulo) + '</span>' +
                meta +
            '</span>' +
            control +
        '</li>';
    }

    function htmlSeccion(data) {
        if (!data || !data.temas.length) return '';
        var esc = window.escapeHtml;
        var conAudio = puedeReproducirOgg();

        var nota = conAudio
            ? ''
            : '<p class="theme-nota">Tu navegador no reproduce este formato de audio. ' +
              'Podés escucharlos en AnimeThemes.</p>';

        return '<div class="detail-section detail-section-themes" id="detailThemes">' +
            '<h2 class="detail-h2">Openings y endings</h2>' +
            '<ul class="theme-list">' +
                data.temas.map(function (t) { return htmlFila(t, conAudio); }).join('') +
            '</ul>' +
            nota +
            '<a class="theme-fuente" href="' + esc(data.pagina) + '" target="_blank" rel="noopener noreferrer">' +
                'Ver los videos en AnimeThemes' +
            '</a>' +
        '</div>';
    }

    /**
     * Un solo <audio> para toda la sección: dos temas nunca suenan a la vez y
     * no se descarga nada hasta el primer play.
     */
    function conectarReproductor(seccion) {
        var audio = new Audio();
        audio.preload = 'none';
        var sonando = null;

        function icono(boton, nombre) {
            boton.innerHTML = ICONO[nombre];
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) { /* no bloquear */ }
            }
        }

        function frenar() {
            if (!sonando) return;
            sonando.classList.remove('is-playing');
            icono(sonando, 'play');
            sonando = null;
        }

        seccion.addEventListener('click', function (ev) {
            var boton = ev.target.closest('.theme-play');
            if (!boton || !seccion.contains(boton)) return;

            if (boton === sonando) {
                audio.pause();
                frenar();
                return;
            }

            frenar();
            audio.src = boton.getAttribute('data-audio');
            sonando = boton;
            boton.classList.add('is-playing');
            icono(boton, 'pause');

            audio.play().catch(function () {
                // Autoplay bloqueado o el archivo no cargó: se vuelve al estado
                // de reposo en vez de dejar el botón trabado en "pause".
                frenar();
            });
        });

        audio.addEventListener('ended', frenar);
        audio.addEventListener('error', frenar);

        // Al navegar a otra ficha el nodo se va del DOM pero el <audio> sigue
        // sonando, porque el objeto vive en este closure y nadie lo suelta.
        window.addEventListener('pagehide', function () { audio.pause(); });
    }

    /**
     * Completa la sección contra la API. Se llama después de inyectar el
     * detalle; el ancla vacía que deja render.js se reemplaza por la sección
     * armada, o se borra si el anime no está en AnimeThemes.
     */
    async function hidratar(item) {
        var token = ++tokenActual;
        var ancla = document.getElementById('detailThemes');
        if (!ancla) return;

        var data;
        try {
            data = await obtenerTemas(item && item.id);
        } catch (e) {
            console.warn('Openings: no se pudieron traer los temas', e);
            ancla.remove();
            return;
        }

        // Mientras viajaba el request el usuario abrió otra ficha.
        if (token !== tokenActual) return;
        var actual = document.getElementById('detailThemes');
        if (!actual || actual !== ancla) return;

        var html = htmlSeccion(data);
        if (!html) { ancla.remove(); return; }

        ancla.outerHTML = html;

        var seccion = document.getElementById('detailThemes');
        if (!seccion) return;
        conectarReproductor(seccion);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            try { window.lucide.createIcons(); } catch (e) { /* no bloquear el render */ }
        }
    }

    window.DetalleThemes = {
        obtenerTemas: obtenerTemas,
        normalizar: normalizar,
        htmlSeccion: htmlSeccion,
        hidratar: hidratar
    };
})(window);
