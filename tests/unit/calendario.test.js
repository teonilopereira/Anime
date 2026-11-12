/**
 * tests/unit/calendario.test.js
 * Calendario semanal (js/pages/calendario.js): "faltan X de Y" en las cards de
 * lo seguido y resumen semanal con los episodios finales.
 */

import { beforeAll, describe, it, expect, vi } from 'vitest';

const DAY = 86400;
const now = Math.floor(Date.now() / 1000);
const schedule = [
  { id: 1, title: 'Con total', img: '', episode: 8, totalEpisodes: 12, airingAt: now + DAY },
  { id: 2, title: 'Sin total', img: '', episode: 30, totalEpisodes: null, airingAt: now + DAY },
  { id: 3, title: 'Final', img: '', episode: 12, totalEpisodes: 12, airingAt: now + 2 * DAY },
  { id: 4, title: 'No seguido', img: '', episode: 2, totalEpisodes: 12, airingAt: now + 2 * DAY }
];

beforeAll(async () => {
  document.body.innerHTML = '<div id="calendarBody"></div>';
  window.getWeeklyAiringSchedule = vi.fn(async () => schedule);
  window.AppSupabase = {
    isSignedIn: () => true,
    getCurrentUserSync: () => ({ id: 'u1' }),
    loadItemStates: vi.fn(async () => [
      { item_id: '1', watch_status: 'viendo' },
      { item_id: '2', fav: 1 },
      { item_id: '3', watch_status: 'pendiente' }
    ])
  };
  await import('../../js/pages/calendario.js');
  // load() es async: esperamos a que pinte las cards.
  await vi.waitFor(() => {
    if (!document.querySelector('.cal-card')) throw new Error('sin render');
  });
});

const C = () => window.AppCalendario;

describe('calendario: faltan X de Y', () => {
  it('calcula lo que queda solo si hay total', () => {
    expect(C()._remaining({ episode: 8, totalEpisodes: 12 })).toEqual({ faltan: 4, total: 12 });
    expect(C()._remaining({ episode: 8, totalEpisodes: null })).toBeNull();
    expect(C()._remaining({ episode: 13, totalEpisodes: 12 })).toBeNull();
    expect(C()._remainingLabel({ episode: 8, totalEpisodes: 12 })).toBe('Faltan 4 de 12');
    expect(C()._remainingLabel({ episode: 12, totalEpisodes: 12 })).toBe('Episodio final');
    expect(C()._remainingLabel({ episode: 3 })).toBe('');
  });

  it('las cards de seguidos lo muestran; sin total o sin seguir, nada', () => {
    const left = (id) => {
      const a = document.querySelector('a.cal-card[href$="id=' + id + '"]');
      const el = a && a.querySelector('.cal-left');
      return el ? el.textContent : null;
    };
    expect(left(1)).toBe('Faltan 4 de 12');
    expect(left(2)).toBeNull();
    expect(left(3)).toBe('Episodio final');
    expect(left(4)).toBeNull(); // no seguido
  });

  it('el resumen cuenta los finales de lo seguido', () => {
    const s = C()._summarize(schedule.slice(0, 3), Date.now());
    expect(s).toEqual({ total: 3, porSalir: 3, finales: 1 });
    expect(document.querySelector('.cal-summary').textContent).toMatch(/1 termina/);
  });
});
