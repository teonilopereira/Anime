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

    function getMedal(rank) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    }

    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        return (parts[0][0] || '') + (parts.length > 1 ? parts[1][0] : '').toUpperCase();
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

        var html = '<table class="ranking-table"><thead><tr>' +
            '<th style="width:50px">#</th>' +
            '<th>Jugador</th>' +
            '<th style="width:70px">Nivel</th>' +
            '<th style="width:120px;text-align:right">EXP Total</th>' +
            '</tr></thead><tbody>';

        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var name = escapeHtml(p.display_name || p.username || "Jugador");
            var level = p.level != null ? p.level : 1;
            var exp = p.exp != null ? p.exp : 0;
            var rank = i + 1;
            var medal = getMedal(rank);
            var isCurrentUser = currentUserId && (p.id === currentUserId);
            var photoUrl = p.photo_url || '';

            var avatarHtml;
            if (photoUrl) {
                var initials = escapeHtml(getInitials(p.display_name || p.username));
                avatarHtml = '<span class="ranking-avatar ranking-avatar-img">' +
                    '<img src="' + escapeHtml(photoUrl) + '" alt="" loading="lazy" data-initials="' + initials + '">' +
                    '</span>';
            } else {
                avatarHtml = '<span class="ranking-avatar">' + escapeHtml(getInitials(p.display_name || p.username)) + '</span>';
            }

            html += '<tr class="' + (isCurrentUser ? 'ranking-row-own' : '') + '">' +
                '<td class="ranking-rank">' + (medal || rank) + '</td>' +
                '<td class="ranking-name">' +
                    avatarHtml + ' ' + name +
                    (isCurrentUser ? ' <span class="ranking-badge">TÚ</span>' : '') +
                '</td>' +
                '<td class="ranking-level">' + level + '</td>' +
                '<td class="ranking-exp">' + exp.toLocaleString() + '</td>' +
                '</tr>';
        }

        html += '</tbody></table>';

        var total = allPlayersCache.length;
        html += '<div class="ranking-footer">Mostrando ' + players.length + ' de ' + total + ' jugadores' +
            (filterText ? ' (filtrados)' : '') + '.</div>';

        if (hasMore && !filterText) {
            html += '<div style="text-align:center; margin-top:20px;">' +
                '<button class="ranking-tab" id="btnLoadMore" style="margin: 0 auto; display: block;">Cargar más</button>' +
                '</div>';
        }

        container.innerHTML = html;
        container.className = "ranking-loaded";

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
        bar.innerHTML = '<input type="text" class="ranking-filter-input" placeholder="Buscar jugador..." aria-label="Buscar jugador">';
        container.parentNode.insertBefore(bar, container);
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
        var html = '<table class="ranking-table"><thead><tr>' +
            '<th style="width:50px">#</th>' +
            '<th>Jugador</th>' +
            '<th style="width:70px">Nivel</th>' +
            '<th style="width:120px;text-align:right">EXP Total</th>' +
            '</tr></thead><tbody>';

        for (var i = 0; i < (AnimeDestiny.Constants.RANKING_SKELETON_ROWS || 5); i++) {
            html += '<tr>' +
                '<td><span class="skeleton" style="width: 20px; height: 18px;"></span></td>' +
                '<td>' +
                    '<span class="skeleton skeleton-avatar"></span> ' +
                    '<span class="skeleton" style="width: 120px; height: 14px; vertical-align: middle;"></span>' +
                '</td>' +
                '<td><span class="skeleton" style="width: 30px; height: 14px;"></span></td>' +
                '<td><div style="text-align:right"><span class="skeleton" style="width: 60px; height: 14px;"></span></div></td>' +
                '</tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
        container.className = "ranking-loading";
    }

    async function loadRanking() {
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
