(function () {
    "use strict";

    var container = document.getElementById("rankingContent");
    if (!container) return;

    var currentUserId = null;
    var allPlayersCache = [];
    var filterText = '';

    function escapeHtml(str) {
        if (typeof str !== "string") return "";
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Podio: corona para el 1, medallas para 2 y 3, numero pelado del 4 en adelante.
    function getPosHtml(rank) {
        var icon = rank === 1 ? 'crown' : (rank === 2 || rank === 3 ? 'medal' : '');
        return '<div class="rank-pos rank-pos--' + (rank <= 3 ? rank : 'n') + '">' +
            (icon ? '<i data-lucide="' + icon + '"></i>' : '') +
            '<span>' + rank + '</span>' +
        '</div>';
    }

    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        var ini = (parts[0][0] || '') + (parts.length > 1 ? (parts[1][0] || '') : '');
        return ini.toUpperCase();
    }

    // Cuanta EXP pide el nivel `level` para subir al siguiente. Replica la
    // curva de levelFromPoints (states.js): base 100, x1.2 por nivel, floor.
    // La BD guarda level + exp DENTRO del nivel, no el acumulado, asi que no
    // se puede usar levelFromPoints directo.
    function expNeededForNext(level) {
        var need = AnimeDestiny.Constants.XP_BASE || 100;
        var mult = AnimeDestiny.Constants.XP_MULTIPLIER || 1.2;
        for (var l = 1; l < level; l++) need = Math.floor(need * mult);
        return need;
    }

    // El apodo llega como id (p.ej. 'hechicero_actual'); apodoLabel (bundle) lo
    // traduce. Se muestra tambien 'novato' (el default sin equipar): es un grado
    // valido con etiqueta propia y, como hoy casi todos los perfiles estan en
    // 'novato', saltearlo dejaba la columna vacia y parecia que no andaba.
    function getApodoHtml(p) {
        var id = p.apodo || 'novato';
        var label = (typeof window.apodoLabel === 'function') ? window.apodoLabel(id) : '';
        if (!label) return '';
        return '<span class="rank-player-apodo" title="' + escapeHtml(label) + '">★ ' + escapeHtml(label) + '</span>';
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            try { window.lucide.createIcons(); } catch (_) { /* no bloquear el render */ }
        }
    }

    var currentPage = 0;
    var pageSize = AnimeDestiny.Constants.RANKING_PAGE_SIZE || 50;
    var hasMore = true;
    var isLoading = false;

    function renderRanking(players) {
        if (!players || players.length === 0) {
            container.className = "ranking-empty";
            container.textContent = "Todavía no hay jugadores registrados.";
            return;
        }

        var html = '<div class="rank-list">' +
            '<div class="rank-head">' +
                '<span>#</span>' +
                '<span>JUGADOR</span>' +
                '<span class="rank-h-level">NIVEL</span>' +
                '<span class="rank-h-progress"></span>' +
                '<span class="rank-h-exp">EXP TOTAL</span>' +
            '</div>';

        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var name = escapeHtml(p.display_name || p.username || "Jugador");
            var level = p.level != null ? p.level : 1;
            var exp = p.exp != null ? p.exp : 0;
            var rank = i + 1;
            var isCurrentUser = currentUserId && (p.id === currentUserId);
            var photoUrl = p.photo_url || '';

            var need = expNeededForNext(level);
            var falta = Math.max(0, need - exp);
            var pct = Math.max(0, Math.min(100, Math.round((exp / need) * 100)));

            var avatarHtml;
            if (photoUrl) {
                var initials = escapeHtml(getInitials(p.display_name || p.username));
                avatarHtml = '<span class="ranking-avatar ranking-avatar-img">' +
                    '<img src="' + escapeHtml(photoUrl) + '" alt="" loading="lazy" data-initials="' + initials + '">' +
                    '</span>';
            } else {
                avatarHtml = '<span class="ranking-avatar">' + escapeHtml(getInitials(p.display_name || p.username)) + '</span>';
            }

            html += '<div class="rank-row' + (isCurrentUser ? ' rank-row-own' : '') + '">' +
                getPosHtml(rank) +
                '<div class="rank-player">' +
                    avatarHtml +
                    '<div class="rank-player-info">' +
                        // Una sola linea flex: nombre, chapa "TÚ", chip de nivel
                        // y apodo. El chip de nivel solo aparece en pantallas
                        // chicas (donde se cae la columna NIVEL) y por eso va
                        // antes del apodo: al envolver, los dos quedan juntos
                        // en el renglon de abajo.
                        '<div class="rank-player-name">' +
                            '<span class="rank-player-nick" title="' + name + '">' + name + '</span>' +
                            (isCurrentUser ? '<span class="ranking-badge">TÚ</span>' : '') +
                            '<span class="rank-sub-level">Nv. ' + level + '</span>' +
                            getApodoHtml(p) +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="rank-level">' +
                    '<span class="rank-level-icon"><i data-lucide="swords"></i></span>' +
                    '<div>' +
                        '<span class="rank-level-label">NIVEL</span>' +
                        '<span class="rank-level-num">' + level + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="rank-progress">' +
                    '<div class="rank-progress-track"><div class="rank-progress-fill" style="width:' + pct + '%"></div></div>' +
                    '<div class="rank-progress-text">EXP para siguiente nivel: ' + falta.toLocaleString() + '</div>' +
                '</div>' +
                '<div class="rank-exp">' +
                    '<span class="rank-exp-num">' + exp.toLocaleString() + '</span>' +
                    '<span class="rank-exp-label">EXP</span>' +
                '</div>' +
            '</div>';
        }

        html += '</div>';

        var total = allPlayersCache.length;
        html += '<div class="ranking-footer"><i data-lucide="users"></i> Mostrando ' + players.length + ' de ' + total + ' jugadores' +
            (filterText ? ' (filtrados)' : '') + '.</div>';

        if (hasMore && !filterText) {
            html += '<div style="text-align:center; margin-top:20px;">' +
                '<button class="ranking-tab" id="btnLoadMore" style="margin: 0 auto; display: block;">Cargar más</button>' +
                '</div>';
        }

        container.innerHTML = html;
        container.className = "ranking-loaded";
        refreshIcons();

        if (!container._imgErrBound) {
            container._imgErrBound = true;
            container.addEventListener("error", function (e) {
                if (e.target.tagName === "IMG") {
                    var span = e.target.parentNode;
                    if (span && span.classList.contains("ranking-avatar-img")) {
                        span.classList.remove("ranking-avatar-img");
                        span.textContent = e.target.getAttribute("data-initials") || "?";
                    }
                }
            }, true);
        }

        var btnLoadMore = document.getElementById("btnLoadMore");
        if (btnLoadMore) {
            btnLoadMore.addEventListener("click", function () {
                loadMoreData();
            });
        }
    }

    function filterAndRender() {
        if (!allPlayersCache.length) {
            renderRanking([]);
            return;
        }
        var filtered = allPlayersCache;
        if (filterText) {
            var q = filterText.toLowerCase();
            filtered = allPlayersCache.filter(function (p) {
                return (p.display_name || p.username || '').toLowerCase().indexOf(q) !== -1;
            });
        }
        renderRanking(filtered);
    }

    function buildFilterBar() {
        if (document.querySelector('.ranking-filter-bar')) return;
        var bar = document.createElement('div');
        bar.className = 'ranking-filter-bar';
        bar.innerHTML = '<span class="ranking-filter-icon" aria-hidden="true"><i data-lucide="search"></i></span>' +
            '<input type="text" class="ranking-filter-input" placeholder="Buscar jugador..." aria-label="Buscar jugador">';
        container.parentNode.insertBefore(bar, container);
        refreshIcons();
        var input = bar.querySelector('.ranking-filter-input');
        input.addEventListener('input', function () {
            filterText = this.value.trim();
            filterAndRender();
        });
    }

    async function loadMoreData() {
        if (isLoading || !hasMore) return;
        isLoading = true;

        var btnLoadMore = document.getElementById("btnLoadMore");
        if (btnLoadMore) {
            btnLoadMore.textContent = "Cargando...";
            btnLoadMore.disabled = true;
        }

        try {
            var client = window.AppSupabase?.db || window.AppSupabase?.client;
            if (!client) { isLoading = false; return; }
            var from = currentPage * pageSize;

            var { data, error } = await client
                .rpc("get_ranking_profiles", { p_limit: pageSize, p_offset: from });

            if (error) {
                console.warn("Error cargando más rankings:", error.message);
                isLoading = false;
                if (btnLoadMore) {
                    btnLoadMore.textContent = "Reintentar";
                    btnLoadMore.disabled = false;
                }
                return;
            }

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allPlayersCache = allPlayersCache.concat(data);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    currentPage++;
                }
            }

            filterAndRender();
        } catch (e) {
            console.error("Excepción al cargar más rankings:", e);
        } finally {
            isLoading = false;
        }
    }

    function showSkeletonRanking() {
        var html = '<div class="rank-list">';
        for (var i = 0; i < (AnimeDestiny.Constants.RANKING_SKELETON_ROWS || 5); i++) {
            html += '<div class="rank-row">' +
                '<span class="skeleton" style="width: 24px; height: 20px; margin: 0 auto;"></span>' +
                '<div class="rank-player">' +
                    '<span class="skeleton skeleton-avatar" style="width: 44px; height: 44px;"></span>' +
                    '<span class="skeleton" style="width: 130px; height: 14px;"></span>' +
                '</div>' +
                '<span class="skeleton rank-level" style="width: 70px; height: 26px;"></span>' +
                '<span class="skeleton rank-progress" style="width: 90%; height: 8px;"></span>' +
                '<span class="skeleton" style="width: 60px; height: 32px; justify-self: end;"></span>' +
            '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
        container.className = "ranking-loading";
    }

    async function loadRanking() {
        // El cliente de Supabase se carga perezosamente y SOLO si puede haber
        // sesion (__puedeHaberSesion), para no gastar cuota en visitantes. Pero
        // el ranking es publico: un invitado sin sesion se quedaba con el
        // "Cargando ranking..." eterno porque el cliente jamas llegaba. Aca se
        // fuerza la carga explicita, haya sesion o no.
        if (!window.AppSupabase?.client && typeof window.__loadSupabase === 'function') {
            try { await window.__loadSupabase(); } catch (_) { /* cae al mensaje de error de abajo */ }
        }

        if (!window.AppSupabase && window.AppSupabaseReady) {
            await window.AppSupabaseReady;
        }

        if (!window.AppSupabase && typeof window.waitForSupabase === 'function') {
            await window.waitForSupabase();
        }

        if (!window.AppSupabase) {
            container.className = "ranking-empty";
            container.textContent = "No se pudo conectar con el servidor.";
            return;
        }

        // Obtener usuario actual (si está logueado)
        try {
            if (typeof window.AppSupabase.getCurrentUser === 'function') {
                var u = await window.AppSupabase.getCurrentUser();
                if (u) currentUserId = u.id;
            }
        } catch (_) {}

        showSkeletonRanking();
        buildFilterBar();
        await loadMoreData();
    }

    loadRanking();
})();
