// ==========================================
// catalog/states.js
// SISTEMA DE FAVORITOS, VISTOS Y SINCRONIZACIÓN
// ==========================================

(function (window) {
    "use strict";

    const SYNC_QUEUE_KEY = "syncQueue";

    function getSyncQueue() {
        try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || []; }
        catch (e) { console.warn('getSyncQueue: corrupt data, resetting:', e); return []; }
    }

    function saveSyncQueue(queue) {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }

    function enqueueSync(op) {
        const queue = getSyncQueue();
        queue.push({ ...op, ts: Date.now() });
        saveSyncQueue(queue);
    }

    async function drainSyncQueue() {
        const client = window.AppSupabase;
        if (!client?.isSignedIn?.()) return;
        const queue = getSyncQueue();
        if (!queue.length) return;
        const remaining = [];
        for (const op of queue) {
            try {
                if (op.type === "item_state") {
                    await client.saveItemState(op.payload);
                } else if (op.type === "experience") {
                    await client.addExperience(op.payload.delta);
                }
            } catch (error) {
                if (isSessionExpired(error)) showSyncToast('Sesión expirada. Los cambios pendientes se reintentarán automáticamente.', 'session-expired');
                remaining.push(op);
            }
        }
        saveSyncQueue(remaining);
    }

    function isSessionExpired(error) {
        return error?.status === 401
            || String(error?.message || '').toLowerCase().includes('expir')
            || String(error?.message || '').toLowerCase().includes('jwt')
            || String(error?.code || '').toLowerCase().includes('pgrst301');
    }

    function syncItemStateToSupabase(category, itemId, fav, viewed, meta = {}) {
        const client = window.AppSupabase;
        if (!client?.saveItemState) {
            enqueueSync({ type: "item_state", payload: { category, itemId, fav, viewed, meta } });
            return;
        }
        client.saveItemState({ category, itemId, fav, viewed, meta }).catch((error) => {
            if (isSessionExpired(error)) showSyncToast('Sesión expirada. Tu progreso se guardó y se sincronizará al reconectar.', 'session-expired');
            console.warn('No se pudo sincronizar estado a Supabase:', error);
            enqueueSync({ type: "item_state", payload: { category, itemId, fav, viewed, meta } });
        });
    }

    function addUserPoints(userId, delta) {
        if (!userId || userId === 'Invitado') return;
        const currentPoints = getUserPoints(userId);
        const oldLevelInfo = levelFromPoints(currentPoints);

        const next = Math.max(0, currentPoints + delta);
        UserStore.setItem(pointsKey(userId), String(next));

        const newLevelInfo = levelFromPoints(next);
        if (newLevelInfo.level > oldLevelInfo.level) {
            if (window.Toast) {
                const translatedMsg = window.AppI18n
                    ? window.AppI18n.t("notification.levelup", { level: newLevelInfo.level })
                    : `¡Subiste de Nivel! 🎉 ¡Ahora eres Nivel ${newLevelInfo.level}! 🌟`;
                window.Toast.success(translatedMsg, 6000);
            }
        }

        const client = window.AppSupabase;
        if (!client?.addExperience) {
            enqueueSync({ type: "experience", payload: { delta } });
            return;
        }
        client.addExperience(delta).catch((error) => {
            if (isSessionExpired(error)) showSyncToast('Sesión expirada. La experiencia se sincronizará al reconectar.', 'session-expired');
            enqueueSync({ type: "experience", payload: { delta } });
        });
    }

    // ─── Toast auto-contenido para alertas de sincronización ──────────
    var _sessionToastShown = false;

    function showSyncToast(message, type) {
        if (type === 'session-expired' && _sessionToastShown) return;
        if (type === 'session-expired') _sessionToastShown = true;

        var existing = document.getElementById('_syncToast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = '_syncToast';
        toast.className = 'sync-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('is-visible');
        });

        setTimeout(function () {
            toast.classList.remove('is-visible');
            setTimeout(function () { toast.remove(); }, 300);
        }, 5000);
    }

    function getCategoriaActual() {
        const pathName = String(window.location.pathname || '').toLowerCase();
        if (pathName.includes('manga.html')) return 'manga';
        if (pathName.includes('anime.html')) return 'anime';
        if (pathName.includes('novelas.html')) return 'novelas';
        const fromBody = document.body.getAttribute('data-page');
        return fromBody ? String(fromBody) : '';
    }

    function statusStorageKey(userId, itemId, type) {
        return `u:${userId}|item:${itemId}|${type}`;
    }

    function pointsKey(userId) {
        return `u:${userId}|points`;
    }

    function getUserPoints(userId) {
        const n = Number(UserStore.getItem(pointsKey(userId)) || '0');
        return Number.isFinite(n) ? n : 0;
    }

    function levelFromPoints(points) {
        const p = Number(points) || 0;
        let level = 1;
        let need = AnimeDestiny.Constants.XP_BASE || 100;
        let remaining = p;
        while (remaining >= need) {
            remaining -= need;
            level += 1;
            need = Math.floor(need * (AnimeDestiny.Constants.XP_MULTIPLIER || 1.2));
            if (level > (AnimeDestiny.Constants.XP_MAX_LEVEL || 50)) break;
        }
        return { level, current: remaining, next: need };
    }

    function countKeysWithPrefix(prefix) {
        try {
            let count = 0;
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!k) continue;
                if (k.startsWith(prefix) && UserStore.getItem(k)) count++;
            }
            return count;
        } catch (e) {
            console.warn('countKeysWithPrefix failed:', e);
            return 0;
        }
    }

    function countUserStatesBoth(userId) {
        if (!userId || userId === 'Invitado') return { fav: 0, viewed: 0 };
        let fav = 0, viewed = 0;
        const prefix = `u:${userId}|item:`;
        try {
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (!key || !key.startsWith(prefix) || !UserStore.getItem(key)) continue;
                if (key.endsWith('|fav'))         fav++;
                else if (key.endsWith('|viewed')) viewed++;
            }
        } catch (e) { console.warn('countUserStatesBoth failed:', e); }
        return { fav, viewed };
    }

    function getPreference(key, fallback = false) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return fallback;
            return value === 'true';
        } catch {
            return fallback;
        }
    }

    function applyUserPreferences() {
        if (typeof document === 'undefined' || !document.body) return;
        document.body.classList.toggle('compact-cards', getPreference('pref:compactCards', false));
        document.body.classList.toggle('reduce-motion', getPreference('pref:reduceMotion', false));
    }

    function getPreferenceValue(key, fallback = '') {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch {
            return fallback;
        }
    }

    function clearInlineBackgroundStyle(body) {
        body.style.removeProperty('background');
        body.style.removeProperty('background-image');
        body.style.removeProperty('background-color');
        body.style.removeProperty('background-repeat');
        body.style.removeProperty('background-size');
        body.style.removeProperty('background-position');
        body.style.removeProperty('background-attachment');
    }

    function applyBackgroundPreference() {
        if (typeof document === 'undefined' || !document.body) return;
        const body = document.body;
        const mode = getPreferenceValue('pref:bgMode', 'default');
        clearInlineBackgroundStyle(body);

        if (mode === 'color') {
            const color = getPreferenceValue('pref:bgColor', '#2b0a55');
            body.style.background = `linear-gradient(180deg, #000000 0%, ${color} 100%)`;
            body.style.backgroundAttachment = 'fixed';
        } else if (mode === 'image') {
            const imageUrl = getPreferenceValue('pref:bgImage', '');
            if (imageUrl) {
                body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.76)), url("${safeUrl(imageUrl) || ''}")`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center center';
                body.style.backgroundRepeat = 'no-repeat';
                body.style.backgroundAttachment = 'fixed';
            }
        }
    }

    function getUserStateSummary(userId) {
        const points = getUserPoints(userId);
        const level = levelFromPoints(points);
        const { fav: favorites, viewed } = countUserStatesBoth(userId);
        return { points, level, favorites, viewed };
    }

    function buildSearchIndexForItem(category, item) {
        const parts = [
            item?.titulo,
            item?.info,
            item?.status,
            item?.demografia
        ];

        const detail = (typeof obtenerDetalleItem === 'function')
            ? obtenerDetalleItem(category, item?.id)
            : null;

        if (detail) {
            parts.push(
                detail.estudio,
                detail.desarrollador,
                detail.editor,
                detail.plataforma,
                detail.resumen
            );
            if (Array.isArray(detail.temporadas)) {
                detail.temporadas.forEach((season) => {
                    parts.push(season?.nombre, season?.episodios);
                });
            }
            if (Array.isArray(detail.franquicia)) {
                parts.push(...detail.franquicia);
            }
            if (category === 'manga' || category === 'novelas') parts.push(detail.volumenes);
        }

        return parts
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
            .join(' ');
    }

    function getProgressPercentForItem(userId, category, itemId) {
        try {
            const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
            if (viewed) return 100;
            const det = (typeof obtenerDetalleItem === 'function')
                ? obtenerDetalleItem(category, itemId)
                : null;

            if (category === 'manga' || category === 'novelas') {
                const vols = Number(det?.volumenes || 0);
                const total = Number.isFinite(vols) ? vols : 0;
                if (!total) return 0;
                const prefix = category === 'novelas' ? 'novela' : 'manga';
                const read = countKeysWithPrefix(`u:${userId}|${prefix}:${itemId}|vol:`);
                return Math.min(100, Math.round((read / total) * 100));
            }
            if (category === 'anime') {
                const temporadas = Array.isArray(det?.temporadas) ? det.temporadas : [];
                const total = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
                if (!total) return 0;
                const watched = countKeysWithPrefix(`u:${userId}|anime:${itemId}|s:`);
                return Math.min(100, Math.round((watched / total) * 100));
            }
        } catch (e) {
            console.warn('getProgressPercentForItem failed:', e);
        }
        return null;
    }

    function updateCardProgressIndicators() {
        const mainContainer = document.getElementById('main-content');
        if (!mainContainer) return;
        const category = document.body.getAttribute('data-page') || '';
        const userId = getCurrentUserId();
        const cards = mainContainer.querySelectorAll('.card-container[data-item-id]');

        cards.forEach((card) => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;
            const progressBox = card.querySelector('[data-progress]');
            if (!progressBox) return;

            const meta = resolveCatalogProgress(userId, String(category), String(itemId), card);

            if (!meta.show) {
                progressBox.style.display = 'none';
                return;
            }

            const dataTotal = Number(progressBox.getAttribute('data-total') || 0);
            if (dataTotal === 0) {
                // Caso: Progreso Libre (safeTotal === 0)
                const noProgCard = progressBox.querySelector('.card-back-no-progress-card');
                const viewedFooter = progressBox.querySelector('[data-viewed-footer]');
                if (meta.pct === 100) {
                    if (noProgCard) noProgCard.style.display = 'none';
                    if (viewedFooter) viewedFooter.style.display = '';
                } else {
                    if (noProgCard) noProgCard.style.display = '';
                    if (viewedFooter) viewedFooter.style.display = 'none';
                }
            } else {
                // Caso normal con barra de progreso
                const fillEl = progressBox.querySelector('.card-back-progress-fill');
                const pctEl = progressBox.querySelector('[data-pct-text]');
                const pctOnlyEl = progressBox.querySelector('[data-pct-only]');
                const metaEl = progressBox.querySelector('[data-meta-text]');

                if (fillEl) fillEl.style.width = `${meta.pct}%`;
                if (pctEl) pctEl.textContent = `${meta.pct}% VISTO`;
                if (pctOnlyEl) pctOnlyEl.textContent = `${meta.pct}%`;
                if (metaEl) {
                    const pr = progressBox.getAttribute('data-prefix') || 'EP';
                    metaEl.textContent = meta.total
                        ? `${pr} ${meta.watched}/${meta.total}`
                        : `${meta.pct}%`;
                }
            }

            progressBox.style.display = '';
        });
    }

    function toggleStatus(btn, type, itemId) {
        const userId = getCurrentUserId();
        if (userId === 'Invitado') {
            window.location.href = 'Login.html';
            return;
        }

        const storageKey = statusStorageKey(userId, itemId, type);

        const enabled = !UserStore.getItem(storageKey);
        if (enabled) {
            UserStore.setItem(storageKey, '1');
            if (typeof window._invalidateProgressIndex === 'function') window._invalidateProgressIndex();
            addUserPoints(userId, type === 'viewed' ? (AnimeDestiny.Constants.XP_VIEWED || 10) : (AnimeDestiny.Constants.XP_FAV || 5));
            if (window.Toast) {
                if (type === 'fav') window.Toast.success("¡Agregado a Favoritos! ❤️");
                if (type === 'viewed') window.Toast.success("¡Marcado como Visto! 👁️ (+10 EXP)");
            }
        } else {
            UserStore.removeItem(storageKey);
            if (window.Toast) {
                if (type === 'fav') window.Toast.info("Quitado de Favoritos");
                if (type === 'viewed') window.Toast.info("Marcado como no visto");
            }
        }

        btn.classList.toggle('active', enabled);
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');

        UserStore.setItem(`u:${userId}|item:${itemId}|ts`, new Date().toISOString());

        const card = btn.closest('.card-container') || btn.closest('[data-item-id]');

        const metaKey = `u:${userId}|itemMeta:${itemId}`;

        if (card && userId !== 'Invitado') {
            const fav = !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav'));
            const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
            const category = card.getAttribute('data-category') || getCategoriaActual() || '';
            const img = card.getAttribute('data-img') || card.querySelector('img')?.getAttribute('src') || '';
            const titulo = card.getAttribute('data-title') || card.querySelector('.catalog-card-title, .card-back-title')?.textContent || itemId;
            const info = card.getAttribute('data-genres') || card.getAttribute('data-search-index') || '';

            if (fav || viewed) {
                var total = card.getAttribute('data-total') || '0';
                var finalCat = String(category);
                if (!finalCat) finalCat = 'listas';
                UserStore.setItem(metaKey, JSON.stringify({
                    id: String(itemId),
                    titulo: String(titulo).trim(),
                    img,
                    info,
                    total: Number(total),
                    __category: finalCat
                }));
            } else {
                UserStore.removeItem(metaKey);
            }
        }

        var metaRaw = UserStore.getItem(metaKey);
        var metaObj = {};
        try { if (metaRaw) metaObj = JSON.parse(metaRaw); } catch { console.warn('Invalid meta JSON for', metaKey); }

        var syncCat = (metaObj && metaObj.__category) || 'listas';
        syncItemStateToSupabase(
            syncCat,
            String(itemId),
            !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav')),
            !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed')),
            metaObj
        );

        updateCardProgressIndicators();
    }

    function applyRemoteStateToCards(cards, userId) {
        if (!cards || !cards.length) return;
        const favSet = new Set();
        const viewedSet = new Set();
        const prefix = `u:${userId}|item:`;
        try {
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!k || !k.startsWith(prefix) || !UserStore.getItem(k)) continue;
                if (k.endsWith('|fav'))         favSet.add(k.slice(prefix.length, k.length - 4));
                else if (k.endsWith('|viewed')) viewedSet.add(k.slice(prefix.length, k.length - 7));
            }
        } catch (e) { console.warn('applyRemoteStateToCards scan failed:', e); }
        cards.forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;
            const isFav    = favSet.has(itemId);
            const isViewed = viewedSet.has(itemId);
            const favBtn     = card.querySelector('.fav-btn');
            const viewedBtn  = card.querySelector('.viewed-btn');
            if (favBtn)    favBtn.classList.toggle('active', isFav);
            if (viewedBtn) viewedBtn.classList.toggle('active', isViewed);
        });
        updateCardProgressIndicators();
    }

    function syncStatesFromSupabase(category, userId, cards) {
        const client = window.AppSupabase;
        if (!client?.loadItemStates || !client?.isSignedIn?.()) return;
        const validCategories = ['anime', 'manga', 'novelas'];
        const filter = validCategories.includes(category) ? category : '';
        client.loadItemStates(filter).then((states) => {
            if (!Array.isArray(states)) return;
            states.forEach((state) => {
                const key = state.item_id;
                if (!key) return;
                if (state.fav)    UserStore.setItem(statusStorageKey(userId, key, 'fav'), '1');
                if (state.viewed) UserStore.setItem(statusStorageKey(userId, key, 'viewed'), '1');
            });
            applyRemoteStateToCards(cards, userId);
        }).catch((error) => {
            console.warn('No se pudo cargar estados desde Supabase:', error);
        });
    }

    function cargarEstadosBotones() {
        const userId = getCurrentUserId();
        const cards = document.querySelectorAll('[data-item-id]');
        if (!cards.length) return;

        const favSet = new Set();
        const viewedSet = new Set();
        const prefix = `u:${userId}|item:`;
        try {
            const keys = UserStore.keys();
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (!k || !k.startsWith(prefix)) continue;
                const val = UserStore.getItem(k);
                if (!val) continue;
                if (k.endsWith('|fav'))    favSet.add(k.slice(prefix.length, k.length - 4));
                if (k.endsWith('|viewed')) viewedSet.add(k.slice(prefix.length, k.length - 7));
            }
        } catch (e) { console.warn('cargarEstadosBotones scan failed:', e); }

        cards.forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            if (!itemId) return;

            const isFav    = favSet.has(itemId);
            const isViewed = viewedSet.has(itemId);

            const favBtn  = card.querySelector('.fav-btn');
            const viewedBtn = card.querySelector('.viewed-btn');
            if (favBtn)    favBtn.classList.toggle('active', isFav);
            if (viewedBtn) viewedBtn.classList.toggle('active', isViewed);
        });

        updateCardProgressIndicators();
        syncStatesFromSupabase(getCategoriaActual(), userId, cards);
    }

    // ─── Inicializar cola de reintentos ─────────────────────────────────
    (function initSyncQueue() {
        drainSyncQueue();
        window.addEventListener("supabase-auth-changed", () => {
            if (window.AppSupabase?.isSignedIn?.()) {
                drainSyncQueue();
            }
        });
        window.addEventListener("online", drainSyncQueue);
    })();

    // ─── Aplicar preferencias de usuario al cargar ──────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        applyUserPreferences();
        applyBackgroundPreference();
    });

    window.addEventListener('pageshow', function (e) {
        if (e.persisted) cargarEstadosBotones();
    });

    window.addEventListener('storage', function (e) {
        if (e.key && e.key.startsWith('u:')) cargarEstadosBotones();
    });

    // ─── Event delegation para acciones de catálogo ─────────────────────
    (function initCatalogDelegation() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var itemId = btn.getAttribute('data-item-id');
            var action = btn.getAttribute('data-action');
            if (!itemId || !action) return;
            toggleStatus(btn, action, itemId);
        });
    })();

    // Exports
    window.addUserPoints = addUserPoints;
    window.cargarEstadosBotones = cargarEstadosBotones;
    window.buildSearchIndexForItem = buildSearchIndexForItem;
    window.getCategoriaActual = getCategoriaActual;
    window.statusStorageKey = statusStorageKey;
    window.syncItemStateToSupabase = syncItemStateToSupabase;
    window.getUserPoints = getUserPoints;
    window.levelFromPoints = levelFromPoints;
    window.pointsKey = pointsKey;

})(window);
