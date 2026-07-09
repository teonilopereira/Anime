var TRANSLATION_CACHE_PREFIX = 'ad:trans:v2:';
var TRANSLATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function _translationCacheKey(text) {
    var s = String(text).trim().toLowerCase();
    if (s.length > 120) s = s.slice(0, 120);
    return TRANSLATION_CACHE_PREFIX + s;
}

async function translateText(text, targetLang) {
    targetLang = targetLang || 'es';
    if (!text || typeof text !== 'string' || text.length < 10) return text;
    var cacheKey = _translationCacheKey(text);
    try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (Date.now() < parsed.expiry) return parsed.text;
        }
    } catch (_) {}
    try {
        var resp = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 2000)) + '&langpair=en|' + targetLang + '&de=demo@example.com');
        var data = await resp.json();
        var translated = (data && data.responseData && data.responseData.translatedText) || text;
        if (translated !== text) {
            translated = translated.replace(/^\d+\s*[.)\]]?\s*/g, '').replace(/\s*\d+\s*[.)\]]?\s*$/g, '').trim();
            localStorage.setItem(cacheKey, JSON.stringify({ text: translated, expiry: Date.now() + TRANSLATION_CACHE_TTL }));
        }
        return translated;
    } catch (err) {
        console.warn('Translation error:', err);
        return text;
    }
}

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
    normalized.img = normalized.img || normalized.image || normalized.cover_image || normalized.portada || normalized.banner || (normalized.images?.webp?.large_image_url) || (normalized.images?.jpg?.large_image_url) || '';
    normalized.info = normalized.info || normalized.synopsis || normalized.descripcion || normalized.resumen || normalized.summary || '';
    normalized.status = normalized.status || normalized.estado || '';
    normalized.demografia = normalized.demografia || normalized.demography || normalized.demographic || '';
    normalized.volumenes = normalized.volumenes ?? normalized.volumes ?? normalized.chapters ?? normalized.capitulos ?? null;
    normalized.anio = normalized.anio ?? normalized.year ?? normalized.año ?? null;
    return normalized;
}

function findLocalDetailItem() {
    return null;
}

function getAnimeStructure(item) {
    if (!item) return { temporadas: [], temporadasCount: 0, ovas: 0, peliculas: 0, capitulos: 0 };
    const temporadas = parseTemporadas(item);
    const totalEps = temporadas.reduce((acc, t) => acc + Number(t.episodios || t.episodes || 0), 0);
    return {
        temporadas: temporadas,
        temporadasCount: temporadas.length,
        ovas: Number(item.ovas || 0),
        peliculas: Number(item.peliculas || item.movies || 0),
        capitulos: totalEps || Number(item.episodios || item.episodes || item.capitulos || 0)
    };
}

function parseTemporadas(item) {
    if (!item) return [];
    if (Array.isArray(item.temporadas) && item.temporadas.length > 0) return item.temporadas;
    const eps = Number(item.episodios || item.episodes || item.capitulos || 0);
    if (eps > 0) {
        return [{ nombre: 'Temporada 1', episodios: eps }];
    }
    return [];
}

function setDetailViewState(state, title, msg) {
    var loading = document.getElementById('detail-loading');
    var error = document.getElementById('detail-error');
    var apiLayout = document.getElementById('detail-api-layout');
    var localLayout = document.getElementById('detail-local-layout');
    if (state === 'loading') {
        if (loading) loading.hidden = false;
        if (error) error.hidden = true;
        if (apiLayout) apiLayout.hidden = true;
        if (localLayout) localLayout.hidden = true;
    } else if (state === 'error') {
        if (loading) loading.hidden = true;
        if (error) {
            error.hidden = false;
            var kicker = document.getElementById('detail-error-kicker');
            var titleEl = document.getElementById('detail-error-title');
            var msgEl = document.getElementById('detail-error-msg');
            if (kicker) kicker.textContent = title || 'No encontrado';
            if (titleEl) titleEl.textContent = title || 'No se encontr\u00F3 este t\u00EDtulo.';
            if (msgEl) msgEl.textContent = msg || '';
        }
        if (apiLayout) apiLayout.hidden = true;
        if (localLayout) localLayout.hidden = true;
    } else if (state === 'local') {
        if (loading) loading.hidden = true;
        if (error) error.hidden = true;
        if (apiLayout) apiLayout.hidden = true;
        if (localLayout) localLayout.hidden = false;
    } else {
        if (loading) loading.hidden = true;
        if (error) error.hidden = true;
        if (apiLayout) apiLayout.hidden = false;
        if (localLayout) localLayout.hidden = true;
    }
}

function replaceChildrenWithTextElement(parent, tag, text) {
    if (!parent) return;
    parent.innerHTML = '';
    var el = document.createElement(tag || 'p');
    el.textContent = text || '';
    parent.appendChild(el);
}

function saveDetailStateToSupabase(category, item, fav, viewed) {
    if (!window.AppSupabase?.saveItemState) return;
    var genreStr = '';
    if (Array.isArray(item.genres)) {
        genreStr = item.genres.map(function (g) {
            return typeof g === 'object' && g !== null ? (g.name || '') : g;
        }).filter(Boolean).join('|');
    } else if (Array.isArray(item.generos)) {
        genreStr = item.generos.map(function (g) {
            return typeof g === 'object' && g !== null ? (g.name || '') : g;
        }).filter(Boolean).join('|');
    } else if (typeof item.genres === 'string') {
        genreStr = item.genres;
    } else if (typeof item.generos === 'string') {
        genreStr = item.generos;
    }
    window.AppSupabase.saveItemState({
        category: category,
        itemId: String(item.id || item.mal_id || ''),
        fav: !!fav,
        viewed: !!viewed,
        meta: {
            titulo: item.titulo || item.title || '',
            img: item.img || item.image || '',
            info: genreStr || item.info || item.synopsis || ''
        }
    }).catch(function (err) {
        console.warn('saveDetailStateToSupabase error:', err);
    });
}

function hasSqlSession() {
    return !!(window.AppSupabase?.getCurrentUserSync?.());
}

function mergeDetalles(item) {
    return item;
}

function parseGeneros(item) {
    if (!item) return [];
    if (Array.isArray(item.generos)) {
        return item.generos.map(function (g) {
            return typeof g === 'object' && g !== null ? (g.name || '') : g;
        }).filter(Boolean);
    }
    if (Array.isArray(item.genres)) {
        return item.genres.map(function (g) {
            return typeof g === 'object' && g !== null ? (g.name || '') : g;
        }).filter(Boolean);
    }
    if (typeof item.generos === 'string') return item.generos.split(',').map(function (g) { return g.trim(); }).filter(Boolean);
    if (typeof item.genres === 'string') return item.genres.split(',').map(function (g) { return g.trim(); }).filter(Boolean);
    if (typeof item.info === 'string') {
        var parts = item.info.split('/').map(function (g) { return g.trim(); }).filter(Boolean);
        if (parts.length > 1) return parts;
    }
    return [];
}

function parseVolumenes(volumenes) {
    if (volumenes === null || volumenes === undefined) return 0;
    var n = Number(volumenes);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function getApiUnifiedProgress(userId, itemId, progressArg, category) {
    let watched = 0;
    let total = 0;
    if (category === 'anime') {
        if (Array.isArray(progressArg)) {
            progressArg.forEach((season, seasonIdx) => {
                const eps = Number(season.episodios || season.episodes || 0);
                total += eps;
                for (let ep = 1; ep <= eps; ep++) {
                    const key = episodeStorageKey(userId, itemId, seasonIdx, ep);
                    if (UserStore.getItem(key)) watched++;
                }
            });
        } else {
            total = Number(progressArg) || 0;
            for (let ep = 1; ep <= total; ep++) {
                const key = episodeStorageKey(userId, itemId, 0, ep);
                if (UserStore.getItem(key)) watched++;
            }
        }
    } else {
        total = Number(progressArg) || 0;
        for (let vol = 1; vol <= total; vol++) {
            const key = volumeStorageKey(userId, itemId, vol, category);
            if (UserStore.getItem(key)) watched++;
        }
    }
    const pct = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
    return { watched, pct };
}
