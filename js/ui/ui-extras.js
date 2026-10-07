/**
 * ui-extras.js
 * Piezas de interfaz chicas inspiradas en Quasar, hechas a mano (sin Vue):
 *
 *   - window.Dialog: confirm/alert propios con el estilo del sitio, en lugar de
 *     las ventanas del navegador (QDialog). Devuelven una Promise.
 *   - Botón "Volver arriba" que aparece al bajar bastante (QPageScroller).
 *   - Onda al tocar botones y cards (v-ripple).
 *
 * Va en el core bundle y se carga suelto en las páginas que no lo usan pero
 * necesitan alguna de estas piezas (configuracion.html).
 */
(function (window, document) {
    "use strict";

    function tr(key, fallback) {
        var i18n = window.AppI18n;
        if (i18n && typeof i18n.t === "function") {
            var out = i18n.t(key);
            if (out && out.charAt(0) !== "[") return out;
        }
        return fallback;
    }

    function prefersReducedMotion() {
        if (document.body && document.body.classList.contains("reduce-motion")) return true;
        return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    // ─── Diálogos ────────────────────────────────────────────────────────

    /**
     * Abre un diálogo modal. Usa <dialog> nativo: trae foco atrapado, Esc para
     * cerrar y capa superior sin pelearse con z-index.
     * @returns {Promise<boolean>} true si se aceptó.
     */
    function open(opts) {
        var dlg = document.createElement("dialog");
        dlg.className = "ad-dialog" + (opts.danger ? " ad-dialog--danger" : "");

        var box = document.createElement("form");
        box.method = "dialog";
        box.className = "ad-dialog-box";

        if (opts.title) {
            var h = document.createElement("h2");
            h.className = "ad-dialog-title";
            h.id = "ad-dialog-title-" + Date.now();
            h.textContent = opts.title;
            dlg.setAttribute("aria-labelledby", h.id);
            box.appendChild(h);
        }

        var msg = document.createElement("p");
        msg.className = "ad-dialog-msg";
        msg.textContent = opts.message;
        if (!opts.title) dlg.setAttribute("aria-label", opts.message);
        box.appendChild(msg);

        var actions = document.createElement("div");
        actions.className = "ad-dialog-actions";

        var cancel = null;
        if (opts.cancelLabel) {
            cancel = document.createElement("button");
            cancel.type = "submit";
            cancel.value = "cancel";
            cancel.className = "ad-dialog-btn ad-dialog-btn--ghost";
            cancel.textContent = opts.cancelLabel;
            actions.appendChild(cancel);
        }

        var ok = document.createElement("button");
        ok.type = "submit";
        ok.value = "ok";
        ok.className = "ad-dialog-btn ad-dialog-btn--primary";
        ok.textContent = opts.okLabel;
        actions.appendChild(ok);

        box.appendChild(actions);
        dlg.appendChild(box);
        document.body.appendChild(dlg);

        var previousFocus = document.activeElement;

        return new Promise(function (resolve) {
            var done = false;
            function finish(result) {
                if (done) return;
                done = true;
                if (dlg.open && typeof dlg.close === "function") dlg.close();
                dlg.remove();
                if (previousFocus && typeof previousFocus.focus === "function") {
                    try { previousFocus.focus(); } catch (e) { /* el nodo ya no está */ }
                }
                resolve(result);
            }

            box.addEventListener("submit", function (e) {
                e.preventDefault();
                var submitter = e.submitter || document.activeElement;
                finish(!!submitter && submitter.value === "ok");
            });
            // Esc
            dlg.addEventListener("cancel", function (e) {
                e.preventDefault();
                finish(false);
            });
            // Tocar el fondo oscuro cierra, como en Quasar.
            dlg.addEventListener("click", function (e) {
                if (e.target === dlg) finish(false);
            });

            if (typeof dlg.showModal === "function") {
                dlg.showModal();
            } else {
                dlg.setAttribute("open", "");
            }
            // En confirmaciones peligrosas el foco arranca en Cancelar, así un
            // Enter apurado no borra nada.
            var first = opts.danger && cancel ? cancel : ok;
            first.focus();
        });
    }

    function normalize(input) {
        return typeof input === "string" ? { message: input } : (input || {});
    }

    var Dialog = Object.freeze({
        /**
         * Dialog.confirm("¿Borrar?") o Dialog.confirm({ title, message, okLabel, cancelLabel, danger })
         * @returns {Promise<boolean>}
         */
        confirm: function (input) {
            var o = normalize(input);
            return open({
                title: o.title,
                message: o.message || "",
                okLabel: o.okLabel || tr("ui.aceptar", "Aceptar"),
                cancelLabel: o.cancelLabel || tr("ui.cancelar", "Cancelar"),
                danger: !!o.danger,
            });
        },
        /** @returns {Promise<void>} */
        alert: function (input) {
            var o = normalize(input);
            return open({
                title: o.title,
                message: o.message || "",
                okLabel: o.okLabel || tr("ui.aceptar", "Aceptar"),
                cancelLabel: null,
            }).then(function () {});
        },
    });

    window.Dialog = Dialog;

    // ─── Volver arriba ───────────────────────────────────────────────────

    function initScrollTop() {
        if (document.querySelector(".scroll-top-btn")) return;

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scroll-top-btn";
        btn.setAttribute("aria-label", tr("ui.volver_arriba", "Volver arriba"));
        btn.title = tr("ui.volver_arriba", "Volver arriba");
        btn.setAttribute("data-no-ripple", "");
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
            '<path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btn.tabIndex = -1;
        document.body.appendChild(btn);

        btn.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        });

        var visible = false;
        var ticking = false;
        function update() {
            ticking = false;
            // Aparece pasada una pantalla y media: antes, volver arriba es un
            // gesto corto y el botón solo estorba.
            var show = window.scrollY > window.innerHeight * 1.5;
            if (show === visible) return;
            visible = show;
            btn.classList.toggle("is-visible", show);
            btn.tabIndex = show ? 0 : -1;
        }
        window.addEventListener("scroll", function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }, { passive: true });
        update();
    }

    // ─── Ripple ──────────────────────────────────────────────────────────

    var RIPPLE_SELECTOR = "button, .btn, [role='button'], .card-container, .home-carousel-more";

    function onPointerDown(e) {
        if (e.button !== 0 || prefersReducedMotion()) return;
        var el = e.target.closest && e.target.closest(RIPPLE_SELECTOR);
        if (!el || el.disabled || el.closest("[data-no-ripple]")) return;

        // La onda va dentro de una capa propia que recorta con el borde del
        // elemento. Así no hace falta ponerle overflow:hidden al botón (cortaría
        // badges o menús que asoman) y solo se toca su position si es static.
        if (window.getComputedStyle(el).position === "static") {
            el.classList.add("ripple-anchor");
        }
        var host = document.createElement("span");
        host.className = "ripple-host";
        host.setAttribute("aria-hidden", "true");

        var rect = el.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 2;
        var wave = document.createElement("span");
        wave.className = "ripple-wave";
        wave.style.width = wave.style.height = size + "px";
        wave.style.left = (e.clientX - rect.left - size / 2) + "px";
        wave.style.top = (e.clientY - rect.top - size / 2) + "px";
        host.appendChild(wave);
        el.appendChild(host);

        function cleanup() {
            host.remove();
            if (!el.querySelector(".ripple-host")) el.classList.remove("ripple-anchor");
        }
        wave.addEventListener("animationend", cleanup, { once: true });
        // Por si la animación no corre (pestaña en segundo plano).
        window.setTimeout(cleanup, 900);
    }

    function init() {
        initScrollTop();
        document.addEventListener("pointerdown", onPointerDown, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})(window, document);
