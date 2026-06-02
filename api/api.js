(function () {
    const API_BASE_URL = "https://graphql.anilist.co";

    // --- Lógica de Caché ---
    function readCache(cacheKey) {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;
            return JSON.parse(cached);
        } catch { return null; }
    }

    function writeCache(cacheKey, data) {
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { }
    }

    // --- Cliente GraphQL minimalista con fetch ---
    async function requestAniList(query, variables = {}, cacheKey = null) {
        if (cacheKey) {
            const cached = readCache(cacheKey);
            if (cached) return cached;
        }

        try {
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`Error de AniList: ${response.status}`);
            }

            const payload = await response.json();
            if (payload.errors) {
                throw new Error(payload.errors[0].message);
            }

            const data = payload.data;
            if (cacheKey && data) {
                writeCache(cacheKey, data);
            }
            return data;
        } catch (error) {
            console.error("Fallo al conectar con la API de AniList:", error);
            throw error;
        }
    }

    // --- Consultas GraphQL ---
    const LIST_MEDIA_QUERY = `
    query ($page: Int, $perPage: Int, $type: MediaType, $format: MediaFormat, $search: String, $sort: [MediaSort]) {
      Page (page: $page, perPage: $perPage) {
        media (type: $type, format: $format, search: $search, sort: $sort) {
          id
          title {
            romaji
            english
            native
          }
          type
          format
          status
          description
          episodes
          chapters
          volumes
          genres
          tags {
            name
          }
          averageScore
          popularity
          coverImage {
            extraLarge
            large
            medium
          }
          bannerImage
        }
      }
    }
    `;

    const DETAIL_MEDIA_QUERY = `
    query ($id: Int) {
      Media (id: $id) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description
        episodes
        chapters
        volumes
        duration
        genres
        tags {
          name
        }
        averageScore
        popularity
        meanScore
        season
        seasonYear
        coverImage {
          extraLarge
          large
          medium
        }
        bannerImage
        studios (isMain: true) {
          nodes {
            name
          }
        }
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              type
              format
            }
          }
        }
      }
    }
    `;

    // --- Adaptador / Mapeador de datos a Jikan ---
    function mapAniListItemToJikan(item, category = null) {
        if (!item) return null;

        // Traducir estados a los que el frontend espera en Jikan
        let statusText = 'No especificado';
        const rawStatus = String(item.status || '').toUpperCase();
        const isAnime = item.type === 'ANIME' || category === 'anime';

        if (rawStatus === 'FINISHED') {
            statusText = isAnime ? 'Finished Airing' : 'Finished';
        } else if (rawStatus === 'RELEASING') {
            statusText = isAnime ? 'Currently Airing' : 'Publishing';
        } else if (rawStatus === 'NOT_YET_RELEASED') {
            statusText = isAnime ? 'Not yet aired' : 'Not yet published';
        } else if (rawStatus === 'HIATUS') {
            statusText = 'On Hiatus';
        } else if (rawStatus === 'CANCELLED') {
            statusText = 'Cancelled';
        }

        // Normalizar tipo de formato
        let typeText = isAnime ? 'TV' : 'Manga';
        const rawFormat = String(item.format || '').toUpperCase();
        if (rawFormat === 'TV') typeText = 'TV';
        else if (rawFormat === 'TV_SHORT') typeText = 'TV Short';
        else if (rawFormat === 'MOVIE') typeText = 'Movie';
        else if (rawFormat === 'SPECIAL') typeText = 'Special';
        else if (rawFormat === 'OVA') typeText = 'OVA';
        else if (rawFormat === 'ONA') typeText = 'ONA';
        else if (rawFormat === 'MANGA') typeText = 'Manga';
        else if (rawFormat === 'NOVEL') typeText = 'Light Novel';
        else if (rawFormat === 'ONE_SHOT') typeText = 'One-shot';

        // Limpiar descripción de etiquetas HTML para que se vea limpio
        const cleanSynopsis = (item.description || '')
            .replace(/<\/?[^>]+(>|$)/g, "") // Limpiar etiquetas HTML
            .trim();

        // Mapear géneros y temas
        const genres = (item.genres || []).map(g => ({ name: g }));
        const themes = (item.tags || []).slice(0, 5).map(t => ({ name: t.name }));

        // Mapear estudios
        const studiosList = item.studios?.nodes ? item.studios.nodes.map(n => ({ name: n.name })) : [];

        // Mapear relaciones
        const relationsList = item.relations?.edges ? item.relations.edges.map(edge => ({
            relation: edge.relationType ? edge.relationType.replace(/_/g, ' ').toLowerCase() : 'relación',
            entry: [{
                mal_id: edge.node.id,
                type: edge.node.type === 'ANIME' ? 'anime' : 'manga',
                name: edge.node.title.romaji || edge.node.title.english || 'Título relacionado'
            }]
        })) : [];

        return {
            mal_id: item.id,
            id: item.id,
            title: item.title.romaji || item.title.english || item.title.native || 'Sin título',
            title_english: item.title.english || item.title.romaji || '',
            synopsis: cleanSynopsis || 'Sin sinopsis disponible.',
            status: statusText,
            type: typeText,
            episodes: item.episodes || 0,
            chapters: item.chapters || 0,
            volumes: item.volumes || 0,
            score: item.averageScore ? (item.averageScore / 10).toFixed(1) : 'N/A',
            images: {
                webp: {
                    large_image_url: item.coverImage.extraLarge || item.coverImage.large || item.coverImage.medium,
                    image_url: item.coverImage.large || item.coverImage.medium
                },
                jpg: {
                    large_image_url: item.coverImage.extraLarge || item.coverImage.large || item.coverImage.medium,
                    image_url: item.coverImage.large || item.coverImage.medium
                }
            },
            genres: genres,
            themes: themes,
            studios: studiosList,
            streamingEpisodes: item.streamingEpisodes || [],
            relations: relationsList
        };
    }

    // --- Exportación a las funciones de ventana (Window) del frontend ---
    window.cleanResults = (items, category) => {
        return Array.isArray(items) ? items : [];
    };

    window.getTopAnimes = async (page = 1) => {
        const cacheKey = `anilist_top_anime_page_${page}`;
        try {
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page: page,
                perPage: 40,
                type: 'ANIME',
                sort: ['SCORE_DESC', 'POPULARITY_DESC']
            }, cacheKey);

            const items = data?.Page?.media || [];
            return items.map(item => mapAniListItemToJikan(item, 'anime'));
        } catch (error) {
            console.error("Error en getTopAnimes:", error);
            return [];
        }
    };

    window.getTopMangas = async (page = 1) => {
        const cacheKey = `anilist_top_manga_page_${page}`;
        try {
            // Excluimos formato NOVEL para obtener sólo mangas
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page: page,
                perPage: 40,
                type: 'MANGA',
                format: 'MANGA',
                sort: ['SCORE_DESC', 'POPULARITY_DESC']
            }, cacheKey);

            const items = data?.Page?.media || [];
            return items.map(item => mapAniListItemToJikan(item, 'manga'));
        } catch (error) {
            console.error("Error en getTopMangas:", error);
            return [];
        }
    };

    window.getTopNovelas = async (page = 1) => {
        const cacheKey = `anilist_top_novelas_page_${page}`;
        try {
            // En AniList, las Novelas Ligeras son representadas por type: MANGA y format: NOVEL
            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page: page,
                perPage: 40,
                type: 'MANGA',
                format: 'NOVEL',
                sort: ['SCORE_DESC', 'POPULARITY_DESC']
            }, cacheKey);

            const items = data?.Page?.media || [];
            return items.map(item => mapAniListItemToJikan(item, 'manga'));
        } catch (error) {
            console.error("Error en getTopNovelas:", error);
            return [];
        }
    };

    window.buscarEnApi = async (query, type) => {
        try {
            const isAnime = type === 'anime';
            const mediaType = isAnime ? 'ANIME' : 'MANGA';
            const formatFilter = type === 'manga' ? 'MANGA' : (type === 'novelas' ? 'NOVEL' : undefined);

            const data = await requestAniList(LIST_MEDIA_QUERY, {
                page: 1,
                perPage: 40,
                type: mediaType,
                format: formatFilter,
                search: query
            });

            const items = data?.Page?.media || [];
            return items.map(item => mapAniListItemToJikan(item, type));
        } catch (error) {
            console.error(`Error en buscarEnApi (${type}):`, error);
            return [];
        }
    };

    window.buscarNovelasEnApi = async (query) => {
        return await window.buscarEnApi(query, 'novelas');
    };

    window.getAnimeById = async (id) => {
        const cacheKey = `anilist_detail_anime_${id}`;
        const cached = readCache(cacheKey);
        if (cached) return cached;

        try {
            const data = await requestAniList(DETAIL_MEDIA_QUERY, {
                id: parseInt(id, 10)
            });

            const mapped = mapAniListItemToJikan(data?.Media, 'anime');
            if (mapped) {
                writeCache(cacheKey, mapped);
            }
            return mapped;
        } catch (error) {
            console.error(`Error en getAnimeById (${id}):`, error);
            throw error;
        }
    };

    window.getMangaById = async (id) => {
        const cacheKey = `anilist_detail_manga_${id}`;
        const cached = readCache(cacheKey);
        if (cached) return cached;

        try {
            const data = await requestAniList(DETAIL_MEDIA_QUERY, {
                id: parseInt(id, 10)
            });

            const mapped = mapAniListItemToJikan(data?.Media, 'manga');
            if (mapped) {
                writeCache(cacheKey, mapped);
            }
            return mapped;
        } catch (error) {
            console.error(`Error en getMangaById (${id}):`, error);
            throw error;
        }
    };
})();
