/**
 * tests/unit/recommendations.test.js
 * "Si te gustó esto" de la ficha.
 *
 * Cubre:
 *  - api.js:            el normalizador mapea recommendations y descarta +18,
 *                       votos negativos y nodos sin obra
 *  - render-sections.js: buildRecommendationsHtml no repite obras que ya están
 *                       en Relacionados/Temporadas, arma el link con la
 *                       categoría correcta y escapa el título
 */

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/core/constants.js');
  await import('../../js/core/genres.js');
  await import('../../js/core/api.js');
  // render-sections.js declara funciones globales sueltas (no es un IIFE):
  // se evalúa en el scope global igual que lo hace el <script> de la página.
  const src = fs.readFileSync(path.resolve(__dirname, '../../js/detalle/render-sections.js'), 'utf8');
  (0, eval)(src);
});

function rec(id, extra) {
  return {
    rating: 10,
    mediaRecommendation: Object.assign({
      id, type: 'ANIME', format: 'TV', seasonYear: 2020, episodes: 12,
      isAdult: false, title: { english: 'Obra ' + id, romaji: 'Obra ' + id },
      coverImage: { large: 'https://s4.anilist.co/' + id + '.jpg' }
    }, extra || {})
  };
}

describe('normalizador (getAnimeById)', () => {
  it('mapea las recomendaciones y descarta las que no sirven', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200, headers: { get: () => null },
      json: () => Promise.resolve({ data: { Media: {
        id: 1, idMal: 1, type: 'ANIME', format: 'TV', title: { english: 'Base' },
        coverImage: { large: '' },
        recommendations: { nodes: [
          rec(2),
          rec(3, { isAdult: true }),
          Object.assign(rec(4), { rating: -2 }),
          { rating: 5, mediaRecommendation: null },
          rec(5, { type: 'MANGA', format: 'NOVEL', episodes: null, chapters: 40 })
        ] }
      } } })
    }));
    const item = await window.getAnimeById(999001);
    expect(item.recommendations.map((r) => r.id)).toEqual([2, 5]);
    expect(item.recommendations[1]).toMatchObject({ type: 'MANGA', format: 'NOVEL', chapters: 40, title: 'Obra 5' });
  });
});

describe('buildRecommendationsHtml', () => {
  it('no pinta nada sin recomendaciones', () => {
    expect(buildRecommendationsHtml({ id: 1 }, null)).toBe('');
    expect(buildRecommendationsHtml({ id: 1, recommendations: [] }, null)).toBe('');
  });

  it('saltea las obras ya listadas en Relacionados y Temporadas', () => {
    const item = {
      id: 1,
      relations: [{ id: 2 }],
      seasons: [{ id: 3 }],
      recommendations: [
        { id: 2, type: 'ANIME', title: 'Rel' },
        { id: 3, type: 'ANIME', title: 'Temp' },
        { id: 4, type: 'ANIME', title: 'Cadena' },
        { id: 5, type: 'ANIME', format: 'TV', title: 'Nueva', seasonYear: 2021, episodes: 24 }
      ]
    };
    const html = buildRecommendationsHtml(item, { eslabones: [{ id: 4 }] });
    expect(html).toContain('Si te gustó esto');
    expect(html).toContain('id=5');
    expect(html).not.toMatch(/id=[234]"/);
    expect(html).toContain('2021 · 24 eps');
  });

  it('elige la categoría del link y escapa el título', () => {
    const html = buildRecommendationsHtml({ id: 1, recommendations: [
      { id: 7, type: 'MANGA', format: 'NOVEL', title: '<b>x</b>' },
      { id: 8, type: 'MANGA', format: 'MANGA', title: 'M' },
      { id: 9, type: 'ANIME', format: 'MOVIE', title: 'A' }
    ] }, null);
    expect(html).toContain('cat=novelas&id=7');
    expect(html).toContain('cat=manga&id=8');
    expect(html).toContain('cat=anime&id=9');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
