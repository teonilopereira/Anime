/**
 * tests/unit/detalle-data.test.js
 * Tests para js/detalle/data.js
 *
 * Cubre los helpers de parseo y normalización que la ficha de detalle usa:
 *  - normalizeDetailItem: unifica los múltiples nombres de campo posibles
 *  - parseGeneros:        extrae géneros de arrays/strings/info
 *  - parseVolumenes:      saneo numérico de volúmenes
 *  - parseTemporadas / getAnimeStructure: estructura de temporadas y conteos
 *  - getApiUnifiedProgress: cálculo de progreso visto/porcentaje
 */

import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/utils.js');        // episodeStorageKey / volumeStorageKey globales
  await import('../../js/core/user-store.js');
  await import('../../js/detalle/data.js');
});

beforeEach(() => {
  window.UserStore.clear();
});

// ─── normalizeDetailItem ──────────────────────────────────────────────────────

describe('normalizeDetailItem', () => {
  const norm = (i) => window.normalizeDetailItem(i);

  it('devuelve null para entradas no-objeto', () => {
    expect(norm(null)).toBeNull();
    expect(norm('texto')).toBeNull();
    expect(norm(undefined)).toBeNull();
  });

  it('unifica el id desde mal_id/item_id', () => {
    expect(norm({ mal_id: 7 }).id).toBe(7);
    expect(norm({ item_id: 9 }).id).toBe(9);
  });

  it('prioriza titulo y cae en title/name/nombre', () => {
    expect(norm({ title: 'Naruto' }).titulo).toBe('Naruto');
    expect(norm({ name: 'Bleach' }).titulo).toBe('Bleach');
  });

  it('deriva la imagen desde images.webp cuando no hay img directa', () => {
    const item = { images: { webp: { large_image_url: 'x.webp' } } };
    expect(norm(item).img).toBe('x.webp');
  });

  it('normaliza año desde year', () => {
    expect(norm({ year: 2001 }).anio).toBe(2001);
  });
});

// ─── parseGeneros ─────────────────────────────────────────────────────────────

describe('parseGeneros', () => {
  const g = (i) => window.parseGeneros(i);

  it('devuelve [] para item vacío', () => {
    expect(g(null)).toEqual([]);
    expect(g({})).toEqual([]);
  });

  it('extrae nombres de un array de objetos', () => {
    expect(g({ generos: [{ name: 'Acción' }, { name: 'Aventura' }] }))
      .toEqual(['Acción', 'Aventura']);
  });

  it('acepta array de strings', () => {
    expect(g({ genres: ['Drama', 'Romance'] })).toEqual(['Drama', 'Romance']);
  });

  it('parsea un string separado por comas', () => {
    expect(g({ generos: 'Acción, Comedia , ' })).toEqual(['Acción', 'Comedia']);
  });

  it('usa info separada por "/" solo si hay más de una parte', () => {
    expect(g({ info: 'Manga / Shonen / Acción' })).toEqual(['Manga', 'Shonen', 'Acción']);
    expect(g({ info: 'Manga' })).toEqual([]);
  });
});

// ─── parseVolumenes ───────────────────────────────────────────────────────────

describe('parseVolumenes', () => {
  const v = (x) => window.parseVolumenes(x);

  it('null/undefined → 0', () => {
    expect(v(null)).toBe(0);
    expect(v(undefined)).toBe(0);
  });

  it('convierte números válidos positivos', () => {
    expect(v('12')).toBe(12);
    expect(v(5)).toBe(5);
  });

  it('valores no positivos o no numéricos → 0', () => {
    expect(v(0)).toBe(0);
    expect(v(-3)).toBe(0);
    expect(v('abc')).toBe(0);
  });
});

// ─── parseTemporadas / getAnimeStructure ──────────────────────────────────────

describe('parseTemporadas', () => {
  it('devuelve las temporadas explícitas si existen', () => {
    const t = [{ nombre: 'T1', episodios: 12 }];
    expect(window.parseTemporadas({ temporadas: t })).toBe(t);
  });

  it('sintetiza una temporada única desde el conteo de episodios', () => {
    expect(window.parseTemporadas({ episodios: 24 }))
      .toEqual([{ nombre: 'Temporada 1', episodios: 24 }]);
  });

  it('sin episodios → []', () => {
    expect(window.parseTemporadas({})).toEqual([]);
  });
});

describe('getAnimeStructure', () => {
  it('suma episodios de todas las temporadas', () => {
    const s = window.getAnimeStructure({ temporadas: [
      { episodios: 12 }, { episodios: 13 }
    ] });
    expect(s.temporadasCount).toBe(2);
    expect(s.capitulos).toBe(25);
  });

  it('estructura vacía para item nulo', () => {
    expect(window.getAnimeStructure(null)).toEqual({
      temporadas: [], temporadasCount: 0, ovas: 0, peliculas: 0, capitulos: 0
    });
  });
});

// ─── getApiUnifiedProgress ────────────────────────────────────────────────────

describe('getApiUnifiedProgress', () => {
  it('anime: cuenta episodios vistos y calcula porcentaje', () => {
    const uid = 'u1', id = 'a1';
    // 2 de 4 episodios vistos en la temporada 0
    window.UserStore.setItem(window.episodeStorageKey(uid, id, 0, 1), '1');
    window.UserStore.setItem(window.episodeStorageKey(uid, id, 0, 2), '1');
    const r = window.getApiUnifiedProgress(uid, id, 4, 'anime');
    expect(r).toEqual({ watched: 2, pct: 50 });
  });

  it('manga: cuenta volúmenes vistos', () => {
    const uid = 'u1', id = 'm1';
    window.UserStore.setItem(window.volumeStorageKey(uid, id, 1, 'manga'), '1');
    const r = window.getApiUnifiedProgress(uid, id, 5, 'manga');
    expect(r).toEqual({ watched: 1, pct: 20 });
  });

  it('sin total devuelve 0%', () => {
    expect(window.getApiUnifiedProgress('u1', 'x', 0, 'manga')).toEqual({ watched: 0, pct: 0 });
  });
});
