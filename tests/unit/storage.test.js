/**
 * tests/unit/storage.test.js
 * Tests para js/core/storage.js → window.AppStorage
 *
 * Cubre:
 *  - read/write:       roundtrip con prefijo aplicado
 *  - readJson:         parseo, fallback y datos corruptos
 *  - writeJson:        serialización de objetos
 *  - remove:           borrado de claves
 *  - robustez:         no lanza aunque localStorage falle
 */

import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

const PREFIX = 'animeDestiny';

beforeAll(async () => {
  await import('../../js/core/storage.js');
});

beforeEach(() => {
  localStorage.clear();
});

const S = () => window.AppStorage;

describe('AppStorage.write / read', () => {
  it('guarda y recupera un valor con el prefijo aplicado', () => {
    S().write('foo', 'bar');
    expect(S().read('foo')).toBe('bar');
    // La clave real en localStorage lleva el prefijo
    expect(localStorage.getItem(PREFIX + ':foo')).toBe('bar');
  });

  it('convierte valores no-string a string al escribir', () => {
    S().write('num', 42);
    expect(S().read('num')).toBe('42');
  });

  it('read devuelve null para una clave inexistente', () => {
    expect(S().read('no-existe')).toBeNull();
  });
});

describe('AppStorage.readJson / writeJson', () => {
  it('serializa y recupera un objeto', () => {
    const obj = { a: 1, b: [2, 3], c: 'texto' };
    S().writeJson('data', obj);
    expect(S().readJson('data')).toEqual(obj);
  });

  it('devuelve el fallback cuando la clave no existe', () => {
    const fb = { vacio: true };
    expect(S().readJson('nada', fb)).toEqual(fb);
  });

  it('devuelve null cuando no hay clave ni fallback', () => {
    expect(S().readJson('nada')).toBeNull();
  });

  it('devuelve el fallback si el JSON almacenado está corrupto', () => {
    localStorage.setItem(PREFIX + ':roto', '{ no es json }');
    const fb = ['seguro'];
    expect(S().readJson('roto', fb)).toEqual(fb);
  });
});

describe('AppStorage.remove', () => {
  it('elimina una clave existente', () => {
    S().write('temp', '1');
    expect(S().read('temp')).toBe('1');
    S().remove('temp');
    expect(S().read('temp')).toBeNull();
  });

  it('no lanza al eliminar una clave inexistente', () => {
    expect(() => S().remove('fantasma')).not.toThrow();
  });
});

describe('AppStorage robustez', () => {
  it('la API está congelada (Object.freeze)', () => {
    expect(Object.isFrozen(S())).toBe(true);
  });

  it('read devuelve null si localStorage.getItem lanza', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(S().read('x')).toBeNull();
    spy.mockRestore();
  });

  it('write no propaga el error si localStorage.setItem lanza (quota)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => S().write('x', 'y')).not.toThrow();
    spy.mockRestore();
  });
});
