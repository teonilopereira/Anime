/**
 * tests/unit/notif-prefs.test.js
 * Tests para js/core/notif-prefs.js -> window.AppNotifPrefs
 *
 * isAllowed(categoria, now) bloquea por: categoría apagada, pausa activa,
 * silencio nocturno y límite diario. También la compatibilidad con el viejo
 * interruptor único pref:notif.
 */

import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/notif-prefs.js');
});

const P = () => window.AppNotifPrefs;
// Mediodía local: fuera del silencio nocturno por defecto (22 a 8).
const NOON = new Date(2026, 10, 12, 12, 0, 0);
const at = (h, m = 0) => new Date(2026, 10, 12, h, m, 0);

beforeEach(() => {
  localStorage.clear();
});

describe('AppNotifPrefs.isAllowed', () => {
  it('permite por defecto las cuatro categorías', () => {
    for (const c of ['episodios', 'racha', 'retos', 'comunidad']) {
      expect(P().isAllowed(c, NOON)).toBe(true);
    }
  });

  it('rechaza categorías desconocidas', () => {
    expect(P().isAllowed('spam', NOON)).toBe(false);
    expect(P().blockReason('spam', NOON)).toBe('unknown');
  });

  it('bloquea una categoría apagada sin afectar a las demás', () => {
    P().setCategory('racha', false);
    expect(P().isAllowed('racha', NOON)).toBe(false);
    expect(P().blockReason('racha', NOON)).toBe('off');
    expect(P().isAllowed('episodios', NOON)).toBe(true);
  });

  it('bloquea todo durante la pausa y vuelve al terminar', () => {
    P().pause(1, NOON);
    expect(P().isPaused(NOON)).toBe(true);
    expect(P().blockReason('episodios', NOON)).toBe('paused');
    const despues = new Date(NOON.getTime() + 86400000 + 1000);
    expect(P().isAllowed('episodios', despues)).toBe(true);
  });

  it('pause(7) dura siete días y resume() la corta', () => {
    P().pause(7, NOON);
    expect(P().isPaused(new Date(NOON.getTime() + 6 * 86400000))).toBe(true);
    P().resume();
    expect(P().isPaused(NOON)).toBe(false);
  });

  it('respeta el límite diario (default 3) y se reinicia al otro día', () => {
    expect(P().get(NOON).maxPerDay).toBe(3);
    P().recordSent('episodios', NOON);
    P().recordSent('racha', NOON);
    expect(P().isAllowed('retos', NOON)).toBe(true);
    P().recordSent('retos', NOON);
    expect(P().blockReason('retos', NOON)).toBe('limit');
    expect(P().isAllowed('episodios', NOON)).toBe(false);
    const manana = new Date(2026, 10, 13, 12, 0, 0);
    expect(P().isAllowed('episodios', manana)).toBe(true);
  });

  it('el límite es configurable', () => {
    P().set({ maxPerDay: 1 });
    P().recordSent('racha', NOON);
    expect(P().blockReason('episodios', NOON)).toBe('limit');
  });

  it('silencio nocturno que cruza la medianoche (22 a 8)', () => {
    P().set({ quiet: { enabled: true } });
    expect(P().blockReason('episodios', at(23))).toBe('quiet');
    expect(P().blockReason('episodios', at(3))).toBe('quiet');
    expect(P().isAllowed('episodios', at(8))).toBe(true);
    expect(P().isAllowed('episodios', at(21, 59))).toBe(true);
  });

  it('silencio nocturno dentro del mismo día', () => {
    P().set({ quiet: { enabled: true, start: 13, end: 15 } });
    expect(P().isAllowed('racha', at(14))).toBe(false);
    expect(P().isAllowed('racha', at(15))).toBe(true);
  });

  it('silencio nocturno apagado no bloquea de noche', () => {
    expect(P().isAllowed('episodios', at(23))).toBe(true);
  });
});

describe('compatibilidad con pref:notif', () => {
  it('si pref:notif estaba en off, todas las categorías arrancan apagadas', () => {
    localStorage.setItem('pref:notif', 'off');
    for (const c of ['episodios', 'racha', 'retos', 'comunidad']) {
      expect(P().isAllowed(c, NOON)).toBe(false);
    }
  });

  it('prender una categoría con legado off no prende las demás', () => {
    localStorage.setItem('pref:notif', 'off');
    P().setCategory('racha', true);
    expect(P().isEnabled('racha')).toBe(true);
    expect(P().isEnabled('episodios')).toBe(false);
  });

  it('mantiene pref:notif como "alguna categoría encendida"', () => {
    P().set({ categories: { episodios: false, racha: false, retos: false, comunidad: false } });
    expect(localStorage.getItem('pref:notif')).toBe('off');
    P().setCategory('retos', true);
    expect(localStorage.getItem('pref:notif')).toBe('on');
  });
});
