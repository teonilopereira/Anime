/**
 * tests/unit/user-store.test.js
 * Tests para js/core/user-store.js → window.UserStore
 *
 * UserStore es un caché en memoria (MemoryStore) que notifica cambios a
 * suscriptores para disparar la sincronización automática con Supabase.
 *
 * Cubre:
 *  - getItem/setItem/removeItem: lectura, escritura y borrado
 *  - coerción a string de claves y valores
 *  - keys/clear:                 introspección y limpieza
 *  - subscribe:                  notificación de cambios y desuscripción
 *  - aislamiento de errores en suscriptores
 */

import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/user-store.js');
});

const store = () => window.UserStore;

beforeEach(() => {
  store().clear();
});

describe('UserStore lectura/escritura', () => {
  it('setItem guarda y getItem recupera el valor', () => {
    store().setItem('k', 'v');
    expect(store().getItem('k')).toBe('v');
  });

  it('getItem devuelve null para clave inexistente', () => {
    expect(store().getItem('no-existe')).toBeNull();
  });

  it('setItem coacciona clave y valor a string al almacenar', () => {
    store().setItem(123, 456);
    // La clave se guarda como string ('123'), no como number
    expect(store().getItem('123')).toBe('456');
    expect(store().keys()).toContain('123');
  });

  it('sobrescribe el valor de una clave existente', () => {
    store().setItem('k', '1');
    store().setItem('k', '2');
    expect(store().getItem('k')).toBe('2');
  });

  it('removeItem elimina la clave', () => {
    store().setItem('k', 'v');
    store().removeItem('k');
    expect(store().getItem('k')).toBeNull();
  });
});

describe('UserStore.keys / clear', () => {
  it('keys devuelve todas las claves almacenadas', () => {
    store().setItem('a', '1');
    store().setItem('b', '2');
    expect(store().keys().sort()).toEqual(['a', 'b']);
  });

  it('clear vacía completamente el store', () => {
    store().setItem('a', '1');
    store().setItem('b', '2');
    store().clear();
    expect(store().keys()).toEqual([]);
  });
});

describe('UserStore.subscribe', () => {
  it('notifica al suscriptor en setItem con clave y valor', () => {
    const fn = vi.fn();
    store().subscribe(fn);
    store().setItem('k', 'v');
    expect(fn).toHaveBeenCalledWith('k', 'v');
  });

  it('notifica con value null en removeItem', () => {
    const fn = vi.fn();
    store().setItem('k', 'v');
    store().subscribe(fn);
    store().removeItem('k');
    expect(fn).toHaveBeenCalledWith('k', null);
  });

  it('la función devuelta por subscribe desuscribe al llamarla', () => {
    const fn = vi.fn();
    const unsub = store().subscribe(fn);
    unsub();
    store().setItem('k', 'v');
    expect(fn).not.toHaveBeenCalled();
  });

  it('notifica a múltiples suscriptores', () => {
    const a = vi.fn();
    const b = vi.fn();
    store().subscribe(a);
    store().subscribe(b);
    store().setItem('k', 'v');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('un error en un suscriptor no impide notificar a los demás', () => {
    const malo = vi.fn(() => { throw new Error('boom'); });
    const bueno = vi.fn();
    store().subscribe(malo);
    store().subscribe(bueno);
    expect(() => store().setItem('k', 'v')).not.toThrow();
    expect(bueno).toHaveBeenCalledWith('k', 'v');
  });

  it('clear no dispara notificaciones', () => {
    const fn = vi.fn();
    store().setItem('k', 'v');
    store().subscribe(fn);
    store().clear();
    expect(fn).not.toHaveBeenCalled();
  });
});
