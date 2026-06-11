// ==========================================
// js/controllers/UserController.js
// Puntos, nivel, preferencias y estado de ítems.
// Reemplaza funciones sueltas de script.js:
//   getCurrentUserId, getUserPoints, addUserPoints,
//   levelFromPoints, getPreference, getPreferenceValue,
//   applyUserPreferences, applyBackgroundPreference,
//   clearInlineBackgroundStyle, getUserStateSummary,
//   statusStorageKey, pointsKey, countUserStates
// Dispara: user:points-updated  user:prefs-changed
// ==========================================
(function (window) {
    'use strict';

    // ── Claves de almacenamiento ───────────────────────────────────
    function _pointsKey(userId)                       { return 'u:' + userId + '|points'; }
    function _statusKey(userId, itemId, type)         { return 'u:' + userId + '|item:' + itemId + '|' + type; }
    function _prefKey(key)                            { return key; }  // ya incluyen 'pref:' en el código existente

    // ── Store (UserStore o fallback) ───────────────────────────────
    function _store() { return window.UserStore || { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, key: () => null, clear: () => {} }; }

    // ── Dispatch ───────────────────────────────────────────────────
    function _dispatch(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }

    // ── ID del usuario actual (síncrono) ───────────────────────────
    function _currentId() {
        // Preferir el controlador si ya está listo
        if (window.Auth?.getId) return window.Auth.getId();
        // Fallback a AppSupabase síncrono
        const user = window.AppSupabase?.getCurrentUserSync?.() || null;
        if (!user) return 'Invitado';
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split('@')[0] : '') ||
            user.id || 'Usuario'
        );
    }

    // ── Puntos ─────────────────────────────────────────────────────
    function _getPoints(userId) {
        const n = Number(_store().getItem(_pointsKey(userId)) || '0');
        return Number.isFinite(n) ? n : 0;
    }

    function _addPoints(userId, delta) {
        if (!userId || userId === 'Invitado') return;
        const next = Math.max(0, _getPoints(userId) + delta);
        _store().setItem(_pointsKey(userId), String(next));
        window.AppSupabase?.addExperience?.(delta);
        _dispatch('user:points-updated', { userId, points: next });
    }

    // ── Nivel ──────────────────────────────────────────────────────
    function _levelFrom(points) {
        const p = Number(points) || 0;
        let level = 1, need = 100, remaining = p;
        while (remaining >= need) {
            remaining -= need;
            level++;
            need = Math.floor(need * 1.2);
            if (level > 50) break;
        }
        return { level, current: remaining, next: need };
    }

    // ── Preferencias ───────────────────────────────────────────────
    function _getPref(key, fallback) {
        try {
            const v = _store().getItem(_prefKey(key));
            if (v === null) return fallback;
            return typeof fallback === 'boolean' ? v === 'true' : v;
        } catch { return fallback; }
    }

    function _setPref(key, value) {
        try {
            _store().setItem(_prefKey(key), String(value));
            _dispatch('user:prefs-changed', { key, value });
        } catch { /* silent */ }
    }

    function _applyPrefs() {
        if (!document.body) return;
        document.body.classList.toggle('compact-cards',  _getPref('pref:compactCards', false));
        document.body.classList.toggle('reduce-motion',  _getPref('pref:reduceMotion', false));
    }

    function _clearBgStyle(body) {
        ['background','background-image','background-color',
         'background-repeat','background-size','background-position','background-attachment']
            .forEach(p => body.style.removeProperty(p));
    }

    function _applyBg() {
        if (!document.body) return;
        const body = document.body;
        const mode = _getPref('pref:bgMode', 'default');
        _clearBgStyle(body);
        if (mode === 'color') {
            const color = _getPref('pref:bgColor', '#2b0a55');
            body.style.background = 'linear-gradient(180deg, #000000 0%, ' + color + ' 100%)';
            body.style.backgroundAttachment = 'fixed';
        } else if (mode === 'image') {
            const url = _getPref('pref:bgImage', '');
            if (url) {
                body.style.backgroundImage = 'linear-gradient(rgba(0,0,0,0.62),rgba(0,0,0,0.76)),url("' + url.replaceAll('"', '\\"') + '")';
                body.style.backgroundSize       = 'cover';
                body.style.backgroundPosition   = 'center center';
                body.style.backgroundRepeat     = 'no-repeat';
                body.style.backgroundAttachment = 'fixed';
            }
        }
    }

    // ── Estado de ítems (fav / viewed) ─────────────────────────────
    function _countStates(userId, type) {
        if (!userId || userId === 'Invitado') return 0;
        const store = _store();
        const prefix = 'u:' + userId + '|item:';
        const suffix = '|' + type;
        let count = 0;
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key && key.startsWith(prefix) && key.endsWith(suffix) && store.getItem(key)) count++;
        }
        return count;
    }

    function _getSummary(userId) {
        const points    = _getPoints(userId);
        const level     = _levelFrom(points);
        const favorites = _countStates(userId, 'fav');
        const viewed    = _countStates(userId, 'viewed');
        return { points, level, favorites, viewed };
    }

    // ── Inicializar: aplicar prefs al arrancar ─────────────────────
    function _init() {
        _applyPrefs();
        _applyBg();
    }

    // ── API pública: window.User ───────────────────────────────────
    window.User = Object.freeze({

        // Identidad
        getId()                          { return _currentId(); },

        // Puntos y nivel
        getPoints(userId)                { return _getPoints(userId || _currentId()); },
        addPoints(delta, userId)         { _addPoints(userId || _currentId(), delta); },
        getLevel(points)                 { return _levelFrom(points !== undefined ? points : _getPoints(_currentId())); },
        getSummary(userId)               { return _getSummary(userId || _currentId()); },

        // Preferencias
        getPref(key, fallback)           { return _getPref(key, fallback !== undefined ? fallback : null); },
        getPrefBool(key, fallback)       { return _getPref(key, fallback !== undefined ? fallback : false); },
        setPref(key, value)              { _setPref(key, value); },

        // Aplicar preferencias visuales
        applyPrefs()                     { _applyPrefs(); },
        applyBackground()                { _applyBg(); },
        clearBackground(body)            { _clearBgStyle(body || document.body); },

        // Estado de ítems
        countStates(type, userId)        { return _countStates(userId || _currentId(), type); },
        statusKey(userId, itemId, type)  { return _statusKey(userId, itemId, type); },
    });

    // ── Compatibilidad: mantener funciones viejas de script.js ─────
    window.getCurrentUserId         = () => _currentId();
    window.getUserPoints            = (uid) => _getPoints(uid);
    window.addUserPoints            = (uid, delta) => _addPoints(uid, delta);
    window.levelFromPoints          = (p) => _levelFrom(p);
    window.getPreference            = (k, fb) => _getPref(k, fb !== undefined ? fb : false);
    window.getPreferenceValue       = (k, fb) => _getPref(k, fb !== undefined ? fb : '');
    window.applyUserPreferences     = () => _applyPrefs();
    window.applyBackgroundPreference= () => _applyBg();
    window.clearInlineBackgroundStyle = (b) => _clearBgStyle(b);
    window.getUserStateSummary      = (uid) => _getSummary(uid);
    window.statusStorageKey         = (uid, iid, type) => _statusKey(uid, iid, type);
    window.countUserStates          = (uid, type) => _countStates(uid, type);

    // ── Arrancar cuando el DOM esté listo ──────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

})(window);
