/**
 * tests/unit/missions-notif.test.js
 * Tests para js/core/missions.js → el aviso de misión cumplida respeta
 * window.AppNotifPrefs (categoría 'retos') y cuenta en el límite diario.
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
  it('con "retos" bloqueado da la EXP pero no muestra el aviso', () => {
    window.AppNotifPrefs = { isAllowed: vi.fn(() => false), recordSent: vi.fn() };
    window.AppMissions.track('quiz_play');
    expect(window.addUserPoints).toHaveBeenCalledWith('teo', 10);
    expect(window.AppNotifPrefs.isAllowed).toHaveBeenCalledWith('retos');
    expect(window.Toast.success).not.toHaveBeenCalled();
    expect(window.AppNotifPrefs.recordSent).not.toHaveBeenCalled();
  });

  it('si se permite, lo muestra y lo registra', () => {
    window.AppNotifPrefs = { isAllowed: vi.fn(() => true), recordSent: vi.fn() };
    window.AppMissions.track('quiz_play');
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
    expect(window.AppNotifPrefs.recordSent).toHaveBeenCalledWith('retos');
  });

  it('sin notif-prefs cargado muestra el aviso como antes', () => {
    window.AppMissions.track('quiz_play');
    expect(window.Toast.success).toHaveBeenCalledTimes(1);
  });
});
