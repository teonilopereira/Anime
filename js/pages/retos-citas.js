/**
 * retos-citas.js — "¿Quién lo dijo?": una cita de anime y cuatro portadas.
 *
 * Las citas vienen de data/quotes.json (armado con tools/fetch-quotes.js a
 * partir de Animechan), no de la API en vivo: Animechan tiene un tope bajo de
 * pedidos y un juego sin límite lo agotaría enseguida. Las portadas salen del
 * mismo pozo que los otros juegos (getQuizPool), así que no suma pedidos a
 * AniList. Solo se juegan las citas cuyo anime está en ese pozo.
 *
 * Sin archivo de citas (o con muy pocas) la pestaña se oculta sola.
 * Es sin límite, así que no da EXP ni cuenta para misiones. Tiene tres niveles
 * y guarda el récord de cada uno en este dispositivo.
 */
(function () {
    'use strict';

    var K_BEST = 'ad:citas:best';
    var NEXT_MS = 1500;
    var MIN_QUOTES = 10;
    var LEVELS = [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']];
    var LEVEL_LABEL = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno */ } }
    function best(level) { return Number(lsGet(K_BEST + ':' + level)) || 0; }
    function readLevel() {
        var v = lsGet(K_BEST + ':level');
        return v === 'facil' || v === 'dificil' ? v : 'normal';
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }
    function shuffle(list) {
        var a = list.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }
    function finePointer() {
        return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    }
    function kbd(k) { return finePointer() ? '<kbd class="game-kbd" aria-hidden="true">' + k + '</kbd>' : ''; }

    // "Shingeki no Kyojin: The Final Season" y "shingeki no kyojin" deben coincidir.
    function norm(s) {
        return String(s || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, ' ').trim();
    }

    // Cada anime del pozo se indexa por todos sus nombres (romaji, inglés y sinónimos).
    function indexPool(pool) {
        var idx = {};
        pool.forEach(function (m) {
            [m.title, m.english].concat(m.synonyms || []).forEach(function (n) {
                var k = norm(n);
                if (k && !idx[k]) idx[k] = m;
            });
        });
        return idx;
    }

    var pool = [];
    var quotes = [];   // [{ text, anime, char, match }]
    var g = { level: 'normal', q: null, options: [], streak: 0, picked: null, over: false, recent: [], round: 0, newRecord: false };

    function host() { return document.getElementById('citasBody'); }

    // Fácil: anime de los 50 más populares (el pozo viene ordenado por popularidad).
    // Difícil: cita corta o sin el nombre del personaje a la vista, y las otras
    // portadas comparten género con la respuesta.
    function answers() {
        var top = pool.slice(0, 50).reduce(function (o, m) { o[m.id] = 1; return o; }, {});
        var list = g.level === 'facil' ? quotes.filter(function (q) { return top[q.match.id]; }) : quotes;
        return list.length >= 5 ? list : quotes;
    }

    function distractors(answer) {
        var others = pool.filter(function (m) { return m.id !== answer.id; });
        if (g.level === 'dificil') {
            var genres = answer.genres || [];
            var close = others.filter(function (m) {
                return (m.genres || []).some(function (x) { return genres.indexOf(x) !== -1; });
            });
            if (close.length >= 3) others = close;
        }
        return shuffle(others).slice(0, 3);
    }

    function round() {
        var list = answers();
        var avoid = {};
        g.recent.forEach(function (i) { avoid[i] = 1; });
        var fresh = list.filter(function (q) { return !avoid[q.text]; });
        g.q = pickRandom(fresh.length ? fresh : list);
        g.recent.push(g.q.text);
        if (g.recent.length > 30) g.recent.shift();
        g.options = shuffle([g.q.match].concat(distractors(g.q.match)));
        g.picked = null;
        render();
    }

    function start() {
        g.streak = 0;
        g.over = false;
        g.recent = [];
        g.round += 1;
        round();
    }

    function render() {
        var h = host();
        if (!h) return;
        var rec = Math.max(best(g.level), g.streak);
        var showChar = g.picked != null || g.over;
        var html = '<div class="game-top">' +
                '<div class="summary-months" role="group" aria-label="Dificultad">' + LEVELS.map(function (l) {
                    return '<button type="button" class="reto-chip' + (l[0] === g.level ? ' is-active' : '') + '" data-citas-level="' + l[0] + '">' + l[1] + '</button>';
                }).join('') + '</div>' +
                '<span class="quiz-combo">Racha ' + g.streak + ' · Récord ' + rec + '</span>' +
            '</div>' +
            '<p class="quiz-intro game-help">¿De qué anime es esta frase? <span class="citas-lang">(las citas están en inglés)</span></p>' +
            '<blockquote class="citas-quote"><p>' + esc(g.q.text) + '</p>' +
                (showChar && g.q.char ? '<footer>— ' + esc(g.q.char) + '</footer>' : '') +
            '</blockquote>' +
            '<div class="deque-options citas-options">' + g.options.map(function (m, i) {
                var cls = 'game-pick';
                if (g.picked != null) {
                    if (m.id === g.q.match.id) cls += ' is-ok';
                    else if (i === g.picked) cls += ' is-bad';
                    if (i === g.picked) cls += ' is-picked';
                }
                return '<button type="button" class="' + cls + '" data-citas="' + i + '"' + (g.picked != null ? ' disabled' : '') +
                    ' aria-label="' + esc(m.title) + '">' +
                        '<span class="game-cover"><img src="' + esc(m.image) + '" alt="" draggable="false"></span>' +
                        '<span class="game-title">' + esc(m.title) + '</span>' +
                        (g.picked != null ? '' : kbd(i + 1)) +
                    '</button>';
            }).join('') + '</div>';
        if (g.over) {
            html += '<div class="quiz-end">' +
                '<p class="quiz-result is-lost">' + (g.newRecord
                    ? '¡Nuevo récord! ' + g.streak + ' aciertos seguidos.'
                    : 'Hiciste ' + g.streak + (g.streak === 1 ? ' acierto.' : ' aciertos.')) + ' Era de:</p>' +
                '<a class="quiz-answer" href="detalle.html?cat=anime&amp;id=' + encodeURIComponent(g.q.match.id) + '">' + esc(g.q.match.title) + '</a>' +
                '<div class="quiz-actions">' +
                    '<button type="button" class="reto-btn" id="citasAgain">Jugar de nuevo</button>' +
                    '<button type="button" class="reto-btn reto-btn--ghost" id="citasShare">Compartir racha</button>' +
                '</div></div>';
        }
        h.innerHTML = html;

        h.querySelectorAll('[data-citas]').forEach(function (b) {
            b.addEventListener('click', function () { pick(Number(b.getAttribute('data-citas'))); });
        });
        h.querySelectorAll('[data-citas-level]').forEach(function (b) {
            b.addEventListener('click', function () {
                var lv = b.getAttribute('data-citas-level');
                if (lv === g.level) return;
                g.level = lv;
                lsSet(K_BEST + ':level', lv);
                start();
            });
        });
        var again = document.getElementById('citasAgain');
        if (again) {
            again.addEventListener('click', start);
            document.getElementById('citasShare').addEventListener('click', function () {
                var t = 'Mirudoku · ¿Quién lo dijo? (' + LEVEL_LABEL[g.level] + '): ' + g.streak +
                    (g.streak === 1 ? ' acierto seguido' : ' aciertos seguidos') + ' 🔥\n' +
                    location.origin + location.pathname + '#citas';
                if (navigator.share) {
                    navigator.share({ text: t }).catch(function () { /* cancelado */ });
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(t).then(function () {
                        if (window.Toast) window.Toast.success('Resultado copiado. ¡Pegalo donde quieras!');
                    });
                }
            });
            if (finePointer()) again.focus({ preventScroll: true });
        }
    }

    function pick(i) {
        if (g.picked != null || g.over) return;
        g.picked = i;
        if (g.options[i].id === g.q.match.id) {
            g.streak += 1;
            var r = g.round;
            render();
            setTimeout(function () { if (r === g.round) round(); }, NEXT_MS);
        } else {
            g.over = true;
            var prev = best(g.level);
            g.newRecord = g.streak > 1 && g.streak > prev;
            if (g.streak > prev) lsSet(K_BEST + ':' + g.level, String(g.streak));
            render();
        }
    }

    function onScreen(h) {
        var panel = h && h.closest('[data-tab-panel]');
        return !!panel && !panel.classList.contains('is-off-tab') && !panel.hidden;
    }

    function initKeys() {
        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            var t = e.target;
            if (t && t.closest && t.closest('input, textarea, select, [contenteditable], [role="tab"]')) return;
            if (!onScreen(host()) || !g.q || g.picked != null || g.over) return;
            var n = Number(e.key);
            if (n >= 1 && n <= g.options.length) { pick(n - 1); e.preventDefault(); }
        });
    }

    // Sin citas jugables la pestaña no tiene sentido: se esconde. Si el reto
    // había quedado en ella (hash o última pestaña), se vuelve a la primera.
    function hide() {
        var card = host() && host().closest('.reto-card');
        if (card) card.hidden = true;
        var tab = document.querySelector('[data-tab="citas"]');
        if (tab) {
            tab.hidden = true;
            if (tab.classList.contains('is-active')) {
                var first = document.querySelector('[data-tab]:not([hidden])');
                if (first) first.click();
            }
        }
    }

    async function init() {
        if (!host()) return;
        g.level = readLevel();
        initKeys();
        try {
            if (typeof window.getQuizPool !== 'function') throw new Error('sin pozo');
            var res = await Promise.all([
                window.getQuizPool(),
                fetch('data/quotes.json').then(function (r) { if (!r.ok) throw new Error('sin citas'); return r.json(); })
            ]);
            pool = res[0] || [];
            var idx = indexPool(pool);
            var raw = Array.isArray(res[1]) ? res[1] : (res[1] && res[1].quotes) || [];
            quotes = raw.map(function (q) {
                return { text: String(q.quote || q.text || '').trim(), anime: q.anime, char: q.character || q.char || '', match: idx[norm(q.anime)] };
            }).filter(function (q) {
                // Con la respuesta en el texto no hay juego; y las muy largas no entran en la tarjeta.
                return q.match && q.text.length >= 20 && q.text.length <= 220 && norm(q.text).indexOf(norm(q.match.title)) === -1;
            });
        } catch (e) {
            quotes = [];
        }
        if (quotes.length < MIN_QUOTES || pool.length < 4) { hide(); return; }
        start();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
