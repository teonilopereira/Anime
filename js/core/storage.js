/**
 * storage.js — Wrapper de localStorage con soporte JSON.
 * Disponible como window.AppStorage para uso futuro (persistencia offline, cache).
 */
(function (window) {
    "use strict";

    var PREFIX = (window.AppConfig && window.AppConfig.cachePrefix) || "animeDestiny";

    function read(key) {
        try { return localStorage.getItem(PREFIX + ":" + key); } catch (_) { return null; }
    }

    function write(key, value) {
        try { localStorage.setItem(PREFIX + ":" + key, String(value)); } catch (_) {}
    }

    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(PREFIX + ":" + key);
            return raw ? JSON.parse(raw) : (fallback || null);
        } catch (_) { return fallback || null; }
    }

    function writeJson(key, obj) {
        try { localStorage.setItem(PREFIX + ":" + key, JSON.stringify(obj)); } catch (_) {}
    }

    function remove(key) {
        try { localStorage.removeItem(PREFIX + ":" + key); } catch (_) {}
    }

    window.AppStorage = Object.freeze({
        read: read,
        write: write,
        readJson: readJson,
        writeJson: writeJson,
        remove: remove
    });

})(window);
