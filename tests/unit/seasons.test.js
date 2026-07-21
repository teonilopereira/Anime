/**
 * tests/unit/seasons.test.js
 * Tests para js/detalle/seasons.js → window.DetalleTemporadas
 *
 * Cubre:
 *  - esFormatoDeTemporada: qué formatos cuentan como eslabón de la cadena
 *  - cadenaDirecta:        la cadena instantánea (precuela + actual + secuela)
 *  - resolverCadena:       el recorrido completo por PREQUEL/SEQUEL, la
 *                          numeración solo cuando está anclada al principio,
 *                          los ciclos y los errores de red
 *  - htmlSeccion:          escapado del título y la fila actual sin link
 */

import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/detalle/seasons.js');
});

const T = () => window.DetalleTemporadas;

/** Ficha de anime con la forma que devuelve anilistItemToLocal. */
function ficha(id, titulo, opciones) {
  opciones = opciones || {};
  return {
    id: id,
    title: titulo,
    titulo: titulo,
    type: opciones.type || 'TV',
    seasonYear: opciones.anio || null,
    episodes: opciones.episodes || 0,
    images: { webp: { large_image_url: 'https://ejemplo/' + id + '.jpg' } },
    relations: opciones.relations || []
  };
}

function rel(tipo, id, titulo, opciones) {
  opciones = opciones || {};
  return {
    relationType: tipo,
    id: id,
    title: titulo,
    format: opciones.format || 'TV',
    seasonYear: opciones.anio || null,
    episodes: opciones.episodes || 0
  };
}

/**
 * Franquicia lineal de `n` temporadas encadenadas por PREQUEL/SEQUEL.
 * Devuelve un mapa id → ficha listo para stubear getAnimeById.
 */
function franquiciaLineal(n) {
  const fichas = {};
  for (let i = 1; i <= n; i++) {
    const relaciones = [];
    if (i > 1) relaciones.push(rel('PREQUEL', i - 1, 'Temporada ' + (i - 1), { anio: 2000 + i - 1 }));
    if (i < n) relaciones.push(rel('SEQUEL', i + 1, 'Temporada ' + (i + 1), { anio: 2000 + i + 1 }));
    fichas[i] = ficha(i, 'Temporada ' + i, { anio: 2000 + i, relations: relaciones });
  }
  return fichas;
}

function stubGetAnimeById(fichas) {
  window.getAnimeById = vi.fn((id) => Promise.resolve(fichas[id] || null));
}

afterEach(() => {
  delete window.getAnimeById;
});

// ─── esFormatoDeTemporada ────────────────────────────────────────────────────

describe('esFormatoDeTemporada', () => {
  it('acepta los formatos de serie', () => {
    expect(T().esFormatoDeTemporada('TV')).toBe(true);
    expect(T().esFormatoDeTemporada('TV_SHORT')).toBe(true);
    expect(T().esFormatoDeTemporada('ONA')).toBe(true);
  });

  it('rechaza películas, OVAs y especiales', () => {
    expect(T().esFormatoDeTemporada('MOVIE')).toBe(false);
    expect(T().esFormatoDeTemporada('OVA')).toBe(false);
    expect(T().esFormatoDeTemporada('SPECIAL')).toBe(false);
    expect(T().esFormatoDeTemporada('MUSIC')).toBe(false);
  });

  it('no rompe con valores vacíos', () => {
    expect(T().esFormatoDeTemporada(null)).toBe(false);
    expect(T().esFormatoDeTemporada('')).toBe(false);
  });
});

// ─── cadenaDirecta ───────────────────────────────────────────────────────────

describe('cadenaDirecta', () => {
  it('devuelve null cuando el anime no tiene precuela ni secuela', () => {
    expect(T().cadenaDirecta(ficha(1, 'Suelto'))).toBeNull();
  });

  it('devuelve null cuando el item abierto es una película', () => {
    const peli = ficha(9, 'La película', {
      type: 'MOVIE',
      relations: [rel('PREQUEL', 1, 'Temporada 1')]
    });
    expect(T().cadenaDirecta(peli)).toBeNull();
  });

  it('arma precuela + actual + secuela y marca la actual', () => {
    const item = ficha(2, 'Temporada 2', {
      relations: [rel('PREQUEL', 1, 'Temporada 1'), rel('SEQUEL', 3, 'Temporada 3')]
    });

    const cadena = T().cadenaDirecta(item);

    expect(cadena.eslabones.map((e) => e.titulo)).toEqual(['Temporada 1', 'Temporada 2', 'Temporada 3']);
    expect(cadena.eslabones.map((e) => e.esActual)).toEqual([false, true, false]);
  });

  it('no numera: sin recorrer la cadena no se sabe cuál es la T1', () => {
    const item = ficha(2, 'Temporada 2', { relations: [rel('PREQUEL', 1, 'Temporada 1')] });
    expect(T().cadenaDirecta(item).numerada).toBe(false);
  });

  it('ignora las relaciones que no son formato de serie', () => {
    const item = ficha(2, 'Temporada 2', {
      relations: [
        rel('PREQUEL', 8, 'Película precuela', { format: 'MOVIE' }),
        rel('SEQUEL', 3, 'Temporada 3')
      ]
    });

    const cadena = T().cadenaDirecta(item);

    expect(cadena.eslabones.map((e) => e.titulo)).toEqual(['Temporada 2', 'Temporada 3']);
  });

  it('con varias secuelas prefiere la TV antes que el ONA derivado', () => {
    const item = ficha(2, 'Temporada 2', {
      relations: [
        rel('SEQUEL', 50, 'Cortos ONA', { format: 'ONA', anio: 2015 }),
        rel('SEQUEL', 3, 'Temporada 3', { format: 'TV', anio: 2016 })
      ]
    });

    const cadena = T().cadenaDirecta(item);

    expect(cadena.eslabones[1].titulo).toBe('Temporada 3');
  });
});

// ─── resolverCadena ──────────────────────────────────────────────────────────

describe('resolverCadena', () => {
  it('recorre la franquicia entera desde el medio y la ordena', async () => {
    const fichas = franquiciaLineal(5);
    stubGetAnimeById(fichas);

    const cadena = await T().resolverCadena(fichas[3]);

    expect(cadena.eslabones.map((e) => e.titulo)).toEqual([
      'Temporada 1', 'Temporada 2', 'Temporada 3', 'Temporada 4', 'Temporada 5'
    ]);
    expect(cadena.eslabones.filter((e) => e.esActual)).toHaveLength(1);
    expect(cadena.eslabones[2].esActual).toBe(true);
  });

  it('numera cuando llegó al principio real de la cadena', async () => {
    const fichas = franquiciaLineal(4);
    stubGetAnimeById(fichas);

    const cadena = await T().resolverCadena(fichas[4]);

    expect(cadena.numerada).toBe(true);
    expect(cadena.parcial).toBe(false);
  });

  it('no numera si el recorrido hacia atrás se cortó por un error de red', async () => {
    const fichas = franquiciaLineal(4);
    // La T2 no se puede traer: la cadena queda sin anclar al principio.
    window.getAnimeById = vi.fn((id) => Promise.resolve(id === 2 ? null : fichas[id] || null));

    const cadena = await T().resolverCadena(fichas[4]);

    expect(cadena.numerada).toBe(false);
    expect(cadena.parcial).toBe(true);
  });

  it('conserva el eslabón que no se pudo traer, con lo que sabía la relación', async () => {
    const fichas = franquiciaLineal(3);
    window.getAnimeById = vi.fn((id) => Promise.resolve(id === 1 ? null : fichas[id] || null));

    const cadena = await T().resolverCadena(fichas[3]);

    expect(cadena.eslabones.map((e) => e.titulo)).toEqual(['Temporada 1', 'Temporada 2', 'Temporada 3']);
  });

  it('corta los ciclos en vez de colgarse', async () => {
    // A dice que su secuela es B y B dice que su secuela es A.
    const a = ficha(1, 'A', { relations: [rel('SEQUEL', 2, 'B')] });
    const b = ficha(2, 'B', { relations: [rel('SEQUEL', 1, 'A'), rel('PREQUEL', 1, 'A')] });
    stubGetAnimeById({ 1: a, 2: b });

    const cadena = await T().resolverCadena(a);

    expect(cadena.eslabones.map((e) => e.titulo)).toEqual(['A', 'B']);
  });

  it('devuelve null si la franquicia es de una sola ficha', async () => {
    stubGetAnimeById({ 1: ficha(1, 'Suelto') });

    expect(await T().resolverCadena(ficha(1, 'Suelto'))).toBeNull();
  });

  it('cae a la cadena directa si getAnimeById no está disponible', async () => {
    const item = ficha(2, 'Temporada 2', { relations: [rel('SEQUEL', 3, 'Temporada 3')] });

    const cadena = await T().resolverCadena(item);

    expect(cadena.eslabones).toHaveLength(2);
    expect(cadena.numerada).toBe(false);
  });

  it('no pide dos veces la misma ficha', async () => {
    const fichas = franquiciaLineal(4);
    stubGetAnimeById(fichas);

    await T().resolverCadena(fichas[2]);

    const pedidos = window.getAnimeById.mock.calls.map((c) => c[0]);
    expect(new Set(pedidos).size).toBe(pedidos.length);
  });
});

// ─── htmlSeccion ─────────────────────────────────────────────────────────────

describe('htmlSeccion', () => {
  it('escapa el título para que no se pueda inyectar HTML', () => {
    const cadena = {
      eslabones: [
        { id: 1, titulo: '<img src=x onerror=alert(1)>', anio: 2020, episodios: 12, img: '', esActual: false },
        { id: 2, titulo: 'Actual', anio: 2021, episodios: 12, img: '', esActual: true }
      ],
      numerada: true,
      parcial: false
    };

    const html = T().htmlSeccion(cadena, false);

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('la temporada actual no es un link', () => {
    const cadena = {
      eslabones: [
        { id: 1, titulo: 'Primera', anio: 2020, episodios: 12, img: '', esActual: false },
        { id: 2, titulo: 'Actual', anio: 2021, episodios: 12, img: '', esActual: true }
      ],
      numerada: true,
      parcial: false
    };

    const html = T().htmlSeccion(cadena, false);

    expect(html).toContain('<a class="season-chain-item" href="detalle.html?cat=anime&id=1"');
    expect(html).toContain('<div class="season-chain-item is-current"');
    expect(html).not.toContain('href="detalle.html?cat=anime&id=2"');
  });

  it('avisa cuando la cadena quedó incompleta', () => {
    const cadena = {
      eslabones: [
        { id: 1, titulo: 'Una', anio: 2020, episodios: 12, img: '', esActual: true },
        { id: 2, titulo: 'Otra', anio: 2021, episodios: 12, img: '', esActual: false }
      ],
      numerada: false,
      parcial: true
    };

    expect(T().htmlSeccion(cadena, false)).toContain('Puede faltar alguna temporada');
    expect(T().htmlSeccion(cadena, true)).toContain('Buscando el resto');
  });

  it('devuelve string vacío si no hay cadena', () => {
    expect(T().htmlSeccion(null, false)).toBe('');
  });
});
