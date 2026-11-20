/**
 * tests/unit/mangadex-volume-covers.test.js
 * Tests para js/core/mangadex-api.js → portadas por tomo de la página de
 * volúmenes (resolveMangaDexVolumeDetails) y su pintado (paintMangaDexCovers).
 *
 * Cubre:
 *  - emparejado tomo ↔ portada: "1", "01", "1.0" son el mismo tomo
 *  - portadas sin tomo ("" / null / espacios) no se cargan como tomo "0"
 *  - prioridad de idioma: con varias ediciones de un tomo gana la del idioma
 *    de la app
 *  - paginación del /cover más allá de 100 portadas
 *  - tomos con portada que el aggregate no lista (licenciados/retirados):
 *    igual reciben su portada, sin inventar capítulos
 *  - si el aggregate falla, las portadas se devuelven igual
 *  - URL armada como {MD_COVER_BASE}/{mangaId}/{fileName}
 *  - pintado: miniatura .256.jpg y, si no existe, el original
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const MANGA = '11111111-2222-3333-4444-555555555555';

function cover(volume, fileName, locale) {
  return { type: 'cover_art', attributes: { volume, fileName, locale: locale || 'ja' } };
}

/** mdFetch falso: responde /cover paginado, /aggregate y /manga/{id}. */
function stubMdFetch({ covers = [], aggregate = null, aggregateError = false } = {}) {
  window.mdFetch = vi.fn((path) => {
    if (path.indexOf('/cover?') === 0) {
      const offset = Number((path.match(/[?&]offset=(\d+)/) || [])[1] || 0);
      const limit = Number((path.match(/[?&]limit=(\d+)/) || [])[1] || 100);
      return Promise.resolve({ data: covers.slice(offset, offset + limit), total: covers.length });
    }
    if (/\/aggregate$/.test(path)) {
      if (aggregateError) return Promise.reject(new Error('aggregate caído'));
      return Promise.resolve({ volumes: aggregate || {} });
    }
    // /manga/{id}: sin ediciones alternativas.
    return Promise.resolve({ data: { relationships: [] } });
  });
}

beforeAll(async () => {
  window.MD_COVER_BASE = 'https://uploads.mangadex.org/covers';
  await import('../../js/core/mangadex-api.js');
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pref:lang', 'es');
});

describe('resolveMangaDexVolumeDetails: portadas por tomo', () => {
  it('normaliza "01" y "1.0" al tomo 1 y arma la URL con el id y el archivo', async () => {
    stubMdFetch({
      covers: [cover('01', 'uno.jpg'), cover('2.0', 'dos.png')],
      aggregate: { '1': { chapters: { '1': {}, '2': {} } }, '2': { chapters: { '3': {} } } }
    });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out['1'].cover).toBe('https://uploads.mangadex.org/covers/' + MANGA + '/uno.jpg');
    expect(out['2'].cover).toBe('https://uploads.mangadex.org/covers/' + MANGA + '/dos.png');
    expect(out['1'].count).toBe(2);
  });

  it('una portada sin tomo ("", null, espacios) no queda como tomo "0"', async () => {
    stubMdFetch({
      covers: [cover('', 'suelta.jpg'), cover(null, 'nula.jpg'), cover('  ', 'blanca.jpg'), cover('1', 'uno.jpg')],
      aggregate: { '1': { chapters: { '1': {} } } }
    });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out['0']).toBeUndefined();
    expect(Object.keys(out)).toEqual(['1']);
  });

  it('elige la portada del idioma de la app aunque llegue después', async () => {
    stubMdFetch({
      covers: [cover('1', 'kazajo.jpg', 'kk'), cover('1', 'japo.jpg', 'ja'), cover('1', 'latam.jpg', 'es-la')],
      aggregate: { '1': { chapters: { '1': {} } } }
    });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out['1'].cover).toMatch(/\/latam\.jpg$/);
  });

  it('recorre las páginas del /cover más allá de las primeras 100', async () => {
    const covers = [];
    for (let v = 1; v <= 150; v++) covers.push(cover(String(v), 'v' + v + '.jpg'));
    stubMdFetch({ covers, aggregate: { '1': { chapters: { '1': {} } } } });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out['150'].cover).toMatch(/\/v150\.jpg$/);
    const coverCalls = window.mdFetch.mock.calls.filter((c) => c[0].indexOf('/cover?') === 0);
    expect(coverCalls.length).toBe(2);
  });

  it('da portada a los tomos que el aggregate no lista, sin inventar capítulos', async () => {
    // Caso Bleach: 74 tomos con portada, el aggregate solo trae el 1 y el 39.
    stubMdFetch({
      covers: [cover('1', 'uno.jpg'), cover('2', 'dos.jpg'), cover('39', 'treintainueve.jpg')],
      aggregate: { '1': { chapters: { '1': {} } }, '39': { chapters: { '340': {} } }, none: { chapters: { '700': {} } } }
    });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out['2']).toEqual({ count: 0, first: null, last: null, cover: expect.stringMatching(/\/dos\.jpg$/) });
    expect(out['39'].first).toBe(340);
    expect(out.none).toBeUndefined();
  });

  it('si el aggregate falla devuelve igual las portadas', async () => {
    stubMdFetch({ covers: [cover('3', 'tres.jpg')], aggregateError: true });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out['3'].cover).toMatch(/\/tres\.jpg$/);
  });

  it('sin portadas y sin aggregate devuelve null (la página queda genérica)', async () => {
    stubMdFetch({ covers: [], aggregateError: true });
    const out = await window.resolveMangaDexVolumeDetails({ id: MANGA });
    expect(out).toBeNull();
  });
});

describe('paintMangaDexCovers', () => {
  let OrigImage;
  beforeEach(() => { OrigImage = window.Image; });
  afterEach(() => { window.Image = OrigImage; });

  function fakeImage(fails) {
    window.Image = function () {
      const pre = {};
      Object.defineProperty(pre, 'src', {
        set(v) { this._src = v; setTimeout(() => (fails(v) ? pre.onerror() : pre.onload()), 0); },
        get() { return this._src; }
      });
      return pre;
    };
  }

  it('usa la miniatura de 256 px y guarda el original en data-full', async () => {
    fakeImage(() => false);
    const img = document.createElement('img');
    await window.paintMangaDexCovers([{ img, url: 'https://uploads.mangadex.org/covers/x/a.jpg' }]);
    expect(img.getAttribute('src')).toBe('https://uploads.mangadex.org/covers/x/a.jpg.256.jpg');
    expect(img.getAttribute('data-full')).toBe('https://uploads.mangadex.org/covers/x/a.jpg');
  });

  it('si la miniatura no existe cae al original', async () => {
    fakeImage((src) => /\.256\.jpg$/.test(src));
    const img = document.createElement('img');
    await window.paintMangaDexCovers([{ img, url: 'https://uploads.mangadex.org/covers/x/b.png' }]);
    expect(img.getAttribute('src')).toBe('https://uploads.mangadex.org/covers/x/b.png');
  });
});
