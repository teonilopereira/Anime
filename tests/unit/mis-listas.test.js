/**
 * tests/unit/mis-listas.test.js
 * Tests para la lógica pura de js/pages/mis-listas.js → window.MisListasPure
 *
 * Cubre:
 *  - extractGenresFromInfo:  parseo de la cadena de info a géneros conocidos
 *  - topGenresFromEntries:   ranking de géneros con peso (visto pesa más)
 *  - franquiciaVista:        detección de franquicia por ids marcados como vistos
 */
import { beforeAll, describe, it, expect } from 'vitest';

let P;
beforeAll(async () => {
  await import('../../js/pages/mis-listas.js');
  P = window.MisListasPure;
});

describe('extractGenresFromInfo', () => {
  it('devuelve [] con entrada vacía o nula', () => {
    expect(P.extractGenresFromInfo('')).toEqual([]);
    expect(P.extractGenresFromInfo(null)).toEqual([]);
    expect(P.extractGenresFromInfo(undefined)).toEqual([]);
  });

  it('extrae géneros conocidos separados por | / o ,', () => {
    expect(P.extractGenresFromInfo('Action | Comedy / Drama, Romance'))
      .toEqual(['Action', 'Comedy', 'Drama', 'Romance']);
  });

  it('ignora tokens que no son géneros conocidos', () => {
    expect(P.extractGenresFromInfo('Action | TV | 24 eps | Finalizado'))
      .toEqual(['Action']);
  });

  it('normaliza el casing al valor canónico de KNOWN_GENRES', () => {
    expect(P.extractGenresFromInfo('action, sci-fi')).toEqual(['Action', 'Sci-Fi']);
  });

  it('recorta espacios alrededor de cada token', () => {
    expect(P.extractGenresFromInfo('  Comedy  ,  Horror  ')).toEqual(['Comedy', 'Horror']);
  });
});

describe('topGenresFromEntries', () => {
  it('devuelve [] sin entradas', () => {
    expect(P.topGenresFromEntries([])).toEqual([]);
  });

  it('ordena por frecuencia descendente', () => {
    const entries = [
      { item: { info: 'Action | Comedy' } },
      { item: { info: 'Action | Drama' } },
      { item: { info: 'Action' } },
    ];
    // Action aparece 3 veces, el resto 1 → Action primero
    expect(P.topGenresFromEntries(entries)[0]).toBe('Action');
  });

  it('"visto" pesa el doble que "me gusta"', () => {
    const entries = [
      { viewed: true, item: { info: 'Horror' } },       // peso 2
      { viewed: false, item: { info: 'Comedy' } },      // peso 1
      { viewed: false, item: { info: 'Comedy' } },      // peso 1 → Comedy total 2
    ];
    // Horror (2) y Comedy (2) empatan; ambos deben estar presentes
    const top = P.topGenresFromEntries(entries);
    expect(top).toContain('Horror');
    expect(top).toContain('Comedy');
  });

  it('tolera entradas sin item o sin info', () => {
    const entries = [{ }, { item: {} }, { item: { info: 'Action' } }];
    expect(P.topGenresFromEntries(entries)).toEqual(['Action']);
  });
});

describe('franquiciaVista', () => {
  it('true si algún id de la franquicia está en el set de vistos', () => {
    const vistos = new Set(['16498']); // AoT S1
    expect(P.franquiciaVista(vistos, 'aot')).toBe(true);
  });

  it('false si ninguno está', () => {
    expect(P.franquiciaVista(new Set(['999999']), 'aot')).toBe(false);
  });

  it('compara como string (ids numéricos y UUID)', () => {
    expect(P.franquiciaVista(new Set(['30002']), 'berserk')).toBe(true);
    expect(P.franquiciaVista(new Set(['801513ba-a712-498c-8f57-cae55b38cc92']), 'berserk')).toBe(true);
  });

  it('false para una clave de franquicia inexistente', () => {
    expect(P.franquiciaVista(new Set(['20']), 'no_existe')).toBe(false);
  });
});
