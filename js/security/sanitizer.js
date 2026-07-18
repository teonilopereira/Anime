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

    function safeUrl(value) {
        if (!value) return "";
        var url = String(value).trim();
        // Rechazar caracteres que rompen un atributo src="..." entrecomillado
        // o el tag (defensa XSS por breakout). Se permiten espacios y comillas
        // simples porque los data:image/svg de fallback los usan y son inocuos
        // dentro de un atributo con comillas dobles.
        if (/["`<>\\]/.test(url) || /[\x00-\x1f\x7f]/.test(url)) {
            return "";
        }
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

    window.escapeHtml = escapeHtml;
    window.safeUrl = safeUrl;
})(window);
