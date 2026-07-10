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
            let url = '';
            let site = '';

            if (streamEp) {
                title = streamEp.title || `Episodio ${epNum}`;
                thumbnail = streamEp.thumbnail || '';
                url = streamEp.url || '';
                site = streamEp.site || '';
                synopsis = `Este episodio está disponible para ver oficialmente en ${site}. Podés reproducirlo haciendo clic en el enlace de streaming abajo.`;
                if (typeof translateText === 'function' && streamEp.title && !streamEp.title.startsWith('Episodio')) {
                    try { title = await translateText(streamEp.title); } catch (_) {}
                }
            }

            const fillerLabel = 'No especificado (Canon probable)';
            const fillerColor = '#22c55e';

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
                        <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 1rem;">INFORMACIÓN</h4>
                        <p style="margin: 0; color: #ccc; line-height: 1.5; font-size: 0.95rem;">${escapeHtml(synopsis)}</p>
                    </div>
                    ${url ? `
                        <a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="details-btn" style="text-align: center; margin-top: 10px; display: block; background: linear-gradient(90deg, #bc13fe, #00f2ff); border: none; color: white; padding: 12px; border-radius: 6px; font-weight: bold; text-decoration: none; box-shadow: 0 0 15px rgba(0, 242, 255, 0.35); text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s ease-in-out;">
                            Reproducir en ${escapeHtml(site)} ↗
                        </a>
                    ` : ''}
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

            if (hasMangaDexSource && typeof window.resolveMangaDexCoverForVolume === 'function') {
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
    });
})();

