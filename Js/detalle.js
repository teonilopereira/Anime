

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
saveProgressToSupabase


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
    // Supabase es la única fuente de verdad — sin fallback a localStorage
    const user = window.AppSupabase?.getCurrentUser?.();
    if (!user) return 'Invitado';
    return (
        user.user_metadata?.username ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        (user.email ? user.email.split('@')[0] : '') ||
        user.id ||
        'Invitado'
    );
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

function saveDetailStateToSupabase(category, item, fav, viewed) {
    const client = window.AppSupabase;
    if (!client?.saveItemState) return;

    client.saveItemState({
        category,
        itemId: String(item?.id || item?.mal_id || ''),
        fav,
        viewed,
        meta: {
            id: String(item?.id || item?.mal_id || ''),
            titulo: String(item?.titulo || item?.title || ''),
            img: String(item?.img || item?.images?.webp?.large_image_url || item?.images?.jpg?.large_image_url || ''),
            info: String(item?.info || item?.synopsis || ''),
            __category: category
        }
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
