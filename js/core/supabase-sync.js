/**
 * supabase-sync.js
 * Sincroniza favoritos, vistos y progreso entre localStorage y Supabase
 */

// ==========================================
// 1. GUARDAR ESTADOS (Favorito/Visto)
// ==========================================
async function saveItemStateToSupabase(category, itemId, fav, viewed, meta = {}) {
    const client = window.AppSupabase;
    if (!client?.isSignedIn?.()) {
        console.log('Usuario no autenticado, guardando solo en localStorage');
        return;
    }

    try {
        await client.saveItemState({
            category: String(category),
            itemId: String(itemId),
            fav: !!fav,
            viewed: !!viewed,
            meta: meta
        });
        console.log(`✅ Estado guardado en Supabase: ${category}/${itemId} - Fav:${fav} Visto:${viewed}`);
    } catch (error) {
        console.warn(`⚠️ Error al guardar estado en Supabase:`, error?.message);
    }
}

// ==========================================
// 2. GUARDAR PROGRESO (Episodios/Volúmenes)
// ==========================================
async function saveProgressToSupabase(category, itemId, progressKey, value = true) {
    const client = window.AppSupabase;
    if (!client?.isSignedIn?.()) {
        console.log('Usuario no autenticado, guardando solo en localStorage');
        return;
    }

    try {
        await client.setProgress({
            category: String(category),
            itemId: String(itemId),
            key: String(progressKey),
            value: !!value
        });
        console.log(`✅ Progreso guardado: ${category}/${itemId}/${progressKey}`);
    } catch (error) {
        console.warn(`⚠️ Error al guardar progreso en Supabase:`, error?.message);
    }
}

// ==========================================
// 3. CARGAR ESTADOS DESDE SUPABASE
// ==========================================
async function loadItemStatesFromSupabase(category) {
    const client = window.AppSupabase;
    if (!client?.isSignedIn?.()) {
        console.log('Usuario no autenticado, saltando carga desde Supabase');
        return [];
    }

    try {
        const states = await client.loadItemStates(category);
        console.log(`✅ Cargados ${states?.length || 0} estados de ${category} desde Supabase`);
        return states || [];
    } catch (error) {
        console.warn(`⚠️ Error al cargar estados desde Supabase:`, error?.message);
        return [];
    }
}

// ==========================================
// 4. CARGAR PROGRESO DESDE SUPABASE
// ==========================================
async function loadProgressFromSupabase(category, itemId) {
    const client = window.AppSupabase;
    if (!client?.isSignedIn?.()) {
        console.log('Usuario no autenticado, saltando carga de progreso');
        return [];
    }

    try {
        const progress = await client.loadProgress(category, itemId);
        console.log(`✅ Cargado progreso de ${category}/${itemId} desde Supabase`);
        return progress || [];
    } catch (error) {
        console.warn(`⚠️ Error al cargar progreso desde Supabase:`, error?.message);
        return [];
    }
}

// ==========================================
// 5. SINCRONIZAR ESTADOS AL USERSTORE
// ==========================================
function syncStatesToLocalStorage(category, states, userId) {
    if (!Array.isArray(states) || !userId) return;

    states.forEach((state) => {
        const itemId = state.item_id;
        if (!itemId) return;

        const favKey = `u:${userId}|item:${itemId}|fav`;
        const viewedKey = `u:${userId}|item:${itemId}|viewed`;

        if (state.fav) {
            UserStore.setItem(favKey, '1');
        } else {
            UserStore.removeItem(favKey);
        }

        if (state.viewed) {
            UserStore.setItem(viewedKey, '1');
        } else {
            UserStore.removeItem(viewedKey);
        }
        
        // Sincronizar metadata para la página de Mis Listas
        const metaKey = `u:${userId}|itemMeta:${itemId}`;
        if ((state.fav || state.viewed) && state.meta && Object.keys(state.meta).length > 0) {
            UserStore.setItem(metaKey, JSON.stringify(state.meta));
        } else if (!state.fav && !state.viewed) {
            UserStore.removeItem(metaKey);
        }
    });
}

// ==========================================
// 6. SINCRONIZAR PROGRESO AL USERSTORE
// ==========================================
function syncProgressToLocalStorage(category, itemId, progressArray, userId) {
    if (!Array.isArray(progressArray) || !userId || !itemId) return;

    progressArray.forEach((p) => {
        if (p.pkey && p.value) {
            const key = `u:${userId}|${category}:${itemId}|${p.pkey}`;
            UserStore.setItem(key, '1');
        }
    });
}

// ==========================================
// 7. FUNCIÓN UNIFICADA: CARGAR TODO AL INICIAR
// ==========================================
async function syncAllDataFromSupabase(category, userId) {
    if (!userId || userId === 'Invitado') {
        console.log('Usuario invitado, sin sincronización');
        return;
    }

    const isSignedIn = window.AppSupabase?.isSignedIn?.();
    if (!isSignedIn) {
        console.log('Usuario no autenticado, sin sincronización');
        return;
    }

    console.log(`🔄 Sincronizando datos de ${category} desde Supabase...`);

    // Cargar estados (favoritos/vistos)
    const states = await loadItemStatesFromSupabase(category);
    if (states.length > 0) {
        syncStatesToLocalStorage(category, states, userId);
    }

    // Actualizar UI
    const cards = document.querySelectorAll('[data-item-id]');
    applyRemoteStateToCards(cards, userId);
}

// ==========================================
// 8. APLICAR ESTADOS A LAS TARJETAS
// ==========================================
function applyRemoteStateToCards(cards, userId) {
    if (!cards || !userId) return;

    cards.forEach(card => {
        const itemId = card.getAttribute('data-item-id');
        if (!itemId) return;

        const favBtn = card.querySelector('.fav-btn');
        const viewedBtn = card.querySelector('.viewed-btn');

        const isFav = !!UserStore.getItem(`u:${userId}|item:${itemId}|fav`);
        const isViewed = !!UserStore.getItem(`u:${userId}|item:${itemId}|viewed`);

        if (favBtn) {
            favBtn.classList.toggle('active', isFav);
        }

        if (viewedBtn) {
            viewedBtn.classList.toggle('active', isViewed);
        }

        const completeInput = card.querySelector('.card-complete-input');
        if (completeInput) {
            completeInput.checked = isViewed;
        }
    });

    updateCardProgressIndicators();
}

// ==========================================
// 9. EXPORTAR FUNCIONES GLOBALES
// ==========================================
window.syncSupabase = {
    saveItemState: saveItemStateToSupabase,
    saveProgress: saveProgressToSupabase,
    loadItemStates: loadItemStatesFromSupabase,
    loadProgress: loadProgressFromSupabase,
    syncAll: syncAllDataFromSupabase,
    applyToCards: applyRemoteStateToCards
};
