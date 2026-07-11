/**
 * comments.js
 * Sistema de comentarios para páginas de detalle (anime, manga, novelas).
 * Expone window.AnimeDestiny.Comments con la API pública.
 */
(function () {
    "use strict";

    var MAX_LENGTH = (window.AnimeDestiny?.Constants?.COMMENT_MAX_LENGTH) || 2000;
    var RATE_LIMIT  = (window.AnimeDestiny?.Constants?.COMMENT_RATE_LIMIT_MS) || 5000;

    var _category = "";
    var _itemId   = "";
    var _comments = [];
    var _lastSubmit = 0;
    var _container  = null;

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

    // ─── Render ───────────────────────────────────────────────────
    function renderAll() {
        if (!_container) return;

        var html = '<div class="comments-header">' +
            '<h3 class="comments-title">Comentarios</h3>' +
            '<span class="comments-count">' + _comments.length + '</span>' +
            '</div>';

        // Formulario de nuevo comentario
        if (isSignedIn()) {
            html += buildFormHtml(null);
        } else {
            html += '<div class="comments-login-hint">' +
                '<a href="Login.html">Iniciá sesión</a> para comentar.' +
                '</div>';
        }

        // Lista de comentarios (solo top-level, replies se anidan)
        var topLevel = _comments.filter(function (c) { return !c.parent_id; });
        if (topLevel.length === 0) {
            html += '<div class="comments-empty">Todavía no hay comentarios. Sé el primero en comentar.</div>';
        } else {
            html += '<div class="comments-list">';
            topLevel.forEach(function (c) {
                html += renderComment(c, 0);
            });
            html += '</div>';
        }

        _container.innerHTML = html;
        bindEvents();
    }

    function renderComment(comment, depth) {
        var author = comment.author || {};
        var name = esc(author.display_name || author.username || "Usuario");
        var photoUrl = author.photo_url || "";
        var body = esc(comment.body);
        var date = formatDate(comment.created_at);
        var user = getCurrentUser();
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

        var html = '<div class="comment-card" data-comment-id="' + esc(comment.id) + '" data-depth="' + depth + '">' +
            '<div class="comment-header">' +
                avatarHtml +
                '<span class="comment-author">' + name + '</span>' +
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

        // Inline reply form placeholder
        html += '<div class="comment-reply-form" data-reply-to="' + esc(comment.id) + '"></div>';

        // Replies (hijos de este comentario)
        var replies = _comments.filter(function (c) { return c.parent_id === comment.id; });
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

    function buildFormHtml(parentId) {
        var placeholder = parentId ? "Escribí tu respuesta..." : "Escribí un comentario...";
        var idAttr = parentId ? ' data-parent-id="' + esc(parentId) + '"' : '';
        return '<div class="comment-form"' + idAttr + '>' +
            '<textarea class="comment-input" maxlength="' + MAX_LENGTH + '" placeholder="' + placeholder + '" rows="3"></textarea>' +
            '<div class="comment-form-footer">' +
                '<span class="comment-char-count">0 / ' + MAX_LENGTH + '</span>' +
                '<button class="comment-submit-btn" data-action="submit"' + idAttr + '>Enviar</button>' +
            '</div>' +
            '</div>';
    }

    // ─── Eventos (delegation) ─────────────────────────────────────
    function bindEvents() {
        if (!_container || _container._eventsBound) return;
        _container._eventsBound = true;

        _container.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-action]");
            if (!btn) return;

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
        });

        _container.addEventListener("input", function (e) {
            if (e.target.classList.contains("comment-input")) {
                var counter = e.target.closest(".comment-form").querySelector(".comment-char-count");
                if (counter) {
                    counter.textContent = e.target.value.length + " / " + MAX_LENGTH;
                }
            }
        });

        // Image error delegation
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

    function toggleReplyForm(commentId) {
        if (!_container) return;
        var formContainer = _container.querySelector('[data-reply-to="' + commentId + '"]');
        if (!formContainer) return;

        if (formContainer.innerHTML) {
            formContainer.innerHTML = "";
        } else {
            formContainer.innerHTML = buildFormHtml(commentId);
            var textarea = formContainer.querySelector(".comment-input");
            if (textarea) textarea.focus();
        }
    }

    function startEdit(commentId) {
        var comment = _comments.find(function (c) { return c.id === commentId; });
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

        // Bind save-edit
        var saveBtn = bodyEl.querySelector('[data-action="save-edit"]');
        if (saveBtn) {
            saveBtn.addEventListener("click", function () {
                handleEdit(commentId, textarea.value);
            });
        }

        // Bind cancel-edit
        var cancelBtn = bodyEl.querySelector('[data-action="cancel-edit"]');
        if (cancelBtn) {
            cancelBtn.addEventListener("click", function () {
                renderAll();
            });
        }

        // Char count
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

        btn.disabled = true;
        btn.textContent = "Enviando...";

        try {
            var newComment = await window.AppSupabase.addComment(_category, _itemId, body, parentId);
            _lastSubmit = Date.now();

            // Agregar al inicio de la lista
            _comments.unshift(newComment);

            // Si es reply, reorganizar
            if (parentId) {
                var parentCard = _container.querySelector('[data-comment-id="' + parentId + '"]');
                if (parentCard) {
                    var replyContainer = parentCard.querySelector(".comment-replies");
                    if (!replyContainer) {
                        replyContainer = document.createElement("div");
                        replyContainer.className = "comment-replies";
                        parentCard.appendChild(replyContainer);
                    }
                }
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

            // Actualizar en memoria
            var comment = _comments.find(function (c) { return c.id === commentId; });
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

            // Quitar de memoria (y replies en cascada)
            _comments = _comments.filter(function (c) {
                return c.id !== commentId && c.parent_id !== commentId;
            });

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
            _comments = await window.AppSupabase.loadComments(_category, _itemId) || [];
            renderAll();
        } catch (err) {
            console.error("Error cargando comentarios:", err);
            _container.innerHTML = '<div class="comments-error">No se pudieron cargar los comentarios.</div>';
        }

        // Recargar al cambiar de sesión
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
