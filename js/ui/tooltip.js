/**
 * tooltip.js
 * Cartel flotante al pasar el mouse o enfocar con teclado.
 *
 * Adaptado del componente QTooltip de Quasar Framework (MIT,
 * https://github.com/quasarframework/quasar): misma animación de escala y
 * reubicación automática, pero en JS plano y con los colores de Mirudoku.
 *
 * Uso: data-tooltip="Texto". Los title="..." existentes se convierten solos
 * la primera vez que se pasa el mouse (así no aparece también el cartel
 * nativo del navegador). Si el elemento no tenía nombre accesible (un botón
 * que es solo un ícono), el texto pasa a su aria-label.
 *
 * En pantallas táctiles no se muestra: tocar ya ejecuta la acción, igual que
 * con el title nativo.
 */
(function (window, document) {
    "use strict";

    const SHOW_DELAY_MS = 300;
    const GAP_PX = 8;     // separación entre el elemento y el cartel
    const MARGIN_PX = 8;  // distancia mínima a los bordes de la pantalla
    const TIP_ID = "mirudoku-tooltip";

    let tip = null;
    let current = null;
    let showTimer = null;

    function getTip() {
        if (tip) return tip;
        tip = document.createElement("div");
        tip.className = "tooltip";
        tip.id = TIP_ID;
        tip.setAttribute("role", "tooltip");
        document.body.appendChild(tip);
        return tip;
    }

    /** Pasa title → data-tooltip y devuelve el elemento con tooltip más cercano. */
    function findTarget(node) {
        const el = node && node.closest ? node.closest("[data-tooltip], [title]") : null;
        if (!el || el.tagName === "IFRAME") return null;

        const title = el.getAttribute("title");
        if (title !== null) {
            el.removeAttribute("title");
            if (title.trim()) {
                el.setAttribute("data-tooltip", title);
                // aria-label que pusimos nosotros: se actualiza si cambia el title.
                if (!el.hasAttribute("aria-label") || el.hasAttribute("data-tooltip-label")) {
                    if (!el.textContent.trim()) {
                        el.setAttribute("aria-label", title);
                        el.setAttribute("data-tooltip-label", "");
                    }
                }
            }
        }
        return el.getAttribute("data-tooltip") ? el : null;
    }

    function position(el) {
        const rect = el.getBoundingClientRect();
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;

        // Arriba por defecto; si no entra, abajo (Quasar hace lo mismo).
        let top = rect.top - h - GAP_PX;
        let placement = "top";
        if (top < MARGIN_PX) {
            top = rect.bottom + GAP_PX;
            placement = "bottom";
        }
        const maxLeft = window.innerWidth - w - MARGIN_PX;
        const left = Math.max(MARGIN_PX, Math.min(rect.left + rect.width / 2 - w / 2, maxLeft));

        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
        tip.dataset.placement = placement;
    }

    function show(el) {
        if (!el.isConnected) return;
        const text = el.getAttribute("data-tooltip");
        if (!text) return;

        current = el;
        getTip().textContent = text;
        position(el);
        tip.classList.add("is-visible");
        if (!el.hasAttribute("aria-describedby") && el.getAttribute("aria-label") !== text) {
            el.setAttribute("aria-describedby", TIP_ID);
        }
    }

    function hide() {
        clearTimeout(showTimer);
        showTimer = null;
        if (current && current.getAttribute("aria-describedby") === TIP_ID) {
            current.removeAttribute("aria-describedby");
        }
        current = null;
        if (tip) tip.classList.remove("is-visible");
    }

    function schedule(el) {
        if (el === current) return;
        hide();
        showTimer = setTimeout(() => show(el), SHOW_DELAY_MS);
    }

    document.addEventListener("pointerover", (e) => {
        if (e.pointerType === "touch") return;
        const el = findTarget(e.target);
        if (el) schedule(el);
    });

    document.addEventListener("pointerout", (e) => {
        const el = findTarget(e.target);
        if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
        hide();
    });

    // Solo foco de teclado: el foco que deja un clic no muestra el cartel.
    document.addEventListener("focusin", (e) => {
        const el = findTarget(e.target);
        if (!el) return;
        let visible = true;
        try { visible = el.matches(":focus-visible"); } catch (_) { /* navegador viejo */ }
        if (visible) show(el);
    });

    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, { passive: true });
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hide();
    });

    window.Tooltip = Object.freeze({ show, hide });
})(window, document);
