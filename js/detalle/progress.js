async function syncProgressFromSupabase(category, itemId) {
    const client = window.AppSupabase;
    if (!client?.loadProgress) return;

    try {
        const keys = await client.loadProgress(category, itemId);
        const userId = getCurrentUserIdSafe();

        keys.forEach((row) => {
            if (!row || Number(row.value) !== 1) return;
            const pkey = String(row.pkey || '');

            if (category === 'manga' || category === 'novelas') {
                const m = pkey.match(/^vol:(\d+)$/);
                if (!m) return;
                const vol = Number(m[1]);
                if (Number.isFinite(vol) && vol > 0) UserStore.setItem(volumeStorageKey(userId, itemId, vol, category), '1');
                return;
            }

            if (category === 'anime') {
                const m = pkey.match(/^s:(\d+)\|ep:(\d+)$/);
                if (!m) return;
                const sIdx = Number(m[1]);
                const ep = Number(m[2]);
                if (Number.isFinite(sIdx) && Number.isFinite(ep) && ep > 0) {
                    UserStore.setItem(episodeStorageKey(userId, itemId, sIdx, ep), '1');
                }
            }
        });
    } catch (error) {
        console.warn('No se pudo traer progreso desde Supabase:', error);
    }
}

function progressSqlKeyVolume(vol) {
    return `vol:${vol}`;
}
function progressSqlKeyEpisode(seasonIdx, ep) {
    return `s:${seasonIdx}|ep:${ep}`;
}

function detailStatusStorageKey(userId, itemId, type) {
    if (typeof statusStorageKey === 'function') return statusStorageKey(userId, itemId, type);
    return `u:${userId}|item:${itemId}|${type}`;
}

// ─── Cola de reintentos para progreso ──────────────────────────
const PROGRESS_SYNC_KEY = "progressSyncQueue";

function getProgressQueue() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_SYNC_KEY)) || []; }
    catch { return []; }
}

function saveProgressQueue(queue) {
    localStorage.setItem(PROGRESS_SYNC_KEY, JSON.stringify(queue));
}

function enqueueProgress(op) {
    const queue = getProgressQueue();
    queue.push({ ...op, ts: Date.now() });
    saveProgressQueue(queue);
}

async function drainProgressQueue() {
    const client = window.AppSupabase;
    if (!client?.setProgress) return;
    const queue = getProgressQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const op of queue) {
        try {
            await client.setProgress({ category: op.category, itemId: op.itemId, key: op.key, value: op.value });
        } catch {
            remaining.push(op);
        }
    }
    saveProgressQueue(remaining);
}

function isProgressSessionExpired(error) {
    return error?.status === 401
        || String(error?.message || '').toLowerCase().includes('expir')
        || String(error?.message || '').toLowerCase().includes('jwt')
        || String(error?.code || '').toLowerCase().includes('pgrst301');
}

var _progressToastShown = false;

function showProgressToast(message, type) {
    if (type === 'session-expired' && _progressToastShown) return;
    if (type === 'session-expired') _progressToastShown = true;
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

async function saveProgressToSupabase(category, itemId, key, value) {
    await drainProgressQueue();
    const client = window.AppSupabase;
    if (!client?.setProgress) {
        enqueueProgress({ category, itemId, key, value });
        return;
    }
    client.setProgress({ category, itemId, key, value }).then(() => {
        if (window.Toast) {
            if (value) {
                const isVol = key.startsWith("vol:");
                const label = isVol ? `Volumen ${key.split(":")[1]} marcado` : `Capítulo marcado`;
                window.Toast.success(`¡${label}! 🎯`);
            } else {
                const isVol = key.startsWith("vol:");
                const label = isVol ? `Volumen ${key.split(":")[1]} desmarcado` : `Capítulo desmarcado`;
                window.Toast.info(label);
            }
        }
    }).catch((error) => {
        if (isProgressSessionExpired(error)) {
            showProgressToast('Sesión expirada. Tu progreso se guardó y se sincronizará al reconectar.', 'session-expired');
        }
        console.warn('No se pudo guardar progreso en Supabase:', error);
        enqueueProgress({ category, itemId, key, value });
        if (window.Toast) {
            window.Toast.error("Error al guardar el progreso en Supabase");
        }
    });
}

window.addEventListener('supabase-auth-changed', function () {
    _progressToastShown = false;
    drainProgressQueue();
});
window.addEventListener('online', drainProgressQueue);