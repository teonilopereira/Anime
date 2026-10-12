/**
 * tests/unit/escena.test.js
 * Tests para js/pages/escena.js → window.Escena (búsqueda con trace.moe)
 *
 * Cubre:
 *  - formatoTiempo:         segundos → m:ss / h:mm:ss
 *  - normalizarResultados:  descarta +18, deduplica por anime, acepta anilist
 *                           como número u objeto y solo deja previews de
 *                           media.trace.moe
 *  - htmlResultado:         link a la ficha, marca de "dudoso" y escapado
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/pages/escena.js');
});

const E = () => window.Escena;

function r(extra) {
  return Object.assign({
    anilist: { id: 21, isAdult: false, title: { english: 'One Piece', romaji: 'One Piece', native: 'ワンピース' } },
    episode: 1, from: 63.5, to: 66.1, similarity: 0.95,
    image: 'https://media.trace.moe/image/21/x.mp4.jpg?t=1&now=2&token=a',
    video: 'https://media.trace.moe/video/21/x.mp4?t=1&now=2&token=a'
  }, extra || {});
}

describe('formatoTiempo', () => {
  it('formatea minutos y horas', () => {
    expect(E().formatoTiempo(0)).toBe('0:00');
    expect(E().formatoTiempo(63.9)).toBe('1:03');
    expect(E().formatoTiempo(3725)).toBe('1:02:05');
    expect(E().formatoTiempo(-4)).toBe('0:00');
  });
});

describe('normalizarResultados', () => {
  it('arma la lista y deduplica por anime', () => {
    const out = E().normalizarResultados({ result: [
      r(),
      r({ similarity: 0.9 }),
      r({ anilist: { id: 99, isAdult: true, title: { romaji: 'X' } } }),
      r({ anilist: 5, episode: null, similarity: 0.5 })
    ] });
    expect(out.map((x) => x.anilistId)).toEqual([21, 5]);
    expect(out[0]).toMatchObject({ titulo: 'One Piece', nativo: 'ワンピース', episodio: '1', similitud: 0.95 });
    expect(out[0].video).toContain('size=s');
    expect(out[1]).toMatchObject({ titulo: 'AniList #5', episodio: null });
  });

  it('descarta previews que no son de trace.moe', () => {
    const [x] = E().normalizarResultados({ result: [r({ image: 'https://malo.com/a.jpg', video: 'javascript:alert(1)' })] });
    expect(x.imagen).toBe('');
    expect(x.video).toBe('');
  });

  it('acepta respuestas vacías o rotas', () => {
    expect(E().normalizarResultados(null)).toEqual([]);
    expect(E().normalizarResultados({ result: 'x' })).toEqual([]);
  });
});

describe('htmlResultado', () => {
  it('enlaza a la ficha del anime', () => {
    const [x] = E().normalizarResultados({ result: [r()] });
    const html = E().htmlResultado(x, 0);
    expect(html).toContain('href="detalle.html?cat=anime&id=21"');
    expect(html).toContain('Episodio 1');
    expect(html).toContain('1:03 – 1:06');
    expect(html).toContain('is-top');
    expect(html).not.toContain('dudoso');
  });

  it('marca como dudoso por debajo de 87% y escapa', () => {
    const [x] = E().normalizarResultados({ result: [r({ similarity: 0.6, anilist: { id: 3, title: { english: '<img src=x>' } } })] });
    const html = E().htmlResultado(x, 0);
    expect(html).toContain('dudoso');
    expect(html).not.toContain('is-top');
    expect(html).not.toContain('<img src=x>');
  });
});
