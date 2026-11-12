/**
 * tests/unit/supabase-resend-xp.test.js
 * api/supabase-client.js:
 *   - resendSignupEmail(email) → supabase.auth.resend({ type: 'signup', email }) (#14)
 *   - grantProgressXp(userId): misma regla que maybeGrantProgressXp de la ficha (#10)
 *   - loadItemStates expone meta.total si la vista lo trae (#10)
 * El SDK real se reemplaza con vi.mock: no hay red.
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

let nextResult = { data: [], error: null };
let resendResult = { data: {}, error: null };
const resend = vi.fn(() => Promise.resolve(resendResult));

function makeQuery() {
  const q = {
    select() { return q; },
    eq() { return q; },
    order() { return q; },
    upsert() { return q; },
    update() { return q; },
    insert() { return q; },
    single() { return q; },
    maybeSingle() { return q; },
    then(res, rej) { return Promise.resolve(nextResult).then(res, rej); },
  };
  return q;
}

vi.mock('../../js/vendor/supabase.esm.js', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }),
      resend: (...a) => resend(...a),
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
  resend.mockClear();
  resendResult = { data: {}, error: null };
  nextResult = { data: [], error: null };
});

describe('resendSignupEmail', () => {
  it('pide a Supabase el reenvío de tipo signup con el correo limpio', async () => {
    await window.AppSupabase.resendSignupEmail('  ana@example.com ');
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@example.com' });
  });

  it('propaga el error de Supabase (p. ej. límite de envíos)', async () => {
    resendResult = { data: null, error: new Error('rate limit') };
    await expect(window.AppSupabase.resendSignupEmail('ana@example.com')).rejects.toThrow('rate limit');
  });

  it('sin correo no llama a Supabase', async () => {
    await expect(window.AppSupabase.resendSignupEmail('')).rejects.toThrow();
    expect(resend).not.toHaveBeenCalled();
  });
});

describe('grantProgressXp', () => {
  it('suma XP_PROGRESS con addUserPoints y cuenta la misión "progress"', () => {
    window.addUserPoints = vi.fn();
    window.AppMissions = { track: vi.fn() };
    expect(window.AppSupabase.grantProgressXp('user-1')).toBe(2);
    expect(window.addUserPoints).toHaveBeenCalledWith('user-1', 2);
    expect(window.AppMissions.track).toHaveBeenCalledWith('progress');
  });

  it('respeta AnimeDestiny.Constants.XP_PROGRESS', () => {
    window.addUserPoints = vi.fn();
    window.AnimeDestiny.Constants.XP_PROGRESS = 3;
    expect(window.AppSupabase.grantProgressXp('user-1')).toBe(3);
    delete window.AnimeDestiny.Constants.XP_PROGRESS;
  });

  it('a Invitado no le da nada', () => {
    window.addUserPoints = vi.fn();
    expect(window.AppSupabase.grantProgressXp('Invitado')).toBe(0);
    expect(window.addUserPoints).not.toHaveBeenCalled();
  });
});

describe('loadItemStates: total', () => {
  it('pasa total (columna o meta JSON) a meta.total y lo omite si no viene', async () => {
    nextResult = {
      data: [
        { id: '1', category: 'anime', fav: false, viewed: false, titulo: 'A', total: 24 },
        { id: '2', category: 'manga', fav: true, viewed: false, titulo: 'B', meta: { total: '10' } },
        { id: '3', category: 'anime', fav: false, viewed: true, titulo: 'C', watch_status: 'viendo' },
      ],
      error: null,
    };
    const rows = await window.AppSupabase.loadItemStates('');
    expect(rows[0].meta.total).toBe(24);
    expect(rows[1].meta.total).toBe(10);
    expect(rows[2].meta.total).toBeUndefined();
    expect(rows[2].watch_status).toBe('viendo');
    expect(rows[1].fav).toBe(1);
  });
});
