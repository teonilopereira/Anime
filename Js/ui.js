(function (window, document) {
    "use strict";

    function showElement(element) {
        if (element) element.hidden = false;
    }

    function hideElement(element) {
        if (element) element.hidden = true;
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.display = "flex";
        modal.removeAttribute("hidden");
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.style.display = "none";
        modal.setAttribute("hidden", "");
    }

    function setLoading(element, isLoading, text = "Cargando...") {
        if (!element) return;
        element.setAttribute("aria-busy", isLoading ? "true" : "false");
        if (isLoading) element.dataset.loadingText = text;
    }

    // Cargar dinámicamente estilos y script de Toasts
    (function initToasts() {
        if (typeof document !== "undefined" && !document.getElementById("toast-styles-link")) {
            const link = document.createElement("link");
            link.id = "toast-styles-link";
            link.rel = "stylesheet";
            link.href = "css/toast.css";
            document.head.appendChild(link);
            
            const script = document.createElement("script");
            script.src = "js/ui/toast.js";
            document.head.appendChild(script);
        }
    })();

    window.AppUI = Object.freeze({
        showElement,
        hideElement,
        openModal,
        closeModal,
        setLoading
    });
})(window, document);
