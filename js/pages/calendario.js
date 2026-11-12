/**
 * calendario.js — Calendario semanal de estrenos.
 *
 * Trae getWeeklyAiringSchedule() (AniList) y agrupa los episodios por día
 * local. Los animes que el usuario sigue (fav / visto / viendo / pendiente) se
 * resaltan y pueden aislarse con el filtro "Solo lo que sigo" (se recuerda en
 * localStorage `ad:cal:onlyMine`). Arriba se resume cuántos estrenos seguidos
 * hay en la semana y cuántos faltan salir.
 *
 * Cada estreno seguido tiene un botón "Avisame" (toggle) que activa el
 * recordatorio por título de window.AppReminders (clave UserStore
 * `u:<userId>|remind:<animeId>` = '1'; ver js/core/reminders.js).
 *
 * Las cards de lo seguido muestran "faltan X de Y" cuando AniList da el
 * total de episodios (X = total − episodio que sale; ver remainingLabel).
 * Sin total no se muestra nada.
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
    var ONLY_MINE_KEY = 'ad:cal:onlyMine';

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno / privado */ } }

    function currentUserId() {
        var c = window.AppSupabase;
        if (!c || typeof c.isSignedIn !== 'function' || !c.isSignedIn()) return null;
        var u = typeof c.getCurrentUserSync === 'function' ? c.getCurrentUserSync() : null;
        return u && u.id ? u.id : null;
    }

    function reminders() {
        var r = window.AppReminders;
        return r && typeof r.toggleTitleReminder === 'function' ? r : null;
    }

    // Misma regla que AppReminders.isFollowedState; copia local por si el
    // bundle todavía no la trae.
    function isFollowed(st) {
        var r = window.AppReminders;
        if (r && typeof r.isFollowedState === 'function') return r.isFollowedState(st);
        return !!(st && (st.fav || st.viewed || st.watch_status === 'viendo' || st.watch_status === 'pendiente'));
    }

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

    // Anime que el usuario sigue: fav, visto o en estado "viendo" / "pendiente".
    async function loadFollowed() {
        if (_followed) return _followed;
        _followed = new Set();
        var client = window.AppSupabase;
        if (!client || !client.isSignedIn || !client.isSignedIn() || !client.loadItemStates) return _followed;
        try {
            var states = await client.loadItemStates('anime');
            (Array.isArray(states) ? states : []).forEach(function (st) {
                if (isFollowed(st)) {
                    _followed.add(String(st.item_id));
                }
            });
        } catch (e) {
            console.warn('[calendario] seguidos:', e);
        }
        return _followed;
    }

    // Episodios que quedan después del que sale: { faltan, total } o null si
    // AniList no da el total (o el dato no cierra, p. ej. episodio > total).
    function remaining(ep) {
        var total = Number(ep && ep.totalEpisodes);
        var n = Number(ep && ep.episode);
        if (!(total > 0) || !(n > 0) || n > total) return null;
        return { faltan: total - n, total: total };
    }

    // Texto corto para la card: "Faltan 4 de 12" o "Episodio final".
    function remainingLabel(ep) {
        var r = remaining(ep);
        if (!r) return '';
        return r.faltan === 0 ? 'Episodio final' : 'Faltan ' + r.faltan + ' de ' + r.total;
    }

    // Botón "Avisame" (toggle, aria-pressed) de un estreno seguido. Solo con
    // sesión y si AppReminders ya expone los recordatorios por título.
    function remindButtonHtml(ep) {
        var r = reminders();
        var uid = currentUserId();
        if (!r || !uid) return '';
        var on = r.isTitleReminder(uid, ep.id);
        return '<button type="button" class="cal-remind' + (on ? ' is-on' : '') + '"' +
                    ' data-remind-id="' + esc(ep.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
                    ' aria-label="' + esc('Avisame cuando salga ' + ep.title) + '">' +
                    (on ? '✓ Te aviso' : '🔔 Avisame') +
                '</button>';
    }

    // Misma card "portada con riel" que el resto de la app (.wcard): la hora
    // de emisión va en la píldora y la estrella de "lo seguís" en la esquina.
    function cardHtml(ep) {
        var d = new Date(ep.airingAt * 1000);
        var mine = _followed && _followed.has(String(ep.id));
        var left = mine ? remainingLabel(ep) : '';
        var poster = ep.img
            ? '<img class="cal-poster-img" loading="lazy" src="' + esc(ep.img) + '" alt="' + esc(ep.title) +
              '" data-title="' + esc(ep.title) + '" data-fallback-catalog="1">'
            : '<span class="wcard-empty" aria-hidden="true">' + esc(String(ep.title || '?').charAt(0)) + '</span>';

        return '<div class="cal-item">' +
                '<a class="wcard cal-card' + (mine ? ' cal-card--mine' : '') + '" href="detalle.html?cat=anime&id=' + encodeURIComponent(ep.id) + '">' +
                    '<span class="wcard-media">' + poster +
                        '<span class="wcard-pill cal-time">' + hhmm(d) + '</span>' +
                        (mine ? '<span class="wcard-corner cal-mine-badge" aria-label="Lo seguís">★</span>' : '') +
                    '</span>' +
                    '<span class="wcard-text">' +
                        '<span class="wcard-title">' + esc(ep.title) + '</span>' +
                        '<span class="wcard-meta">Episodio ' + (ep.episode || '?') + '</span>' +
                        (left ? '<span class="wcard-meta cal-left">' + esc(left) + '</span>' : '') +
                    '</span>' +
                '</a>' +
                (mine ? remindButtonHtml(ep) : '') +
               '</div>';
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

    // Resumen de lo seguido: cuántos estrenos hay en la semana y cuántos
    // faltan salir; si alguno emite su episodio final, cuántos terminan.
    // Solo si hay algo seguido (nada de mensajes genéricos).
    function summaryHtml(now) {
        if (!_followed || !_followed.size) return '';
        var mine = filterMine(_all);
        if (!mine.length) return '';
        var s = summarize(mine, now);
        return '<p class="cal-summary" role="status">' +
                    '<strong>' + s.total + '</strong> ' + (s.total === 1 ? 'estreno' : 'estrenos') +
                    ' de lo que seguís esta semana · ' +
                    '<strong>' + s.porSalir + '</strong> ' + (s.porSalir === 1 ? 'episodio por salir' : 'episodios por salir') +
                    (s.finales
                        ? ' · <strong>' + s.finales + '</strong> ' + (s.finales === 1 ? 'termina' : 'terminan')
                        : '') +
                '</p>';
    }

    // Cuentas del resumen (puro). `finales`: títulos distintos cuyo episodio
    // final todavía no salió en la ventana.
    function summarize(list, now) {
        var futuros = list.filter(function (ep) { return ep.airingAt * 1000 > now; });
        var fin = {};
        futuros.forEach(function (ep) {
            var r = remaining(ep);
            if (r && r.faltan === 0) fin[String(ep.id)] = 1;
        });
        return { total: list.length, porSalir: futuros.length, finales: Object.keys(fin).length };
    }

    function filterMine(list) {
        var r = window.AppReminders;
        if (r && typeof r.filterFollowed === 'function') return r.filterFollowed(list, _followed);
        return list.filter(function (ep) { return _followed && _followed.has(String(ep.id)); });
    }

    function render() {
        var host = document.getElementById('calendarBody');
        if (!host) return;

        var lista = _onlyMine ? filterMine(_all) : _all;

        var today = new Date();
        var groups = groupByDay(lista, today);
        var strip = summaryHtml(today.getTime()) + weekStripHtml(groups.byKey, today);

        if (!lista.length) {
            var vacio = 'No hay estrenos para mostrar ahora mismo.';
            if (_onlyMine) {
                vacio = currentUserId()
                    ? 'No seguís ningún anime en emisión esta semana.'
                    : 'Iniciá sesión para ver los estrenos de lo que seguís.';
            }
            host.innerHTML = strip + '<p class="cal-empty">' + esc(vacio) + '</p>';
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

    function onRemindClick(ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.cal-remind') : null;
        if (!btn) return;
        ev.preventDefault();
        var r = reminders();
        var uid = currentUserId();
        if (!r || !uid) return;
        var id = btn.getAttribute('data-remind-id');
        var on = r.toggleTitleReminder(uid, id);
        var ep = _all.find(function (x) { return String(x.id) === String(id); });
        var title = ep ? ep.title : '';
        // Re-render para que las cards del mismo anime en otros días queden
        // en sincronía; después devolvemos el foco al botón tocado.
        render();
        var again = document.querySelector('.cal-remind[data-remind-id="' + String(id).replace(/"/g, '') + '"]');
        if (again) again.focus();
        if (window.Toast && typeof window.Toast.info === 'function') {
            window.Toast.info(on ? 'Te avisamos cuando salga ' + title + '.' : 'Listo, no te avisamos de ' + title + '.');
        }
    }

    function start() {
        var chk = document.getElementById('calOnlyMine');
        if (chk) {
            _onlyMine = lsGet(ONLY_MINE_KEY) === '1';
            chk.checked = _onlyMine;
            chk.addEventListener('change', function () {
                _onlyMine = chk.checked;
                lsSet(ONLY_MINE_KEY, _onlyMine ? '1' : '0');
                render();
            });
        }
        var host = document.getElementById('calendarBody');
        if (host) host.addEventListener('click', onRemindClick);
        load();
        // Si la sesión resuelve después, recargamos los seguidos para el resaltado.
        window.addEventListener('supabase-auth-changed', function () {
            _followed = null;
            loadFollowed().then(render);
        });
    }

    // Solo para tests (lógica pura, sin red ni DOM).
    window.AppCalendario = Object.freeze({
        _remaining: remaining,
        _remainingLabel: remainingLabel,
        _summarize: summarize
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
