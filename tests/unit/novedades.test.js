/**
 * tests/unit/novedades.test.js
 * "Novedades para vos" → window.AppNovedades (js/core/novedades.js)
 *
 * Cubre:
 *  - _build:  dedupe por título, orden por fecha, ventana de ±7 días,
 *             exclusión de episodios ya vistos y de estrenos ya marcados,
 *             solo títulos seguidos (no "abandonado")
 *  - render:  sin sesión / sin seguidos → false y host oculto; con datos pinta,
 *             enlaza a la ficha y cachea en sessionStorage (no repite AniList)
 */

import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/novedades.js');
});

const N = () => window.AppNovedades;
const NOW = 1_800_000_000; // epoch en segundos
const DAY = 86400;

function st(id, extra) {
  return Object.assign({ item_id: String(id), category: 'anime', fav: 0, viewed: 0, watch_status: 'viendo', meta: { info: '' } }, extra || {});
}

describe('AppNovedades._build', () => {
  it('deduplica por título, ordena por fecha y respeta la ventana de 7 días', () => {
    const states = [st(1), st(2), st(3), st(4), st(5)];
    const schedule = [
      { id: 2, title: 'B', episode: 1, airingAt: NOW + 3 * DAY },
      { id: 1, title: 'A', episode: 1, airingAt: NOW + 1 * DAY },
      { id: 1, title: 'A', episode: 1, airingAt: NOW + 2 * DAY }, // duplicado
      { id: 3, title: 'C', episode: 1, airingAt: NOW + 10 * DAY }, // fuera de ventana
      { id: 4, title: 'D', episode: 5, airingAt: NOW - 1 * DAY },  // ya salió
      { id: 5, title: 'E', episode: 8, airingAt: NOW + 5 * DAY }   // salió el 7
    ];
    const { episodios } = N()._build({ states, schedule, now: NOW });
    expect(episodios.map((e) => e.id)).toEqual([4, 5, 1, 2]);
    expect(episodios.filter((e) => e.id === 1)).toHaveLength(1);
    expect(episodios[0]).toMatchObject({ kind: 'aired', episode: 5 });
    expect(episodios[1]).toMatchObject({ kind: 'aired', episode: 7, date: NOW - 2 * DAY });
    expect(episodios[2]).toMatchObject({ kind: 'upcoming', episode: 1, date: NOW + DAY });
    episodios.forEach((e) => expect(e.reason).toBeTruthy());
  });

  it('excluye episodios que el usuario ya marcó y títulos no seguidos', () => {
    const states = [st(1), st(2), st(3, { watch_status: 'abandonado' }), st(4, { category: 'manga' })];
    const schedule = [
      { id: 1, title: 'A', episode: 4, airingAt: NOW + DAY },  // ep 3 visto → solo "sale ep 4"
      { id: 2, title: 'B', episode: 6, airingAt: NOW - DAY },  // ep 6 visto → fuera
      { id: 3, title: 'C', episode: 2, airingAt: NOW + DAY },  // abandonado
      { id: 4, title: 'D', episode: 2, airingAt: NOW + DAY },  // es manga
      { id: 9, title: 'Z', episode: 2, airingAt: NOW + DAY }   // no está en listas
    ];
    const progress = [
      { category: 'anime', item_id: '1', pkey: 's:1|ep:3', value: 1 },
      { category: 'anime', item_id: '2', pkey: 's:1|ep:6', value: 1 }
    ];
    const { episodios } = N()._build({ states, schedule, progress, now: NOW });
    expect(episodios).toHaveLength(1);
    expect(episodios[0]).toMatchObject({ id: 1, kind: 'upcoming', episode: 4 });
  });

  it('estrenos: solo géneros de las listas, sin lo ya marcado ni repetidos', () => {
    const states = [
      st(1, { viewed: 1, meta: { info: 'Action|Fantasy' } }),
      st(2, { fav: 1, meta: { info: 'Action' } })
    ];
    const seasonal = [
      { id: 2, title: 'Ya en lista', genres: [{ name: 'Action' }] },
      { id: 10, title: 'Solo romance', genres: [{ name: 'Romance' }] },
      { id: 11, title: 'Fantasía', genres: [{ name: 'Fantasy' }] },
      { id: 12, title: 'Acción+Fantasía', genres: [{ name: 'Action' }, { name: 'Fantasy' }] },
      { id: 12, title: 'Acción+Fantasía', genres: [{ name: 'Action' }] }
    ];
    const { estrenos } = N()._build({ states, seasonal, schedule: [], now: NOW });
    expect(estrenos.map((e) => e.id)).toEqual([12, 11]);
    expect(estrenos[0].reason).toMatch(/Action|Acción/);
  });

  it('topGenres ignora géneros genéricos y desconocidos', () => {
    const g = N()._topGenres([
      st(1, { viewed: 1, meta: { info: 'Comedy|Mecha|Inventado' } }),
      st(2, { meta: { info: 'Horror' } })
    ]);
    expect(g).toEqual(['Mecha', 'Horror']);
  });
});

describe('AppNovedades.render', () => {
  let host;
  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '<section id="homeNovedades" hidden></section>';
    host = document.getElementById('homeNovedades');
    window.AppSupabaseReady = undefined;
  });

  function client(states) {
    return {
      isSignedIn: () => true,
      getCurrentUserSync: () => ({ id: 'u1' }),
      loadItemStates: vi.fn(async () => states),
      loadAllProgress: vi.fn(async () => [])
    };
  }

  it('sin sesión devuelve false y deja el host oculto', async () => {
    window.AppSupabase = null;
    expect(await N().render(host)).toBe(false);
    expect(host.hidden).toBe(true);
  });

  it('sin títulos seguidos devuelve false', async () => {
    window.AppSupabase = client([st(1, { watch_status: 'abandonado' })]);
    window.getAiringSchedule = vi.fn(async () => []);
    expect(await N().render(host)).toBe(false);
    expect(host.hidden).toBe(true);
    expect(window.getAiringSchedule).not.toHaveBeenCalled();
  });

  it('pinta, enlaza a la ficha y cachea la respuesta de AniList', async () => {
    const now = Math.floor(Date.now() / 1000);
    window.AppSupabase = client([st(7, { meta: { info: 'Action' } })]);
    window.getAiringSchedule = vi.fn(async () => [{ id: 7, title: 'Siete', img: '', episode: 3, airingAt: now + DAY }]);
    window.getTopAnimes = vi.fn(async () => [{ id: 70, title: '<b>Nuevo</b>', genres: [{ name: 'Action' }], images: { jpg: { image_url: 'x.jpg' } } }]);

    expect(await N().render(host)).toBe(true);
    expect(host.hidden).toBe(false);
    const hrefs = [...host.querySelectorAll('a.wcard')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['detalle.html?cat=anime&id=7', 'detalle.html?cat=anime&id=70']);
    // El título viene de AniList: se escapa, no se interpreta como HTML.
    expect(host.querySelector('b')).toBeNull();
    expect(host.querySelectorAll('.wcard-title')[1].textContent).toBe('<b>Nuevo</b>');
    host.querySelectorAll('.wcard-meta').forEach((m) => expect(m.textContent).toBeTruthy());
    expect(window.getTopAnimes).toHaveBeenCalledWith(1, { browse: 'temporada', genres: ['Action'] });

    expect(await N().render(host)).toBe(true);
    expect(window.getAiringSchedule).toHaveBeenCalledTimes(1);
    expect(window.getTopAnimes).toHaveBeenCalledTimes(1);
  });
});
