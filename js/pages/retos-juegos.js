/**
 * retos-juegos.js — Dos juegos rápidos de Retos que usan el mismo pozo que
 * "Adiviná el anime" (getQuizPool: los 150 anime más populares de AniList),
 * así que no suman pedidos a la API:
 *
 * - ¿Cuál es más popular?: dos portadas, tocás la que tiene más fans. Si
 *   acertás, esa se queda y aparece otra. Con la racha, los rivales se
 *   parecen más en popularidad.
 * - ¿De qué anime es?: la foto del protagonista y cuatro portadas.
 *
 * Los dos son sin límite, así que no dan EXP ni cuentan para misiones (se
 * podrían farmear). Tienen tres niveles y guardan el récord de cada uno en
 * este dispositivo.
 *
 * También maneja las pestañas de la página (una por juego y una para misiones).
 */
(function () {
    'use strict';

    var K_VERSUS = 'ad:versus:best';
    var K_DEQUE = 'ad:deque:best';
    var K_TAB = 'ad:retos:tab';
    var NEXT_MS = 1300;
    var LEVELS = [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']];

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno */ } }
    // Récord por nivel. El de antes de los niveles (sin sufijo) cuenta como Normal.
    function best(k, level) {
        var v = Number(lsGet(k + ':' + level)) || 0;
        return level === 'normal' ? Math.max(v, Number(lsGet(k)) || 0) : v;
    }
    function saveBest(k, level, n) { lsSet(k + ':' + level, String(n)); }
    function readLevel(k) {
        var v = lsGet(k + ':level');
        return v === 'facil' || v === 'dificil' ? v : 'normal';
    }

    function levelChips(game, current) {
        return '<div class="summary-months" role="group" aria-label="Dificultad">' + LEVELS.map(function (l) {
            return '<button type="button" class="reto-chip' + (l[0] === current ? ' is-active' : '') + '" data-' + game + '-level="' + l[0] + '">' + l[1] + '</button>';
        }).join('') + '</div>';
    }

    // Por popularidad: el pozo viene ordenado de más a menos popular.
    function byRank(from, to) { return pool.slice(from, to); }

    function ratioOf(a, b) { return Math.max(a, b) / Math.max(1, Math.min(a, b)); }

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

    function preload(src) { if (src) { var img = new Image(); img.src = src; } }

    function fans(n) { return Number(n || 0).toLocaleString('es-AR') + ' fans'; }

    var pool = [];

    // ─────────────────────────────────────────────────────────────
    // ¿Cuál es más popular?
    // ─────────────────────────────────────────────────────────────
    var vs = { level: 'normal', left: null, right: null, streak: 0, picked: null, over: false, recent: [], round: 0 };

    function vsHost() { return document.getElementById('versusBody'); }

    function vsPool() {
        return (vs.level === 'facil' ? byRank(0, 60) : pool).filter(function (m) { return m.popularity; });
    }

    // Rival para el anime que queda, según el nivel:
    // Fácil: entre los 60 más populares y con mucha diferencia (el doble o más).
    // Normal: cualquiera al principio; con racha, cada vez más parecidos.
    // Difícil: siempre con popularidad muy parecida.
    function challenger(base) {
        var avoid = {};
        vs.recent.forEach(function (id) { avoid[id] = 1; });
        avoid[base.id] = 1;
        var cands = vsPool().filter(function (m) { return !avoid[m.id]; });
        var filtered = cands;
        function byGap(desc) {
            return cands.slice().sort(function (x, y) {
                var d = ratioOf(x.popularity, base.popularity) - ratioOf(y.popularity, base.popularity);
                return desc ? -d : d;
            });
        }
        if (vs.level === 'facil') {
            filtered = cands.filter(function (m) { return ratioOf(m.popularity, base.popularity) >= 2; });
            // Si ninguno llega al doble, los 8 con más diferencia.
            if (filtered.length < 3) filtered = byGap(true).slice(0, 8);
        } else if (vs.level === 'dificil') {
            filtered = cands.filter(function (m) { return ratioOf(m.popularity, base.popularity) < 1.3; });
            if (filtered.length < 3) filtered = byGap(false).slice(0, 5);
        } else if (vs.streak >= 4) {
            var ratio = vs.streak >= 10 ? 1.25 : 1.6;
            filtered = cands.filter(function (m) { return ratioOf(m.popularity, base.popularity) < ratio; });
        }
        if (filtered.length >= 3) cands = filtered;
        var m = pickRandom(cands);
        vs.recent.push(m.id);
        if (vs.recent.length > 20) vs.recent.shift();
        return m;
    }

    function vsStart() {
        vs.streak = 0;
        vs.over = false;
        vs.picked = null;
        vs.recent = [];
        vs.round += 1;
        vs.left = pickRandom(vsPool());
        vs.recent.push(vs.left.id);
        vs.right = challenger(vs.left);
        vsRender();
    }

    function vsCard(m, side, showNum) {
        var picked = vs.picked === side;
        var other = side === 'left' ? vs.right : vs.left;
        var cls = 'game-pick';
        if (vs.picked) {
            var isMore = m.popularity >= other.popularity;
            cls += isMore ? ' is-ok' : ' is-bad';
            if (picked) cls += ' is-picked';
        }
        return '<button type="button" class="' + cls + '" data-vs="' + side + '"' + (vs.picked ? ' disabled' : '') +
            ' aria-label="' + esc(m.title) + '">' +
                '<span class="game-cover"><img src="' + esc(m.image) + '" alt="" draggable="false"></span>' +
                '<span class="game-title">' + esc(m.title) + '</span>' +
                '<span class="game-num">' + (showNum ? fans(m.popularity) : '¿?') + '</span>' +
            '</button>';
    }

    function vsRender() {
        var host = vsHost();
        if (!host) return;
        var rec = Math.max(best(K_VERSUS, vs.level), vs.streak);
        var html = '<div class="game-top">' +
                levelChips('vs', vs.level) +
                '<span class="quiz-combo">Racha ' + vs.streak + ' · Récord ' + rec + '</span>' +
            '</div>' +
            '<p class="quiz-intro game-help">Tocá el anime que tiene más fans en AniList.</p>' +
            '<div class="versus-grid">' +
                vsCard(vs.left, 'left', true) +
                '<span class="versus-vs" aria-hidden="true">VS</span>' +
                vsCard(vs.right, 'right', !!vs.picked) +
            '</div>';
        if (vs.over) {
            html += '<div class="quiz-end">' +
                '<p class="quiz-result is-lost">' + (vs.newRecord
                    ? '¡Nuevo récord! ' + vs.streak + ' seguidos.'
                    : 'Fin del juego. Hiciste ' + vs.streak + (vs.streak === 1 ? ' acierto.' : ' aciertos.')) + '</p>' +
                '<div class="quiz-actions"><button type="button" class="reto-btn" id="vsAgain">Jugar de nuevo</button></div>' +
            '</div>';
        }
        host.innerHTML = html;

        host.querySelectorAll('[data-vs]').forEach(function (b) {
            b.addEventListener('click', function () { vsPick(b.getAttribute('data-vs')); });
        });
        host.querySelectorAll('[data-vs-level]').forEach(function (b) {
            b.addEventListener('click', function () {
                var lv = b.getAttribute('data-vs-level');
                if (lv === vs.level) return;
                vs.level = lv;
                lsSet(K_VERSUS + ':level', lv);
                vsStart();
            });
        });
        var again = document.getElementById('vsAgain');
        if (again) again.addEventListener('click', vsStart);
    }

    function vsPick(side) {
        if (vs.picked || vs.over) return;
        vs.picked = side;
        var mine = side === 'left' ? vs.left : vs.right;
        var other = side === 'left' ? vs.right : vs.left;
        var ok = mine.popularity >= other.popularity;
        if (ok) {
            vs.streak += 1;
            var winner = mine;
            var next = challenger(winner);
            var round = vs.round;
            preload(next.image);
            vsRender();
            setTimeout(function () {
                // Si mientras tanto cambió el nivel o empezó otra partida, no se toca nada.
                if (round !== vs.round) return;
                // El que acertaste queda a la izquierda, con sus fans a la vista.
                vs.left = winner;
                vs.right = next;
                vs.picked = null;
                vsRender();
            }, NEXT_MS);
        } else {
            vs.over = true;
            vs.newRecord = vs.streak > best(K_VERSUS, vs.level);
            if (vs.newRecord) saveBest(K_VERSUS, vs.level, vs.streak);
            vsRender();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ¿De qué anime es?
    // ─────────────────────────────────────────────────────────────
    var dq = { level: 'normal', answer: null, options: [], streak: 0, picked: null, over: false, recent: [], round: 0 };

    function dqHost() { return document.getElementById('dequeBody'); }

    function hasChar(m) { return !!m.mainImage; }
    function dqPool() { return pool.filter(hasChar); }

    // Fácil: personajes de los 50 más populares. Normal: de los 150.
    // Difícil: de los menos famosos (51 a 150) y las otras portadas comparten
    // algún género con la respuesta, así no se descartan a simple vista.
    function dqAnswers() {
        var list = (dq.level === 'facil' ? byRank(0, 50) : dq.level === 'dificil' ? byRank(50, 150) : pool).filter(hasChar);
        return list.length >= 10 ? list : dqPool();
    }

    function dqDistractors(answer) {
        var others = pool.filter(function (m) { return m.id !== answer.id; });
        if (dq.level === 'dificil') {
            var genres = answer.genres || [];
            var close = others.filter(function (m) {
                return (m.genres || []).some(function (g) { return genres.indexOf(g) !== -1; });
            });
            if (close.length >= 3) others = close;
        }
        return shuffle(others).slice(0, 3);
    }

    function dqRound() {
        var withChar = dqAnswers();
        var avoid = {};
        dq.recent.forEach(function (id) { avoid[id] = 1; });
        var fresh = withChar.filter(function (m) { return !avoid[m.id]; });
        dq.answer = pickRandom(fresh.length ? fresh : withChar);
        dq.recent.push(dq.answer.id);
        if (dq.recent.length > 30) dq.recent.shift();
        dq.options = shuffle([dq.answer].concat(dqDistractors(dq.answer)));
        dq.picked = null;
        dqRender();
    }

    function dqStart() {
        dq.streak = 0;
        dq.over = false;
        dq.recent = [];
        dq.round += 1;
        dqRound();
    }

    function dqRender() {
        var host = dqHost();
        if (!host) return;
        var rec = Math.max(best(K_DEQUE, dq.level), dq.streak);
        var html = '<div class="game-top">' +
                levelChips('dq', dq.level) +
                '<span class="quiz-combo">Racha ' + dq.streak + ' · Récord ' + rec + '</span>' +
            '</div>' +
            '<p class="quiz-intro game-help">¿De qué anime es este personaje?</p>' +
            '<div class="deque-grid">' +
                '<div class="deque-char"><img src="' + esc(dq.answer.mainImage) + '" alt="Personaje misterioso" draggable="false"></div>' +
                '<div class="deque-options">' + dq.options.map(function (m, i) {
                    var cls = 'game-pick';
                    if (dq.picked != null) {
                        if (m.id === dq.answer.id) cls += ' is-ok';
                        else if (i === dq.picked) cls += ' is-bad';
                        if (i === dq.picked) cls += ' is-picked';
                    }
                    return '<button type="button" class="' + cls + '" data-dq="' + i + '"' + (dq.picked != null ? ' disabled' : '') +
                        ' aria-label="' + esc(m.title) + '">' +
                            '<span class="game-cover"><img src="' + esc(m.image) + '" alt="" draggable="false"></span>' +
                            '<span class="game-title">' + esc(m.title) + '</span>' +
                        '</button>';
                }).join('') + '</div>' +
            '</div>';
        if (dq.over) {
            html += '<div class="quiz-end">' +
                '<p class="quiz-result is-lost">' + (dq.newRecord
                    ? '¡Nuevo récord! ' + dq.streak + ' seguidos.'
                    : 'Era de ' + esc(dq.answer.title) + '. Hiciste ' + dq.streak + (dq.streak === 1 ? ' acierto.' : ' aciertos.')) + '</p>' +
                '<div class="quiz-actions"><button type="button" class="reto-btn" id="dqAgain">Jugar de nuevo</button></div>' +
            '</div>';
        }
        host.innerHTML = html;

        host.querySelectorAll('[data-dq]').forEach(function (b) {
            b.addEventListener('click', function () { dqPick(Number(b.getAttribute('data-dq'))); });
        });
        host.querySelectorAll('[data-dq-level]').forEach(function (b) {
            b.addEventListener('click', function () {
                var lv = b.getAttribute('data-dq-level');
                if (lv === dq.level) return;
                dq.level = lv;
                lsSet(K_DEQUE + ':level', lv);
                dqStart();
            });
        });
        var again = document.getElementById('dqAgain');
        if (again) again.addEventListener('click', dqStart);
    }

    function dqPick(i) {
        if (dq.picked != null || dq.over) return;
        dq.picked = i;
        if (dq.options[i].id === dq.answer.id) {
            dq.streak += 1;
            var round = dq.round;
            dqRender();
            setTimeout(function () { if (round === dq.round) dqRound(); }, NEXT_MS);
        } else {
            dq.over = true;
            dq.newRecord = dq.streak > best(K_DEQUE, dq.level);
            if (dq.newRecord) saveBest(K_DEQUE, dq.level, dq.streak);
            dqRender();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Pestañas
    // ─────────────────────────────────────────────────────────────
    // Se elige por #hash (retos.html#misiones) o la última que usaste. Las
    // secciones de otra pestaña se ocultan con una clase y no con [hidden],
    // que retos.js ya usa para la tarjeta de avisos.
    function tabs() { return Array.prototype.slice.call(document.querySelectorAll('[data-tab]')); }

    function showTab(name, focus) {
        var list = tabs().filter(function (t) { return !t.hidden; });
        if (!list.length) return;
        if (!list.some(function (t) { return t.getAttribute('data-tab') === name; })) name = list[0].getAttribute('data-tab');
        list.forEach(function (t) {
            var on = t.getAttribute('data-tab') === name;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            t.tabIndex = on ? 0 : -1;
            if (on && focus) t.focus();
        });
        document.querySelectorAll('[data-tab-panel]').forEach(function (p) {
            p.classList.toggle('is-off-tab', p.getAttribute('data-tab-panel') !== name);
        });
        lsSet(K_TAB, name);
        // En el celular la fila se desliza: que la pestaña elegida quede a la vista.
        var row = document.querySelector('.retos-tabs');
        var active = row && row.querySelector('.is-active');
        if (active && (active.offsetLeft < row.scrollLeft || active.offsetLeft + active.offsetWidth > row.scrollLeft + row.clientWidth)) {
            row.scrollLeft = active.offsetLeft - row.offsetLeft - 8;
        }
    }

    function initTabs() {
        var list = tabs();
        if (!list.length) return;
        list.forEach(function (t, i) {
            t.addEventListener('click', function () {
                var name = t.getAttribute('data-tab');
                showTab(name);
                if (history.replaceState) history.replaceState(null, '', '#' + name);
            });
            // Flechas para moverse entre pestañas, como pide el patrón de ARIA.
            t.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                var vis = tabs().filter(function (x) { return !x.hidden; });
                var j = vis.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
                var next = vis[(j + vis.length) % vis.length];
                showTab(next.getAttribute('data-tab'), true);
                e.preventDefault();
            });
        });
        var hash = (location.hash || '').slice(1);
        showTab(hash || lsGet(K_TAB) || 'anime');
        window.addEventListener('hashchange', function () { showTab(location.hash.slice(1)); });
    }

    // ─────────────────────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────────────────────
    async function start() {
        initTabs();
        var vh = vsHost(), dh = dqHost();
        if (!vh && !dh) return;
        vs.level = readLevel(K_VERSUS);
        dq.level = readLevel(K_DEQUE);
        if (typeof window.getQuizPool !== 'function') return;
        try {
            pool = (await window.getQuizPool()) || [];
        } catch (e) {
            pool = [];
        }
        var fail = '<p class="reto-loading">No pudimos cargar el juego. Probá de nuevo en un rato.</p>';
        if (vh) {
            if (pool.filter(function (m) { return m.popularity; }).length >= 10) vsStart();
            else vh.innerHTML = fail;
        }
        if (dh) {
            // Sin fotos de protagonistas (AniList no las mandó) el juego no tiene sentido.
            if (dqPool().length >= 10 && pool.length >= 4) dqStart();
            else {
                dh.closest('.reto-card').hidden = true;
                var tab = document.querySelector('[data-tab="deque"]');
                if (tab) {
                    tab.hidden = true;
                    if (tab.classList.contains('is-active')) showTab('anime');
                }
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
