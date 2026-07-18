// Traduce los enums de estado de AniList/MangaDex para mostrarlos.
// Cualquier valor no reconocido (datos locales viejos ya en español) pasa tal cual.
function formatMediaStatus(status, categoria) {
    const enPublicacion = categoria === 'manga' || categoria === 'novelas';
    const map = {
        RELEASING: enPublicacion ? 'En publicación' : 'En emisión',
        FINISHED: 'Finalizado',
        NOT_YET_RELEASED: 'Próximamente',
        HIATUS: 'En pausa',
        CANCELLED: 'Cancelado'
    };
    return map[String(status || '').toUpperCase()] || status;
}

// Countdown del próximo episodio (un solo timer vivo por página)
function formatCountdown(msLeft) {
    const totalMin = Math.max(0, Math.floor(msLeft / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function startNextEpCountdown(localLayout) {
    if (window.__nextEpTimer) {
        clearInterval(window.__nextEpTimer);
        window.__nextEpTimer = null;
    }
    const el = localLayout.querySelector('[data-airing-at]');
    if (!el) return;
    const airingMs = Number(el.getAttribute('data-airing-at')) * 1000;
    if (!airingMs) return;

    function tick() {
        const left = airingMs - Date.now();
        if (left <= 0) {
            el.textContent = '¡Ya disponible!';
            clearInterval(window.__nextEpTimer);
            window.__nextEpTimer = null;
            return;
        }
        el.textContent = formatCountdown(left);
    }
    tick();
    window.__nextEpTimer = setInterval(tick, 30000);
}

function renderDetalle(item, nombreUrl, categoria) {
    window.__lastRenderedItem = AnimeDestiny.internals.__lastRenderedItem = item;
    window.__lastRenderedCategory = AnimeDestiny.internals.__lastRenderedCategory = categoria;

    const localLayout = document.getElementById('detail-local-layout');
    if (!localLayout) return;

    if (window.__nextEpTimer) {
        clearInterval(window.__nextEpTimer);
        window.__nextEpTimer = null;
    }

    setDetailViewState('local');

    item = normalizeDetailItem(item);
    if (!item) {
        const title = nombreUrl ? `No encontrado: ${nombreUrl}` : 'No encontrado';
        document.title = title;
        const backHref = categoria === 'novelas' ? 'novelas.html' : (categoria === 'anime' ? 'anime.html' : 'manga.html');
        localLayout.innerHTML = `
            <h1 class="detail-title">${escapeHtml(title)}</h1>
            <p class="detail-subtitle">Volvé al catálogo para elegir otro.</p>
            <a class="detail-back" href="${escapeHtml(backHref)}">Volver al catálogo</a>
        `;
        return;
    }

    try {
        document.body.setAttribute('data-detail-cat', String(categoria || 'manga'));
    } catch { /* no-op (body attr) */ }

    // Marcar el botón activo del navbar según la categoría del detalle
    try {
        const nav = document.querySelector('.destiny-navbar');
        if (nav) {
            nav.querySelectorAll('.nav-btn').forEach(a => a.classList.remove('active'));
            const map = { manga: 'manga.html', anime: 'anime.html', novelas: 'novelas.html' };
            const href = map[categoria] || 'manga.html';
            const active = nav.querySelector(`a.nav-btn[href="${href}"]`);
            if (active) active.classList.add('active');
        }
    } catch { /* no-op (navbar) */ }

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

    function setMetaTag(name, content, attrName = 'name') {
        if (!content) return;
        let meta = document.querySelector(`meta[${attrName}="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attrName, name);
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
    }

    const isManga = categoria === 'manga' || !categoria;
    const isNovela = categoria === 'novelas';
    const isAnime = categoria === 'anime';
    const isMangaOrNovela = isManga || isNovela;
    const rawStatus = item.status || item.estado || '';
    const isAiring = String(rawStatus).toUpperCase() === 'RELEASING';
    const status = formatMediaStatus(rawStatus, categoria) || 'No especificado';

    // Próximo episodio (solo anime en emisión; airingAt es epoch absoluto,
    // así el countdown queda bien aunque el detalle venga del cache de 1h)
    const nextEp = item.nextAiringEpisode || null;
    const nextEpMs = nextEp && Number(nextEp.airingAt) ? Number(nextEp.airingAt) * 1000 : 0;
    let nextEpHtml = '';
    if (isAnime && isAiring && nextEp && nextEpMs > Date.now()) {
        const fecha = new Date(nextEpMs).toLocaleString('es-AR', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
        nextEpHtml = `
            <div class="next-episode-card">
                <span class="next-ep-dot" aria-hidden="true"></span>
                <div class="next-ep-body">
                    <span class="next-ep-label">Próximo episodio</span>
                    <strong class="next-ep-num">EP ${Number(nextEp.episode) || '?'}</strong>
                    <span class="next-ep-when">${escapeHtml(fecha)} hs</span>
                </div>
                <div class="next-ep-countdown" data-airing-at="${Number(nextEp.airingAt)}"></div>
            </div>
        `;
    }

    // Cuadraditos en emisión: si conocemos el próximo episodio sabemos cuántos
    // salieron, aunque AniList no publique el total (episodes: null en emisión).
    // Solo aplica con una única temporada: la numeración de nextAiringEpisode
    // es propia de esta entrada de AniList.
    const nextEpNum = (isAnime && isAiring && nextEp && nextEpMs > Date.now())
        ? (Number(nextEp.episode) || 0)
        : 0;
    const airedCount = nextEpNum > 0 ? nextEpNum - 1 : 0;
    const score = item.score ?? item.puntaje ?? item.calificacion ?? 'N/A';
    const countLabel = isMangaOrNovela ? 'Volúmenes' : isAnime ? 'Capítulos' : 'Capítulos';
    const countValue = isMangaOrNovela ? (volumenes || 'No especificado') : isAnime ? (item.capitulos || item.episodios || item.episodes || 'No especificado') : 'No especificado';

    const summaryText = resumen || item.sinopsis || item.descripcion || item.info || 'Sin sinopsis disponible.';

    setMetaTag('description', summaryText);
    setMetaTag('og:title', pageTitle, 'property');
    setMetaTag('og:description', summaryText, 'property');
    setMetaTag('og:image', item.img, 'property');
    setMetaTag('og:url', window.location.href, 'property');
    setMetaTag('twitter:title', pageTitle);
    setMetaTag('twitter:description', summaryText);
    setMetaTag('twitter:image', item.img);

    const demografiaHtml = item.demografia
        ? `<span class="card-demographic demographic-${escapeHtml(item.demografia)}">${escapeHtml(item.demografia)}</span>`
        : '';

    const generosHtml = generos.length
        ? generos.map(g => `<span class="detail-chip">${escapeHtml(g)}</span>`).join('')
        : `<span class="detail-chip detail-chip-muted">No especificado</span>`;

    const detailStatsHtml = `
        <div class="detail-stat-grid">
            <div class="detail-stat">
                <div class="detail-stat-icon"><i data-lucide="book-open"></i></div>
                <div class="detail-stat-content"><span>${escapeHtml(countLabel)}</span><strong>${escapeHtml(String(countValue))}</strong></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-icon"><i data-lucide="book"></i></div>
                <div class="detail-stat-content"><span>Vol.</span><strong>${isMangaOrNovela ? escapeHtml(String(volumenes || '1')) : '—'}</strong></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-icon"><i data-lucide="check-circle"></i></div>
                <div class="detail-stat-content"><span>Estado</span><strong>${escapeHtml(status)}</strong></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-icon"><i data-lucide="star"></i></div>
                <div class="detail-stat-content"><span>Puntaje</span><strong>${escapeHtml(String(score))}</strong></div>
            </div>
        </div>
    `;

    let extraBlockHtml = '';
    let progressPanelHtml = '';

    // Builder de un cuadradito de volumen (compartido: render inicial + "Mostrar más")
    const VOL_CHUNK = 120;
    const buildVolButton = (v) => {
        const active = UserStore.getItem(volumeStorageKey(userId, item.id, v, categoria)) ? ' is-active' : '';
        return `
                <div class="cuadrado-wrapper">
                    <button class="vol-btn cuadrado-item${active}" type="button" data-vol="${v}" aria-label="Volumen ${v}">${String(v).padStart(2, '0')}</button>
                    <button class="btn-resumen" type="button" data-vol="${v}" aria-label="Ver resumen del volumen ${v}">RESUMEN</button>
                </div>
            `;
    };

    if (isMangaOrNovela && totalVols > 0) {
        const markedVolumes = Array.from({ length: totalVols }, (_, i) => {
            const v = i + 1;
            return UserStore.getItem(volumeStorageKey(userId, item.id, v, categoria)) ? 1 : 0;
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
        // Render por bloques para no inyectar cientos de nodos de una
        const firstChunk = Math.min(VOL_CHUNK, totalVols);
        let buttons = '';
        for (let v = 1; v <= firstChunk; v++) buttons += buildVolButton(v);
        if (totalVols > firstChunk) {
            buttons += `<button type="button" class="vol-grid-more">Mostrar más (${totalVols - firstChunk} restantes)</button>`;
        }

        extraBlockHtml = `
            <div class="detail-section">
                <h2 class="detail-h2">Volúmenes</h2>
                <p class="detail-help">Tocá un volumen para marcarlo en verde (guardado por usuario).</p>
                <div class="vol-grid" data-manga-id="${escapeHtml(item.id)}" data-total-vols="${totalVols}">${buttons}</div>
            </div>
        `;
    }

    if (isAnime) {
        const animeStructure = getAnimeStructure(item);
        const temporadas = animeStructure.temporadas;
        const temporadasCount = temporadas.length;
        // En emisión sin total publicado: usar los episodios ya emitidos
        const singleSeason = temporadasCount <= 1;
        const totalEps = Number(animeStructure.capitulos)
            || (singleSeason ? airedCount : 0);
        let watchedEpisodes = 0;
        temporadas.forEach((season, seasonIdx) => {
            const eps = Number(season.episodios) || (singleSeason ? airedCount : 0);
            for (let ep = 1; ep <= eps; ep++) {
                const key = episodeStorageKey(userId, item.id, seasonIdx, ep);
                if (UserStore.getItem(key)) watchedEpisodes++;
            }
        });
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
    // ── Related items ──
    var relationTypeLabels = {
        'SEQUEL': 'Secuela', 'PREQUEL': 'Precuela', 'SIDE_STORY': 'Historia paralela',
        'SPIN_OFF': 'Spin-off', 'ADAPTATION': 'Adaptaci\u00F3n', 'SUMMARY': 'Resumen',
        'ALTERNATIVE': 'Alternativa', 'PARENT': 'Principal', 'CONTAINS': 'Contiene', 'OTHER': 'Otro'
    };
    function relatedCategory(fmt) {
        if (fmt === 'NOVEL') return 'novelas';
        return ['TV','TV_SHORT','MOVIE','SPECIAL','OVA','ONA','MUSIC'].indexOf(fmt) !== -1 ? 'anime' : 'manga';
    }
    var relatedMap = {};
    function pushRelated(src) {
        if (!src || String(src.id) === String(item.id) || !src.title) return;
        var key = String(src.id);
        if (relatedMap[key]) return;
        relatedMap[key] = src;
    }
    (Array.isArray(item.relations) ? item.relations : []).forEach(pushRelated);
    if (Array.isArray(item.seasons)) {
        item.seasons.forEach(function (s, i) {
            if (i === 0) return;
            pushRelated({ relationType: 'SEQUEL', id: s.id, title: s.title, episodes: s.episodes || 0, format: s.format, seasonYear: s.seasonYear });
        });
    }
    var relatedList = Object.keys(relatedMap).map(function (k) { return relatedMap[k]; }).slice(0, 10);
    var relatedHtml = '';
    if (relatedList.length) {
        relatedHtml = '<div class="detail-section detail-section-related"><h2 class="detail-h2">Relacionados</h2><div class="related-grid">' +
            relatedList.map(function (r) {
                var cat = relatedCategory(r.format);
                var label = relationTypeLabels[r.relationType] || r.relationType || 'Relacionado';
                return '<a class="related-card" href="detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(r.id) + '">' +
                    '<span class="related-type-badge">' + escapeHtml(label) + '</span>' +
                    '<span class="related-title">' + escapeHtml(r.title) + '</span>' +
                    '</a>';
            }).join('') +
            '</div></div>';
    }

    let backHref = isAnime ? 'anime.html' : (isNovela ? 'novelas.html' : 'manga.html');
    try {
        const last = sessionStorage.getItem('lastCatalogUrl');
        if (last) backHref = last;
    } catch { /* no-op (sessionStorage) */ }

    localLayout.innerHTML = `
        <div class="detail-grid">
            <div class="detail-cover">
                <img src="${safeUrl(item.img)}" alt="${escapeHtml(item.titulo)}" width="460" height="690" decoding="async" fetchpriority="high" data-fallback-catalog="1" data-title="${escapeHtml(item.titulo)}">
            </div>
            <div class="detail-info">
                ${demografiaHtml}
                <h1 class="detail-title">${escapeHtml(item.titulo)}</h1>
                <div class="detail-status${isAiring ? ' is-airing' : ''}"><span><i data-lucide="${isAiring ? 'radio' : 'check-circle'}"></i></span> ${escapeHtml(status)}</div>
                ${nextEpHtml}
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

                <div class="detail-actions-bar">
                    <button class="action-btn share-btn" type="button" aria-label="Compartir" title="Compartir"><i data-lucide="share-2"></i></button>
                    <button class="action-btn fav-btn" type="button" aria-label="Favorito"><i data-lucide="heart"></i></button>
                    <button class="action-btn viewed-btn" type="button" aria-label="Marcar como visto"><i data-lucide="eye"></i></button>
                </div>

                <div class="watch-status-bar" role="group" aria-label="Estado de seguimiento">
                    <button class="watch-status-pill" type="button" data-wstatus="viendo">Viendo</button>
                    <button class="watch-status-pill" type="button" data-wstatus="pendiente">Pendiente</button>
                    <button class="watch-status-pill" type="button" data-wstatus="pausado">En pausa</button>
                    <button class="watch-status-pill" type="button" data-wstatus="abandonado">Abandonado</button>
                </div>

                <div class="detail-actions">
                    <a class="detail-back" href="${escapeHtml(backHref)}" data-restore-catalog="1">Volver al catálogo</a>
                </div>
            </div>
        </div>
        ${relatedHtml}
        <div id="comments-section"></div>
    `;

    startNextEpCountdown(localLayout);

    // ── Estado de seguimiento (pills) ──
    const wsBar = localLayout.querySelector('.watch-status-bar');
    if (wsBar && typeof window.getWatchStatus === 'function') {
        const syncPills = () => {
            const current = window.getWatchStatus(getCurrentUserIdSafe(), item.id);
            wsBar.querySelectorAll('.watch-status-pill').forEach(p => {
                p.classList.toggle('is-active', p.getAttribute('data-wstatus') === current);
            });
        };
        syncPills();
        wsBar.addEventListener('click', (e) => {
            const pill = e.target.closest('.watch-status-pill');
            if (!pill) return;
            const status = pill.getAttribute('data-wstatus');
            const current = window.getWatchStatus(getCurrentUserIdSafe(), item.id);
            window.setWatchStatus(item.id, current === status ? '' : status, {
                titulo: item.titulo,
                img: item.img,
                info: item.info || '',
                total: totalVols || item.episodes || 0,
                __category: categoria || 'manga'
            });
            syncPills();
        });
    }

    const favBtn = localLayout.querySelector('.fav-btn');
    const viewedBtn = localLayout.querySelector('.viewed-btn');
    const shareBtn = localLayout.querySelector('.share-btn');
 
    function syncActionButton(button, type) {
        if (!button) return;
        const uId = getCurrentUserIdSafe();
        const key = detailStatusStorageKey(uId, item.id, type);
        const active = !!UserStore.getItem(key);
        button.classList.toggle('active', active);
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

            const key = detailStatusStorageKey(uId, item.id, type);
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

            const favKey = detailStatusStorageKey(uId, item.id, 'fav');
            const viewedKey = detailStatusStorageKey(uId, item.id, 'viewed');
            saveDetailStateToSupabase(
                categoria,
                item,
                !!UserStore.getItem(favKey),
                !!UserStore.getItem(viewedKey)
            );
        });
    });

    function loadFavViewedFromSupabase() {
        var client = window.AppSupabase;
        if (!client || !client.loadItemStates || !client.isSignedIn || !client.isSignedIn()) return;
        var uId = getCurrentUserIdSafe();
        if (uId === 'Invitado') return;
        client.loadItemStates(categoria).then(function (states) {
            if (!Array.isArray(states)) return;
            var match = states.find(function (s) {
                return String(s.item_id) === String(item.id);
            });
            if (!match) return;
            var favKey = detailStatusStorageKey(uId, item.id, 'fav');
            var viewedKey = detailStatusStorageKey(uId, item.id, 'viewed');
            var changed = false;
            if (match.fav && !UserStore.getItem(favKey)) {
                UserStore.setItem(favKey, '1');
                changed = true;
            }
            if (match.viewed && !UserStore.getItem(viewedKey)) {
                UserStore.setItem(viewedKey, '1');
                changed = true;
            }
            if (changed) {
                syncActionButton(favBtn, 'fav');
                syncActionButton(viewedBtn, 'viewed');
            }
        }).catch(function (err) {
            console.warn('No se pudo cargar estados de ítem desde Supabase:', err);
        });
    }
    loadFavViewedFromSupabase();
    window.addEventListener("supabase-auth-changed", loadFavViewedFromSupabase);

 
    function maybeGrantProgressXp(wasActive) {
        if (!wasActive) return;
        const uId = getCurrentUserIdSafe();
        if (uId === 'Invitado' || typeof addUserPoints !== 'function') return;
        addUserPoints(uId, AnimeDestiny.Constants.XP_PROGRESS || 2);
    }

    function maybeGrantCompletionBonus() {
        const uId = getCurrentUserIdSafe();
        if (uId === 'Invitado' || typeof addUserPoints !== 'function') return;
        let watched = 0, total = 0;
        if (isMangaOrNovela && totalVols > 0) {
            total = totalVols;
            for (let v = 1; v <= total; v++) {
                if (UserStore.getItem(volumeStorageKey(uId, item.id, v, categoria))) watched++;
            }
        } else if (isAnime) {
            const temps = parseTemporadas(item);
            temps.forEach((s, si) => {
                const eps = Number(s.episodios) || 0;
                total += eps;
                for (let ep = 1; ep <= eps; ep++) {
                    if (UserStore.getItem(episodeStorageKey(uId, item.id, si, ep))) watched++;
                }
            });
        }
        if (watched >= total && total > 0) {
            const bonusKey = `u:${uId}|item:${item.id}|completed_bonus`;
            if (!UserStore.getItem(bonusKey)) {
                UserStore.setItem(bonusKey, '1');
                const xp = AnimeDestiny.Constants.XP_COMPLETE || 50;
                addUserPoints(uId, xp);
                if (window.Toast) window.Toast.success("¡Completaste la obra! 🏆 (+" + xp + " EXP)");
            }
        }
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareData = {
                title: pageTitle,
                text: `¡Mirá este ${categoria} que encontré! Se llama "${item.titulo}".`,
                url: window.location.href
            };
            function onShareDone() {
                const uId = getCurrentUserIdSafe();
                if (uId !== 'Invitado' && typeof addUserPoints === 'function') {
                    addUserPoints(uId, AnimeDestiny.Constants.XP_SHARE || 5);
                    if (window.Toast) window.Toast.success("¡Compartido! (+" + (AnimeDestiny.Constants.XP_SHARE || 5) + " EXP)");
                }
            }
            if (navigator.share) {
                navigator.share(shareData).then(onShareDone).catch(err => console.warn('Error al compartir:', err));
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    if (window.Toast) window.Toast.success('Enlace copiado al portapapeles. ¡Pegalo para compartir!');
                    else alert('Enlace copiado al portapapeles. ¡Pegalo para compartir!');
                    onShareDone();
                }).catch(() => {
                    if (window.Toast) window.Toast.error('No se pudo copiar el enlace.');
                    else alert('No se pudo copiar el enlace.');
                });
            }
        });
    }
 
    function renderProgressPanel() {
        const panel = localLayout.querySelector('.detail-progress-card');
        if (!panel) return;
 
        const uId = getCurrentUserIdSafe();
        if (isMangaOrNovela && totalVols > 0) {
            const markedVolumes = Array.from({ length: totalVols }, (_, i) => {
                const v = i + 1;
                return UserStore.getItem(volumeStorageKey(uId, item.id, v, categoria)) ? 1 : 0;
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
            const singleSeason = temporadas.length <= 1;
            // En emisión sin total publicado: usar los episodios ya emitidos
            const totalEps = temporadas.reduce((acc, t) => acc + (Number(t.episodios) || 0), 0)
                || (singleSeason ? airedCount : 0);
            let watchedEpisodes = 0;
            const seasonList = temporadas.length ? temporadas : [{ episodios: 0 }];
            seasonList.forEach((season, seasonIdx) => {
                const eps = Number(season.episodios) || (singleSeason ? airedCount : 0);
                for (let ep = 1; ep <= eps; ep++) {
                    const key = episodeStorageKey(uId, item.id, seasonIdx, ep);
                    if (UserStore.getItem(key)) watchedEpisodes++;
                }
            });
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
            syncProgressFromSupabase(categoria, item.id).then(() => {
                grid.querySelectorAll('button.vol-btn').forEach((btn) => {
                    const vol = Number.parseInt(btn.getAttribute('data-vol') || '', 10);
                    if (!Number.isFinite(vol) || vol <= 0) return;
                    const key = volumeStorageKey(getCurrentUserIdSafe(), item.id, vol, categoria);
                    btn.classList.toggle('is-active', !!UserStore.getItem(key));
                });
                renderProgressPanel();
            });

            grid.addEventListener('click', (e) => {
                const moreBtn = e.target instanceof HTMLElement ? e.target.closest('.vol-grid-more') : null;
                if (moreBtn) {
                    const rendered = grid.querySelectorAll('button.vol-btn').length;
                    const to = Math.min(rendered + VOL_CHUNK, totalVols);
                    let html = '';
                    for (let v = rendered + 1; v <= to; v++) html += buildVolButton(v);
                    moreBtn.insertAdjacentHTML('beforebegin', html);
                    if (to < totalVols) moreBtn.textContent = `Mostrar más (${totalVols - to} restantes)`;
                    else moreBtn.remove();
                    return;
                }

                const resumenBtn = e.target instanceof HTMLElement ? e.target.closest('button.btn-resumen') : null;
                if (resumenBtn) {
                    const vol = Number.parseInt(resumenBtn.getAttribute('data-vol') || '', 10);
                    if (Number.isFinite(vol) && vol > 0 && typeof showEpisodeInfoModal === 'function') {
                        showEpisodeInfoModal(item, vol, false, categoria);
                    }
                    return;
                }

                const btn = e.target instanceof HTMLElement ? e.target.closest('button.vol-btn') : null;
                if (!btn) return;
                const vol = Number.parseInt(btn.getAttribute('data-vol') || '', 10);
                if (!Number.isFinite(vol) || vol <= 0) return;

                const key = volumeStorageKey(getCurrentUserIdSafe(), item.id, vol, categoria);
                const isActive = btn.classList.toggle('is-active');
                if (isActive) UserStore.setItem(key, '1');
                else UserStore.removeItem(key);
                saveProgressToSupabase(categoria, item.id, progressSqlKeyVolume(vol), isActive);
                renderProgressPanel();
                maybeGrantProgressXp(isActive);
                maybeGrantCompletionBonus();
            });
        }
    }

    if (isAnime) {
        const temporadas = parseTemporadas(item);
        const epGrid = localLayout.querySelector('#epGrid');
        const tabsEl = localLayout.querySelector('.season-tabs');
        const seasons = temporadas.length ? temporadas : [{ nombre: 'Temporada 1', episodios: 0 }];
        const GRID_CHUNK = 120;
        let _epRenderMore = null;

        function renderEpisodes(seasonIndex) {
            if (!epGrid) return;
            const season = seasons[seasonIndex] || seasons[0];
            const rawEps = Number(season.episodios) || 0;

            // En emisión: mostrar hasta el próximo episodio aunque no haya total
            const applyAiring = nextEpNum > 0 && seasons.length === 1;
            const eps = applyAiring ? Math.max(rawEps, nextEpNum) : rawEps;

            if (!eps) {
                epGrid.innerHTML = `<span class="detail-chip detail-chip-muted">Episodios no especificados</span>`;
                _epRenderMore = null;
                return;
            }

            const uid = getCurrentUserIdSafe();
            function buildEpButton(ep) {
                const key = episodeStorageKey(uid, item.id, seasonIndex, ep);
                const active = UserStore.getItem(key) ? ' is-active' : '';

                let airingCls = '';
                let disabledAttr = '';
                let proxTag = '';
                let ariaExtra = '';
                if (applyAiring && ep === nextEpNum) {
                    airingCls = ' is-next-ep';
                    disabledAttr = ' disabled';
                    proxTag = '<span class="prox-tag">PRÓX.</span>';
                    ariaExtra = ' (próximo episodio, aún no emitido)';
                } else if (applyAiring && ep > nextEpNum) {
                    airingCls = ' is-unaired';
                    disabledAttr = ' disabled';
                    ariaExtra = ' (aún no emitido)';
                }

                return `
<div class="cuadrado-wrapper">
    <button
        class="ep-btn cuadrado-item ${active ? 'is-active' : ''}${airingCls}"
        type="button"${disabledAttr}
        data-season="${seasonIndex}"
        data-ep="${ep}"
        aria-label="Episodio ${ep}${ariaExtra}">
        ${String(ep).padStart(2, '0')}${proxTag}
    </button>
    <button
        class="btn-resumen"
        data-season="${seasonIndex}"
        data-ep="${ep}">
        Resumen
    </button>
</div>
`;
            }

            // Render por bloques para no inyectar miles de nodos de una (One Piece ~1170 eps)
            epGrid.innerHTML = '';
            let rendered = 0;
            function renderChunk() {
                epGrid.querySelector('.ep-grid-more')?.remove();
                const to = Math.min(rendered + GRID_CHUNK, eps);
                let html = '';
                for (let ep = rendered + 1; ep <= to; ep++) html += buildEpButton(ep);
                epGrid.insertAdjacentHTML('beforeend', html);
                rendered = to;
                if (rendered < eps) {
                    epGrid.insertAdjacentHTML('beforeend',
                        `<button type="button" class="ep-grid-more">Mostrar más (${eps - rendered} restantes)</button>`);
                }
            }
            _epRenderMore = renderChunk;
            renderChunk();
        }

        function setActiveTab(seasonIndex) {
            if (!tabsEl) return;
            const allTabs = tabsEl.querySelectorAll('.season-tab');
            allTabs.forEach(t => t.classList.toggle('is-active', t.getAttribute('data-season') === String(seasonIndex)));
        }

        // Render inmediato con UserStore, luego sync desde Supabase
        renderEpisodes(0);
        syncProgressFromSupabase('anime', item.id).then(() => {
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
                const moreBtn = e.target instanceof HTMLElement ? e.target.closest('.ep-grid-more') : null;
                if (moreBtn) { if (typeof _epRenderMore === 'function') _epRenderMore(); return; }
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
                maybeGrantProgressXp(isActive);
                maybeGrantCompletionBonus();
            });

            epGrid.addEventListener('click', (e) => {
                const resumenBtn = e.target instanceof HTMLElement ? e.target.closest('button.btn-resumen') : null;
                if (!resumenBtn) return;
                const ep = Number.parseInt(resumenBtn.getAttribute('data-ep') || '0', 10);
                if (!Number.isFinite(ep) || ep <= 0) return;
                if (typeof showEpisodeInfoModal === 'function') {
                    showEpisodeInfoModal(item, ep, true, 'anime');
                }
            });
        }
    }
}
