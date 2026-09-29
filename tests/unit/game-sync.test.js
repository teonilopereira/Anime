/**
 * tests/unit/game-sync.test.js
 * Tests para js/core/game-sync.js → window.AppGameSync
 *
 * Cubre:
 *  - mergeStreak:   mismo día, día siguiente en otro dispositivo, racha rota
 *  - mergeBucket:   mayor contador y unión de misiones cumplidas
 *  - mergeQuizDay:  prefiere el reto terminado
 *  - sync:          baja lo de la nube a localStorage y sube lo mezclado;
 *                   tabla ausente no rompe y deja de insistir
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/game-sync.js');
});

const GS = () => window.AppGameSync;
const M = () => window.AppGameSync._merge;

// Cliente de Supabase falso: una fila en memoria.
function fakeClient(row, opts = {}) {
  const calls = { upserts: [] };
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          if (opts.missing) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'Could not find the table public.user_game_state' } });
          return Promise.resolve({ data: row ? { data: row } : null, error: null });
        },
        upsert(payload) {
          calls.upserts.push(payload);
          row = payload.data;
          return Promise.resolve({ error: null });
        }
      };
    }
  };
  return { client, calls };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-29T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  window.AppSupabase = undefined;
});

describe('mergeStreak', () => {
  it('mismo día: toma el mayor contador y récord', () => {
    expect(M().mergeStreak({ count: 3, best: 5, day: '2026-09-29' }, { count: 4, best: 4, day: '2026-09-29' }))
      .toEqual({ count: 4, best: 5, day: '2026-09-29' });
  });

  it('el otro dispositivo contó ayer: la racha continúa en vez de reiniciarse', () => {
    // Compu: vieja y reinició a 1 hoy. Celu: venía en 10 hasta ayer.
    const compu = { count: 1, best: 3, day: '2026-09-29' };
    const celu = { count: 10, best: 10, day: '2026-09-28' };
    expect(M().mergeStreak(compu, celu)).toEqual({ count: 11, best: 11, day: '2026-09-29' });
  });

  it('si ya había continuado, no suma de nuevo', () => {
    expect(M().mergeStreak({ count: 11, best: 11, day: '2026-09-29' }, { count: 10, best: 10, day: '2026-09-28' }))
      .toEqual({ count: 11, best: 11, day: '2026-09-29' });
  });

  it('con un hueco de más de un día la racha queda rota', () => {
    expect(M().mergeStreak({ count: 1, best: 2, day: '2026-09-29' }, { count: 10, best: 10, day: '2026-09-25' }))
      .toEqual({ count: 1, best: 10, day: '2026-09-29' });
  });

  it('sin datos de un lado usa el otro', () => {
    expect(M().mergeStreak({}, { count: 2, best: 2, day: '2026-09-29' })).toEqual({ count: 2, best: 2, day: '2026-09-29' });
  });
});

describe('mergeBucket', () => {
  it('toma el mayor contador por acción y une lo cumplido', () => {
    const a = { counts: { viewed: 2, fav: 1 }, done: { d_viewed: true } };
    const b = { counts: { viewed: 1, quiz_play: 1 }, done: { d_quiz: true } };
    expect(M().mergeBucket(a, b)).toEqual({
      counts: { viewed: 2, fav: 1, quiz_play: 1 },
      done: { d_viewed: true, d_quiz: true }
    });
  });
});

describe('mergeQuizDay', () => {
  it('prefiere el reto terminado', () => {
    const jugando = { guesses: ['a', 'b', 'c'], status: 'playing' };
    const ganado = { guesses: ['x'], status: 'won' };
    expect(M().mergeQuizDay(jugando, ganado)).toBe(ganado);
  });
  it('si los dos siguen, el que tiene más intentos', () => {
    const a = { guesses: ['a'], status: 'playing' };
    const b = { guesses: ['a', 'b'], status: 'playing' };
    expect(M().mergeQuizDay(a, b)).toBe(b);
  });
});

describe('sync', () => {
  it('baja la racha de la nube, la mezcla y sube el resultado', async () => {
    localStorage.setItem('ad:streak:count:u1', '1');
    localStorage.setItem('ad:streak:best:u1', '1');
    localStorage.setItem('ad:streak:day:u1', '2026-09-29');
    localStorage.setItem('ad:mis:u1:d:2026-09-29', JSON.stringify({ counts: { fav: 1 }, done: { d_fav: true } }));

    const remote = {
      v: 1,
      streak: { count: 7, best: 9, day: '2026-09-28' },
      mis: { 'd:2026-09-29': { counts: { quiz_play: 1 }, done: { d_quiz: true } } },
      quizDay: { '2026-09-29': { guesses: ['Naruto'], status: 'won' } },
      quizStats: { played: 4, won: 3, cur: 2, best: 3, dist: [1, 1, 1, 0, 0], last: '2026-09-29' }
    };
    const { client, calls } = fakeClient(remote);
    window.AppSupabase = { client, getCurrentUserSync: () => ({ id: 'u1' }) };
    const merged = vi.fn();
    window.addEventListener('game-sync-merged', merged);

    await expect(GS().sync()).resolves.toBe(true);

    expect(localStorage.getItem('ad:streak:count:u1')).toBe('8');
    expect(localStorage.getItem('ad:streak:best:u1')).toBe('9');
    expect(JSON.parse(localStorage.getItem('ad:mis:u1:d:2026-09-29'))).toEqual({
      counts: { fav: 1, quiz_play: 1 }, done: { d_fav: true, d_quiz: true }
    });
    expect(JSON.parse(localStorage.getItem('ad:quiz:day:2026-09-29')).status).toBe('won');
    expect(JSON.parse(localStorage.getItem('ad:quiz:stats')).played).toBe(4);
    expect(merged).toHaveBeenCalled();
    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0].user_id).toBe('u1');
    expect(calls.upserts[0].data.streak).toEqual({ count: 8, best: 9, day: '2026-09-29' });
    window.removeEventListener('game-sync-merged', merged);
  });

  it('no sube nada si la nube ya tiene lo mismo', async () => {
    localStorage.setItem('ad:streak:count:u2', '3');
    localStorage.setItem('ad:streak:best:u2', '3');
    localStorage.setItem('ad:streak:day:u2', '2026-09-29');
    const { client: c1 } = fakeClient(null);
    window.AppSupabase = { client: c1, getCurrentUserSync: () => ({ id: 'u2' }) };
    await GS().sync();
    const same = { v: 1, streak: { count: 3, best: 3, day: '2026-09-29' }, mis: {}, quizDay: {}, quizStats: null };
    const { client, calls } = fakeClient(same);
    window.AppSupabase = { client, getCurrentUserSync: () => ({ id: 'u2' }) };
    await GS().sync();
    expect(calls.upserts).toHaveLength(0);
  });

  it('sin sesión no hace nada', async () => {
    window.AppSupabase = { client: {}, getCurrentUserSync: () => null };
    await expect(GS().sync()).resolves.toBe(false);
  });

  it('si la tabla no existe no rompe y deja localStorage como estaba', async () => {
    localStorage.setItem('ad:streak:count:u3', '2');
    const { client, calls } = fakeClient(null, { missing: true });
    window.AppSupabase = { client, getCurrentUserSync: () => ({ id: 'u3' }) };
    await expect(GS().sync()).resolves.toBe(false);
    expect(localStorage.getItem('ad:streak:count:u3')).toBe('2');
    expect(calls.upserts).toHaveLength(0);
  });
});
