/**
 * tests/unit/utils.test.js
 * Tests para js/utils.js → window.AppUtils
 *
 * Cubre:
 *  - normalizeText:           normalización de texto (lowercase + sin tildes)
 *  - episodeStorageKey:       formato de clave de localStorage para episodios
 *  - volumeStorageKey:        formato de clave de localStorage para volúmenes
 *  - createFallbackPosterDataUrl: póster generado en proporción 2:3
 *  - fallbackCatalogImage:   respaldo de portadas rotas (srcset → src → póster)
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

// ─── createFallbackPosterDataUrl ──────────────────────────────────────────────

describe('AppUtils.createFallbackPosterDataUrl', () => {
  it('genera un SVG 2:3, la misma proporción que las portadas', () => {
    const url = window.AppUtils.createFallbackPosterDataUrl('Naruto');
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('viewBox="0 0 600 900"');
  });

  it('escapa el título', () => {
    const svg = decodeURIComponent(window.AppUtils.createFallbackPosterDataUrl('<b>&'));
    expect(svg).toContain('&lt;b&gt;&amp;');
  });
});

// ─── fallbackCatalogImage ─────────────────────────────────────────────────────

describe('AppUtils.fallbackCatalogImage', () => {
  const COVER = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.png';

  function makeImg(attrs) {
    const img = document.createElement('img');
    Object.entries(attrs).forEach(([k, v]) => img.setAttribute(k, v));
    return img;
  }

  it('con srcset, primero lo saca y deja que el navegador reintente el src', () => {
    const img = makeImg({ src: COVER, srcset: COVER + ' 460w', sizes: '300px', alt: 'Naruto' });
    window.AppUtils.fallbackCatalogImage(img);
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
    expect(img.getAttribute('src')).toBe(COVER);
    expect(img.dataset.fallbackReady).toBeUndefined();
  });

  it('si el src también falla, pone el póster generado una sola vez', () => {
    const img = makeImg({ src: COVER, srcset: COVER + ' 460w', alt: 'Naruto' });
    window.AppUtils.fallbackCatalogImage(img);
    window.AppUtils.fallbackCatalogImage(img);
    expect(img.getAttribute('src').startsWith('data:image/svg+xml')).toBe(true);
    const placeholder = img.getAttribute('src');
    window.AppUtils.fallbackCatalogImage(img);
    expect(img.getAttribute('src')).toBe(placeholder);
  });

  it('sin src va directo al póster con el título de data-title', () => {
    const img = makeImg({ src: '', 'data-title': 'One Piece' });
    window.AppUtils.fallbackCatalogImage(img);
    expect(decodeURIComponent(img.getAttribute('src'))).toContain('One Piece');
  });

  it('no hace pedidos a rutas locales de pósters', () => {
    const img = makeImg({ src: COVER, alt: 'Naruto' });
    window.AppUtils.fallbackCatalogImage(img);
    expect(img.getAttribute('src')).not.toContain('images/posters');
    expect(window.AppUtils.buildCatalogImageCandidates).toBeUndefined();
  });
});
