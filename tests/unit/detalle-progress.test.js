/**
 * tests/unit/detalle-progress.test.js
 * Tests para js/detalle/progress.js → window.DetalleProgress y
 * js/detalle/data.js → window.DetalleData.saveDetailStateToSupabase
 *
 * Cubre:
 *  - invitado: pide login y no encola progreso
 *  - marcar progreso sin estado crea "viendo"; no pisa un estado elegido
 *  - toast "Episodio N marcado" para anime
 *  - quitar fav/visto manda el watchStatus actual (no borra "Viendo")
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

let uid = 'Invitado';

beforeAll(async () => {
  globalThis.getCurrentUserIdSafe = () => uid;
  await import('../../js/detalle/data.js');
  await import('../../js/detalle/progress.js');
});

beforeEach(() => {
  uid = 'Invitado';
  localStorage.clear();
  window.pedirLogin = vi.fn();
  window.getWatchStatus = vi.fn(() => '');
  window.setWatchStatus = vi.fn((id, st) => st);
  window.AppSupabase = undefined;
  window.Toast = undefined;
});

const P = () => window.DetalleProgress;

describe('guard de invitado', () => {
  it('sin sesión pide login y devuelve false', () => {
    expect(P().requireSession()).toBe(false);
    expect(window.pedirLogin).toHaveBeenCalledTimes(1);
  });

  it('con sesión no pide login', () => {
    uid = 'u1';
    expect(P().requireSession()).toBe(true);
    expect(window.pedirLogin).not.toHaveBeenCalled();
  });

  it('sin sesión no encola progreso para la próxima cuenta', async () => {
    await P().save('anime', '1', 's:0|ep:1', true);
    expect(localStorage.getItem('progressSyncQueue')).toBeNull();
  });

  it('con sesión y sin Supabase sí encola (offline)', async () => {
    uid = 'u1';
    await P().save('anime', '1', 's:0|ep:1', true);
    expect(JSON.parse(localStorage.getItem('progressSyncQueue'))).toHaveLength(1);
  });
});

describe('estado "viendo" al marcar progreso', () => {
  const item = { id: '42', titulo: 'Frieren' };
  const meta = { titulo: 'Frieren', img: '', info: '', total: 28, __category: 'anime' };

  it('sin estado guardado crea "viendo" con la meta de la ficha', () => {
    uid = 'u1';
    expect(P().ensureWatching(item, meta)).toBe(true);
    // silent: el toast "Estado: Viendo" no sale; lo avisa el del progreso.
    expect(window.setWatchStatus).toHaveBeenCalledWith('42', 'viendo', meta, { silent: true });
  });

  it('no pisa un estado elegido a mano', () => {
    uid = 'u1';
    window.getWatchStatus = vi.fn(() => 'pausado');
    expect(P().ensureWatching(item, meta)).toBe(false);
    expect(window.setWatchStatus).not.toHaveBeenCalled();
  });

  it('invitado: no toca el estado', () => {
    expect(P().ensureWatching(item, meta)).toBe(false);
    expect(window.setWatchStatus).not.toHaveBeenCalled();
  });
});

describe('toast de progreso', () => {
  it('dice episodio para anime y volumen para tomos', () => {
    expect(P().toastLabel('s:0|ep:5', true)).toBe('Episodio 5 marcado');
    expect(P().toastLabel('s:1|ep:2', false)).toBe('Episodio 2 desmarcado');
    expect(P().toastLabel('vol:3', true)).toBe('Volumen 3 marcado');
  });
});

describe('un solo toast al marcar el primer episodio (#8)', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('si la marca pasó la obra a Viendo, combina los dos avisos en uno', async () => {
    uid = 'u1';
    window.Toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    window.AppSupabase = { setProgress: vi.fn(() => Promise.resolve()) };
    await P().save('anime', '1', 's:0|ep:1', true, { nowWatching: true });
    await flush();
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
    expect(window.Toast.success.mock.calls[0][0]).toBe('¡Episodio 1 marcado · ahora en Viendo! 🎯');
  });

  it('sin cambio de estado, el toast es el de siempre', async () => {
    uid = 'u1';
    window.Toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    window.AppSupabase = { setProgress: vi.fn(() => Promise.resolve()) };
    await P().save('anime', '1', 's:0|ep:2', true);
    await flush();
    expect(window.Toast.success.mock.calls[0][0]).toBe('¡Episodio 2 marcado! 🎯');
  });

  it('sin Supabase igual avisa el paso a Viendo (una vez)', async () => {
    uid = 'u1';
    window.Toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    await P().save('anime', '1', 's:0|ep:1', true, { nowWatching: true });
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
  });

  it('desmarcar nunca menciona el estado', () => {
    expect(P().toastMessage('s:0|ep:1', false, true)).toBe('Episodio 1 desmarcado');
  });
});

describe('setWatchStatus con { silent: true } (states.js)', () => {
  it('no muestra el toast "Estado: …"', async () => {
    // states.js define window.setWatchStatus; se restaura el mock del beforeEach.
    const prev = window.setWatchStatus;
    window.UserStore = window.UserStore || {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); },
    };
    globalThis.UserStore = window.UserStore;
    globalThis.getCurrentUserId = () => 'u1';
    await import('../../js/catalog/states.js');
    const real = window.setWatchStatus;
    expect(typeof real).toBe('function');
    window.Toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
    real('7', 'viendo', null, { silent: true });
    expect(window.Toast.success).not.toHaveBeenCalled();
    real('8', 'viendo', null);
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
    window.setWatchStatus = prev;
  });
});

describe('saveDetailStateToSupabase', () => {
  it('manda el watchStatus actual para no borrar "Viendo" al quitar fav/visto', () => {
    uid = 'u1';
    window.getWatchStatus = vi.fn(() => 'viendo');
    const saveItemState = vi.fn(() => Promise.resolve());
    window.AppSupabase = { saveItemState };
    window.DetalleData.saveDetailStateToSupabase('anime', { id: 7, titulo: 'X' }, false, false);
    expect(window.getWatchStatus).toHaveBeenCalledWith('u1', '7');
    expect(saveItemState.mock.calls[0][0]).toMatchObject({ itemId: '7', fav: false, viewed: false, watchStatus: 'viendo' });
  });

  it('sin states.js cargado no inventa watchStatus', () => {
    uid = 'u1';
    window.getWatchStatus = undefined;
    const saveItemState = vi.fn(() => Promise.resolve());
    window.AppSupabase = { saveItemState };
    window.DetalleData.saveDetailStateToSupabase('anime', { id: 7 }, true, false);
    expect(saveItemState.mock.calls[0][0].watchStatus).toBeUndefined();
  });
});
