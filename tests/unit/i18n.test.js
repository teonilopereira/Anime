/**
 * tests/unit/i18n.test.js
 * Tests para js/core/i18n.js
 *
 * Verifica:
 *  - Estructura y existencia del API de AppI18n.
 *  - Traducción dinámica con interpolación: AppI18n.t()
 *  - Consistencia de diccionarios: que todas las claves en español 'es'
 *    estén definidas en inglés 'en'.
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/i18n.js');
});

describe('AppI18n API', () => {
  it('se expone correctamente en window', () => {
    expect(window.AppI18n).toBeDefined();
    expect(typeof window.AppI18n.setLang).toBe('function');
    expect(typeof window.AppI18n.getLang).toBe('function');
    expect(typeof window.AppI18n.t).toBe('function');
  });

  it('devuelve el idioma actual (por defecto "es")', () => {
    expect(window.AppI18n.getLang()).toBe('es');
  });

  it('traduce una clave existente con fallback si es necesario', () => {
    expect(window.AppI18n.t('nav.inicio')).toBe('Inicio');
  });

  it('apoya interpolación en variables de texto', () => {
    const text = window.AppI18n.t('detail.completados', { vistos: 5, total: 10 });
    expect(text).toBe('5/10 completados');
  });

  it('retorna corchetes para claves inexistentes', () => {
    expect(window.AppI18n.t('clave.falsa.inventada')).toBe('[clave.falsa.inventada]');
  });
});

describe('i18n Dictionary Consistency', () => {
  it('el diccionario en ingles tiene exactamente las mismas claves que el de español', () => {
    const translations = window.AppI18n._translations;
    expect(translations).toBeDefined();
    expect(translations.es).toBeDefined();
    expect(translations.en).toBeDefined();

    const esKeys = Object.keys(translations.es).sort();
    const enKeys = Object.keys(translations.en).sort();

    // Comparar que ambos diccionarios tengan las mismas claves
    expect(enKeys).toEqual(esKeys);
  });
});
