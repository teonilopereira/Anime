// js/core/api-mangadex.js
// Cliente de MangaDex, extraído de js/core/api.js. Es su propio IIFE, con el
// mapa de tags, el fetch HTTP y los helpers de tarjeta/merge. Se expone en
// window lo que consumen otros módulos (mangadex-api.js, catalog/search.js,
// pages/comparar.js) y lo que api.js necesita para suplementar el catálogo
// (mdTagUuidsFromKeys, fetchMangaDexPage, mergeAnilistAndMd).
//
// Va en el bundle junto a api.js. Como api.js solo llama a estas funciones en
// tiempo de ejecución (dentro de getTopMangas/getTopNovelas), el orden de carga
// entre ambos no afecta la corrección.
(function () {
    "use strict";

    // Mismo timeout que usa api.js; se deriva de las constantes en vez de
    // depender del IIFE de api.js.
    var REQUEST_TIMEOUT = AnimeDestiny.Constants.REQUEST_TIMEOUT_MS || 12000;

    var MD_TAG_UUIDS = {
        '4-koma':'b11fda93-8f1d-4bef-b2ed-8803d3733170','action':'391b0423-d847-456f-aff0-8b0cfc03066b',
        'adaptation':'f4122d1c-3b44-44d0-9936-ff7502c39ad3','adventure':'87cc87cd-a395-47af-b27a-93258283bbc6',
        'aliens':'e64f6742-c834-471d-8d72-dd51fc02b835','animals':'3de8c75d-8ee3-48ff-98ee-e20a65c86451',
        'anthology':'51d83883-4103-437c-b4b1-731cb73d786c','award winning':'0a39b5a1-b235-4886-a747-1d05d216532d',
        'boys\' love':'5920b825-4181-4a17-beeb-9918b0ff7a30','comedy':'4d32cc48-9f00-4cca-9b5a-a839f0764984',
        'cooking':'ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869','crime':'5ca48985-9a9d-4bd8-be29-80dc0303db72',
        'crossdressing':'9ab53f92-3eed-4e9b-903a-917c86035ee3','delinquents':'da2d50ca-3018-4cc0-ac7a-6b7d472a29ea',
        'demons':'39730448-9a5f-48a2-85b0-a70db87b1233','doujinshi':'b13b2a48-c720-44a9-9c77-39c9979373fb',
        'drama':'b9af3a63-f058-46de-a9a0-e0c13906197a','fantasy':'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
        'full color':'f5ba408b-0e7a-484d-8d49-4e9125ac96de','genderswap':'2bd2e8d0-f146-434a-9b51-fc9ff2c5fe6a',
        'ghost':'3bb26d85-09d5-4d2e-880c-c34b974339e9','ghosts':'3bb26d85-09d5-4d2e-880c-c34b974339e9',
        'girls\' love':'a3c67850-4684-404e-9b7f-c69850ee5da6','gore':'b29d6a3d-1569-4e7a-8caf-7557bc92cd5d',
        'gyaru':'fad12b5e-68ba-460e-b933-9ae8318f5b65','harem':'aafb99c1-7f60-43fa-b75f-fc9502ce29c7',
        'historical':'33771934-028e-4cb3-8744-691e866a923e','horror':'cdad7e68-1419-41dd-bdce-27753074a640',
        'incest':'5bd0e105-4481-44ca-b6e7-7544da56b1a3','isekai':'ace04997-f6bd-436e-b261-779182193d3d',
        'loli':'2d1f5d56-a1e5-4d0d-a961-2193588b08ec','long strip':'3e2b8dae-350e-4ab8-a8ce-016e844b9f0d',
        'mafia':'85daba54-a71c-4554-8a28-9901a8b0afad','magic':'a1f53773-c69a-4ce5-8cab-fffcd90b1565',
        'magical girls':'81c836c9-914a-4eca-981a-560dad663e73','martial arts':'799c202e-7daa-44eb-9cf7-8a3c0441531e',
        'mecha':'50880a9d-5440-4732-9afb-8f457127e836','medical':'c8cbe35b-1b2b-4a3f-9c37-db84c4514856',
        'military':'ac72833b-c4e9-4878-b9db-6c8a4a99444a','monster':'36fd93ea-e8b8-445e-b836-358f02b3d33d',
        'monster girls':'dd1f77c5-dea9-4e2b-97ae-224af09caf99','monsters':'36fd93ea-e8b8-445e-b836-358f02b3d33d',
        'music':'f42fbf9e-188a-447b-9fdc-f19dc1e4d685','mystery':'ee968100-4191-4968-93d3-f82d72be7e46',
        'ninja':'489dd859-9b61-4c37-af75-5b18e88daafc','office workers':'92d6d951-ca5e-429c-ac78-451071cbf064',
        'oneshot':'0234a31e-a729-4e28-9d6a-3f87c4966b9e','philosophical':'b1e97889-25b4-4258-b28b-cd7f4d28ea9b',
        'police':'df33b754-73a3-4c54-80e6-1a74a8058539','post-apocalyptic':'9467335a-1b83-4497-9231-765337a00b96',
        'psychological':'3b60b75c-a2d7-4860-ab56-05f391bb889c','reincarnation':'0bc90acb-ccc1-44ca-a34a-b9f3a73259d0',
        'reverse harem':'65761a2a-415e-47f3-bef2-a9dababba7a6','romance':'423e2eae-a7a2-4a8b-ac03-a8351462d71d',
        'samurai':'81183756-1453-4c81-aa9e-f6e1b63be016','school life':'caaa44eb-cd40-4177-b930-79d3ef2afe87',
        'sci-fi':'256c8bd9-4904-4360-bf4f-508a76d67183','self-published':'891cf039-b895-47f0-9229-bef4c96eccd4',
        'shota':'ddefd648-5140-4e5f-ba18-4eca4071d19b','slice of life':'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
        'sports':'69964a64-2f90-4d33-beeb-f3ed2875eb4c','superhero':'7064a261-a137-4d3a-8848-2d385de3a99c',
        'supernatural':'eabc5b4c-6aff-42f3-b657-3e90cbd00b75','survival':'5fff9cde-849c-4d78-aab0-0d52b2ee1d25',
        'thriller':'07251805-a27e-4d59-b488-f0bfbec15168','time travel':'292e862b-2d17-4062-90a2-0356caa4ae27',
        'tragedy':'f8f62932-27da-4fe4-8ee1-6779a8c5edba','traditional games':'31932a7e-5b8e-49a6-9f12-2afa39dc544c',
        'vampire':'d7d1730f-6eb0-4ba6-9437-602cac38664c','vampires':'d7d1730f-6eb0-4ba6-9437-602cac38664c',
        'video games':'9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8','villainess':'d14322ac-4d6f-4e9b-afd9-629d5f4d8a41',
        'virtual reality':'8c86611e-fab7-4986-9dec-d1a2f44acdd5','web comic':'e197df38-d0e7-43b5-9b09-2842d0c326dd',
        'wuxia':'acc803a4-c95a-4c22-86fc-eb6b582d82a2','zombie':'631ef465-9aba-4afb-b0fc-ea10efe274a8',
        'zombies':'631ef465-9aba-4afb-b0fc-ea10efe274a8'
    };

    // MangaDex NO manda cabeceras CORS para todos los orígenes, así que el fetch
    // directo desde el navegador falla con "Failed to fetch" en muchas redes
    // (confirmado en producción). Cuando pasa, se reintenta a través de un proxy
    // CORS y se recuerda el bloqueo para ir directo al proxy en las siguientes
    // llamadas de la sesión (evita un fetch fallido por cada una).
    var MD_API = 'https://api.mangadex.org';
    var MD_PROXY = 'https://corsproxy.io/?url=';
    var _mdDirectBlocked = false;

    function mdFetchUrl(fullUrl) {
        return new Promise(function (resolve, reject) {
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); reject(new Error('Timeout')); }, REQUEST_TIMEOUT);
            fetch(fullUrl, {
                method: 'GET', headers: { 'Accept': 'application/json' }, signal: controller.signal
            }).then(function (res) {
                clearTimeout(timer);
                if (!res.ok) return res.text().then(function (t) { reject(new Error('MD HTTP ' + res.status)); });
                return res.json();
            }).then(function (json) {
                if (json && json.errors) { reject(new Error('MD error: ' + (json.errors[0]?.detail || '?'))); return; }
                resolve(json);
            }).catch(function (err) { clearTimeout(timer); reject(err); });
        });
    }

    function mdFetch(path) {
        var direct = MD_API + path;
        var proxied = MD_PROXY + encodeURIComponent(direct);
        if (_mdDirectBlocked) return mdFetchUrl(proxied);
        return mdFetchUrl(direct).catch(function (err) {
            // Solo el bloqueo de red/CORS justifica el proxy; un Timeout o un
            // error HTTP real de MangaDex se propagan tal cual.
            var msg = String((err && err.message) || '');
            if (msg.indexOf('MD HTTP') === 0 || msg === 'Timeout') throw err;
            _mdDirectBlocked = true;
            return mdFetchUrl(proxied);
        });
    }

    var MD_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Puntaje y seguidores de varias obras de MangaDex en un solo request
     * (`/statistics/manga` acepta hasta 100 ids por llamada).
     *
     * `/manga` no devuelve nada de esto, asi que las obras servidas por
     * MangaDex salian siempre con score null: en el catalogo quedaban con el
     * puntaje vacio al lado de las de AniList, que si lo traen.
     *
     * Se usa el bayesiano y no el promedio crudo: el crudo le da 10 a una obra
     * con tres votos y la pondria arriba de cualquier clasico.
     *
     * Vive aca (y no en js/core/mangadex-api.js) porque el catalogo lo necesita
     * en paginas que no cargan ese archivo, como los carruseles del index.
     */
    async function fetchMangaDexStats(ids) {
        var lista = (ids || []).filter(function (id) { return MD_UUID_RE.test(String(id || '')); });
        if (!lista.length) return {};
        var path = '/statistics/manga?' + lista.slice(0, 100).map(function (id) {
            return 'manga[]=' + encodeURIComponent(id);
        }).join('&');
        var json = await mdFetch(path);
        var stats = json?.statistics || {};
        var out = {};
        Object.keys(stats).forEach(function (id) {
            var s = stats[id] || {};
            var raw = s.rating?.bayesian ?? s.rating?.average;
            var score = Number(raw);
            out[id] = {
                score: Number.isFinite(score) && score > 0 ? Math.round(score * 10) / 10 : null,
                follows: Number(s.follows) || 0
            };
        });
        return out;
    }

    function mdItemToCard(data) {
        if (!data?.attributes) return null;
        var a = data.attributes;
        var id = data.id;
        var title = (a.title?.en || a.title?.['ja-ro'] || a.title?.ja || Object.values(a.title || {})[0] || '');
        var desc = (a.description?.en || a.description?.es || Object.values(a.description || {})[0] || '');
        var coverUrl = '';
        var rels = data.relationships || [];
        var coverArt = rels.find(function (r) { return r.type === 'cover_art'; });
        if (coverArt?.attributes?.fileName) coverUrl = 'https://uploads.mangadex.org/covers/' + id + '/' + coverArt.attributes.fileName;
        if (!coverUrl) coverUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect fill='%231a0a2e' width='200' height='300'/%3E%3Ctext x='50%25' y='50%25' fill='%23a855f7' font-family='sans-serif' font-size='13' text-anchor='middle' dominant-baseline='middle'%3ESin portada%3C/text%3E%3C/svg%3E";
        var genres = (a.tags || []).filter(function (t) { return t.attributes?.group === 'genre' || t.attributes?.group === 'theme'; }).map(function (t) { return { name: (t.attributes?.name?.en || '') }; }).filter(function (g) { return g.name; });
        var chCnt = a.lastChapter ? Math.ceil(Number(a.lastChapter)) || 0 : 0;
        var volCnt = a.lastVolume ? Math.ceil(Number(a.lastVolume)) || 0 : 0;
        var status = a.status === 'completed' ? 'FINISHED' : (a.status === 'ongoing' ? 'RELEASING' : (a.status === 'hiatus' ? 'HIATUS' : 'UNKNOWN'));
        var friendlyType = 'Manga';
        var lang = String(a.originalLanguage || '').toLowerCase();
        if (lang === 'ko') friendlyType = 'Manhwa';
        else if (lang === 'zh' || lang === 'zh-hk' || lang === 'zh-tw') friendlyType = 'Manhua';
        else {
            var hasD = (a.tags || []).some(function (t) { return String(t.attributes?.name?.en || '').toLowerCase() === 'doujinshi'; });
            var hasO = (a.tags || []).some(function (t) { var n = String(t.attributes?.name?.en || '').toLowerCase(); return n === 'one shot' || n === 'oneshot'; });
            if (hasD) friendlyType = 'Doujinshi';
            else if (hasO) friendlyType = 'One-shot';
        }
        return {
            id: id, mal_id: null, title: title, title_english: title, synopsis: desc || 'Sin sinopsis.',
            status: status, type: friendlyType, episodes: 0, chapters: chCnt, volumes: volCnt, score: null,
            images: { webp: { large_image_url: coverUrl, image_url: coverUrl }, jpg: { large_image_url: coverUrl, image_url: coverUrl } },
            genres: genres, themes: [], studios: [], relations: [],
            season: null, seasonYear: null, source: null, duration: null, countryOfOrigin: a.originalLanguage || null
        };
    }

    function mdTagUuidsFromKeys(keys) {
        var uuids = [];
        (keys || []).forEach(function (k) {
            var norm = String(k).toLowerCase().replace(/[\s-]/g, '');
            for (var name in MD_TAG_UUIDS) {
                if (name.toLowerCase().replace(/[\s-]/g, '') === norm) { uuids.push(MD_TAG_UUIDS[name]); break; }
            }
        });
        return uuids;
    }

    async function fetchMangaDexPage(page, perPage, tagUuids, search) {
        var params = '?limit=' + perPage + '&offset=' + ((page - 1) * perPage) + '&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica';
        if (search) params += '&title=' + encodeURIComponent(search);
        tagUuids.forEach(function (u) { params += '&includedTags[]=' + u; });
        try {
            var json = await mdFetch('/manga' + params);
            var cards = (json?.data || []).map(function (m) { return mdItemToCard(m); }).filter(Boolean);

            // Un request extra por pagina completa el puntaje de todas las cards
            // de una. Es best-effort: si falla, quedan como estaban (sin score).
            try {
                var stats = await fetchMangaDexStats(cards.map(function (c) { return c.id; }));
                cards.forEach(function (c) {
                    var s = stats[c.id];
                    if (s) { c.score = s.score; c.follows = s.follows; }
                });
            } catch (e) { console.warn('fetchMangaDexStats failed:', e); }

            return cards;
        } catch (e) { console.warn('fetchMangaDexPage failed:', e); return []; }
    }

    function normalizeTitle(t) {
        return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    }

    function mergeAnilistAndMd(anilistItems, mdItems) {
        var seen = new Set();
        anilistItems.forEach(function (item) { seen.add(normalizeTitle(item.title)); });
        mdItems.forEach(function (item) {
            var key = normalizeTitle(item.title);
            if (!seen.has(key)) { seen.add(key); anilistItems.push(item); }
        });
        return anilistItems;
    }

    // ── Exposición en window ──
    // Cliente HTTP de MangaDex compartido: js/core/mangadex-api.js tenia una
    // copia casi identica de mdFetch (mismo AbortController, timeout y manejo de
    // errores). Se expone la del bundle para no mantener dos. fetchMangaDexPage,
    // fetchMangaDexStats y mergeAnilistAndMd las usan catalog/search.js y
    // pages/comparar.js; mdTagUuidsFromKeys la usa api.js.
    window.mdFetch = mdFetch;
    window.fetchMangaDexPage = fetchMangaDexPage;
    window.fetchMangaDexStats = fetchMangaDexStats;
    window.mergeAnilistAndMd = mergeAnilistAndMd;
    window.mdTagUuidsFromKeys = mdTagUuidsFromKeys;

})();
