/**
 * tests/unit/themes.test.js
 * Tests para js/detalle/themes.js → window.DetalleThemes
 *
 * Cubre:
 *  - normalizar:   el aplanado de la respuesta de AnimeThemes, el orden
 *                  OP-antes-que-ED, el descarte de entries NSFW y los temas
 *                  sin audio
 *  - obtenerTemas: el caché de 24 h en localStorage y la deduplicación de
 *                  requests en vuelo
 *  - htmlSeccion:  escapado del título y del artista
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/detalle/themes.js');
});

const T = () => window.DetalleThemes;

/** Respuesta de la API con un tema por cada spec pasada. */
function respuesta(temas, slug) {
  return {
    anime: [{
      name: 'Ejemplo',
      slug: slug || 'ejemplo',
      animethemes: temas
    }]
  };
}

function tema(opciones) {
  const o = opciones || {};
  const audio = o.audio === null ? null : { link: o.audio || 'https://a.animethemes.moe/x.ogg' };
  return {
    type: o.type || 'OP',
    sequence: o.sequence || 1,
    slug: o.slug || ((o.type || 'OP') + (o.sequence || 1)),
    song: { title: o.titulo || 'Canción', artists: o.artistas || [] },
    animethemeentries: [{
      version: 1,
      spoiler: false,
      nsfw: !!o.nsfw,
      videos: [{ id: 1, audio: audio }]
    }]
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizar', () => {
  it('devuelve null cuando el anime no está en AnimeThemes', () => {
    expect(T().normalizar({ anime: [] })).toBeNull();
    expect(T().normalizar({})).toBeNull();
  });

  it('aplana título, artistas y link de audio', () => {
    const data = T().normalizar(respuesta([
      tema({ titulo: 'THE WORLD', artistas: [{ name: 'Nightmare' }], audio: 'https://a.animethemes.moe/dn.ogg' })
    ]));

    expect(data.temas).toHaveLength(1);
    expect(data.temas[0]).toMatchObject({
      etiqueta: 'OP1',
      titulo: 'THE WORLD',
      artistas: 'Nightmare',
      audio: 'https://a.animethemes.moe/dn.ogg'
    });
  });

  it('junta varios artistas con coma', () => {
    const data = T().normalizar(respuesta([
      tema({ artistas: [{ name: 'A' }, { name: 'B' }] })
    ]));
    expect(data.temas[0].artistas).toBe('A, B');
  });

  it('ordena los OP antes que los ED y por número dentro de cada tipo', () => {
    const data = T().normalizar(respuesta([
      tema({ type: 'ED', sequence: 2 }),
      tema({ type: 'OP', sequence: 2 }),
      tema({ type: 'ED', sequence: 1 }),
      tema({ type: 'OP', sequence: 1 })
    ]));
    expect(data.temas.map((t) => t.etiqueta)).toEqual(['OP1', 'OP2', 'ED1', 'ED2']);
  });

  it('descarta las entries NSFW y deja el tema sin audio en vez de romperlo', () => {
    const data = T().normalizar(respuesta([tema({ titulo: 'Tema', nsfw: true })]));
    expect(data.temas).toHaveLength(1);
    expect(data.temas[0].audio).toBe('');
  });

  it('ignora los temas sin título', () => {
    const sinTitulo = tema({});
    sinTitulo.song.title = '';
    expect(T().normalizar(respuesta([sinTitulo]))).toBeNull();
  });

  it('arma el link a la página del anime en AnimeThemes', () => {
    const data = T().normalizar(respuesta([tema({})], 'death_note'));
    expect(data.pagina).toBe('https://animethemes.moe/anime/death_note');
  });
});

describe('obtenerTemas', () => {
  it('no le pega a la API si no hay id', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    expect(await T().obtenerTemas(null)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cachea la respuesta y no repite el request', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => respuesta([tema({ titulo: 'Uno' })])
    });

    const primera = await T().obtenerTemas(1535);
    const segunda = await T().obtenerTemas(1535);

    expect(primera.temas[0].titulo).toBe('Uno');
    expect(segunda.temas[0].titulo).toBe('Uno');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('propaga el error para que hidratar decida qué hacer', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 503 });
    await expect(T().obtenerTemas(999)).rejects.toThrow('503');
  });

  it('no cachea cuando el anime no está indexado', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ anime: [] })
    });

    expect(await T().obtenerTemas(777)).toBeNull();
    expect(await T().obtenerTemas(777)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('htmlSeccion', () => {
  it('devuelve vacío cuando no hay datos', () => {
    expect(T().htmlSeccion(null)).toBe('');
    expect(T().htmlSeccion({ temas: [], pagina: 'x' })).toBe('');
  });

  it('escapa el título y el artista', () => {
    const html = T().htmlSeccion({
      temas: [{
        etiqueta: 'OP1',
        tipo: 'OP',
        secuencia: 1,
        titulo: '<img src=x onerror=alert(1)>',
        artistas: '"><script>alert(2)</script>',
        audio: ''
      }],
      pagina: 'https://animethemes.moe/anime/x'
    });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
  });
});
