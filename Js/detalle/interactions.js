function wirePremiumDetailInteractions(root, item, categoria, seasons) {
    const itemId = String(item.id || item.mal_id || '');
    const total = getApiChapterTotal(item, categoria);
    const isAnime = categoria === 'anime';
    const progressLabel = isAnime ? 'EP' : 'VOL';
    const progressHeading = isAnime ? 'EPISODIOS GENERAL' : 'VOLÚMENES GENERAL';
    const hasSeasons = isAnime && Array.isArray(seasons) && seasons.length > 0;

    const fill = root.querySelector('#barra-progreso-fill-total');
    const counterText = root.querySelector('#contador-vistos-texto');
    const labelProgress = root.querySelector('#label-capitulos-progreso');
    const labelPct = root.querySelector('#label-porcentaje-progreso');
    const progressHeadingEl = root.querySelector('#progreso-general-titulo');
    const grid = root.querySelector('#detail-capitulos-grid');
    const synopsis = root.querySelector('#detail-sinopsis');
    const seeMore = root.querySelector('#detail-ver-mas');
    const favBtn = root.querySelector('.btn-favorito');
    const viewedBtn = root.querySelector('.btn-visto-completo');
    const shareBtn = root.querySelector('.btn-compartir');

    if (progressHeadingEl) progressHeadingEl.textContent = progressHeading;

    function getTotalCapitulos() {
        if (hasSeasons) {
            return seasons.reduce(function (acc, s) { return acc + (Number(s.episodes) || 0); }, 0);
        }
        return total;
    }

    function updateProgressUi() {
        const uId = getCurrentUserIdSafe();
        const progressArg = hasSeasons ? seasons : total;
        const next = getApiUnifiedProgress(uId, itemId, progressArg, categoria);
        const totalCap = getTotalCapitulos();
        if (fill) fill.style.width = `${next.pct}%`;
        if (counterText) counterText.textContent = `${next.watched}/${totalCap || 0} completados`;
        if (labelProgress) labelProgress.textContent = `${progressLabel} ${next.watched}/${totalCap || 0}`;
        if (labelPct) labelPct.textContent = `${next.pct}%`;
    }

    updateProgressUi();

    grid?.addEventListener('click', (event) => {
        const btn = event.target instanceof HTMLElement ? event.target.closest('button.cuadrado-item') : null;
        if (!btn) return;

        const ep = Number.parseInt(btn.getAttribute('data-ep') || '', 10);
        if (!Number.isFinite(ep) || ep <= 0) return;

        const seasonIdx = Number.parseInt(btn.getAttribute('data-season') || '0', 10);
        const uId = getCurrentUserIdSafe();
        const key = isAnime
            ? episodeStorageKey(uId, itemId, seasonIdx, ep)
            : volumeStorageKey(uId, itemId, ep, categoria);
        const isActive = btn.classList.toggle('is-visto');

        grid.querySelectorAll('.cuadrado-item').forEach((el) => el.classList.remove('is-selected'));
        btn.classList.add('is-selected');

        if (isActive) UserStore.setItem(key, '1');
        else UserStore.removeItem(key);

        const supabaseKey = isAnime
            ? progressSqlKeyEpisode(seasonIdx, ep)
            : progressSqlKeyVolume(ep);
        saveProgressToSupabase(categoria, itemId, supabaseKey, isActive);

        updateProgressUi();
    });

    if (seeMore && synopsis) {
        seeMore.addEventListener('click', (event) => {
            event.preventDefault();
            const expanded = synopsis.classList.toggle('is-expanded');
            seeMore.textContent = expanded ? 'Ver menos' : 'Ver más';
        });
    }

    function syncActionButton(button, type) {
        if (!button) return;
        const uId = getCurrentUserIdSafe();
        const key = detailStatusStorageKey(uId, itemId, type);
        const active = !!UserStore.getItem(key);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    [
        { button: favBtn, type: 'fav' },
        { button: viewedBtn, type: 'viewed' }
    ].forEach(({ button, type }) => {
        if (!button) return;
        syncActionButton(button, type);
        button.addEventListener('click', () => {
            const uId = getCurrentUserIdSafe();

            // Bug 2 fix: redirigir a login si el usuario es invitado
            if (uId === 'Invitado') {
                window.location.href = 'Login.html';
                return;
            }

            const key = detailStatusStorageKey(uId, itemId, type);
            const enabled = !UserStore.getItem(key);
            if (enabled) {
                UserStore.setItem(key, '1');
                // Bug 1 fix: dar XP igual que toggleStatus() en catálogo
                if (typeof addUserPoints === 'function') {
                    const xp = type === 'viewed'
                        ? (AnimeDestiny.Constants.XP_VIEWED || 10)
                        : (AnimeDestiny.Constants.XP_FAV || 5);
                    addUserPoints(uId, xp);
                }
            } else {
                UserStore.removeItem(key);
            }
            syncActionButton(button, type);

            if (window.Toast) {
                if (enabled) {
                    if (type === 'fav') window.Toast.success("¡Agregado a Favoritos! ❤️");
                    if (type === 'viewed') window.Toast.success("¡Marcado como Visto! 👁️ (+" + (AnimeDestiny.Constants.XP_VIEWED || 10) + " EXP)");
                } else {
                    if (type === 'fav') window.Toast.info("Quitado de Favoritos");
                    if (type === 'viewed') window.Toast.info("Marcado como no visto");
                }
            }
            
            const favKey = detailStatusStorageKey(uId, itemId, 'fav');
            const viewedKey = detailStatusStorageKey(uId, itemId, 'viewed');
            saveDetailStateToSupabase(
                categoria,
                { ...item, id: itemId },
                !!UserStore.getItem(favKey),
                !!UserStore.getItem(viewedKey)
            );
        });
    });

    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            syncActionButton(favBtn, 'fav');
            syncActionButton(viewedBtn, 'viewed');
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('u:')) {
            syncActionButton(favBtn, 'fav');
            syncActionButton(viewedBtn, 'viewed');
        }
    });

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const title = item.title || item.title_english || item.titulo || 'este título';
            const shareData = {
                title: document.title,
                text: `¡Mirá este ${categoria} que encontré! Se llama "${title}".`,
                url: window.location.href
            };
            if (navigator.share) {
                navigator.share(shareData).catch(err => console.warn('Error al compartir:', err));
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    alert('Enlace copiado al portapapeles. ¡Pegalo para compartir!');
                }).catch(() => {
                    alert('No se pudo copiar el enlace.');
                });
            }
        });
    }

    if (window.AppSupabase || hasSqlSession()) {
        syncProgressFromSupabase(categoria, itemId).then(() => {
            const uId = getCurrentUserIdSafe();
            grid?.querySelectorAll('button.cuadrado-item').forEach((btn) => {
                const ep = Number.parseInt(btn.getAttribute('data-ep') || '', 10);
                if (!Number.isFinite(ep)) return;
                const seasonIdx = Number.parseInt(btn.getAttribute('data-season') || '0', 10);
                const key = isAnime
                    ? episodeStorageKey(uId, itemId, seasonIdx, ep)
                    : volumeStorageKey(uId, itemId, ep, categoria);
                btn.classList.toggle('is-visto', !!UserStore.getItem(key));
            });
            updateProgressUi();
        });
    }

    // Listeners para botones de información de episodios/volúmenes
    grid?.addEventListener('click', (event) => {
        const infoBtn = event.target instanceof HTMLElement ? event.target.closest('button.btn-info-ep, button.btn-resumen') : null;
        if (!infoBtn) return;

        const rawNumber = infoBtn.getAttribute('data-vol') || infoBtn.getAttribute('data-ep') || '';
        const epNum = Number.parseInt(rawNumber, 10);
        if (!Number.isFinite(epNum) || epNum <= 0) return;

        showEpisodeInfoModal(item, epNum, isAnime, categoria);
    });
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
            let url = '';
            let site = '';

            if (streamEp) {
                title = streamEp.title || `Episodio ${epNum}`;
                thumbnail = streamEp.thumbnail || '';
                url = streamEp.url || '';
                site = streamEp.site || '';
                synopsis = `Este episodio está disponible para ver oficialmente en ${site}. Podés reproducirlo haciendo clic en el enlace de streaming abajo.`;
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
    renderDetalle(item, item.title || item.titulo || '', apiCat);
}

(function initDetallePage() {
    var params = getParams();
    if (!params.id || !params.cat) {
        setDetailViewState('error', 'Faltan par\u00E1metros', 'Us\u00E1 el cat\u00E1logo para elegir un t\u00EDtulo.');
        return;
    }

    var localItem = findLocalDetailItem();
    if (localItem) {
        renderDetalle(localItem, params.nombre || '', params.cat);
        return;
    }

    cargarDetalleDesdeApi(params.id, params.cat).then(function (found) {
        if (!found) {
            setDetailViewState('error', 'No encontrado', 'No se pudo encontrar el t\u00EDtulo en las APIs.');
        }
    });
})();

