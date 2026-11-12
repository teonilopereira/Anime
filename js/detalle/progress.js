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

// Dueño de la operación: id de la cuenta de Supabase si hay sesión, si no el
// usuario local. Se guarda en cada op (`owner`) para que, al drenar, cada
// cuenta mande solo lo suyo. Las ops viejas sin `owner` (o las que encola la
// home, js/pages/inicio.js) se mandan con la cuenta que tenga sesión.
function progressQueueOwner(client) {
    try {
        const user = client && typeof client.getCurrentUserSync === 'function' ? client.getCurrentUserSync() : null;
        if (user && user.id) return String(user.id);
    } catch { /* cliente roto: usuario local */ }
    const uid = progressCurrentUserId();
    return uid && uid !== 'Invitado' ? String(uid) : '';
}

// ¿Hay sesión de Supabase? Sin sesión setProgress fallaría (o peor, mandaría
// a la cuenta que entre después). Si el cliente no expone ni isSignedIn ni
// getCurrentUserSync (tests, versiones viejas) se usa el usuario local.
function progressHasSession(client) {
    if (!client) return false;
    try {
        if (typeof client.isSignedIn === 'function') return !!client.isSignedIn();
        if (typeof client.getCurrentUserSync === 'function') return !!client.getCurrentUserSync();
    } catch { return false; }
    const uid = progressCurrentUserId();
    return !!uid && uid !== 'Invitado';
}

function enqueueProgress(op) {
    const queue = getProgressQueue();
    const owner = progressQueueOwner(window.AppSupabase);
    queue.push({ ...op, ...(owner ? { owner } : {}), ts: Date.now() });
    saveProgressQueue(queue);
}

async function drainProgressQueue() {
    const client = window.AppSupabase;
    if (!client?.setProgress) return;
    // Sin sesión no se intenta: la cola queda intacta hasta que alguien entre.
    if (!progressHasSession(client)) return;
    const queue = getProgressQueue();
    if (!queue.length) return;
    const owner = progressQueueOwner(client);
    const remaining = [];
    for (const op of queue) {
        // Ops de otra cuenta: se conservan sin mandar.
        if (op && op.owner && owner && String(op.owner) !== owner) {
            remaining.push(op);
            continue;
        }
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

// ─── Sesión y estado "Viendo" al marcar progreso ───────────────
function progressCurrentUserId() {
    return typeof getCurrentUserIdSafe === 'function' ? getCurrentUserIdSafe() : 'Invitado';
}

// Invitado: pedir login en vez de marcar progreso local que después se
// mandaría (vía la cola de reintentos) a la cuenta que inicie sesión.
function progressRequireSession() {
    var uid = progressCurrentUserId();
    if (uid && uid !== 'Invitado') return true;
    if (typeof window.pedirLogin === 'function') window.pedirLogin();
    else window.location.href = 'Login.html';
    return false;
}

// Al marcar un episodio/tomo sin estado de seguimiento guardado, deja la obra
// en "Viendo" para que aparezca en "Seguir viendo" de la home. No pisa otro
// estado elegido a mano (pendiente, pausado, abandonado).
function ensureWatchingOnProgress(item, meta) {
    if (!item || typeof window.getWatchStatus !== 'function' || typeof window.setWatchStatus !== 'function') return false;
    var uid = progressCurrentUserId();
    if (!uid || uid === 'Invitado') return false;
    if (window.getWatchStatus(uid, item.id)) return false;
    // silent: el aviso del cambio de estado va combinado con el del progreso
    // (ver progressToastMessage) para que el primer episodio dé un solo toast.
    return window.setWatchStatus(item.id, 'viendo', meta, { silent: true }) === 'viendo';
}

function progressToastLabel(key, value) {
    var k = String(key || '');
    var vol = k.match(/^vol:(\d+)$/);
    var ep = k.match(/\|ep:(\d+)$/);
    var base = vol ? 'Volumen ' + vol[1] : (ep ? 'Episodio ' + ep[1] : 'Progreso');
    return base + (value ? ' marcado' : ' desmarcado');
}

// Texto del toast de progreso. nowWatching = esta marca pasó la obra a
// "Viendo": se avisa en el mismo toast ("Episodio 1 marcado · ahora en Viendo").
function progressToastMessage(key, value, nowWatching) {
    var label = progressToastLabel(key, value);
    if (value && nowWatching) return '¡' + label + ' · ahora en Viendo! 🎯';
    return value ? '¡' + label + '! 🎯' : label;
}

// opts.nowWatching: true si la marca acaba de dejar la obra en "Viendo"
// (ensureWatchingOnProgress devolvió true); el toast lo menciona.
async function saveProgressToSupabase(category, itemId, key, value, opts) {
    // Sin sesión no se encola: la cola se drenaría en la próxima cuenta que entre.
    var uid = progressCurrentUserId();
    if (!uid || uid === 'Invitado') return;
    var nowWatching = !!(opts && opts.nowWatching);
    await drainProgressQueue();
    const client = window.AppSupabase;
    if (!client?.setProgress) {
        enqueueProgress({ category, itemId, key, value });
        // El estado cambió igual (local): que no quede sin aviso.
        if (nowWatching && window.Toast) window.Toast.success(progressToastMessage(key, value, true));
        return;
    }
    client.setProgress({ category, itemId, key, value }).then(() => {
        if (window.Toast) {
            const msg = progressToastMessage(key, value, nowWatching);
            if (value) window.Toast.success(msg);
            else window.Toast.info(msg);
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

// Expuesto para tests (tests/unit/detalle-progress.test.js).
window.DetalleProgress = {
    requireSession: progressRequireSession,
    ensureWatching: ensureWatchingOnProgress,
    toastLabel: progressToastLabel,
    toastMessage: progressToastMessage,
    drain: drainProgressQueue,
    save: saveProgressToSupabase
};
