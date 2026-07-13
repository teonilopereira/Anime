/**
 * comments.js
 * Sistema de comentarios para páginas de detalle (anime, manga, novelas).
 * Expone window.AnimeDestiny.Comments con la API pública.
 */
(function () {
    "use strict";

    var MAX_LENGTH = (window.AnimeDestiny?.Constants?.COMMENT_MAX_LENGTH) || 2000;
    var RATE_LIMIT  = (window.AnimeDestiny?.Constants?.COMMENT_RATE_LIMIT_MS) || 5000;
    var REF_TYPES   = (window.AnimeDestiny?.Constants?.COMMENT_REF_TYPES) || { EPISODE: 'episode', VOLUME: 'volume', CHAPTER: 'chapter' };

    var _category = "";
    var _itemId   = "";
    var _allComments = [];
    var _lastSubmit = 0;
    var _container  = null;

    var _activeRef = null;
    var _activeFilter = null;
    var _refCounts = {};
    var _sortedFilterKeys = null;

    var _cachedRefInfo = null;
    var _cachedCurrentUser = null;

    // ─── Helpers ──────────────────────────────────────────────────
    function esc(str) {
        return window.escapeHtml ? window.escapeHtml(String(str || "")) : String(str || "");
    }

    function isSignedIn() {
        return !!(window.AppSupabase?.isSignedIn?.() && window.AppSupabase?.getCurrentUserSync?.());
    }

    function getCurrentUser() {
        return window.AppSupabase?.getCurrentUserSync?.() || null;
    }

    function formatDate(iso) {
        if (!iso) return "";
        var d = new Date(iso);
        var now = new Date();
        var diffMs = now - d;
        var diffMin = Math.floor(diffMs / 60000);
        var diffHr  = Math.floor(diffMs / 3600000);
        var diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return "ahora";
        if (diffMin < 60) return diffMin + " min";
        if (diffHr < 24) return diffHr + "h";
        if (diffDay < 7) return diffDay + "d";

        return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
    }

    function getInitials(name) {
        if (!name) return "?";
        var parts = name.trim().split(/\s+/);
        return ((parts[0] && parts[0][0]) || "") + (parts.length > 1 ? parts[1][0] : "").toUpperCase();
    }

    function showToast(msg, type) {
        if (window.Toast && window.Toast[type]) {
            window.Toast[type](msg);
        }
    }

    // ─── Referencia helpers ───────────────────────────────────────
    function getItemRefInfo() {
        if (_cachedRefInfo !== null) return _cachedRefInfo;

        var item = window.__lastRenderedItem;
        var cat = window.__lastRenderedCategory || _category;
        if (!item) { _cachedRefInfo = null; return null; }

        var isAnime = cat === 'anime';
        var isMangaOrNovela = cat === 'manga' || cat === 'novelas';

        if (isAnime) {
            var temporadas = (typeof parseTemporadas === 'function') ? parseTemporadas(item) : [];
            var globalEp = 0;
            var groups = [];
            temporadas.forEach(function (t, idx) {
                var eps = Number(t.episodios || t.episodes || 0);
                if (eps > 0) {
                    var start = globalEp + 1;
                    globalEp += eps;
                    groups.push({
                        label: t.nombre || ('Temporada ' + (idx + 1)),
                        start: start,
                        end: globalEp,
                        type: REF_TYPES.EPISODE
                    });
                }
            });
            if (groups.length === 0) {
                var totalEps = Number(item.episodios || item.episodes || item.capitulos || 0);
                if (totalEps > 0) {
                    groups.push({ label: 'Capítulos', start: 1, end: totalEps, type: REF_TYPES.EPISODE });
                }
            }
            _cachedRefInfo = groups.length > 0 ? { type: REF_TYPES.EPISODE, groups: groups } : null;
            return _cachedRefInfo;
        }

        if (isMangaOrNovela) {
            var volumenes = item.volumes ?? item.volumenes ?? item.volumen ?? item.vols ?? null;
            var totalVols = (typeof parseVolumenes === 'function') ? parseVolumenes(volumenes) : 0;
            if (totalVols > 0) {
                _cachedRefInfo = {
                    type: REF_TYPES.VOLUME,
                    groups: [{ label: 'Volúmenes', start: 1, end: totalVols, type: REF_TYPES.VOLUME }]
                };
                return _cachedRefInfo;
            }
        }

        _cachedRefInfo = null;
        return null;
    }

    function refLabel(type, number) {
        if (!type || !number) return null;
        if (type === REF_TYPES.EPISODE) return 'Ep. ' + number;
        if (type === REF_TYPES.VOLUME) return 'Vol. ' + number;
        if (type === REF_TYPES.CHAPTER) return 'Cap. ' + number;
        return type + ' ' + number;
    }

    function buildRefCounts() {
        _refCounts = {};
        _allComments.forEach(function (c) {
            if (c.ref_type && c.ref_number) {
                var key = c.ref_type + ':' + c.ref_number;
                _refCounts[key] = (_refCounts[key] || 0) + 1;
            } else {
                _refCounts['general'] = (_refCounts['general'] || 0) + 1;
            }
        });
        _sortedFilterKeys = null;
    }

    function getSortedFilterKeys() {
        if (_sortedFilterKeys) return _sortedFilterKeys;
        var keys = Object.keys(_refCounts);
        keys.sort(function (a, b) {
            if (a === 'general') return -1;
            if (b === 'general') return 1;
            var pa = a.split(':');
            var pb = b.split(':');
            if (pa[0] !== pb[0]) return pa[0].localeCompare(pb[0]);
            return Number(pa[1]) - Number(pb[1]);
        });
        _sortedFilterKeys = keys;
        return keys;
    }

    // ─── Render ───────────────────────────────────────────────────
    function renderAll() {
        if (!_container) return;
        _cachedCurrentUser = getCurrentUser();

        var html = '<div class="comments-header">' +
            '<h3 class="comments-title">Comentarios</h3>' +
            '<span class="comments-count">' + _allComments.length + '</span>' +
            '</div>';

        if (isSignedIn()) {
            html += buildFormHtml(null, null);
        } else {
            html += '<div class="comments-login-hint">' +
                '<a href="Login.html">Iniciá sesión</a> para comentar.' +
                '</div>';
        }

        html += buildFilterBarHtml();

        var displayComments;
        if (_activeFilter) {
            displayComments = _allComments.filter(function (c) {
                if (c.parent_id) return false;
                if (_activeFilter === 'general') return !c.ref_type;
                return (c.ref_type + ':' + c.ref_number) === _activeFilter;
            });
        } else {
            displayComments = _allComments.filter(function (c) { return !c.parent_id; });
        }

        if (displayComments.length === 0) {
            html += '<div class="comments-empty">Todavía no hay comentarios' + (_activeFilter ? ' para esta referencia' : '') + '. Sé el primero en comentar.</div>';
        } else {
            html += '<div class="comments-list">';
            displayComments.forEach(function (c) {
                html += renderComment(c, 0);
            });
            html += '</div>';
        }

        _container.innerHTML = html;
        _cachedCurrentUser = null;
        bindEvents();
    }

    function renderComment(comment, depth) {
        var author = comment.author || {};
        var name = esc(author.display_name || author.username || "Usuario");
        var photoUrl = author.photo_url || "";
        var body = esc(comment.body);
        var date = formatDate(comment.created_at);
        var user = _cachedCurrentUser || getCurrentUser();
        var isOwn = user && comment.user_id === user.id;
        var wasEdited = comment.updated_at !== comment.created_at;
        var initials = getInitials(author.display_name || author.username);

        var avatarHtml;
        if (photoUrl) {
            avatarHtml = '<span class="comment-avatar comment-avatar-img">' +
                '<img src="' + esc(photoUrl) + '" alt="" loading="lazy" data-initials="' + esc(initials) + '">' +
                '</span>';
        } else {
            avatarHtml = '<span class="comment-avatar">' + esc(initials) + '</span>';
        }

        var refTag = '';
        if (comment.ref_type && comment.ref_number) {
            var label = refLabel(comment.ref_type, comment.ref_number);
            if (label) {
                refTag = '<span class="comment-ref-tag">' + esc(label) + '</span>';
            }
        }

        var html = '<div class="comment-card" data-comment-id="' + esc(comment.id) + '" data-depth="' + depth + '">' +
            '<div class="comment-header">' +
                avatarHtml +
                '<span class="comment-author">' + name + '</span>' +
                refTag +
                '<span class="comment-date">' + date + '</span>' +
                (wasEdited ? '<span class="comment-edited">(editado)</span>' : '') +
            '</div>' +
            '<div class="comment-body">' + body + '</div>' +
            '<div class="comment-actions">';

        if (isSignedIn()) {
            html += '<button class="comment-action-btn" data-action="reply" data-comment-id="' + esc(comment.id) + '">Responder</button>';
        }
        if (isOwn) {
            html += '<button class="comment-action-btn" data-action="edit" data-comment-id="' + esc(comment.id) + '">Editar</button>' +
                    '<button class="comment-action-btn comment-action-delete" data-action="delete" data-comment-id="' + esc(comment.id) + '">Borrar</button>';
        }

        html += '</div>';

        html += '<div class="comment-reply-form" data-reply-to="' + esc(comment.id) + '"></div>';

        var replies = _allComments.filter(function (c) {
            return c.parent_id === comment.id;
        });
        if (replies.length > 0 && depth < 3) {
            html += '<div class="comment-replies">';
            replies.forEach(function (r) {
                html += renderComment(r, depth + 1);
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function buildRefSquaresHtml(parentRef) {
        var refInfo = getItemRefInfo();
        if (!refInfo) return '';

        var selectedType = parentRef ? parentRef.type : (_activeRef ? _activeRef.type : null);
        var selectedNum  = parentRef ? parentRef.number : (_activeRef ? _activeRef.number : null);

        var html = '<div class="comment-ref-section">';
        html += '<div class="comment-ref-label">Referencia:</div>';
        html += '<div class="comment-ref-options">';

        var generalActive = (!selectedType && !selectedNum) ? ' is-selected' : '';
        html += '<button type="button" class="comment-ref-general' + generalActive + '" data-ref-action="general">General</button>';

        refInfo.groups.forEach(function (group) {
            html += '<div class="comment-ref-group">';
            if (refInfo.groups.length > 1) {
                html += '<span class="comment-ref-group-label">' + esc(group.label) + '</span>';
            }
            html += '<div class="comment-ref-squares">';
            for (var n = group.start; n <= group.end; n++) {
                var isSelected = (group.type === selectedType && n === selectedNum);
                var cls = 'comment-ref-sq cuadrado-item' + (isSelected ? ' is-selected' : '');
                html += '<button type="button" class="' + cls + '" data-ref-action="select" data-ref-type="' + esc(group.type) + '" data-ref-number="' + n + '">' +
                    String(n).padStart(2, '0') +
                    '</button>';
            }
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        html += '</div>';
        return html;
    }

    function buildFormHtml(parentId, parentRef) {
        var placeholder = parentId ? "Escribí tu respuesta..." : "Escribí un comentario...";
        var idAttr = parentId ? ' data-parent-id="' + esc(parentId) + '"' : '';
        var refSquares = isSignedIn() ? buildRefSquaresHtml(parentRef) : '';

        return '<div class="comment-form"' + idAttr + '>' +
            refSquares +
            '<textarea class="comment-input" maxlength="' + MAX_LENGTH + '" placeholder="' + placeholder + '" rows="3"></textarea>' +
            '<div class="comment-form-footer">' +
                '<span class="comment-char-count">0 / ' + MAX_LENGTH + '</span>' +
                '<button class="comment-submit-btn" data-action="submit"' + idAttr + '>Enviar</button>' +
            '</div>' +
            '</div>';
    }

    function buildFilterBarHtml() {
        var keys = getSortedFilterKeys();
        if (keys.length <= 1 && keys[0] === 'general') return '';

        var html = '<div class="comment-filter-bar">';
        var allActive = !_activeFilter ? ' is-active' : '';
        html += '<button class="comment-filter-btn' + allActive + '" data-filter="all">Todos</button>';

        if (_refCounts['general']) {
            var genActive = _activeFilter === 'general' ? ' is-active' : '';
            html += '<button class="comment-filter-btn' + genActive + '" data-filter="general">General (' + _refCounts['general'] + ')</button>';
        }

        keys.forEach(function (key) {
            if (key === 'general') return;
            var parts = key.split(':');
            var label = refLabel(parts[0], Number(parts[1]));
            if (!label) return;
            var active = _activeFilter === key ? ' is-active' : '';
            html += '<button class="comment-filter-btn' + active + '" data-filter="' + esc(key) + '">' + esc(label) + ' (' + _refCounts[key] + ')</button>';
        });

        html += '</div>';
        return html;
    }

    // ─── Eventos (delegation) ─────────────────────────────────────
    function bindEvents() {
        if (!_container || _container._eventsBound) return;
        _container._eventsBound = true;

        _container.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-action]");
            if (btn) {
                var action = btn.getAttribute("data-action");
                var commentId = btn.getAttribute("data-comment-id");

                if (action === "reply") {
                    toggleReplyForm(commentId);
                } else if (action === "edit") {
                    startEdit(commentId);
                } else if (action === "delete") {
                    confirmDelete(commentId);
                } else if (action === "submit") {
                    handleSubmit(btn);
                } else if (action === "cancel-edit") {
                    renderAll();
                } else if (action === "cancel-reply") {
                    var form = _container.querySelector('[data-reply-to="' + commentId + '"]');
                    if (form) form.innerHTML = "";
                }
                return;
            }

            var refBtn = e.target.closest("[data-ref-action]");
            if (refBtn) {
                var refAction = refBtn.getAttribute("data-ref-action");
                if (refAction === "general") {
                    _activeRef = null;
                    _updateRefSelection(null, null);
                } else if (refAction === "select") {
                    var refType = refBtn.getAttribute("data-ref-type");
                    var refNum = Number(refBtn.getAttribute("data-ref-number"));
                    _activeRef = { type: refType, number: refNum };
                    _updateRefSelection(refType, refNum);
                }
                return;
            }

            var filterBtn = e.target.closest("[data-filter]");
            if (filterBtn) {
                var filterVal = filterBtn.getAttribute("data-filter");
                _activeFilter = filterVal === 'all' ? null : filterVal;
                renderAll();
                return;
            }
        });

        _container.addEventListener("input", function (e) {
            if (e.target.classList.contains("comment-input")) {
                var counter = e.target.closest(".comment-form").querySelector(".comment-char-count");
                if (counter) {
                    counter.textContent = e.target.value.length + " / " + MAX_LENGTH;
                }
            }
        });

        if (!_container._imgErrBound) {
            _container._imgErrBound = true;
            _container.addEventListener("error", function (e) {
                if (e.target.tagName === "IMG") {
                    var span = e.target.parentNode;
                    if (span && span.classList.contains("comment-avatar-img")) {
                        span.classList.remove("comment-avatar-img");
                        span.textContent = e.target.getAttribute("data-initials") || "?";
                    }
                }
            }, true);
        }
    }

    function _updateRefSelection(type, number) {
        if (!_container) return;
        _container.querySelectorAll(".comment-ref-general, .comment-ref-sq").forEach(function (el) {
            el.classList.remove("is-selected");
        });
        if (!type && !number) {
            var genBtn = _container.querySelector(".comment-ref-general");
            if (genBtn) genBtn.classList.add("is-selected");
        } else {
            var sel = _container.querySelector('.comment-ref-sq[data-ref-type="' + type + '"][data-ref-number="' + number + '"]');
            if (sel) sel.classList.add("is-selected");
        }
    }

    function toggleReplyForm(commentId) {
        if (!_container) return;
        var formContainer = _container.querySelector('[data-reply-to="' + commentId + '"]');
        if (!formContainer) return;

        if (formContainer.innerHTML) {
            formContainer.innerHTML = "";
        } else {
            var parentComment = _allComments.find(function (c) { return c.id === commentId; });
            var parentRef = parentComment && parentComment.ref_type
                ? { type: parentComment.ref_type, number: parentComment.ref_number }
                : null;

            formContainer.innerHTML = buildFormHtml(commentId, parentRef);
            var textarea = formContainer.querySelector(".comment-input");
            if (textarea) textarea.focus();

            if (!formContainer._refBound) {
                formContainer._refBound = true;
                formContainer.addEventListener("click", function (e) {
                    var refBtn = e.target.closest("[data-ref-action]");
                    if (!refBtn) return;
                    var refAction = refBtn.getAttribute("data-ref-action");
                    if (refAction === "general") {
                        formContainer.querySelectorAll(".comment-ref-general, .comment-ref-sq").forEach(function (el) {
                            el.classList.remove("is-selected");
                        });
                        var genBtn = formContainer.querySelector(".comment-ref-general");
                        if (genBtn) genBtn.classList.add("is-selected");
                    } else if (refAction === "select") {
                        formContainer.querySelectorAll(".comment-ref-general, .comment-ref-sq").forEach(function (el) {
                            el.classList.remove("is-selected");
                        });
                        refBtn.classList.add("is-selected");
                    }
                });
            }
        }
    }

    function startEdit(commentId) {
        var comment = _allComments.find(function (c) { return c.id === commentId; });
        if (!comment) return;

        var card = _container.querySelector('[data-comment-id="' + commentId + '"]');
        if (!card) return;

        var bodyEl = card.querySelector(".comment-body");
        if (!bodyEl) return;

        var originalText = comment.body;
        bodyEl.innerHTML = '<textarea class="comment-input comment-edit-input" maxlength="' + MAX_LENGTH + '" rows="3">' + esc(originalText) + '</textarea>' +
            '<div class="comment-form-footer">' +
                '<span class="comment-char-count">' + originalText.length + ' / ' + MAX_LENGTH + '</span>' +
                '<button class="comment-submit-btn" data-action="save-edit" data-comment-id="' + esc(commentId) + '">Guardar</button>' +
                '<button class="comment-action-btn" data-action="cancel-edit" data-comment-id="' + esc(commentId) + '">Cancelar</button>' +
            '</div>';

        var textarea = bodyEl.querySelector(".comment-edit-input");
        if (textarea) textarea.focus();

        var saveBtn = bodyEl.querySelector('[data-action="save-edit"]');
        if (saveBtn) {
            saveBtn.addEventListener("click", function () {
                handleEdit(commentId, textarea.value);
            });
        }

        var cancelBtn = bodyEl.querySelector('[data-action="cancel-edit"]');
        if (cancelBtn) {
            cancelBtn.addEventListener("click", function () {
                renderAll();
            });
        }

        textarea.addEventListener("input", function () {
            var counter = bodyEl.querySelector(".comment-char-count");
            if (counter) counter.textContent = textarea.value.length + " / " + MAX_LENGTH;
        });
    }

    function confirmDelete(commentId) {
        if (!confirm("¿Borrar este comentario?")) return;
        handleDelete(commentId);
    }

    // ─── Acciones ─────────────────────────────────────────────────
    async function handleSubmit(btn) {
        var now = Date.now();
        if (now - _lastSubmit < RATE_LIMIT) {
            showToast("Esperá unos segundos antes de comentar de nuevo.", "info");
            return;
        }

        var form = btn.closest(".comment-form");
        var textarea = form.querySelector(".comment-input");
        var body = textarea.value.trim();
        var parentId = btn.getAttribute("data-parent-id") || null;

        if (!body) {
            showToast("Escribí algo antes de enviar.", "info");
            return;
        }
        if (body.length > MAX_LENGTH) {
            showToast("El comentario es demasiado largo (máximo " + MAX_LENGTH + " caracteres).", "error");
            return;
        }

        var ref = null;
        var selectedSq = form.querySelector(".comment-ref-sq.is-selected");
        if (selectedSq) {
            ref = { type: selectedSq.getAttribute("data-ref-type"), number: Number(selectedSq.getAttribute("data-ref-number")) };
        } else if (!parentId) {
            ref = _activeRef;
        }

        btn.disabled = true;
        btn.textContent = "Enviando...";

        try {
            var newComment = await window.AppSupabase.addComment(
                _category, _itemId, body, parentId,
                ref ? ref.type : null,
                ref ? ref.number : null
            );
            _lastSubmit = Date.now();

            _allComments.unshift(newComment);
            buildRefCounts();

            if (_activeFilter) {
                var matchesFilter = false;
                if (_activeFilter === 'general') {
                    matchesFilter = !newComment.ref_type;
                } else {
                    matchesFilter = (newComment.ref_type + ':' + newComment.ref_number) === _activeFilter;
                }
                if (!matchesFilter) _activeFilter = null;
            }

            renderAll();
            showToast("Comentario publicado.", "success");
        } catch (err) {
            console.error("Error enviando comentario:", err);
            showToast(err.message || "No se pudo enviar el comentario.", "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Enviar";
        }
    }

    async function handleEdit(commentId, newBody) {
        newBody = newBody.trim();
        if (!newBody) {
            showToast("El comentario no puede estar vacío.", "info");
            return;
        }
        if (newBody.length > MAX_LENGTH) {
            showToast("El comentario es demasiado largo.", "error");
            return;
        }

        try {
            await window.AppSupabase.editComment(commentId, newBody);

            var comment = _allComments.find(function (c) { return c.id === commentId; });
            if (comment) {
                comment.body = newBody;
                comment.updated_at = new Date().toISOString();
            }

            renderAll();
            showToast("Comentario editado.", "success");
        } catch (err) {
            console.error("Error editando comentario:", err);
            showToast(err.message || "No se pudo editar.", "error");
        }
    }

    async function handleDelete(commentId) {
        try {
            await window.AppSupabase.deleteComment(commentId);

            _allComments = _allComments.filter(function (c) {
                return c.id !== commentId && c.parent_id !== commentId;
            });
            buildRefCounts();

            renderAll();
            showToast("Comentario borrado.", "success");
        } catch (err) {
            console.error("Error borrando comentario:", err);
            showToast(err.message || "No se pudo borrar.", "error");
        }
    }

    // ─── Carga ────────────────────────────────────────────────────
    async function load(category, itemId) {
        _category = category || "";
        _itemId = String(itemId || "");
        _container = document.getElementById("comments-section");
        if (!_container || !_category || !_itemId) return;

        _container.innerHTML = '<div class="comments-loading">Cargando comentarios...</div>';

        try {
            _allComments = await window.AppSupabase.loadComments(_category, _itemId) || [];
            _activeRef = null;
            _activeFilter = null;
            _cachedRefInfo = null;
            buildRefCounts();
            renderAll();
        } catch (err) {
            console.error("Error cargando comentarios:", err);
            _container.innerHTML = '<div class="comments-error">No se pudieron cargar los comentarios.</div>';
        }

        if (!_container._authBound) {
            _container._authBound = true;
            window.addEventListener("supabase-auth-changed", function () {
                if (_category && _itemId) {
                    load(_category, _itemId);
                }
            });
        }
    }

    // ─── API pública ──────────────────────────────────────────────
    window.AnimeDestiny = window.AnimeDestiny || {};
    window.AnimeDestiny.Comments = { load: load };
})();
