/**
 * tests/unit/supabase-load-progress.test.js
 * Contrato de AppSupabase.loadAllProgress (api/supabase-client.js).
 *
 * inicio.js ("seguir viendo") y mis-listas.js (orden por actividad) usan
 * row.updated_at si llega; este test fija que la consulta lo pida y que la
 * función degrade a [] sin sesión o ante error de Supabase.
 *
 * El SDK real se reemplaza con vi.mock: no hay red.
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

const calls = { select: [], eq: [] };
let currentUser = { id: 'user-1' };
let nextResult = { data: [], error: null };

function makeQuery() {
  const q = {
    select(cols) { calls.select.push(cols); return q; },
    eq(col, val) { calls.eq.push([col, val]); return q; },
    order() { return q; },
    upsert() { return q; },
    update() { return q; },
    insert() { return q; },
    maybeSingle() { return q; },
    single() { return q; },
    limit() { return q; },
    then(res, rej) { return Promise.resolve(nextResult).then(res, rej); },
  };
  return q;
}

vi.mock('../../js/vendor/supabase.esm.js', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getUser: () => Promise.resolve({ data: { user: currentUser } }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
    },
    from: () => makeQuery(),
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
}));

beforeAll(async () => {
  window.AppConfig = { supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'anon' };
  await import('../../api/supabase-client.js');
  await window.AppSupabaseReady;
});

beforeEach(() => {
  calls.select.length = 0;
  calls.eq.length = 0;
  nextResult = { data: [], error: null };
});

describe('loadAllProgress', () => {
  it('pide updated_at junto con las columnas de progreso', async () => {
    nextResult = {
      data: [{ category: 'anime', item_id: '1', pkey: 's:1|ep:3', value: true, updated_at: '2026-11-01T10:00:00Z' }],
      error: null,
    };
    const rows = await window.AppSupabase.loadAllProgress();
    expect(calls.select[0]).toMatch(/\bupdated_at\b/);
    expect(calls.select[0]).toMatch(/category, item_id, pkey, value/);
    expect(calls.eq).toContainEqual(['user_id', 'user-1']);
    expect(calls.eq).toContainEqual(['value', true]);
    expect(rows[0].updated_at).toBe('2026-11-01T10:00:00Z');
  });

  it('devuelve [] si Supabase responde con error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    nextResult = { data: null, error: { message: 'boom' } };
    await expect(window.AppSupabase.loadAllProgress()).resolves.toEqual([]);
    warn.mockRestore();
  });
});
