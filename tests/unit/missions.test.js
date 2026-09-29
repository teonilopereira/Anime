/**
 * tests/unit/missions.test.js
 * Tests para js/core/missions.js → window.AppMissions
 *
 * Cubre:
 *  - dailyMissions: tres por día, "Adiviná el anime" siempre, mismas para todos
 *  - track: progreso, EXP al cumplir (una sola vez), bonus del día
 *  - visit: cuenta una vez por día para la misión semanal
 *  - invitado: no guarda ni premia
 *  - getMonth: acumula por mes
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

let uid = 'teo';

beforeAll(async () => {
  window.getCurrentUserIdSafe = () => uid;
  await import('../../js/core/missions.js');
});

const AM = () => window.AppMissions;

function setDay(dateStr) {
  vi.setSystemTime(new Date(dateStr + 'T12:00:00'));
}

beforeEach(() => {
  localStorage.clear();
  uid = 'teo';
  window.addUserPoints = vi.fn();
  window.Toast = { success: vi.fn() };
  vi.useFakeTimers();
  setDay('2026-09-30');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dailyMissions', () => {
  it('da tres misiones con el reto siempre primero', () => {
    const list = AM().dailyMissions(new Date());
    expect(list).toHaveLength(3);
    expect(list[0].action).toBe('quiz_play');
    expect(new Set(list.map((m) => m.id)).size).toBe(3);
  });

  it('es la misma lista para el mismo día y cambia entre días', () => {
    const a = AM().dailyMissions(new Date(2026, 8, 30)).map((m) => m.id);
    const b = AM().dailyMissions(new Date(2026, 8, 30)).map((m) => m.id);
    expect(a).toEqual(b);
    const semana = new Set();
    for (let d = 1; d <= 7; d++) {
      semana.add(AM().dailyMissions(new Date(2026, 9, d)).map((m) => m.id).join());
    }
    expect(semana.size).toBeGreaterThan(1);
  });
});

describe('track', () => {
  it('cumple el reto diario y da su EXP una sola vez', () => {
    const done = AM().track('quiz_play');
    expect(done.map((m) => m.id)).toContain('d_quiz');
    expect(window.addUserPoints).toHaveBeenCalledWith('teo', 10);
    window.addUserPoints.mockClear();
    AM().track('quiz_play');
    expect(window.addUserPoints).not.toHaveBeenCalled();
    const st = AM().getState();
    expect(st.daily.find((m) => m.id === 'd_quiz').done).toBe(true);
  });

  it('da el bonus al completar las tres diarias', () => {
    AM().getState().daily.forEach((m) => AM().track(m.action, m.goal));
    expect(AM().getState().dailyBonus.done).toBe(true);
    expect(window.addUserPoints).toHaveBeenCalledWith('teo', 20);
  });

  it('suma para la semanal y guarda el total del mes', () => {
    AM().track('progress', 12);
    setDay('2026-10-01');
    AM().track('progress', 10);
    const w = AM().getState().weekly.find((m) => m.id === 'w_progress');
    expect(w.done).toBe(true);
    expect(AM().getMonth('2026-09').progress).toBe(12);
    expect(AM().getMonth('2026-10').progress).toBe(10);
  });

  it('la semana se reinicia el lunes', () => {
    AM().track('viewed', 3); // miércoles 30/09
    setDay('2026-10-05'); // lunes siguiente
    expect(AM().getState().weekly.find((m) => m.id === 'w_viewed').progress).toBe(0);
  });

  it('"visit" cuenta una vez por día', () => {
    AM().track('visit');
    AM().track('visit');
    expect(AM().getState().weekly.find((m) => m.id === 'w_visit').progress).toBe(1);
    setDay('2026-10-01');
    AM().track('visit');
    expect(AM().getState().weekly.find((m) => m.id === 'w_visit').progress).toBe(2);
  });

  it('sin sesión no guarda ni premia', () => {
    uid = 'Invitado';
    expect(AM().track('quiz_play')).toEqual([]);
    expect(window.addUserPoints).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(AM().getState().signedIn).toBe(false);
  });
});
