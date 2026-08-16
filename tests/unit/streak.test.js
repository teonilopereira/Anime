/**
 * tests/unit/streak.test.js
 * Tests para js/core/streak.js → window.AppStreak
 *
 * Cubre:
 *  - recordActivity:  primer día, idempotencia intradía, día consecutivo,
 *                     reinicio tras un hueco, récord histórico
 *  - getStreak:       racha viva vs rota, countedToday, atRisk
 *  - bonusForStreak:  escalado y tope
 *  - invitado:        no rompe ni persiste
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/streak.js');
});

const AS = () => window.AppStreak;
const UID = 'user-1';

// Fija el reloj a un día concreto (mediodía local para no rozar límites de día).
function setDay(dateStr) {
  vi.setSystemTime(new Date(dateStr + 'T12:00:00'));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AppStreak.recordActivity', () => {
  it('arranca la racha en 1 el primer día', () => {
    setDay('2026-01-01');
    const r = AS().recordActivity(UID);
    expect(r.count).toBe(1);
    expect(r.best).toBe(1);
    expect(r.incremented).toBe(true);
    expect(r.isNewRecord).toBe(true);
  });

  it('es idempotente dentro del mismo día', () => {
    setDay('2026-01-01');
    AS().recordActivity(UID);
    const r = AS().recordActivity(UID);
    expect(r.count).toBe(1);
    expect(r.incremented).toBe(false);
  });

  it('sube en días consecutivos', () => {
    setDay('2026-01-01');
    AS().recordActivity(UID);
    setDay('2026-01-02');
    AS().recordActivity(UID);
    setDay('2026-01-03');
    const r = AS().recordActivity(UID);
    expect(r.count).toBe(3);
    expect(r.best).toBe(3);
  });

  it('se reinicia a 1 tras saltarse un día', () => {
    setDay('2026-01-01');
    AS().recordActivity(UID);
    setDay('2026-01-02');
    AS().recordActivity(UID); // count = 2
    setDay('2026-01-04'); // faltó el 03
    const r = AS().recordActivity(UID);
    expect(r.count).toBe(1);
    expect(r.best).toBe(2); // el récord se conserva
  });
});

describe('AppStreak.getStreak', () => {
  it('marca countedToday cuando ya se contó hoy', () => {
    setDay('2026-01-01');
    AS().recordActivity(UID);
    const s = AS().getStreak(UID);
    expect(s.count).toBe(1);
    expect(s.countedToday).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it('marca atRisk cuando la última cuenta fue ayer', () => {
    setDay('2026-01-01');
    AS().recordActivity(UID);
    setDay('2026-01-02');
    const s = AS().getStreak(UID);
    expect(s.count).toBe(1);
    expect(s.countedToday).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  it('reporta count 0 cuando la racha ya está rota (más de un día)', () => {
    setDay('2026-01-01');
    AS().recordActivity(UID);
    setDay('2026-01-05');
    const s = AS().getStreak(UID);
    expect(s.count).toBe(0);
    expect(s.atRisk).toBe(false);
  });
});

describe('AppStreak.bonusForStreak', () => {
  it('no da bonus el primer día', () => {
    expect(AS().bonusForStreak(1)).toBe(0);
    expect(AS().bonusForStreak(0)).toBe(0);
  });

  it('escala con la racha', () => {
    expect(AS().bonusForStreak(2)).toBe(5);
    expect(AS().bonusForStreak(4)).toBe(15);
  });

  it('topa en 50', () => {
    expect(AS().bonusForStreak(100)).toBe(50);
  });
});

describe('AppStreak con invitado', () => {
  it('no persiste ni rompe', () => {
    setDay('2026-01-01');
    const r = AS().recordActivity('Invitado');
    expect(r.count).toBe(0);
    const s = AS().getStreak('Invitado');
    expect(s.count).toBe(0);
  });
});
