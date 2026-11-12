/**
 * tests/unit/catalogo-datos.test.js
 * Datos del catálogo que faltan o son ambiguos en AniList/MangaDex.
 *
 * Cubre:
 *  - estado: MangaDex "cancelled" → CANCELLED en los dos mappers; UNKNOWN
 *            se muestra "Sin estado" con tono neutro (no "en emisión")
 *  - año:    la query de manga pide startDate { year }; mdItemToCard copia
 *            attributes.year a startYear
 *  - temporadas: buildSeasonsFromItem no mezcla capítulos con tomos
 *  - caché MangaDex: TTL de 7 días y poda de las entradas más viejas
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/namespace.js');
  await import('../../js/core/constants.js');
  await import('../../js/core/genres.js');
  await import('../../js/core/api.js');
  await import('../../js/core/api-mangadex.js');
  await import('../../js/core/mangadex-api.js');
  await import('../../js/catalog/cards.js');
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const I = () => window.AnimeDestiny.internals;

function mdManga(attrs) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    attributes: Object.assign({ title: { en: 'Obra' }, description: {}, tags: [] }, attrs),
    relationships: []
  };
}

// ─── Estado ──────────────────────────────────────────────────────────────────

describe('estado', () => {
  it('MangaDex cancelled se mapea a CANCELLED (no UNKNOWN)', () => {
    expect(window.mdStatusToLocal('cancelled')).toBe('CANCELLED');
    expect(window.mdItemToCard(mdManga({ status: 'cancelled' })).status).toBe('CANCELLED');
  });

  it('el resto de estados de MangaDex se mantienen y lo raro cae en UNKNOWN', () => {
    expect(window.mdStatusToLocal('completed')).toBe('FINISHED');
    expect(window.mdStatusToLocal('ongoing')).toBe('RELEASING');
    expect(window.mdStatusToLocal('hiatus')).toBe('HIATUS');
    expect(window.mdStatusToLocal(null)).toBe('UNKNOWN');
    expect(window.mdStatusToLocal('otra-cosa')).toBe('UNKNOWN');
  });

  it('UNKNOWN y vacío se muestran "Sin estado" con tono neutro', () => {
    const S = I().catalogStatus;
    expect(S.translate('UNKNOWN')).toBe('Sin estado');
    expect(S.translate('')).toBe('Sin estado');
    expect(S.tone('UNKNOWN')).toBe('unknown');
    expect(S.tone('')).toBe('unknown');
  });

  it('los estados conocidos conservan su tono', () => {
    const S = I().catalogStatus;
    expect(S.tone('RELEASING')).toBe('releasing');
    expect(S.tone('FINISHED')).toBe('finished');
    expect(S.tone('CANCELLED')).toBe('cancelled');
    expect(S.tone('HIATUS')).toBe('hiatus');
    expect(S.tone('NOT_YET_RELEASED')).toBe('upcoming');
  });

  it('en emisión sin total dice "sin total" en vez de omitirlo o poner 0', () => {
    const S = I().catalogStatus;
    expect(S.info('anime', { type: 'TV', episodes: 0, status: 'RELEASING' })).toContain('sin total');
    expect(S.info('manga', { type: 'Manga', chapters: 0, volumes: 0, status: 'RELEASING' })).toContain('sin total');
    // Terminado sin dato: no se afirma nada.
    expect(S.info('anime', { type: 'TV', episodes: 0, status: 'FINISHED' })).not.toContain('sin total');
    expect(S.info('anime', { type: 'TV', episodes: 12, status: 'RELEASING' })).toContain('12');
  });
});

// ─── Año ─────────────────────────────────────────────────────────────────────

describe('año en cards', () => {
  it('la query de manga/novelas pide startDate { year }', () => {
    const parts = I().buildQueryParts({ type: 'MANGA' });
    expect(parts.fields).toContain('startDate { year }');
  });

  it('anilistItemToLocal mapea startDate.year a startYear en manga', () => {
    const item = I().anilistItemToLocal({ id: 1, title: { romaji: 'X' }, startDate: { year: 2014 }, status: 'FINISHED' }, 'manga');
    expect(item.startYear).toBe(2014);
  });

  it('mdItemToCard copia attributes.year y deja null si falta', () => {
    expect(window.mdItemToCard(mdManga({ year: 2018 })).startYear).toBe(2018);
    expect(window.mdItemToCard(mdManga({ year: null })).startYear).toBeNull();
  });

  it('sinopsis vacía: mismo texto en AniList y MangaDex', () => {
    const al = I().anilistItemToLocal({ id: 2, title: { romaji: 'Y' } }, 'manga');
    const md = window.mdItemToCard(mdManga({}));
    expect(al.synopsis).toBe(md.synopsis);
  });
});

// ─── Temporadas ──────────────────────────────────────────────────────────────

describe('buildSeasonsFromItem', () => {
  const B = (item, type) => I().buildSeasonsFromItem(item, type);
  const seq = (node) => ({ relationType: 'SEQUEL', node: Object.assign({ title: { romaji: 'S' + node.id } }, node) });

  it('sin secuelas no arma temporadas', () => {
    expect(B({ id: 1, chapters: 10, relations: { edges: [] } }, 'manga')).toEqual([]);
  });

  it('manga: si alguna entrada tiene capítulos, todas cuentan capítulos', () => {
    const s = B({
      id: 1, chapters: null, volumes: 10, title: { romaji: 'Uno' },
      relations: { edges: [seq({ id: 2, chapters: 50, volumes: 5 }), seq({ id: 3, chapters: null, volumes: 3 })] }
    }, 'manga');
    expect(s.every((x) => x.unit === 'chapters')).toBe(true);
    // La principal no informa capítulos: queda en 0 (desconocido), no 10 tomos.
    expect(s[0].count).toBe(0);
    expect(s[0].volumes).toBe(10);
    // La secuela 3 sin capítulos no entra con sus tomos disfrazados.
    expect(s.map((x) => x.id)).toEqual([1, 2]);
    expect(s[1].count).toBe(50);
    expect(s[1].episodes).toBe(0);
  });

  it('manga sin capítulos en ninguna entrada usa tomos', () => {
    const s = B({
      id: 1, volumes: 4, relations: { edges: [seq({ id: 2, volumes: 2 })] }
    }, 'manga');
    expect(s.map((x) => [x.unit, x.count])).toEqual([['volumes', 4], ['volumes', 2]]);
  });

  it('anime cuenta episodios', () => {
    const s = B({ id: 1, episodes: 12, relations: { edges: [seq({ id: 2, episodes: 24 })] } }, 'anime');
    expect(s.map((x) => [x.unit, x.episodes])).toEqual([['episodes', 12], ['episodes', 24]]);
  });
});

// ─── Caché MangaDex ──────────────────────────────────────────────────────────

describe('caché MangaDex', () => {
  const C = () => I().mdCache;

  it('guarda con fecha y devuelve el valor dentro del TTL', () => {
    C().set('md_id_v3_al_1', 'uuid-1');
    expect(JSON.parse(localStorage.getItem('md_id_v3_al_1')).v).toBe('uuid-1');
    expect(C().get('md_id_v3_al_1')).toBe('uuid-1');
  });

  it('vence a los 7 días y borra la entrada', () => {
    const viejo = Date.now() - C().TTL_MS - 1000;
    localStorage.setItem('md_alt_v1_x', JSON.stringify({ t: viejo, v: '[]' }));
    expect(C().get('md_alt_v1_x')).toBeNull();
    expect(localStorage.getItem('md_alt_v1_x')).toBeNull();
  });

  it('una entrada del formato viejo (sin fecha) se trata como vencida', () => {
    localStorage.setItem('md_id_v3_algo', 'uuid-viejo');
    expect(C().get('md_id_v3_algo')).toBeNull();
  });

  it('claves sin TTL se leen tal cual', () => {
    localStorage.setItem('md_cov_v2_es_x_v1', 'https://ejemplo/1.jpg');
    expect(C().get('md_cov_v2_es_x_v1')).toBe('https://ejemplo/1.jpg');
  });

  it('con cuota llena poda las más viejas primero y no borra todo', () => {
    const ahora = Date.now();
    for (let i = 0; i < 20; i++) {
      localStorage.setItem('md_cov_map_v2_es_' + i, JSON.stringify({ t: ahora - (20 - i) * 1000, v: '{"1":"u"}' }));
    }
    localStorage.setItem('otra_app_clave', 'no tocar');
    // Simula cuota: no entra nada nuevo mientras haya más de 18 claves.
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (localStorage.getItem(k) == null && localStorage.length > 18) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      return original.call(this, k, v);
    });

    expect(C().set('md_id_v3_al_9', 'uuid-9')).toBe(true);
    expect(C().get('md_id_v3_al_9')).toBe('uuid-9');
    // Se fueron las más viejas (índices bajos) y sobreviven las nuevas.
    expect(localStorage.getItem('md_cov_map_v2_es_0')).toBeNull();
    expect(localStorage.getItem('md_cov_map_v2_es_19')).not.toBeNull();
    expect(localStorage.getItem('otra_app_clave')).toBe('no tocar');
  });
});
