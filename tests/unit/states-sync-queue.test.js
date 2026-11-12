/**
 * tests/unit/states-sync-queue.test.js
 * Cola `syncQueue` y métricas locales `ad:metrics:sync` de
 * js/catalog/states.js (window.syncItemStateToSupabase, window.AppSyncMetrics).
 *
 * Cubre:
 *  - sin cliente de Supabase: encola el estado
 *  - error al guardar: encola, cuenta fail y guarda solo un código corto
 *    (nunca el mensaje ni el user_id)
 *  - guardado bien: cuenta ok
 *  - drenado: sin sesión no hace nada; con sesión reintenta, cuenta retry/ok
 *    y conserva lo que vuelve a fallar
 *  - métricas corruptas no rompen
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

const flush = () => new Promise((r) => setTimeout(r, 0));
const queue = () => JSON.parse(localStorage.getItem('syncQueue') || '[]');
const M = () => window.AppSyncMetrics;

beforeAll(async () => {
  globalThis.getCurrentUserIdSafe = () => 'u1';
  await import('../../js/catalog/states.js');
});

beforeEach(() => {
  localStorage.clear();
  window.AppSupabase = undefined;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('syncItemStateToSupabase', () => {
  it('sin cliente encola el estado', () => {
    window.syncItemStateToSupabase('anime', '5', true, false, {}, 'viendo');
    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ type: 'item_state', payload: { category: 'anime', itemId: '5', fav: true, watchStatus: 'viendo' } });
    expect(M().pending()).toBe(1);
  });

  it('si falla encola y cuenta el fallo con código corto, sin mensaje', async () => {
    window.AppSupabase = {
      saveItemState: vi.fn(() => Promise.reject({ status: 503, message: 'fallo para usuario abc@example.com' })),
    };
    window.syncItemStateToSupabase('anime', '5', false, true, {});
    await flush();
    expect(queue()).toHaveLength(1);
    const m = M().get();
    expect(m).toMatchObject({ ok: 0, fail: 1, retry: 0, lastCode: '503' });
    expect(m.lastAt).toBeGreaterThan(0);
    const raw = localStorage.getItem('ad:metrics:sync');
    expect(raw).not.toMatch(/example\.com|u1|fallo/);
  });

  it('usa el código de PostgREST cuando no hay status', async () => {
    window.AppSupabase = { saveItemState: vi.fn(() => Promise.reject({ code: 'PGRST301', message: 'JWT expired' })) };
    window.syncItemStateToSupabase('anime', '5', false, true, {});
    await flush();
    expect(M().get().lastCode).toBe('PGRST301');
  });

  it('si guarda bien cuenta ok y no encola', async () => {
    window.AppSupabase = { saveItemState: vi.fn(() => Promise.resolve()) };
    window.syncItemStateToSupabase('anime', '5', true, true, {});
    await flush();
    expect(queue()).toEqual([]);
    expect(M().get()).toMatchObject({ ok: 1, fail: 0 });
  });
});

describe('drainSyncQueue', () => {
  const seed = () => localStorage.setItem('syncQueue', JSON.stringify([
    { type: 'item_state', payload: { category: 'anime', itemId: '1', fav: true, viewed: false, meta: {} }, ts: 1 },
    { type: 'experience', payload: { delta: 10 }, ts: 2 },
  ]));

  it('sin sesión no intenta nada', async () => {
    seed();
    const saveItemState = vi.fn(() => Promise.resolve());
    window.AppSupabase = { isSignedIn: () => false, saveItemState, addExperience: vi.fn() };
    await M().drain();
    expect(saveItemState).not.toHaveBeenCalled();
    expect(queue()).toHaveLength(2);
    expect(M().get().retry).toBe(0);
  });

  it('con sesión reintenta todo, vacía la cola y cuenta retry/ok', async () => {
    seed();
    const saveItemState = vi.fn(() => Promise.resolve());
    const addExperience = vi.fn(() => Promise.resolve());
    window.AppSupabase = { isSignedIn: () => true, saveItemState, addExperience };
    await M().drain();
    expect(saveItemState).toHaveBeenCalledTimes(1);
    expect(addExperience).toHaveBeenCalledWith(10);
    expect(queue()).toEqual([]);
    expect(M().get()).toMatchObject({ ok: 2, retry: 2, fail: 0 });
  });

  it('conserva lo que vuelve a fallar', async () => {
    seed();
    window.AppSupabase = {
      isSignedIn: () => true,
      saveItemState: vi.fn(() => Promise.resolve()),
      addExperience: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    };
    await M().drain();
    expect(queue().map((o) => o.type)).toEqual(['experience']);
    expect(M().get()).toMatchObject({ ok: 1, fail: 1, retry: 2, lastCode: 'network' });
  });
});

describe('AppSyncMetrics', () => {
  it('datos corruptos devuelven contadores en cero', () => {
    localStorage.setItem('ad:metrics:sync', '{roto');
    expect(M().get()).toEqual({ ok: 0, fail: 0, retry: 0, lastCode: '', lastAt: 0 });
  });

  it('reset borra los contadores', async () => {
    window.AppSupabase = { saveItemState: vi.fn(() => Promise.resolve()) };
    window.syncItemStateToSupabase('anime', '5', true, true, {});
    await flush();
    M().reset();
    expect(M().get().ok).toBe(0);
  });
});
