/**
 * tests/unit/missions-notif.test.js
 * Tests para js/core/missions.js → el aviso de misión cumplida respeta
 * window.AppNotifPrefs (categoría 'retos') (apagada o en pausa) pero no gasta el límite diario
 * (no llama a recordSent).
 */
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  window.getCurrentUserIdSafe = () => 'teo';
  await import('../../js/core/missions.js');
});

beforeEach(() => {
  localStorage.clear();
  window.addUserPoints = vi.fn();
  window.Toast = { success: vi.fn() };
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
  delete window.AppNotifPrefs;
});

describe('aviso de misión cumplida', () => {
  it('con "retos" apagado da la EXP pero no muestra el aviso', () => {
    window.AppNotifPrefs = { isEnabled: vi.fn(() => false), isPaused: vi.fn(() => false), recordSent: vi.fn() };
    window.AppMissions.track('quiz_play');
    expect(window.addUserPoints).toHaveBeenCalledWith('teo', 10);
    expect(window.AppNotifPrefs.isEnabled).toHaveBeenCalledWith('retos');
    expect(window.Toast.success).not.toHaveBeenCalled();
    expect(window.AppNotifPrefs.recordSent).not.toHaveBeenCalled();
  });

  it('en pausa da la EXP pero no muestra el aviso', () => {
    window.AppNotifPrefs = { isEnabled: vi.fn(() => true), isPaused: vi.fn(() => true), recordSent: vi.fn() };
    window.AppMissions.track('quiz_play');
    expect(window.addUserPoints).toHaveBeenCalledWith('teo', 10);
    expect(window.Toast.success).not.toHaveBeenCalled();
  });

  it('si se permite, lo muestra sin gastar el límite diario', () => {
    window.AppNotifPrefs = { isEnabled: vi.fn(() => true), isPaused: vi.fn(() => false), isAllowed: vi.fn(() => false), recordSent: vi.fn() };
    window.AppMissions.track('quiz_play');
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
    expect(window.AppNotifPrefs.recordSent).not.toHaveBeenCalled();
    // isAllowed incluye el límite diario: aunque esté agotado, el toast sale.
    expect(window.AppNotifPrefs.isAllowed).not.toHaveBeenCalled();
  });

  it('con notif-prefs real no suma al contador del día', async () => {
    await import('../../js/core/notif-prefs.js');
    const before = window.AppNotifPrefs.sentToday();
    window.AppMissions.track('quiz_play');
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
    expect(window.AppNotifPrefs.sentToday()).toBe(before);
  });

  it('sin notif-prefs cargado muestra el aviso como antes', () => {
    window.AppMissions.track('quiz_play');
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
  });
});
