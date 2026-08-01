/**
 * tests/unit/mis-listas.test.js
 * Tests para los helpers puros de js/pages/mis-listas.js
 *
 * mis-listas.js es el hotspot #1 del diagnóstico (viz/arbol-diagnostico.html):
 * 1491 líneas y sin cobertura. Estos tests cubren su lógica pura —filtros,
 * géneros, franquicias y el calendario— para bajar ese riesgo.
 *
 * Cubre:
 *  - extractGenresFromInfo: extrae solo géneros conocidos desde un string
 *  - topGenresFromEntries:  ranking de géneros ponderando "visto" x2
 *  - franquiciaVista:       pertenencia por ids de franquicia (incl. UUID)
 *  - matchesFilter:         semántica de cada filtro de la lista
 *  - calendarDayLabel / calendarCountdown: etiquetas y cuenta regresiva
 */

import { beforeAll, describe, it, expect, vi, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/pages/mis-listas.js');
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── extractGenresFromInfo ────────────────────────────────────────────────────

describe('extractGenresFromInfo', () => {
  const g = (s) => window.extractGenresFromInfo(s);

  it('devuelve [] para entradas vacías', () => {
    expect(g('')).toEqual([]);
    expect(g(null)).toEqual([]);
  });

  it('reconoce géneros conocidos separados por |, / o ,', () => {
    expect(g('Action | Comedy')).toEqual(['Action', 'Comedy']);
    expect(g('Drama/Romance')).toEqual(['Drama', 'Romance']);
  });

  it('descarta tokens que no son géneros conocidos', () => {
    expect(g('Action, TV, 24 eps, Fantasy')).toEqual(['Action', 'Fantasy']);
  });

  it('normaliza mayúsculas/minúsculas al canónico conocido', () => {
    expect(g('action')).toEqual(['Action']);
  });
});

// ─── topGenresFromEntries ─────────────────────────────────────────────────────

describe('topGenresFromEntries', () => {
  it('ordena por frecuencia ponderada (visto pesa el doble)', () => {
    const entries = [
      { viewed: true,  item: { info: 'Action' } },   // Action +2
      { viewed: false, item: { info: 'Comedy' } },   // Comedy +1
      { viewed: false, item: { info: 'Action' } }    // Action +1 → 3 total
    ];
    expect(window.topGenresFromEntries(entries)).toEqual(['Action', 'Comedy']);
  });

  it('devuelve [] sin entradas', () => {
    expect(window.topGenresFromEntries([])).toEqual([]);
  });
});

// ─── franquiciaVista ──────────────────────────────────────────────────────────

describe('franquiciaVista', () => {
  it('true si algún id de la franquicia está en el set de vistos', () => {
    const vistos = new Set(['20']); // Naruto
    expect(window.franquiciaVista(vistos, 'naruto')).toBe(true);
  });

  it('acepta el UUID de MangaDex (Berserk)', () => {
    const vistos = new Set(['801513ba-a712-498c-8f57-cae55b38cc92']);
    expect(window.franquiciaVista(vistos, 'berserk')).toBe(true);
  });

  it('false si ningún id coincide o la clave no existe', () => {
    expect(window.franquiciaVista(new Set(['999']), 'naruto')).toBe(false);
    expect(window.franquiciaVista(new Set(['20']), 'inexistente')).toBe(false);
  });
});

// ─── matchesFilter ────────────────────────────────────────────────────────────

describe('matchesFilter', () => {
  const f = (entry, mode) => window.matchesFilter(entry, mode);

  it('FAV / VIEWED filtran por su flag', () => {
    expect(f({ fav: true }, 'fav')).toBe(true);
    expect(f({ fav: false }, 'fav')).toBe(false);
    expect(f({ viewed: true }, 'viewed')).toBe(true);
  });

  it('WATCHING y PLANNED filtran por estado de seguimiento', () => {
    expect(f({ wstatus: 'viendo' }, 'viendo')).toBe(true);
    expect(f({ wstatus: 'pendiente' }, 'pendiente')).toBe(true);
    expect(f({ wstatus: 'viendo' }, 'pendiente')).toBe(false);
  });

  it('DROPPED agrupa abandonado y pausado', () => {
    expect(f({ wstatus: 'abandonado' }, 'abandonado')).toBe(true);
    expect(f({ wstatus: 'pausado' }, 'abandonado')).toBe(true);
    expect(f({ wstatus: 'viendo' }, 'abandonado')).toBe(false);
  });

  it('ALL (default) acepta cualquier entrada con algún estado', () => {
    expect(f({ fav: true }, 'all')).toBe(true);
    expect(f({ wstatus: 'pendiente' }, 'all')).toBe(true); // !!wstatus
    expect(f({ fav: false, viewed: false, wstatus: '' }, 'all')).toBe(false);
  });
});

// ─── calendario ───────────────────────────────────────────────────────────────

describe('calendarDayLabel', () => {
  it('"Hoy" para una fecha del mismo día', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00'));
    const hoyMasTarde = new Date('2026-08-01T22:00:00').getTime();
    expect(window.calendarDayLabel(hoyMasTarde)).toBe('Hoy');
  });

  it('"Mañana" para el día siguiente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00'));
    const manana = new Date('2026-08-02T09:00:00').getTime();
    expect(window.calendarDayLabel(manana)).toBe('Mañana');
  });
});

describe('calendarCountdown', () => {
  it('"¡Ya disponible!" cuando la fecha ya pasó', () => {
    expect(window.calendarCountdown(Date.now() - 1000)).toBe('¡Ya disponible!');
  });

  it('formatea la cuenta regresiva en la mayor unidad útil', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00'));
    const en2h30 = Date.now() + (150 * 60000);
    expect(window.calendarCountdown(en2h30)).toBe('en 2h 30m');
    const en3d = Date.now() + (3 * 1440 + 4 * 60) * 60000;
    expect(window.calendarCountdown(en3d)).toBe('en 3d 4h');
  });
});
