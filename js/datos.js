if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    };
}

if (typeof window.safeUrl !== 'function') {
    window.safeUrl = function(value) {
        if (!value) return '';
        var url = String(value).trim();
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
            return url;
        }
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === 'http:' ||
                parsed.protocol === 'https:' ||
                (parsed.protocol === 'data:' && url.toLowerCase().startsWith('data:image/'))
            ) {
                return url;
            }
        } catch (_) {}
        return '';
    };
}

/** Helper to capitalize first letter */
function _capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/** Obtiene los items de una categoría (anime, manga, novelas) delegando a la API */
function obtenerItemsCategoria(categoria) {
    const base = 'getTop' + _capitalize(categoria);
    // Algunas categorías usan plural en el nombre global
    const fn = window[base] || window[base + 's'];
    if (typeof fn === 'function') {
        return fn(); // devuelve una Promise de array
    }
    return [];
}

/** Obtiene un item específico de una categoría */
function obtenerItemCategoria(categoria, id) {
    return obtenerItemsCategoria(categoria).then(items => items.find(i => i.id == id) || null);
}

/** Obtiene el detalle de un item */
// Implementación completa de obtenerDetalleItem
function obtenerDetalleItem(categoria, id) {
    const fn = window['get' + _capitalize(categoria) + 'ById'];
    if (typeof fn === 'function') {
        return fn(id); // devuelve Promise
    }
    return Promise.resolve(null);
}



