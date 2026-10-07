/**
 * tests/unit/ui-extras.test.js
 * Tests para js/ui/ui-extras.js → window.Dialog, botón "Volver arriba" y ripple.
 */

import { beforeAll, afterEach, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/ui/ui-extras.js');
});

afterEach(() => {
  document.querySelectorAll('dialog').forEach((d) => d.remove());
});

function boton(valor) {
  return document.querySelector(`dialog .ad-dialog-btn[value="${valor}"]`);
}

describe('Dialog.confirm', () => {
  it('resuelve true al aceptar', async () => {
    const p = window.Dialog.confirm({ title: 'Título', message: '¿Seguro?', okLabel: 'Sí' });
    expect(document.querySelector('.ad-dialog-msg').textContent).toBe('¿Seguro?');
    expect(boton('ok').textContent).toBe('Sí');
    boton('ok').click();
    await expect(p).resolves.toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('resuelve false al cancelar', async () => {
    const p = window.Dialog.confirm('¿Borrar?');
    boton('cancel').click();
    await expect(p).resolves.toBe(false);
  });

  it('resuelve false con Esc', async () => {
    const p = window.Dialog.confirm('¿Borrar?');
    document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await expect(p).resolves.toBe(false);
  });

  it('en modo peligroso el foco arranca en Cancelar', () => {
    window.Dialog.confirm({ message: '¿Borrar?', danger: true });
    expect(document.activeElement).toBe(boton('cancel'));
  });

  it('inserta el mensaje como texto, no como HTML', () => {
    window.Dialog.confirm('<img src=x onerror=alert(1)>');
    expect(document.querySelector('.ad-dialog-msg img')).toBeNull();
  });
});

describe('Dialog.alert', () => {
  it('muestra un solo botón y resuelve al aceptar', async () => {
    const p = window.Dialog.alert('Listo');
    expect(boton('cancel')).toBeNull();
    boton('ok').click();
    await expect(p).resolves.toBeUndefined();
  });
});

describe('Volver arriba', () => {
  it('agrega un único botón oculto al cargar', () => {
    const btns = document.querySelectorAll('.scroll-top-btn');
    expect(btns.length).toBe(1);
    expect(btns[0].classList.contains('is-visible')).toBe(false);
  });
});

describe('Ripple', () => {
  it('agrega la onda al tocar un botón y no a elementos con data-no-ripple', () => {
    const b = document.createElement('button');
    document.body.appendChild(b);
    b.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(b.querySelector('.ripple-host .ripple-wave')).not.toBeNull();

    const quieto = document.createElement('button');
    quieto.setAttribute('data-no-ripple', '');
    document.body.appendChild(quieto);
    quieto.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(quieto.querySelector('.ripple-host')).toBeNull();
  });
});
