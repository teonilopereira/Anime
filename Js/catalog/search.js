// ==========================================
// catalog/search.js
// Búsqueda en catálogo y filtros por género
// ==========================================

window.__activeStateFilter = AnimeDestiny.internals.__activeStateFilter = 'all';
window.__catalogFilters = { search: '', genres: [], isAdult: false };
var _genreWidgetsListenersAdded = false;


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
            .slice(0, AnimeDestiny.Constants.SUGGESTION_LIMIT || 6);

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
        const stateFilter = window.__activeStateFilter || 'all';
        const uid = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'Invitado';
        
        // Optimize: read DOM state once instead of inside card loop
        const nsfwToggle = document.getElementById('nsfwToggle');
        const nsfwEnabled = !!(nsfwToggle && nsfwToggle.checked);
        
        // Optimize: build Sets for state filters to avoid per-card UserStore lookup overhead
        const favSet = new Set();
        const viewedSet = new Set();
        if (stateFilter !== 'all') {
            const prefix = `u:${uid}|item:`;
            try {
                const keys = UserStore.keys();
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    if (!k || !k.startsWith(prefix) || !UserStore.getItem(k)) continue;
                    if (k.endsWith('|fav'))         favSet.add(k.slice(prefix.length, k.length - 4));
                    else if (k.endsWith('|viewed')) viewedSet.add(k.slice(prefix.length, k.length - 7));
                }
            } catch (_) {}
        }
        
        let visible = 0;

        cards.forEach(card => {
            const indexText = normalize(card.getAttribute('data-search-index') || '');
            const matchQuery = !q || indexText.includes(q);
            
            if (!matchQuery) {
                card.style.display = 'none';
                return;
            }

            const genres = card.getAttribute('data-genres-norm');
            const genreArr = genres ? genres.split('|') : [];
            const matchGenre = selectedGenres.length === 0 || selectedGenres.some((g) => genreArr.includes(String(g)));
            
            if (!matchGenre) {
                card.style.display = 'none';
                return;
            }

            // If NSFW is disabled, hide cards that have 'Adult' genre
            const genresList = genreArr.map(g => g.toLowerCase());
            const isAdult = genresList.includes('adult');
            const matchNsfw = nsfwEnabled || !isAdult;
            let matchStateFlag = true;
            
            if (stateFilter !== 'all') {
                const itemId = card.getAttribute('data-item-id');
                if (itemId) {
                    if (stateFilter === 'watched') matchStateFlag = viewedSet.has(itemId);
                    else if (stateFilter === 'unwatched') matchStateFlag = !viewedSet.has(itemId);
                    else if (stateFilter === 'fav') matchStateFlag = favSet.has(itemId);
                }
            }
            // Combine state, genre, and NSFW filters
            const finalMatch = matchStateFlag && matchGenre && matchNsfw;
            if (finalMatch) {
                card.style.display = '';
                visible++;
            } else {
                card.style.display = 'none';
            }
        });

        emptyMsg.style.display = (cards.length > 0 && visible === 0) ? '' : 'none';
        renderSuggestions(input.value);
    }

    // ── API Suggestions (debounced, AniList + MangaDex) ──
    let apiSearchTimer = null;
    let lastApiQuery = '';

    function renderApiSuggestions(rawQuery, items) {
        if (!suggestionBox) return;
        const q = normalize(rawQuery);
        if (!q) return;

        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        const filtered = items.filter(item => normalize(item.title || '').includes(q)).slice(0, AnimeDestiny.Constants.API_SUGGESTION_LIMIT || 8);
        if (!filtered.length) { if (prev) prev.remove(); return; }

        const section = prev || document.createElement('div');
        section.className = 'catalog-suggestion-api-section';

        let html = '<div class="catalog-suggestion-api-header">Relacionados</div>';
        filtered.forEach(item => {
            const imgUrl = item.images?.jpg?.image_url || item.images?.webp?.image_url || '';
            const id = encodeURIComponent(String(item.id));
            const title = escapeHtml(item.title || '');
            const meta = escapeHtml(item.type || item.status || '');
            html += `
                <a class="catalog-suggestion catalog-suggestion--api" href="detalle.html?cat=${encodeURIComponent(String(categoria))}&id=${id}&nombre=${encodeURIComponent(String(item.title || ''))}">
                    ${imgUrl ? `<img class="catalog-suggestion-img" src="${safeUrl(imgUrl)}" alt="" loading="lazy">` : ''}
                    <span class="catalog-suggestion-body">
                        <span class="catalog-suggestion-title">${title}</span>
                        <span class="catalog-suggestion-meta">${escapeHtml(meta)}</span>
                    </span>
                </a>`;
        });

        section.innerHTML = html;
        if (!prev) suggestionBox.appendChild(section);
    }

    async function fetchApiSuggestions(rawQuery) {
        const q = normalize(rawQuery);
        if (!q || q.length < 1) return;

        const loading = document.createElement('div');
        loading.className = 'catalog-suggestion-api-section';
        loading.id = 'catalogSearchLoading';
        loading.innerHTML = '<div class="catalog-suggestion-api-header">Buscando…</div>';
        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        if (prev) prev.remove();
        suggestionBox.appendChild(loading);

        try {
            let resultados;
            if (categoria === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
                resultados = await window.buscarNovelasEnApi(rawQuery);
            } else if (typeof window.buscarEnApi === 'function') {
                resultados = await window.buscarEnApi(rawQuery, categoria);
            } else {
                resultados = [];
            }
            const loadingEl = document.getElementById('catalogSearchLoading');
            if (loadingEl) loadingEl.remove();
            if (normalize(input.value) !== q) return;
            if (Array.isArray(resultados) && resultados.length) {
                renderApiSuggestions(rawQuery, resultados);
            }
        } catch (e) {
            const loadingEl = document.getElementById('catalogSearchLoading');
            if (loadingEl) loadingEl.remove();
        }
    }

    function debouncedApiSearch() {
        if (apiSearchTimer) clearTimeout(apiSearchTimer);
        const q = input.value;
        lastApiQuery = q;
        if (!normalize(q)) {
            const s = suggestionBox?.querySelector('.catalog-suggestion-api-section');
            if (s) s.remove();
            return;
        }
        apiSearchTimer = setTimeout(() => {
            if (lastApiQuery === input.value) fetchApiSuggestions(input.value);
        }, AnimeDestiny.Constants.SEARCH_DEBOUNCE_MS || 400);
    }

    window.__applyCatalogFilter = AnimeDestiny.internals.__applyCatalogFilter = applyFilter;

    // ── Server-side reload when filters change ──
    function reloadCatalog() {
        const cat = document.body.getAttribute('data-page');
        const usaApi = cat === 'anime' || cat === 'manga' || cat === 'novelas';
        if (!usaApi) { applyFilter(); return; }

        // Update global filter state
        const nsfwCheck = document.getElementById('nsfwToggle');
        window.__catalogFilters = {
            search: input.value.trim() || '',
            genres: Array.isArray(window.__selectedGenres) ? [...window.__selectedGenres] : [],
            isAdult: nsfwCheck ? nsfwCheck.checked : false
        };

        // Reset pagination and reload
        if (typeof resetInfiniteScroll === 'function') resetInfiniteScroll();
        mainContainer.innerHTML = '';
        if (typeof currentPage !== 'undefined') currentPage = 1;
        if (typeof hasMorePages !== 'undefined') hasMorePages = true;
        cargarCatalogoDesdeApi(cat, mainContainer, 1, false);
    }
    window.__reloadCatalog = reloadCatalog;

    // ── Debounced search → server ──
    let searchReloadTimer = null;
    input.addEventListener('input', () => {
        // Always do local filter for instant feedback
        applyFilter();
        // Also do suggestion dropdown
        debouncedApiSearch();
        // Debounced server reload
        if (searchReloadTimer) clearTimeout(searchReloadTimer);
        searchReloadTimer = setTimeout(() => {
            reloadCatalog();
        }, 600);
    });
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (suggestionBox) suggestionBox.classList.remove('is-open');
        }, 180);
    });

    // ── Filter block ──
    const filterToggle = document.getElementById('filterToggle');
    const filterDropdown = document.getElementById('filterDropdown');

    if (filterToggle && filterDropdown) {
        filterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const next = filterDropdown.hidden;
            filterDropdown.hidden = !next;
            filterToggle.classList.toggle('is-active', !next);
            filterToggle.setAttribute('aria-expanded', !next);
        });
        
        document.addEventListener('click', (e) => {
            if (filterDropdown.hidden) return;
            if (!filterToggle.contains(e.target) && !filterDropdown.contains(e.target)) {
                filterDropdown.hidden = true;
                filterToggle.classList.remove('is-active');
                filterToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (filterDropdown) {
        filterDropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.filter-option');
            if (option) {
                const filter = option.getAttribute('data-filter');
                if (!filter) return;
                window.__activeStateFilter = AnimeDestiny.internals.__activeStateFilter = filter;
                filterDropdown.querySelectorAll('.filter-option').forEach((b) => {
                    b.classList.toggle('is-active', b.getAttribute('data-filter') === filter);
                });
                applyFilter();
                if (filterToggle && !filterToggle.classList.contains('inline-filter-mode')) {
                    filterDropdown.hidden = true;
                    filterToggle.classList.remove('is-active');
                    filterToggle.setAttribute('aria-expanded', 'false');
                }
                return;
            }
        });
    }

    // ── NSFW toggle → server reload ──
    const nsfwCheckbox = document.getElementById('nsfwToggle');
    if (nsfwCheckbox) {
        nsfwCheckbox.addEventListener('change', () => {
            reloadCatalog();
        });
    }

    applyFilter();
}


function inicializarGeneroWidgets() {
    const categoria = document.body.getAttribute('data-page');
    const sidebarHost = document.getElementById('genreSidebar');
    const drawerTab = document.getElementById('genreDrawerTab');
    const mainContainer = document.getElementById('main-container');
    if (!categoria || !mainContainer) return;

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
        return [];
    })();

    const rows = cardGenreRows.length
        ? cardGenreRows
        : localList.map((item) => String(item?.info || '').split('/').map(s => s.trim()).filter(Boolean));

    rows.forEach((genres) => {
        genres.forEach((g) => {
            const key = normalize(g);
            if (!key) return;
            counts.set(key, { label: g, count: (counts.get(key)?.count || 0) + 1 });
        });
    });

    // ── Géneros fijos: unión completa de AniList + MangaDex ──
    // Demografía
    // AniList géneros (GenreCollection)
    // MangaDex géneros + temas
    // AniList tags populares (MediaTagCollection)
    var fixedGenres = [
        // ── Demografía ──
        'Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kodomo', 'Adult',
        // ── Géneros principales (AniList + MangaDex) ──
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
        'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
        'Supernatural', 'Thriller', 'Ecchi', 'Psychological', 'Tragedy',
        'Suspense',
        // ── Géneros MangaDex ──
        'Crime', 'Historical', 'Medical', 'Philosophical', 'Wuxia',
        'Superhero', 'Magical Girls', 'Mahou Shoujo',
        // ── Temas comunes (AniList + MangaDex) ──
        'Isekai', 'Mecha', 'Music', 'Harem', 'Reverse Harem',
        'School', 'School Life', 'Military', 'Police', 'Martial Arts',
        'Demons', 'Vampires', 'Zombies', 'Ghosts', 'Monsters',
        'Monster Girls', 'Aliens', 'Animals', 'Ninja', 'Samurai',
        'Pirates', 'Mafia', 'Delinquents', 'Gyaru', 'Survival',
        'Post-Apocalyptic', 'Cyberpunk', 'Steampunk', 'Space',
        'Space Opera', 'Urban Fantasy', 'Gore',
        // ── Temas AniList ──
        'Reincarnation', 'Time Travel', 'Time Manipulation',
        'Genderswap', 'Crossdressing', 'Gender Bending',
        'Magic', 'Mythology', 'Fairy Tale',
        'Parody', 'Satire', 'Surreal Comedy',
        'Cooking', 'Food', 'Fitness', 'Swimming',
        'Video Games', 'Virtual World', 'Virtual Reality',
        'Idol', 'Band', 'Musical',
        'Detective', 'Espionage', 'Noir',
        'War', 'Terrorism', 'Guns', 'Swordplay',
        'Revenge', 'Amnesia', 'Gambling',
        'Cultivation', 'Villainess', 'Anti-Hero',
        'Boys\' Love', 'Girls\' Love', 'LGBTQ+ Themes',
        'Incest', 'Loli', 'Shota',
        'Hikikomori', 'Otaku Culture', 'Chuunibyou',
        'Chibi', 'Nekomimi', 'Youkai', 'Kaiju',
        'Iyashikei', 'Denpa', 'Tokusatsu',
        'Work', 'Office Workers', 'Economics',
        'Medicine', 'Philosophy', 'Politics',
        'Family Life', 'Found Family', 'Love Triangle',
        'Battle Royale', 'Card Battle', 'Traditional Games',
        'Robots', 'Real Robot', 'Super Robot',
        'Dystopia', 'Lost Civilization', 'Rural', 'Urban',
        'Superhero', 'Witch', 'Werewolf', 'Vampire',
        'Dragon', 'Skeleton',
        'Female Protagonist', 'Male Protagonist',
        'Ensemble Cast', 'Primarily Adult Cast',
        'Slavery', 'Rehabilitation', 'Fugitive',
        'Trains', 'Ships', 'Motorcycles', 'Tanks',
        'Photography', 'Drawing', 'Calligraphy',
        // ── Formato y Origen ──
        'Manga', 'Manhwa', 'Manhua', 'Doujinshi', 'One-shot', 'Novela',
        'TV', 'OVA', 'ONA', 'Movie', 'Special',
        'Oneshot', '4-Koma', 'Full Color', 'Long Strip',
        'Web Comic', 'Anthology', 'Adaptation',
        'Award Winning', 'Self-Published',
        // ── Extra / Custom ──
        'Fanfic'
    ];
    fixedGenres.forEach(function(g) {
        var key = normalize(g);
        if (!counts.has(key)) {
            counts.set(key, { label: g, count: 0 });
        }
    });

    const sorted = [...counts.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

    const max = sorted.length ? sorted[0].count : 1;
    const top = sorted.slice(0, 6);

    const filterGenres = sorted;

    const selectedKey = `ui:selectedGenres:${categoria}`;
    const selectedGenres = (() => {
        try {
            const raw = UserStore.getItem(selectedKey) || '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch { return []; }
    })();

    window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = selectedGenres;

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
                window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
                else if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                if (typeof renderDropdownGenres === 'function') renderDropdownGenres();
                return;
            }

            const btn = e.target instanceof HTMLElement ? e.target.closest('button.genre-chip') : null;
            if (!btn) return;
            const genreKey = String(btn.getAttribute('data-genre') || '');

            if (!genreKey) {
                window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
                UserStore.setItem(selectedKey, JSON.stringify([]));
                host.querySelectorAll('button.genre-chip').forEach((b) => {
                    const isTodos = String(b.getAttribute('data-genre') || '') === '';
                    b.classList.toggle('is-active', isTodos);
                    b.setAttribute('aria-pressed', isTodos ? 'true' : 'false');
                });
                if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
                else if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
                if (typeof renderDropdownGenres === 'function') renderDropdownGenres();
                return;
            }

            const next = new Set(Array.isArray(window.__selectedGenres) ? window.__selectedGenres : []);
            if (next.has(genreKey)) next.delete(genreKey);
            else next.add(genreKey);

            const arr = [...next];
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = arr;
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

            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
            else if (typeof window.__applyCatalogFilter === 'function') window.__applyCatalogFilter();
            if (typeof renderDropdownGenres === 'function') renderDropdownGenres();
        }, { passive: true });
    }

    if (sidebarHost) {
        renderSidebar(sidebarHost);
    }

    // ── Populate dropdown genre chips ──
    const filterGenresContainer = document.getElementById('filterGenres');

    function renderDropdownGenres() {
        if (!filterGenresContainer) return;
        const arr = Array.isArray(window.__selectedGenres) ? window.__selectedGenres : [];
        filterGenresContainer.innerHTML = filterGenres.map((g) => {
            const active = arr.includes(g.key) ? ' is-active' : '';
            return `<button class="ff-genre-chip${active}" type="button" data-genre="${g.key}" aria-pressed="${active ? 'true' : 'false'}">${g.label}</button>`;
        }).join('');
    }

    // Expose globally so external code (e.g. on scroll-append) can sync chips
    window.__renderDropdownGenres = renderDropdownGenres;

    // Guard: add event listeners only ONCE — prevents duplicate handlers
    // on subsequent calls from cargarCatalogoDesdeApi / reloadCatalog
    if (_genreWidgetsListenersAdded) {
        if (filterGenresContainer && filterGenres.length) renderDropdownGenres();
        return;
    }
    _genreWidgetsListenersAdded = true;

    const toggleBtn = document.getElementById('mainFilterToggle');
    const dropdownDiv = document.getElementById('filterDropdown');
    const clearBtn = document.getElementById('clearFiltersBtn');

    if (toggleBtn && dropdownDiv) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = dropdownDiv.style.display === 'none' || dropdownDiv.style.display === '';
            dropdownDiv.style.display = isHidden ? 'block' : 'none';
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = [];
            UserStore.setItem(selectedKey, JSON.stringify([]));
            renderDropdownGenres();
            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
        });
    }

    if (filterGenresContainer && filterGenres.length) {
        renderDropdownGenres();

        filterGenresContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.ff-genre-chip');
            if (!chip) return;
            const genreKey = String(chip.getAttribute('data-genre') || '');
            if (!genreKey) return;

            const next = new Set(Array.isArray(window.__selectedGenres) ? window.__selectedGenres : []);
            if (next.has(genreKey)) next.delete(genreKey);
            else next.add(genreKey);
            const arr = [...next];
            window.__selectedGenres = AnimeDestiny.internals.__selectedGenres = arr;
            UserStore.setItem(selectedKey, JSON.stringify(arr));

            // Sync sidebar chips
            const sidebar = document.getElementById('genreSidebar');
            if (sidebar) {
                sidebar.querySelectorAll('button.genre-chip').forEach((b) => {
                    const k = String(b.getAttribute('data-genre') || '');
                    if (!k) {
                        b.classList.toggle('is-active', arr.length === 0);
                        b.setAttribute('aria-pressed', arr.length === 0 ? 'true' : 'false');
                        return;
                    }
                    const active = arr.includes(k);
                    b.classList.toggle('is-active', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
            }

            renderDropdownGenres();
            // Trigger server reload instead of local filter
            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
        });
    }
}

