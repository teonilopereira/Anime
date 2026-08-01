/**
 * tests/unit/mangadex-api.test.js
 * Tests para los helpers puros de js/core/mangadex-api.js
 * (expuestos en AnimeDestiny.internals.mangadex para poder testearlos sin red).
 *
 * Cubre:
 *  - getMangaDexTitle / getMangaDexDescription: selección por idioma con fallback
 *  - getMangaDexCoverUrl:  URL de portada o placeholder
 *  - chapterCount / volumeCount: conteo desde lastChapter/lastVolume
 *  - tagsToGenres:         filtra tags de tipo genre/theme
 *  - isMangaDexUuid / normalizeVolKey: validación y normalización
 *  - mdItemToLocal:        mapeo completo al formato local
 */

import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

let MD;

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/core/mangadex-api.js');
  MD = window.AnimeDestiny.internals.mangadex;
});

beforeEach(() => {
  localStorage.clear();
});

// ─── títulos / descripciones ──────────────────────────────────────────────────

describe('getMangaDexTitle', () => {
  it('prefiere el idioma del usuario', () => {
    localStorage.setItem('pref:lang', 'es');
    expect(MD.getMangaDexTitle({ title: { es: 'Naruto ES', en: 'Naruto EN' } })).toBe('Naruto ES');
  });

  it('cae en inglés cuando no hay traducción al idioma del usuario', () => {
    localStorage.setItem('pref:lang', 'es');
    expect(MD.getMangaDexTitle({ title: { en: 'Bleach', ja: 'ブリーチ' } })).toBe('Bleach');
  });

  it('devuelve cadena vacía sin título', () => {
    expect(MD.getMangaDexTitle({})).toBe('');
    expect(MD.getMangaDexTitle(null)).toBe('');
  });
});

describe('getMangaDexDescription', () => {
  it('usa el idioma preferido y si no, inglés', () => {
    localStorage.setItem('pref:lang', 'es');
    expect(MD.getMangaDexDescription({ description: { en: 'A story' } })).toBe('A story');
  });

  it('vacío sin descripción', () => {
    expect(MD.getMangaDexDescription({})).toBe('');
  });
});

// ─── portada ──────────────────────────────────────────────────────────────────

describe('getMangaDexCoverUrl', () => {
  it('construye la URL desde el cover_art', () => {
    const data = { relationships: [
      { type: 'cover_art', attributes: { fileName: 'cover.jpg' } }
    ] };
    expect(MD.getMangaDexCoverUrl(data, 'MID'))
      .toBe('https://uploads.mangadex.org/covers/MID/cover.jpg');
  });

  it('devuelve un placeholder cuando no hay portada', () => {
    const url = MD.getMangaDexCoverUrl({ relationships: [] }, 'MID');
    expect(url).toContain('data:image/svg+xml');
  });
});

// ─── conteos ──────────────────────────────────────────────────────────────────

describe('chapterCount / volumeCount', () => {
  it('redondea hacia arriba el último capítulo', () => {
    expect(MD.chapterCount({ lastChapter: '10.5' })).toBe(11);
  });

  it('0 cuando no hay dato o no es positivo', () => {
    expect(MD.chapterCount({})).toBe(0);
    expect(MD.volumeCount({ lastVolume: '0' })).toBe(0);
  });

  it('cuenta volúmenes válidos', () => {
    expect(MD.volumeCount({ lastVolume: '12' })).toBe(12);
  });
});

// ─── tagsToGenres ─────────────────────────────────────────────────────────────

describe('tagsToGenres', () => {
  it('filtra solo tags de grupo genre/theme y extrae el nombre en inglés', () => {
    const tags = [
      { attributes: { group: 'genre', name: { en: 'Action' } } },
      { attributes: { group: 'theme', name: { en: 'School' } } },
      { attributes: { group: 'format', name: { en: 'Long Strip' } } }
    ];
    expect(MD.tagsToGenres(tags)).toEqual([{ name: 'Action' }, { name: 'School' }]);
  });

  it('maneja lista vacía o indefinida', () => {
    expect(MD.tagsToGenres()).toEqual([]);
    expect(MD.tagsToGenres([])).toEqual([]);
  });
});

// ─── isMangaDexUuid / normalizeVolKey ─────────────────────────────────────────

describe('isMangaDexUuid', () => {
  it('acepta un UUID válido', () => {
    expect(MD.isMangaDexUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('rechaza no-UUIDs', () => {
    expect(MD.isMangaDexUuid('12345')).toBe(false);
    expect(MD.isMangaDexUuid(null)).toBe(false);
  });
});

describe('normalizeVolKey', () => {
  it('normaliza números a su forma canónica', () => {
    expect(MD.normalizeVolKey('01')).toBe('1');
    expect(MD.normalizeVolKey(3)).toBe('3');
  });

  it('null/undefined → cadena vacía', () => {
    expect(MD.normalizeVolKey(null)).toBe('');
    expect(MD.normalizeVolKey(undefined)).toBe('');
  });

  it('valores no numéricos se pasan a minúscula y sin espacios', () => {
    expect(MD.normalizeVolKey('  Extra ')).toBe('extra');
  });
});

// ─── mdItemToLocal ────────────────────────────────────────────────────────────

describe('mdItemToLocal', () => {
  const build = () => ({
    data: {
      type: 'manga',
      id: 'MID',
      attributes: {
        title: { en: 'Test Manga' },
        description: { en: 'Desc' },
        status: 'completed',
        lastChapter: '50',
        lastVolume: '5',
        originalLanguage: 'ja',
        year: 2010,
        tags: [{ attributes: { group: 'genre', name: { en: 'Action' } } }]
      },
      relationships: [
        { type: 'cover_art', attributes: { fileName: 'c.jpg' } },
        { type: 'author', attributes: { name: 'Autor X' } }
      ]
    }
  });

  it('devuelve null para datos no-manga o vacíos', () => {
    expect(MD.mdItemToLocal(null)).toBeNull();
    expect(MD.mdItemToLocal({ data: { type: 'cover_art' } })).toBeNull();
  });

  it('mapea los campos principales al formato local', () => {
    const local = MD.mdItemToLocal(build());
    expect(local.id).toBe('MID');
    expect(local.title).toBe('Test Manga');
    expect(local.status).toBe('FINISHED');      // completed → FINISHED
    expect(local.chapters).toBe(50);
    expect(local.volumes).toBe(5);
    expect(local.startYear).toBe(2010);
    expect(local.genres).toEqual([{ name: 'Action' }]);
    expect(local.images.webp.large_image_url)
      .toBe('https://uploads.mangadex.org/covers/MID/c.jpg');
    expect(local.staff).toEqual([{ role: 'Story', name: 'Autor X' }]);
  });

  it('mapea el idioma coreano al tipo Manhwa', () => {
    const json = build();
    json.data.attributes.originalLanguage = 'ko';
    expect(MD.mdItemToLocal(json).type).toBe('Manhwa');
  });
});
