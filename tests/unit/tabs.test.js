/**
 * tests/unit/tabs.test.js
 * Tests para js/ui/tabs.js → pestañas con indicador (adaptado de QTabs de Quasar).
 *
 * Cubre:
 *  - attach agrega un solo indicador y marca roles
 *  - aria-selected y tabindex siguen a la clase is-active
 *  - las flechas, Home y End mueven el foco entre pestañas
 */

import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/ui/tabs.js');
});

beforeEach(() => {
  document.body.innerHTML = '';
});

function crear() {
  const root = document.createElement('div');
  root.className = 'q-tabs';
  root.innerHTML =
    '<button class="q-tab is-active">Populares</button>' +
    '<button class="q-tab">Tendencias</button>' +
    '<button class="q-tab">Temporada</button>';
  document.body.appendChild(root);
  window.QTabs.attach(root);
  return root;
}

const tabs = (root) => Array.from(root.querySelectorAll('.q-tab'));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('QTabs', () => {
  it('agrega un solo indicador y los roles de tablist/tab', () => {
    const root = crear();
    window.QTabs.attach(root);
    expect(root.querySelectorAll('.q-tabs__indicator')).toHaveLength(1);
    expect(root.getAttribute('role')).toBe('tablist');
    tabs(root).forEach((t) => expect(t.getAttribute('role')).toBe('tab'));
  });

  it('aria-selected y tabindex siguen a is-active', async () => {
    const root = crear();
    const [a, b] = tabs(root);
    expect(a.getAttribute('aria-selected')).toBe('true');
    expect(b.getAttribute('aria-selected')).toBe('false');
    expect(a.tabIndex).toBe(0);
    expect(b.tabIndex).toBe(-1);

    a.classList.remove('is-active');
    b.classList.add('is-active');
    await flush(); // el MutationObserver corre como microtarea

    expect(a.getAttribute('aria-selected')).toBe('false');
    expect(b.getAttribute('aria-selected')).toBe('true');
    expect(b.tabIndex).toBe(0);
  });

  it('las flechas, Home y End mueven el foco', () => {
    const root = crear();
    const [a, b, c] = tabs(root);
    const tecla = (key) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    a.focus();
    tecla('ArrowRight');
    expect(document.activeElement).toBe(b);
    tecla('End');
    expect(document.activeElement).toBe(c);
    tecla('ArrowRight');
    expect(document.activeElement).toBe(a);
    tecla('ArrowLeft');
    expect(document.activeElement).toBe(c);
    tecla('Home');
    expect(document.activeElement).toBe(a);
  });
});
