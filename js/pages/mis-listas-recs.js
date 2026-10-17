// js/pages/mis-listas-recs.js
// Recomendaciones basadas en los géneros que más mira el usuario.
// Extraído de mis-listas.js. Ámbito global (script clásico con defer), igual
// que mis-listas.js: comparte sus constantes y estado (_sessionUser, etc.) y
// sus funciones se llaman recién en DOMContentLoaded, con todo ya cargado.

// ─── Recomendaciones reales basadas en los géneros que mirás ───
let _recsSignature = null;

function recsMessage(text) {
    return '<p style="color:rgba(255,255,255,0.4);font-family:Rajdhani,sans-serif;text-align:center;grid-column:1/-1;padding:40px 0">' + escapeHtml(text) + '</p>';
}

async function renderRecommendations() {
    const grid = document.getElementById('recommendGrid');
    if (!grid) return;

    const subEl = document.querySelector('[data-i18n="lists.recommend.subtitulo"]');
    const setSub = function (txt) { if (subEl) subEl.textContent = txt; };

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        _recsSignature = null;
        setSub('Iniciá sesión para recibir recomendaciones.');
        grid.innerHTML = recsMessage('Iniciá sesión para ver recomendaciones personalizadas.');
        return;
    }

    // Perfil de gustos: ítems con "Visto", "Me gusta" o estado de seguimiento
    const profileEntries = getAllItems()
        .map(function (item) { return getUserItemState(userId, item); })
        .filter(function (e) { return e.viewed || e.fav || e.wstatus; });

    if (!profileEntries.length) {
        _recsSignature = null;
        setSub('Marcá algo como "Visto" o "Me gusta" para recibir recomendaciones.');
        grid.innerHTML = recsMessage('Agregá contenido a tus listas para ver recomendaciones.');
        return;
    }

    const topGenres = topGenresFromEntries(profileEntries).slice(0, 3);

    // Categoría preferida = la más marcada
    const catCount = {};
    profileEntries.forEach(function (e) {
        const c = e.item.__category;
        if (c) catCount[c] = (catCount[c] || 0) + 1;
    });
    const preferredCat = Object.keys(catCount)
        .sort(function (a, b) { return catCount[b] - catCount[a]; })[0] || 'anime';

    // Evitar re-fetch si nada cambió
    const signature = preferredCat + '|' + topGenres.join(',') + '|' + profileEntries.length;
    if (_recsSignature === signature && grid.children.length) return;
    _recsSignature = signature;

    setSub(topGenres.length
        ? 'Basado en tus gustos: ' + topGenres.join(', ') + '.'
        : 'Basado en lo que marcaste.');
    grid.innerHTML = recsMessage('Buscando recomendaciones...');

    const fetchers = {
        anime: window.getTopAnimes,
        manga: window.getTopMangas,
        novelas: window.getTopNovelas
    };
    const fetcher = fetchers[preferredCat] || window.getTopAnimes;
    if (typeof fetcher !== 'function') {
        grid.innerHTML = recsMessage('No se pudo cargar el catálogo de recomendaciones.');
        return;
    }

    const savedIds = new Set(getAllItems().map(function (i) { return String(i.id); }));
    const max = AnimeDestiny.Constants.MAX_RECOMMENDATIONS || 10;

    try {
        const results = await fetcher(1, topGenres.length ? { genres: topGenres } : {});
        const recs = (Array.isArray(results) ? results : [])
            .filter(function (r) { return !savedIds.has(String(r.id != null ? r.id : r.mal_id)); })
            .slice(0, max);

        if (_recsSignature !== signature) return; // otra llamada la reemplazó

        if (!recs.length) {
            grid.innerHTML = recsMessage('No encontramos títulos nuevos para recomendarte por ahora.');
            return;
        }

        grid.innerHTML = recs.map(function (r) {
            const img = (r.images && (
                (r.images.webp && (r.images.webp.large_image_url || r.images.webp.image_url)) ||
                (r.images.jpg && (r.images.jpg.large_image_url || r.images.jpg.image_url))
            )) || r.img || '';
            return renderMediaCard({
                item: {
                    id: r.id != null ? r.id : r.mal_id,
                    titulo: r.title || r.titulo || '',
                    img: img,
                    info: (r.genres || []).map(function (g) { return g.name || g; }).join('|'),
                    __category: preferredCat
                },
                match: topGenres[0] || ''
            });
        }).join('');

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (e) {
        console.warn('renderRecommendations error:', e);
        if (_recsSignature === signature) {
            grid.innerHTML = recsMessage('No se pudieron cargar las recomendaciones. Probá de nuevo en unos segundos.');
        }
    }
}
