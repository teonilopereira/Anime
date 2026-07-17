// Sinopsis por episodio desde Jikan (MyAnimeList). Cachea también el
// "sin datos" para no repetir requests (límite Jikan: 3 req/s, 60/min).
var JIKAN_EP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

async function fetchJikanEpisode(malId, ep) {
    if (!malId || !ep) return null;
    var cacheKey = 'jikan_ep_' + malId + '_' + ep;
    try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (Date.now() < parsed.expiry) return parsed.data;
        }
    } catch (_) {}

    try {
        var resp = await fetch('https://api.jikan.moe/v4/anime/' + encodeURIComponent(malId) + '/episodes/' + encodeURIComponent(ep));
        if (!resp.ok) return null;
        var json = await resp.json();
        var d = json?.data || null;
        var data = d ? {
            title: d.title || '',
            synopsis: d.synopsis || '',
            filler: !!d.filler,
            recap: !!d.recap
        } : null;
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ data: data, expiry: Date.now() + JIKAN_EP_CACHE_TTL }));
        } catch (_) {}
        return data;
    } catch (err) {
        console.warn('fetchJikanEpisode error:', err);
        return null;
    }
}

// Fallback: sinopsis por episodio desde Kitsu (cuando Jikan/MAL está caído).
// Kitsu no tiene datos de relleno/recap, solo título y sinopsis.
async function resolveKitsuAnimeId(anilistId) {
    if (!anilistId) return null;
    var cacheKey = 'kitsu_id_' + anilistId;
    try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) return cached === 'null' ? null : cached;
    } catch (_) {}

    try {
        var resp = await fetch('https://kitsu.io/api/edge/mappings?filter%5BexternalSite%5D=anilist/anime&filter%5BexternalId%5D=' + encodeURIComponent(anilistId) + '&include=item', {
            headers: { 'Accept': 'application/vnd.api+json' }
        });
        if (!resp.ok) return null;
        var json = await resp.json();
        var kitsuId = json?.included?.[0]?.type === 'anime' ? String(json.included[0].id) : null;
        try { localStorage.setItem(cacheKey, kitsuId || 'null'); } catch (_) {}
        return kitsuId;
    } catch (err) {
        console.warn('resolveKitsuAnimeId error:', err);
        return null;
    }
}

async function fetchKitsuEpisode(anilistId, ep) {
    if (!anilistId || !ep) return null;
    var kitsuId = await resolveKitsuAnimeId(anilistId);
    if (!kitsuId) return null;

    var cacheKey = 'kitsu_ep_' + kitsuId + '_' + ep;
    try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
            var parsed = JSON.parse(cached);
            if (Date.now() < parsed.expiry) return parsed.data;
        }
    } catch (_) {}

    try {
        var resp = await fetch('https://kitsu.io/api/edge/anime/' + encodeURIComponent(kitsuId) + '/episodes?filter%5Bnumber%5D=' + encodeURIComponent(ep), {
            headers: { 'Accept': 'application/vnd.api+json' }
        });
        if (!resp.ok) return null;
        var json = await resp.json();
        var attrs = json?.data?.[0]?.attributes || null;
        var data = attrs ? {
            title: attrs.titles?.en_us || attrs.canonicalTitle || '',
            synopsis: attrs.synopsis || attrs.description || ''
        } : null;
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ data: data, expiry: Date.now() + JIKAN_EP_CACHE_TTL }));
        } catch (_) {}
        return data;
    } catch (err) {
        console.warn('fetchKitsuEpisode error:', err);
        return null;
    }
}

async function showEpisodeInfoModal(item, epNum, isAnime, categoria) {
    const modal = document.getElementById('resumenModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) return;

    const label = isAnime ? 'Episodio' : 'Volumen';
    modalTitle.textContent = `${label} ${epNum}`;
    replaceChildrenWithTextElement(modalBody, 'p', 'Cargando información...');
    modal.style.display = 'flex';

    try {
        let html = '';
        
        if (isAnime) {
            // Buscar si hay streamingEpisodes en los datos del anime
            const episodes = item.streamingEpisodes || [];
            let streamEp = null;

            if (episodes.length >= epNum) {
                streamEp = episodes[epNum - 1];
            } else {
                // Fallback: buscar por el número de episodio en el título
                streamEp = episodes.find(e => {
                    const match = String(e.title).match(/Episode\s+(\d+)/i);
                    return match && parseInt(match[1], 10) === epNum;
                });
            }

            let title = `Episodio ${epNum}`;
            let synopsis = 'Sin resumen individual disponible. Marcá tu progreso y completá el anime.';
            let thumbnail = '';
            let site = '';

            if (streamEp) {
                title = streamEp.title || `Episodio ${epNum}`;
                thumbnail = streamEp.thumbnail || '';
                site = streamEp.site || '';
                synopsis = `Este episodio está disponible oficialmente en ${site}. Marcá tu progreso y completá el anime.`;
            }

            // Sinopsis real del episodio: Jikan (MAL) primero, Kitsu de fallback
            let fillerLabel = 'No especificado (Canon probable)';
            let fillerColor = '#22c55e';
            let epSynopsis = '';
            const jikanEp = await fetchJikanEpisode(item?.mal_id, epNum);
            if (jikanEp) {
                if (jikanEp.title) title = jikanEp.title;
                if (jikanEp.synopsis) epSynopsis = jikanEp.synopsis;
                if (jikanEp.filler) {
                    fillerLabel = 'Relleno';
                    fillerColor = '#f59e0b';
                } else if (jikanEp.recap) {
                    fillerLabel = 'Recap';
                    fillerColor = '#94a3b8';
                } else {
                    fillerLabel = 'Canon';
                }
            }
            if (!epSynopsis) {
                const kitsuEp = await fetchKitsuEpisode(item?.id, epNum);
                if (kitsuEp) {
                    if (kitsuEp.title && (!jikanEp || !jikanEp.title)) title = kitsuEp.title;
                    if (kitsuEp.synopsis) epSynopsis = kitsuEp.synopsis;
                }
            }
            if (epSynopsis) {
                synopsis = epSynopsis.replace(/\s*\(Source:.*?\)\s*$/i, '').trim();
            }

            if (typeof translateText === 'function') {
                if (title && !title.startsWith('Episodio')) {
                    try { title = await translateText(title); } catch (_) {}
                }
                if (epSynopsis) {
                    try { synopsis = await translateText(synopsis); } catch (_) {}
                }
            }

            html = `
                <div class="modal-episode-info" style="display: flex; flex-direction: column; gap: 15px;">
                    ${thumbnail ? `
                        <div class="modal-episode-thumb" style="width: 100%; max-height: 220px; overflow: hidden; border-radius: 8px; border: 1px solid var(--accent-cyan); box-shadow: 0 4px 15px rgba(0, 242, 255, 0.25);">
                            <img src="${safeUrl(thumbnail)}" alt="${escapeHtml(title)}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    ` : ''}
                    <h3 style="color: var(--accent-cyan); margin: 0; font-size: 1.4rem; font-family: 'Orbitron', sans-serif;">${escapeHtml(title)}</h3>
                    <div class="modal-meta" style="font-size: 0.9rem; color: #aaa;">
                        <p style="margin: 4px 0;"><strong>Número de episodio:</strong> ${epNum}</p>
                        <p style="margin: 4px 0;"><strong>Tipo / Estado:</strong> <span style="color: ${fillerColor}; font-weight: bold; padding: 2px 6px; background: ${fillerColor}15; border: 1px solid ${fillerColor}; border-radius: 4px;">${escapeHtml(fillerLabel)}</span></p>
                        ${site ? `<p style="margin: 4px 0;"><strong>Streaming Oficial:</strong> <span style="color: #fff; padding: 2px 6px; background: rgba(0, 242, 255, 0.1); border-radius: 4px; border: 1px solid var(--accent-cyan);">${escapeHtml(site)}</span></p>` : ''}
                    </div>
                    <div class="modal-synopsis" style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 12px; margin-top: 5px;">
                        <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 1rem;">${epSynopsis ? 'RESUMEN' : 'INFORMACIÓN'}</h4>
                        <p style="margin: 0; color: #ccc; line-height: 1.5; font-size: 0.95rem;">${escapeHtml(synopsis)}</p>
                    </div>
                </div>
            `;
        } else {
            const fallbackLabel = categoria === 'novelas' ? 'Novela' : 'Manga';
            const fallbackArticle = categoria === 'novelas' ? 'esta novela' : 'este manga';
            const title = `${item.titulo || item.title || fallbackLabel} - Volumen ${epNum}`;
            const chapters = item.chapters || 'No especificado';
            const typeLabel = categoria === 'novelas' ? 'Canon (Novela Original)' : 'Canon (Manga Original)';
            const synopsis = `Contenido correspondiente al Volumen ${epNum} de ${item.titulo || item.title || fallbackArticle}. Registrá tu lectura marcándolo en la cuadrícula principal.`;

            const isMangaDexUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
            const hasMangaDexSource = isMangaDexUuid(item?.id) || isMangaDexUuid(item?.mangadex_id) || isMangaDexUuid(item?.mangaDexId);

            let coverHtml = `
                <div class="modal-volume-cover modal-volume-cover--empty" aria-hidden="true">
                    <span>Portada del volumen no disponible</span>
                </div>
            `;

            const canResolveCover = typeof window.resolveMangaDexCoverForVolume === 'function'
                && (categoria === 'manga' || hasMangaDexSource);

            if (canResolveCover) {
                try {
                    const coverUrl = await window.resolveMangaDexCoverForVolume(item, epNum);
                    if (coverUrl) {
                        coverHtml = `
                            <div class="modal-volume-cover">
                                <img src="${safeUrl(coverUrl)}" alt="Portada Volumen ${epNum}">
                            </div>
                        `;
                    }
                } catch (cErr) {
                    console.warn("No se pudo cargar la portada del volumen en MangaDex:", cErr);
                }
            }

            html = `
                <div class="modal-volume-info" style="display: flex; flex-direction: column; gap: 15px;">
                    ${coverHtml}
                    <h3 style="color: var(--accent-purple); margin: 0; font-size: 1.4rem; font-family: 'Orbitron', sans-serif;">${escapeHtml(title)}</h3>
                    <div class="modal-meta" style="font-size: 0.9rem; color: #aaa;">
                        <p style="margin: 4px 0;"><strong>Volumen:</strong> ${epNum}</p>
                        <p style="margin: 4px 0;"><strong>Tipo:</strong> <span style="color: #22c55e; font-weight: bold; padding: 2px 6px; background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 4px;">${escapeHtml(typeLabel)}</span></p>
                        <p style="margin: 4px 0;"><strong>Capítulos totales:</strong> ${escapeHtml(String(chapters))}</p>
                    </div>
                    <div class="modal-synopsis" style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 12px; margin-top: 5px;">
                        <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 1rem;">INFORMACIÓN</h4>
                        <p style="margin: 0; color: #ccc; line-height: 1.5; font-size: 0.95rem;">${escapeHtml(synopsis)}</p>
                    </div>
                </div>
            `;
        }

        modalBody.innerHTML = html;
    } catch (error) {
        console.error('Error al mostrar información detallada:', error);
        replaceChildrenWithTextElement(modalBody, 'p', 'Error al cargar la información. Intentá de nuevo.');
    }
}
async function renderApiResult(item, apiCat) {
    if (item) {
        renderApiDetalle(item, apiCat);
        return true;
    }
    return false;
}

async function cargarDetalleDesdeApi(id, categoria) {
    if (categoria !== 'manga' && categoria !== 'anime' && categoria !== 'novelas') return false;

    setDetailViewState('loading');

    // Fase 1: AniList por ID numérico
    const numId = Number(id);
    if (Number.isFinite(numId)) {
        const apiCat = categoria === 'anime' ? 'anime' : 'manga';
        const getById = apiCat === 'anime' ? window.getAnimeById : window.getMangaById;
        if (typeof getById === 'function') {
            try {
                const found = await getById(id);
                if (found) return renderApiResult(found, categoria);
            } catch (e) {
                AnimeDestiny.reportError('anilist', 'Error al obtener detalle por ID', { id, categoria, error: String(e?.message ?? e) });
            }
        }
    }

    // Fase 2: MangaDex por UUID (solo manga/novelas)
    if ((categoria === 'manga' || categoria === 'novelas') && typeof window.getMangaDexById === 'function') {
        try {
            const found = await window.getMangaDexById(id);
            if (found) return renderApiResult(found, categoria);
        } catch (e) {
            AnimeDestiny.reportError('mangadex', 'Error inesperado en getMangaDexById', { id, categoria, error: String(e?.message ?? e) });
        }
    }

    return false;
}

function renderApiDetalle(item, apiCat) {
    var synopsisField = item.sinopsis || item.synopsis || item.description || '';
    if (synopsisField && typeof translateText === 'function') {
        translateText(synopsisField).then(function (translated) {
            item.sinopsis = translated;
            renderDetalle(item, item.title || item.titulo || '', apiCat);
        });
    } else {
        renderDetalle(item, item.title || item.titulo || '', apiCat);
    }
}

(function initDetallePage() {
    var params = getParams();
    if (!params.id || !params.cat) {
        setDetailViewState('error', 'Faltan par\u00E1metros', 'Us\u00E1 el cat\u00E1logo para elegir un t\u00EDtulo.');
        return;
    }

    cargarDetalleDesdeApi(params.id, params.cat).then(function (found) {
        if (!found) {
            setDetailViewState('error', 'No encontrado', 'No se pudo encontrar el t\u00EDtulo en las APIs.');
        }
        if (window.AnimeDestiny?.Comments?.load) {
            window.AnimeDestiny.Comments.load(params.cat, params.id);
        }
    });
})();

