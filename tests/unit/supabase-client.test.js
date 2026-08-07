/**
 * tests/unit/supabase-client.test.js
 * Tests para api/supabase-client.js → window.AppSupabase.
 *
 * Cubre el contrato de DEGRADACIÓN ELEGANTE: cuando falta la configuración
 * (window.AppConfig sin url/key), el módulo NO debe crear un cliente ni lanzar;
 * debe dejar la app en estado "sin sesión" para que las ~63 lecturas de
 * window.AppSupabase (casi todas con optional chaining) sigan funcionando.
 *
 * Este es el mismo estado en el que corre un visitante anónimo, así que el
 * comportamiento importa tanto para deploys mal configurados como para el
 * tráfico normal sin login.
 *
 * No se testea la rama con credenciales reales aquí porque crearía un cliente
 * real de Supabase e intentaría llamadas de red; la lógica pura de esa rama
 * (detección de sesión) se cubre en supabase-config.test.js.
 */

import { beforeAll, describe, it, expect } from 'vitest';

const readyEvents = [];
const authEvents = [];

beforeAll(async () => {
  // Garantizamos la rama "sin configuración": AppConfig ausente.
  delete window.AppConfig;

  window.addEventListener('supabase-ready', (e) => readyEvents.push(e.detail));
  window.addEventListener('supabase-auth-changed', (e) => authEvents.push(e.detail));

  await import('../../api/supabase-client.js');
});

describe('supabase-client: sin configuración (degradación elegante)', () => {
  it('no lanza al importarse y deja AppSupabase en null', () => {
    expect(window.AppSupabase).toBeNull();
  });

  it('AppSupabaseReady resuelve a null', async () => {
    await expect(window.AppSupabaseReady).resolves.toBeNull();
  });

  it('dispara supabase-ready con detalle null', () => {
    expect(readyEvents).toContainEqual(null);
  });

  it('dispara supabase-auth-changed indicando que no hay usuario', () => {
    expect(authEvents).toContainEqual({ user: null, username: '' });
  });

  it('el acceso encadenado a AppSupabase degrada sin romper', () => {
    // Patrón real usado en toda la app: window.AppSupabase?.getCurrentUserSync?.()
    expect(() => window.AppSupabase?.getCurrentUserSync?.()).not.toThrow();
    expect(window.AppSupabase?.isSignedIn?.()).toBeUndefined();
  });
});
