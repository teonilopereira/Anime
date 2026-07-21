/**
 * tests/unit/api-multipage.test.js
 * Tests para js/core/api.js → consultas de catálogo agrupadas en un POST.
 *
 * Cubre:
 *  - getTopMangas:   las 3 variantes (manga JP / manhwa KR / doujinshi) viajan
 *                    en un único request aliasado, no en tres
 *  - variables:      se unifican sin duplicar cuando hay search + géneros + tags
 *  - intercalado:    el orden mezcla las tres fuentes y deduplica por id
 *  - errores parciales: si un alias falla pero otro trae datos, resuelve igual;
 *                    si no vino nada, propaga el error (el llamador necesita
 *                    distinguir "API caída" de "sin resultados")
 *  - getTopAnimes / getTopNovelas: siguen siendo un Page suelto, sin alias
 *
 * Cada test usa un número de página distinto: el caché de api.js es en memoria
 * además de localStorage, así que limpiar localStorage no alcanza para aislarlos.
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

/** Respuesta mínima con la forma que espera anilistFetch. */
function respuesta(payload) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(JSON.stringify(payload))
  };
}

function media(ids) {
  return ids.map((id) => ({
    id: id,
    title: { english: 'Obra ' + id, romaji: 'Obra ' + id },
    coverImage: { large: 'https://ejemplo/' + id + '.jpg' },
    chapters: 10,
    volumes: 2,
    genres: ['Action'],
    averageScore: 80,
    status: 'FINISHED',
    format: 'MANGA'
  }));
}

/** Cuerpos de los POST que fueron a AniList durante la llamada. */
let peticiones;

function stubFetch(porLlamada) {
  global.fetch = vi.fn((url, opts) => {
    if (String(url).includes('mangadex')) return Promise.resolve(respuesta({ data: [] }));
    peticiones.push(JSON.parse(opts.body));
    return Promise.resolve(respuesta(
      typeof porLlamada === 'function' ? porLlamada(peticiones.length) : porLlamada
    ));
  });
}

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/core/api.js');
});

beforeEach(() => {
  peticiones = [];
  localStorage.clear();
  // Los errores parciales se loguean a proposito; no ensuciar la salida.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Un solo request para las tres variantes ─────────────────────────────────

describe('getTopMangas: consulta agrupada', () => {
  it('manda un único POST en vez de tres', async () => {
    stubFetch({ data: { jp: { media: media([1]) }, kr: { media: media([2]) }, dj: { media: media([3]) } } });

    const items = await window.getTopMangas(101, {});

    expect(peticiones).toHaveLength(1);
    expect(items).toHaveLength(3);
  });

  it('aliasa los tres Page en la misma query', async () => {
    stubFetch({ data: { jp: { media: [] }, kr: { media: [] }, dj: { media: [] } } });

    await window.getTopMangas(102, {});

    const q = peticiones[0].query;
    expect(q).toContain('jp: Page(');
    expect(q).toContain('kr: Page(');
    expect(q).toContain('dj: Page(');
    // Un solo bloque `query (...)`, no tres documentos concatenados.
    expect(q.match(/query \(/g)).toHaveLength(1);
  });

  it('separa las variantes por país y por source', async () => {
    stubFetch({ data: { jp: { media: [] }, kr: { media: [] }, dj: { media: [] } } });

    await window.getTopMangas(103, {});

    const q = peticiones[0].query;
    expect(q).toContain('countryOfOrigin: "JP"');
    expect(q).toContain('countryOfOrigin: "KR"');
    expect(q).toContain('source: DOUJINSHI');
  });

  it('declara cada variable una sola vez aunque la usen los tres alias', async () => {
    stubFetch({ data: { jp: { media: [] }, kr: { media: [] }, dj: { media: [] } } });

    await window.getTopMangas(104, { search: 'berserk', genres: ['action', 'isekai'] });

    const q = peticiones[0].query;
    const decls = q.slice(0, q.indexOf(')') + 1);
    expect(decls.match(/\$search: String/g)).toHaveLength(1);
    expect(decls.match(/\$genre_in: \[String\]/g)).toHaveLength(1);
    expect(decls.match(/\$tag_in: \[String\]/g)).toHaveLength(1);
    // 'action' es género oficial de AniList; 'isekai' es tag.
    expect(peticiones[0].variables.genre_in).toEqual(['Action']);
    expect(peticiones[0].variables.tag_in).toEqual(['isekai']);
  });

  it('comparte page y perPage entre los tres alias', async () => {
    stubFetch({ data: { jp: { media: [] }, kr: { media: [] }, dj: { media: [] } } });

    await window.getTopMangas(105, {});

    expect(peticiones[0].variables.page).toBe(105);
    // PER_PAGE (40) repartido entre las tres variantes.
    expect(peticiones[0].variables.perPage).toBe(13);
  });

  it('intercala las tres fuentes y deduplica por id', async () => {
    stubFetch({
      data: {
        jp: { media: media([1, 4]) },
        kr: { media: media([2, 4]) },  // el 4 se repite: entra una sola vez
        dj: { media: media([3]) }
      }
    });

    const items = await window.getTopMangas(106, {});

    expect(items.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it('no vuelve a pedir nada si la página ya está cacheada', async () => {
    stubFetch({ data: { jp: { media: media([1]) }, kr: { media: [] }, dj: { media: [] } } });

    await window.getTopMangas(107, {});
    await window.getTopMangas(107, {});

    expect(peticiones).toHaveLength(1);
  });
});

// ─── Tolerancia a errores parciales de GraphQL ───────────────────────────────

describe('getTopMangas: errores parciales', () => {
  it('resuelve con lo que llegó si falla un alias pero otro trae datos', async () => {
    stubFetch({
      errors: [{ message: 'dj falló' }],
      data: { jp: { media: media([1]) }, kr: { media: [] }, dj: null }
    });

    const items = await window.getTopMangas(108, {});

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(1);
  });

  it('propaga el error si no vino ningún dato', async () => {
    stubFetch({
      errors: [{ message: 'Too Many Requests' }],
      data: { jp: null, kr: null, dj: null }
    });

    await expect(window.getTopMangas(109, {})).rejects.toThrow('Too Many Requests');
  });

  it('propaga el error si la respuesta no trae data', async () => {
    stubFetch({ errors: [{ message: 'Validation error' }] });

    await expect(window.getTopMangas(110, {})).rejects.toThrow('Validation error');
  });
});

// ─── Las otras categorías no se tocaron ──────────────────────────────────────

describe('getTopAnimes / getTopNovelas: siguen con un Page suelto', () => {
  it('getTopAnimes manda un request sin alias', async () => {
    stubFetch({ data: { Page: { media: media([1, 2]) } } });

    const items = await window.getTopAnimes(111, {});

    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].query).toContain('Page(page: $page');
    expect(peticiones[0].query).not.toContain('jp: Page(');
    expect(items).toHaveLength(2);
  });

  it('getTopNovelas pide solo el formato NOVEL', async () => {
    stubFetch({ data: { Page: { media: media([1]) } } });

    await window.getTopNovelas(112, {});

    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].query).toContain('format_in: [NOVEL]');
  });

  it('browse "puntuados" ordena por SCORE_DESC en las tres categorías', async () => {
    stubFetch((n) => (n === 1
      ? { data: { Page: { media: [] } } }
      : { data: { jp: { media: [] }, kr: { media: [] }, dj: { media: [] } } }));

    await window.getTopAnimes(113, { browse: 'puntuados' });
    await window.getTopMangas(113, { browse: 'puntuados' });

    expect(peticiones[0].query).toContain('sort: SCORE_DESC');
    expect(peticiones[1].query).toContain('sort: SCORE_DESC');
  });
});
