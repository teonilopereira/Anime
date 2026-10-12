/**
 * tests/unit/ripple.test.js
 * Tests para js/ui/ripple.js → onda al tocar botones (adaptado de Quasar).
 *
 * Cubre:
 *  - pointerdown en un botón crea la capa con la onda y la borra al terminar
 *  - la capa copia la posición y el tamaño del botón
 *  - no se dispara en botones deshabilitados, con data-no-ripple ni en otros elementos
 *  - Enter dispara la onda desde el teclado
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/ui/ripple.js');
});

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.advanceTimersByTime(1000);
  vi.useRealTimers();
});

const layers = () => document.querySelectorAll('.ripple-layer');

function boton(html = '<button>Guardar</button>') {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild;
  el.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 40, right: 110, bottom: 60 });
  return el;
}

function tocar(el) {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 30, clientY: 30 }));
}

describe('Ripple', () => {
  it('crea la onda sobre el botón y la elimina al terminar', () => {
    tocar(boton());
    expect(layers()).toHaveLength(1);
    const layer = layers()[0];
    expect(layer.style.left).toBe('10px');
    expect(layer.style.top).toBe('20px');
    expect(layer.style.width).toBe('100px');
    expect(layer.style.height).toBe('40px');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.querySelector('.ripple-wave--enter')).not.toBeNull();

    vi.advanceTimersByTime(250);
    expect(layer.querySelector('.ripple-wave--leave')).not.toBeNull();
    vi.advanceTimersByTime(275);
    expect(layers()).toHaveLength(0);
  });

  it('funciona al tocar un ícono dentro del botón', () => {
    const el = boton('<button><span class="icono">★</span></button>');
    tocar(el.querySelector('.icono'));
    expect(layers()).toHaveLength(1);
  });

  it('ignora botones deshabilitados y data-no-ripple', () => {
    tocar(boton('<button disabled>X</button>'));
    tocar(boton('<button data-no-ripple>X</button>'));
    tocar(boton('<div data-no-ripple><button>X</button></div>').querySelector('button'));
    expect(layers()).toHaveLength(0);
  });

  it('ignora elementos que no son botones', () => {
    tocar(boton('<p>texto</p>'));
    expect(layers()).toHaveLength(0);
  });

  it('se dispara con Enter desde el teclado', () => {
    boton().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    expect(layers()).toHaveLength(1);
  });
});
