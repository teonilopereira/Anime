function parseParams() {
    const p = new URLSearchParams(window.location.search);
    const VALID_CATS = new Set(['anime', 'manga', 'novelas']);
    const cat1 = (p.get('cat1') || 'anime').toLowerCase();
    const cat2 = (p.get('cat2') || 'anime').toLowerCase();
    const id1 = p.get('id1') || '';
    const id2 = p.get('id2') || '';
    return {
        cat1: VALID_CATS.has(cat1) ? cat1 : 'anime',
        id1: /^[a-z]?\d+$/i.test(id1) ? id1 : '',
        cat2: VALID_CATS.has(cat2) ? cat2 : 'anime',
        id2: /^[a-z]?\d+$/i.test(id2) ? id2 : ''
    };
}

async function getDetallesFor(cat, id) {
    return (typeof obtenerDetalleItem === 'function') ? obtenerDetalleItem(cat, id) : null;
}

async function getItem(cat, id) {
    if (typeof obtenerItemCategoria === 'function') return obtenerItemCategoria(cat, id);
    return null;
}

// Los items pueden venir del catálogo local ({titulo, img, info}) o de la
// API AniList/MangaDex ({title, images, ...}) — normalizamos los campos acá.
function compareItemTitle(item) {
    return item?.titulo || item?.title || 'Sin título';
}

function compareItemImage(item) {
    return item?.img || item?.imagen || item?.image
        || (typeof getApiPoster === 'function' ? getApiPoster(item) : '')
        || '';
}

function compareItemInfo(cat, item) {
    if (typeof item?.info === 'string' && item.info) return item.info;
    return (typeof getApiCatalogInfo === 'function') ? getApiCatalogInfo(cat, item) : '';
}

async function buildOptionList(cat, selectEl) {
    const list = (typeof obtenerItemsCategoria === 'function')
        ? await obtenerItemsCategoria(cat)
        : [];
    selectEl.innerHTML = list
        .slice()
        .sort((a, b) => compareItemTitle(a).localeCompare(compareItemTitle(b)))
        .map((it) => `<option value="${escapeHtml(it.id ?? it.mal_id)}">${escapeHtml(compareItemTitle(it))}</option>`)
        .join('');
}

function detailLink(cat, item) {
    return `detalle.html?cat=${encodeURIComponent(cat)}&id=${encodeURIComponent(item.id)}&nombre=${encodeURIComponent(compareItemTitle(item))}`;
}

async function renderCompareCard(host, cat, item) {
    if (!host) return;
    if (!item) {
        host.innerHTML = `<div class="compare-empty">Seleccioná un item</div>`;
        return;
    }
    const det = (await getDetallesFor(cat, item.id)) || {};
    const titulo = compareItemTitle(item);
    const img = compareItemImage(item);
    const info = compareItemInfo(cat, item);
    const coverHtml = img
        ? `<img src="${safeUrl(img)}" alt="${escapeHtml(titulo)}" width="230" height="345" decoding="async" loading="lazy">`
        : `<span class="compare-cover-empty">Sin imagen</span>`;
    const generos = (typeof info === 'string') ? info.split('/').map(s => s.trim()).filter(Boolean) : [];
    const chips = generos.length ? generos.map(g => `<span class="detail-chip">${escapeHtml(g)}</span>`).join('') : '';

    const common = `
        <div class="compare-cover">${coverHtml}</div>
        <div class="compare-body">
            <div class="compare-cat">${escapeHtml(cat)}</div>
            <div class="compare-title">${escapeHtml(titulo)}</div>
            <div class="compare-info">${escapeHtml(info || '')}</div>
            <div class="detail-chips">${chips}</div>
            <div class="compare-meta">
                <div><strong>Estado:</strong> ${escapeHtml(item.status || 'No especificado')}</div>
                <div><strong>Año:</strong> ${escapeHtml(det.anio ?? 'No especificado')}</div>
                ${cat === 'anime' ? `<div><strong>Estudio:</strong> ${escapeHtml(det.estudio ?? 'No especificado')}</div>` : ''}
                ${cat === 'manga' || cat === 'novelas' ? `<div><strong>Volúmenes:</strong> ${escapeHtml(det.volumenes ?? 'No especificado')}</div>` : ''}

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
    Promise.all([
        buildOptionList(cat1.value, id1),
        buildOptionList(cat2.value, id2)
    ]).then(() => {
        if (params.id1) id1.value = params.id1;
        if (params.id2) id2.value = params.id2;
        run();
    });

    async function run() {
        const [itemA, itemB] = await Promise.all([
            getItem(cat1.value, id1.value),
            getItem(cat2.value, id2.value)
        ]);
        await Promise.all([
            renderCompareCard(a, cat1.value, itemA),
            renderCompareCard(b, cat2.value, itemB)
        ]);
        syncUrl(cat1.value, id1.value, cat2.value, id2.value);
    }

    cat1.addEventListener('change', () => {
        buildOptionList(cat1.value, id1).then(run);
    });
    cat2.addEventListener('change', () => {
        buildOptionList(cat2.value, id2).then(run);
    });
    id1.addEventListener('change', run);
    id2.addEventListener('change', run);
    doCompare.addEventListener('click', run);
});
