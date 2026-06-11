function getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        nombre: params.get('nombre'),
        cat: params.get('cat') || params.get('categoria')
    };
}

function normalizeDetailItem(item) {
    if (!item || typeof item !== 'object') return null;
    const normalized = { ...item };
    normalized.id = normalized.id ?? normalized.mal_id ?? normalized.item_id ?? normalized.itemId ?? null;
    normalized.titulo = normalized.titulo || normalized.title || normalized.name || normalized.nombre || '';
    normalized.img = normalized.img || normalized.image || normalized.cover_image || normalized.portada || normalized.banner || '';
    normalized.info = normalized.info || normalized.synopsis || normalized.descripcion || normalized.resumen || normalized.summary || '';
    normalized.status = normalized.status || normalized.estado || '';
    normalized.demografia = normalized.demografia || normalized.demography || normalized.demographic || '';
    normalized.volumenes = normalized.volumenes ?? normalized.volumes ?? normalized.chapters ?? normalized.capitulos ?? null;
    normalized.anio = normalized.anio ?? normalized.year ?? normalized.año ?? null;
    return normalized;
}

function findLocalDetailItem(categoria, id, nombre) {
    const lista = (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB[categoria]))
        ? DATOS_WEB[categoria]
        : [];
    if (!lista.length) return null;

    const normalizedId = String(id ?? '').trim();
    const normalizedNombre = String(nombre ?? '').trim().toLowerCase();

    let item = lista.find((entry) => {
        const entryId = String(entry.id ?? entry.mal_id ?? entry.item_id ?? entry.itemId ?? '').trim();
        return normalizedId && entryId === normalizedId;
    });
    if (item) return normalizeDetailItem(item);

    if (normalizedNombre) {
        item = lista.find((entry) => {
            const entryTitle = String(entry.titulo || entry.title || entry.name || entry.nombre || '').trim().toLowerCase();
            return entryTitle && entryTitle === normalizedNombre;
        });
        if (item) return normalizeDetailItem(item);
    }

    return null;
}
