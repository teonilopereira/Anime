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
                if (Number.isFinite(vol) && vol > 0) UserStore.setItem(volumeStorageKey(userId, itemId, vol), '1');
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

function detailStatusStorageKey(userId, itemId, type) {
    if (typeof statusStorageKey === 'function') return statusStorageKey(userId, itemId, type);
    return `u:${userId}|item:${itemId}|${type}`;
}

function saveProgressToSupabase(category, itemId, key, value) {
    const client = window.AppSupabase;
    if (!client?.setProgress) return;
    client.setProgress({ category, itemId, key, value }).catch((error) => {
        console.warn('No se pudo guardar progreso en Supabase:', error);
    });
}