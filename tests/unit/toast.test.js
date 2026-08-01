/**
 * tests/unit/toast.test.js
 * Tests para js/ui/toast.js → window.Toast
 *
 * Cubre:
 *  - API pública:     success/error/info/warning existen y están congeladas
 *  - render:          crea el contenedor y la notificación con clase por tipo
 *  - contenido:       icono correcto y mensaje insertado como textContent (seguro)
 *  - cierre manual:   el botón de cierre elimina la notificación
 *  - autodestrucción: el toast desaparece pasado el tiempo indicado
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/ui/toast.js');
});

beforeEach(() => {
  vi.useFakeTimers();
  // requestAnimationFrame ejecuta el callback de inmediato para simplificar
  vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 0; });
});

afterEach(() => {
  // Avanzar el reloj vacía cualquier toast pendiente; así el módulo limpia y
  // resetea su propio contenedor interno (container = null) entre tests, en
  // lugar de dejar una referencia obsoleta a un nodo desprendido del DOM.
  vi.advanceTimersByTime(10000);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const container = () => document.querySelector('.toast-container');
const toasts = () => document.querySelectorAll('.toast-item');

describe('Toast API pública', () => {
  it('expone success/error/info/warning', () => {
    ['success', 'error', 'info', 'warning'].forEach((m) => {
      expect(typeof window.Toast[m]).toBe('function');
    });
  });

  it('la API está congelada (Object.freeze)', () => {
    expect(Object.isFrozen(window.Toast)).toBe(true);
  });
});

describe('Toast render', () => {
  it('crea el contenedor en el body al mostrar el primer toast', () => {
    expect(container()).toBeNull();
    window.Toast.info('hola');
    expect(container()).not.toBeNull();
    expect(toasts().length).toBe(1);
  });

  it('aplica la clase correspondiente al tipo', () => {
    window.Toast.success('ok');
    expect(document.querySelector('.toast-item.toast-success')).not.toBeNull();
  });

  it('muestra el icono correcto según el tipo', () => {
    window.Toast.error('falló');
    const icon = document.querySelector('.toast-item.toast-error .toast-icon');
    expect(icon.textContent).toBe('✕');
  });

  it('inserta el mensaje como texto plano (no como HTML)', () => {
    window.Toast.info('<img src=x onerror=alert(1)>');
    const msg = document.querySelector('.toast-message');
    // textContent conserva el string literal; no debe crear un <img>
    expect(msg.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(msg.querySelector('img')).toBeNull();
  });

  it('acumula varios toasts en el mismo contenedor', () => {
    window.Toast.info('uno');
    window.Toast.warning('dos');
    expect(toasts().length).toBe(2);
    expect(document.querySelectorAll('.toast-container').length).toBe(1);
  });
});

describe('Toast cierre manual', () => {
  it('el botón de cierre inicia la salida del toast', () => {
    window.Toast.info('cerrame');
    const toast = document.querySelector('.toast-item');
    toast.querySelector('.toast-close').click();
    expect(toast.classList.contains('is-leaving')).toBe(true);
    // La red de seguridad (setTimeout 400ms) retira el nodo del DOM
    vi.advanceTimersByTime(400);
    expect(toasts().length).toBe(0);
  });
});

describe('Toast autodestrucción', () => {
  it('se elimina automáticamente tras la duración indicada', () => {
    window.Toast.info('efímero', 1000);
    expect(toasts().length).toBe(1);
    // duración + red de seguridad de la animación
    vi.advanceTimersByTime(1000 + 400);
    expect(toasts().length).toBe(0);
  });

  it('retira el contenedor cuando no quedan toasts', () => {
    window.Toast.info('solo', 500);
    vi.advanceTimersByTime(500 + 400);
    expect(container()).toBeNull();
  });
});
