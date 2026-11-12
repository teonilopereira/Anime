/**
 * tests/unit/progress-sync-queue.test.js
 * Cola de reintentos de progreso de js/detalle/progress.js (localStorage
 * `progressSyncQueue`). Complementa detalle-progress.test.js (guard de
 * invitado y encolado offline) con el drenado:
 *  - un fallo de setProgress encola la operación
 *  - el evento `online` drena la cola y conserva solo lo que vuelve a fallar
 *  - save() drena lo pendiente antes de mandar lo nuevo
 *  - sin cliente de Supabase la cola no se toca
 *  - datos corruptos en la cola no rompen
 *  - sin sesión no drena; al loguear drena solo las ops de esa cuenta (#2)
 *
 * Se testea solo por la interfaz pública (DetalleProgress.save, eventos y
 * localStorage) para no depender de funciones internas del archivo.
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

const KEY = 'progressSyncQueue';
let uid = 'u1';

const flush = () => new Promise((r) => setTimeout(r, 0));
const queue = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const op = (key, value = true) => ({ category: 'anime', itemId: '9', key, value, ts: 1 });

beforeAll(async () => {
  globalThis.getCurrentUserIdSafe = () => uid;
  await import('../../js/detalle/progress.js');
});

beforeEach(() => {
  uid = 'u1';
  localStorage.clear();
  window.AppSupabase = undefined;
  window.Toast = undefined;
  window.getWatchStatus = undefined;
  window.setWatchStatus = undefined;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('progressSyncQueue: encolar', () => {
  it('si setProgress falla, la operación queda en la cola', async () => {
    window.AppSupabase = { setProgress: vi.fn(() => Promise.reject({ status: 500 })) };
    await window.DetalleProgress.save('anime', '9', 's:0|ep:2', true);
    await flush();
    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ category: 'anime', itemId: '9', key: 's:0|ep:2', value: true });
  });

  it('si setProgress responde bien, no encola', async () => {
    window.AppSupabase = { setProgress: vi.fn(() => Promise.resolve()) };
    await window.DetalleProgress.save('anime', '9', 's:0|ep:2', true);
    await flush();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('progressSyncQueue: drenar', () => {
  it('al volver la conexión manda todo y vacía la cola', async () => {
    localStorage.setItem(KEY, JSON.stringify([op('s:0|ep:1'), op('s:0|ep:2', false)]));
    const setProgress = vi.fn(() => Promise.resolve());
    window.AppSupabase = { setProgress };
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(setProgress).toHaveBeenCalledTimes(2);
    expect(setProgress.mock.calls[1][0]).toEqual({ category: 'anime', itemId: '9', key: 's:0|ep:2', value: false });
    expect(queue()).toEqual([]);
  });

  it('conserva solo las operaciones que vuelven a fallar', async () => {
    localStorage.setItem(KEY, JSON.stringify([op('s:0|ep:1'), op('s:0|ep:2')]));
    window.AppSupabase = {
      setProgress: vi.fn(({ key }) => (key.endsWith('ep:2') ? Promise.reject({ status: 401 }) : Promise.resolve())),
    };
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(queue().map((o) => o.key)).toEqual(['s:0|ep:2']);
  });

  it('save() drena lo pendiente antes de mandar lo nuevo', async () => {
    localStorage.setItem(KEY, JSON.stringify([op('s:0|ep:1')]));
    const setProgress = vi.fn(() => Promise.resolve());
    window.AppSupabase = { setProgress };
    await window.DetalleProgress.save('anime', '9', 's:0|ep:3', true);
    await flush();
    expect(setProgress.mock.calls.map((c) => c[0].key)).toEqual(['s:0|ep:1', 's:0|ep:3']);
    expect(queue()).toEqual([]);
  });

  it('sin cliente de Supabase no toca la cola', async () => {
    localStorage.setItem(KEY, JSON.stringify([op('s:0|ep:1')]));
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(queue()).toHaveLength(1);
  });

  it('una cola corrupta no rompe y se reemplaza al encolar', async () => {
    localStorage.setItem(KEY, '{no-json');
    await window.DetalleProgress.save('anime', '9', 's:0|ep:4', true);
    expect(queue()).toHaveLength(1);
  });
});

describe('progressSyncQueue: sesión y cuenta correcta (#2)', () => {
  const pending = [op('s:0|ep:1')];

  it('sin sesión (isSignedIn false) no manda nada ni toca la cola', async () => {
    localStorage.setItem(KEY, JSON.stringify(pending));
    const setProgress = vi.fn(() => Promise.resolve());
    window.AppSupabase = { setProgress, isSignedIn: () => false, getCurrentUserSync: () => null };
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('supabase-auth-changed'));
    await flush();
    expect(setProgress).not.toHaveBeenCalled();
    expect(queue()).toEqual(pending);
  });

  it('sin isSignedIn usa getCurrentUserSync', async () => {
    localStorage.setItem(KEY, JSON.stringify(pending));
    const setProgress = vi.fn(() => Promise.resolve());
    window.AppSupabase = { setProgress, getCurrentUserSync: () => null };
    await window.DetalleProgress.drain();
    expect(setProgress).not.toHaveBeenCalled();
    expect(queue()).toHaveLength(1);
  });

  it('al iniciar sesión se vacía con esa cuenta', async () => {
    localStorage.setItem(KEY, JSON.stringify(pending));
    let user = null;
    const setProgress = vi.fn(() => Promise.resolve());
    window.AppSupabase = { setProgress, isSignedIn: () => !!user, getCurrentUserSync: () => user };
    await window.DetalleProgress.drain();
    expect(setProgress).not.toHaveBeenCalled();
    user = { id: 'sb-1' };
    window.dispatchEvent(new Event('supabase-auth-changed'));
    await flush();
    expect(setProgress).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });

  it('cada op guarda su dueño y otra cuenta no la manda', async () => {
    const setProgress = vi.fn(() => Promise.reject({ status: 500 }));
    let user = { id: 'sb-A' };
    window.AppSupabase = { setProgress, isSignedIn: () => !!user, getCurrentUserSync: () => user };
    await window.DetalleProgress.save('anime', '9', 's:0|ep:5', true);
    await flush();
    expect(queue()[0]).toMatchObject({ key: 's:0|ep:5', owner: 'sb-A' });

    // Entra otra cuenta: la op de A queda en la cola sin mandarse.
    user = { id: 'sb-B' };
    setProgress.mockClear();
    setProgress.mockImplementation(() => Promise.resolve());
    await window.DetalleProgress.drain();
    expect(setProgress).not.toHaveBeenCalled();
    expect(queue().map((o) => o.owner)).toEqual(['sb-A']);

    // Vuelve A: se manda y la cola queda vacía.
    user = { id: 'sb-A' };
    await window.DetalleProgress.drain();
    expect(setProgress).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });

  it('ops viejas sin dueño (o de la home) se mandan con la cuenta activa', async () => {
    localStorage.setItem(KEY, JSON.stringify(pending));
    const setProgress = vi.fn(() => Promise.resolve());
    window.AppSupabase = { setProgress, isSignedIn: () => true, getCurrentUserSync: () => ({ id: 'sb-1' }) };
    await window.DetalleProgress.drain();
    expect(setProgress).toHaveBeenCalledTimes(1);
    expect(queue()).toEqual([]);
  });
});
