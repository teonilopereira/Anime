/**
 * tests/unit/supabase-save-state-v4.test.js
 * api/supabase-client.js → saveItemState y el fallback de RPCs:
 *   - con meta.total > 0 usa save_item_state_v4 (016) con p_total
 *   - si v4 no existe (PGRST202 / 42883) cae a v3 y no vuelve a intentar v4
 *   - sin total no llama a v4; otros errores de v4 se propagan
 * El SDK real se reemplaza con vi.mock: no hay red.
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

let rpcImpl;
const rpc = vi.fn((name, params) => rpcImpl(name, params));

vi.mock('../../js/vendor/supabase.esm.js', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
    },
    from: () => ({ upsert: () => Promise.resolve({ data: null, error: null }) }),
    rpc: (...a) => rpc(...a),
  }),
}));

const ok = () => Promise.resolve({ data: null, error: null });

async function cargarCliente() {
  vi.resetModules();
  window.AppConfig = { supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'anon' };
  await import('../../api/supabase-client.js?t=' + Math.random());
  await window.AppSupabaseReady;
  return window.AppSupabase;
}

beforeEach(() => { rpc.mockClear(); rpcImpl = ok; });

describe('saveItemState con total (v4)', () => {
  let sb;
  beforeAll(async () => { sb = await cargarCliente(); });

  it('usa v4 con p_total y p_watch_status cuando hay meta.total > 0', async () => {
    await sb.saveItemState({ category: 'anime', itemId: 1, viewed: true, meta: { titulo: 'X', total: 12.7 }, watchStatus: 'viendo' });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, params] = rpc.mock.calls[0];
    expect(name).toBe('save_item_state_v4');
    expect(params).toMatchObject({ p_user_id: 'user-1', p_item_id: '1', p_total: 12, p_watch_status: 'viendo', p_viewed: true });
  });

  it('sin watchStatus manda p_watch_status null (no tocar lo guardado)', async () => {
    await sb.saveItemState({ category: 'manga', itemId: 2, fav: true, meta: { total: 30 } });
    expect(rpc.mock.calls[0][1].p_watch_status).toBeNull();
  });

  it('sin total (o total 0) no usa v4', async () => {
    await sb.saveItemState({ category: 'anime', itemId: 3, fav: true, meta: { total: 0 }, watchStatus: 'pendiente' });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_item_state_v3']);
  });

  it('otros errores de v4 se propagan sin caer a v3', async () => {
    rpcImpl = (name) => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(sb.saveItemState({ category: 'anime', itemId: 4, viewed: true, meta: { total: 5 } })).rejects.toBeTruthy();
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_item_state_v4']);
  });
});

describe('fallback cuando la base no tiene v4 (016 sin aplicar)', () => {
  it('cae a v3 y después ya no intenta v4', async () => {
    const sb = await cargarCliente();
    rpcImpl = (name) => name === 'save_item_state_v4'
      ? Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.save_item_state_v4' } })
      : ok();
    await sb.saveItemState({ category: 'anime', itemId: 5, viewed: true, meta: { total: 24 }, watchStatus: 'viendo' });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_item_state_v4', 'save_item_state_v3']);
    expect(rpc.mock.calls[1][1]).not.toHaveProperty('p_total');

    rpc.mockClear();
    await sb.saveItemState({ category: 'anime', itemId: 6, viewed: true, meta: { total: 24 }, watchStatus: 'viendo' });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_item_state_v3']);
  });

  it('sin v4 ni watchStatus cae a v2 (42883)', async () => {
    const sb = await cargarCliente();
    rpcImpl = (name) => name === 'save_item_state_v4'
      ? Promise.resolve({ data: null, error: { code: '42883', message: 'function does not exist' } })
      : ok();
    await sb.saveItemState({ category: 'novelas', itemId: 7, fav: true, meta: { total: 3 } });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['save_item_state_v4', 'save_item_state_v2']);
  });
});
