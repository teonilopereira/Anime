/**
 * tests/unit/supabase-config.test.js
 * Tests para api/supabase-config.js → cargador diferido del cliente de Supabase.
 *
 * Cubre el contrato que protege la optimización de rendimiento clave: NO
 * descargar el SDK de Supabase (~216 KB) para visitantes anónimos.
 *
 *  - Rama anónima en import:   sin sesión guardada, sin login, sin tokens en URL
 *                              → no se toca el cliente; AppSupabase queda null.
 *  - __puedeHaberSesion():     detecta la sesión mirando localStorage en vivo.
 *  - haySesionGuardada():      reconoce la clave `sb-<ref>-auth-token` de Supabase.
 *  - Eventos de arranque:      dispara `supabase-ready` y `supabase-auth-changed`.
 *  - __loadSupabase:           queda expuesto para la carga bajo demanda.
 *
 * NOTA: los tests nunca llaman a __loadSupabase(), porque eso dispararía el
 * import dinámico del SDK real (y una llamada de red). Solo verificamos la
 * lógica de decisión, que es lo que puede romperse en una regresión.
 */

import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

// Capturamos los eventos que se disparan durante el import (rama anónima).
const readyEvents = [];
const authEvents = [];

beforeAll(async () => {
  // Aseguramos la rama anónima: sin sesión guardada antes del import.
  localStorage.clear();

  window.addEventListener('supabase-ready', (e) => readyEvents.push(e.detail));
  window.addEventListener('supabase-auth-changed', (e) => authEvents.push(e.detail));

  await import('../../api/supabase-config.js');
});

describe('supabase-config: rama anónima en import', () => {
  it('no crea el cliente: AppSupabase queda en null', () => {
    expect(window.AppSupabase).toBeNull();
  });

  it('AppSupabaseReady resuelve a null sin cargar el SDK', async () => {
    await expect(window.AppSupabaseReady).resolves.toBeNull();
  });

  it('expone __loadSupabase como función para la carga diferida', () => {
    expect(typeof window.__loadSupabase).toBe('function');
  });

  it('dispara supabase-ready con detalle null', () => {
    expect(readyEvents).toContainEqual(null);
  });

  it('dispara supabase-auth-changed con usuario nulo y username vacío', () => {
    expect(authEvents).toContainEqual({ user: null, username: '' });
  });
});

describe('supabase-config: __puedeHaberSesion / detección de sesión', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve false para un visitante anónimo sin sesión guardada', () => {
    expect(window.__puedeHaberSesion()).toBe(false);
  });

  it('devuelve true cuando existe el token de auth de Supabase', () => {
    localStorage.setItem('sb-llytokoztnjuczuppzgs-auth-token', '{"access_token":"x"}');
    expect(window.__puedeHaberSesion()).toBe(true);
  });

  it('reconoce el patrón sin depender del ref del proyecto', () => {
    localStorage.setItem('sb-cualquier-otro-ref-auth-token', '{}');
    expect(window.__puedeHaberSesion()).toBe(true);
  });

  it('ignora claves de Supabase que no son el token de auth', () => {
    localStorage.setItem('sb-abc-something-else', '{}');
    expect(window.__puedeHaberSesion()).toBe(false);
  });

  it('ignora claves ajenas a Supabase', () => {
    localStorage.setItem('animeDestiny:tema', 'oscuro');
    localStorage.setItem('otro-auth-token', '{}'); // no empieza con sb-
    expect(window.__puedeHaberSesion()).toBe(false);
  });

  it('vuelve a false al limpiarse la sesión (re-evalúa en vivo)', () => {
    localStorage.setItem('sb-x-auth-token', '{}');
    expect(window.__puedeHaberSesion()).toBe(true);
    localStorage.removeItem('sb-x-auth-token');
    expect(window.__puedeHaberSesion()).toBe(false);
  });
});
