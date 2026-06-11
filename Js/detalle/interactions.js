function wirePremiumDetailInteractions(root, item, categoria) {
    const itemId = String(item.mal_id || item.id || '');
    const total = getApiChapterTotal(item, categoria);
    const userId = getCurrentUserIdSafe();
    const isAnime = categoria === 'anime';
    const progressLabel = isAnime ? 'EP' : 'VOL';
    const progressHeading = isAnime ? 'EPISODIOS GENERAL' : 'VOLÚMENES GENERAL';

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

    function updateProgressUi() {
        const next = getApiUnifiedProgress(userId, itemId, total, categoria);
        if (fill) fill.style.width = `${next.pct}%`;
        if (counterText) counterText.textContent = `${next.watched}/${total || 0} completados`;
        if (labelProgress) labelProgress.textContent = `${progressLabel} ${next.watched}/${total || 0}`;
        if (labelPct) labelPct.textContent = `${next.pct}%`;
    }

    updateProgressUi();

    grid?.addEventListener('click', (event) => {
        const btn = event.target instanceof HTMLElement ? event.target.closest('button.cuadrado-item') : null;
        if (!btn) return;

        const ep = Number.parseInt(btn.getAttribute('data-ep') || '', 10);
        if (!Number.isFinite(ep) || ep <= 0) return;

        const key = isAnime
            ? episodeStorageKey(userId, itemId, 0, ep)
            : volumeStorageKey(userId, itemId, ep);
        const isActive = btn.classList.toggle('is-visto');

        grid.querySelectorAll('.cuadrado-item').forEach((el) => el.classList.remove('is-selected'));
        btn.classList.add('is-selected');

        if (isActive) UserStore.setItem(key, '1');
        else UserStore.removeItem(key);

        const supabaseKey = isAnime
            ? progressSqlKeyEpisode(0, ep)
            : progressSqlKeyVolume(ep);
        saveProgressToSupabase(categoria, itemId, supabaseKey, isActive);

        updateProgressUi();

        if (hasSqlSession() && typeof apiRequest === 'function') {
            const sqlKey = isAnime
                ? progressSqlKeyEpisode(0, ep)
                : progressSqlKeyVolume(ep);
            apiRequest('/api/progress/toggle', {
                method: 'POST',
                body: JSON.stringify({ category: categoria, itemId, key: sqlKey })
            }).catch(() => { });
        }
    });

    if (seeMore && synopsis) {
        seeMore.addEventListener('click', (event) => {
            event.preventDefault();
            const expanded = synopsis.classList.toggle('is-expanded');
            seeMore.textContent = expanded ? 'Ver menos' : 'Ver más';
        });
    }

    const actionKeys = {
        fav: detailStatusStorageKey(userId, itemId, 'fav'),
        viewed: detailStatusStorageKey(userId, itemId, 'viewed')
    };

    function syncActionButton(button, key) {
        if (!button) return;
        const active = !!UserStore.getItem(key);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    [favBtn, viewedBtn].forEach((button, index) => {
        const key = index === 0 ? actionKeys.fav : actionKeys.viewed;
        if (!button) return;
        syncActionButton(button, key);
        button.addEventListener('click', () => {
            const enabled = !UserStore.getItem(key);
            if (enabled) UserStore.setItem(key, '1');
            else UserStore.removeItem(key);
            syncActionButton(button, key);
            saveDetailStateToSupabase(
                categoria,
                { ...item, id: itemId },
                !!UserStore.getItem(actionKeys.fav),
                !!UserStore.getItem(actionKeys.viewed)
            );
        });
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
        syncProgressFromSql(categoria, itemId).then(() => {
            grid?.querySelectorAll('button.cuadrado-item').forEach((btn) => {
                const ep = Number.parseInt(btn.getAttribute('data-ep') || '', 10);
                if (!Number.isFinite(ep)) return;
                const key = isAnime
                    ? episodeStorageKey(userId, itemId, 0, ep)
                    : volumeStorageKey(userId, itemId, ep);
                btn.classList.toggle('is-visto', !!UserStore.getItem(key));
            });
            updateProgressUi();
        });
    }

    // Listeners para botones de información de episodios/volúmenes
    grid?.addEventListener('click', (event) => {
        const infoBtn = event.target instanceof HTMLElement ? event.target.closest('button.btn-info-ep, button.btn-resumen') : null;
        if (!infoBtn) return;

        const epNum = Number.parseInt(infoBtn.getAttribute('data-ep') || '', 10);
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

            // --- Petición silenciosa a Jikan para obtener si el episodio es Canon o Relleno ---
            let fillerLabel = 'No especificado (Canon probable)';
            try {
                const jRes = await fetch(`https://api.jikan.moe/v4/anime/${item.id}/episodes/${epNum}`);
                if (jRes.ok) {
                    const jPayload = await jRes.json();
                    if (jPayload && jPayload.data) {
                        const filler = jPayload.data.filler;
                        fillerLabel = filler ? 'Relleno (Filler)' : 'Canon (Manga Adaptado)';
                        
                        // Si Jikan tiene una mejor sinopsis o título oficial, los usamos
                        if (jPayload.data.title) {
                            title = jPayload.data.title;
                        }
                        if (jPayload.data.synopsis) {
                            synopsis = jPayload.data.synopsis;
                        }
                    }
                }
            } catch (err) {
                console.warn("Fallo al verificar canon/relleno en Jikan:", err);
            }

            const fillerColor = fillerLabel.includes('Relleno') ? '#ff4757' : '#22c55e';

            html = `
                <div class="modal-episode-info" style="display: flex; flex-direction: column; gap: 15px;">
                    ${thumbnail ? `
                        <div class="modal-episode-thumb" style="width: 100%; max-height: 220px; overflow: hidden; border-radius: 8px; border: 1px solid var(--accent-cyan); box-shadow: 0 4px 15px rgba(0, 242, 255, 0.25);">
                            <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" style="width: 100%; height: 100%; object-fit: cover;">
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
                        <a href="${escapeHtml(url)}" target="_blank" class="details-btn" style="text-align: center; margin-top: 10px; display: block; background: linear-gradient(90deg, #bc13fe, #00f2ff); border: none; color: white; padding: 12px; border-radius: 6px; font-weight: bold; text-decoration: none; box-shadow: 0 0 15px rgba(0, 242, 255, 0.35); text-transform: uppercase; letter-spacing: 1px; transition: all 0.2s ease-in-out;">
                            Reproducir en ${escapeHtml(site)} ↗
                        </a>
                    ` : ''}
                </div>
            `;
        } else {
            // Para mangas/novelas
            const title = `${item.titulo || item.title || 'Manga'} - Volumen ${epNum}`;
            const chapters = item.chapters || 'No especificado';
            const typeLabel = categoria === 'novelas' ? 'Canon (Novela Original)' : 'Canon (Manga Original)';
            const synopsis = `Contenido correspondiente al Volumen ${epNum} de ${item.titulo || item.title || 'este manga'}. Registrá tu lectura marcándolo en la cuadrícula principal.`;

            html = `
                <div class="modal-volume-info" style="display: flex; flex-direction: column; gap: 15px;">
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
async function cargarDetalleDesdeApi(id, categoria) {
    const isNumericId = /^\d+$/.test(String(id || ''));
    const apiCat = categoria === 'anime' ? 'anime' : 'manga';
    if (!isNumericId || (categoria !== 'manga' && categoria !== 'anime' && categoria !== 'novelas')) return false;
    const getById = apiCat === 'anime' ? window.getAnimeById : window.getMangaById;

    if (typeof getById !== 'function') return false;

    setDetailViewState('loading');

    try {
        const item = await getById(id);
        if (item) {
            renderApiDetalle(item, apiCat);
            return true;
        }
        return false;
    } catch (error) {
        console.warn('Detalle API falló:', error);
        return false;
    }
}
