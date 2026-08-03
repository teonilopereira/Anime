/**
 * tests/unit/push.test.js
 * Tests para js/core/push.js → window.PushNotifs
 *
 * Cubre las partes puras/sincrónicas (el resto depende de PushManager y
 * Supabase, que no existen en el entorno de test):
 *  - urlBase64ToUint8Array: decodifica base64url a bytes
 *  - isConfigured:          refleja AppConfig.vapidPublicKey
 *  - getState:              'unsupported' sin PushManager, 'unconfigured' sin clave
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/push.js');
});

describe('PushNotifs.urlBase64ToUint8Array', () => {
  const conv = () => window.PushNotifs.urlBase64ToUint8Array;

  it('decodifica base64 estándar a los bytes correctos', () => {
    // "Man" en base64 es "TWFu" -> [77, 97, 110]
    const out = conv()('TWFu');
    expect(Array.from(out)).toEqual([77, 97, 110]);
  });

  it('maneja el alfabeto base64url (- y _) y el padding faltante', () => {
    // 0xFB 0xFF 0xBF -> base64 "+/+/", base64url "-_-_" (sin padding)
    const out = conv()('-_-_');
    expect(Array.from(out)).toEqual([251, 255, 191]);
  });

  it('devuelve un Uint8Array', () => {
    expect(conv()('TWFu')).toBeInstanceOf(Uint8Array);
  });
});

describe('PushNotifs.isConfigured', () => {
  it('es false sin clave VAPID', () => {
    delete window.AppConfig;
    expect(window.PushNotifs.isConfigured()).toBe(false);
  });

  it('es true con clave VAPID', () => {
    window.AppConfig = { vapidPublicKey: 'BExampleKey' };
    expect(window.PushNotifs.isConfigured()).toBe(true);
    delete window.AppConfig;
  });
});

describe('PushNotifs.getState', () => {
  it('es "unsupported" cuando el navegador no tiene PushManager', async () => {
    // jsdom no expone PushManager -> isSupported() es false.
    expect(window.PushNotifs.isSupported()).toBe(false);
    expect(await window.PushNotifs.getState()).toBe('unsupported');
  });
});
