(function(window) {
    "use strict";

    // UserStore — caché en memoria + notifica cambios para sync automático.
    // Los datos persistentes viven en Supabase (item_states, progress_keys, profiles).
    // No se escribe a localStorage para evitar divergencias.

    class MemoryStore {
        constructor() {
            this._data = new Map();
            this._subscribers = [];
        }

        subscribe(fn) {
            this._subscribers.push(fn);
            return () => {
                var idx = this._subscribers.indexOf(fn);
                if (idx !== -1) this._subscribers.splice(idx, 1);
            };
        }

        getItem(key)    { return this._data.has(key) ? String(this._data.get(key)) : null; }

        setItem(key, value) {
            this._data.set(String(key), String(value));
            this._notify(String(key), String(value));
        }

        removeItem(key) {
            this._data.delete(String(key));
            this._notify(String(key), null);
        }

        clear() {
            this._data.clear();
        }

        keys()          { return Array.from(this._data.keys()); }

        _notify(key, value) {
            for (var i = 0; i < this._subscribers.length; i++) {
                try { this._subscribers[i](key, value); } catch (e) { /* ignore */ }
            }
        }
    }

    window.UserStore = new MemoryStore();
})(window);
