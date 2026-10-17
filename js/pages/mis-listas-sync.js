// js/pages/mis-listas-sync.js
// Sincronización con Supabase: carga de estados del usuario al UserStore y
// reparación de portadas guardadas sin URL.
// Extraído de mis-listas.js. Ámbito global (script clásico con defer), igual
// que mis-listas.js: comparte sus constantes y estado (_sessionUser, etc.) y
// sus funciones se llaman recién en DOMContentLoaded, con todo ya cargado.

// —— Carga todos los estados del usuario desde Supabase al UserStore ——————
async function cargarEstadosDesdeSupabase() {
    const client = window.AppSupabase;
    if (!client?.loadItemStates) return;

    const user = _sessionUser || client?.getCurrentUserSync?.() || null;
    if (!user) return;

    const userId = getCurrentUserIdSafe();
    if (!userId || userId === 'Invitado') return;

    try {
        const estados = await client.loadItemStates('');
        if (!Array.isArray(estados)) return;
        _remoteItemStates = estados.slice();

        estados.forEach((state) => {
            const itemId = state.item_id;
            if (!itemId) return;
            const favKey = 'u:' + userId + '|item:' + itemId + '|fav';
            const viewedKey = 'u:' + userId + '|item:' + itemId + '|viewed';
            const metaKey = 'u:' + userId + '|itemMeta:' + itemId;
            const tsKey = 'u:' + userId + '|item:' + itemId + '|ts';

            if (state.fav) UserStore.setItem(favKey, '1');
            else UserStore.removeItem(favKey);

            if (state.viewed) UserStore.setItem(viewedKey, '1');
            else UserStore.removeItem(viewedKey);

            if (state.fav || state.viewed) {
                if (state.meta && Object.keys(state.meta).length > 0) {
                    UserStore.setItem(metaKey, JSON.stringify(state.meta));
                } else if (state.category) {
                    UserStore.setItem(metaKey, JSON.stringify({ __category: state.category }));
                }
            }

            if (state.updated_at) {
                UserStore.setItem(tsKey, state.updated_at);
            }
        });
    } catch (err) {
        console.warn('[mis-listas] Error cargando estados desde Supabase:', err);
    }

    try {
        if (typeof client.loadAllProgress === 'function') {
            const progressRows = await client.loadAllProgress();
            if (Array.isArray(progressRows)) {
                progressRows.forEach((row) => {
                    const pkey = String(row.pkey || '');
                    const itemId = String(row.item_id || '');
                    const cat = String(row.category || '');
                    if (!pkey || !itemId) return;

                    if (cat === 'anime') {
                        const m = pkey.match(/^s:(\d+)\|ep:(\d+)$/);
                        if (m) {
                            const sIdx = Number(m[1]);
                            const ep = Number(m[2]);
                            if (Number.isFinite(sIdx) && Number.isFinite(ep) && ep > 0) {
                                UserStore.setItem('u:' + userId + '|anime:' + itemId + '|s:' + sIdx + '|ep:' + ep, '1');
                                if (row.updated_at) {
                                    UserStore.setItem('u:' + userId + '|item:' + itemId + '|progressTs', row.updated_at);
                                }
                            }
                        }
                    } else if (cat === 'manga' || cat === 'novelas') {
                        const prefix = cat === 'novelas' ? 'novela' : 'manga';
                        const mVol = pkey.match(/^vol:(\d+)$/);
                        if (mVol) {
                            const vol = Number(mVol[1]);
                            if (Number.isFinite(vol) && vol > 0) {
                                UserStore.setItem('u:' + userId + '|' + prefix + ':' + itemId + '|vol:' + vol, '1');
                                if (row.updated_at) {
                                    UserStore.setItem('u:' + userId + '|item:' + itemId + '|progressTs', row.updated_at);
                                }
                            }
                        }
                        const mCh = pkey.match(/^ch:(\d+)$/);
                        if (mCh) {
                            const ch = Number(mCh[1]);
                            if (Number.isFinite(ch) && ch > 0) {
                                UserStore.setItem('u:' + userId + '|' + prefix + ':' + itemId + '|ch:' + ch, '1');
                                if (row.updated_at) {
                                    UserStore.setItem('u:' + userId + '|item:' + itemId + '|progressTs', row.updated_at);
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (err) {
        console.warn('[mis-listas] Error cargando progreso desde Supabase:', err);
    }

    try {
        if (typeof client.loadProfile === 'function') {
            const profile = await client.loadProfile();
            if (profile) {
                if (typeof profile.exp === 'number') {
                    UserStore.setItem(pointsKey(userId), String(profile.exp));
                }
                if (typeof profile.level === 'number') {
                    UserStore.setItem('u:' + userId + '|level', String(profile.level));
                }
                if (typeof profile.total_likes === 'number') {
                    UserStore.setItem('u:' + userId + '|total_likes', String(profile.total_likes));
                }
                if (typeof profile.total_viewed === 'number') {
                    UserStore.setItem('u:' + userId + '|total_viewed', String(profile.total_viewed));
                }
            }
        }
    } catch (err) {
        console.warn('[mis-listas] Error cargando perfil desde Supabase:', err);
    }

    try {
        if (typeof client.loadApodo === 'function') {
            const apodo = await client.loadApodo();
            if (apodo) UserStore.setItem('u:' + userId + '|apodo', String(apodo));
        }
    } catch (err) {
        console.warn('[mis-listas] Error cargando apodo desde Supabase:', err);
    }
}

// ─── Reparación de portadas guardadas sin URL ───────────────────────────
// Metadatos viejos guardaban el id del item (o vacío) en vez de la URL de la
// portada, así que en la lista salía el poster de respaldo (el degradado con
// solo el título). Al cargar, se detectan esos ítems, se piden las portadas a
// AniList por lote y se persiste la URL correcta (UserStore + Supabase) para
// que no vuelva a pasar. Es idempotente: una vez reparados no hay más ítems
// rotos, así que no dispara pedidos en las siguientes cargas.
function _esPortadaRota(img) {
    const s = String(img || '').trim();
    if (!s) return true;                       // sin imagen
    if (/^https?:\/\//i.test(s)) return false; // URL remota válida
    if (/^data:image\//i.test(s)) return false;// data URI de imagen
    if (s.indexOf('/') !== -1) return false;   // ruta relativa (images/...)
    return true;                               // p.ej. "16498" (el id) → roto
}

async function repararPortadasFaltantes() {
    if (typeof window.getCoversByIds !== 'function') return;
    const userId = getCurrentUserIdSafe();
    if (!userId || userId === 'Invitado') return;

    const rotos = getAllItems().filter((it) => _esPortadaRota(it.img) && Number(it.id) > 0);
    if (!rotos.length) return;

    const covers = await window.getCoversByIds(rotos.map((it) => Number(it.id)));
    if (!covers || !Object.keys(covers).length) return;

    let cambiados = 0;
    rotos.forEach((it) => {
        const url = covers[String(it.id)];
        if (!url) return;

        // 1) Metadatos locales
        const metaKey = 'u:' + userId + '|itemMeta:' + it.id;
        let meta = {};
        try { const raw = UserStore.getItem(metaKey); if (raw) meta = JSON.parse(raw) || {}; } catch (e) { meta = {}; }
        meta.id = String(it.id);
        meta.img = url;
        if (!meta.__category && it.__category) meta.__category = it.__category;
        if (!meta.titulo && it.titulo) meta.titulo = it.titulo;
        UserStore.setItem(metaKey, JSON.stringify(meta));

        // 2) Estados remotos en memoria (getAllItems los prioriza)
        _remoteItemStates.forEach((st) => {
            if (String(st.item_id) === String(it.id)) {
                st.meta = st.meta || {};
                st.meta.img = url;
            }
        });

        // 3) Persistir a Supabase para que la corrección quede guardada
        if (typeof window.syncItemStateToSupabase === 'function') {
            const state = getUserItemState(userId, it);
            window.syncItemStateToSupabase(
                it.__category || meta.__category || 'listas',
                String(it.id),
                state.fav,
                state.viewed,
                meta,
                state.wstatus
            );
        }
        cambiados++;
    });

    if (cambiados) {
        try { render(filterModeState); } catch (e) { console.warn('Re-render tras reparar portadas falló:', e); }
        try { renderActividad(); } catch (e) {}
    }
}
