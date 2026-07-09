/**
 * storage.js
 * AppStorage — wrapper en memoria sobre UserStore.
 * No persiste nada en localStorage; Supabase es la única fuente de verdad.
 */
(function (window) {
    "use strict";

    function read(key, fallback = null) {
        const value = window.UserStore?.getItem(key) ?? null;
        return value === null ? fallback : value;
    }

    function write(key, value) {
        try {
            window.UserStore?.setItem(key, String(value));
            return true;
        } catch {
            return false;
        }
    }

    function readJson(key, fallback = null) {
        const value = window.UserStore?.getItem(key) ?? null;
        if (value === null) return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            window.UserStore?.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    function remove(key) {
        try {
            window.UserStore?.removeItem(key);
            return true;
        } catch {
            return false;
        }
    }

    window.AppStorage = Object.freeze({
        read,
        write,
        readJson,
        writeJson,
        remove
    });
})(window);
