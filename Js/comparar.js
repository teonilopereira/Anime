function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function parseParams() {
    const p = new URLSearchParams(window.location.search);
    return {
        cat1: p.get('cat1') || 'anime',
        id1: p.get('id1') || '',
        cat2: p.get('cat2') || 'manga',
        id2: p.get('id2') || ''
    };
}

function getDetallesFor(cat, id) {
    return (typeof obtenerDetalleItem === 'function') ? obtenerDetalleItem(cat, id) : null;
}

function getItem(cat, id) {
    if (typeof obtenerItemCategoria === 'function') return obtenerItemCategoria(cat, id);
    const list = (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB[cat])) ? DATOS_WEB[cat] : [];
    return list.find((x) => String(x.id) === String(id)) || null;
}

function buildOptionList(cat, selectEl) {
    const list = (typeof obtenerItemsCategoria === 'function')
        ? obtenerItemsCategoria(cat)
        : ((typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB[cat])) ? DATOS_WEB[cat] : []);
    selectEl.innerHTML = list
        .slice()
        .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)))
        .map((it) => `<option value="${escapeHtml(it.id)}">${escapeHtml(it.titulo)}</option>`)
        .join('');
}

function detailLink(cat, item) {
    return `detalle.html?cat=${encodeURIComponent(cat)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(item.titulo)}`;
}

function renderCompareCard(host, cat, item) {
    if (!host) return;
    if (!item) {
        host.innerHTML = `<div class="compare-empty">Seleccioná un item</div>`;
        return;
    }
    const det = getDetallesFor(cat, item.id) || {};
    const generos = (typeof item.info === 'string') ? item.info.split('/').map(s => s.trim()).filter(Boolean) : [];
    const chips = generos.length ? generos.map(g => `<span class="detail-chip">${escapeHtml(g)}</span>`).join('') : '';

    const common = `
        <div class="compare-cover"><img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.titulo)}"></div>
        <div class="compare-body">
            <div class="compare-cat">${escapeHtml(cat)}</div>
            <div class="compare-title">${escapeHtml(item.titulo)}</div>
            <div class="compare-info">${escapeHtml(item.info || '')}</div>
            <div class="detail-chips">${chips}</div>
            <div class="compare-meta">
                <div><strong>Estado:</strong> ${escapeHtml(item.status || 'No especificado')}</div>
                <div><strong>Año:</strong> ${escapeHtml(det.anio ?? 'No especificado')}</div>
                ${cat === 'anime' ? `<div><strong>Estudio:</strong> ${escapeHtml(det.estudio ?? 'No especificado')}</div>` : ''}
                ${cat === 'manga' ? `<div><strong>Volúmenes:</strong> ${escapeHtml(det.volumenes ?? 'No especificado')}</div>` : ''}
                ${cat === 'juegos' ? `<div><strong>Plataforma:</strong> ${escapeHtml(det.plataforma ?? 'No especificado')}</div>` : ''}
            </div>
            <div class="compare-actions">
                <a class="details-btn" href="${escapeHtml(detailLink(cat, item))}">Abrir detalle</a>
            </div>
        </div>
    `;

    host.innerHTML = common;
}

function syncUrl(cat1, id1, cat2, id2) {
    const p = new URLSearchParams();
    p.set('cat1', cat1);
    p.set('id1', id1);
    p.set('cat2', cat2);
    p.set('id2', id2);
    history.replaceState({}, '', `comparar.html?${p.toString()}`);
}

document.addEventListener('DOMContentLoaded', () => {
    const params = parseParams();
    const cat1 = document.getElementById('cat1');
    const id1 = document.getElementById('id1');
    const cat2 = document.getElementById('cat2');
    const id2 = document.getElementById('id2');
    const doCompare = document.getElementById('doCompare');
    const a = document.getElementById('compareA');
    const b = document.getElementById('compareB');

    if (!cat1 || !id1 || !cat2 || !id2 || !doCompare) return;

    cat1.value = params.cat1;
    cat2.value = params.cat2;
    buildOptionList(cat1.value, id1);
    buildOptionList(cat2.value, id2);
    if (params.id1) id1.value = params.id1;
    if (params.id2) id2.value = params.id2;

    function run() {
        const itemA = getItem(cat1.value, id1.value);
        const itemB = getItem(cat2.value, id2.value);
        renderCompareCard(a, cat1.value, itemA);
        renderCompareCard(b, cat2.value, itemB);
        syncUrl(cat1.value, id1.value, cat2.value, id2.value);
    }

    cat1.addEventListener('change', () => { buildOptionList(cat1.value, id1); run(); });
    cat2.addEventListener('change', () => { buildOptionList(cat2.value, id2); run(); });
    id1.addEventListener('change', run);
    id2.addEventListener('change', run);
    doCompare.addEventListener('click', run);

    run();
});
