/**
 * tests/unit/validator.test.js
 * Tests para js/security/validator.js
 *
 * Cubre:
 *  - isValidCategory: acepta solo categorías conocidas
 *  - isValidId:       acepta IDs numéricos o con prefijo de letra
 *  - getSafeCategory: devuelve fallback para valores inválidos
 *  - getSafeUrlParams: parsea y sanitiza parámetros de URL
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/validator.js');
});

// ─── isValidCategory ──────────────────────────────────────────────────────────

describe('AppValidator.isValidCategory', () => {
  let isValidCategory;
  beforeAll(() => { ({ isValidCategory } = window.AppValidator); });

  it.each(['anime', 'manga', 'novelas', 'detalle'])(
    'acepta la categoría válida "%s"',
    (cat) => expect(isValidCategory(cat)).toBe(true)
  );

  it('acepta categoría en mayúsculas (case-insensitive)', () => {
    expect(isValidCategory('ANIME')).toBe(true);
    expect(isValidCategory('Manga')).toBe(true);
  });

  it('rechaza categoría desconocida', () => {
    expect(isValidCategory('peliculas')).toBe(false);
  });

  it('rechaza cadena vacía', () => {
    expect(isValidCategory('')).toBe(false);
  });

  it('rechaza null', () => {
    expect(isValidCategory(null)).toBe(false);
  });

  it('rechaza undefined', () => {
    expect(isValidCategory(undefined)).toBe(false);
  });
});

// ─── isValidId ────────────────────────────────────────────────────────────────

describe('AppValidator.isValidId', () => {
  let isValidId;
  beforeAll(() => { ({ isValidId } = window.AppValidator); });

  it('acepta IDs puramente numéricos', () => {
    expect(isValidId('123')).toBe(true);
    expect(isValidId('1')).toBe(true);
  });

  it('acepta IDs con un prefijo de letra seguido de número', () => {
    expect(isValidId('a1')).toBe(true);
    expect(isValidId('M99')).toBe(true);
  });

  it('rechaza IDs vacíos', () => {
    expect(isValidId('')).toBe(false);
  });

  it('rechaza IDs con caracteres especiales', () => {
    expect(isValidId('abc-123')).toBe(false);
    expect(isValidId('../etc')).toBe(false);
  });

  it('rechaza IDs con solo letras (sin número)', () => {
    expect(isValidId('abc')).toBe(false);
  });

  it('rechaza null y undefined', () => {
    expect(isValidId(null)).toBe(false);
    expect(isValidId(undefined)).toBe(false);
  });
});

// ─── getSafeCategory ──────────────────────────────────────────────────────────

describe('AppValidator.getSafeCategory', () => {
  let getSafeCategory;
  beforeAll(() => { ({ getSafeCategory } = window.AppValidator); });

  it('devuelve la categoría si es válida', () => {
    expect(getSafeCategory('anime')).toBe('anime');
    expect(getSafeCategory('manga')).toBe('manga');
  });

  it('devuelve el fallback por defecto ("manga") para valor inválido', () => {
    expect(getSafeCategory('peliculas')).toBe('manga');
  });

  it('devuelve el fallback personalizado', () => {
    expect(getSafeCategory('peliculas', 'anime')).toBe('anime');
  });

  it('normaliza a minúsculas antes de validar', () => {
    expect(getSafeCategory('ANIME')).toBe('anime');
  });
});

// ─── getSafeUrlParams ─────────────────────────────────────────────────────────

describe('AppValidator.getSafeUrlParams', () => {
  let getSafeUrlParams;
  beforeAll(() => { ({ getSafeUrlParams } = window.AppValidator); });

  it('parsea parámetros válidos correctamente', () => {
    const result = getSafeUrlParams('?id=123&cat=anime&nombre=Naruto');
    expect(result.id).toBe('123');
    expect(result.cat).toBe('anime');
    expect(result.nombre).toBe('Naruto');
  });

  it('descarta un id inválido (devuelve cadena vacía)', () => {
    const result = getSafeUrlParams('?id=../malicious&cat=manga');
    expect(result.id).toBe('');
  });

  it('usa fallback "manga" para cat inválida', () => {
    const result = getSafeUrlParams('?id=1&cat=peliculas');
    expect(result.cat).toBe('manga');
  });

  it('acepta el alias "categoria" en lugar de "cat"', () => {
    const result = getSafeUrlParams('?id=5&categoria=novelas');
    expect(result.cat).toBe('novelas');
  });

  it('devuelve valores seguros ante query string vacía', () => {
    const result = getSafeUrlParams('');
    expect(result.id).toBe('');
    expect(result.cat).toBe('manga');
    expect(result.nombre).toBe('');
  });
});
