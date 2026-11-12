/**
 * tests/unit/inicio-next-step.test.js
 * Tests para js/pages/inicio.js → window.AppInicio.nextStep / buildContinueWatching
 *
 * Cubre: anime con total, anime sin total, temporadas, manga por capítulos y
 * por volúmenes, sin progreso ("Empezar"), "Al día" y orden por último progreso.
 */
import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/pages/inicio.js');
});

const next = (...a) => window.AppInicio.nextStep(...a);

describe('nextStep — anime', () => {
  it('con total: siguiente episodio "Ep. N de M"', () => {
    const s = next('anime', ['s:0|ep:1', 's:0|ep:2', 's:0|ep:3'], 12);
    expect(s).toMatchObject({ kind: 'next', unit: 'ep', number: 4, total: 12, pkey: 's:0|ep:4', label: 'Ep. 4 de 12' });
  });

  it('sin total: "Ep. N" sin inventar el total', () => {
    const s = next('anime', ['s:0|ep:7'], 0);
    expect(s).toMatchObject({ kind: 'next', number: 8, total: 0, label: 'Ep. 8' });
  });

  it('usa el episodio más alto aunque haya huecos', () => {
    expect(next('anime', ['s:0|ep:5', 's:0|ep:1'], 24).number).toBe(6);
  });

  it('en una temporada posterior sigue en esa temporada y no usa el total de la serie', () => {
    const s = next('anime', ['s:0|ep:12', 's:1|ep:2'], 12);
    expect(s).toMatchObject({ season: 1, number: 3, pkey: 's:1|ep:3', label: 'T2 · Ep. 3', total: 0 });
  });

  it('al llegar al total queda "Al día" sin pkey', () => {
    const s = next('anime', ['s:0|ep:12'], 12);
    expect(s).toMatchObject({ kind: 'done', label: 'Al día', pkey: '' });
  });

  it('sin progreso: "Empezar" con el episodio 1', () => {
    expect(next('anime', [], 12)).toMatchObject({ kind: 'start', label: 'Empezar', pkey: 's:0|ep:1' });
    expect(next('anime', undefined, 0)).toMatchObject({ kind: 'start' });
  });

  it('ignora claves que no son de episodio', () => {
    expect(next('anime', ['vol:3', 'basura'], 0).kind).toBe('start');
  });
});

describe('nextStep — manga y novelas', () => {
  it('manga con capítulos: "Cap. N"', () => {
    const s = next('manga', ['ch:10', 'ch:11', 'vol:1'], 20);
    expect(s).toMatchObject({ kind: 'next', unit: 'cap', number: 12, pkey: 'ch:12', label: 'Cap. 12' });
  });

  it('manga por volúmenes con total: "Vol. N de M"', () => {
    const s = next('manga', ['vol:1', 'vol:2'], 10);
    expect(s).toMatchObject({ unit: 'vol', number: 3, pkey: 'vol:3', label: 'Vol. 3 de 10' });
  });

  it('novela al día', () => {
    expect(next('novelas', ['vol:5'], 5).kind).toBe('done');
  });

  it('manga sin progreso: "Empezar" con el volumen 1', () => {
    expect(next('manga', [], 0)).toMatchObject({ kind: 'start', unit: 'vol', pkey: 'vol:1', label: 'Empezar' });
  });
});

describe('buildContinueWatching', () => {
  it('ordena por último progreso y calcula el paso de cada uno', () => {
    const states = [
      { item_id: 1, category: 'anime', watch_status: 'viendo', meta: { titulo: 'A' }, updated_at: '2026-01-05T00:00:00Z' },
      { item_id: 2, category: 'manga', watch_status: 'viendo', meta: { titulo: 'B' }, updated_at: '2026-01-01T00:00:00Z' },
      { item_id: 3, category: 'anime', watch_status: 'visto', viewed: 1, meta: { titulo: 'C' } }
    ];
    const prog = {
      'manga|2': { keys: ['vol:1'], ts: new Date('2026-01-10T00:00:00Z').getTime() }
    };
    const out = window.AppInicio.buildContinueWatching(states, prog, 'Invitado');
    expect(out.map((i) => i.titulo)).toEqual(['B', 'A']);
    expect(out[0].step.label).toBe('Vol. 2');
    expect(out[1].step.kind).toBe('start');
  });
});
