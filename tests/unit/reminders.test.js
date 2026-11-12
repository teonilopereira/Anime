/**
 * tests/unit/reminders.test.js
 * Tests para js/core/reminders.js → window.AppReminders
 *
 * Cubre:
 *  - filtro de seguidos (isFollowedState / followedIdsFromStates / filterFollowed)
 *  - recordatorio por título (UserStore `u:<uid>|remind:<id>` + persistencia)
 *  - selectEpisodeReminders: ventana, dedupe por (id, episodio), opt-in por título
 *  - checkEpisodes: respeta AppNotifPrefs y no repite avisos
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/user-store.js');
  await import('../../js/core/reminders.js');
});

const R = () => window.AppReminders;
const UID = 'user-1';
const NOW = new Date('2026-03-10T12:00:00Z').getTime();
const sec = (ms) => Math.floor(ms / 1000);

beforeEach(() => {
  localStorage.clear();
  window.UserStore.clear();
  delete window.AppNotifPrefs;
});

afterEach(() => {
  delete window.AppSupabase;
  delete window.getAiringSchedule;
  delete window.Toast;
  vi.useRealTimers();
});

describe('filtro de seguidos', () => {
  it('sigue fav, visto, viendo y pendiente; no abandonado ni vacío', () => {
    const f = R().isFollowedState;
    expect(f({ fav: true })).toBe(true);
    expect(f({ viewed: true })).toBe(true);
    expect(f({ watch_status: 'viendo' })).toBe(true);
    expect(f({ watch_status: 'pendiente' })).toBe(true);
    expect(f({ watch_status: 'abandonado' })).toBe(false);
    expect(f({})).toBe(false);
    expect(f(null)).toBe(false);
  });

  it('filterFollowed se queda solo con ids seguidos (Set o Array, como string)', () => {
    const ids = R().followedIdsFromStates([
      { item_id: 1, fav: true },
      { item_id: 2, watch_status: 'pausado' },
      { item_id: 3, watch_status: 'pendiente' }
    ]);
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(R().filterFollowed(list, ids).map((x) => x.id)).toEqual([1, 3]);
    expect(R().filterFollowed(list, ['4']).map((x) => x.id)).toEqual([4]);
    expect(R().filterFollowed(list, null)).toEqual([]);
  });
});

describe('recordatorio por título', () => {
  it('sin configurar: hasConfiguredTitles es false', () => {
    expect(R().hasConfiguredTitles(UID)).toBe(false);
    expect(R().isTitleReminder(UID, 10)).toBe(false);
  });

  it('toggle guarda en UserStore y persiste en localStorage', () => {
    expect(R().toggleTitleReminder(UID, 10)).toBe(true);
    expect(window.UserStore.getItem('u:' + UID + '|remind:10')).toBe('1');
    expect(JSON.parse(localStorage.getItem('ad:remind:titles:' + UID))).toEqual(['10']);
    expect(R().isTitleReminder(UID, 10)).toBe(true);

    expect(R().toggleTitleReminder(UID, 10)).toBe(false);
    expect(window.UserStore.getItem('u:' + UID + '|remind:10')).toBeNull();
    // Configuró (aunque quedó vacío): ya no es "comportamiento por defecto".
    expect(R().hasConfiguredTitles(UID)).toBe(true);
  });
});

describe('selectEpisodeReminders', () => {
  const schedule = [
    { id: 1, title: 'A', episode: 5, airingAt: sec(NOW + 3600000) },      // en 1 h
    { id: 1, title: 'A', episode: 5, airingAt: sec(NOW + 3600000) },      // duplicado
    { id: 2, title: 'B', episode: 9, airingAt: sec(NOW - 2 * 3600000) },  // salió hace 2 h
    { id: 3, title: 'C', episode: 1, airingAt: sec(NOW + 3 * 86400000) }, // fuera de ventana
    { id: 4, title: 'D', episode: 2, airingAt: sec(NOW + 600000) }        // no seguido
  ];

  it('sin configurar avisa de todo lo seguido dentro de la ventana, sin duplicar', () => {
    const picks = R().selectEpisodeReminders(schedule, {
      followedIds: new Set(['1', '2', '3']), remindIds: null, sent: {}, now: NOW
    });
    expect(picks.map((p) => p.key)).toEqual(['1:5', '2:9']);
    expect(picks[0].aired).toBe(false);
    expect(picks[1].aired).toBe(true);
  });

  it('con recordatorios configurados solo avisa de esos títulos', () => {
    const picks = R().selectEpisodeReminders(schedule, {
      followedIds: new Set(['1', '2']), remindIds: new Set(['2']), sent: {}, now: NOW
    });
    expect(picks.map((p) => p.key)).toEqual(['2:9']);
  });

  it('no repite lo ya avisado', () => {
    const picks = R().selectEpisodeReminders(schedule, {
      followedIds: new Set(['1', '2']), remindIds: null, sent: { '1:5': NOW - 1000 }, now: NOW
    });
    expect(picks.map((p) => p.key)).toEqual(['2:9']);
  });

  it('nada seguido → ningún aviso (sin avisos genéricos)', () => {
    expect(R().selectEpisodeReminders(schedule, { followedIds: new Set(), now: NOW })).toEqual([]);
  });
});

describe('checkEpisodes', () => {
  function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.AppSupabase = {
      isSignedIn: () => true,
      loadItemStates: async () => [{ item_id: 1, fav: true }, { item_id: 2, watch_status: 'viendo' }]
    };
    window.getAiringSchedule = vi.fn(async (ids) => [
      { id: 1, title: 'A', episode: 5, airingAt: sec(NOW + 3600000) },
      { id: 2, title: 'B', episode: 9, airingAt: sec(NOW - 3600000) }
    ].filter((x) => ids.map(String).includes(String(x.id))));
    window.Toast = { info: vi.fn(), success: vi.fn() };
  }

  it('avisa una vez por episodio aunque se ejecute de nuevo', async () => {
    setup();
    await R()._checkEpisodes(UID);
    expect(window.Toast.info).toHaveBeenCalledTimes(2);
    await R()._checkEpisodes(UID);
    expect(window.Toast.info).toHaveBeenCalledTimes(2);
  });

  it('con recordatorio por título solo consulta y avisa de ese título', async () => {
    setup();
    R().setTitleReminder(UID, 2, true);
    await R()._checkEpisodes(UID);
    expect(window.getAiringSchedule).toHaveBeenCalledWith(['2']);
    expect(window.Toast.info).toHaveBeenCalledTimes(1);
  });

  it('respeta AppNotifPrefs: bloqueado no avisa ni marca; permitido registra el envío', async () => {
    setup();
    window.AppNotifPrefs = { isAllowed: vi.fn(() => false), recordSent: vi.fn() };
    await R()._checkEpisodes(UID);
    expect(window.Toast.info).not.toHaveBeenCalled();
    expect(window.AppNotifPrefs.isAllowed).toHaveBeenCalledWith('episodios');

    window.AppNotifPrefs = { isAllowed: vi.fn(() => true), recordSent: vi.fn() };
    await R()._checkEpisodes(UID);
    expect(window.Toast.info).toHaveBeenCalledTimes(2);
    expect(window.AppNotifPrefs.recordSent).toHaveBeenCalledWith('episodios');
  });
});
