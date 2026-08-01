/**
 * tests/unit/comparar.test.js
 * Tests para los formatters puros de js/pages/comparar.js
 *
 * Cubre:
 *  - esIdValido:          acepta ids numéricos de AniList y UUID de MangaDex
 *  - parseParams:         saneo de cat/id desde la URL
 *  - formatCompactNumber / formatMinutes / formatScore / formatCount: formateo
 *  - formatMediaFormat:   traducción de enums de formato
 *  - autorDe / periodoDe / formatoRestante: derivación de metadatos
 *  - categoryIcon / categoryLabel: mapeo de categoría
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/pages/comparar.js');
});

describe('esIdValido', () => {
  it('acepta id numérico de AniList', () => {
    expect(window.esIdValido('12345')).toBe(true);
  });

  it('acepta UUID de MangaDex', () => {
    expect(window.esIdValido('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('rechaza basura', () => {
    expect(window.esIdValido('no-id')).toBe(false);
    expect(window.esIdValido('')).toBe(false);
  });
});

describe('parseParams', () => {
  it('devuelve valores por defecto sin parámetros', () => {
    const p = window.parseParams();
    expect(p).toEqual({ cat1: 'anime', id1: '', cat2: 'anime', id2: '' });
  });
});

describe('formatCompactNumber', () => {
  it('abrevia millones y miles', () => {
    expect(window.formatCompactNumber(1_200_000)).toBe('1.2M');
    expect(window.formatCompactNumber(2000)).toBe('2K');
    expect(window.formatCompactNumber(1_000_000)).toBe('1M');
  });

  it('deja los números chicos tal cual', () => {
    expect(window.formatCompactNumber(999)).toBe('999');
  });

  it('valores no positivos → guion', () => {
    expect(window.formatCompactNumber(0)).toBe('—');
    expect(window.formatCompactNumber('x')).toBe('—');
  });
});

describe('formatMinutes', () => {
  it('menos de una hora en minutos', () => {
    expect(window.formatMinutes(24)).toBe('24 min');
  });

  it('una hora exacta sin minutos sueltos', () => {
    expect(window.formatMinutes(120)).toBe('2h');
  });

  it('horas y minutos', () => {
    expect(window.formatMinutes(90)).toBe('1h 30m');
  });

  it('inválido → guion', () => {
    expect(window.formatMinutes(0)).toBe('—');
  });
});

describe('formatScore / formatCount', () => {
  it('formatScore muestra un decimal sobre 10', () => {
    expect(window.formatScore(8)).toBe('8.0/10');
  });

  it('formatScore inválido → guion', () => {
    expect(window.formatScore(0)).toBe('—');
  });

  it('formatCount devuelve enteros positivos o guion', () => {
    expect(window.formatCount(42)).toBe('42');
    expect(window.formatCount(-1)).toBe('—');
  });
});

describe('formatMediaFormat', () => {
  it('traduce enums conocidos normalizando espacios/guiones', () => {
    // FORMATOS se indexa por la clave en MAYÚSCULAS con "_"
    expect(window.formatMediaFormat('TV')).toBeTruthy();
  });

  it('devuelve el original si no está mapeado', () => {
    expect(window.formatMediaFormat('DESCONOCIDO')).toBe('DESCONOCIDO');
  });
});

describe('autorDe', () => {
  it('prefiere el rol "Story"', () => {
    const item = { staff: [{ role: 'Art', name: 'B' }, { role: 'Story', name: 'A' }] };
    expect(window.autorDe(item)).toBe('A');
  });

  it('cae en el primer miembro del staff', () => {
    expect(window.autorDe({ staff: [{ role: 'Editor', name: 'X' }] })).toBe('X');
  });

  it('sin staff → guion', () => {
    expect(window.autorDe({})).toBe('—');
  });
});

describe('periodoDe', () => {
  it('rango cerrado', () => {
    expect(window.periodoDe({ startYear: 2016, endYear: 2019 })).toBe('2016 – 2019');
  });

  it('mismo año de inicio y fin muestra solo uno', () => {
    expect(window.periodoDe({ startYear: 2020, endYear: 2020 })).toBe('2020');
  });

  it('en emisión muestra "– hoy"', () => {
    expect(window.periodoDe({ startYear: 1999, status: 'RELEASING' })).toBe('1999 – hoy');
  });

  it('sin año → guion', () => {
    expect(window.periodoDe({})).toBe('—');
  });
});

describe('formatoRestante', () => {
  it('días y horas', () => {
    const ms = (2 * 1440 + 3 * 60) * 60000; // 2d 3h
    expect(window.formatoRestante(ms)).toBe('2d 3h');
  });

  it('horas y minutos', () => {
    expect(window.formatoRestante((90) * 60000)).toBe('1h 30m');
  });

  it('solo minutos', () => {
    expect(window.formatoRestante(5 * 60000)).toBe('5m');
  });
});

describe('categoryIcon / categoryLabel', () => {
  it('iconos por categoría', () => {
    expect(window.categoryIcon('anime')).toBe('clapperboard');
    expect(window.categoryIcon('novelas')).toBe('book-open');
    expect(window.categoryIcon('manga')).toBe('book');
  });

  it('etiquetas por categoría', () => {
    expect(window.categoryLabel('anime')).toBe('Anime');
    expect(window.categoryLabel('novelas')).toBe('Novela');
    expect(window.categoryLabel('manga')).toBe('Manga');
  });
});
