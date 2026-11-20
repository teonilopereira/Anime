/**
 * tests/unit/volumenes.test.js
 * Coherencia de datos de la página de volúmenes (js/pages/volumenes.js), del
 * modal de capítulos (js/catalog/chapters-modal.js) y del detalle por tomo de
 * MangaDex (resolveMangaDexVolumeDetails en js/core/mangadex-api.js).
 *
 * Cubre:
 *  - watchedSet: solo claves del usuario actual y de la unidad mostrada
 *    (vol: en volúmenes, ch: en capítulos); ids con caracteres de regex
 *  - countInRange / hero: los leídos fuera de 1..total no inflan el conteo
 *    ni el % (hero y lista dicen lo mismo, nunca > 100%)
 *  - parseTotal: total de la URL decimal / inválido / negativo
 *  - sin id → sección "No encontrado"
 *  - aggregate: claves de volumen duplicadas ("1" y "01") se combinan
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

const BODY = `
  <a id="volsBack" href="manga.html"></a>
  <section data-vols-notfound hidden><a data-vols-notfound-back href="manga.html"></a></section>
  <section class="vols-hero">
    <div data-hero-bg></div><img data-hero-cover>
    <span data-hero-tipo></span><h1 data-hero-title></h1><span data-hero-estado></span>
    <span data-dl1></span><span data-dv1></span><span data-dl2></span><span data-dv2></span><span data-dv3></span>
    <a data-detail-link href="#"></a>
  </section>
  <section class="vols-list-wrap">
    <h2 data-caps-title></h2><span data-caps-count></span>
    <div data-caps-list></div><p data-caps-empty hidden></p>
  </section>`;

function goto(qs) {
  window.history.replaceState(null, '', '/volumenes.html' + qs);
  document.body.innerHTML = BODY;
  window.VolumenesPage.render();
}

const $ = (sel) => document.querySelector(sel);

beforeAll(async () => {
  await import('../../js/core/user-store.js');
  window.getCurrentUserId = () => 'u1';
  // Sin MangaDex en estos tests: las filas quedan con la info genérica.
  document.body.innerHTML = BODY;
  window.history.replaceState(null, '', '/volumenes.html?id=1&total=1');
  await import('../../js/pages/volumenes.js');
  await import('../../js/catalog/chapters-modal.js');
});

beforeEach(() => {
  window.UserStore.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('volumenes.js → watchedSet', () => {
  it('en volúmenes cuenta solo vol: (no ch:) y solo del usuario actual', () => {
    const S = window.UserStore;
    S.setItem('u:u1|manga:42|vol:1', '1');
    S.setItem('u:u1|manga:42|vol:3', '1');
    S.setItem('u:u1|manga:42|ch:2', '1');      // capítulo importado de MAL
    S.setItem('u:otro|manga:42|vol:4', '1');   // otro usuario en el mismo navegador
    S.setItem('u:u1|manga:421|vol:5', '1');    // otro id que empieza igual
    const set = window.VolumenesPage.watchedSet('u1', '42', 'manga', 'VOL');
    expect([...set].sort()).toEqual([1, 3]);
  });

  it('en capítulos cuenta solo ch:', () => {
    const S = window.UserStore;
    S.setItem('u:u1|manga:42|vol:1', '1');
    S.setItem('u:u1|manga:42|ch:7', '1');
    expect([...window.VolumenesPage.watchedSet('u1', '42', 'manga', 'CH')]).toEqual([7]);
  });

  it('novelas usan el prefijo novela: y anime ep de cualquier temporada', () => {
    const S = window.UserStore;
    S.setItem('u:u1|novela:9|vol:2', '1');
    S.setItem('u:u1|anime:9|s:0|ep:4', '1');
    expect([...window.VolumenesPage.watchedSet('u1', '9', 'novelas', 'VOL')]).toEqual([2]);
    expect([...window.VolumenesPage.watchedSet('u1', '9', 'anime', 'EP')]).toEqual([4]);
  });

  it('un id con caracteres de regex no rompe ni matchea otras obras', () => {
    const S = window.UserStore;
    S.setItem('u:u1|manga:a.b|vol:1', '1');
    S.setItem('u:u1|manga:axb|vol:2', '1');
    expect([...window.VolumenesPage.watchedSet('u1', 'a.b', 'manga', 'VOL')]).toEqual([1]);
    expect(() => window.VolumenesPage.watchedSet('u1', '(', 'manga', 'VOL')).not.toThrow();
  });

  it('el modal de capítulos aplica el mismo criterio', () => {
    const S = window.UserStore;
    S.setItem('u:u1|manga:42|vol:1', '1');
    S.setItem('u:u1|manga:42|ch:2', '1');
    S.setItem('u:otro|manga:42|vol:3', '1');
    const ws = window.AnimeDestiny.chaptersModalWatchedSet;
    expect([...ws('u1', '42', 'manga', 'VOL')]).toEqual([1]);
    expect([...ws('u1', '42', 'manga', 'CH')]).toEqual([2]);
  });
});

describe('volumenes.js → conteos', () => {
  it('parseTotal acepta solo enteros positivos', () => {
    const p = window.VolumenesPage.parseTotal;
    expect(p('12')).toBe(12);
    expect(p('12.7')).toBe(12);
    expect(p('abc')).toBe(0);
    expect(p('-3')).toBe(0);
    expect(p('')).toBe(0);
    expect(p(null)).toBe(0);
  });

  it('countInRange ignora números fuera de 1..total', () => {
    expect(window.VolumenesPage.countInRange(new Set([0, 1, 2, 15]), 12)).toBe(2);
    expect(window.VolumenesPage.countInRange(null, 12)).toBe(0);
  });

  it('hero y lista coinciden aunque haya tomos marcados fuera de rango', () => {
    const S = window.UserStore;
    S.setItem('u:u1|manga:42|vol:1', '1');
    S.setItem('u:u1|manga:42|vol:14', '1');
    S.setItem('u:u1|manga:42|vol:15', '1');
    goto('?cat=manga&id=42&nombre=X&total=2&prefix=VOL');
    expect($('[data-dv2]').textContent).toBe('1/2');
    expect($('[data-dv3]').textContent).toBe('50%');
    expect($('[data-caps-count]').textContent).toBe('1/2 completados');
    expect(document.querySelectorAll('.vols-row.vista').length).toBe(1);
  });

  it('un tomo marcado no aparece como capítulo leído en la vista de capítulos', () => {
    window.UserStore.setItem('u:u1|manga:42|vol:3', '1');
    goto('?cat=manga&id=42&nombre=X&total=5&prefix=CH');
    expect($('[data-dv2]').textContent).toBe('0/5');
    expect(document.querySelectorAll('.vols-row.vista').length).toBe(0);
  });

  it('total decimal: el hero muestra el mismo número de filas', () => {
    goto('?cat=manga&id=42&nombre=X&total=3.5&prefix=VOL');
    expect($('[data-dv1]').textContent).toBe('3');
    expect(document.querySelectorAll('.vols-row').length).toBe(3);
  });

  it('total inválido: sin NaN en el hero y aviso de vacío', () => {
    goto('?cat=manga&id=42&nombre=X&total=abc&prefix=VOL');
    expect($('[data-dv1]').textContent).toBe('Sin dato');
    expect($('[data-dv3]').textContent).toBe('0%');
    expect($('[data-caps-empty]').hidden).toBe(false);
  });

  it('sin id muestra "No encontrado" y oculta hero y lista', () => {
    goto('?cat=novelas&nombre=X&total=3');
    expect($('[data-vols-notfound]').hidden).toBe(false);
    expect($('.vols-hero').hidden).toBe(true);
    expect($('[data-vols-notfound-back]').getAttribute('href')).toBe('novelas.html');
  });

  it('el título de la URL no se interpreta como HTML', () => {
    goto('?cat=manga&id=42&nombre=' + encodeURIComponent('<img src=x onerror=alert(1)>') + '&total=1&prefix=VOL');
    expect(document.querySelector('[data-caps-list] img[onerror]')).toBeNull();
    expect($('[data-hero-title]').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('mangadex-api.js → resolveMangaDexVolumeDetails', () => {
  beforeAll(async () => {
    await import('../../js/core/mangadex-api.js');
  });

  it('combina claves de volumen duplicadas ("1" y "01") sin perder capítulos', async () => {
    const uuid = 'a1b2c3d4-0000-4000-8000-0000000000aa';
    window.mdFetch = vi.fn((path) => {
      if (String(path).includes('/aggregate')) {
        return Promise.resolve({
          volumes: {
            '1': { volume: '1', chapters: { '1': {}, '2': {} } },
            '01': { volume: '01', chapters: { '2': {}, '3': {} } },
            '2': { volume: '2', chapters: { '10': {}, '4.5': {} } },
            none: { volume: 'none', chapters: { '99': {} } }
          }
        });
      }
      return Promise.resolve({ data: [], total: 0 });
    });
    const out = await window.resolveMangaDexVolumeDetails({ id: uuid });
    expect(out['1']).toMatchObject({ count: 3, first: 1, last: 3 });
    // Orden numérico, no de texto ("10" no va antes de "4.5").
    expect(out['2']).toMatchObject({ count: 2, first: 4.5, last: 10 });
    expect(out.none).toBeUndefined();
  });
});
