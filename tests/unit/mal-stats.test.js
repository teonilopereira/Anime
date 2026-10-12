/**
 * tests/unit/mal-stats.test.js
 * Tests para js/detalle/mal-stats.js → window.DetalleMal
 *
 * Cubre:
 *  - normalizar: se queda con puntaje/rank/miembros y descarta obras sin puntaje
 *  - obtener:    endpoint anime/manga, caché de 24 h (también del 404), sin
 *                caché de errores transitorios, ids inválidos y dedupe en vuelo
 *  - htmlLinea:  solo enlaza a myanimelist.net y escapa
 */

import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/detalle/mal-stats.js');
});

const M = () => window.DetalleMal;

function ok(data) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data }) });
}
function http(status) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });
}
const FRIEREN = { score: 9.3, scored_by: 600000, rank: 1, members: 1200000, url: 'https://myanimelist.net/anime/52991/Sousou_no_Frieren' };

beforeEach(() => { localStorage.clear(); });

describe('normalizar', () => {
  it('se queda con lo que se muestra', () => {
    expect(M().normalizar({ data: FRIEREN })).toEqual({
      score: 9.3, scoredBy: 600000, rank: 1, members: 1200000, url: FRIEREN.url
    });
  });
  it('sin puntaje no hay nada que mostrar', () => {
    expect(M().normalizar({ data: { score: null } })).toBeNull();
    expect(M().normalizar({})).toBeNull();
  });
});

describe('obtener', () => {
  it('pide anime o manga según el tipo y cachea', async () => {
    global.fetch = vi.fn(() => ok(FRIEREN));
    const a = await M().obtener(52991, 'anime');
    expect(a.score).toBe(9.3);
    expect(fetch.mock.calls[0][0]).toBe('https://api.jikan.moe/v4/anime/52991');
    await M().obtener(52991, 'anime');
    expect(fetch).toHaveBeenCalledTimes(1);

    await M().obtener(2, 'manga');
    expect(fetch.mock.calls[1][0]).toBe('https://api.jikan.moe/v4/manga/2');
  });

  it('cachea el 404 pero no un 429', async () => {
    global.fetch = vi.fn(() => http(404));
    expect(await M().obtener(10, 'anime')).toBeNull();
    expect(await M().obtener(10, 'anime')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);

    global.fetch = vi.fn(() => http(429));
    await expect(M().obtener(11, 'anime')).rejects.toThrow();
    await expect(M().obtener(11, 'anime')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ignora ids inválidos sin pedir nada', async () => {
    global.fetch = vi.fn(() => ok(FRIEREN));
    expect(await M().obtener(null)).toBeNull();
    expect(await M().obtener('abc')).toBeNull();
    expect(await M().obtener(0)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('dos llamadas seguidas comparten el request', async () => {
    global.fetch = vi.fn(() => ok(FRIEREN));
    await Promise.all([M().obtener(5, 'anime'), M().obtener(5, 'anime')]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('htmlLinea', () => {
  it('vacía sin datos', () => {
    expect(M().htmlLinea(null)).toBe('');
  });
  it('enlaza a MAL con puntaje y puesto', () => {
    const html = M().htmlLinea(M().normalizar({ data: FRIEREN }));
    expect(html).toContain('href="https://myanimelist.net/anime/52991/Sousou_no_Frieren"');
    expect(html).toContain('MAL 9.30 · #1');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('no enlaza a otros dominios', () => {
    const html = M().htmlLinea({ score: 7, scoredBy: 0, rank: 0, members: 0, url: 'javascript:alert(1)' });
    expect(html).not.toContain('href');
    expect(html).toContain('MAL 7.00');
  });
});
