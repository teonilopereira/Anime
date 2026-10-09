/**
 * mal-stats.js — Puntaje y ranking de MyAnimeList en la ficha.
 *
 * AniList ya trae el `idMal` de cada obra, así que no hay que mapear nada: se
 * le pide a Jikan (API no oficial de MAL, sin API key) /anime/{id} o
 * /manga/{id} y se agrega una línea debajo del puntaje de AniList. El dato es
 * opcional: si Jikan tarda, devuelve 404 o está caído, la ficha queda igual
 * que antes.
 *
 * Jikan limita a 3 req/s y 60/min (lo comparte con la sinopsis por episodio
 * de interactions.js), así que se cachea 24 h, también el "no hay datos".
 */
(function (window) {
    "use strict";

    var API = 'https://api.jikan.moe/v4/';
    var TTL_MS = 24 * 60 * 60 * 1000;
    // Mismo prefijo que api.js y themes.js: el pruneo que corre al arrancar
    // también limpia estas entradas cuando vencen.
    var CACHE_PREFIX = 'adApiCache_';

    var tokenActual = 0;
    var _inflight = new Map();

    function leerCache(clave) {
        try {
            var raw = localStorage.getItem(CACHE_PREFIX + clave);
            if (!raw) return undefined;
            var parsed = JSON.parse(raw);
            if (Date.now() > parsed.expiry) {
                localStorage.removeItem(CACHE_PREFIX + clave);
                return undefined;
            }
            return parsed.data;
        } catch (e) { return undefined; }
    }

    function guardarCache(clave, data) {
        try {
            localStorage.setItem(CACHE_PREFIX + clave, JSON.stringify({
                data: data,
                expiry: Date.now() + TTL_MS
            }));
        } catch (e) { /* quota llena: seguir sin cachear */ }
    }

    /** Respuesta de Jikan → solo lo que se muestra. null si no hay puntaje. */
    function normalizar(json) {
        var d = json && json.data;
        if (!d || typeof d.score !== 'number' || d.score <= 0) return null;
        return {
            score: d.score,
            scoredBy: Number(d.scored_by) || 0,
            rank: Number(d.rank) || 0,
            members: Number(d.members) || 0,
            url: typeof d.url === 'string' ? d.url : ''
        };
    }

    function idValido(malId) {
        return malId != null && /^\d+$/.test(String(malId)) && Number(malId) > 0;
    }

    async function obtener(malId, tipo) {
        if (!idValido(malId)) return null;
        tipo = tipo === 'manga' ? 'manga' : 'anime';
        var clave = 'mal_' + tipo + '_' + malId;
        var cacheado = leerCache(clave);
        if (cacheado !== undefined) return cacheado;
        if (_inflight.has(clave)) return _inflight.get(clave);

        var p = (async function () {
            var resp = await fetch(API + tipo + '/' + encodeURIComponent(malId));
            // 404: MAL no tiene la obra. Se cachea para no volver a preguntar.
            if (resp.status === 404) { guardarCache(clave, null); return null; }
            // 429 / 5xx: no se cachea, la próxima visita reintenta.
            if (!resp.ok) throw new Error('Jikan HTTP ' + resp.status);
            var data = normalizar(await resp.json());
            guardarCache(clave, data);
            return data;
        })();
        _inflight.set(clave, p);
        try { return await p; } finally { _inflight.delete(clave); }
    }

    function formatoNumero(n) {
        return Number(n).toLocaleString('es-AR');
    }

    /** Línea que va debajo del puntaje de AniList. '' si no hay datos. */
    function htmlLinea(data) {
        if (!data) return '';
        var esc = window.escapeHtml;
        var texto = 'MAL ' + data.score.toFixed(2) + (data.rank ? ' · #' + formatoNumero(data.rank) : '');
        var detalle = ['MyAnimeList: ' + data.score.toFixed(2)];
        if (data.scoredBy) detalle.push(formatoNumero(data.scoredBy) + ' votos');
        if (data.rank) detalle.push('puesto #' + formatoNumero(data.rank));
        if (data.members) detalle.push(formatoNumero(data.members) + ' miembros');
        var titulo = esc(detalle.join(' · '));
        // Solo se enlaza a MAL; cualquier otra URL que venga en la respuesta se
        // muestra como texto plano.
        if (/^https:\/\/myanimelist\.net\//.test(data.url)) {
            return '<a class="detail-stat-mal" href="' + esc(data.url) + '" target="_blank" rel="noopener noreferrer" title="' + titulo + '">' + esc(texto) + '</a>';
        }
        return '<span class="detail-stat-mal" title="' + titulo + '">' + esc(texto) + '</span>';
    }

    async function hidratar(item, tipo) {
        var token = ++tokenActual;
        var ancla = document.getElementById('detailMalScore');
        if (!ancla) return;
        var data;
        try {
            data = await obtener(item && item.mal_id, tipo);
        } catch (e) {
            console.warn('MAL: no se pudo traer el puntaje', e);
            return;
        }
        if (token !== tokenActual || document.getElementById('detailMalScore') !== ancla) return;
        var html = htmlLinea(data);
        if (!html) return;
        ancla.innerHTML = html;
        ancla.hidden = false;
    }

    window.DetalleMal = {
        normalizar: normalizar,
        obtener: obtener,
        htmlLinea: htmlLinea,
        hidratar: hidratar
    };
})(window);
