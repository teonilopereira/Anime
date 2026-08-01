/**
 * theme.js — Conmutador de tema (automático / claro / oscuro).
 *
 * Se carga SINCRÓNICAMENTE y temprano en <head> para aplicar la preferencia
 * antes del primer render y evitar el parpadeo (FOUC). El CSS ya resuelve el
 * modo "automático" vía @media (prefers-color-scheme); acá sólo forzamos el
 * atributo data-theme en <html> cuando el usuario eligió claro u oscuro.
 *
 * Preferencia en localStorage["pref:theme"]: 'auto' | 'light' | 'dark'.
 */
(function () {
    "use strict";

    var KEY = "pref:theme";
    var root = document.documentElement;

    function read() {
        try {
            var v = localStorage.getItem(KEY);
            return (v === "light" || v === "dark" || v === "auto") ? v : "auto";
        } catch (e) {
            return "auto";
        }
    }

    function systemIsDark() {
        try {
            return !window.matchMedia("(prefers-color-scheme: light)").matches;
        } catch (e) {
            return true; // el sitio es oscuro por defecto
        }
    }

    function updateThemeColorMeta(pref) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        var dark = pref === "dark" || (pref === "auto" && systemIsDark());
        meta.setAttribute("content", dark ? "#bc13fe" : "#8a10cf");
    }

    function apply(pref) {
        // 'auto' quita el atributo y deja decidir a prefers-color-scheme.
        if (pref === "light" || pref === "dark") root.setAttribute("data-theme", pref);
        else root.removeAttribute("data-theme");
        updateThemeColorMeta(pref);
    }

    // Aplicación inmediata (antes del render).
    apply(read());

    window.AppTheme = {
        get: read,
        set: function (pref) {
            if (pref !== "light" && pref !== "dark" && pref !== "auto") return;
            try { localStorage.setItem(KEY, pref); } catch (e) { /* almacenamiento no disponible */ }
            apply(pref);
            try {
                window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: pref } }));
            } catch (e) { /* CustomEvent no soportado */ }
        }
    };
})();
