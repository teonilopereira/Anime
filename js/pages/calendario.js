/**
 * calendario.js — Calendario semanal de estrenos.
 *
 * Trae getWeeklyAiringSchedule() (AniList) y agrupa los episodios por día
 * local. Los animes que el usuario sigue (fav / viendo / visto) se resaltan y
 * pueden aislarse con el filtro "Solo lo que sigo".
 *
 * Retención: da un motivo predecible para volver ("mañana sale el ep. X").
 * Todo es best-effort: sin sesión funciona igual, solo sin resaltado.
 */
(function () {
    'use strict';

    var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    var _all = [];        // estrenos crudos
    var _followed = null; // Set de ids seguidos (lazy)
    var _onlyMine = false;

    function esc(s) {
        return window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
    }

    function dayKey(date) {
        return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    }

    function dayLabel(date, today) {
        var diff = Math.round(
            (new Date(date.getFullYear(), date.getMonth(), date.getDate()) -
             new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000
        );
        var nombre = DIAS[date.getDay()];
        var fecha = date.getDate() + ' ' + MESES[date.getMonth()];
        if (diff === 0) return 'Hoy · ' + nombre + ' ' + fecha;
        if (diff === 1) return 'Mañana · ' + nombre + ' ' + fecha;
        return nombre + ' ' + fecha;
    }

    function hhmm(date) {
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    // Anime que el usuario sigue: fav, visto o en estado "viendo".
    async function loadFollowed() {
        if (_followed) return _followed;
        _followed = new Set();
        var client = window.AppSupabase;
        if (!client || !client.isSignedIn || !client.isSignedIn() || !client.loadItemStates) return _followed;
        try {
            var states = await client.loadItemStates('anime');
            (Array.isArray(states) ? states : []).forEach(function (st) {
                if (st.fav || st.viewed || st.watch_status === 'viendo') {
                    _followed.add(String(st.item_id));
                }
            });
        } catch (e) {
            console.warn('[calendario] seguidos:', e);
        }
        return _followed;
    }

    // Misma card "portada con riel" que el resto de la app (.wcard): la hora
    // de emisión va en la píldora y la estrella de "lo seguís" en la esquina.
    function cardHtml(ep) {
        var d = new Date(ep.airingAt * 1000);
        var mine = _followed && _followed.has(String(ep.id));
        var poster = ep.img
            ? '<img class="cal-poster-img" loading="lazy" src="' + esc(ep.img) + '" alt="' + esc(ep.title) +
              '" data-title="' + esc(ep.title) + '" data-fallback-catalog="1">'
            : '<span class="wcard-empty" aria-hidden="true">' + esc(String(ep.title || '?').charAt(0)) + '</span>';

        return '<a class="wcard cal-card' + (mine ? ' cal-card--mine' : '') + '" href="detalle.html?cat=anime&id=' + encodeURIComponent(ep.id) + '">' +
                    '<span class="wcard-media">' + poster +
                        '<span class="wcard-pill cal-time">' + hhmm(d) + '</span>' +
                        (mine ? '<span class="wcard-corner cal-mine-badge" aria-label="Lo seguís">★</span>' : '') +
                    '</span>' +
                    '<span class="wcard-text">' +
                        '<span class="wcard-title">' + esc(ep.title) + '</span>' +
                        '<span class="wcard-meta">Episodio ' + (ep.episode || '?') + '</span>' +
                    '</span>' +
                '</a>';
    }

    // Agrupa por día local, en orden de emisión.
    function groupByDay(lista, today) {
        var groups = [];
        var byKey = {};
        lista.forEach(function (ep) {
            var d = new Date(ep.airingAt * 1000);
            var k = dayKey(d);
            if (!byKey[k]) {
                byKey[k] = { key: k, at: d.getTime(), label: dayLabel(d, today), items: [] };
                groups.push(byKey[k]);
            }
            byKey[k].items.push(ep);
        });
        groups.sort(function (a, b) { return a.at - b.at; });
        return { list: groups, byKey: byKey };
    }

    // Tira con los días de la semana: cada chip lleva al día y muestra
    // cuántos estrenos tiene. Los días sin estrenos quedan apagados. La API
    // trae 7×24 h desde ahora, así que puede asomar un octavo día.
    function weekStripHtml(byKey, today) {
        var html = '';
        for (var i = 0; i < 8; i++) {
            var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
            var k = dayKey(d);
            var n = byKey[k] ? byKey[k].items.length : 0;
            if (i === 7 && !n) break;
            var corto = i === 0 ? 'Hoy' : DIAS[d.getDay()].slice(0, 3);
            html += '<a class="cal-chip' + (i === 0 ? ' cal-chip--today' : '') + (n ? '' : ' is-empty') + '"' +
                        (n ? ' href="#cal-' + k + '"' : ' aria-disabled="true"') + '>' +
                        '<span class="cal-chip-day">' + esc(corto) + '</span>' +
                        '<span class="cal-chip-num">' + d.getDate() + '</span>' +
                        '<span class="cal-chip-count">' + (n ? n + ' ep.' : '—') + '</span>' +
                    '</a>';
        }
        return '<nav class="cal-week" aria-label="Días de la semana">' + html + '</nav>';
    }

    function render() {
        var host = document.getElementById('calendarBody');
        if (!host) return;

        var lista = _onlyMine && _followed
            ? _all.filter(function (ep) { return _followed.has(String(ep.id)); })
            : _all;

        var today = new Date();
        var groups = groupByDay(lista, today);
        var strip = weekStripHtml(groups.byKey, today);

        if (!lista.length) {
            host.innerHTML = strip + '<p class="cal-empty">' +
                esc(_onlyMine ? 'No seguís ningún anime en emisión esta semana.' : 'No hay estrenos para mostrar ahora mismo.') +
                '</p>';
            return;
        }

        host.innerHTML = strip + groups.list.map(function (g) {
            var n = g.items.length;
            return '<section class="cal-day" id="cal-' + g.key + '">' +
                        '<h2 class="cal-day-title">' +
                            '<span>' + esc(g.label) + '</span>' +
                            '<span class="cal-day-count">' + n + (n === 1 ? ' estreno' : ' estrenos') + '</span>' +
                        '</h2>' +
                        '<div class="wcard-grid cal-grid">' + g.items.map(cardHtml).join('') + '</div>' +
                    '</section>';
        }).join('');
    }

    function skeleton() {
        var host = document.getElementById('calendarBody');
        if (host) host.innerHTML = '<p class="cal-loading">Cargando estrenos…</p>';
    }

    async function load() {
        skeleton();
        if (typeof window.getWeeklyAiringSchedule !== 'function') {
            var host = document.getElementById('calendarBody');
            if (host) host.innerHTML = '<p class="cal-empty">No se pudo cargar el calendario.</p>';
            return;
        }
        try {
            var res = await Promise.all([window.getWeeklyAiringSchedule(7), loadFollowed()]);
            _all = Array.isArray(res[0]) ? res[0] : [];
        } catch (e) {
            console.warn('[calendario] carga:', e);
            _all = [];
        }
        render();
    }

    function start() {
        var chk = document.getElementById('calOnlyMine');
        if (chk) {
            chk.addEventListener('change', function () {
                _onlyMine = chk.checked;
                render();
            });
        }
        load();
        // Si la sesión resuelve después, recargamos los seguidos para el resaltado.
        window.addEventListener('supabase-auth-changed', function () {
            _followed = null;
            loadFollowed().then(render);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
