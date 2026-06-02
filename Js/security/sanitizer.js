(function (window) {
    "use strict";

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function stripTags(value) {
        const template = document.createElement("template");
        template.innerHTML = String(value ?? "");
        return template.content.textContent || "";
    }

    function sanitizeText(value) {
        return escapeHtml(stripTags(value)).trim();
    }

    window.AppSanitizer = Object.freeze({
        escapeHtml,
        stripTags,
        sanitizeText
    });

    if (typeof window.escapeHtml !== "function") {
        window.escapeHtml = escapeHtml;
    }
})(window);
