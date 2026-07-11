(function (window) {
    "use strict";

    function escapeHtml(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function stripTags(value) {
        const template = document.createElement("template");
        template.innerHTML = String(value ?? "");
        return template.content.textContent || "";
    }

    function sanitizeText(value) {
        return escapeHtml(stripTags(value)).trim();
    }

    function safeUrl(value) {
        if (!value) return "";
        var url = String(value).trim();
        // Permitir rutas relativas locales y data URIs de imagen usadas como fallback.
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === "http:" ||
                parsed.protocol === "https:" ||
                (parsed.protocol === "data:" && url.toLowerCase().startsWith("data:image/"))
            ) {
                return url;
            }
        } catch (_) { }
        return "";
    }

    window.AppSanitizer = Object.freeze({
        escapeHtml,
        stripTags,
        sanitizeText,
        safeUrl
    });

    window.escapeHtml = escapeHtml;
    window.safeUrl = safeUrl;
})(window);

