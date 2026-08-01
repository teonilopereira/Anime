/**
 * tests/unit/cards.test.js
 * Tests para js/catalog/cards.js
 *
 * Cubre los helpers puros de construcción de tarjetas del catálogo:
 *  - getApiPoster:          selección de la mejor imagen disponible
 *  - getApiCatalogInfo:     línea informativa según categoría
 *  - getApiGenresList:      lista de géneros deduplicada
 *  - translateCatalogStatus: traducción de estados de AniList/MangaDex
 *  - captionFromInfo:       caption sin repetir el estado
 *  - describirErrorDeApi:   mensajes de error amigables
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/utils.js');   // normalizeText global (usado por normalizeCatalogGenre)
  await import('../../js/catalog/cards.js');
});

// ─── getApiPoster ─────────────────────────────────────────────────────────────

describe('getApiPoster', () => {
  it('prefiere webp large sobre el resto', () => {
    const item = { images: {
      webp: { large_image_url: 'w-large', image_url: 'w-small' },
      jpg: { large_image_url: 'j-large' }
    } };
    expect(window.getApiPoster(item)).toBe('w-large');
  });

  it('cae en jpg cuando no hay webp', () => {
    expect(window.getApiPoster({ images: { jpg: { image_url: 'j-small' } } })).toBe('j-small');
  });

  it('devuelve cadena vacía sin imágenes', () => {
    expect(window.getApiPoster({})).toBe('');
    expect(window.getApiPoster(null)).toBe('');
  });
});

// ─── getApiCatalogInfo ────────────────────────────────────────────────────────

describe('getApiCatalogInfo', () => {
  it('anime: combina tipo, episodios y estado', () => {
    const info = window.getApiCatalogInfo('anime', { type: 'TV', episodes: 12, status: 'FINISHED' });
    expect(info).toBe('TV / 12 eps / FINISHED');
  });

  it('anime sin datos usa etiqueta por defecto', () => {
    expect(window.getApiCatalogInfo('anime', {})).toBe('Anime');
  });

  it('novelas: etiqueta "Novela ligera" para light novel', () => {
    const info = window.getApiCatalogInfo('novelas', { type: 'Light Novel', volumes: 8 });
    expect(info).toContain('Novela ligera');
    expect(info).toContain('8 vol.');
  });

  it('manga: usa capítulos cuando no hay volúmenes', () => {
    expect(window.getApiCatalogInfo('manga', { type: 'Manga', chapters: 100 }))
      .toContain('100 cap.');
  });
});

// ─── getApiGenresList ─────────────────────────────────────────────────────────

describe('getApiGenresList', () => {
  it('combina genres y themes y agrega el type', () => {
    const list = window.getApiGenresList({
      genres: ['Acción'], themes: [{ name: 'Escolar' }], type: 'TV'
    });
    expect(list).toContain('Acción');
    expect(list).toContain('Escolar');
    expect(list).toContain('TV');
  });

  it('deduplica por forma normalizada', () => {
    const list = window.getApiGenresList({ genres: ['Acción', 'ACCIÓN', 'accion'] });
    expect(list.length).toBe(1);
  });

  it('devuelve [] sin datos', () => {
    expect(window.getApiGenresList({})).toEqual([]);
  });
});

// ─── translateCatalogStatus ───────────────────────────────────────────────────

describe('translateCatalogStatus', () => {
  it('traduce estados conocidos (case-insensitive)', () => {
    expect(window.translateCatalogStatus('RELEASING')).toBe('En emisión');
    expect(window.translateCatalogStatus('finished')).toBe('Finalizado');
    expect(window.translateCatalogStatus('HIATUS')).toBe('En pausa');
  });

  it('devuelve el original si no está mapeado', () => {
    expect(window.translateCatalogStatus('DESCONOCIDO')).toBe('DESCONOCIDO');
  });

  it('maneja valores vacíos', () => {
    expect(window.translateCatalogStatus(null)).toBe('');
  });
});

// ─── captionFromInfo ──────────────────────────────────────────────────────────

describe('captionFromInfo', () => {
  it('quita el estado del caption para no repetirlo', () => {
    // info trae "TV / 12 eps / FINISHED"; el estado FINISHED ya se muestra aparte
    const caption = window.captionFromInfo('TV / 12 eps / FINISHED', 'FINISHED');
    expect(caption).toBe('TV · 12 eps');
  });

  it('devuelve cadena vacía si no hay info', () => {
    expect(window.captionFromInfo('', 'FINISHED')).toBe('');
  });
});

// ─── describirErrorDeApi ──────────────────────────────────────────────────────

describe('describirErrorDeApi', () => {
  it('detecta rate limit (429)', () => {
    const r = window.describirErrorDeApi(new Error('HTTP 429'));
    expect(r.kicker).toBe('Demasiadas peticiones');
  });

  it('detecta timeout', () => {
    const r = window.describirErrorDeApi(new Error('Timeout tras 12s'));
    expect(r.kicker).toBe('La API tardó demasiado');
  });

  it('mensaje genérico por defecto', () => {
    const r = window.describirErrorDeApi(new Error('algo raro'));
    expect(r.kicker).toBe('API no disponible');
    expect(typeof r.detalle).toBe('string');
  });
});
