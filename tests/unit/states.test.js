/**
 * tests/unit/states.test.js
 * Tests para js/catalog/states.js
 *
 * Cubre la lógica pura de gamificación y estado que el módulo expone en window:
 *  - levelFromPoints:   cálculo de nivel/progreso a partir de XP
 *  - pointsKey / statusStorageKey / watch-status: formato de claves y lectura
 *  - getUserPoints:     lectura numérica robusta desde UserStore
 *  - getCategoriaActual: categoría según URL o data-page
 *  - WATCH_STATUSES / WATCH_STATUS_LABELS: catálogo de estados de seguimiento
 */

import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/utils.js');
  await import('../../js/core/user-store.js');
  await import('../../js/catalog/states.js');
});

beforeEach(() => {
  window.UserStore.clear();
});

// ─── levelFromPoints ──────────────────────────────────────────────────────────

describe('levelFromPoints', () => {
  const lvl = (p) => window.levelFromPoints(p);

  it('0 puntos → nivel 1, sin progreso, siguiente 100', () => {
    expect(lvl(0)).toEqual({ level: 1, current: 0, next: 100 });
  });

  it('progreso parcial dentro del nivel 1', () => {
    expect(lvl(50)).toEqual({ level: 1, current: 50, next: 100 });
  });

  it('exactamente el umbral sube a nivel 2', () => {
    // 100 XP: sube a nivel 2, restante 0, próximo umbral floor(100*1.2)=120
    expect(lvl(100)).toEqual({ level: 2, current: 0, next: 120 });
  });

  it('acumula varios niveles correctamente', () => {
    // 250 → nivel1(100) nivel2(120) → restante 30, próximo 144
    expect(lvl(250)).toEqual({ level: 3, current: 30, next: 144 });
  });

  it('trata valores no numéricos como 0', () => {
    expect(lvl('abc')).toEqual({ level: 1, current: 0, next: 100 });
    expect(lvl(null)).toEqual({ level: 1, current: 0, next: 100 });
  });

  it('no supera el nivel máximo configurado', () => {
    const max = window.AnimeDestiny.Constants.XP_MAX_LEVEL;
    const res = lvl(10_000_000);
    expect(res.level).toBeLessThanOrEqual(max + 1);
  });
});

// ─── claves de almacenamiento ─────────────────────────────────────────────────

describe('pointsKey / statusStorageKey', () => {
  it('pointsKey usa el formato u:<id>|points', () => {
    expect(window.pointsKey('u1')).toBe('u:u1|points');
  });

  it('statusStorageKey incluye item y tipo', () => {
    expect(window.statusStorageKey('u1', '42', 'fav')).toBe('u:u1|item:42|fav');
  });
});

// ─── getUserPoints ────────────────────────────────────────────────────────────

describe('getUserPoints', () => {
  it('devuelve 0 cuando no hay puntos almacenados', () => {
    expect(window.getUserPoints('nuevo')).toBe(0);
  });

  it('lee el número almacenado en UserStore', () => {
    window.UserStore.setItem(window.pointsKey('u1'), '350');
    expect(window.getUserPoints('u1')).toBe(350);
  });
});

// ─── watch-status ─────────────────────────────────────────────────────────────

describe('watch-status', () => {
  it('WATCH_STATUSES contiene los cuatro estados válidos', () => {
    expect(window.WATCH_STATUSES).toEqual(['viendo', 'pendiente', 'pausado', 'abandonado']);
  });

  it('cada estado tiene su etiqueta legible', () => {
    window.WATCH_STATUSES.forEach((s) => {
      expect(typeof window.WATCH_STATUS_LABELS[s]).toBe('string');
      expect(window.WATCH_STATUS_LABELS[s].length).toBeGreaterThan(0);
    });
  });

  it('getWatchStatus devuelve el estado válido almacenado', () => {
    window.UserStore.setItem('u:u1|item:42|wstatus', 'viendo');
    expect(window.getWatchStatus('u1', '42')).toBe('viendo');
  });

  it('getWatchStatus ignora valores no reconocidos', () => {
    window.UserStore.setItem('u:u1|item:42|wstatus', 'basura');
    expect(window.getWatchStatus('u1', '42')).toBe('');
  });

  it('getWatchStatus devuelve cadena vacía si no hay estado', () => {
    expect(window.getWatchStatus('u1', 'sin-estado')).toBe('');
  });
});

// ─── getCategoriaActual ───────────────────────────────────────────────────────

describe('getCategoriaActual', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-page');
  });

  it('usa el atributo data-page del body cuando la URL no delata la categoría', () => {
    document.body.setAttribute('data-page', 'anime');
    expect(window.getCategoriaActual()).toBe('anime');
  });

  it('devuelve cadena vacía sin pista de URL ni data-page', () => {
    expect(window.getCategoriaActual()).toBe('');
  });
});
