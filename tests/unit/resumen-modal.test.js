/**
 * tests/unit/resumen-modal.test.js
 * Tests para js/core/common-ui.js → accesibilidad del modal #resumenModal
 *
 * Cubre: foco al abrir, Escape cierra y el foco vuelve al botón que lo abrió.
 */
import { beforeAll, describe, it, expect } from 'vitest';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeAll(async () => {
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
  }));
  document.body.innerHTML = `
    <button id="opener" type="button">Ep. 1</button>
    <div id="resumenModal" class="modal-overlay" style="display:none;">
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
        <h3 id="modalTitle">Info</h3>
        <button class="modal-close-btn" type="button" data-close-modal="resumen">×</button>
        <button class="modal-close-btn-footer" type="button" data-close-modal="resumen">Cerrar</button>
      </div>
    </div>`;
  await import('../../js/core/common-ui.js');
});

describe('modal de resumen', () => {
  it('al abrir enfoca cerrar, Escape cierra y devuelve el foco', async () => {
    const opener = document.getElementById('opener');
    const modal = document.getElementById('resumenModal');
    opener.focus();
    modal.style.display = 'flex';
    await flush();
    expect(document.activeElement.classList.contains('modal-close-btn')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modal.style.display).toBe('none');
    await flush();
    expect(document.activeElement).toBe(opener);
  });

  it('Tab desde el último vuelve al primero', async () => {
    const modal = document.getElementById('resumenModal');
    modal.style.display = 'flex';
    await flush();
    document.querySelector('.modal-close-btn-footer').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement.classList.contains('modal-close-btn')).toBe(true);
    modal.style.display = 'none';
  });
});
