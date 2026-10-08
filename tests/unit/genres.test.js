/**
 * tests/unit/genres.test.js
 * Tests para js/core/genres.js → catálogo de géneros y tags de los filtros.
 *
 * Cubre:
 *  - separar:        géneros oficiales a genre_in y tags con el nombre de AniList
 *  - paraCategoria:  orden (oficiales primero), Hentai nunca, sin repetidos
 *  - con la colección de AniList: descarta tags desconocidos (salvo los que
 *                    cubre MangaDex en manga/novelas) y oculta los +18
 *  - cargar:         si AniList falla, no reintenta en cada llamada
 */

import { beforeAll, describe, it, expect, vi } from 'vitest';

let G;

beforeAll(async () => {
  localStorage.clear();
  await import('../../js/core/genres.js');
  G = window.AnimeDestiny.Genres;
});

function nombres(lista) {
  return lista.map((g) => g.label);
}

describe('separar', () => {
  it('manda los oficiales a genres y los tags con su nombre real', () => {
    const r = G.separar(['action', "girls' love", 'slice of life', 'isekai', 'post-apocalyptic']);
    expect(r.genres).toEqual(['Action', 'Slice of Life']);
    expect(r.tags).toEqual(["Girls' Love", 'Isekai', 'Post-Apocalyptic']);
  });

  it('deja pasar una clave desconocida tal cual e ignora vacías', () => {
    expect(G.separar(['algo raro', '', null]).tags).toEqual(['algo raro']);
  });
});

describe('paraCategoria (listas de respaldo)', () => {
  it('pone los géneros oficiales primero y en orden alfabético', () => {
    const lista = G.paraCategoria('novelas', false);
    const oficiales = lista.filter((g) => g.oficial);
    expect(lista.slice(0, oficiales.length)).toEqual(oficiales);
    expect(nombres(oficiales)).toEqual([...nombres(oficiales)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  });

  it('ofrece los 18 géneros oficiales en las tres categorías, nunca Hentai', () => {
    ['anime', 'manga', 'novelas'].forEach((cat) => {
      const lista = G.paraCategoria(cat, true);
      expect(lista.filter((g) => g.oficial)).toHaveLength(18);
      expect(nombres(lista)).not.toContain('Hentai');
    });
  });

  it('no repite chips', () => {
    const lista = nombres(G.paraCategoria('manga', true));
    expect(new Set(lista).size).toBe(lista.length);
  });

  it('oculta Loli/Shota sin el filtro +18', () => {
    expect(nombres(G.paraCategoria('manga', false))).not.toContain('Loli');
    expect(nombres(G.paraCategoria('manga', true))).toContain('Loli');
  });
});

describe('con la colección de AniList', () => {
  beforeAll(async () => {
    window.mdTagUuidsFromKeys = (keys) => (keys[0] === 'Long Strip' ? ['uuid'] : []);
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: {
          GenreCollection: ['Action', 'Hentai'],
          MediaTagCollection: [
            { name: 'Isekai', isAdult: false },
            { name: "Girls' Love", isAdult: false },
            { name: 'Incest', isAdult: true }
          ]
        }
      })
    }));
    expect(await G.cargar()).toBe(true);
  });

  it('solo ofrece en anime los tags que AniList conoce', () => {
    const lista = nombres(G.paraCategoria('anime', false));
    expect(lista).toContain('Isekai');
    expect(lista).toContain("Girls' Love");
    expect(lista).not.toContain('Cyberpunk');
  });

  it('en manga conserva los tags que cubre MangaDex', () => {
    expect(nombres(G.paraCategoria('manga', false))).toContain('Long Strip');
    expect(nombres(G.paraCategoria('anime', false))).not.toContain('Long Strip');
  });

  it('oculta los tags +18 de AniList sin el filtro NSFW', () => {
    expect(nombres(G.paraCategoria('anime', false))).not.toContain('Incest');
    expect(nombres(G.paraCategoria('anime', true))).toContain('Incest');
  });

  it('guarda la colección para la próxima visita', () => {
    expect(JSON.parse(localStorage.getItem('genres:anilist:v1')).data.tags).toHaveLength(3);
  });
});

describe('cargar cuando AniList falla', () => {
  it('cae a las listas fijas y no reintenta en la llamada siguiente', async () => {
    localStorage.clear();
    vi.resetModules();
    await import('../../js/core/genres.js?fallo');
    const Gf = window.AnimeDestiny.Genres;
    global.fetch = vi.fn(() => Promise.reject(new Error('sin red')));

    expect(await Gf.cargar()).toBe(false);
    expect(await Gf.cargar()).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(Gf.listo()).toBe(false);
    expect(Gf.paraCategoria('anime', false).length).toBeGreaterThan(100);
  });
});
