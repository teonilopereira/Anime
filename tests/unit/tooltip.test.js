/**
 * tests/unit/tooltip.test.js
 * Tests para js/ui/tooltip.js → cartel flotante (adaptado de QTooltip de Quasar).
 *
 * Cubre:
 *  - data-tooltip se muestra tras la demora y se oculta al salir
 *  - title se convierte a data-tooltip (y a aria-label si el botón es solo un ícono)
 *  - no se muestra con toque (touch)
 *  - se ubica abajo cuando no entra arriba
 *  - Escape lo oculta
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/ui/tooltip.js');
});

beforeEach(() => {
  vi.useFakeTimers();
  window.Tooltip.hide();
  document.querySelectorAll('body > :not(.tooltip)').forEach((n) => n.remove());
});

afterEach(() => {
  vi.useRealTimers();
});

const tip = () => document.querySelector('.tooltip');
const visible = () => !!tip() && tip().classList.contains('is-visible');

function crear(html, rect = { left: 100, top: 200, width: 40, height: 40, right: 140, bottom: 240 }) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const el = wrap.firstElementChild;
  document.body.appendChild(el);
  el.getBoundingClientRect = () => rect;
  return el;
}

function hover(el, pointerType = 'mouse') {
  const e = new MouseEvent('pointerover', { bubbles: true });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  el.dispatchEvent(e);
}

describe('Tooltip', () => {
  it('muestra data-tooltip tras la demora y lo oculta al salir', () => {
    const el = crear('<button data-tooltip="Compartir">X</button>');
    hover(el);
    expect(visible()).toBe(false);
    vi.advanceTimersByTime(300);
    expect(visible()).toBe(true);
    expect(tip().textContent).toBe('Compartir');
    expect(tip().getAttribute('role')).toBe('tooltip');
    expect(el.getAttribute('aria-describedby')).toBe(tip().id);

    el.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    expect(visible()).toBe(false);
    expect(el.hasAttribute('aria-describedby')).toBe(false);
  });

  it('convierte title en data-tooltip y nombra botones de solo ícono', () => {
    const el = crear('<button title="Editar nombre"><svg></svg></button>');
    hover(el);
    expect(el.hasAttribute('title')).toBe(false);
    expect(el.getAttribute('data-tooltip')).toBe('Editar nombre');
    expect(el.getAttribute('aria-label')).toBe('Editar nombre');
  });

  it('no pisa el aria-label que ya tenía el elemento', () => {
    const el = crear('<button title="Más info" aria-label="Información"><svg></svg></button>');
    hover(el);
    expect(el.getAttribute('aria-label')).toBe('Información');
  });

  it('no se muestra con toque', () => {
    const el = crear('<button data-tooltip="Hola">X</button>');
    hover(el, 'touch');
    vi.advanceTimersByTime(500);
    expect(visible()).toBe(false);
  });

  it('se ubica abajo cuando no entra arriba', () => {
    const el = crear('<button data-tooltip="Arriba no entra">X</button>',
      { left: 100, top: 2, width: 40, height: 40, right: 140, bottom: 42 });
    hover(el);
    vi.advanceTimersByTime(300);
    expect(tip().dataset.placement).toBe('bottom');
  });

  it('Escape lo oculta', () => {
    const el = crear('<button data-tooltip="Hola">X</button>');
    hover(el);
    vi.advanceTimersByTime(300);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(visible()).toBe(false);
  });
});
