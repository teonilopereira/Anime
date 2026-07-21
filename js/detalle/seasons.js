/**
 * seasons.js — Sección "Temporadas" de la ficha de anime.
 *
 * AniList no entrega una franquicia como una obra con N temporadas: entrega N
 * fichas encadenadas de a una por PREQUEL/SEQUEL. Antes eso caía todo mezclado
 * en "Relacionados", junto a spin-offs y adaptaciones y sin orden, así que en
 * una franquicia larga no se entendía qué venía antes de qué.
 *
 * Acá se reconstruye la cadena completa caminando las relaciones hacia atrás y
 * hacia adelante, y se muestra ordenada, con la temporada actual marcada.
 *
 * El render es en dos tiempos a propósito:
 *   1. `cadenaDirecta` arma al toque la precuela/secuela inmediatas, que ya
 *      vienen en el item — se pinta sin esperar a la red.
 *   2. `hidratar` completa el resto de la cadena con getAnimeById (cacheado
 *      1h en localStorage) y repinta con portadas.
 */
(function (window) {
    "use strict";

    // Formatos que cuentan como "temporada". Las películas, OVAs y especiales
    // quedan afuera: son parte de la franquicia pero no un eslabón de la
    // cadena, y meterlos rompía la numeración (T1, T2...). Siguen apareciendo
    // en "Relacionados", que es donde corresponde.
    var FORMATOS_TEMPORADA = ['TV', 'TV_SHORT', 'ONA'];

    // Tope de saltos hacia cada lado. Cada salto es un request (cacheado), y
    // ninguna franquicia real pasa de esto; es un cinturón contra una cadena
    // rota que se vuelva infinita.
    var MAX_SALTOS = 12;

    // Un token por render: si el usuario abre otra ficha mientras la cadena se
    // está resolviendo, la respuesta vieja no pisa la nueva.
    var tokenActual = 0;

    // Formatos de anime que NO son un eslabón de la cadena. Se listan estos y
    // no los válidos porque el formato del item abierto puede venir vacío o con
    // una etiqueta que no esperamos: ante la duda conviene mostrar la sección,
    // no esconderla.
    var FORMATOS_SUELTOS = ['MOVIE', 'SPECIAL', 'OVA', 'MUSIC'];

    function esFormatoDeTemporada(fmt) {
        return FORMATOS_TEMPORADA.indexOf(String(fmt || '').toUpperCase()) !== -1;
    }

    // Una película o un OVA pertenecen a la franquicia pero no son una
    // temporada: ahí la cadena numerada no aplica y la ficha se queda con
    // "Relacionados", que es donde siguen apareciendo.
    function esPiezaSuelta(item) {
        var fmt = String((item && (item.format || item.type)) || '').toUpperCase();
        return FORMATOS_SUELTOS.indexOf(fmt) !== -1;
    }

    function relacionesDe(item) {
        return Array.isArray(item && item.relations) ? item.relations : [];
    }

    /**
     * Vecino de la cadena en un sentido. Cuando hay varios candidatos (pasa
     * cuando una temporada tiene secuela en TV y además un ONA derivado) gana
     * el formato TV y, a igualdad, el año más cercano al de `item`.
     */
    function vecino(item, tipo) {
        var candidatos = relacionesDe(item).filter(function (r) {
            return r && r.relationType === tipo && r.id != null && esFormatoDeTemporada(r.format);
        });
        if (!candidatos.length) return null;

        var haciaAtras = tipo === 'PREQUEL';
        candidatos.sort(function (a, b) {
            var pesoA = String(a.format).toUpperCase() === 'ONA' ? 1 : 0;
            var pesoB = String(b.format).toUpperCase() === 'ONA' ? 1 : 0;
            if (pesoA !== pesoB) return pesoA - pesoB;
            var anioA = a.seasonYear || 0;
            var anioB = b.seasonYear || 0;
            // Para atrás queremos el más reciente de los anteriores; para
            // adelante, el más viejo de los siguientes. En los dos casos, el
            // que está pegado al item actual.
            return haciaAtras ? (anioB - anioA) : (anioA - anioB);
        });
        return candidatos[0];
    }

    // Forma común de un eslabón, venga de una relación pelada o de una ficha
    // completa traída por getAnimeById.
    function aEslabon(src, esActual) {
        if (!src) return null;
        return {
            id: src.id,
            titulo: src.titulo || src.title || '',
            anio: src.seasonYear || src.anio || null,
            episodios: Number(src.episodes || src.episodios || 0),
            formato: src.format || src.type || '',
            img: src.img || (window.getApiPoster ? window.getApiPoster(src) : '') || '',
            esActual: !!esActual
        };
    }

    /**
     * Cadena instantánea: precuela inmediata + actual + secuela inmediata.
     * Es lo que ya trae el item, sin pedir nada a la red.
     */
    function cadenaDirecta(item) {
        if (esPiezaSuelta(item)) return null;
        var previa = vecino(item, 'PREQUEL');
        var siguiente = vecino(item, 'SEQUEL');
        if (!previa && !siguiente) return null;

        var cadena = [];
        if (previa) cadena.push(aEslabon(previa, false));
        cadena.push(aEslabon(item, true));
        if (siguiente) cadena.push(aEslabon(siguiente, false));

        // Sin caminar la cadena entera no se sabe si la primera es la T1, así
        // que todavía no se numera.
        return { eslabones: cadena, numerada: false, parcial: true };
    }

    /**
     * Cadena completa. Camina PREQUEL hacia atrás y SEQUEL hacia adelante
     * pidiendo cada ficha con getAnimeById (que cachea, así que volver a la
     * misma franquicia no cuesta requests).
     *
     * `numerada` sale true solo si se llegó al principio real de la cadena: si
     * se cortó por el tope de saltos o por un error de red, el "T1" sería
     * mentira y se muestran los títulos sin número.
     */
    async function resolverCadena(item) {
        var traer = window.getAnimeById;
        if (typeof traer !== 'function') return cadenaDirecta(item);

        var vistos = new Set([String(item.id)]);

        async function caminar(tipo) {
            var tramo = [];
            var actual = item;
            var completo = false;
            for (var i = 0; i < MAX_SALTOS; i++) {
                var rel = vecino(actual, tipo);
                if (!rel) { completo = true; break; }
                if (vistos.has(String(rel.id))) { completo = true; break; }
                vistos.add(String(rel.id));

                var ficha = await traer(rel.id);
                if (!ficha) {
                    // Se cayó el request: se conserva lo que ya se sabía de la
                    // relación para no perder el eslabón, pero la cadena queda
                    // marcada como incompleta.
                    tramo.push(aEslabon(rel, false));
                    break;
                }
                tramo.push(aEslabon(ficha, false));
                actual = ficha;
            }
            return { tramo: tramo, completo: completo };
        }

        var atras = await caminar('PREQUEL');
        var adelante = await caminar('SEQUEL');

        var eslabones = atras.tramo.slice().reverse()
            .concat([aEslabon(item, true)])
            .concat(adelante.tramo);

        if (eslabones.length < 2) return null;

        return {
            eslabones: eslabones,
            numerada: atras.completo,
            parcial: !atras.completo || !adelante.completo
        };
    }

    function etiquetaMeta(eslabon) {
        var partes = [];
        if (eslabon.anio) partes.push(eslabon.anio);
        if (eslabon.episodios) partes.push(eslabon.episodios + (eslabon.episodios === 1 ? ' ep' : ' eps'));
        return partes.join(' · ');
    }

    function htmlCadena(cadena) {
        var esc = window.escapeHtml;
        var url = window.safeUrl;

        return cadena.eslabones.map(function (e, idx) {
            var numero = cadena.numerada ? 'T' + (idx + 1) : '';
            var titulo = e.titulo || 'Sin título';
            var meta = etiquetaMeta(e);

            var portada = e.img
                ? '<img src="' + esc(url(e.img)) + '" alt="" width="46" height="66" loading="lazy" decoding="async" ' +
                  'data-fallback-catalog="1" data-title="' + esc(titulo) + '">'
                : '';

            var interior =
                '<span class="season-chain-pos">' + (numero || (idx + 1)) + '</span>' +
                '<span class="season-chain-cover">' + portada + '</span>' +
                '<span class="season-chain-info">' +
                    '<span class="season-chain-title">' + esc(titulo) + '</span>' +
                    (meta ? '<span class="season-chain-meta">' + esc(meta) + '</span>' : '') +
                '</span>' +
                (e.esActual ? '<span class="season-chain-here">ESTÁS ACÁ</span>' : '');

            // La temporada actual no se linkea a sí misma: sería un link que no
            // lleva a ningún lado.
            if (e.esActual) {
                return '<div class="season-chain-item is-current" aria-current="true">' + interior + '</div>';
            }
            return '<a class="season-chain-item" href="detalle.html?cat=anime&id=' + encodeURIComponent(e.id) + '">' + interior + '</a>';
        }).join('');
    }

    function htmlSeccion(cadena, cargando) {
        if (!cadena) return '';
        var nota = cargando
            ? '<span class="season-chain-nota">Buscando el resto de la franquicia…</span>'
            : (cadena.parcial ? '<span class="season-chain-nota">Puede faltar alguna temporada.</span>' : '');

        return '<div class="detail-section detail-section-seasons" id="detailSeasons">' +
            '<h2 class="detail-h2">Temporadas</h2>' +
            '<div class="season-chain">' + htmlCadena(cadena) + '</div>' +
            nota +
        '</div>';
    }

    /**
     * Completa la sección con la cadena entera. Se llama después de inyectar el
     * detalle; si falla o no hay nada nuevo, la cadena directa que ya está
     * pintada queda como está.
     */
    async function hidratar(item) {
        var token = ++tokenActual;
        var contenedor = document.getElementById('detailSeasons');
        if (!contenedor) return;

        var cadena;
        try {
            cadena = await resolverCadena(item);
        } catch (e) {
            console.warn('Temporadas: no se pudo resolver la cadena', e);
            return;
        }

        // Mientras se resolvía el usuario abrió otra ficha (o se volvió a
        // renderizar esta): el DOM de ahora no es el de este resultado.
        if (token !== tokenActual) return;
        var actualizado = document.getElementById('detailSeasons');
        if (!actualizado || actualizado !== contenedor) return;
        if (!cadena) return;

        actualizado.outerHTML = htmlSeccion(cadena, false);
    }

    window.DetalleTemporadas = {
        esFormatoDeTemporada: esFormatoDeTemporada,
        cadenaDirecta: cadenaDirecta,
        resolverCadena: resolverCadena,
        htmlSeccion: htmlSeccion,
        hidratar: hidratar
    };
})(window);
