/**
 * tests/unit/render.test.js
 * Tests para la lógica pura de js/detalle/render.js → window.RenderPure
 *
 * Cubre:
 *  - formatCountdown: formateo de la cuenta regresiva al próximo episodio
 */
import { beforeAll, describe, it, expect } from 'vitest';

let P;
beforeAll(async () => {
  await import('../../js/detalle/render.js');
  P = window.RenderPure;
});

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatCountdown', () => {
  it('solo minutos cuando falta menos de una hora', () => {
    expect(P.formatCountdown(5 * MIN)).toBe('5m');
    expect(P.formatCountdown(59 * MIN)).toBe('59m');
  });

  it('horas y minutos cuando falta menos de un día', () => {
    expect(P.formatCountdown(2 * HOUR + 30 * MIN)).toBe('2h 30m');
  });

  it('días, horas y minutos cuando falta un día o más', () => {
    expect(P.formatCountdown(3 * DAY + 4 * HOUR + 5 * MIN)).toBe('3d 4h 5m');
  });

  it('nunca es negativo: 0m para tiempos pasados', () => {
    expect(P.formatCountdown(-10000)).toBe('0m');
    expect(P.formatCountdown(0)).toBe('0m');
  });

  it('trunca los segundos sobrantes hacia abajo', () => {
    expect(P.formatCountdown(90 * 1000)).toBe('1m'); // 90s → 1m
  });
});
