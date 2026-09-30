/**
 * toast.js
 * Componente modular de notificaciones flotantes premium (Toasts).
 * Expone window.Toast de forma global.
 */
(function (window) {
    "use strict";

    let container = null;

    function getContainer() {
        if (container) return container;
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
        return container;
    }

    const Icons = {
        success: "✓",
        error: "✕",
        info: "ℹ",
        warning: "⚠"
    };

    function showToast(message, type = "info", duration = AnimeDestiny.Constants.TOAST_DURATION_MS || 4000, action = null) {
        const parent = getContainer();

        const toast = document.createElement("div");
        toast.className = `toast-item toast-${type}`;

        const iconEl = document.createElement("span");
        iconEl.className = "toast-icon";
        iconEl.textContent = Icons[type] || "•";
        toast.appendChild(iconEl);

        const msgEl = document.createElement("span");
        msgEl.className = "toast-message";
        msgEl.textContent = message;
        toast.appendChild(msgEl);

        if (action && action.label && action.href) {
            const actionEl = document.createElement("a");
            actionEl.className = "toast-action";
            actionEl.href = action.href;
            actionEl.textContent = action.label;
            toast.appendChild(actionEl);
        }

        const closeBtn = document.createElement("button");
        closeBtn.className = "toast-close";
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.ariaLabel = "Cerrar notificación";
        closeBtn.addEventListener("click", () => dismissToast(toast));
        toast.appendChild(closeBtn);

        parent.appendChild(toast);

        // Disparar animación de entrada en el siguiente frame
        requestAnimationFrame(() => {
            toast.classList.add("is-visible");
        });

        // Temporizador de autodestrucción
        let timer = setTimeout(() => {
            dismissToast(toast);
        }, duration);

        // Pausar auto-dismiss al pasar el mouse por encima
        toast.addEventListener("mouseenter", () => clearTimeout(timer));
        toast.addEventListener("mouseleave", () => {
            timer = setTimeout(() => dismissToast(toast), duration / 2);
        });
    }

    function dismissToast(toast) {
        if (!toast || toast.classList.contains("is-leaving")) return;
        toast.classList.remove("is-visible");
        toast.classList.add("is-leaving");

        function remove() {
            clearTimeout(fallback);
            toast.remove();
            // Limpiar el contenedor si queda vacío
            if (container && container.childNodes.length === 0) {
                container.remove();
                container = null;
            }
        }

        // Remover del DOM al finalizar la animación. `once` porque la
        // transicion anima dos propiedades (opacity y transform) y el evento
        // llega una vez por cada una.
        toast.addEventListener("transitionend", remove, { once: true });

        // Red de seguridad: si el aviso no llega a transicionar (pestaña en
        // segundo plano, transiciones desactivadas por el sistema), el evento
        // no se dispara nunca y el nodo se queda en el DOM para siempre.
        var fallback = setTimeout(remove, 400);
    }

    // Invitado que toca algo que necesita cuenta (me gusta, visto, estado):
    // antes lo mandábamos al Login de golpe, sin explicar por qué y perdiendo
    // lo que estaba mirando. Ahora le avisamos y el botón lo lleva al Login con
    // ?return= para volver a esta misma página después de entrar. Va aparte de
    // window.Toast porque la mascota reemplaza ese objeto y perdería el botón.
    let lastLoginPrompt = 0;
    function pedirLogin(message) {
        const now = Date.now();
        if (now - lastLoginPrompt < 1500) return;
        lastLoginPrompt = now;
        const en = (document.documentElement.lang || "").toLowerCase().startsWith("en");
        const here = window.location.pathname.split("/").pop() + window.location.search + window.location.hash;
        showToast(
            message || (en ? "Sign in to save it to your lists." : "Iniciá sesión para guardarlo en tus listas."),
            "info",
            6000,
            { label: en ? "Sign in" : "Entrar", href: "Login.html?return=" + encodeURIComponent(here) }
        );
    }
    window.pedirLogin = pedirLogin;

    // Exponer API global
    window.Toast = Object.freeze({
        success: (msg, dur) => showToast(msg, "success", dur),
        error:   (msg, dur) => showToast(msg, "error", dur),
        info:    (msg, dur) => showToast(msg, "info", dur),
        warning: (msg, dur) => showToast(msg, "warning", dur)
    });

})(window);
