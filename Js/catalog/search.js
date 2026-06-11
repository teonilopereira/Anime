// ==========================================
// catalog/search.js
// Búsqueda en catálogo y filtros por género
// ==========================================

function inicializarBusquedaCatalogo() {
    const categoria = document.body.getAttribute('data-page');
    const input = document.getElementById('catalogSearch') || document.getElementById('mangaSearch');
    const mainContainer = document.getElementById('main-container');
    if (!input || !mainContainer) return;

    const inputWrap = input.closest('.nav-search') || input.parentElement;
    let suggestionBox = document.getElementById('catalogSuggestions');
    if (!suggestionBox && inputWrap) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'catalogSuggestions';
        suggestionBox.className = 'catalog-suggestions';
        inputWrap.appendChild(suggestionBox);
    }

    let emptyMsg = document.getElementById('searchEmptyMsg');
    if (!emptyMsg) {
        emptyMsg = document.createElement('section');
        emptyMsg.id = 'searchEmptyMsg';
        emptyMsg.className = 'empty-state empty-state-inline';
        emptyMsg.style.display = 'none';
        const nombreCategoria = categoria ? String(categoria) : 'contenido';
        emptyMsg.innerHTML = `
            <span class="empty-state-kicker">Sin resultados</span>
            <h2>No encontramos coincidencias en ${escapeHtml(nombreCategoria)}.</h2>
            <p>Probá con otro título, género o estado.</p>
        `;
        mainContainer.parentElement?.appendChild(emptyMsg);
    }

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    function getCatalogItems() {
        return Array.isArray(window.__catalogSearchItems) ? window.__catalogSearchItems : [];
    }

    function renderSuggestions(query) {
        if (!suggestionBox) return;
        const q = normalize(query);
        if (!q) {
            suggestionBox.classList.remove('is-open');
            suggestionBox.innerHTML = '';
            return;
        }

        const matches = getCatalogItems()
            .filter((entry) => normalize(entry.searchIndex || '').includes(q))
            .slice(0, 6);

        if (!matches.length) {
            suggestionBox.innerHTML = `
                <div class="catalog-suggestion empty">
                    <span class="catalog-suggestion-title">Sin sugerencias</span>
                    <span class="catalog-suggestion-meta">Probá con menos palabras o revisá el género.</span>
                </div>
            `;
            suggestionBox.classList.add('is-open');
            return;
        }

        suggestionBox.innerHTML = matches.map((entry) => `
            <a class="catalog-suggestion" href="detalle.html?cat=${encodeURIComponent(categoria)}&id=${encodeURIComponent(entry.item.id)}&nombre=${encodeURIComponent(entry.item.titulo)}">
                <span class="catalog-suggestion-title">${escapeHtml(entry.item.titulo)}</span>
                <span class="catalog-suggestion-meta">${escapeHtml(entry.item.info || entry.item.status || '')}</span>
            </a>
        `).join('');
        suggestionBox.classList.add('is-open');
    }

    function applyFilter() {
        const q = normalize(input.value);
        const cards = mainContainer.querySelectorAll('.card-container');
        const selectedGenres = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        let visible = 0;

        cards.forEach(card => {
            const indexText = normalize(card.getAttribute('data-search-index') || '');
            const genres = String(card.getAttribute('data-genres-norm') || '');
            const matchQuery = !q || indexText.includes(q);
            const genreSet = new Set(genres.split('|').filter(Boolean));
            const matchGenre = selectedGenres.length === 0 || selectedGenres.some((g) => genreSet.has(String(g)));
            const match = matchQuery && matchGenre;
            card.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        emptyMsg.style.display = (cards.length > 0 && visible === 0) ? '' : 'none';
        renderSuggestions(input.value);
    }

    input.addEventListener('input', applyFilter);
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (suggestionBox) suggestionBox.classList.remove('is-open');
        }, 180);
    });
    window.__applyCatalogFilter = applyFilter;
    applyFilter();
}


function inicializarGeneroWidgets() {
    const categoria = document.body.getAttribute('data-page');
    const sidebarHost = document.getElementById('genreSidebar');
    const drawerTab = document.getElementById('genreDrawerTab');
    const mainContainer = document.getElementById('main-container');
    if (!categoria || !mainContainer) return;
    if (!sidebarHost) return;

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '');
    }

    const counts = new Map();

    const cardGenreRows = [...mainContainer.querySelectorAll('.card-container[data-genres]')]
        .map((card) => String(card.getAttribute('data-genres') || '').split('|').map((genre) => genre.trim()).filter(Boolean))
        .filter((genres) => genres.length);

    const localList = (() => {
        if (cardGenreRows.length) return [];
        if (typeof obtenerItemsCategoria === 'function') return obtenerItemsCategoria(categoria);
        if (typeof DATOS_WEB !== 'undefined' && DATOS_WEB && Array.isArray(DATOS_WEB[categoria])) return DATOS_WEB[categoria];
        return [];
    })();

    const rows = cardGenreRows.length
        ? cardGenreRows
        : localList.map((item) => (typeof separarGeneros === 'function')
            ? separarGeneros(item?.info)
            : String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean));

    rows.forEach((genres) => {
        genres.forEach((g) => {
            const key = normalize(g);
            if (!key) return;
            counts.set(key, { label: g, count: (counts.get(key)?.count || 0) + 1 });
        });
    });

    const sorted = [...counts.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

    const max = sorted.length ? sorted[0].count : 1;
    const top = sorted.slice(0, 6);

    const filterGenres = sorted.slice(0, 18);

    const selectedKey = `ui:selectedGenres:${categoria}`;
    const selectedGenres = (() => {
        try {
            const raw = UserStore.getItem(selectedKey) || '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return [];
        }
    })();

    window.__selectedGenres = selectedGenres;

    function renderSidebar(host) {
        const openKey = `ui:genreDrawerOpen:${categoria}`;
        const isOpen = UserStore.getItem(openKey) === '1';
        const topHtml = top.length
            ? `
                <div class="genre-stats">
                    <div class="top-genres-title">Popularidad</div>
                    ${top.map((g) => {
                        const pct = Math.max(6, Math.round((g.count / max) * 100));
                        return `
                            <div class="genre-bar" role="listitem" aria-label="${g.label}">
                                <div class="genre-bar-label">${g.label}</div>
                                <div class="genre-bar-track" aria-hidden="true">
                                    <div class="genre-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <div class="genre-bar-count">${g.count}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `
            : '';

        host.innerHTML = `
            <div class="genre-sidebar-head">
                <div>
                    <div class="genre-sidebar-title">Géneros</div>
                    <div class="genre-sidebar-help">Elegí 1 o más géneros.</div>
                </div>
                <button class="genre-collapse-btn" type="button" id="toggleGenreSidebar" aria-expanded="${isOpen ? 'true' : 'false'}">
                    ${isOpen ? 'Cerrar' : 'Abrir'}
                </button>
            </div>
            ${topHtml}
            <div class="genre-filters">
                <button class="genre-chip${selectedGenres.length ? '' : ' is-active'}" type="button" data-genre="" aria-pressed="${selectedGenres.length ? 'false' : 'true'}">Todos</button>
                ${filterGenres.map((g) => {
                    const isActive = selectedGenres.includes(g.key);
                    const active = isActive ? ' is-active' : '';
                    return `<button class="genre-chip${active}" type="button" data-genre="${g.key}" aria-pressed="${isActive ? 'true' : 'false'}">${g.label}</button>`;
                }).join('')}
            </div>
            <div class="genre-actions">
                <button class="genre-clear-btn" type="button" id="clearGenres">Limpiar</button>
            </div>
        `;

        host.classList.toggle('is-open', isOpen);
        if (drawerTab) drawerTab.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        const toggleBtn = host.querySelector('#toggleGenreSidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const nextOpen = !host.classList.contains('is-open');
                host.classList.toggle('is-open', nextOpen);
                UserStore.setItem(openKey, nextOpen ? '1' : '0');
                toggleBtn.textContent = nextOpen ? 'Cerrar' : 'Abrir';
                toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                if (drawerTab) drawerTab.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            });
        }

        if (drawerTab) {
            drawerTab.addEventListener('click', () => {
                const nextOpen = !host.classList.contains('is-open');
                host.classList.toggle('is-open', nextOpen);
                UserStore.setItem(openKey, nextOpen ? '1' : '0');
                if (toggleBtn) {
                    toggleBtn.textContent = nextOpen ? 'Cerrar' : 'Abrir';
                    toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                }
                drawerTab.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            });
        }

        host.addEventListener('click', (e) => {
            const clearBtn = e.target instanceof HTMLElement ? e.target.closest('button.genre-clear-btn') : null;
            if (clearBtn) {
                window.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                return;
            }

            const btn = e.target instanceof HTMLElement ? e.target.closest('button.genre-chip') : null;
            if (!btn) return;
            const genreKey = String(btn.getAttribute('data-genre') || '');

            if (!genreKey) {
                window.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                return;
            }

            const next = new Set(Array.isArray(window.__selectedGenres) ? window.__selectedGenres : []);
            if (next.has(genreKey)) next.delete(genreKey);
            else next.add(genreKey);

            const arr = [...next];
            window.__selectedGenres = arr;
            UserStore.setItem(selectedKey, JSON.stringify(arr));

            host.querySelectorAll('button.genre-chip').forEach((b) => {
                const k = String(b.getAttribute('data-genre') || '');
                if (!k) {
                    const activeTodos = arr.length === 0;
                    b.classList.toggle('is-active', activeTodos);
                    b.setAttribute('aria-pressed', activeTodos ? 'true' : 'false');
                    return;
                }
                const active = next.has(k);
                b.classList.toggle('is-active', active);
                b.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
        }, { passive: true });
    }

    renderSidebar(sidebarHost);
}

