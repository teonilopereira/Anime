/**
 * tests/unit/import-mal.test.js
 * Tests para js/pages/import-mal.js → window.MalImport
 *
 * Cubre las funciones puras del importador de listas de MyAnimeList:
 *  - parseMalXml:            parseo del XML (anime por episodios, manga por
 *                            volúmenes y/o capítulos), descartando entradas
 *                            sin ID y XML inválido.
 *  - shouldMarkViewed:       solo "Completed" se marca como visto.
 *  - malStatusToWatchStatus: mapeo de my_status → estado de seguimiento.
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/pages/import-mal.js');
});

const M = () => window.MalImport;

function xml(inner) {
  return '<?xml version="1.0" encoding="UTF-8"?><myanimelist>' + inner + '</myanimelist>';
}

describe('parseMalXml', () => {
  it('parsea entradas de anime con episodios vistos', () => {
    const doc = xml(
      '<anime>' +
        '<series_animedb_id>1535</series_animedb_id>' +
        '<series_title>Death Note</series_title>' +
        '<my_watched_episodes>37</my_watched_episodes>' +
        '<my_episodes>37</my_episodes>' +
        '<my_status>Completed</my_status>' +
      '</anime>'
    );
    const { anime, manga } = M().parseMalXml(doc);
    expect(manga).toEqual([]);
    expect(anime).toHaveLength(1);
    expect(anime[0]).toMatchObject({
      malId: 1535,
      title: 'Death Note',
      status: 'Completed',
      watchedEp: 37,
      totalEp: 37
    });
  });

  it('parsea manga leído por volúmenes y por capítulos', () => {
    const doc = xml(
      '<manga>' +
        '<series_mangadb_id>13</series_mangadb_id>' +
        '<series_title>One Piece</series_title>' +
        '<my_read_chapters>1050</my_read_chapters>' +
        '<my_read_volumes>0</my_read_volumes>' +
        '<my_status>Reading</my_status>' +
      '</manga>' +
      '<manga>' +
        '<series_mangadb_id>21</series_mangadb_id>' +
        '<series_title>Death Note</series_title>' +
        '<my_read_chapters>108</my_read_chapters>' +
        '<my_read_volumes>12</my_read_volumes>' +
        '<my_status>Completed</my_status>' +
      '</manga>'
    );
    const { manga } = M().parseMalXml(doc);
    expect(manga).toHaveLength(2);
    // Manga solo por capítulos: readVol queda en 0, readCh conservado.
    expect(manga[0]).toMatchObject({ malId: 13, readCh: 1050, readVol: 0 });
    // Manga con ambos: se conservan los dos valores.
    expect(manga[1]).toMatchObject({ malId: 21, readCh: 108, readVol: 12 });
  });

  it('descarta entradas sin ID de serie', () => {
    const doc = xml(
      '<anime><series_title>Sin ID</series_title></anime>' +
      '<manga><series_title>Sin ID</series_title></manga>'
    );
    const { anime, manga } = M().parseMalXml(doc);
    expect(anime).toEqual([]);
    expect(manga).toEqual([]);
  });

  it('lanza un error con XML inválido', () => {
    expect(() => M().parseMalXml('<<< no es xml >>>')).toThrow(/XML inválido/);
  });
});

describe('shouldMarkViewed', () => {
  it('marca como visto solo el estado Completed', () => {
    expect(M().shouldMarkViewed('Completed')).toBe(true);
    ['Watching', 'Reading', 'Plan to Watch', 'On-Hold', 'Dropped', ''].forEach((s) => {
      expect(M().shouldMarkViewed(s)).toBe(false);
    });
  });
});

describe('malStatusToWatchStatus', () => {
  it('mapea los estados de MAL al seguimiento de la app', () => {
    expect(M().malStatusToWatchStatus('Watching')).toBe('viendo');
    expect(M().malStatusToWatchStatus('Reading')).toBe('viendo');
    expect(M().malStatusToWatchStatus('Plan to Watch')).toBe('pendiente');
    expect(M().malStatusToWatchStatus('Plan to Read')).toBe('pendiente');
    expect(M().malStatusToWatchStatus('On-Hold')).toBe('pausado');
    expect(M().malStatusToWatchStatus('Dropped')).toBe('abandonado');
    // Completed y desconocidos no fijan estado de seguimiento.
    expect(M().malStatusToWatchStatus('Completed')).toBe('');
    expect(M().malStatusToWatchStatus('???')).toBe('');
  });
});
