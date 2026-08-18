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

    var _all = [];        // estrenos de anime crudos
    var _followed = null; // Set de ids seguidos (lazy)
    var _onlyMine = false;
    var _tab = 'anime';   // 'anime' | 'manga'
    var _manga = null;    // lanzamientos de manga (lazy)

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

    function cardHtml(ep) {
        var d = new Date(ep.airingAt * 1000);
        var mine = _followed && _followed.has(String(ep.id));
        var poster = ep.img
            ? '<img class="cal-poster-img" loading="lazy" src="' + esc(ep.img) + '" alt="' + esc(ep.title) +
              '" data-title="' + esc(ep.title) + '" data-fallback-catalog="1">'
            : '<span class="cal-poster-noimg" aria-hidden="true">🎞️</span>';

        return '<a class="cal-card' + (mine ? ' cal-card--mine' : '') + '" href="detalle.html?cat=anime&id=' + encodeURIComponent(ep.id) + '">' +
                    '<span class="cal-poster">' + poster + '</span>' +
                    '<span class="cal-info">' +
                        '<span class="cal-time">' + hhmm(d) + '</span>' +
                        '<span class="cal-title">' + esc(ep.title) + '</span>' +
                        '<span class="cal-ep">Episodio ' + (ep.episode || '?') + '</span>' +
                    '</span>' +
                    (mine ? '<span class="cal-mine-badge" aria-label="Lo seguís">★</span>' : '') +
                '</a>';
    }

    // ── Manga: tarjeta de un lanzamiento de capítulo ──
    function mangaCardHtml(r) {
        var poster = r.cover
            ? '<img class="cal-poster-img" loading="lazy" src="' + esc(r.cover) + '" alt="' + esc(r.title) +
              '" data-title="' + esc(r.title) + '" data-fallback-catalog="1">'
            : '<span class="cal-poster-noimg" aria-hidden="true">📖</span>';
        var capLabel = r.chapter ? ('Cap. ' + r.chapter) : (r.volume ? ('Vol. ' + r.volume) : 'Nuevo');
        var grupo = r.group ? '<span class="cal-ep">' + esc(r.group) + '</span>' : '';
        return '<a class="cal-card" href="detalle.html?cat=manga&id=' + encodeURIComponent(r.mangaId) + '">' +
                    '<span class="cal-poster">' + poster + '</span>' +
                    '<span class="cal-info">' +
                        '<span class="cal-time">' + esc(capLabel) + '</span>' +
                        '<span class="cal-title">' + esc(r.title) + '</span>' +
                        grupo +
                    '</span>' +
                '</a>';
    }

    function renderManga() {
        var host = document.getElementById('calendarBody');
        if (!host) return;
        if (_manga === null) {
            host.innerHTML = '<p class="cal-loading">Cargando lanzamientos…</p>';
            return;
        }
        if (!_manga.length) {
            host.innerHTML = '<p class="cal-empty">No hay lanzamientos de manga para mostrar ahora mismo.</p>';
            return;
        }
        var today = new Date();
        var groups = [];
        var byKey = {};
        _manga.forEach(function (r) {
            var d = r.readableAt ? new Date(r.readableAt) : today;
            if (isNaN(d.getTime())) d = today;
            var k = dayKey(d);
            if (!byKey[k]) {
                byKey[k] = { label: dayLabel(d, today), items: [] };
                groups.push({ key: k, at: d.getTime(), group: byKey[k] });
            }
            byKey[k].group.items.push(r);
        });
        groups.sort(function (a, b) { return b.at - a.at; }); // más recientes primero
        host.innerHTML = groups.map(function (g) {
            return '<section class="cal-day">' +
                        '<h2 class="cal-day-title">' + esc(g.group.label) + '</h2>' +
                        '<div class="cal-grid">' + g.group.items.map(mangaCardHtml).join('') + '</div>' +
                    '</section>';
        }).join('');
    }

    async function loadManga() {
        if (_manga !== null) { renderManga(); return; }
        renderManga(); // muestra "Cargando…"
        if (typeof window.getMangaDexRecentReleases !== 'function') {
            _manga = [];
            renderManga();
            return;
        }
        var lang = 'es';
        try { lang = (localStorage.getItem('pref:lang') || 'es').slice(0, 2); } catch (_) {}
        try {
            _manga = await window.getMangaDexRecentReleases(lang, 60);
            if (!_manga.length && lang !== 'en') _manga = await window.getMangaDexRecentReleases('en', 60);
        } catch (e) {
            console.warn('[calendario] manga:', e);
            _manga = [];
        }
        renderManga();
    }

    function render() {
        if (_tab === 'manga') { renderManga(); return; }
        var host = document.getElementById('calendarBody');
        if (!host) return;

        var lista = _onlyMine && _followed
            ? _all.filter(function (ep) { return _followed.has(String(ep.id)); })
            : _all;

        if (!lista.length) {
            host.innerHTML = '<p class="cal-empty">' +
                esc(_onlyMine ? 'No seguís ningún anime en emisión esta semana.' : 'No hay estrenos para mostrar ahora mismo.') +
                '</p>';
            return;
        }

        var today = new Date();
        var groups = [];
        var byKey = {};
        lista.forEach(function (ep) {
            var d = new Date(ep.airingAt * 1000);
            var k = dayKey(d);
            if (!byKey[k]) {
                byKey[k] = { label: dayLabel(d, today), items: [] };
                groups.push({ key: k, at: d.getTime(), group: byKey[k] });
            }
            byKey[k].group.items.push(ep);
        });
        groups.sort(function (a, b) { return a.at - b.at; });

        host.innerHTML = groups.map(function (g) {
            return '<section class="cal-day">' +
                        '<h2 class="cal-day-title">' + esc(g.group.label) + '</h2>' +
                        '<div class="cal-grid">' + g.group.items.map(cardHtml).join('') + '</div>' +
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

        // Tabs Anime / Manga: el toolbar "Solo lo que sigo" solo aplica al de anime.
        var tabs = document.querySelectorAll('.calendar-tab');
        var animeToolbar = document.getElementById('calAnimeToolbar');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                var nuevo = tab.getAttribute('data-caltab') || 'anime';
                if (nuevo === _tab) return;
                _tab = nuevo;
                tabs.forEach(function (t) {
                    var activo = t === tab;
                    t.classList.toggle('is-active', activo);
                    t.setAttribute('aria-selected', activo ? 'true' : 'false');
                });
                if (animeToolbar) animeToolbar.style.display = (_tab === 'anime') ? '' : 'none';
                if (_tab === 'manga') loadManga();
                else render();
            });
        });

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
