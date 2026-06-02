/**
 * user-store.js
 * Un almacén en memoria (in-memory) que reemplaza a localStorage 
 * para los datos de progreso del usuario sincronizados con Supabase.
 * Nunca persiste al disco, garantizando que Supabase sea la única fuente de verdad.
 */

(function(window) {
    "use strict";

    class MemoryStore {
        constructor() {
            this._data = new Map();
        }

        getItem(key) {
            return this._data.has(key) ? String(this._data.get(key)) : null;
        }

        setItem(key, value) {
            this._data.set(String(key), String(value));
        }

        removeItem(key) {
            this._data.delete(key);
        }

        clear() {
            this._data.clear();
        }

        key(index) {
            const keys = Array.from(this._data.keys());
            return keys[index] || null;
        }

        get length() {
            return this._data.size;
        }
        
        // Método auxiliar para obtener todas las llaves (más eficiente que iterar con índice)
        keys() {
            return Array.from(this._data.keys());
        }
    }

    // Inicializar global
    window.UserStore = new MemoryStore();

})(window);
