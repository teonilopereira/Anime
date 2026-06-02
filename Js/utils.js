(function (window) {
    "use strict";

    function formatDate(value, locale = "es-AR") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat(locale).format(date);
    }

    function truncateText(value, maxLength = 140) {
        const text = String(value ?? "").trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
    }

    function parseUrlParams(search = window.location.search) {
        return Object.fromEntries(new URLSearchParams(search).entries());
    }

    function normalizeText(value) {
        return String(value ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "");
    }

    window.AppUtils = Object.freeze({
        formatDate,
        truncateText,
        parseUrlParams,
        normalizeText
    });
})(window);
