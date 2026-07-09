// ==========================================
// catalog/search.js
// Búsqueda en catálogo y filtros por género
// ==========================================

window.__activeStateFilter = AnimeDestiny.internals.__activeStateFilter = 'all';
window.__catalogFilters = { search: '', genres: [], isAdult: false };
var _genreWidgetsListenersAdded = false;
var _searchListenersAdded = false;


function inicializarBusquedaCatalogo() {
    const categoria = document.body.getAttribute('data-page');
    const input = document.getElementById('catalogSearch');
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
            suggestionBox.classList.remove('is-open');
            suggestionBox.innerHTML = '';
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
        const seenIds = new Set();
        section.querySelectorAll('a').forEach(a => { const m = a.href.match(/[?&]id=([^&]+)/); if (m) seenIds.add(m[1]); });

        filtered.forEach(item => {
            const rawId = String(item.id);
            if (seenIds.has(rawId)) return;
            seenIds.add(rawId);
            const id = encodeURIComponent(rawId);
            const imgUrl = item.images?.jpg?.image_url || item.images?.webp?.image_url || '';
            const title = escapeHtml(item.title || '');
            const meta = escapeHtml(item.type || item.status || '');
            const a = document.createElement('a');
            a.className = 'catalog-suggestion catalog-suggestion--api';
            a.href = `detalle.html?cat=${encodeURIComponent(String(categoria))}&id=${id}&nombre=${encodeURIComponent(String(item.title || ''))}`;
            a.innerHTML = `${imgUrl ? `<img class="catalog-suggestion-img" src="${safeUrl(imgUrl)}" alt="" loading="lazy">` : ''}<span class="catalog-suggestion-body"><span class="catalog-suggestion-title">${title}</span><span class="catalog-suggestion-meta">${escapeHtml(meta)}</span></span>`;
            section.appendChild(a);
        });

        if (!section.children.length) { if (prev) prev.remove(); return; }
        if (!prev) suggestionBox.appendChild(section);
    }

    async function fetchApiSuggestions(rawQuery) {
        const q = normalize(rawQuery);
        if (!q || q.length < 1) return;

        const prev = suggestionBox.querySelector('.catalog-suggestion-api-section');
        if (prev) prev.remove();

        try {
            let resultados = [];
            if (categoria === 'novelas' && typeof window.buscarNovelasEnApi === 'function') {
                resultados = await window.buscarNovelasEnApi(rawQuery);
            } else if (typeof window.buscarEnApi === 'function') {
                resultados = await window.buscarEnApi(rawQuery, categoria);
            }
            if ((categoria === 'manga' || categoria === 'novelas') && typeof window.fetchMangaDexPage === 'function') {
                try {
                    var mdResults = await window.fetchMangaDexPage(1, 5, [], rawQuery);
                    if (mdResults.length) {
                        resultados = window.mergeAnilistAndMd(Array.isArray(resultados) ? resultados : [], mdResults);
                    }
                } catch (_) {}
            }
            if (normalize(input.value) !== q) return;
            if (Array.isArray(resultados) && resultados.length) {
                renderApiSuggestions(rawQuery, resultados);
            }
        } catch (e) {
            // ignore
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

    // ── Guard: prevent duplicate listeners on repeated calls ──
    if (_searchListenersAdded) {
        applyFilter();
        return;
    }
    _searchListenersAdded = true;

    // ── Input: local filter + API suggestions ──
    input.addEventListener('input', () => {
        applyFilter();
        debouncedApiSearch();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            reloadCatalog();
        }
    });
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (suggestionBox) suggestionBox.classList.remove('is-open');
        }, 180);
    });

    var searchIcon = inputWrap?.querySelector('.catalog-search-icon');
    if (searchIcon) {
        searchIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            reloadCatalog();
        });
    }

    // ── Filter block ──
    const filterToggle = document.getElementById('mainFilterToggle');
    const filterDropdown = document.getElementById('filterDropdown');

    function showFilter(show) {
        filterDropdown.style.display = show ? '' : 'none';
        if (filterToggle) {
            filterToggle.classList.toggle('is-active', show);
            filterToggle.setAttribute('aria-expanded', String(show));
        }
    }

    if (filterToggle && filterDropdown) {
        filterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            showFilter(filterDropdown.style.display === 'none');
        });
        
        document.addEventListener('click', (e) => {
            if (filterDropdown.style.display === 'none') return;
            if (!filterToggle.contains(e.target) && !filterDropdown.contains(e.target)) {
                showFilter(false);
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
                    showFilter(false);
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
        if (typeof obtenerItemsCategoria === 'function') {
            var result = obtenerItemsCategoria(categoria);
            return Array.isArray(result) ? result : [];
        }
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

    var fixedGenres = (function () {
        var base = [
            'Action','Adventure','Comedy','Drama','Fantasy','Horror',
            'Mystery','Romance','Sci-Fi','Slice of Life','Sports',
            'Supernatural','Thriller','Psychological','Tragedy',
            'Magic','Mythology','Parody','Satire',
            'Superhero','Demons','Vampire','Zombie','Ghost','Aliens',
            'Post-Apocalyptic','Cyberpunk','Steampunk',
            'Reincarnation','Time Travel',
            'Harem','School','Military','Martial Arts',
            'Ninja','Samurai','Pirates','Mafia','Survival',
            'Music','Idol','Band',
            'Detective','Espionage','Noir','Crime',
            'War','Guns','Swordplay',
            'Revenge','Amnesia','Gambling',
            'Cultivation','Villainess','Anti-Hero',
            'Work','Medicine','Politics',
            'Family Life','Love Triangle',
            'Battle Royale','Dystopian',
            'Female Protagonist','Male Protagonist',
            'Ensemble Cast',
            'Food','Historical'
        ];
        var animes = base.concat([
            'Shounen','Shoujo','Seinen','Josei',
            'Ecchi','Gore',
            'Isekai','Mecha',
            'Police',
            'Mahou Shoujo',
            'Monster Girl','Animals',
            'Space','Space Opera','Urban Fantasy',
            'Crossdressing','Gender Bending',
            'Fairy Tale',
            'Fitness','Swimming',
            'Video Games','Virtual World',
            'Tokusatsu',
            'Delinquents','Gyaru',
            'Rehabilitation','Fugitive',
            'Trains','Ships','Motorcycles','Tanks',
            'Photography','Drawing','Calligraphy',
            'Incest',
            'Hikikomori','Otaku Culture','Chuunibyou',
            'Chibi','Nekomimi','Youkai','Kaiju',
            'Iyashikei','Denpa',
            'Real Robot','Super Robot','Robots',
            'Lost Civilization','Rural','Urban',
            'Witch','Werewolf','Dragon','Skeleton',
            'Primarily Adult Cast',
            'Slavery',
            'Boys\' Love','LGBTQ+ Themes',
            'Office','Economics','Philosophy',
            'Surreal Comedy','Time Manipulation',
            'Found Family',
            'Card Battle'
        ]);
        var mangas = base.concat([
            'Shounen','Shoujo','Seinen','Josei',
            'Ecchi','Gore',
            'Isekai','Mecha',
            'Police',
            'Medical','Wuxia',
            'Mahou Shoujo',
            'Monster Girl','Monster Girls','Animals',
            'Space','Space Opera','Urban Fantasy',
            'Crossdressing','Gender Bending','Genderswap',
            'Fairy Tale',
            'Fitness','Swimming',
            'Video Games','Virtual World','Virtual Reality',
            'Tokusatsu',
            'Delinquents','Gyaru',
            'Rehabilitation','Fugitive',
            'Trains','Ships','Motorcycles','Tanks',
            'Photography','Drawing','Calligraphy',
            'Incest','Loli','Shota',
            'Hikikomori','Otaku Culture','Chuunibyou',
            'Chibi','Nekomimi','Youkai','Kaiju',
            'Iyashikei','Denpa',
            'Real Robot','Super Robot','Robots',
            'Lost Civilization','Rural','Urban',
            'Witch','Werewolf','Dragon','Skeleton',
            'Primarily Adult Cast',
            'Slavery',
            '4-koma','Full Color','Long Strip','Anthology',
            'Doujinshi','Web Comic','Self-Published',
            'Award Winning','Adaptation',
            'School Life',
            'Reverse Harem',
            'Girls\' Love',
            'Cooking',
            'Office Workers','Office','Economics','Philosophy',
            'Surreal Comedy','Time Manipulation',
            'Found Family',
            'Card Battle','Traditional Games'
        ]);
        var novelas = base.concat([
            'Gore','Isekai',
            'Police',
            'Monster Girl','Monster Girls',
            'Space','Space Opera','Urban Fantasy',
            'Demons','Vampire','Ghost','Aliens',
            'Survival',
            'Crime',
            'Revenge','Amnesia','Gambling',
            'Superhero',
            'School','Martial Arts',
            'Ninja',
            'Delinquents','Gyaru',
            'Witch','Werewolf','Dragon',
            'Slavery','Rehabilitation','Fugitive',
            'Hikikomori','Otaku Culture',
            'Boys\' Love','Girls\' Love','LGBTQ+ Themes',
            'Office Workers','Office','Economics','Philosophy',
            'Found Family',
            'Card Battle',
            'Idol','Band',
            'Video Games','Virtual World','Virtual Reality',
            'Female Protagonist','Male Protagonist',
            'Family Life','Love Triangle',
            'Dystopian',
            'Historical',
            'School Life',
            'Reverse Harem',
            'Award Winning','Adaptation',
            'Cooking'
        ]);
        if (categoria === 'anime') return animes;
        if (categoria === 'novelas') return novelas;
        return mangas;
    })();
    fixedGenres.forEach(function(g) {
        var key = normalize(g);
        if (!counts.has(key)) {
            counts.set(key, { label: g, count: 0 });
        }
    });

    const sorted = [...counts.entries()]
        .map(([key, v]) => ({ key, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

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

    const clearBtn = document.getElementById('clearFiltersBtn');

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

            renderDropdownGenres();
            // Trigger server reload instead of local filter
            if (typeof window.__reloadCatalog === 'function') window.__reloadCatalog();
        });
    }
}

