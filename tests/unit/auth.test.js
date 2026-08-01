/**
 * tests/unit/auth.test.js
 * Tests para los helpers puros de js/core/auth.js
 * (expuestos en AnimeDestiny.internals.auth) y window.apodoLabel.
 *
 * Cubre:
 *  - isValidGmailAddress: validación estricta de direcciones @gmail.com
 *  - displayNameFromUser: derivación del nombre a mostrar con fallbacks
 *  - apodoLabel:          traducción de id de apodo a etiqueta
 */

import { beforeAll, describe, it, expect } from 'vitest';

let AUTH;

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/core/auth.js');
  AUTH = window.AnimeDestiny.internals.auth;
});

// ─── isValidGmailAddress ──────────────────────────────────────────────────────

describe('isValidGmailAddress', () => {
  it('acepta direcciones @gmail.com válidas (case-insensitive, con espacios)', () => {
    expect(AUTH.isValidGmailAddress('user@gmail.com')).toBe(true);
    expect(AUTH.isValidGmailAddress('  User@Gmail.com  ')).toBe(true);
  });

  it('rechaza otros dominios y formatos inválidos', () => {
    expect(AUTH.isValidGmailAddress('user@hotmail.com')).toBe(false);
    expect(AUTH.isValidGmailAddress('user@gmail.com.evil.com')).toBe(false);
    expect(AUTH.isValidGmailAddress('sin-arroba')).toBe(false);
    expect(AUTH.isValidGmailAddress('@gmail.com')).toBe(false);
    expect(AUTH.isValidGmailAddress('')).toBe(false);
    expect(AUTH.isValidGmailAddress(null)).toBe(false);
  });
});

// ─── displayNameFromUser ──────────────────────────────────────────────────────

describe('displayNameFromUser', () => {
  it('"Invitado" cuando no hay usuario', () => {
    expect(AUTH.displayNameFromUser(null)).toBe('Invitado');
  });

  it('prioriza username de user_metadata', () => {
    expect(AUTH.displayNameFromUser({ user_metadata: { username: 'neo' } })).toBe('neo');
  });

  it('cae en name/full_name', () => {
    expect(AUTH.displayNameFromUser({ user_metadata: { full_name: 'Thomas A.' } })).toBe('Thomas A.');
  });

  it('usa el prefijo del email como último recurso antes de "Usuario"', () => {
    expect(AUTH.displayNameFromUser({ email: 'trinity@gmail.com' })).toBe('trinity');
  });

  it('"Usuario" si no hay ningún dato aprovechable', () => {
    expect(AUTH.displayNameFromUser({ user_metadata: {} })).toBe('Usuario');
  });
});

// ─── apodoLabel ───────────────────────────────────────────────────────────────

describe('apodoLabel', () => {
  it('devuelve cadena vacía para un id desconocido', () => {
    expect(window.apodoLabel('no-existe')).toBe('');
  });

  it('es una función expuesta globalmente', () => {
    expect(typeof window.apodoLabel).toBe('function');
  });
});
