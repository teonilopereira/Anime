function renderDetalle(item, nombreUrl, categoria) {
    const localLayout = document.getElementById('detail-local-layout');
    if (!localLayout) return;

    setDetailViewState('local');

    item = normalizeDetailItem(item);
    if (!item) {
        const title = nombreUrl ? `No encontrado: ${nombreUrl}` : 'No encontrado';
        document.title = title;
        const backHref = categoria === 'juegos' ? 'juegos.html' : (categoria === 'novelas' ? 'novelas.html' : (categoria === 'anime' ? 'anime.html' : 'manga.html'));
        localLayout.innerHTML = `
            <h1 class="detail-title">${escapeHtml(title)}</h1>
            <p class="detail-subtitle">Volvé al catálogo para elegir otro.</p>
            <a class="detail-back" href="${escapeHtml(backHref)}">Volver al catálogo</a>
        `;
        return;
    }

    item = mergeDetalles(item);
    try {
        document.body.setAttribute('data-detail-cat', String(categoria || 'manga'));
    } catch {
        // ignore
    }

    // Marcar el botón activo del navbar según la categoría del detalle
    try {
        const nav = document.querySelector('.navbar');
        if (nav) {
            nav.querySelectorAll('.nav-btn').forEach(a => a.classList.remove('active'));
            const map = { manga: 'manga.html', anime: 'anime.html', juegos: 'juegos.html', novelas: 'novelas.html' };
            const href = map[categoria] || 'manga.html';
            const active = nav.querySelector(`a.nav-btn[href="${href}"]`);
            if (active) active.classList.add('active');
        }
    } catch {
        // ignore
    }

    const generos = parseGeneros(item);
    const anio = item.anio ?? item.año ?? null;
    const resumen = item.resumen ?? null;
    const plataforma = item.plataforma ?? null;
    const desarrollador = item.desarrollador ?? item.developer ?? null;
    const editor = item.editor ?? item.publisher ?? null;

    const volumenes = item.volumes ?? item.volumenes ?? item.volumen ?? item.vols ?? null;
    const totalVols = parseVolumenes(volumenes);
    const userId = getCurrentUserIdSafe();

    const pageTitle = `Detalle - ${item.titulo}`;
    document.title = pageTitle;

    const isManga = categoria === 'manga' || !categoria;
    const isNovela = categoria === 'novelas';
    const isJuego = categoria === 'juegos';
    const isAnime = categoria === 'anime';
    const isMangaOrNovela = isManga || isNovela;
    const status = item.status || item.estado || 'No especificado';
    const score = item.score ?? item.puntaje ?? item.calificacion ?? 'N/A';
    const countLabel = isMangaOrNovela ? 'Volúmenes' : isAnime ? 'Capítulos' : isJuego ? 'Plataforma' : 'Capítulos';
    const countValue = isMangaOrNovela ? (volumenes || 'No especificado') : isAnime ? (item.capitulos || item.episodios || item.episodes || 'No especificado') : (plataforma || 'No especificado');
    const summaryText = resumen || item.sinopsis || item.descripcion || item.info || 'Sin sinopsis disponible.';

    const demografiaHtml = item.demografia
        ? `<span class="card-demographic demographic-${escapeHtml(item.demografia)}">${escapeHtml(item.demografia)}</span>`
        : '';

    const generosHtml = generos.length
        ? generos.map(g => `<span class="detail-chip">${escapeHtml(g)}</span>`).join('')
        : `<span class="detail-chip detail-chip-muted">No especificado</span>`;

    const detailStatsHtml = `
        <div class="detail-stat-grid">
            <div class="detail-stat">
                <div class="detail-stat-icon">📚</div>
                <div class="detail-stat-content"><span>${escapeHtml(countLabel)}</span><strong>${escapeHtml(String(countValue))}</strong></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-icon">📖</div>
                <div class="detail-stat-content"><span>Vol.</span><strong>${isMangaOrNovela ? escapeHtml(String(volumenes || '1')) : '—'}</strong></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-icon">✓</div>
                <div class="detail-stat-content"><span>Estado</span><strong>${escapeHtml(status)}</strong></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-icon">⭐</div>
                <div class="detail-stat-content"><span>Puntaje</span><strong>${escapeHtml(String(score))}</strong></div>
            </div>
        </div>
    `;

    let extraBlockHtml = '';
    let progressPanelHtml = '';

    if (isMangaOrNovela && totalVols > 0) {
        const markedVolumes = Array.from({ length: totalVols }, (_, i) => {
            const v = i + 1;
            return UserStore.getItem(volumeStorageKey(userId, item.id, v)) ? 1 : 0;
        }).reduce((acc, value) => acc + value, 0);
        const pct = totalVols > 0 ? Math.round((markedVolumes / totalVols) * 100) : 0;
        progressPanelHtml = `
            <div class="detail-progress-card">
                <div class="detail-progress-head">
                    <span>Progreso</span>
                    <strong>${pct}% visto</strong>
                </div>
                <div class="detail-progress-track">
                    <div class="detail-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="detail-progress-meta">${markedVolumes} de ${totalVols} volúmenes marcados</div>
            </div>
        `;
        const buttons = Array.from({ length: totalVols }, (_, i) => {
            const v = i + 1;
            const active = UserStore.getItem(volumeStorageKey(userId, item.id, v)) ? ' is-active' : '';
            return `<button class="vol-btn${active}" type="button" data-vol="${v}" aria-label="Volumen ${v}">${String(v).padStart(2, '0')}</button>`;
        }).join('');

        extraBlockHtml = `
            <div class="detail-section">
                <h2 class="detail-h2">Volúmenes</h2>
                <p class="detail-help">Tocá un volumen para marcarlo en verde (guardado por usuario).</p>
                <div class="vol-grid" data-manga-id="${escapeHtml(item.id)}">${buttons}</div>
            </div>
        `;
    }

    if (isJuego) {
        const franquicia = Array.isArray(item.franquicia) ? item.franquicia : [];
        const juegosList = (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB.juegos)) ? DATOS_WEB.juegos : [];

        const franquiciaHtml = franquicia.length
            ? franquicia.map(entry => {
                const raw = String(entry);
                const byId = juegosList.find(j => String(j.id) === raw);
                const byTitle = juegosList.find(j => String(j.titulo || '').toLowerCase() === raw.toLowerCase());
                const target = byId || byTitle;
                if (!target) return `<span class="franchise-chip is-disabled" aria-disabled="true">${escapeHtml(raw)}</span>`;
                return `<a class="franchise-link" href="detalle.html?cat=juegos&id=${encodeURIComponent(target.id)}&nombre=${encodeURIComponent(target.titulo)}">${escapeHtml(raw)}</a>`;
            }).join('')
            : `<span class="detail-chip detail-chip-muted">No especificado</span>`;

        extraBlockHtml = `
            <div class="detail-section">
                <h2 class="detail-h2">Franquicia</h2>
                <p class="detail-help">Otros juegos de la franquicia.</p>
                <div class="franchise-grid">${franquiciaHtml}</div>
            </div>
        `;
    }

    if (isAnime) {
        const animeStructure = getAnimeStructure(item);
        const temporadas = animeStructure.temporadas;
        const temporadasCount = temporadas.length;
        const totalEps = Number(animeStructure.capitulos) || 0;
        let watchedEpisodes = 0;
        for (let i = 0; i < UserStore.length; i++) {
            const key = UserStore.key(i) || '';
            if (key.startsWith(`u:${userId}|anime:${item.id}|s:`) && UserStore.getItem(key)) {
                watchedEpisodes += 1;
            }
        }
        const pct = totalEps > 0 ? Math.round((watchedEpisodes / totalEps) * 100) : 0;
        progressPanelHtml = `
            <div class="detail-progress-card">
                <div class="detail-progress-head">
                    <span>Progreso</span>
                    <strong>${pct}% visto</strong>
                </div>
                <div class="detail-progress-track">
                    <div class="detail-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="detail-progress-meta">${watchedEpisodes} de ${totalEps || 0} capítulos marcados</div>
            </div>
        `;
        const counts = {
            temporadas: animeStructure.temporadasCount,
            ovas: animeStructure.ovas,
            peliculas: animeStructure.peliculas,
            capitulos: animeStructure.capitulos
        };

        const tabs = temporadasCount > 1
            ? temporadas.map((t, idx) => {
                const active = idx === 0 ? ' is-active' : '';
                const name = t.nombre || `Temporada ${idx + 1}`;
                return `<button class="season-tab${active}" type="button" data-season="${idx}">${escapeHtml(name)}</button>`;
            }).join('')
            : '';

        extraBlockHtml = `
            <div class="detail-section">
                <h2 class="detail-h2">Capítulos</h2>
                ${progressPanelHtml}
                ${tabs ? `<div class="season-tabs" role="tablist" aria-label="Temporadas">${tabs}</div>` : ""}
                <p class="detail-help">Tocá un capítulo para marcarlo en verde (guardado por usuario).</p>
                <div class="ep-grid" id="epGrid"></div>
            </div>
        `;
    }
    let backHref = isJuego ? 'juegos.html' : (isAnime ? 'anime.html' : (isNovela ? 'novelas.html' : 'manga.html'));
    try {
        const last = sessionStorage.getItem('lastCatalogUrl');
        if (last) backHref = last;
    } catch {
        // ignore
    }

    localLayout.innerHTML = `
        <div class="detail-grid">
            <div class="detail-cover">
                <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.titulo)}">
            </div>
            <div class="detail-info">
                ${demografiaHtml}
                <h1 class="detail-title">${escapeHtml(item.titulo)}</h1>
                <div class="detail-status"><span>✓</span> ${escapeHtml(status)}</div>
                ${detailStatsHtml}

                <div class="detail-section detail-section-synopsis">
                    <h2 class="detail-section-title">SINOPSIS</h2>
                    <p class="detail-synopsis-text">${escapeHtml(String(summaryText))}</p>
                    <a href="#" class="detail-see-more">Ver más</a>
                </div>

                <div class="detail-section">
                    <h2 class="detail-section-title">GÉNEROS</h2>
                    <div class="detail-chips">${generosHtml}</div>
                </div>
                ${isMangaOrNovela ? progressPanelHtml : ''}
                ${extraBlockHtml}

                <div class="detail-actions detail-actions-top">
                    <button class="action-btn share-btn" type="button" aria-label="Compartir con conocidos o amigos" title="Compartir">🔗</button>
                    <button class="action-btn fav-btn" type="button" aria-label="Agregar a favoritos">❤</button>
                    <button class="action-btn viewed-btn" type="button" aria-label="Marcar como visto">👁</button>
                </div>

                <div class="detail-actions">
                    <a class="detail-back" href="${escapeHtml(backHref)}" onclick="try { sessionStorage.setItem('shouldRestoreCatalog','1'); } catch {}">Volver al catálogo</a>
                </div>
            </div>
        </div>
    `;

    const actionKeys = {
        fav: detailStatusStorageKey(userId, item.id, 'fav'),
        viewed: detailStatusStorageKey(userId, item.id, 'viewed')
    };
    const favBtn = localLayout.querySelector('.fav-btn');
    const viewedBtn = localLayout.querySelector('.viewed-btn');
    const shareBtn = localLayout.querySelector('.share-btn');

    function syncActionButton(button, key) {
        if (!button) return;
        const active = !!UserStore.getItem(key);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    [
        { button: favBtn, key: actionKeys.fav },
        { button: viewedBtn, key: actionKeys.viewed }
    ].forEach(({ button, key }) => {
        if (!button) return;
        syncActionButton(button, key);
        button.addEventListener('click', () => {
            const enabled = !UserStore.getItem(key);
            if (enabled) UserStore.setItem(key, '1');
            else UserStore.removeItem(key);
            syncActionButton(button, key);
            saveDetailStateToSupabase(
                categoria,
                item,
                !!UserStore.getItem(actionKeys.fav),
                !!UserStore.getItem(actionKeys.viewed)
            );
        });
    });

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareData = {
                title: pageTitle,
                text: `¡Mirá este ${categoria} que encontré! Se llama "${item.titulo}".`,
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

    function renderProgressPanel() {
        const panel = localLayout.querySelector('.detail-progress-card');
        if (!panel) return;

        if (isMangaOrNovela && totalVols > 0) {
            const markedVolumes = Array.from({ length: totalVols }, (_, i) => {
                const v = i + 1;
                return UserStore.getItem(volumeStorageKey(userId, item.id, v)) ? 1 : 0;
            }).reduce((acc, value) => acc + value, 0);
            const pct = totalVols > 0 ? Math.round((markedVolumes / totalVols) * 100) : 0;
            const head = panel.querySelector('.detail-progress-head strong');
            const fill = panel.querySelector('.detail-progress-fill');
            const meta = panel.querySelector('.detail-progress-meta');
            if (head) head.textContent = `${pct}% visto`;
            if (fill) fill.style.width = `${pct}%`;
            if (meta) meta.textContent = `${markedVolumes} de ${totalVols} volúmenes marcados`;
            return;
        }

        if (isAnime) {
            const temporadas = parseTemporadas(item);
            const totalEps = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
            let watchedEpisodes = 0;
            for (let i = 0; i < UserStore.length; i++) {
                const key = UserStore.key(i) || '';
                if (key.startsWith(`u:${userId}|anime:${item.id}|s:`) && UserStore.getItem(key)) {
                    watchedEpisodes += 1;
                }
            }
            const pct = totalEps > 0 ? Math.round((watchedEpisodes / totalEps) * 100) : 0;
            const head = panel.querySelector('.detail-progress-head strong');
            const fill = panel.querySelector('.detail-progress-fill');
            const meta = panel.querySelector('.detail-progress-meta');
            if (head) head.textContent = `${pct}% visto`;
            if (fill) fill.style.width = `${pct}%`;
            if (meta) meta.textContent = `${watchedEpisodes} de ${totalEps || 0} capítulos marcados`;
        }
    }

    renderProgressPanel();

    if (isMangaOrNovela && totalVols > 0) {
        const grid = localLayout.querySelector('.vol-grid');
        if (grid) {
            // Traer progreso desde SQL y reflejarlo en la UI (si hay sesión).
            syncProgressFromSql(categoria, item.id).then(() => {
                grid.querySelectorAll('button.vol-btn').forEach((btn) => {
                    const vol = Number.parseInt(btn.getAttribute('data-vol') || '', 10);
                    if (!Number.isFinite(vol) || vol <= 0) return;
                    const key = volumeStorageKey(getCurrentUserIdSafe(), item.id, vol);
                    btn.classList.toggle('is-active', !!UserStore.getItem(key));
                });
                renderProgressPanel();
            });

            grid.addEventListener('click', (e) => {
                const btn = e.target instanceof HTMLElement ? e.target.closest('button.vol-btn') : null;
                if (!btn) return;
                const vol = Number.parseInt(btn.getAttribute('data-vol') || '', 10);
                if (!Number.isFinite(vol) || vol <= 0) return;

                const key = volumeStorageKey(getCurrentUserIdSafe(), item.id, vol);
                const isActive = btn.classList.toggle('is-active');
                if (isActive) UserStore.setItem(key, '1');
                else UserStore.removeItem(key);
                saveProgressToSupabase(categoria, item.id, progressSqlKeyVolume(vol), isActive);
                renderProgressPanel();

                if (hasSqlSession() && typeof apiRequest === 'function') {
                    apiRequest('/api/progress/toggle', {
                        method: 'POST',
                        body: JSON.stringify({ category: categoria, itemId: item.id, key: progressSqlKeyVolume(vol) })
                    }).catch(() => { });
                }
            });
        }
    }

    if (isAnime) {
        const temporadas = parseTemporadas(item);
        const epGrid = localLayout.querySelector('#epGrid');
        const tabsEl = localLayout.querySelector('.season-tabs');
        const seasons = temporadas.length ? temporadas : [{ nombre: 'Temporada 1', episodios: 0 }];

        function renderEpisodes(seasonIndex) {
            if (!epGrid) return;
            const season = seasons[seasonIndex] || seasons[0];
            const eps = Number(season.episodios) || 0;

            if (!eps) {
                epGrid.innerHTML = `<span class="detail-chip detail-chip-muted">Episodios no especificados</span>`;
                return;
            }

            const buttons = Array.from({ length: eps }, (_, i) => {
                const ep = i + 1;
                const key = episodeStorageKey(getCurrentUserIdSafe(), item.id, seasonIndex, ep);
                const active = UserStore.getItem(key) ? ' is-active' : '';
                return `
<div class="cap-box ${active ? 'is-active' : ''}" data-ep="${ep}">
    <button 
        class="ep-btn ${active ? 'is-active' : ''}" 
        type="button"
        data-season="${seasonIndex}"
        data-ep="${ep}"
        aria-label="Episodio ${ep}">
        ${String(ep).padStart(2, '0')}
    </button>
    <button 
        class="btn-resumen ${active ? 'show' : ''}" 
        data-season="${seasonIndex}"
        data-ep="${ep}">
        Resumen
    </button>
</div>
`;
            }).join('');

            epGrid.innerHTML = buttons;
        }

        function setActiveTab(seasonIndex) {
            if (!tabsEl) return;
            const allTabs = tabsEl.querySelectorAll('.season-tab');
            allTabs.forEach(t => t.classList.toggle('is-active', t.getAttribute('data-season') === String(seasonIndex)));
        }

        // Traer progreso desde SQL y luego renderizar para que marque los episodios.
        syncProgressFromSql('anime', item.id).then(() => {
            renderEpisodes(0);
            renderProgressPanel();
        });

        if (tabsEl) {
            tabsEl.addEventListener('click', (e) => {
                const btn = e.target instanceof HTMLElement ? e.target.closest('button.season-tab') : null;
                if (!btn) return;
                const idx = Number.parseInt(btn.getAttribute('data-season') || '0', 10);
                if (!Number.isFinite(idx)) return;
                setActiveTab(idx);
                renderEpisodes(idx);
            });
        }

        if (epGrid) {
            epGrid.addEventListener('click', (e) => {
                const btn = e.target instanceof HTMLElement ? e.target.closest('button.ep-btn') : null;
                if (!btn) return;
                const seasonIndex = Number.parseInt(btn.getAttribute('data-season') || '0', 10);
                const ep = Number.parseInt(btn.getAttribute('data-ep') || '0', 10);
                if (!Number.isFinite(seasonIndex) || !Number.isFinite(ep) || ep <= 0) return;

                const key = episodeStorageKey(getCurrentUserIdSafe(), item.id, seasonIndex, ep);
                const isActive = btn.classList.toggle('is-active');
                if (isActive) UserStore.setItem(key, '1');
                else UserStore.removeItem(key);
                saveProgressToSupabase('anime', item.id, progressSqlKeyEpisode(seasonIndex, ep), isActive);
                renderProgressPanel();

                if (hasSqlSession() && typeof apiRequest === 'function') {
                    apiRequest('/api/progress/toggle', {
                        method: 'POST',
                        body: JSON.stringify({ category: 'anime', itemId: item.id, key: progressSqlKeyEpisode(seasonIndex, ep) })
                    }).catch(() => { });
                }
            });
        }
    }
}