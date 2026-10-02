/**
 * retos.js — Página de retos: "Adiviná el anime" del día, misiones y el
 * resumen del mes para compartir.
 *
 * Retención: un motivo nuevo para entrar cada día aunque no estés viendo nada
 * (el anime del día cambia a medianoche), y un resultado para compartir que
 * trae gente nueva.
 *
 * El anime del día sale de los 150 más populares de AniList (getQuizPool). Para
 * que sea el mismo para todos aunque el orden de popularidad cambie, se elige
 * por "rendezvous hashing": gana el id con el hash más alto de fecha+id. Si un
 * anime entra o sale del top, el elegido solo cambia si era justo ese.
 *
 * El reto se puede jugar sin sesión; la EXP y las misiones necesitan sesión.
 */
(function () {
    'use strict';

    var MAX_TRIES = 5;
    var BLUR_PX = [26, 17, 11, 6, 3];
    var WIN_XP = [30, 25, 20, 15, 10];
    // Día 1 del reto: sirve para numerarlos (#1, #2…) como en Wordle.
    var LAUNCH = new Date(2026, 8, 29);
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
        'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var K_QUIZ = 'ad:quiz:day:';
    var K_STATS = 'ad:quiz:stats';
    var K_FREE = 'ad:quiz:free';
    // Modo libre: rangos del pozo (ordenado por popularidad) para cada nivel.
    var LEVELS = {
        facil: { label: 'Fácil', from: 0, to: 50 },
        normal: { label: 'Normal', from: 0, to: 150 },
        dificil: { label: 'Difícil', from: 50, to: 150 }
    };

    var M = window.AppMissions;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* lleno */ } }
    function readJson(k) { try { return JSON.parse(lsGet(k)) || null; } catch (_) { return null; } }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function norm(s) {
        var t = typeof window.normalizeText === 'function' ? window.normalizeText(s) : String(s || '').toLowerCase();
        return String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function userId() {
        var uid = typeof window.getCurrentUserIdSafe === 'function' ? window.getCurrentUserIdSafe() : 'Invitado';
        return uid && uid !== 'Invitado' ? uid : null;
    }

    function icons() {
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    function today() { return M ? M.dayStr() : new Date().toISOString().slice(0, 10); }

    function quizNumber(day) {
        var p = day.split('-').map(Number);
        var d = new Date(p[0], p[1] - 1, p[2]);
        return Math.round((d - LAUNCH) / 86400000) + 1;
    }

    // Cuánto falta hasta la próxima medianoche local, en texto corto.
    function untilMidnight() {
        var now = new Date();
        var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        var mins = Math.max(1, Math.round((next - now) / 60000));
        var h = Math.floor(mins / 60);
        return h > 0 ? h + ' h ' + (mins % 60) + ' min' : mins + ' min';
    }

    function pickAnswer(pool, day) {
        var best = null, bestH = -1;
        pool.forEach(function (m) {
            var h = M.hash(day + ':' + m.id);
            if (h > bestH) { bestH = h; best = m; }
        });
        return best;
    }

    // ─────────────────────────────────────────────────────────────
    // Adiviná el anime
    // ─────────────────────────────────────────────────────────────
    // quiz guarda el reto del día; free, el modo libre (rondas sin límite, sin
    // EXP ni misiones para que no se pueda farmear). Los dos tienen answer y
    // state, y cur() devuelve el que se está mostrando.
    var quiz = { pool: [], answer: null, day: '', state: null, mode: 'daily' };
    var free = { level: 'normal', answer: null, state: null, combo: 0, seen: {} };

    function cur() { return quiz.mode === 'free' ? free : quiz; }

    function loadQuizState(day) {
        var s = readJson(K_QUIZ + day);
        return s && Array.isArray(s.guesses) ? s : { guesses: [], status: 'playing' };
    }

    function saveQuizState() {
        lsSet(K_QUIZ + quiz.day, JSON.stringify(quiz.state));
        // Solo importa el reto de hoy: se borran los de días anteriores.
        try {
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var k = localStorage.key(i);
                if (k && k.indexOf(K_QUIZ) === 0 && k !== K_QUIZ + quiz.day) localStorage.removeItem(k);
            }
        } catch (_) { /* bloqueado */ }
    }

    function readStats() {
        var s = readJson(K_STATS) || {};
        return {
            played: s.played || 0, won: s.won || 0, cur: s.cur || 0, best: s.best || 0,
            dist: Array.isArray(s.dist) && s.dist.length === MAX_TRIES ? s.dist : [0, 0, 0, 0, 0],
            last: s.last || ''
        };
    }

    function recordStats(won, tries) {
        var s = readStats();
        if (s.last === quiz.day) return s; // ya contado
        // La racha de victorias se corta si ayer no se jugó o se perdió.
        var y = new Date();
        y.setDate(y.getDate() - 1);
        var ayer = M.dayStr(y);
        s.played += 1;
        if (won) {
            s.won += 1;
            s.cur = s.last === ayer ? s.cur + 1 : 1;
            s.dist[tries - 1] += 1;
        } else {
            s.cur = 0;
        }
        s.best = Math.max(s.best, s.cur);
        s.last = quiz.day;
        lsSet(K_STATS, JSON.stringify(s));
        return s;
    }

    function hints() {
        var a = cur().answer;
        var out = [];
        var fmt = { TV: 'Serie', MOVIE: 'Película', ONA: 'ONA' }[a.format] || a.format;
        out.push({ label: 'Año y formato', value: (a.year || '¿?') + ' · ' + fmt + (a.episodes && a.format !== 'MOVIE' ? ' · ' + a.episodes + ' episodios' : '') });
        out.push({ label: 'Géneros', value: (a.genres || []).slice(0, 3).join(', ') || '¿?' });
        out.push({ label: 'Estudio', value: a.studio || 'Desconocido' });
        // Última pista: el protagonista. El título tapado queda solo si no hay foto.
        if (a.mainImage) {
            out.push({ label: 'Protagonista', img: a.mainImage });
            return out;
        }
        out.push({
            label: 'Título',
            value: String(a.title).split(/\s+/).map(function (w) {
                return w.charAt(0) + w.slice(1).replace(/[A-Za-z0-9]/g, '•');
            }).join(' ')
        });
        return out;
    }

    function tries() { return cur().state.guesses.length; }

    function renderQuiz() {
        var body = document.getElementById('quizBody');
        var triesEl = document.getElementById('quizTries');
        var numEl = document.getElementById('quizNumber');
        if (!body) return;
        var isFree = quiz.mode === 'free';
        var a = cur().answer;
        var st = cur().state;
        var over = st.status !== 'playing';
        numEl.textContent = isFree ? '' : '#' + quizNumber(quiz.day);
        triesEl.textContent = over
            ? (st.status === 'won' ? '¡Adivinado!' : 'Terminado')
            : 'Intento ' + (tries() + 1) + ' de ' + MAX_TRIES;

        var blur = over ? 0 : BLUR_PX[Math.min(tries(), BLUR_PX.length - 1)];
        var shownHints = over ? hints() : hints().slice(0, tries());

        var html = quizModes() + '<div class="quiz-grid">' +
            '<div class="quiz-cover' + (over ? ' is-revealed' : '') + '">' +
                '<img src="' + esc(a.image) + '" alt="' + (over ? esc(a.title) : 'Portada misteriosa') + '" ' +
                'style="filter: blur(' + blur + 'px)" draggable="false">' +
            '</div>' +
            '<div class="quiz-side">';

        if (shownHints.length) {
            html += '<ul class="quiz-hints">' + shownHints.map(function (h) {
                if (h.img) {
                    return '<li class="quiz-hint-img"><span>' + esc(h.label) + '</span>' +
                        '<img src="' + esc(h.img) + '" alt="Protagonista del anime" draggable="false"></li>';
                }
                return '<li><span>' + esc(h.label) + '</span><strong>' + esc(h.value) + '</strong></li>';
            }).join('') + '</ul>';
        } else {
            html += '<p class="quiz-intro">Cada intento fallido aclara la portada y suma una pista. Tenés ' + MAX_TRIES + ' intentos.</p>';
        }

        if (st.guesses.length) {
            html += '<ol class="quiz-guesses">' + st.guesses.map(function (g) {
                var ok = g.id === a.id;
                return '<li class="' + (ok ? 'is-ok' : 'is-bad') + '">' + (ok ? '✓ ' : '✗ ') +
                    esc(g.skip ? 'Salteado' : g.title) + '</li>';
            }).join('') + '</ol>';
        }

        if (!over) {
            html += '<div class="quiz-input">' +
                '<input type="text" id="quizGuess" autocomplete="off" placeholder="Escribí el nombre del anime…" aria-label="Tu respuesta" aria-controls="quizSuggest">' +
                '<ul id="quizSuggest" class="quiz-suggest" role="listbox" hidden></ul>' +
                '<button type="button" class="reto-btn reto-btn--ghost" id="quizSkip">Saltar y ver pista</button>' +
            '</div>';
        } else {
            html += isFree ? renderFreeEnd() : renderQuizEnd();
        }
        html += '</div></div>';
        body.innerHTML = html;

        wireQuizModes();
        if (!over) wireQuizInput();
        else if (isFree) wireFreeEnd();
        else wireQuizEnd();
    }

    // Selector Del día / Libre y, en libre, el nivel.
    function quizModes() {
        var isFree = quiz.mode === 'free';
        var html = '<div class="quiz-modes">' +
            '<div class="summary-months" role="group" aria-label="Modo">' +
                '<button type="button" class="reto-chip' + (isFree ? '' : ' is-active') + '" data-qmode="daily">Del día</button>' +
                '<button type="button" class="reto-chip' + (isFree ? ' is-active' : '') + '" data-qmode="free">Libre</button>' +
            '</div>';
        if (isFree) {
            html += '<div class="summary-months" role="group" aria-label="Nivel">' + Object.keys(LEVELS).map(function (k) {
                return '<button type="button" class="reto-chip' + (k === free.level ? ' is-active' : '') + '" data-qlevel="' + k + '">' + LEVELS[k].label + '</button>';
            }).join('') + '</div>' +
            '<span class="quiz-combo">Racha ' + free.combo + ' · Récord ' + freeBest(free.level) + '</span>';
        }
        return html + '</div>';
    }

    function wireQuizModes() {
        document.querySelectorAll('[data-qmode]').forEach(function (b) {
            b.addEventListener('click', function () {
                var mode = b.getAttribute('data-qmode');
                if (mode === quiz.mode) return;
                quiz.mode = mode;
                if (mode === 'free' && !free.answer) newFreeRound();
                renderQuiz();
            });
        });
        document.querySelectorAll('[data-qlevel]').forEach(function (b) {
            b.addEventListener('click', function () {
                var level = b.getAttribute('data-qlevel');
                if (level === free.level) return;
                free.level = level;
                free.combo = 0;
                free.seen = {};
                saveFree();
                newFreeRound();
                renderQuiz();
            });
        });
    }

    // ── Modo libre ──
    function readFree() {
        var f = readJson(K_FREE) || {};
        return { level: LEVELS[f.level] ? f.level : 'normal', best: f.best && typeof f.best === 'object' ? f.best : {} };
    }

    function freeBest(level) { return readFree().best[level] || 0; }

    function saveFree(best) {
        var f = readFree();
        f.level = free.level;
        if (best != null) f.best[free.level] = best;
        lsSet(K_FREE, JSON.stringify(f));
    }

    function newFreeRound() {
        var lv = LEVELS[free.level];
        // Nunca sale el anime del día: sería regalar la respuesta.
        var pool = quiz.pool.slice(lv.from, lv.to).filter(function (m) { return m.id !== (quiz.answer && quiz.answer.id); });
        var fresh = pool.filter(function (m) { return !free.seen[m.id]; });
        if (!fresh.length) { free.seen = {}; fresh = pool; }
        free.answer = fresh[Math.floor(Math.random() * fresh.length)];
        free.seen[free.answer.id] = 1;
        free.state = { guesses: [], status: 'playing' };
    }

    function renderFreeEnd() {
        var a = free.answer;
        var won = free.state.status === 'won';
        var msg = won
            ? (free.record ? '¡Nuevo récord! ' + free.combo + ' seguidos.' : '¡Bien! Llevás ' + free.combo + (free.combo === 1 ? ' seguido.' : ' seguidos.'))
            : 'Era este. La racha vuelve a cero.';
        return '<div class="quiz-end">' +
            '<p class="quiz-result ' + (won ? 'is-won' : 'is-lost') + '">' + msg + '</p>' +
            '<a class="quiz-answer" href="detalle.html?cat=anime&amp;id=' + encodeURIComponent(a.id) + '">' + esc(a.title) + '</a>' +
            '<div class="quiz-actions">' +
                '<button type="button" class="reto-btn" id="freeNext">Siguiente anime</button>' +
            '</div>' +
            '<p class="quiz-next">El modo libre no da EXP. El reto del día sí.</p>' +
        '</div>';
    }

    function wireFreeEnd() {
        var btn = document.getElementById('freeNext');
        if (btn) btn.addEventListener('click', function () { newFreeRound(); renderQuiz(); });
    }

    function renderQuizEnd() {
        var a = quiz.answer;
        var st = quiz.state;
        var s = readStats();
        var won = st.status === 'won';
        var pct = s.played ? Math.round((s.won / s.played) * 100) : 0;
        var maxDist = Math.max.apply(null, s.dist.concat([1]));
        var xpMsg = '';
        if (won && st.xp) xpMsg = ' <span class="reto-xp">+' + st.xp + ' EXP</span>';
        else if (won && !userId()) xpMsg = ' <a class="reto-link" href="Login.html">Iniciá sesión para ganar EXP</a>';

        return '<div class="quiz-end">' +
            '<p class="quiz-result ' + (won ? 'is-won' : 'is-lost') + '">' +
                (won ? '¡Lo sacaste en ' + tries() + (tries() === 1 ? ' intento' : ' intentos') + '!' : 'Era este:') + xpMsg +
            '</p>' +
            '<a class="quiz-answer" href="detalle.html?cat=anime&amp;id=' + encodeURIComponent(a.id) + '">' + esc(a.title) + '</a>' +
            '<div class="quiz-actions">' +
                '<button type="button" class="reto-btn" id="quizShare"><i data-lucide="share-2"></i> Compartir resultado</button>' +
                '<button type="button" class="reto-btn reto-btn--ghost" data-qmode="free">Seguir en modo libre</button>' +
            '</div>' +
            '<div class="quiz-stats">' +
                '<div><strong>' + s.played + '</strong><span>Jugados</span></div>' +
                '<div><strong>' + pct + '%</strong><span>Ganados</span></div>' +
                '<div><strong>' + s.cur + '</strong><span>Racha</span></div>' +
                '<div><strong>' + s.best + '</strong><span>Mejor racha</span></div>' +
            '</div>' +
            '<div class="quiz-dist" aria-label="Intentos para adivinar">' + s.dist.map(function (n, i) {
                var mine = won && i === tries() - 1;
                return '<div class="quiz-dist-row"><span>' + (i + 1) + '</span>' +
                    '<i class="' + (mine ? 'is-mine' : '') + '" style="width:' + Math.max(8, Math.round((n / maxDist) * 100)) + '%">' + n + '</i></div>';
            }).join('') + '</div>' +
            '<p class="quiz-next">El próximo anime sale en ' + untilMidnight() + '.</p>' +
        '</div>';
    }

    function shareText() {
        var st = quiz.state;
        var squares = st.guesses.map(function (g) { return g.id === quiz.answer.id ? '🟩' : '🟥'; });
        while (squares.length < MAX_TRIES) squares.push('⬛');
        var score = st.status === 'won' ? tries() + '/' + MAX_TRIES : 'X/' + MAX_TRIES;
        return 'Anime Destiny · Adiviná el anime #' + quizNumber(quiz.day) + ' ' + score + '\n' +
            squares.join('') + '\n' + location.origin + location.pathname;
    }

    function wireQuizEnd() {
        icons();
        var btn = document.getElementById('quizShare');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var text = shareText();
            if (navigator.share) {
                navigator.share({ text: text }).then(function () {
                    if (M) M.track('share');
                }).catch(function () { /* cancelado */ });
                return;
            }
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function () {
                    if (window.Toast) window.Toast.success('Resultado copiado. ¡Pegalo donde quieras!');
                    if (M) M.track('share');
                });
            }
        });
    }

    function suggestions(q) {
        var n = norm(q);
        if (n.length < 2) return [];
        var guessed = {};
        cur().state.guesses.forEach(function (g) { if (g.id) guessed[g.id] = 1; });
        var starts = [], contains = [];
        quiz.pool.forEach(function (m) {
            if (guessed[m.id]) return;
            var names = [m.title, m.english].concat(m.synonyms || []).filter(Boolean).map(norm);
            if (names.some(function (x) { return x.indexOf(n) === 0; })) starts.push(m);
            else if (names.some(function (x) { return x.indexOf(n) !== -1; })) contains.push(m);
        });
        return starts.concat(contains).slice(0, 6);
    }

    // Autocompletado compartido por los dos juegos: search(texto) devuelve los
    // candidatos, render(item) el HTML de cada fila y onPick(item) juega.
    function attachSuggest(input, list, search, render, onPick) {
        var current = [];
        var active = -1;

        function paint() {
            if (!current.length) { list.hidden = true; list.innerHTML = ''; return; }
            list.hidden = false;
            list.innerHTML = current.map(function (m, i) {
                return '<li role="option" data-i="' + i + '"' + (i === active ? ' class="is-active" aria-selected="true"' : '') + '>' +
                    render(m) + '</li>';
            }).join('');
        }

        input.addEventListener('input', function () {
            current = search(input.value);
            active = current.length ? 0 : -1;
            paint();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' && current.length) { active = (active + 1) % current.length; paint(); e.preventDefault(); }
            else if (e.key === 'ArrowUp' && current.length) { active = (active - 1 + current.length) % current.length; paint(); e.preventDefault(); }
            else if (e.key === 'Enter' && active >= 0) { onPick(current[active]); e.preventDefault(); }
            else if (e.key === 'Escape') { current = []; active = -1; paint(); }
        });
        // Al salir del campo se cierra la lista, que si no tapa el botón de saltar.
        input.addEventListener('blur', function () { current = []; active = -1; paint(); });
        // pointerdown y no click: el click llega después del blur del input.
        list.addEventListener('pointerdown', function (e) {
            var li = e.target.closest('li[data-i]');
            if (!li) return;
            e.preventDefault();
            onPick(current[Number(li.getAttribute('data-i'))]);
        });
        if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) input.focus();
    }

    function wireQuizInput() {
        attachSuggest(
            document.getElementById('quizGuess'),
            document.getElementById('quizSuggest'),
            suggestions,
            function (m) {
                var alt = m.english && m.english !== m.title ? '<small>' + esc(m.english) + '</small>' : '';
                return esc(m.title) + alt;
            },
            guess
        );
        document.getElementById('quizSkip').addEventListener('click', function () { guess(null); });
    }

    function guess(m) {
        var st = cur().state;
        if (st.status !== 'playing') return;
        st.guesses.push(m ? { id: m.id, title: m.title } : { skip: true });
        var won = !!m && m.id === cur().answer.id;
        if (won) st.status = 'won';
        else if (st.guesses.length >= MAX_TRIES) st.status = 'lost';

        if (quiz.mode === 'free') {
            if (st.status === 'won') {
                free.combo += 1;
                free.record = free.combo > 1 && free.combo > freeBest(free.level);
                if (free.combo > freeBest(free.level)) saveFree(free.combo);
            } else if (st.status === 'lost') {
                free.combo = 0;
            }
            renderQuiz();
            return;
        }

        if (st.status !== 'playing') {
            // Se guarda el final ANTES de dar EXP: recargar no vuelve a premiar.
            var uid = userId();
            if (won && uid) st.xp = WIN_XP[st.guesses.length - 1];
            saveQuizState();
            recordStats(won, st.guesses.length);
            if (st.xp && typeof window.addUserPoints === 'function') window.addUserPoints(uid, st.xp);
            if (M) {
                M.track('quiz_play');
                if (won) M.track('quiz_win');
            }
        } else {
            saveQuizState();
        }
        renderQuiz();
    }

    async function initQuiz() {
        var body = document.getElementById('quizBody');
        if (!body || !M) return;
        if (typeof window.getQuizPool !== 'function') return;
        try {
            quiz.pool = await window.getQuizPool();
        } catch (e) {
            console.warn('[retos] pozo del quiz:', e);
            body.innerHTML = '<p class="reto-loading">No pudimos cargar el reto de hoy. Probá de nuevo en un rato.</p>';
            return;
        }
        quiz.day = today();
        quiz.answer = pickAnswer(quiz.pool, quiz.day);
        quiz.state = loadQuizState(quiz.day);
        free.level = readFree().level;
        renderQuiz();
    }

    // ─────────────────────────────────────────────────────────────
    // Adiviná el personaje (modo libre por serie)
    // ─────────────────────────────────────────────────────────────
    // Elegís un anime o manga y adivinás sus personajes, todas las veces que
    // quieras. No da EXP: es ilimitado y se podría farmear.
    var CHAR_TRIES = 4;
    var CHAR_BLUR = [18, 11, 6, 3];
    var K_CHAR_SERIES = 'ad:charquiz:series';
    // Progreso por serie: { <id>: { got: [ids adivinados], best: mejor racha } }.
    var K_CHAR_PROG = 'ad:charquiz:prog';

    function readCharProg(seriesId) {
        var all = readJson(K_CHAR_PROG) || {};
        var p = all[seriesId] || {};
        return { got: Array.isArray(p.got) ? p.got : [], best: p.best || 0 };
    }

    function saveCharProg(seriesId, prog) {
        var all = readJson(K_CHAR_PROG) || {};
        all[seriesId] = prog;
        lsSet(K_CHAR_PROG, JSON.stringify(all));
    }

    var chars = { series: null, cast: [], current: null, guesses: [], status: 'idle', seen: {}, played: 0, won: 0, streak: 0, cat: 'anime' };

    function charHost() { return document.getElementById('charBody'); }

    // AniList pone esta imagen genérica a los personajes sin foto: no sirven.
    function hasRealImage(c) { return c.image && !/\/default\.(jpg|png)$/i.test(c.image); }

    function renderCharPicker(results, loading) {
        var host = charHost();
        if (!host) return;
        var last = readJson(K_CHAR_SERIES);
        host.innerHTML =
            '<p class="quiz-intro">Elegí un anime o manga y adiviná sus personajes por la imagen. Jugás todas las veces que quieras.</p>' +
            '<div class="char-pick">' +
                '<div class="summary-months" role="group" aria-label="Tipo">' +
                    '<button type="button" class="reto-chip' + (chars.cat === 'anime' ? ' is-active' : '') + '" data-charcat="anime">Anime</button>' +
                    '<button type="button" class="reto-chip' + (chars.cat === 'manga' ? ' is-active' : '') + '" data-charcat="manga">Manga</button>' +
                '</div>' +
                '<div class="quiz-input">' +
                    '<input type="text" id="charSeries" autocomplete="off" placeholder="Buscá un ' + (chars.cat === 'manga' ? 'manga' : 'anime') + '…" aria-label="Buscar serie">' +
                '</div>' +
            '</div>' +
            (loading ? '<p class="reto-loading">Buscando…</p>' : '') +
            (results && results.length ? '<ul class="char-results">' + results.map(function (m, i) {
                var poster = typeof window.getApiPoster === 'function' ? window.getApiPoster(m) : '';
                return '<li><button type="button" data-pick="' + i + '">' +
                    (poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy">' : '') +
                    '<span>' + esc(m.title) + (m.startYear ? ' <small>' + m.startYear + '</small>' : '') + '</span></button></li>';
            }).join('') + '</ul>' : '') +
            (results && !results.length && !loading ? '<p class="quiz-intro">No encontramos nada con ese nombre.</p>' : '') +
            (last && last.id && !results ? '<div class="quiz-actions"><button type="button" class="reto-btn reto-btn--ghost" id="charLast">Seguir con ' + esc(last.title) + '</button></div>' : '');

        host.querySelectorAll('[data-charcat]').forEach(function (b) {
            b.addEventListener('click', function () {
                chars.cat = b.getAttribute('data-charcat');
                renderCharPicker(null);
            });
        });
        var input = document.getElementById('charSeries');
        if (chars.lastQuery && results) input.value = chars.lastQuery;
        var timer = null;
        input.addEventListener('input', function () {
            clearTimeout(timer);
            var q = input.value.trim();
            if (q.length < 2) return;
            // Espera a que deje de tipear: cada búsqueda es un pedido a AniList.
            timer = setTimeout(async function () {
                chars.lastQuery = q;
                var list = typeof window.buscarEnApi === 'function' ? await window.buscarEnApi(q, chars.cat) : [];
                if (chars.lastQuery !== q) return;
                chars.results = (list || []).slice(0, 8);
                renderCharPicker(chars.results);
                var again = document.getElementById('charSeries');
                if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
            }, 450);
        });
        host.querySelectorAll('[data-pick]').forEach(function (b) {
            b.addEventListener('click', function () {
                var m = results[Number(b.getAttribute('data-pick'))];
                pickSeries({ id: m.id, title: m.title, cat: chars.cat });
            });
        });
        var lastBtn = document.getElementById('charLast');
        if (lastBtn) lastBtn.addEventListener('click', function () { pickSeries(last); });
    }

    async function pickSeries(series) {
        var host = charHost();
        host.innerHTML = '<p class="reto-loading">Cargando personajes de ' + esc(series.title) + '…</p>';
        var cast = typeof window.getCharactersByMediaId === 'function' ? await window.getCharactersByMediaId(series.id) : [];
        cast = (cast || []).filter(hasRealImage);
        // Con muy pocos personajes el juego es adivinar entre dos.
        if (cast.length < 4) {
            chars.results = null;
            renderCharPicker(null);
            host.insertAdjacentHTML('afterbegin', '<p class="quiz-result is-lost">' + esc(series.title) + ' tiene muy pocos personajes con imagen. Probá con otra serie.</p>');
            return;
        }
        lsSet(K_CHAR_SERIES, JSON.stringify(series));
        chars.series = series;
        chars.cast = cast;
        chars.seen = {};
        chars.played = 0;
        chars.won = 0;
        chars.streak = 0;
        nextCharacter();
    }

    function nextCharacter() {
        var pool = chars.cast.filter(function (c) { return !chars.seen[c.id]; });
        // Primero los principales y secundarios; los de fondo solo cuando no queda otra.
        var main = pool.filter(function (c) { return c.role !== 'BACKGROUND'; });
        if (main.length) pool = main;
        // Y antes que nada los que todavía no adivinaste nunca.
        var got = readCharProg(chars.series.id).got;
        var missing = pool.filter(function (c) { return got.indexOf(c.id) === -1; });
        if (missing.length) pool = missing;
        if (!pool.length) {
            chars.seen = {};
            pool = chars.cast;
        }
        chars.current = pool[Math.floor(Math.random() * pool.length)];
        chars.seen[chars.current.id] = 1;
        chars.guesses = [];
        chars.status = 'playing';
        renderCharGame();
    }

    function charHints() {
        var c = chars.current;
        var role = { MAIN: 'Principal', SUPPORTING: 'Secundario', BACKGROUND: 'De fondo' }[c.role] || 'Sin dato';
        return [
            { label: 'Rol', value: role },
            {
                label: 'Nombre',
                value: String(c.name).split(/\s+/).map(function (w) {
                    return w.charAt(0) + w.slice(1).replace(/[^\s]/g, '•');
                }).join(' ')
            },
            { label: 'Voz japonesa', value: c.vaName || 'Sin dato' }
        ];
    }

    function renderCharGame() {
        var host = charHost();
        var c = chars.current;
        var over = chars.status !== 'playing';
        var n = chars.guesses.length;
        var blur = over ? 0 : CHAR_BLUR[Math.min(n, CHAR_BLUR.length - 1)];
        var hints = over ? charHints() : charHints().slice(0, n);

        var prog = readCharProg(chars.series.id);
        var known = {};
        chars.cast.forEach(function (x) { known[x.id] = 1; });
        var gotCount = prog.got.filter(function (id) { return known[id]; }).length;
        var html = '<div class="char-top">' +
                '<span class="reto-pill">' + esc(chars.series.title) + '</span>' +
                '<span class="char-score">' + chars.won + ' de ' + chars.played + (chars.streak > 1 ? ' · racha ' + chars.streak : '') + '</span>' +
            '</div>' +
            '<p class="char-progress">Adivinaste <strong>' + gotCount + ' de ' + chars.cast.length + '</strong> personajes de esta serie' +
                (prog.best > 1 ? ' · récord ' + prog.best + ' seguidos' : '') + '</p>' +
            '<div class="quiz-grid">' +
                '<div class="quiz-cover' + (over ? ' is-revealed' : '') + '">' +
                    '<img src="' + esc(c.image) + '" alt="' + (over ? esc(c.name) : 'Personaje misterioso') + '" style="filter: blur(' + blur + 'px)" draggable="false">' +
                '</div>' +
                '<div class="quiz-side">';
        if (hints.length) {
            html += '<ul class="quiz-hints">' + hints.map(function (h) {
                return '<li><span>' + esc(h.label) + '</span><strong>' + esc(h.value) + '</strong></li>';
            }).join('') + '</ul>';
        } else {
            html += '<p class="quiz-intro">Tenés ' + CHAR_TRIES + ' intentos. Cada error aclara la imagen y suma una pista.</p>';
        }
        if (n) {
            html += '<ol class="quiz-guesses">' + chars.guesses.map(function (g) {
                var ok = g.id === c.id;
                return '<li class="' + (ok ? 'is-ok' : 'is-bad') + '">' + (ok ? '✓ ' : '✗ ') + esc(g.skip ? 'Salteado' : g.name) + '</li>';
            }).join('') + '</ol>';
        }
        if (!over) {
            html += '<div class="quiz-input">' +
                '<input type="text" id="charGuess" autocomplete="off" placeholder="Escribí el nombre del personaje…" aria-label="Tu respuesta" aria-controls="charSuggest">' +
                '<ul id="charSuggest" class="quiz-suggest" role="listbox" hidden></ul>' +
                '<button type="button" class="reto-btn reto-btn--ghost" id="charSkip">Saltar y ver pista</button>' +
            '</div>';
        } else {
            var won = chars.status === 'won';
            html += '<div class="quiz-end">' +
                '<p class="quiz-result ' + (won ? 'is-won' : 'is-lost') + '">' +
                    (won ? '¡Bien! En ' + n + (n === 1 ? ' intento.' : ' intentos.') : 'Era este:') + '</p>' +
                '<a class="quiz-answer" href="personaje.html?tipo=character&amp;id=' + encodeURIComponent(c.id) + '">' + esc(c.name) + '</a>' +
                '<div class="quiz-actions">' +
                    '<button type="button" class="reto-btn" id="charNext">Otro personaje</button>' +
                    '<button type="button" class="reto-btn reto-btn--ghost" id="charChange">Cambiar de serie</button>' +
                '</div>' +
            '</div>';
        }
        html += '</div></div>';
        host.innerHTML = html;

        if (!over) {
            attachSuggest(
                document.getElementById('charGuess'),
                document.getElementById('charSuggest'),
                charSuggestions,
                function (m) { return esc(m.name); },
                charGuess
            );
            document.getElementById('charSkip').addEventListener('click', function () { charGuess(null); });
        } else {
            document.getElementById('charNext').addEventListener('click', nextCharacter);
            document.getElementById('charChange').addEventListener('click', function () {
                chars.results = null;
                renderCharPicker(null);
            });
        }
    }

    function charSuggestions(q) {
        var n = norm(q);
        if (n.length < 2) return [];
        var guessed = {};
        chars.guesses.forEach(function (g) { if (g.id) guessed[g.id] = 1; });
        var starts = [], contains = [];
        chars.cast.forEach(function (c) {
            if (guessed[c.id]) return;
            var name = norm(c.name);
            // "Luffy" tiene que encontrar a "Monkey D. Luffy": cualquier palabra vale.
            if (name.indexOf(n) === 0 || name.split(' ').some(function (w) { return w.indexOf(n) === 0; })) starts.push(c);
            else if (name.indexOf(n) !== -1) contains.push(c);
        });
        return starts.concat(contains).slice(0, 6);
    }

    function charGuess(c) {
        if (chars.status !== 'playing') return;
        chars.guesses.push(c ? { id: c.id, name: c.name } : { skip: true });
        if (c && c.id === chars.current.id) chars.status = 'won';
        else if (chars.guesses.length >= CHAR_TRIES) chars.status = 'lost';
        if (chars.status !== 'playing') {
            chars.played += 1;
            if (chars.status === 'won') { chars.won += 1; chars.streak += 1; }
            else chars.streak = 0;
            var prog = readCharProg(chars.series.id);
            if (chars.status === 'won' && prog.got.indexOf(chars.current.id) === -1) prog.got.push(chars.current.id);
            prog.best = Math.max(prog.best, chars.streak);
            saveCharProg(chars.series.id, prog);
        }
        renderCharGame();
    }

    function initChars() {
        if (charHost()) renderCharPicker(null);
    }

    // ─────────────────────────────────────────────────────────────
    // Misiones
    // ─────────────────────────────────────────────────────────────
    function missionRow(m) {
        var pct = Math.round((m.progress / m.goal) * 100);
        return '<li class="mission' + (m.done ? ' is-done' : '') + '">' +
            '<div class="mission-top">' +
                '<span class="mission-label">' + (m.done ? '✓ ' : '') + esc(m.label) + '</span>' +
                '<span class="mission-xp">+' + m.xp + ' EXP</span>' +
            '</div>' +
            '<div class="mission-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + m.goal + '" aria-valuenow="' + m.progress + '">' +
                '<i style="width:' + pct + '%"></i>' +
            '</div>' +
            (m.goal > 1 ? '<span class="mission-count">' + m.progress + ' / ' + m.goal + '</span>' : '') +
        '</li>';
    }

    function renderMissions() {
        var body = document.getElementById('missionsBody');
        var reset = document.getElementById('missionsReset');
        if (!body || !M) return;
        var s = M.getState();
        reset.textContent = 'Nuevas en ' + untilMidnight();
        var html = '';
        if (!s.signedIn) {
            html += '<p class="mission-login"><a class="reto-link" href="Login.html">Iniciá sesión</a> para cumplir misiones y ganar EXP.</p>';
        }
        html += '<h3 class="mission-group">Hoy</h3><ul class="mission-list">' + s.daily.map(missionRow).join('') + '</ul>' +
            '<p class="mission-bonus' + (s.dailyBonus.done ? ' is-done' : '') + '">' +
                (s.dailyBonus.done ? '✓ Bonus del día cobrado' : 'Completá las tres y ganás +' + s.dailyBonus.xp + ' EXP extra') +
            '</p>' +
            '<h3 class="mission-group">Esta semana <small>(se reinicia el lunes)</small></h3>' +
            '<ul class="mission-list">' + s.weekly.map(missionRow).join('') + '</ul>';
        body.innerHTML = html;
    }

    // ─────────────────────────────────────────────────────────────
    // Resumen del mes
    // ─────────────────────────────────────────────────────────────
    var GENRE_STOP = { 'Comedy': 1, 'Drama': 1, 'Slice of Life': 1 };
    var summaryOffset = 0;
    var summaryData = null;

    function monthInfo(offset) {
        var now = new Date();
        var d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        return { date: d, ym: M.monthStr(d), name: MESES[d.getMonth()], year: d.getFullYear() };
    }

    async function loadStates() {
        var client = window.AppSupabase;
        if (!client || !client.isSignedIn || !client.isSignedIn() || typeof client.loadItemStates !== 'function') return null;
        try { return await client.loadItemStates(''); } catch (_) { return null; }
    }

    function topGenre(states) {
        var tally = {};
        states.forEach(function (st) {
            String((st.meta && st.meta.info) || '').split(/[|,]/).forEach(function (raw) {
                var g = raw.trim();
                if (g && !GENRE_STOP[g] && g.length < 30) tally[g] = (tally[g] || 0) + 1;
            });
        });
        var best = '', n = 0;
        Object.keys(tally).forEach(function (g) { if (tally[g] > n) { n = tally[g]; best = g; } });
        return best;
    }

    async function buildSummary(offset) {
        var mi = monthInfo(offset);
        var uid = userId();
        var states = (await loadStates()) || [];
        var inMonth = states.filter(function (st) { return String(st.updated_at || '').slice(0, 7) === mi.ym; });
        var viewed = inMonth.filter(function (st) { return st.viewed; });
        var favs = inMonth.filter(function (st) { return st.fav; });
        var counts = M.getMonth(mi.ym);
        var lv = typeof window.resolveUserLevel === 'function' ? window.resolveUserLevel(uid) : null;
        return {
            month: mi,
            user: uid,
            viewed: viewed.length,
            favs: favs.length,
            episodes: Number(counts.progress) || 0,
            days: Number(counts.visit) || 0,
            quizWins: Number(counts.quiz_win) || 0,
            level: lv ? lv.level : null,
            genre: topGenre(viewed.concat(favs).length ? viewed.concat(favs) : states),
            covers: viewed.concat(favs).map(function (st) { return st.meta && st.meta.img; })
                .filter(function (src, i, arr) { return src && arr.indexOf(src) === i; }).slice(0, 4)
        };
    }

    function statsList(d) {
        return [
            { n: d.viewed, l: d.viewed === 1 ? 'título visto' : 'títulos vistos' },
            { n: d.favs, l: d.favs === 1 ? 'favorito nuevo' : 'favoritos nuevos' },
            { n: d.episodes, l: 'episodios y capítulos' },
            { n: d.days, l: d.days === 1 ? 'día activo' : 'días activos' },
            { n: d.quizWins, l: 'retos ganados' },
            { n: d.level != null ? d.level : '—', l: 'nivel' }
        ];
    }

    async function renderSummary() {
        var body = document.getElementById('summaryBody');
        if (!body || !M) return;
        if (!userId()) {
            body.innerHTML = '<p class="mission-login"><a class="reto-link" href="Login.html">Iniciá sesión</a> para ver tu resumen del mes y compartirlo.</p>';
            return;
        }
        body.innerHTML = '<p class="reto-loading">Armando tu resumen…</p>';
        var offset = summaryOffset;
        var d = await buildSummary(offset);
        if (offset !== summaryOffset) return; // cambiaron de mes mientras cargaba
        summaryData = d;
        body.innerHTML =
            '<p class="summary-lead">Tu ' + esc(d.month.name) + ' ' + d.month.year +
                (d.genre ? ', con mucho <strong>' + esc(d.genre) + '</strong>' : '') + '.</p>' +
            '<div class="summary-grid">' + statsList(d).map(function (s) {
                return '<div><strong>' + esc(s.n) + '</strong><span>' + esc(s.l) + '</span></div>';
            }).join('') + '</div>' +
            '<p class="summary-note">Los episodios, los días activos y los retos se cuentan desde que existen las misiones.</p>' +
            '<div class="quiz-actions"><button type="button" class="reto-btn" id="summaryMake"><i data-lucide="share-2"></i> Crear imagen para compartir</button></div>' +
            '<div id="summaryImage" class="summary-image" hidden></div>';
        icons();
        document.getElementById('summaryMake').addEventListener('click', makeSummaryImage);
    }

    function loadImage(src) {
        return new Promise(function (resolve) {
            if (!src) return resolve(null);
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };
            img.src = src;
        });
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    async function drawSummary(d) {
        var W = 1080, H = 1350;
        var c = document.createElement('canvas');
        c.width = W; c.height = H;
        var ctx = c.getContext('2d');
        try {
            await Promise.all([
                document.fonts.load('700 64px Orbitron'),
                document.fonts.load('500 40px Rajdhani')
            ]);
        } catch (_) { /* sin fuentes: usa las del sistema */ }

        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#12051f');
        bg.addColorStop(0.55, '#2a0b45');
        bg.addColorStop(1, '#063a4a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        var glow = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 520);
        glow.addColorStop(0, 'rgba(188,19,254,0.45)');
        glow.addColorStop(1, 'rgba(188,19,254,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#00f2ff';
        ctx.font = '700 34px Orbitron, sans-serif';
        ctx.fillText('ANIME DESTINY', 80, 120);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 72px Orbitron, sans-serif';
        ctx.fillText('MI ' + d.month.name.toUpperCase(), 80, 215);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '500 40px Rajdhani, sans-serif';
        ctx.fillText((d.user ? '@' + d.user + ' · ' : '') + d.month.year, 80, 272);

        // Portadas
        var covers = (await Promise.all(d.covers.map(loadImage))).filter(Boolean);
        var top = 330;
        if (covers.length) {
            var cw = 210, ch = 300, gap = 30;
            covers.forEach(function (img, i) {
                var x = 80 + i * (cw + gap);
                ctx.save();
                roundRect(ctx, x, top, cw, ch, 18);
                ctx.clip();
                var r = Math.max(cw / img.width, ch / img.height);
                ctx.drawImage(img, x + (cw - img.width * r) / 2, top + (ch - img.height * r) / 2, img.width * r, img.height * r);
                ctx.restore();
            });
            top += ch + 60;
        }

        // Números
        var stats = statsList(d);
        var colW = (W - 160 - 40) / 2;
        var rowH = covers.length ? 150 : 190;
        stats.forEach(function (s, i) {
            var x = 80 + (i % 2) * (colW + 40);
            var y = top + Math.floor(i / 2) * rowH;
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            roundRect(ctx, x, y, colW, rowH - 24, 20);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 60px Orbitron, sans-serif';
            ctx.fillText(String(s.n), x + 30, y + 72);
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            ctx.font = '500 32px Rajdhani, sans-serif';
            ctx.fillText(s.l, x + 30, y + 112);
        });

        var y2 = top + 3 * rowH + 20;
        if (d.genre && y2 < H - 140) {
            ctx.fillStyle = '#bc13fe';
            ctx.font = '500 34px Rajdhani, sans-serif';
            ctx.fillText('Género del mes', 80, y2);
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 48px Orbitron, sans-serif';
            ctx.fillText(d.genre.toUpperCase(), 80, y2 + 58);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '500 30px Rajdhani, sans-serif';
        ctx.fillText(location.host + location.pathname.replace(/retos\.html$/, ''), 80, H - 70);
        return c;
    }

    async function makeSummaryImage() {
        if (!summaryData) return;
        var btn = document.getElementById('summaryMake');
        var host = document.getElementById('summaryImage');
        btn.disabled = true;
        var canvas = await drawSummary(summaryData);
        var name = 'anime-destiny-' + summaryData.month.ym + '.png';
        canvas.toBlob(function (blob) {
            btn.disabled = false;
            if (!blob) return;
            // data: y no blob: para la vista previa y la descarga: el CSP
            // (img-src) permite data: pero no blob:.
            var url = canvas.toDataURL('image/png');
            var file = new File([blob], name, { type: 'image/png' });
            var canShare = navigator.canShare && navigator.canShare({ files: [file] });
            host.hidden = false;
            host.innerHTML = '<img src="' + url + '" alt="Resumen del mes">' +
                '<div class="quiz-actions">' +
                    (canShare ? '<button type="button" class="reto-btn" id="summaryShare"><i data-lucide="share-2"></i> Compartir</button>' : '') +
                    '<a class="reto-btn reto-btn--ghost" href="' + url + '" download="' + name + '"><i data-lucide="download"></i> Descargar</a>' +
                '</div>';
            icons();
            var share = document.getElementById('summaryShare');
            if (share) {
                share.addEventListener('click', function () {
                    navigator.share({ files: [file], text: 'Mi mes en Anime Destiny' }).then(function () {
                        if (M) M.track('share');
                    }).catch(function () { /* cancelado */ });
                });
            }
        }, 'image/png');
    }

    function wireSummaryMonths() {
        document.querySelectorAll('.summary-months [data-month]').forEach(function (b) {
            b.addEventListener('click', function () {
                summaryOffset = Number(b.getAttribute('data-month')) || 0;
                document.querySelectorAll('.summary-months [data-month]').forEach(function (x) {
                    x.classList.toggle('is-active', x === b);
                });
                renderSummary();
            });
        });
        // Los primeros días del mes casi no hay datos: arranca en el anterior.
        if (new Date().getDate() <= 3) {
            summaryOffset = -1;
            document.querySelectorAll('.summary-months [data-month]').forEach(function (x) {
                x.classList.toggle('is-active', x.getAttribute('data-month') === '-1');
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Avisos push (solo si el servidor los tiene configurados)
    // ─────────────────────────────────────────────────────────────
    async function renderPush() {
        var card = document.getElementById('pushCard');
        var P = window.PushNotifs;
        if (!card || !P || !P.isConfigured() || !userId()) { if (card) card.hidden = true; return; }
        var st = await P.getState();
        card.hidden = st !== 'off';
        var btn = document.getElementById('pushEnable');
        if (btn && !btn.dataset.wired) {
            btn.dataset.wired = '1';
            btn.addEventListener('click', async function () {
                btn.disabled = true;
                var res = await P.enable();
                btn.disabled = false;
                if (res === 'on') card.hidden = true;
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Arranque
    // ─────────────────────────────────────────────────────────────
    function refreshSession() {
        renderMissions();
        renderSummary();
        renderPush();
        if (quiz.state) renderQuiz();
    }

    function start() {
        icons();
        renderMissions();
        wireSummaryMonths();
        renderSummary();
        initQuiz();
        initChars();
        window.addEventListener('missions-updated', renderMissions);
        window.addEventListener('supabase-auth-changed', refreshSession);
        if (window.AppSupabaseReady && typeof window.AppSupabaseReady.then === 'function') {
            window.AppSupabaseReady.then(refreshSession).catch(function () { /* sin supabase */ });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
