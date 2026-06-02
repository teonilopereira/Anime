// Js/core/progress.js
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

function addUserPoints(userId, delta) {
    if (!userId || userId === 'Invitado') return;
    const next = Math.max(0, getUserPoints(userId) + (Number(delta) || 0));
    UserStore.setItem(pointsKey(userId), String(next));
}

function levelFromPoints(points) {
    const p = Number(points) || 0;
    let level = 1;
    let need = 100;
    let remaining = p;
    while (remaining >= need) {
        remaining -= need;
        level += 1;
        need = Math.floor(need * 1.2);
        if (level > 50) break;
    }
    return { level, current: remaining, next: need };
}

function countKeysWithPrefix(prefix) {
    try {
        let count = 0;
        for (let i = 0; i < UserStore.length; i++) {
            const k = UserStore.key(i);
            if (!k) continue;
            if (k.startsWith(prefix) && UserStore.getItem(k)) count++;
        }
        return count;
    } catch {
        return 0;
    }
}

function countUserStates(userId, type) {
    if (!userId || userId === 'Invitado') return 0;
    let count = 0;
    const suffix = `|${type}`;
    const prefix = `u:${userId}|item:`;
    for (let i = 0; i < UserStore.length; i++) {
        const key = UserStore.key(i);
        if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        if (UserStore.getItem(key)) count++;
    }
    return count;
}

function getUserStateSummary(userId) {
    const points = getUserPoints(userId);
    const level = levelFromPoints(points);
    const favorites = countUserStates(userId, 'fav');
    const viewed = countUserStates(userId, 'viewed');
    return { points, level, favorites, viewed };
}

function getProgressPercentForItem(userId, category, itemId) {
    try {
        const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
        if (viewed) return 100;
        const det = (typeof obtenerDetalleItem === 'function')
            ? obtenerDetalleItem(category, itemId)
            : null;

        if (category === 'manga') {
            const vols = Number(det?.volumenes || 0);
            const total = Number.isFinite(vols) ? vols : 0;
            if (!total) return 0;
            const read = countKeysWithPrefix(`u:${userId}|manga:${itemId}|vol:`);
            return Math.min(100, Math.round((read / total) * 100));
        }
        if (category === 'anime') {
            const temporadas = Array.isArray(det?.temporadas) ? det.temporadas : [];
            const total = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
            if (!total) return 0;
            const watched = countKeysWithPrefix(`u:${userId}|anime:${itemId}|s:`);
            return Math.min(100, Math.round((watched / total) * 100));
        }
    } catch {
        // ignore
    }
    return null;
}

function countAnimeEpisodesWatched(userId, animeId, totalEps) {
    if (!totalEps) return 0;
    let watched = 0;
    for (let ep = 1; ep <= totalEps; ep++) {
        let found = false;
        for (let i = 0; i < UserStore.length; i++) {
            const key = UserStore.key(i) || '';
            if (!key.startsWith(`u:${userId}|anime:${animeId}|s:`) || !UserStore.getItem(key)) continue;
            const m = key.match(/ep:(\d+)$/);
            if (m && Number(m[1]) === ep) {
                found = true;
                break;
            }
        }
        if (found) watched += 1;
    }
    return watched;
}

function resolveCatalogProgress(userId, category, itemId, card) {
    const box = card.querySelector('[data-progress]');
    if (!box) return { show: false };
    const prefix = box.getAttribute('data-prefix') || (category === 'anime' ? 'EP' : 'VOL');
    const dataTotal = Number(box.getAttribute('data-total') || 0);

    if (!dataTotal) {
        const legacyPct = getProgressPercentForItem(userId, category, itemId);
        if (legacyPct === null) return { show: false };
        return { show: true, pct: legacyPct, watched: 0, total: 0, prefix, completionText: `${legacyPct}% VISTO` };
    }

    const viewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
    let watched = 0;
    if (category === 'anime') {
        watched = countAnimeEpisodesWatched(userId, itemId, dataTotal);
    } else if (category === 'manga' || category === 'novelas') {
        for (let n = 1; n <= dataTotal; n++) {
            if (UserStore.getItem(`u:${userId}|manga:${itemId}|ch:${n}`) ||
                UserStore.getItem(`u:${userId}|manga:${itemId}|vol:${n}`)) {
                watched += 1;
            }
        }
    }

    const pct = viewed ? 100 : Math.min(100, Math.round((watched / dataTotal) * 100));
    if (viewed) watched = dataTotal;

    return { show: true, pct, watched, total: dataTotal, prefix, completionText: `${pct}% VISTO` };
}

function updateCardProgressIndicators() {
    const mainContainer = document.getElementById('main-container');
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
        const footer = card.querySelector('[data-completion-footer]');

        if (!meta.show) {
            progressBox.style.display = 'none';
            if (footer) footer.style.display = 'none';
            return;
        }

        const fillEl = progressBox.querySelector('.card-progress-fill, .card-back-progress-fill');
        const labelEl = progressBox.querySelector('[data-progress-label]');
        const pctEl = progressBox.querySelector('[data-progress-pct]');
        const completionEl = card.querySelector('[data-completion-text]');

        if (fillEl) fillEl.style.width = `${meta.pct}%`;
        if (labelEl) labelEl.textContent = meta.total ? `${meta.prefix} ${meta.watched}/${meta.total}` : `${meta.pct}%`;
        if (pctEl) pctEl.textContent = `${meta.pct}%`;
        if (completionEl) completionEl.textContent = meta.completionText || `${meta.pct}% VISTO`;

        progressBox.style.display = '';
        if (footer) footer.style.display = 'flex';
    });
}

function toggleStatus(btn, type, itemId) {
    const userId = getCurrentUserId();
    if (userId === 'Invitado') {
        const modal = document.getElementById('userModal');
        if (modal) modal.classList.add('is-open');
        return;
    }

    const storageKey = statusStorageKey(userId, itemId, type);
    btn.classList.toggle('active');

    if (btn.classList.contains('active')) {
        UserStore.setItem(storageKey, '1');
        addUserPoints(userId, type === 'viewed' ? 10 : 5);
    } else {
        UserStore.removeItem(storageKey);
    }

    const card = btn.closest('[data-item-id]');
    const completeInput = card?.querySelector('.card-complete-input');
    if (completeInput && type === 'viewed') {
        completeInput.checked = btn.classList.contains('active');
    }

    updateCardProgressIndicators();

    // Sincronizar con Supabase
    if (typeof saveItemStateToSupabase === 'function') {
        const category = card?.getAttribute('data-category') || document.body.getAttribute('data-page') || 'anime';
        const isFav = !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav'));
        const isViewed = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
        
        let meta = {};
        if (card) {
            meta = {
                id: itemId,
                titulo: card.getAttribute('data-title') || '',
                img: card.getAttribute('data-img') || '',
                __category: category
            };
        }
        
        saveItemStateToSupabase(category, itemId, isFav, isViewed, meta);
    }
}

window.toggleCardComplete = function (input, itemId) {
    const card = input?.closest('[data-item-id]');
    const viewedBtn = card?.querySelector('.viewed-btn');
    if (!viewedBtn) return;
    const isActive = viewedBtn.classList.contains('active');
    if (Boolean(input.checked) !== isActive) viewedBtn.click();
};

function cargarEstadosBotones() {
    const userId = getCurrentUserId();
    const cards = document.querySelectorAll('[data-item-id]');

    cards.forEach(card => {
        const itemId = card.getAttribute('data-item-id');
        if (!itemId) return;

        const favBtn = card.querySelector('.fav-btn');
        const viewedBtn = card.querySelector('.viewed-btn');

        if (favBtn) favBtn.classList.toggle('active', !!UserStore.getItem(statusStorageKey(userId, itemId, 'fav')));
        if (viewedBtn) viewedBtn.classList.toggle('active', !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed')));

        const completeInput = card.querySelector('.card-complete-input');
        if (completeInput) {
            completeInput.checked = !!UserStore.getItem(statusStorageKey(userId, itemId, 'viewed'));
        }
    });

    updateCardProgressIndicators();
}
