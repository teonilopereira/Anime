/**
 * tests/unit/detalle-info.test.js
 * Tests para js/detalle/info.js → window.DetalleInfo
 *
 * Cubre:
 *  - filas:     omite datos faltantes, fechas, temporada, duración, autores,
 *               títulos alternativos sin repetir y rankings de todos los tiempos
 *  - etiquetas: sin spoilers y por relevancia
 *  - html:      vacío sin datos y escapado
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/detalle/info.js');
});

const I = () => window.DetalleInfo;
const valor = (filas, label) => (filas.find((f) => f.label === label) || {}).valor;

describe('filas', () => {
  it('no pinta nada si el item no trae datos', () => {
    expect(I().filas({ titulo: 'X' }, 'anime')).toEqual([]);
    expect(I().html({ titulo: 'X' }, 'anime')).toBe('');
  });

  it('arma los datos de un anime', () => {
    const f = I().filas({
      titulo: 'Frieren', title_romaji: 'Sousou no Frieren', title_native: '葬送のフリーレン',
      title_english: 'Frieren', synonyms: ['Frieren at the Funeral', 'Sousou no Frieren'],
      format: 'TV', status: 'FINISHED', season: 'FALL', seasonYear: 2023, duration: 24,
      startDate: { year: 2023, month: 9, day: 29 }, endDate: { year: 2024, month: 3, day: 22 },
      source: 'MANGA', countryOfOrigin: 'JP', popularity: 450000, favourites: 0,
      rankings: [
        { rank: 1, type: 'RATED', allTime: true },
        { rank: 3, type: 'RATED', allTime: false },
        { rank: 120, type: 'POPULAR', allTime: true }
      ]
    }, 'anime');
    expect(valor(f, 'Formato')).toBe('Serie de TV');
    expect(valor(f, 'Otros títulos')).toBe('Sousou no Frieren · 葬送のフリーレン · Frieren at the Funeral');
    expect(valor(f, 'Emisión')).toBe('29 sep 2023 – 22 mar 2024');
    expect(valor(f, 'Temporada')).toBe('Otoño 2023');
    expect(valor(f, 'Duración')).toBe('24 min por episodio');
    expect(valor(f, 'Fuente')).toBe('Manga');
    expect(valor(f, 'Origen')).toBe('Japón');
    expect(valor(f, 'Ranking')).toBe('#1 mejor puntuado · #120 más popular');
    expect(valor(f, 'Favoritos')).toBeUndefined();
    expect(valor(f, 'Autores')).toBeUndefined();
  });

  it('película: duración total en horas', () => {
    const f = I().filas({ format: 'MOVIE', duration: 125 }, 'anime');
    expect(valor(f, 'Duración')).toBe('2 h 5 min');
  });

  it('manga en curso: publicación abierta y autores con rol', () => {
    const f = I().filas({
      titulo: 'One Piece', status: 'RELEASING', type: 'Manga', startYear: 1997,
      countryOfOrigin: 'ja',
      staff: [
        { role: 'Story & Art', name: 'Eiichiro Oda' },
        { role: 'Translator (English)', name: 'Alguien' }
      ]
    }, 'manga');
    expect(valor(f, 'Formato')).toBe('Manga');
    expect(valor(f, 'Publicación')).toBe('1997 – actualidad');
    expect(valor(f, 'Origen')).toBe('Japón');
    expect(valor(f, 'Autores')).toBe('Eiichiro Oda (Historia y arte)');
  });
});

describe('etiquetas', () => {
  it('descarta spoilers y ordena por relevancia', () => {
    const t = I().etiquetas({
      tags: [
        { name: 'Magia', rank: 80 },
        { name: 'Muerte del protagonista', rank: 99, isMediaSpoiler: true },
        { name: 'Elfos', rank: 95 }
      ]
    });
    expect(t.map((x) => x.name)).toEqual(['Elfos', 'Magia']);
  });
});

describe('html', () => {
  it('escapa los valores', () => {
    const out = I().html({ format: 'TV', tags: [{ name: '<b>x</b>', rank: 50 }] }, 'anime');
    expect(out).toContain('INFORMACIÓN');
    expect(out).toContain('ETIQUETAS');
    expect(out).not.toContain('<b>x</b>');
  });
});
