// js/pages/mis-listas-stats.js
// Actividad y estadísticas: grilla de actividad, tarjetas por categoría y
// gráficos de barras (géneros, tipos, estados).
// Extraído de mis-listas.js. Ámbito global (script clásico con defer), igual
// que mis-listas.js: comparte sus constantes y estado (_sessionUser, etc.) y
// sus funciones se llaman recién en DOMContentLoaded, con todo ya cargado.

function renderActividad() {
    const grid = document.getElementById('actividadGrid');
    if (!grid) return;
    
    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        grid.innerHTML = '<div class="lists-empty"><h3>Iniciá sesión</h3><p>Para registrar y ver actividad.</p></div>';
        return;
    }

    const allItems = getAllItems();

    // Pre-build progress index: scan UserStore keys ONCE
    const progressMap = new Map();
    try {
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(`u:${userId}|`)) return;
            if (!UserStore.getItem(key)) return;
            let itemId = null, chapter = '';
            const animeM = key.match(/\|anime:(\d+)\|s:\d+\|ep:(\d+)$/);
            if (animeM) { itemId = animeM[1]; chapter = 'EP ' + animeM[2]; }
            if (!itemId) {
                const mangaM = key.match(/\|manga:(\d+)\|vol:(\d+)$/);
                if (mangaM) { itemId = mangaM[1]; chapter = 'Vol ' + mangaM[2]; }
            }
            if (!itemId) {
                const novelaM = key.match(/\|novela:(\d+)\|vol:(\d+)$/);
                if (novelaM) { itemId = novelaM[1]; chapter = 'Vol ' + novelaM[2]; }
            }
            if (itemId) {
                const prev = progressMap.get(itemId) || { hasProgress: false, lastChapter: '' };
                progressMap.set(itemId, { hasProgress: true, lastChapter: chapter || prev.lastChapter });
            }
        });
    } catch (e) { console.warn('Activity progress scan failed:', e); }

    let actividadItems = [];
    allItems.forEach(item => {
        const fav = !!UserStore.getItem(`u:${userId}|item:${item.id}|fav`);
        const viewed = !!UserStore.getItem(`u:${userId}|item:${item.id}|viewed`);
        const prog = progressMap.get(String(item.id));
        const hasProgress = prog ? prog.hasProgress : false;
        const lastChapter = prog ? prog.lastChapter : '';
        
        if (fav || viewed || hasProgress) {
            actividadItems.push({ ...item, fav, viewed, hasProgress, lastChapter });
        }
    });

    actividadItems.sort((a, b) => getItemTs(userId, b.id) - getItemTs(userId, a.id));
    actividadItems = actividadItems.slice(0, AnimeDestiny.Constants.MAX_ACTIVITY_ITEMS || 15);
    
    if (actividadItems.length === 0) {
        grid.innerHTML = '<div class="lists-empty"><h3>Sin actividad</h3><p>No hay actividad reciente.</p></div>';
        return;
    }
    
    grid.innerHTML = actividadItems.map((entry, idx) => {
        const title = escapeHtml(entry.titulo);
        const img = safeUrl(anilistCover(entry.img, 'small'));
        const cat = escapeHtml(CATEGORY_LABELS[entry.__category] || entry.__category || '');
        const link = getItemLink(entry);
        const epsLabel = entry.__category === 'anime' ? 'eps' : 'vols';
        const badges = [
            entry.fav ? '<span style="color:#bc13fe;">❤ Me gusta</span>' : '',
            entry.viewed ? '<span style="color:#00f2ff;">👁 Visto</span>' : ''
        ].filter(Boolean).join(' ');
        
        const prog = entry.hasProgress ? `<div style="color:#00f2ff; font-weight:bold; font-size: 0.85rem; margin-top:4px;">Último marcado: ${escapeHtml(entry.lastChapter || '')}</div>` : '';

        return `
            <article class="list-row-card">
                <div class="row-rank">${idx + 1}</div>
                <a href="${escapeHtml(link)}">
                    <img class="row-cover" src="${img}" alt="${title}" width="42" height="60" decoding="async" loading="lazy" data-fallback-catalog="1">
                </a>
                <div class="row-info">
                    <div class="row-title">${title}</div>
                    <div class="row-desc"><span class="row-cat">${cat}</span>${renderGenres(entry.info)}</div>
                    ${badges ? `<div class="row-status">${badges}</div>` : ''}
                    ${prog}
                </div>
                <div class="row-eps">
                    <div>${escapeHtml(String(entry.total || entry.episodes || entry.chapters || entry.volumes || '?'))}</div>
                    <div style="font-size:0.65em;font-weight:normal;color:rgba(255,255,255,0.35);">${epsLabel}</div>
                </div>
            </article>
        `;
    }).join('');
}

// Totales por categoría de la columna lateral ("En números"): cuenta todo lo
// que está en alguna lista (Me gusta, Visto o un estado de seguimiento).
function updateCategoryCards() {
    const user = getCurrentUserIdSafe();
    const catCounts = { anime: 0, manga: 0, novelas: 0 };
    if (user !== 'Invitado') {
        getAllItems().forEach(item => {
            const cat = item.__category;
            if (catCounts[cat] == null) return;
            if (matchesFilter(getUserItemState(user, item), LIST_FILTERS.ALL)) catCounts[cat]++;
        });
    }
    const setE = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setE('countAnime', catCounts.anime);
    setE('countManga', catCounts.manga);
    setE('countNovelas', catCounts.novelas);
}

// Pinta una lista de barras horizontales (género/tipo/estado). Cada fila:
// etiqueta, barra proporcional al máximo y valor. Puro CSS, sin librerías.
function renderBarChart(title, rows, accent) {
    if (!rows.length) return '';
    const max = Math.max.apply(null, rows.map(r => r.value)) || 1;
    const bars = rows.map(r => {
        const pct = Math.max(4, Math.round((r.value / max) * 100));
        const color = r.color || accent || '#bc13fe';
        return `
        <div class="stat-bar-row">
            <span class="stat-bar-label">${escapeHtml(String(r.label))}</span>
            <span class="stat-bar-track"><span class="stat-bar-fill" style="width:${pct}%;background:${color}"></span></span>
            <span class="stat-bar-value">${r.value}</span>
        </div>`;
    }).join('');
    return `
    <section class="stat-chart-card">
        <h3 class="stat-chart-title">${escapeHtml(title)}</h3>
        <div class="stat-bars">${bars}</div>
    </section>`;
}

function renderStats() {
    const host = document.getElementById('statsGrid');
    const charts = document.getElementById('statsCharts');
    if (!host) return;
    const user = getCurrentUserIdSafe();
    if (user === 'Invitado') {
        host.innerHTML = '<div class="lists-empty" style="grid-column:1/-1"><h3>Sin datos</h3><p class="stat-label">Iniciá sesión para ver estadísticas.</p></div>';
        if (charts) charts.innerHTML = '';
        return;
    }

    let totalFav = 0, totalViewed = 0, byCategory = {};
    const genreCounts = {};
    const statusCounts = { viendo: 0, pendiente: 0, pausado: 0, abandonado: 0 };
    let totalEnListas = 0;

    getAllItems().forEach(item => {
        const cat = item.__category;
        if (!byCategory[cat]) byCategory[cat] = { count: 0 };
        const st = getUserItemState(user, item);
        const enLista = st.fav || st.viewed || st.wstatus;
        if (enLista) { byCategory[cat].count++; totalEnListas++; }
        if (st.fav)    totalFav++;
        if (st.viewed) totalViewed++;
        if (st.wstatus && statusCounts[st.wstatus] != null) statusCounts[st.wstatus]++;
        // Géneros: solo de lo que está en alguna lista, para reflejar gustos.
        if (enLista) {
            extractGenresFromInfo(item.info).forEach(g => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
        }
    });

    const pts = Number(UserStore.getItem(`u:${user}|points`) || 0);

    const statItems = [
        { label: 'En tus listas', value: totalEnListas, icon: '📚', color: '#a855f7' },
        { label: 'Total Me gusta', value: totalFav, icon: '❤', color: '#bc13fe' },
        { label: 'Total Vistos', value: totalViewed, icon: '👁', color: '#00f2ff' },
        { label: 'Puntos acumulados', value: pts, icon: '⭐', color: '#f59e0b' }
    ];

    host.innerHTML = statItems.map(s => `
        <div class="stat-card">
            <div class="stat-icon">${s.icon}</div>
            <div>
                <div class="stat-value" style="color:${s.color}">${s.value}</div>
                <div class="stat-label">${escapeHtml(s.label)}</div>
            </div>
        </div>
    `).join('');

    if (!charts) return;

    // ── Top géneros (barras) ──
    const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value }));

    // ── Distribución por tipo ──
    const catColors = { anime: '#00f2ff', manga: '#bc13fe', novelas: '#f59e0b' };
    const catRows = Object.entries(byCategory)
        .filter(([, c]) => c.count > 0)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([cat, c]) => ({
            label: CATEGORY_LABELS[cat] || cat,
            value: c.count,
            color: catColors[cat] || '#a855f7'
        }));

    // ── Estados de seguimiento ──
    const statusRows = [
        { key: 'viendo', label: 'Viendo' },
        { key: 'pendiente', label: 'Pendiente' },
        { key: 'pausado', label: 'En pausa' },
        { key: 'abandonado', label: 'Abandonado' }
    ].filter(s => statusCounts[s.key] > 0)
     .map(s => ({
        label: s.label,
        value: statusCounts[s.key],
        color: (WSTATUS_BADGES[s.key] && WSTATUS_BADGES[s.key].color) || '#94a3b8'
     }));

    const chartsHtml =
        renderBarChart('Tus géneros favoritos', topGenres, '#bc13fe') +
        renderBarChart('Distribución por tipo', catRows, '#00f2ff') +
        renderBarChart('Estados de seguimiento', statusRows, '#4d86ff');

    charts.innerHTML = chartsHtml ||
        '<p class="stat-label" style="text-align:center;padding:20px 0">Marcá contenido en tus listas para ver tu perfil de gustos.</p>';
}
