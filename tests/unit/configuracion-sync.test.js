/**
 * tests/unit/configuracion-sync.test.js
 * Bloque "Sincronización" de configuracion.html (js/pages/configuracion.js):
 *  - sin sesión (o sin AppSyncMetrics) queda oculto
 *  - con sesión muestra "N cambios pendientes" y el último error (código y fecha)
 *  - "Reintentar" llama a AppSyncMetrics.drain() y repinta
 *
 * Carga el <body> real de configuracion.html y el script de la página sobre jsdom.
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync(path.resolve(__dirname, '../../configuracion.html'), 'utf8');
const BODY = HTML.slice(HTML.indexOf('<body'), HTML.lastIndexOf('</body>'))
  .replace(/^<body[^>]*>/, '')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

async function cargar({ signedIn = true, metrics = null } = {}) {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = BODY;
  window.AppSupabase = { isSignedIn: () => signedIn, getCurrentUserSync: () => (signedIn ? { id: 'u1' } : null) };
  delete window.waitForSupabase;
  if (metrics) window.AppSyncMetrics = metrics; else delete window.AppSyncMetrics;
  await import('../../js/pages/configuracion.js?t=' + Math.random());
  await flush();
}

function fakeMetrics({ pending = 0, lastCode = '', lastAt = 0, drain } = {}) {
  const state = { pending };
  return {
    state,
    get: vi.fn(() => ({ ok: 0, fail: lastCode ? 1 : 0, retry: 0, lastCode, lastAt })),
    pending: vi.fn(() => state.pending),
    drain: drain || vi.fn(async () => { state.pending = 0; })
  };
}

describe('Configuración · bloque Sincronización', () => {
  it('sin sesión queda oculto', async () => {
    await cargar({ signedIn: false, metrics: fakeMetrics({ pending: 3 }) });
    expect(document.getElementById('cfgSync').hidden).toBe(true);
  });

  it('sin AppSyncMetrics (states.js no cargó) queda oculto', async () => {
    await cargar({ signedIn: true, metrics: null });
    expect(document.getElementById('cfgSync').hidden).toBe(true);
  });

  it('con sesión muestra pendientes y el último error con código', async () => {
    const at = new Date('2026-11-10T15:30:00').getTime();
    await cargar({ metrics: fakeMetrics({ pending: 3, lastCode: '503', lastAt: at }) });
    const box = document.getElementById('cfgSync');
    expect(box.hidden).toBe(false);
    expect(document.getElementById('cfgSyncPending').textContent).toContain('3 cambios pendientes');
    const err = document.getElementById('cfgSyncError');
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('503');
    expect(document.getElementById('cfgSyncRetry').disabled).toBe(false);
  });

  it('singular, sin error y al día', async () => {
    const m = fakeMetrics({ pending: 1 });
    await cargar({ metrics: m });
    expect(document.getElementById('cfgSyncPending').textContent).toBe('1 cambio pendiente');
    expect(document.getElementById('cfgSyncError').hidden).toBe(true);
    m.state.pending = 0;
    window.CfgSync.render();
    expect(document.getElementById('cfgSyncPending').textContent).toBe('Todo sincronizado.');
    expect(document.getElementById('cfgSyncRetry').disabled).toBe(true);
  });

  it('Reintentar llama a drain() y repinta', async () => {
    const m = fakeMetrics({ pending: 2 });
    await cargar({ metrics: m });
    document.getElementById('cfgSyncRetry').click();
    await flush();
    expect(m.drain).toHaveBeenCalledTimes(1);
    expect(document.getElementById('cfgSyncPending').textContent).toBe('Todo sincronizado.');
  });

  it('si drain falla no rompe y sigue mostrando lo pendiente', async () => {
    const m = fakeMetrics({ pending: 2, drain: vi.fn(async () => { throw new Error('x'); }) });
    await cargar({ metrics: m });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.getElementById('cfgSyncRetry').click();
    await flush();
    warn.mockRestore();
    expect(m.drain).toHaveBeenCalled();
    expect(document.getElementById('cfgSyncPending').textContent).toContain('2 cambios pendientes');
    expect(document.getElementById('cfgSyncRetry').disabled).toBe(false);
  });

  it('al iniciar sesión aparece (supabase-auth-changed)', async () => {
    let signed = false;
    await cargar({ signedIn: false, metrics: fakeMetrics({ pending: 1 }) });
    window.AppSupabase.isSignedIn = () => signed;
    signed = true;
    window.dispatchEvent(new Event('supabase-auth-changed'));
    expect(document.getElementById('cfgSync').hidden).toBe(false);
  });
});
