/**
 * genres.js — Catálogo de géneros y tags de los filtros de anime/manga/novelas.
 *
 * Única fuente para:
 *  - los géneros oficiales de AniList (van en genre_in; el resto es tag_in);
 *  - los chips que ofrece cada catálogo;
 *  - el nombre exacto con el que AniList conoce cada tag. Los chips guardan
 *    la clave normalizada ("girls' love") y a AniList hay que mandarle el
 *    nombre tal cual ("Girls' Love").
 *
 * Las listas de abajo son el respaldo. Al abrir un catálogo se pide a AniList
 * su colección real de géneros y tags (una vez por semana, queda en
 * localStorage): con eso se descartan los chips que AniList no conoce (salvo
 * en manga/novelas si MangaDex sí los tiene), se toma el nombre correcto y se
 * ocultan los tags +18 cuando el filtro NSFW está apagado.
 */
(function () {
    "use strict";

    var ANILIST_ENDPOINT = 'https://graphql.anilist.co';
    var CACHE_KEY = 'genres:anilist:v1';
    var CACHE_TTL = 7 * 24 * 3600 * 1000;
    var TIMEOUT = 8000;
    // Tras un fallo no se reintenta enseguida: inicializarGeneroWidgets corre
    // en cada página de cards y repetiría el pedido una y otra vez.
    var REINTENTO = 10 * 60 * 1000;

    // Géneros oficiales de AniList: los únicos que acepta genre_in.
    var OFICIALES = Object.freeze([
        'Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Hentai','Horror',
        'Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance',
        'Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'
    ]);

    // No se ofrecen como chip en ningún caso.
    var NUNCA = ['Hentai'];
    // Tags de MangaDex sin equivalente en AniList (que marca isAdult solo a
    // los suyos): se ocultan igual que los +18 de AniList.
    var ADULTOS_MANGADEX = ['Loli','Shota'];

    var BASE = [
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

    var EXTRA = {
        anime: [
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
            'Girls\' Love','Reverse Harem',
            'Wuxia',
            'Office','Economics','Philosophy',
            'Surreal Comedy','Time Manipulation',
            'Found Family',
            'Card Battle','Traditional Games',
            'Award Winning'
        ],
        manga: [
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
            'Boys\' Love','Girls\' Love','LGBTQ+ Themes',
            'Cooking',
            'Office Workers','Office','Economics','Philosophy',
            'Surreal Comedy','Time Manipulation',
            'Found Family',
            'Card Battle','Traditional Games'
        ],
        novelas: [
            'Shounen','Shoujo','Seinen','Josei',
            'Ecchi','Gore',
            'Isekai','Mecha','Wuxia',
            'Police','Medical',
            'Mahou Shoujo',
            'Monster Girl','Monster Girls','Animals',
            'Space','Space Opera','Urban Fantasy',
            'Crossdressing','Gender Bending',
            'Fairy Tale','Youkai',
            'Delinquents','Gyaru',
            'Witch','Werewolf','Dragon',
            'Slavery','Rehabilitation','Fugitive',
            'Hikikomori','Otaku Culture',
            'Iyashikei','Primarily Adult Cast',
            'Boys\' Love','Girls\' Love','LGBTQ+ Themes',
            'Office Workers','Office','Economics','Philosophy',
            'Time Manipulation',
            'Found Family',
            'Card Battle',
            'Video Games','Virtual World','Virtual Reality',
            'School Life',
            'Reverse Harem',
            'Award Winning','Adaptation',
            'Cooking'
        ]
    };

    // Clave de comparación: sin mayúsculas, acentos, espacios, guiones ni
    // apóstrofos ("Girls' Love" y "girls love" son el mismo tag).
    function compacta(value) {
        return String(value == null ? '' : value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[\s\-'’]/g, '');
    }

    var oficialPorClave = new Map();
    OFICIALES.forEach(function (g) { oficialPorClave.set(compacta(g), g); });

    var respaldoPorClave = new Map();
    BASE.concat(EXTRA.anime, EXTRA.manga, EXTRA.novelas).forEach(function (g) {
        var k = compacta(g);
        if (!respaldoPorClave.has(k)) respaldoPorClave.set(k, g);
    });

    // { genres: Map<clave, nombre>, tags: Map<clave, {name, isAdult}> } o null.
    var remoto = null;
    var cargando = null;
    var falloEn = 0;

    function usarColeccion(data) {
        if (!data || !Array.isArray(data.genres) || !Array.isArray(data.tags) || !data.tags.length) return false;
        var genres = new Map();
        data.genres.forEach(function (g) { genres.set(compacta(g), g); });
        var tags = new Map();
        data.tags.forEach(function (t) {
            if (t && t.name) tags.set(compacta(t.name), { name: t.name, isAdult: !!t.isAdult });
        });
        remoto = { genres: genres, tags: tags };
        return true;
    }

    function leerCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return parsed && parsed.data ? parsed : null;
        } catch (_) { return null; }
    }

    (function () {
        var c = leerCache();
        if (c && c.expiry > Date.now()) usarColeccion(c.data);
    })();

    /**
     * Trae de AniList la colección de géneros y tags. Resuelve true si quedó
     * disponible (de la red o de una copia vencida como respaldo), false si no
     * hay nada y se siguen usando las listas fijas. Nunca rechaza.
     */
    function cargar() {
        if (remoto) return Promise.resolve(true);
        if (cargando) return cargando;
        if (typeof fetch !== 'function') return Promise.resolve(false);
        if (falloEn && Date.now() - falloEn < REINTENTO) return Promise.resolve(false);

        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT) : null;

        cargando = fetch(ANILIST_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: '{ GenreCollection MediaTagCollection { name isAdult } }' }),
            signal: controller ? controller.signal : undefined
        }).then(function (res) {
            if (!res.ok) throw new Error('AniList HTTP ' + res.status);
            return res.json();
        }).then(function (json) {
            var d = json && json.data;
            var data = d ? {
                genres: d.GenreCollection || [],
                tags: (d.MediaTagCollection || []).map(function (t) { return { name: t.name, isAdult: !!t.isAdult }; })
            } : null;
            if (!usarColeccion(data)) throw new Error('Colección de géneros vacía');
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, expiry: Date.now() + CACHE_TTL }));
            } catch (_) { /* sin espacio: queda en memoria */ }
            return true;
        }).catch(function () {
            falloEn = Date.now();
            var c = leerCache();
            return !!(c && usarColeccion(c.data));
        }).finally(function () {
            if (timer) clearTimeout(timer);
            cargando = null;
        });
        return cargando;
    }

    function esOficial(nombreOClave) {
        return oficialPorClave.has(compacta(nombreOClave));
    }

    /** Nombre con el que AniList conoce un género/tag (o el mejor que haya). */
    function nombre(nombreOClave) {
        var k = compacta(nombreOClave);
        if (oficialPorClave.has(k)) return oficialPorClave.get(k);
        if (remoto) {
            if (remoto.genres.has(k)) return remoto.genres.get(k);
            if (remoto.tags.has(k)) return remoto.tags.get(k).name;
        }
        if (respaldoPorClave.has(k)) return respaldoPorClave.get(k);
        return String(nombreOClave == null ? '' : nombreOClave);
    }

    /** Separa claves de chips en { genres, tags } con el nombre de AniList. */
    function separar(claves) {
        var genres = [];
        var tags = [];
        (claves || []).forEach(function (g) {
            var k = compacta(g);
            if (!k) return;
            if (oficialPorClave.has(k)) genres.push(oficialPorClave.get(k));
            else tags.push(nombre(g));
        });
        return { genres: genres, tags: tags };
    }

    function tieneMangaDex(nombreTag) {
        return typeof window.mdTagUuidsFromKeys === 'function' &&
            window.mdTagUuidsFromKeys([nombreTag]).length > 0;
    }

    /**
     * Chips que ofrece un catálogo, ya ordenados: primero los géneros oficiales
     * y después los tags, cada grupo en orden alfabético.
     * Devuelve [{ label, oficial }].
     */
    function paraCategoria(categoria, adulto) {
        var extra = EXTRA[categoria] || EXTRA.manga;
        var usaMangaDex = categoria === 'manga' || categoria === 'novelas';
        var vistos = new Set();
        var lista = [];

        OFICIALES.concat(BASE, extra).forEach(function (g) {
            var k = compacta(g);
            if (vistos.has(k)) return;
            vistos.add(k);
            if (NUNCA.indexOf(g) !== -1) return;
            if (!adulto && ADULTOS_MANGADEX.indexOf(g) !== -1) return;

            var oficial = oficialPorClave.has(k);
            var label = g;
            if (remoto && !oficial) {
                var tag = remoto.tags.get(k);
                if (tag) {
                    if (tag.isAdult && !adulto) return;
                    label = tag.name;
                } else if (remoto.genres.has(k)) {
                    label = remoto.genres.get(k);
                } else if (!(usaMangaDex && tieneMangaDex(g))) {
                    // AniList no lo conoce y no hay MangaDex que lo cubra:
                    // el chip filtraría a cero resultados.
                    return;
                }
            }
            lista.push({ label: label, oficial: oficial });
        });

        return ordenar(lista);
    }

    function ordenar(lista) {
        return lista.slice().sort(function (a, b) {
            if (a.oficial !== b.oficial) return a.oficial ? -1 : 1;
            return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
        });
    }

    window.AnimeDestiny = window.AnimeDestiny || {};
    window.AnimeDestiny.Genres = {
        OFICIALES: OFICIALES,
        cargar: cargar,
        listo: function () { return !!remoto; },
        esOficial: esOficial,
        nombre: nombre,
        separar: separar,
        paraCategoria: paraCategoria,
        ordenar: ordenar
    };
})();
