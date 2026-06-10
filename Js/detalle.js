function getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        nombre: params.get('nombre'),
        cat: params.get('cat') || params.get('categoria')
    };
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function normalizeDetailItem(item) {
    if (!item || typeof item !== 'object') return null;
    const normalized = { ...item };
    normalized.id = normalized.id ?? normalized.mal_id ?? normalized.item_id ?? normalized.itemId ?? null;
    normalized.titulo = normalized.titulo || normalized.title || normalized.name || normalized.nombre || '';
    normalized.img = normalized.img || normalized.image || normalized.cover_image || normalized.portada || normalized.banner || '';
    normalized.info = normalized.info || normalized.synopsis || normalized.descripcion || normalized.resumen || normalized.summary || '';
    normalized.status = normalized.status || normalized.estado || '';
    normalized.demografia = normalized.demografia || normalized.demography || normalized.demographic || '';
    normalized.volumenes = normalized.volumenes ?? normalized.volumes ?? normalized.chapters ?? normalized.capitulos ?? null;
    normalized.anio = normalized.anio ?? normalized.year ?? normalized.año ?? null;
    return normalized;
}

function findLocalDetailItem(categoria, id, nombre) {
    const lista = (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB[categoria]))
        ? DATOS_WEB[categoria]
        : [];
    if (!lista.length) return null;

    const normalizedId = String(id ?? '').trim();
    const normalizedNombre = String(nombre ?? '').trim().toLowerCase();

    let item = lista.find((entry) => {
        const entryId = String(entry.id ?? entry.mal_id ?? entry.item_id ?? entry.itemId ?? '').trim();
        return normalizedId && entryId === normalizedId;
    });
    if (item) return normalizeDetailItem(item);

    if (normalizedNombre) {
        item = lista.find((entry) => {
            const entryTitle = String(entry.titulo || entry.title || entry.name || entry.nombre || '').trim().toLowerCase();
            return entryTitle && entryTitle === normalizedNombre;
        });
        if (item) return normalizeDetailItem(item);
    }

    return null;
}

function waitForDatosWebLoaded(timeout = 5000) {
    if (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Object.keys(DATOS_WEB).length > 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const onLoaded = () => {
            document.removeEventListener('datosCargados', onLoaded);
            resolve();
        };
        document.addEventListener('datosCargados', onLoaded);
        setTimeout(() => {
            document.removeEventListener('datosCargados', onLoaded);
            resolve();
        }, timeout);
    });
}

function replaceChildrenWithTextElement(parent, tagName, text, className = '') {
    if (!parent) return null;
    parent.replaceChildren();
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = String(text ?? '');
    parent.appendChild(element);
    return element;
}

function applyBackgroundPreference() {
    if (!document.body) return;
    const body = document.body;
    const mode = localStorage.getItem('pref:bgMode') || 'default';
    body.style.removeProperty('background');
    body.style.removeProperty('background-image');
    body.style.removeProperty('background-color');
    body.style.removeProperty('background-repeat');
    body.style.removeProperty('background-size');
    body.style.removeProperty('background-position');
    body.style.removeProperty('background-attachment');

    if (mode === 'color') {
        const color = localStorage.getItem('pref:bgColor') || '#2b0a55';
        body.style.background = `linear-gradient(180deg, #000000 0%, ${color} 100%)`;
        body.style.backgroundAttachment = 'fixed';
    } else if (mode === 'image') {
        const imageUrl = localStorage.getItem('pref:bgImage') || '';
        if (imageUrl) {
            body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.76)), url("${String(imageUrl).replaceAll('"', '\\"')}")`;
            body.style.backgroundSize = 'cover';
            body.style.backgroundPosition = 'center center';
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundAttachment = 'fixed';
        }
    }
}

function parseGeneros(item) {
    if (Array.isArray(item.generos) && item.generos.length) return item.generos;
    return (typeof separarGeneros === 'function')
        ? separarGeneros(item?.info)
        : String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean);
}

function mergeDetalles(item) {
    if (!item) return item;
    const extras = (typeof obtenerDetallePorId === 'function') ? obtenerDetallePorId(item.id) : null;
    if (!extras) return item;
    return { ...item, ...extras };
}

function getCurrentUserIdSafe() {
    if (typeof getCurrentUserId === 'function') return getCurrentUserId();
    return localStorage.getItem('currentUser') || 'Invitado';
}

function volumeStorageKey(userId, mangaId, volumeNumber) {
    return `u:${userId}|manga:${mangaId}|vol:${volumeNumber}`;
}

function episodeStorageKey(userId, animeId, seasonIndex, episodeNumber) {
    return `u:${userId}|anime:${animeId}|s:${seasonIndex}|ep:${episodeNumber}`;
}

function progressSqlKeyVolume(volumeNumber) {
    return `vol:${volumeNumber}`;
}

function progressSqlKeyEpisode(seasonIndex, episodeNumber) {
    return `s:${seasonIndex}|ep:${episodeNumber}`;
}

function hasSqlSession() {
    try {
        const hasLocalSqlToken = typeof getAuthToken === 'function' && !!getAuthToken();
        const hasSupabaseSession = !!window.AppSupabase?.isSignedIn?.();
        return (hasLocalSqlToken || hasSupabaseSession) && getCurrentUserIdSafe() !== 'Invitado';
    } catch {
        return false;
    }
}

function detailStatusStorageKey(userId, itemId, type) {
    if (typeof statusStorageKey === 'function') return statusStorageKey(userId, itemId, type);
    return `u:${userId}|item:${itemId}|${type}`;
}

async function syncProgressFromSupabase(category, itemId) {
    const client = window.AppSupabase;
    if (!client?.loadProgress) return;

    try {
        const keys = await client.loadProgress(category, itemId);
        const userId = getCurrentUserIdSafe();

        keys.forEach((row) => {
            if (!row || Number(row.value) !== 1) return;
            const pkey = String(row.pkey || '');

            if (category === 'manga' || category === 'novelas') {
                const m = pkey.match(/^vol:(\d+)$/);
                if (!m) return;
                const vol = Number(m[1]);
                if (Number.isFinite(vol) && vol > 0) UserStore.setItem(volumeStorageKey(userId, itemId, vol), '1');
                return;
            }

            if (category === 'anime') {
                const m = pkey.match(/^s:(\d+)\|ep:(\d+)$/);
                if (!m) return;
                const sIdx = Number(m[1]);
                const ep = Number(m[2]);
                if (Number.isFinite(sIdx) && Number.isFinite(ep) && ep > 0) {
                    UserStore.setItem(episodeStorageKey(userId, itemId, sIdx, ep), '1');
                }
            }
        });
    } catch (error) {
        console.warn('No se pudo traer progreso desde Supabase:', error);
    }
}

function saveProgressToSupabase(category, itemId, key, value) {
    const client = window.AppSupabase;
    if (!client?.setProgress) return;
    client.setProgress({ category, itemId, key, value }).catch((error) => {
        console.warn('No se pudo guardar progreso en Supabase:', error);
    });
}

function saveDetailStateToSupabase(category, item, fav, viewed) {
    const client = window.AppSupabase;
    if (!client?.saveItemState) return;

    const itemId = String(item?.id || item?.mal_id || '');
    const meta = {
        id: itemId,
        titulo: String(item?.titulo || item?.title || ''),
        img: String(item?.img || item?.images?.webp?.large_image_url || item?.images?.jpg?.large_image_url || ''),
        info: String(item?.info || item?.synopsis || ''),
        __category: category
    };

    const userId = getCurrentUserIdSafe();
    if (userId !== 'Invitado') {
        const metaKey = `u:${userId}|itemMeta:${itemId}`;
        if (fav || viewed) {
            UserStore.setItem(metaKey, JSON.stringify(meta));
        } else {
            UserStore.removeItem(metaKey);
        }
    }

    client.saveItemState({
        category,
        itemId,
        fav,
        viewed,
        meta
    }).catch((error) => {
        console.warn('No se pudo guardar estado en Supabase:', error);
    });
}

async function syncProgressFromSql(category, itemId) {
    await syncProgressFromSupabase(category, itemId);
    if (!hasSqlSession() || typeof apiRequest !== 'function') return;
    try {
        const data = await apiRequest(`/api/progress/list?category=${encodeURIComponent(category)}&itemId=${encodeURIComponent(itemId)}`, { method: 'GET' });
        const keys = Array.isArray(data?.keys) ? data.keys : [];
        const userId = getCurrentUserIdSafe();

        if (category === 'manga' || category === 'novelas') {
            keys.forEach((row) => {
                if (!row || Number(row.value) !== 1) return;
                const m = String(row.pkey || '').match(/^vol:(\d+)$/);
                if (!m) return;
                const vol = Number(m[1]);
                if (!Number.isFinite(vol) || vol <= 0) return;
                UserStore.setItem(volumeStorageKey(userId, itemId, vol), '1');
            });
            return;
        }

        if (category === 'anime') {
            keys.forEach((row) => {
                if (!row || Number(row.value) !== 1) return;
                const m = String(row.pkey || '').match(/^s:(\d+)\|ep:(\d+)$/);
                if (!m) return;
                const sIdx = Number(m[1]);
                const ep = Number(m[2]);
                if (!Number.isFinite(sIdx) || !Number.isFinite(ep) || ep <= 0) return;
                UserStore.setItem(episodeStorageKey(userId, itemId, sIdx, ep), '1');
            });
        }
    } catch {
        // ignore
    }
}

function parseVolumenes(volumenes) {
    const n = Number.parseInt(String(volumenes ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseTemporadas(item) {
    if (Array.isArray(item.temporadas) && item.temporadas.length) return item.temporadas;
    return [];
}

function getAnimeStructure(item) {
    const temporadas = parseTemporadas(item);
    const totalEps = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0);
    const explicitOvas = Number(item?.ovas);
    const explicitPeliculas = Number(item?.peliculas);
    const derived = temporadas.reduce((acc, t) => {
        const name = String(t.nombre || '').toLowerCase();
        const amount = Number(t.episodios) || 1;
        if (name.includes('ova')) acc.ovas += amount;
        else if (name.includes('pelicula') || name.includes('película') || name.includes('movie')) acc.peliculas += amount;
        else acc.temporadas += 1;
        return acc;
    }, { temporadas: 0, ovas: 0, peliculas: 0 });

    if (temporadas.length === 0) derived.temporadas = 1;

    return {
        temporadas,
        capitulos: totalEps || 0,
        temporadasCount: derived.temporadas,
        ovas: Number.isFinite(explicitOvas) ? explicitOvas : derived.ovas,
        peliculas: Number.isFinite(explicitPeliculas) ? explicitPeliculas : derived.peliculas
    };
}

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

function getApiDetailImage(item) {
    return item?.images?.webp?.large_image_url
        || item?.images?.jpg?.large_image_url
        || item?.images?.jpg?.image_url
        || item?.images?.webp?.image_url
        || '';
}

function getApiGenres(item) {
    return [
        ...(Array.isArray(item?.genres) ? item.genres : []),
        ...(Array.isArray(item?.themes) ? item.themes : [])
    ].map((entry) => entry?.name).filter(Boolean);
}

function getApiAnimeEpisodeTotal(item) {
    const total = Number.parseInt(String(item?.episodes ?? ''), 10);
    return Number.isFinite(total) && total > 0 ? total : 0;
}

function getApiAnimeProgress(userId, animeId, totalEpisodes) {
    if (!totalEpisodes) return { watched: 0, pct: 0 };

    let watched = 0;
    for (let ep = 1; ep <= totalEpisodes; ep++) {
        if (UserStore.getItem(episodeStorageKey(userId, animeId, 0, ep))) {
            watched += 1;
        }
    }

    return {
        watched,
        pct: Math.round((watched / totalEpisodes) * 100)
    };
}

function translateApiStatus(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('finish')) return 'Finalizado';
    if (value.includes('publish') || value.includes('airing') || value.includes('current')) return 'En emisión';
    return status || 'No especificado';
}

function translateApiType(type, categoria) {
    const raw = String(type || '').toLowerCase();
    const map = {
        'light novel': 'Novela ligera',
        manga: 'Manga',
        novel: 'Novela',
        tv: 'Anime',
        movie: 'Película',
        ova: 'OVA',
        ona: 'ONA',
        special: 'Especial'
    };
    if (map[raw]) return map[raw];
    return type || (categoria === 'anime' ? 'Anime' : 'Manga');
}

function getApiChapterTotal(item, categoria) {
    if (categoria === 'anime') return getApiAnimeEpisodeTotal(item);
    const volumes = Number.parseInt(String(item?.volumes ?? item?.chapters ?? ''), 10);
    return Number.isFinite(volumes) && volumes > 0 ? volumes : 0;
}

function buildGenreBadgesHtml(genres) {
    if (!genres.length) {
        return '<span class="tag-badge tag-badge-muted">Sin géneros</span>';
    }
    return genres.map((genre, index) => {
        const variant = index % 2 === 0 ? 'tag-badge-purple' : 'tag-badge-cyan';
        return `<span class="tag-badge ${variant}">${escapeHtml(genre)}</span>`;
    }).join('');
}

function buildChapterGridHtml(total, userId, itemId, categoria) {
    if (!total) {
        const label = categoria === 'anime' ? 'capítulos' : 'volúmenes';
        return `<p class="capitulos-empty">Sin ${label} especificados en la API.</p>`;
    }

    return Array.from({ length: total }, (_, i) => {
        const num = i + 1;
        const key = categoria === 'anime'
            ? episodeStorageKey(userId, itemId, 0, num)
            : volumeStorageKey(userId, itemId, num);
        const active = UserStore.getItem(key) ? ' is-visto' : '';
        const label = categoria === 'anime' ? 'Episodio' : 'Volumen';
        return `
            <div class="cuadrado-wrapper">
                <button class="cuadrado-item${active}" type="button" data-ep="${num}" aria-label="${label} ${num}">
                    <span class="num-cap">${String(num).padStart(2, '0')}</span>
                    <span class="check-icono" aria-hidden="true">✓</span>
                </button>
                <button class="btn-resumen" type="button" data-ep="${num}" aria-label="Ver resumen del ${label.toLowerCase()} ${num}">RESUMEN</button>
            </div>
        `;
    }).join('');
}

function getApiUnifiedProgress(userId, itemId, total, categoria) {
    if (!total) return { watched: 0, pct: 0 };

    let watched = 0;
    for (let n = 1; n <= total; n++) {
        const key = categoria === 'anime'
            ? episodeStorageKey(userId, itemId, 0, n)
            : volumeStorageKey(userId, itemId, n);
        if (UserStore.getItem(key)) watched += 1;
    }

    return {
        watched,
        pct: Math.round((watched / total) * 100)
    };
}

function syncDetailProfileHeader() {
    const userId = getCurrentUserIdSafe();
    const initials = String(userId || 'IN').trim().slice(0, 2).toUpperCase();
    const avatar = document.getElementById('detailAvatar');
    const name = document.getElementById('detailUserName');
    if (avatar) avatar.textContent = initials;
    if (name) name.textContent = userId;
}

function setDetailViewState(state) {
    const loading = document.getElementById('detail-loading');
    const error = document.getElementById('detail-error');
    const apiLayout = document.getElementById('detail-api-layout');
    const localLayout = document.getElementById('detail-local-layout');

    if (loading) loading.hidden = state !== 'loading';
    if (error) error.hidden = state !== 'error';
    if (apiLayout) apiLayout.hidden = state !== 'api';
    if (localLayout) localLayout.hidden = state !== 'local';
}

function showDetailError(message, backHref, kicker) {
    setDetailViewState('error');
    const title = document.getElementById('detail-error-title');
    const msg = document.getElementById('detail-error-msg');
    const back = document.getElementById('detail-error-back');
    const kickerEl = document.getElementById('detail-error-kicker');
    if (title) title.textContent = message || 'No se encontró este título.';
    if (msg) msg.textContent = '';
    if (back && backHref) back.href = backHref;
    if (kickerEl && kicker) kickerEl.textContent = kicker;
}

function activateDetailNavbar(categoria) {
    try {
        const map = { manga: 'manga.html', anime: 'anime.html', juegos: 'juegos.html', novelas: 'novelas.html' };
        const href = map[categoria] || 'manga.html';
        document.querySelectorAll('.navbar .nav-btn').forEach((a) => a.classList.remove('active'));
        const active = document.querySelector(`.navbar .nav-btn[href="${href}"]`);
        if (active) active.classList.add('active');
    } catch {
        // ignore
    }
}

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

function renderApiDetalle(item, categoria) {
    const root = document.getElementById('detail-api-layout');
    if (!root) return;

    syncDetailProfileHeader();

    const backHref = categoria === 'anime' ? 'anime.html' : (categoria === 'novelas' ? 'novelas.html' : 'manga.html');

    if (!item) {
        document.title = 'Detalle no encontrado';
        showDetailError('No se encontró este título en la API.', backHref, 'No encontrado');
        return;
    }

    const title = item.title || item.title_english || 'Sin título';
    const image = getApiDetailImage(item);
    const synopsis = item.synopsis || 'Sin sinopsis disponible.';
    const genres = getApiGenres(item);
    const isAnime = categoria === 'anime';
    const itemId = String(item.mal_id || item.id || '');
    const userId = getCurrentUserIdSafe();
    const totalCapitulos = getApiChapterTotal(item, categoria);
    const progress = getApiUnifiedProgress(userId, itemId, totalCapitulos, categoria);
    const statusLabel = translateApiStatus(item.status);
    const typeLabel = translateApiType(item.type, categoria);
    const countLabel = isAnime ? 'Episodios' : 'Volúmenes';
    const countValue = isAnime ? (item.episodes ?? 'N/A') : (item.volumes ?? 'N/A');
    const progressPrefix = isAnime ? 'EP' : 'VOL';
    const progressHeading = isAnime ? 'EPISODIOS GENERAL' : 'VOLÚMENES GENERAL';
    const capitulosSectionTitle = isAnime ? 'EPISODIOS' : 'VOLÚMENES';

    document.title = `Detalle - ${title}`;
    document.body.setAttribute('data-detail-cat', categoria);
    activateDetailNavbar(categoria);
    setDetailViewState('api');

    const hero = document.getElementById('hero-section');
    const portada = document.getElementById('detail-portada');
    const tipoEl = document.getElementById('detail-tipo');
    const tituloEl = document.getElementById('detail-titulo');
    const estadoBadge = document.getElementById('detail-estado-badge');
    const stat1Label = document.getElementById('detail-stat-1-label');
    const stat1Valor = document.getElementById('detail-stat-1-valor');
    const volumenesEl = document.getElementById('detail-volumenes');
    const estadoEl = document.getElementById('detail-estado');
    const puntajeEl = document.getElementById('detail-puntaje');
    const sinopsisEl = document.getElementById('detail-sinopsis');
    const generosEl = document.getElementById('detail-generos');
    const capitulosTitulo = document.getElementById('detail-capitulos-titulo');
    const capitulosGrid = document.getElementById('detail-capitulos-grid');
    const capitulosEmpty = document.getElementById('detail-capitulos-empty');
    const contadorTexto = document.getElementById('contador-vistos-texto');
    const progresoTitulo = document.getElementById('progreso-general-titulo');
    const barraFill = document.getElementById('barra-progreso-fill-total');
    const labelProgreso = document.getElementById('label-capitulos-progreso');
    const labelPct = document.getElementById('label-porcentaje-progreso');
    const backLink = document.getElementById('detail-back-link');

    if (hero && image) hero.style.backgroundImage = `url("${String(image).replaceAll('"', '\\"')}")`;
    if (portada) {
        portada.src = image;
        portada.alt = title;
    }
    if (tipoEl) tipoEl.textContent = `📖 ${typeLabel}`;
    if (tituloEl) tituloEl.textContent = title;
    if (estadoBadge) estadoBadge.textContent = `✓ ${statusLabel}`;
    if (stat1Label) stat1Label.textContent = countLabel;
    if (stat1Valor) stat1Valor.textContent = String(countValue);
    if (volumenesEl) volumenesEl.textContent = String(item.volumes ?? 'N/A');
    if (estadoEl) estadoEl.textContent = statusLabel;
    if (puntajeEl) puntajeEl.textContent = String(item.score ?? 'N/A');
    if (sinopsisEl) {
        sinopsisEl.textContent = synopsis;
        sinopsisEl.classList.remove('is-expanded');
    }
    if (generosEl) generosEl.innerHTML = buildGenreBadgesHtml(genres);
    if (capitulosTitulo) capitulosTitulo.textContent = capitulosSectionTitle;
    if (progresoTitulo) progresoTitulo.textContent = progressHeading;
    if (contadorTexto) contadorTexto.textContent = `${progress.watched}/${totalCapitulos || 0} completados`;
    if (barraFill) barraFill.style.width = `${progress.pct}%`;
    if (labelProgreso) labelProgreso.textContent = `${progressPrefix} ${progress.watched}/${totalCapitulos || 0}`;
    if (labelPct) labelPct.textContent = `${progress.pct}%`;
    if (backLink) backLink.href = backHref;

    if (capitulosGrid) {
        if (totalCapitulos > 0) {
            capitulosGrid.hidden = false;
            capitulosGrid.innerHTML = buildChapterGridHtml(totalCapitulos, userId, itemId, categoria);
            if (capitulosEmpty) capitulosEmpty.hidden = true;
        } else {
            capitulosGrid.innerHTML = '';
            capitulosGrid.hidden = true;
            if (capitulosEmpty) capitulosEmpty.hidden = false;
        }
    }

    wirePremiumDetailInteractions(root, item, categoria);
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

document.addEventListener('DOMContentLoaded', async () => {
    applyBackgroundPreference();
    syncDetailProfileHeader();
    const { id, nombre, cat } = getParams();
    const categoria = cat || 'manga';

    if (await cargarDetalleDesdeApi(id, categoria)) return;
    await waitForDatosWebLoaded();
    const item = (typeof obtenerItemCategoria === 'function')
        ? obtenerItemCategoria(categoria, id)
        : ((typeof DATOS_WEB !== 'undefined' && DATOS_WEB && DATOS_WEB[categoria]) || []).find(m => String(m.id) === String(id));
    const localItem = item || findLocalDetailItem(categoria, id, nombre);
    renderDetalle(localItem, nombre, categoria);

    // Agregar funcionalidad para cerrar modal al hacer click fuera
    const modal = document.getElementById('resumenModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Cerrar con tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });
    }
   function mostrarPopupResumen(titulo, texto) {

    let popup = document.querySelector(".popup-resumen");

    if (!popup) {

        popup = document.createElement("div");
        popup.className = "popup-resumen";

        document.body.appendChild(popup);
    }

    popup.replaceChildren();

    const content = document.createElement("div");
    content.className = "popup-content";

    const heading = document.createElement("h2");
    heading.textContent = String(titulo ?? "");

    const paragraph = document.createElement("p");
    paragraph.textContent = String(texto ?? "");

    const closeButton = document.createElement("button");
    closeButton.className = "cerrar-popup";
    closeButton.type = "button";
    closeButton.textContent = "Cerrar";

    content.append(heading, paragraph, closeButton);
    popup.appendChild(content);
    popup.classList.add("show");

    closeButton.addEventListener("click", () => {
        popup.classList.remove("show");
    });
}   }
);
