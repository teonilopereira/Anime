(function () {
    const API_BASE_URL = window.AppConfig?.anilistEndpoint || "https://graphql.anilist.co";
    const CACHE_NAME   = "anilist-cache-v1";
    const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutos

    // ─────────────────────────────────────────────
    // Capa de caché — Cache API (async, sin límite ~5 MB)
    // ─────────────────────────────────────────────
    async function readCache(cacheKey) {
        try {
            const cache   = await caches.open(CACHE_NAME);
            const match   = await cache.match(`/_cache/${cacheKey}`);
            if (!match) return null;

            const { ts, data } = await match.json();
            if (Date.now() - ts > CACHE_TTL_MS) {
                cache.delete(`/_cache/${cacheKey}`); // entrada expirada
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    async function writeCache(cacheKey, data) {
        try {
            const cache    = await caches.open(CACHE_NAME);
            const payload  = JSON.stringify({ ts: Date.now(), data });
            const response = new Response(payload, {
                headers: { "Content-Type": "application/json" }
            });
            await cache.put(`/_cache/${cacheKey}`, response);
        } catch (err) {
            // Fallo silencioso — la app sigue funcionando sin caché
            console.warn("writeCache falló:", err);
        }
    }

    // ─────────────────────────────────────────────
    // Cliente GraphQL
    // ─────────────────────────────────────────────
    async function requestAniList(query, variables = {}, cacheKey = null) {
        if (cacheKey) {
            const cached = await readCache(cacheKey);
            if (cached) return cached;
        }

        const response = await fetch(API_BASE_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body:    JSON.stringify({ query, variables })
        });

        if (!response.ok) throw new Error(`Error de AniList: ${response.status}`);

        const payload = await response.json();
        if (payload.errors) throw new Error(payload.errors[0].message);

        const data = payload.data;
        if (cacheKey && data) await writeCache(cacheKey, data);
        return data;
    }

    // ─────────────────────────────────────────────
    // Queries GraphQL
    // ─────────────────────────────────────────────
    const LIST_MEDIA_QUERY = `
    query ($page: Int, $perPage: Int, $type: MediaType, $format: MediaFormat, $search: String, $sort: [MediaSort]) {
      Page (page: $page, perPage: $perPage) {
        media (type: $type, format: $format, search: $search, sort: $sort) {
          id
          title { romaji english native }
          type format status description
          episodes chapters volumes
          genres
          tags { name }
          averageScore popularity
          coverImage { extraLarge large medium }
          bannerImage
        }
      }
    }`;

    const DETAIL_MEDIA_QUERY = `
    query ($id: Int) {
      Media (id: $id) {
        id
        title { romaji english native }
        type format status description
        episodes chapters volumes duration
        genres
        tags { name }
        averageScore popularity meanScore
        season seasonYear
        coverImage { extraLarge large medium }
        bannerImage
        studios (isMain: true) { nodes { name } }
        streamingEpisodes { title thumbnail url site }
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english }
              type format
            }
          }
        }
      }
    }`;

    // ─────────────────────────────────────────────
    // Mapeador AniList → formato Jikan
    // ─────────────────────────────────────────────
    function mapAniListItemToJikan(item, category = null) {
        if (!item) return null;

        const rawStatus = String(item.status || "").toUpperCase();
        const isAnime   = item.type === "ANIME" || category === "anime";

        const STATUS_MAP = {
            FINISHED:         isAnime ? "Finished Airing" : "Finished",
            RELEASING:        isAnime ? "Currently Airing" : "Publishing",
            NOT_YET_RELEASED: isAnime ? "Not yet aired"   : "Not yet published",
            HIATUS:           "On Hiatus",
            CANCELLED:        "Cancelled"
        };

        const FORMAT_MAP = {
            TV:       "TV",    TV_SHORT: "TV Short", MOVIE:    "Movie",
            SPECIAL:  "Special", OVA:   "OVA",       ONA:      "ONA",
            MANGA:    "Manga", NOVEL:   "Light Novel", ONE_SHOT: "One-shot"
        };

        const rawFormat  = String(item.format || "").toUpperCase();
        const statusText = STATUS_MAP[rawStatus] || "No especificado";
        const typeText   = FORMAT_MAP[rawFormat]  || (isAnime ? "TV" : "Manga");

        const cleanSynopsis = (item.description || "")
            .replace(/<\/?[^>]+(>|$)/g, "")
            .trim();

        return {
            mal_id:        item.id,
            id:            item.id,
            title:         item.title.romaji || item.title.english || item.title.native || "Sin título",
            title_english: item.title.english || item.title.romaji || "",
            synopsis:      cleanSynopsis || "Sin sinopsis disponible.",
            status:        statusText,
            type:          typeText,
            episodes:      item.episodes  || 0,
            chapters:      item.chapters  || 0,
            volumes:       item.volumes   || 0,
            score:         item.averageScore ? (item.averageScore / 10).toFixed(1) : "N/A",
            images: {
                webp: {
                    large_image_url: item.coverImage.extraLarge || item.coverImage.large || item.coverImage.medium,
                    image_url:       item.coverImage.large      || item.coverImage.medium
                },
                jpg: {
                    large_image_url: item.coverImage.extraLarge || item.coverImage.large || item.coverImage.medium,
                    image_url:       item.coverImage.large      || item.coverImage.medium
                }
            },
            genres:            (item.genres || []).map(g => ({ name: g })),
            themes:            (item.tags   || []).slice(0, 5).map(t => ({ name: t.name })),
            studios:           item.studios?.nodes?.map(n => ({ name: n.name })) ?? [],
            streamingEpisodes: item.streamingEpisodes || [],
            relations:         (item.relations?.edges || []).map(edge => ({
                relation: (edge.relationType || "").replace(/_/g, " ").toLowerCase(),
                entry: [{
                    mal_id: edge.node.id,
                    type:   edge.node.type === "ANIME" ? "anime" : "manga",
                    name:   edge.node.title.romaji || edge.node.title.english || "Título relacionado"
                }]
            }))
        };
    }

    // ─────────────────────────────────────────────
    // API pública (window)
    // ─────────────────────────────────────────────
    window.cleanResults = (items) => Array.isArray(items) ? items : [];

    window.getTopAnimes = async (page = 1) => {
        try {
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page, perPage: 40, type: "ANIME",
                sort: ["SCORE_DESC", "POPULARITY_DESC"]
            }, `anilist_top_anime_page_${page}`);
            return (data?.Page?.media || []).map(i => mapAniListItemToJikan(i, "anime"));
        } catch (err) { console.error("getTopAnimes:", err); return []; }
    };

    window.getTopMangas = async (page = 1) => {
        try {
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page, perPage: 40, type: "MANGA", format: "MANGA",
                sort: ["SCORE_DESC", "POPULARITY_DESC"]
            }, `anilist_top_manga_page_${page}`);
            return (data?.Page?.media || []).map(i => mapAniListItemToJikan(i, "manga"));
        } catch (err) { console.error("getTopMangas:", err); return []; }
    };

    window.getTopNovelas = async (page = 1) => {
        try {
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page, perPage: 40, type: "MANGA", format: "NOVEL",
                sort: ["SCORE_DESC", "POPULARITY_DESC"]
            }, `anilist_top_novelas_page_${page}`);
            return (data?.Page?.media || []).map(i => mapAniListItemToJikan(i, "manga"));
        } catch (err) { console.error("getTopNovelas:", err); return []; }
    };

    window.buscarEnApi = async (query, type) => {
        try {
            const isAnime    = type === "anime";
            const mediaType  = isAnime ? "ANIME" : "MANGA";
            const formatFilter = type === "manga"   ? "MANGA"
                               : type === "novelas" ? "NOVEL"
                               : undefined;
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page: 1, perPage: 40, type: mediaType,
                format: formatFilter, search: query
            }); // Sin cacheKey en búsquedas libres — resultados volátiles
            return (data?.Page?.media || []).map(i => mapAniListItemToJikan(i, type));
        } catch (err) { console.error(`buscarEnApi (${type}):`, err); return []; }
    };

    window.buscarNovelasEnApi = async (query) => window.buscarEnApi(query, "novelas");

    window.getAnimeById = async (id) => {
        const cacheKey = `anilist_detail_anime_${id}`;
        try {
            const data   = await requestAniList(DETAIL_MEDIA_QUERY, { id: parseInt(id, 10) }, cacheKey);
            return mapAniListItemToJikan(data?.Media, "anime");
        } catch (err) { console.error(`getAnimeById (${id}):`, err); throw err; }
    };

    window.getMangaById = async (id) => {
        const cacheKey = `anilist_detail_manga_${id}`;
        try {
            const data   = await requestAniList(DETAIL_MEDIA_QUERY, { id: parseInt(id, 10) }, cacheKey);
            return mapAniListItemToJikan(data?.Media, "manga");
        } catch (err) { console.error(`getMangaById (${id}):`, err); throw err; }
    };

})();
