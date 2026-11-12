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
    expect(window.setWatchStatus).toHaveBeenCalledWith('42', 'viendo', meta);
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
