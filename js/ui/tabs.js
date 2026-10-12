/**
 * tabs.js
 * Pestañas con una línea que se desliza hasta la elegida.
 *
 * Adaptado del componente QTabs de Quasar Framework (MIT,
 * https://github.com/quasarframework/quasar): mismo indicador animado y
 * desplazamiento lateral cuando las pestañas no entran, en JS plano.
 *
 * Uso: un contenedor .q-tabs con botones .q-tab. La pestaña elegida se marca
 * con la clase is-active (como ya hacía cada página); este archivo agrega el
 * indicador, mantiene aria-selected al día y lo mueve cuando cambia la clase,
 * el tamaño o las fuentes. Las flechas del teclado pasan el foco entre
 * pestañas; Enter o Espacio la eligen, igual que con cualquier botón.
 *
 * Para pestañas que se pintan después de cargar la página: QTabs.attach(el).
 */
(function (window, document) {
    "use strict";

    function tabsOf(root) {
        return Array.prototype.filter.call(root.children, (el) => el.classList.contains("q-tab"));
    }

    /** Pone el indicador debajo de la pestaña elegida (o lo oculta si no hay). */
    function place(root) {
        const ind = root.__qTabsIndicator;
        if (!ind) return;
        const tabs = tabsOf(root);
        let active = null;
        tabs.forEach((tab) => {
            const on = tab.classList.contains("is-active");
            tab.setAttribute("aria-selected", on ? "true" : "false");
            tab.tabIndex = on ? 0 : -1;
            if (on) active = tab;
        });
        // Sin pestaña marcada, la primera queda alcanzable con Tab.
        if (!active && tabs[0]) tabs[0].tabIndex = 0;

        if (!active || !active.offsetWidth) {
            ind.style.opacity = "0";
            return;
        }
        ind.style.opacity = "1";
        ind.style.width = active.offsetWidth + "px";
        ind.style.transform = "translateX(" + active.offsetLeft + "px)";

        // Si la fila se desplaza de costado, que la elegida quede a la vista.
        if (root.scrollWidth > root.clientWidth) {
            const left = active.offsetLeft;
            const right = left + active.offsetWidth;
            if (left < root.scrollLeft) root.scrollLeft = left;
            else if (right > root.scrollLeft + root.clientWidth) root.scrollLeft = right - root.clientWidth;
        }
    }

    function onKeydown(e) {
        const root = e.currentTarget;
        const tabs = tabsOf(root);
        const i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        let next = -1;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next < 0) return;
        e.preventDefault();
        tabs.forEach((t, k) => { t.tabIndex = k === next ? 0 : -1; });
        tabs[next].focus();
    }

    function attach(root) {
        if (!root || root.__qTabsIndicator) return;
        root.classList.add("q-tabs");
        if (!root.getAttribute("role")) root.setAttribute("role", "tablist");
        tabsOf(root).forEach((tab) => {
            if (!tab.getAttribute("role")) tab.setAttribute("role", "tab");
        });

        const ind = document.createElement("span");
        ind.className = "q-tabs__indicator";
        ind.setAttribute("aria-hidden", "true");
        root.appendChild(ind);
        root.__qTabsIndicator = ind;

        place(root);
        // La primera ubicación va sin animación; recién después se desliza.
        window.requestAnimationFrame(() => root.classList.add("q-tabs--ready"));

        root.addEventListener("keydown", onKeydown);

        if (typeof window.MutationObserver === "function") {
            new window.MutationObserver(() => place(root))
                .observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
        }
        if (typeof window.ResizeObserver === "function") {
            new window.ResizeObserver(() => place(root)).observe(root);
        } else {
            window.addEventListener("resize", () => place(root));
        }
        // Orbitron cambia el ancho de cada pestaña cuando termina de cargar.
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => place(root)).catch(() => {});
        }
    }

    function init() {
        document.querySelectorAll(".q-tabs").forEach(attach);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.QTabs = Object.freeze({ attach, refresh: place });
})(window, document);
