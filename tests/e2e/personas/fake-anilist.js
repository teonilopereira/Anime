// AniList simulado para las pruebas de personas.
//
// Responde a cualquier query GraphQL mirando qué campos raíz pide (Page, Media
// y sus alias, p. ej. `jp: Page(...)`) y devuelve datos inventados pero con la
// forma real. Así las páginas renderizan contenido sin depender de la API.

const TITULOS = [
  'Ciudad de Faroles', 'El Último Herrero', 'Marea Roja', 'Jardín de Acero',
  'Clase 3-B Después del Fin', 'Café Yokai', 'Piloto Sin Cielo', 'Diario de una Bruja Novata',
  'Rokuro y el Tren Nocturno', 'Siete Espadas Rotas', 'La Biblioteca Flotante', 'Lluvia en Shibuya',
];

const PORTADA =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="230" height="325"><rect width="100%" height="100%" fill="#6b4fd8"/></svg>');

export function fakeMedia(i, tipo = 'ANIME') {
  const id = 900000 + i;
  const titulo = TITULOS[i % TITULOS.length] + (i >= TITULOS.length ? ` ${Math.floor(i / TITULOS.length) + 1}` : '');
  return {
    id,
    idMal: id,
    type: tipo,
    title: { romaji: titulo, english: titulo, native: 'テスト' + i, userPreferred: titulo },
    coverImage: { extraLarge: PORTADA, large: PORTADA, medium: PORTADA, color: '#6b4fd8' },
    bannerImage: null,
    description: `Sinopsis de prueba para <b>${titulo}</b>.`,
    genres: ['Action', 'Comedy'],
    tags: [{ name: 'Shounen', rank: 80, isMediaSpoiler: false }],
    status: 'RELEASING',
    format: tipo === 'ANIME' ? 'TV' : 'MANGA',
    countryOfOrigin: 'JP',
    source: 'ORIGINAL',
    episodes: 12,
    chapters: 40,
    volumes: 4,
    duration: 24,
    averageScore: 70 + (i % 25),
    meanScore: 72,
    popularity: 10000 - i,
    favourites: 500,
    season: 'FALL',
    seasonYear: 2026,
    startDate: { year: 2026, month: 10, day: 1 },
    endDate: { year: null, month: null, day: null },
    nextAiringEpisode: { episode: 5, airingAt: Math.floor(Date.now() / 1000) + 86400, timeUntilAiring: 86400 },
    synonyms: [],
    rankings: [],
    studios: { nodes: [{ id: 1, name: 'Estudio Prueba', isAnimationStudio: true }], edges: [] },
    staff: { edges: [] },
    characters: { edges: [], pageInfo: { hasNextPage: false } },
    relations: { edges: [] },
    recommendations: { nodes: [] },
    externalLinks: [],
    trailer: null,
    isAdult: false,
  };
}

function pagina(tipo, n = 24) {
  const media = Array.from({ length: n }, (_, i) => fakeMedia(i, tipo));
  return {
    pageInfo: { total: n, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: n },
    media,
    airingSchedules: media.slice(0, 8).map((m, i) => ({
      id: i, episode: 5, airingAt: Math.floor(Date.now() / 1000) + 3600 * (i + 1), media: m,
    })),
    characters: [],
    staff: [],
    studios: [],
  };
}

export function respuestaPara(body) {
  const query = String(body?.query || '');
  const tipo = /type:\s*MANGA|\$type|MANGA/.test(query) && !/ANIME/.test(query) ? 'MANGA' : 'ANIME';
  const data = {};
  const re = /(?:(\w+)\s*:\s*)?\b(Page|Media)\s*\(/g;
  let m;
  while ((m = re.exec(query))) {
    const clave = m[1] || m[2];
    if (clave in data) continue;
    data[clave] = m[2] === 'Page' ? pagina(tipo) : fakeMedia(Number(body?.variables?.id) % 100 || 0, tipo);
  }
  return { data };
}

/**
 * Instala la red simulada en una página.
 * modo: 'ok' (default) | 'caido' (AniList 500) | 'lento' (ok pero con demora)
 */
export async function instalarRed(page, { modo = 'ok', demoraMs = 2500 } = {}) {
  await page.route('https://graphql.anilist.co/**', async (route) => {
    if (modo === 'caido') return route.fulfill({ status: 500, body: 'Internal Server Error' });
    if (modo === 'lento') await new Promise((r) => setTimeout(r, demoraMs));
    let body = {};
    try { body = route.request().postDataJSON(); } catch (_) { /* sin body */ }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(respuestaPara(body)),
    });
  });
  // El resto de la red externa (Supabase, MangaDex, fuentes...) se corta.
  await page.route(
    (url) => url.hostname !== 'localhost' && url.hostname !== 'graphql.anilist.co',
    (route) => route.abort(),
  );
}
