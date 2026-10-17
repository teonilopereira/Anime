/**
 * ripple.js
 * Onda al tocar un botón (el "ripple" de Material Design).
 *
 * Adaptado de la directiva v-ripple de Quasar Framework (MIT,
 * https://github.com/quasarframework/quasar): misma geometría y tiempos,
 * pero en JS plano y con los colores de Mirudoku.
 *
 * Se aplica solo, por delegación, a: button, [role="button"], .btn,
 * [data-ripple] e inputs tipo botón. Para apagarlo: data-no-ripple (en el
 * elemento o en un contenedor). También se apaga con "Reducir movimiento",
 * del sistema o de Configuración (body.reduce-motion). El color sale del
 * texto del botón (currentColor); se cambia con la variable CSS --ripple-color.
 *
 * La onda NO se inserta dentro del botón: va en una capa fija encima de él.
 * Quasar le pone position:relative + overflow:hidden al botón, y acá eso
 * rompería badges e íconos posicionados en muchos botones del sitio.
 */
(function (window, document) {
    "use strict";

    const SELECTOR = 'button, [role="button"], .btn, [data-ripple], input[type="button"], input[type="submit"]';
    // Tiempos de Quasar: la onda crece 225ms y se desvanece en 250ms.
    const LEAVE_AFTER_MS = 250;
    const REMOVE_AFTER_MS = 275;

    const reduceMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    function findTarget(node) {
        const el = node && node.closest ? node.closest(SELECTOR) : null;
        if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return null;
        if (el.closest("[data-no-ripple]")) return null;
        return el;
    }

    /** Dispara la onda sobre `el`, naciendo en (x, y) en coordenadas de viewport. */
    function ripple(el, x, y) {
        if (reduceMotion && reduceMotion.matches) return;
        if (document.body && document.body.classList.contains("reduce-motion")) return;

        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const cs = window.getComputedStyle(el);
        const layer = document.createElement("span");
        layer.className = "ripple-layer";
        layer.setAttribute("aria-hidden", "true");
        layer.style.left = `${rect.left}px`;
        layer.style.top = `${rect.top}px`;
        layer.style.width = `${rect.width}px`;
        layer.style.height = `${rect.height}px`;
        layer.style.borderRadius = cs.borderRadius;
        layer.style.color = cs.getPropertyValue("--ripple-color").trim() || cs.color;

        // Igual que Quasar: un círculo que cubre la diagonal del botón, que
        // nace chico donde tocaste y termina centrado.
        const diameter = 2 * Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const radius = diameter / 2;
        const startX = x - rect.left - radius;
        const startY = y - rect.top - radius;
        const centerX = (rect.width - diameter) / 2;
        const centerY = (rect.height - diameter) / 2;

        const wave = document.createElement("span");
        wave.className = "ripple-wave";
        wave.style.width = `${diameter}px`;
        wave.style.height = `${diameter}px`;
        wave.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale3d(.2, .2, 1)`;

        layer.appendChild(wave);
        document.body.appendChild(layer);

        // Forzar el layout para que la transición arranque desde el estado inicial.
        void wave.offsetWidth;
        wave.classList.add("ripple-wave--enter");
        wave.style.transform = `translate3d(${centerX}px, ${centerY}px, 0)`;

        setTimeout(() => {
            wave.classList.remove("ripple-wave--enter");
            wave.classList.add("ripple-wave--leave");
            setTimeout(() => layer.remove(), REMOVE_AFTER_MS);
        }, LEAVE_AFTER_MS);
    }

    document.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const el = findTarget(e.target);
        if (el) ripple(el, e.clientX, e.clientY);
    }, { passive: true });

    // Con teclado (Enter/Espacio) la onda nace en el centro, como en Quasar.
    document.addEventListener("keydown", (e) => {
        if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
        const el = findTarget(e.target);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        ripple(el, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    window.Ripple = Object.freeze({ trigger: ripple });
})(window, document);
