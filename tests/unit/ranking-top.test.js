/**
 * tests/unit/ranking-top.test.js
 * Tests para js/pages/ranking-top.js → los tres rankings de ranking.html
 *
 * Cubre:
 *  - orden:      las filas quedan por puntuación descendente aunque la API las
 *                devuelva mezcladas (getTopMangas intercala manga/manhwa/doujin)
 *  - dedupe:     un mismo id que vuelve en la página siguiente no se repite
 *  - paginación: "Cargar más" pide la página que sigue y acumula
 *  - pestañas:   cada una pide su categoría y no vuelve a pedir al volver
 *  - errores:    estado de error con reintento, sin romper el resto
 *  - escapado:   un título con HTML no se inyecta
 *
 * El módulo es un IIFE que arranca solo al importarse, así que cada test rearma
 * el DOM y lo reimporta con vi.resetModules().
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/security/sanitizer.js');
});

const DOM = `
  <div class="trk-tabs">
    <button class="trk-tab is-active" data-cat="anime">Anime</button>
    <button class="trk-tab" data-cat="manga">Manga</button>
    <button class="trk-tab" data-cat="novelas">Novelas</button>
  </div>
  <div id="rankingLista"></div>
`;

function item(id, titulo, score, extra) {
  return Object.assign({
    id: id,
    title: titulo,
    score: score,
    type: 'TV',
    startYear: 2020,
    episodes: 12,
    genres: [{ name: 'Action' }],
    images: { webp: { large_image_url: 'https://ejemplo/' + id + '.jpg' } }
  }, extra || {});
}

/** Espera a que se cumpla una condición (las cargas son asíncronas). */
async function hasta(condicion, intentos = 50) {
  for (let i = 0; i < intentos; i++) {
    if (condicion()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('La condición nunca se cumplió');
}

// Las filas de esqueleto comparten la clase .trk-fila pero no tienen título:
// al cambiar de pestaña se pintan durante un instante y hay que saltearlas.
function filas() {
  return [...document.querySelectorAll('.trk-fila:not(.trk-fila--skeleton)')];
}

function titulos() {
  return filas().map((f) => f.querySelector('.trk-titulo').textContent);
}

/** Monta el DOM, stubea las tres APIs y arranca el módulo. */
async function montar(apis) {
  document.body.innerHTML = DOM;
  window.getApiPoster = (it) => (it.images?.webp?.large_image_url || '');
  window.getTopAnimes = apis.anime || vi.fn(() => Promise.resolve([]));
  window.getTopMangas = apis.manga || vi.fn(() => Promise.resolve([]));
  window.getTopNovelas = apis.novelas || vi.fn(() => Promise.resolve([]));

  vi.resetModules();
  await import('../../js/pages/ranking-top.js');
  await hasta(() => !document.querySelector('.trk-fila--skeleton'));
}

function clickEn(sel) {
  document.querySelector(sel).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.getTopAnimes;
  delete window.getTopMangas;
  delete window.getTopNovelas;
  delete window.getApiPoster;
  vi.restoreAllMocks();
});

// ─── Orden y deduplicación ───────────────────────────────────────────────────

describe('orden del ranking', () => {
  it('ordena por puntuación descendente aunque lleguen mezcladas', async () => {
    await montar({
      anime: vi.fn(() => Promise.resolve([
        item(1, 'Media', 7.5), item(2, 'La mejor', 9.4), item(3, 'La peor', 6.1)
      ]))
    });

    expect(titulos()).toEqual(['La mejor', 'Media', 'La peor']);
  });

  it('manda al fondo lo que no tiene puntuación', async () => {
    await montar({
      anime: vi.fn(() => Promise.resolve([
        item(1, 'Sin puntaje', null), item(2, 'Con puntaje', 8.0)
      ]))
    });

    expect(titulos()).toEqual(['Con puntaje', 'Sin puntaje']);
  });

  it('numera las posiciones desde 1', async () => {
    await montar({
      anime: vi.fn(() => Promise.resolve([item(1, 'Uno', 9), item(2, 'Dos', 8)]))
    });

    const posiciones = filas().map((f) => f.querySelector('.trk-pos span').textContent);
    expect(posiciones).toEqual(['1', '2']);
  });
});

// ─── Paginación ──────────────────────────────────────────────────────────────

describe('paginación', () => {
  it('"Cargar más" pide la página siguiente y acumula', async () => {
    const api = vi.fn((pagina) => Promise.resolve(
      pagina === 1 ? [item(1, 'Uno', 9)] : [item(2, 'Dos', 8)]
    ));
    await montar({ anime: api });

    expect(api).toHaveBeenCalledWith(1, { browse: 'puntuados' });

    clickEn('#trkCargarMas');
    await hasta(() => filas().length === 2);

    expect(api).toHaveBeenCalledWith(2, { browse: 'puntuados' });
    expect(titulos()).toEqual(['Uno', 'Dos']);
  });

  it('no repite un id que vuelve en la página siguiente', async () => {
    const api = vi.fn((pagina) => Promise.resolve(
      pagina === 1 ? [item(1, 'Uno', 9)] : [item(1, 'Uno', 9), item(2, 'Dos', 8)]
    ));
    await montar({ anime: api });

    clickEn('#trkCargarMas');
    await hasta(() => filas().length === 2);

    expect(titulos()).toEqual(['Uno', 'Dos']);
  });

  it('esconde "Cargar más" cuando la API se queda sin resultados', async () => {
    const api = vi.fn((pagina) => Promise.resolve(pagina === 1 ? [item(1, 'Uno', 9)] : []));
    await montar({ anime: api });

    clickEn('#trkCargarMas');
    await hasta(() => !document.getElementById('trkCargarMas'));

    expect(filas()).toHaveLength(1);
  });
});

// ─── Pestañas ────────────────────────────────────────────────────────────────

describe('pestañas', () => {
  it('cada pestaña pide su propia categoría', async () => {
    const manga = vi.fn(() => Promise.resolve([item(9, 'Un manga', 9)]));
    await montar({ anime: vi.fn(() => Promise.resolve([item(1, 'Un anime', 9)])), manga: manga });

    clickEn('[data-cat="manga"]');
    await hasta(() => titulos()[0] === 'Un manga');

    expect(manga).toHaveBeenCalledWith(1, { browse: 'puntuados' });
    expect(document.querySelector('[data-cat="manga"]').classList.contains('is-active')).toBe(true);
    expect(document.querySelector('[data-cat="anime"]').classList.contains('is-active')).toBe(false);
  });

  it('al volver a una pestaña ya cargada no pide de nuevo', async () => {
    const anime = vi.fn(() => Promise.resolve([item(1, 'Un anime', 9)]));
    await montar({ anime: anime, manga: vi.fn(() => Promise.resolve([item(9, 'Un manga', 9)])) });

    clickEn('[data-cat="manga"]');
    await hasta(() => titulos()[0] === 'Un manga');
    clickEn('[data-cat="anime"]');
    await hasta(() => titulos()[0] === 'Un anime');

    expect(anime).toHaveBeenCalledTimes(1);
  });

  it('el hash de la URL elige la pestaña inicial', async () => {
    window.location.hash = '#novelas';
    const novelas = vi.fn(() => Promise.resolve([item(5, 'Una novela', 9)]));
    await montar({ novelas: novelas });

    expect(novelas).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-cat="novelas"]').classList.contains('is-active')).toBe(true);
  });

  it('un hash inválido cae en anime', async () => {
    window.location.hash = '#cualquiera';
    const anime = vi.fn(() => Promise.resolve([item(1, 'Un anime', 9)]));
    await montar({ anime: anime });

    expect(anime).toHaveBeenCalledTimes(1);
  });
});

// ─── Estados ─────────────────────────────────────────────────────────────────

describe('estados', () => {
  it('muestra el error con botón de reintento y se recupera', async () => {
    let falla = true;
    const anime = vi.fn(() => (falla
      ? Promise.reject(new Error('429'))
      : Promise.resolve([item(1, 'Uno', 9)])));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await montar({ anime: anime });
    await hasta(() => !!document.getElementById('trkReintentar'));

    falla = false;
    clickEn('#trkReintentar');
    await hasta(() => filas().length === 1);

    expect(titulos()).toEqual(['Uno']);
  });

  it('avisa cuando la categoría no devuelve nada', async () => {
    await montar({ anime: vi.fn(() => Promise.resolve([])) });

    expect(document.getElementById('rankingLista').textContent).toContain('Sin resultados');
  });
});

// ─── Escapado ────────────────────────────────────────────────────────────────

describe('escapado', () => {
  it('no inyecta HTML que venga en el título', async () => {
    await montar({
      anime: vi.fn(() => Promise.resolve([item(1, '<img src=x onerror=alert(1)>', 9)]))
    });

    const lista = document.getElementById('rankingLista');
    expect(lista.querySelector('.trk-titulo img')).toBeNull();
    expect(lista.querySelector('.trk-titulo').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
