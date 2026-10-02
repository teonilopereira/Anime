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
 * podrían farmear). Solo guardan el récord en este dispositivo.
 */
(function () {
    'use strict';

    var K_VERSUS = 'ad:versus:best';
    var K_DEQUE = 'ad:deque:best';
    var NEXT_MS = 1300;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno */ } }
    function best(k) { return Number(lsGet(k)) || 0; }

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
    var vs = { left: null, right: null, streak: 0, picked: null, over: false, recent: [] };

    function vsHost() { return document.getElementById('versusBody'); }

    // Rival para el anime que queda: al principio cualquiera; con racha, uno
    // cada vez más parecido en popularidad para que no sea obvio.
    function challenger(base) {
        var avoid = {};
        vs.recent.forEach(function (id) { avoid[id] = 1; });
        avoid[base.id] = 1;
        var cands = pool.filter(function (m) { return !avoid[m.id] && m.popularity; });
        if (vs.streak >= 4) {
            var ratio = vs.streak >= 10 ? 1.25 : 1.6;
            var near = cands.filter(function (m) {
                var r = m.popularity / base.popularity;
                return r < ratio && r > 1 / ratio;
            });
            if (near.length >= 3) cands = near;
        }
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
        vs.left = pickRandom(pool.filter(function (m) { return m.popularity; }));
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
        var rec = Math.max(best(K_VERSUS), vs.streak);
        var html = '<div class="game-top">' +
                '<p class="quiz-intro">Tocá el anime que tiene más fans en AniList.</p>' +
                '<span class="quiz-combo">Racha ' + vs.streak + ' · Récord ' + rec + '</span>' +
            '</div>' +
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
            preload(next.image);
            vsRender();
            setTimeout(function () {
                // El que acertaste queda a la izquierda, con sus fans a la vista.
                vs.left = winner;
                vs.right = next;
                vs.picked = null;
                vsRender();
            }, NEXT_MS);
        } else {
            vs.over = true;
            vs.newRecord = vs.streak > best(K_VERSUS);
            if (vs.newRecord) lsSet(K_VERSUS, String(vs.streak));
            vsRender();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ¿De qué anime es?
    // ─────────────────────────────────────────────────────────────
    var dq = { answer: null, options: [], streak: 0, picked: null, over: false, recent: [] };

    function dqHost() { return document.getElementById('dequeBody'); }

    function dqPool() { return pool.filter(function (m) { return m.mainImage; }); }

    function dqRound() {
        var withChar = dqPool();
        var avoid = {};
        dq.recent.forEach(function (id) { avoid[id] = 1; });
        var fresh = withChar.filter(function (m) { return !avoid[m.id]; });
        dq.answer = pickRandom(fresh.length ? fresh : withChar);
        dq.recent.push(dq.answer.id);
        if (dq.recent.length > 30) dq.recent.shift();
        var others = shuffle(pool.filter(function (m) { return m.id !== dq.answer.id; })).slice(0, 3);
        dq.options = shuffle([dq.answer].concat(others));
        dq.picked = null;
        dqRender();
    }

    function dqStart() {
        dq.streak = 0;
        dq.over = false;
        dqRound();
    }

    function dqRender() {
        var host = dqHost();
        if (!host) return;
        var rec = Math.max(best(K_DEQUE), dq.streak);
        var html = '<div class="game-top">' +
                '<p class="quiz-intro">¿De qué anime es este personaje?</p>' +
                '<span class="quiz-combo">Racha ' + dq.streak + ' · Récord ' + rec + '</span>' +
            '</div>' +
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
        var again = document.getElementById('dqAgain');
        if (again) again.addEventListener('click', dqStart);
    }

    function dqPick(i) {
        if (dq.picked != null || dq.over) return;
        dq.picked = i;
        if (dq.options[i].id === dq.answer.id) {
            dq.streak += 1;
            dqRender();
            setTimeout(dqRound, NEXT_MS);
        } else {
            dq.over = true;
            dq.newRecord = dq.streak > best(K_DEQUE);
            if (dq.newRecord) lsSet(K_DEQUE, String(dq.streak));
            dqRender();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────────────────────
    async function start() {
        var vh = vsHost(), dh = dqHost();
        if (!vh && !dh) return;
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
            else dh.closest('.reto-card').hidden = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
