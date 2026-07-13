/**
 * tests/unit/utils.test.js
 * Tests para js/utils.js → window.AppUtils
 *
 * Cubre:
 *  - normalizeText:           normalización de texto (lowercase + sin tildes)
 *  - episodeStorageKey:       formato de clave de localStorage para episodios
 *  - volumeStorageKey:        formato de clave de localStorage para volúmenes
 *  - buildCatalogImageCandidates: genera rutas de imágenes candidatas
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  // constants.js inicializa AnimeDestiny.Constants (ya está en setup.js,
  // pero cargamos el real para asegurar consistencia)
  await import('../../js/core/constants.js');
  await import('../../js/utils.js');
});

// ─── normalizeText ────────────────────────────────────────────────────────────

describe('AppUtils.normalizeText', () => {
  const norm = () => window.AppUtils.normalizeText;

  it('convierte a minúsculas', () => {
    expect(norm()('NARUTO')).toBe('naruto');
  });

  it('elimina tildes y diacríticos', () => {
    expect(norm()('Ángel')).toBe('angel');
    expect(norm()('Héroe')).toBe('heroe');
    expect(norm()('Ñoño')).toBe('nono');
  });

  it('maneja string vacío', () => {
    expect(norm()('')).toBe('');
  });

  it('maneja null y undefined sin lanzar error', () => {
    expect(norm()(null)).toBe('');
    expect(norm()(undefined)).toBe('');
  });

  it('no altera texto ya normalizado', () => {
    expect(norm()('one piece')).toBe('one piece');
  });
});

// ─── episodeStorageKey ────────────────────────────────────────────────────────

describe('AppUtils.episodeStorageKey', () => {
  it('genera la clave con el formato correcto', () => {
    const key = window.AppUtils.episodeStorageKey('user1', 'anime42', 1, 5);
    expect(key).toBe('u:user1|anime:anime42|s:1|ep:5');
  });

  it('el episodio 0 (piloto) es clave válida', () => {
    const key = window.AppUtils.episodeStorageKey('userX', '1', 0, 0);
    expect(key).toBe('u:userX|anime:1|s:0|ep:0');
  });

  it('la clave es única por combinación de parámetros', () => {
    const a = window.AppUtils.episodeStorageKey('u1', '1', 1, 1);
    const b = window.AppUtils.episodeStorageKey('u1', '1', 1, 2);
    expect(a).not.toBe(b);
  });
});

// ─── volumeStorageKey ─────────────────────────────────────────────────────────

describe('AppUtils.volumeStorageKey', () => {
  it('genera clave para manga', () => {
    const key = window.AppUtils.volumeStorageKey('user1', '99', 3, 'manga');
    expect(key).toBe('u:user1|manga:99|vol:3');
  });

  it('usa "novela" (singular) para la categoría novelas', () => {
    const key = window.AppUtils.volumeStorageKey('user1', '7', 1, 'novelas');
    expect(key).toBe('u:user1|novela:7|vol:1');
  });

  it('la clave es única por usuario', () => {
    const a = window.AppUtils.volumeStorageKey('userA', '1', 1, 'manga');
    const b = window.AppUtils.volumeStorageKey('userB', '1', 1, 'manga');
    expect(a).not.toBe(b);
  });
});

// ─── buildCatalogImageCandidates ──────────────────────────────────────────────

describe('AppUtils.buildCatalogImageCandidates', () => {
  it('devuelve un array', () => {
    const candidates = window.AppUtils.buildCatalogImageCandidates('Naruto');
    expect(Array.isArray(candidates)).toBe(true);
  });

  it('contiene rutas .jpg, .png y .webp', () => {
    const candidates = window.AppUtils.buildCatalogImageCandidates('One Piece');
    const exts = ['.jpg', '.png', '.webp'];
    exts.forEach(ext => {
      expect(candidates.some(c => c.endsWith(ext))).toBe(true);
    });
  });

  it('slug del título aparece en los candidatos', () => {
    const candidates = window.AppUtils.buildCatalogImageCandidates('Dragon Ball Z');
    expect(candidates.some(c => c.includes('dragon-ball-z'))).toBe(true);
  });

  it('no incluye cadenas vacías cuando el título y src son no vacíos', () => {
    const candidates = window.AppUtils.buildCatalogImageCandidates('Naruto', 'images/posters/naruto.jpg');
    expect(candidates.every(c => c.length > 0)).toBe(true);
  });

  it('maneja caracteres especiales y comillas tipográficas', () => {
    // No debe lanzar error con títulos como "Hunter×Hunter" o "Fullmetal Alchemist: Brotherhood"
    expect(() =>
      window.AppUtils.buildCatalogImageCandidates("Fullmetal Alchemist: Brotherhood")
    ).not.toThrow();
  });
});
