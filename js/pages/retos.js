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
    var quiz = { pool: [], answer: null, day: '', state: null };

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
        var a = quiz.answer;
        var out = [];
        var fmt = { TV: 'Serie', MOVIE: 'Película', ONA: 'ONA' }[a.format] || a.format;
        out.push({ label: 'Año y formato', value: (a.year || '¿?') + ' · ' + fmt + (a.episodes && a.format !== 'MOVIE' ? ' · ' + a.episodes + ' episodios' : '') });
        out.push({ label: 'Géneros', value: (a.genres || []).slice(0, 3).join(', ') || '¿?' });
        out.push({ label: 'Estudio', value: a.studio || 'Desconocido' });
        out.push({
            label: 'Título',
            value: String(a.title).split(/\s+/).map(function (w) {
                return w.charAt(0) + w.slice(1).replace(/[A-Za-z0-9]/g, '•');
            }).join(' ')
        });
        return out;
    }

    function tries() { return quiz.state.guesses.length; }

    function renderQuiz() {
        var body = document.getElementById('quizBody');
        var triesEl = document.getElementById('quizTries');
        var numEl = document.getElementById('quizNumber');
        if (!body) return;
        var a = quiz.answer;
        var st = quiz.state;
        var over = st.status !== 'playing';
        numEl.textContent = '#' + quizNumber(quiz.day);
        triesEl.textContent = over
            ? (st.status === 'won' ? '¡Adivinado!' : 'Terminado')
            : 'Intento ' + (tries() + 1) + ' de ' + MAX_TRIES;

        var blur = over ? 0 : BLUR_PX[Math.min(tries(), BLUR_PX.length - 1)];
        var shownHints = over ? hints() : hints().slice(0, tries());

        var html = '<div class="quiz-grid">' +
            '<div class="quiz-cover' + (over ? ' is-revealed' : '') + '">' +
                '<img src="' + esc(a.image) + '" alt="' + (over ? esc(a.title) : 'Portada misteriosa') + '" ' +
                'style="filter: blur(' + blur + 'px)" draggable="false">' +
            '</div>' +
            '<div class="quiz-side">';

        if (shownHints.length) {
            html += '<ul class="quiz-hints">' + shownHints.map(function (h) {
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
            html += renderQuizEnd();
        }
        html += '</div></div>';
        body.innerHTML = html;

        if (!over) wireQuizInput();
        else wireQuizEnd();
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
        quiz.state.guesses.forEach(function (g) { if (g.id) guessed[g.id] = 1; });
        var starts = [], contains = [];
        quiz.pool.forEach(function (m) {
            if (guessed[m.id]) return;
            var names = [m.title, m.english].concat(m.synonyms || []).filter(Boolean).map(norm);
            if (names.some(function (x) { return x.indexOf(n) === 0; })) starts.push(m);
            else if (names.some(function (x) { return x.indexOf(n) !== -1; })) contains.push(m);
        });
        return starts.concat(contains).slice(0, 6);
    }

    function wireQuizInput() {
        var input = document.getElementById('quizGuess');
        var list = document.getElementById('quizSuggest');
        var skip = document.getElementById('quizSkip');
        var current = [];
        var active = -1;

        function paint() {
            if (!current.length) { list.hidden = true; list.innerHTML = ''; return; }
            list.hidden = false;
            list.innerHTML = current.map(function (m, i) {
                var alt = m.english && m.english !== m.title ? '<small>' + esc(m.english) + '</small>' : '';
                return '<li role="option" data-i="' + i + '"' + (i === active ? ' class="is-active" aria-selected="true"' : '') + '>' +
                    esc(m.title) + alt + '</li>';
            }).join('');
        }

        input.addEventListener('input', function () {
            current = suggestions(input.value);
            active = current.length ? 0 : -1;
            paint();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' && current.length) { active = (active + 1) % current.length; paint(); e.preventDefault(); }
            else if (e.key === 'ArrowUp' && current.length) { active = (active - 1 + current.length) % current.length; paint(); e.preventDefault(); }
            else if (e.key === 'Enter' && active >= 0) { guess(current[active]); e.preventDefault(); }
        });
        // pointerdown y no click: el click llega después del blur del input.
        list.addEventListener('pointerdown', function (e) {
            var li = e.target.closest('li[data-i]');
            if (!li) return;
            e.preventDefault();
            guess(current[Number(li.getAttribute('data-i'))]);
        });
        skip.addEventListener('click', function () { guess(null); });
        if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) input.focus();
    }

    function guess(m) {
        var st = quiz.state;
        if (st.status !== 'playing') return;
        st.guesses.push(m ? { id: m.id, title: m.title } : { skip: true });
        var won = !!m && m.id === quiz.answer.id;
        if (won) st.status = 'won';
        else if (st.guesses.length >= MAX_TRIES) st.status = 'lost';

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
        renderQuiz();
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
