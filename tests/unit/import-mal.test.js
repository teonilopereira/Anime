/**
 * tests/unit/import-mal.test.js
 * Tests para los helpers puros de js/pages/import-mal.js
 * (expuestos en AnimeDestiny.internals.malImport).
 *
 * Cubre:
 *  - parseMalXml:            parseo del export XML de MyAnimeList
 *  - shouldMarkViewed:       qué estados cuentan como "visto"
 *  - malStatusToWatchStatus: mapeo de estados MAL → estados de la app
 */

import { beforeAll, describe, it, expect } from 'vitest';

let MAL;

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/pages/import-mal.js');
  MAL = window.AnimeDestiny.internals.malImport;
});

// ─── parseMalXml ──────────────────────────────────────────────────────────────

describe('parseMalXml', () => {
  it('parsea entradas de anime y manga', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <myanimelist>
        <anime>
          <series_animedb_id>20</series_animedb_id>
          <series_title>Naruto</series_title>
          <my_status>Completed</my_status>
          <my_watched_episodes>220</my_watched_episodes>
          <my_episodes>220</my_episodes>
        </anime>
        <manga>
          <series_mangadb_id>11</series_mangadb_id>
          <series_title>Berserk</series_title>
          <my_status>Reading</my_status>
          <my_read_chapters>370</my_read_chapters>
          <my_read_volumes>40</my_read_volumes>
          <my_volumes>41</my_volumes>
        </manga>
      </myanimelist>`;
    const result = MAL.parseMalXml(xml);
    expect(result.anime).toHaveLength(1);
    expect(result.anime[0]).toMatchObject({
      malId: 20, title: 'Naruto', status: 'Completed', watchedEp: 220, totalEp: 220
    });
    expect(result.manga).toHaveLength(1);
    expect(result.manga[0]).toMatchObject({
      malId: 11, title: 'Berserk', status: 'Reading', readCh: 370, readVol: 40, totalVol: 41
    });
  });

  it('ignora entradas sin id de base de datos', () => {
    const xml = `<myanimelist><anime><series_title>Sin id</series_title></anime></myanimelist>`;
    const result = MAL.parseMalXml(xml);
    expect(result.anime).toHaveLength(0);
  });

  it('lanza error ante XML inválido', () => {
    expect(() => MAL.parseMalXml('<myanimelist><anime></broken>')).toThrow(/XML inválido/);
  });

  it('numéricos ausentes caen a 0', () => {
    const xml = `<myanimelist><anime>
      <series_animedb_id>5</series_animedb_id>
      <series_title>X</series_title>
    </anime></myanimelist>`;
    const a = MAL.parseMalXml(xml).anime[0];
    expect(a.watchedEp).toBe(0);
    expect(a.totalEp).toBe(0);
  });
});

// ─── shouldMarkViewed ─────────────────────────────────────────────────────────

describe('shouldMarkViewed', () => {
  it('solo "Completed" marca como visto', () => {
    expect(MAL.shouldMarkViewed('Completed')).toBe(true);
    expect(MAL.shouldMarkViewed('Watching')).toBe(false);
    expect(MAL.shouldMarkViewed('')).toBe(false);
  });
});

// ─── malStatusToWatchStatus ───────────────────────────────────────────────────

describe('malStatusToWatchStatus', () => {
  it('mapea estados de anime y manga a los de la app', () => {
    expect(MAL.malStatusToWatchStatus('Watching')).toBe('viendo');
    expect(MAL.malStatusToWatchStatus('Reading')).toBe('viendo');
    expect(MAL.malStatusToWatchStatus('Plan to Watch')).toBe('pendiente');
    expect(MAL.malStatusToWatchStatus('Plan to Read')).toBe('pendiente');
    expect(MAL.malStatusToWatchStatus('On-Hold')).toBe('pausado');
    expect(MAL.malStatusToWatchStatus('Dropped')).toBe('abandonado');
  });

  it('estados desconocidos → cadena vacía', () => {
    expect(MAL.malStatusToWatchStatus('Completed')).toBe('');
    expect(MAL.malStatusToWatchStatus('cualquiera')).toBe('');
  });
});
