/**
 * tests/unit/recommend-core.test.js
 * js/core/recommend.js (window.AppRecommend): perfil, motivo y exclusión.
 */
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

let R;
beforeAll(async () => {
  await import('../../js/core/recommend.js');
  R = window.AppRecommend;
});
beforeEach(() => { localStorage.clear(); });

// Entrada con la forma de mis-listas
function entry(id, titulo, info, flags, extra) {
  return Object.assign({ item: Object.assign({ id: String(id), __category: 'anime', titulo, info }, extra || {}) }, flags);
}
// Candidato con la forma del catálogo (anilistItemToLocal)
function cand(id, genres, extra) {
  return Object.assign({ id, title: 'Cand ' + id, genres: genres.map((g) => ({ name: g })) }, extra || {});
}

describe('buildProfile', () => {
  it('pondera géneros por señal y toma de ejemplo la obra de más peso', () => {
    const p = R.buildProfile([
      entry(1, 'Frieren', 'Adventure|Fantasy', { fav: true }),
      entry(2, 'Otra', 'Fantasy', { wstatus: 'pendiente' }),
      entry(3, 'Dejada', 'Horror', { wstatus: 'abandonado' })
    ]);
    expect(p.genres[0]).toMatchObject({ name: 'Fantasy', weight: 4, sample: 'Frieren' });
    expect(p.genres.find((g) => g.name === 'Horror')).toBeUndefined();
    expect(p.markedIds.has('3')).toBe(true); // abandonado no suma gusto pero se excluye
    expect(p.signalCount).toBe(2);
    expect(p.topCategory).toBe('anime');
  });

  it('acepta filas de Supabase (item_id + meta)', () => {
    const p = R.buildProfile([{ item_id: 9, category: 'manga', viewed: true, meta: { titulo: 'Berserk', info: 'Action' } }]);
    expect(p.markedIds.has('9')).toBe(true);
    expect(p.markedIds.has('manga:9')).toBe(true);
    expect(p.genres[0]).toMatchObject({ name: 'Action', sample: 'Berserk' });
  });

  it('sin historial queda vacío', () => {
    const p = R.buildProfile([]);
    expect(p.signalCount).toBe(0);
    expect(R.scoreCandidates([cand(1, ['Action'])], p)).toEqual([]);
  });
});

describe('scoreCandidates', () => {
  const profile = () => R.buildProfile([
    entry(1, 'Frieren', 'Adventure|Fantasy', { viewed: true }, { studios: ['Madhouse'] }),
    entry(2, 'Mushoku', 'Fantasy|Drama', { fav: true }),
    entry(5, 'Viendo', 'Action', { wstatus: 'viendo' })
  ]);

  it('excluye lo marcado, el +18 y lo que no tiene relación con el perfil', () => {
    const out = R.scoreCandidates([
      cand(1, ['Fantasy']),                       // visto
      cand(5, ['Action']),                        // en curso
      cand(10, ['Fantasy'], { isAdult: true }),   // +18
      cand(11, ['Hentai']),                       // +18 por género
      cand(12, ['Sports']),                       // sin relación: no se disfraza
      cand(13, ['Fantasy', 'Adventure'])
    ], profile());
    expect(out.map((r) => r.item.id)).toEqual([13]);
  });

  it('con prefNsfw deja pasar el +18', () => {
    const out = R.scoreCandidates([cand(10, ['Fantasy'], { isAdult: true })], profile(), { allowNsfw: true });
    expect(out.map((r) => r.item.id)).toEqual([10]);
  });

  it('allowNsfw lee pref:nsfw', () => {
    expect(R.allowNsfw()).toBe(false);
    localStorage.setItem('pref:nsfw', 'true');
    expect(R.allowNsfw()).toBe(true);
  });

  it('motivo: obra origen > estudio > género con obra de ejemplo', () => {
    const p = profile();
    const [origen] = R.scoreCandidates([cand(20, ['Sports'], { __from: 'Haikyuu' })], p);
    expect(origen.reason).toBe('Porque te gustó Haikyuu');
    const [estudio] = R.scoreCandidates([cand(21, ['Sports'], { studios: ['Madhouse'] })], p);
    expect(estudio.reason).toBe('Del estudio de Frieren');
    const [genero] = R.scoreCandidates([cand(22, ['Fantasy'])], p);
    expect(genero.reason).toBe('Fantasy, como Mushoku'); // el favorito pesa más que el visto
  });

  it('un género amplio solo explica si no hay otro', () => {
    const [r] = R.scoreCandidates([cand(30, ['Drama', 'Fantasy'])], profile());
    expect(r.reason).toContain('Fantasy');
    const [solo] = R.scoreCandidates([cand(31, ['Drama'])], profile());
    expect(solo.reason).toBe('Drama, como Mushoku');
  });

  it('ordena por afinidad, desempata por el orden original, deduplica y corta en max', () => {
    const out = R.scoreCandidates([
      cand(40, ['Action']),
      cand(41, ['Fantasy', 'Adventure']),
      cand(41, ['Fantasy']),
      cand(42, ['Action'])
    ], profile(), { max: 2 });
    expect(out.map((r) => r.item.id)).toEqual([41, 40]);
  });

  it('opts.originTitle sirve sin perfil (ficha)', () => {
    const out = R.scoreCandidates([cand(50, [])], null, { originTitle: 'Base' });
    expect(out[0].reason).toBe('Porque te gustó Base');
  });
});
