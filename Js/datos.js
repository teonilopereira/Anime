window.DATOS_WEB = { manga: [], anime: [], juegos: [], novelas: [] };

function normalizeSupabaseRow(row) {
    if (!row) return null;

    let source = null;
    if (row.detail_json) {
        if (typeof row.detail_json === 'string') {
            try {
                source = JSON.parse(row.detail_json);
            } catch {
                source = null;
            }
        } else if (typeof row.detail_json === 'object' && row.detail_json !== null) {
            source = row.detail_json;
        }
    }
    if (!source && row.detailJson) {
        source = typeof row.detailJson === 'string'
            ? JSON.parse(row.detailJson || '{}')
            : row.detailJson;
    }
    source = source || row;

    return {
        id:         source.id ?? row.item_id ?? row.itemId ?? row.mal_id ?? null,
        titulo:     source.titulo || source.title || source.name || '',
        img:        source.img || source.image || source.cover_image || '',
        info:       source.info || source.synopsis || '',
        precio:     source.precio ?? source.price ?? null,
        status:     source.status || '',
        clase:      source.clase || source.class_name || source.className || '',
        demografia: source.demografia || source.demography || '',
        ...source
    };
}

async function loadCatalogFromSupabase() {
    try {
        if (!window.AppSupabaseReady) return null;
        const AppSupabase = await window.AppSupabaseReady;
        if (!AppSupabase?.db) return null;

        const { data, error } = await AppSupabase.db.from('animes').select('*');
        if (error) throw error;
        if (!Array.isArray(data) || data.length === 0) return null;

        const catalog = { manga: [], anime: [], juegos: [], novelas: [] };
        for (const row of data) {
            const item = normalizeSupabaseRow(row);
            if (!item || !item.id) continue;

            const category = String(row.category || row.categoria || row.type || 'anime').toLowerCase();
            if (!catalog[category]) catalog[category] = [];
            catalog[category].push(item);
        }

        return catalog;
    } catch (error) {
        console.warn('No se pudo cargar el catálogo desde Supabase:', error);
        return null;
    }
}

async function cargarDatosEstaticos() {
    try {
        const supabaseCatalog = await loadCatalogFromSupabase();
        if (supabaseCatalog) {
            window.DATOS_WEB = supabaseCatalog;
        } else {
            // Supabase es la única fuente de verdad. Si falla, el catálogo queda vacío.
            console.warn('datos.js: No se pudo cargar el catálogo desde Supabase. Catálogo vacío.');
            window.DATOS_WEB = { manga: [], anime: [], juegos: [], novelas: [] };
        }

        const event = new CustomEvent('datosCargados');
        document.dispatchEvent(event);
    } catch (error) {
        console.error('datos.js: Error inesperado al cargar el catálogo:', error);
        window.DATOS_WEB = { manga: [], anime: [], juegos: [], novelas: [] };
        document.dispatchEvent(new CustomEvent('datosCargados'));
    }
}

// Iniciar la carga apenas se incluye este script
cargarDatosEstaticos();
