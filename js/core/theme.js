/**
 * theme.js — Conmutador de tema (automático / claro / oscuro).
 *
 * Se carga SINCRÓNICAMENTE y temprano en <head> para aplicar la preferencia
 * antes del primer render y evitar el parpadeo (FOUC). El CSS ya resuelve el
 * modo "automático" vía @media (prefers-color-scheme); acá sólo forzamos el
 * atributo data-theme en <html> cuando el usuario eligió claro u oscuro.
 *
 * Preferencia en localStorage["pref:theme"]: 'auto' | 'light' | 'dark'.
 *
 * También aplica los fondos neón (pref:bgMode = 'neon', pref:bgNeon = id) con
 * <html data-bg-neon="id">. Son fondos oscuros, así que fuerzan el tema oscuro
 * mientras están activos; los estilos viven en css/theme.css.
 */
(function () {
    "use strict";

    var KEY = "pref:theme";
    var root = document.documentElement;
    var NEON = ["synthwave", "lluvia", "holo", "circuito", "tokio", "glitch"];

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

    function readNeon() {
        try {
            if (localStorage.getItem("pref:bgMode") !== "neon") return "";
            var v = localStorage.getItem("pref:bgNeon");
            return NEON.indexOf(v) >= 0 ? v : NEON[0];
        } catch (e) {
            return "";
        }
    }

    function updateThemeColorMeta(pref) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        var dark = pref === "dark" || (pref === "auto" && systemIsDark());
        meta.setAttribute("content", dark ? "#bc13fe" : "#8a10cf");
    }

    function apply(pref) {
        var neon = readNeon();
        if (neon) {
            root.setAttribute("data-bg-neon", neon);
            pref = "dark";
        } else {
            root.removeAttribute("data-bg-neon");
        }
        // 'auto' quita el atributo y deja decidir a prefers-color-scheme.
        if (pref === "light" || pref === "dark") root.setAttribute("data-theme", pref);
        else root.removeAttribute("data-theme");
        updateThemeColorMeta(pref);
    }

    // Aplicación inmediata (antes del render).
    apply(read());

    window.AppTheme = {
        get: read,
        neonIds: NEON.slice(),
        // Reaplica tema y fondo neón tras cambiar pref:bgMode / pref:bgNeon.
        refresh: function () { apply(read()); },
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
