/**
 * tests/unit/volumenes-imagenes.test.js
 * Tests para js/pages/volumenes.js → imágenes de la página de volúmenes.
 *
 * Cubre:
 *  - el parámetro `img` solo se usa si es http(s) o una ruta del sitio
 *  - el fondo del hero escapa las comillas de la URL
 *  - hero y filas llevan el fallback global (data-fallback-catalog) y
 *    medidas para no mover el layout
 *  - las portadas por tomo se pintan con paintMangaDexCovers (miniatura), no
 *    con la tapa original
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';

const HTML = `
  <a id="volsBack" href="manga.html"></a>
  <section data-vols-notfound hidden><a data-vols-notfound-back></a></section>
  <section class="vols-hero">
    <div data-hero-bg></div>
    <img alt="Portada de la obra" data-hero-cover width="160" height="240" data-fallback-catalog="1">
    <span data-hero-tipo></span><h1 data-hero-title></h1><span data-hero-estado></span>
    <span data-dl1></span><span data-dv1></span><span data-dl2></span><span data-dv2></span><span data-dv3></span>
    <a data-detail-link></a>
  </section>
  <section class="vols-list-wrap"><h2 data-caps-title></h2><span data-caps-count></span>
    <div data-caps-list></div><p data-caps-empty hidden></p></section>`;

async function load(query) {
  window.history.replaceState(null, '', '/volumenes.html' + query);
  document.body.innerHTML = HTML;
  vi.resetModules();
  await import('../../js/pages/volumenes.js?t=' + Math.random());
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  delete window.resolveMangaDexVolumeDetails;
  delete window.paintMangaDexCovers;
});

describe('volumenes.js: imágenes', () => {
  it('descarta un img que no es http(s)', async () => {
    await load('?id=1&nombre=Obra&total=2&img=' + encodeURIComponent('javascript:alert(1)'));
    expect(document.querySelector('[data-hero-cover]').getAttribute('src')).toBe('');
    expect(document.querySelector('[data-hero-bg]').style.backgroundImage).toBe('none');
  });

  it('el hero usa la portada con alt descriptivo y el fondo no rompe con comillas', async () => {
    const img = 'https://s4.anilist.co/x/a".jpg';
    await load('?id=1&nombre=Berserk&total=1&img=' + encodeURIComponent(img));
    const hero = document.querySelector('[data-hero-cover]');
    expect(hero.getAttribute('src')).toBe(img);
    expect(hero.alt).toBe('Portada de Berserk');
    expect(hero.getAttribute('data-title')).toBe('Berserk');
    expect(document.querySelector('[data-hero-bg]').style.backgroundImage).toContain('%22');
  });

  it('las filas llevan fallback, medidas 2:3 y lazy', async () => {
    await load('?id=1&nombre=Obra&total=3&img=' + encodeURIComponent('https://s4.anilist.co/x/a.jpg'));
    const covers = document.querySelectorAll('.vols-row-cover');
    expect(covers.length).toBe(3);
    const c = covers[1];
    expect(c.getAttribute('data-vol')).toBe('2');
    expect(c.getAttribute('data-fallback-catalog')).toBe('1');
    expect(c.getAttribute('width')).toBe('62');
    expect(c.getAttribute('height')).toBe('93');
    expect(c.getAttribute('loading')).toBe('lazy');
    expect(c.alt).toBe('Portada del volumen 2');
  });

  it('pinta las portadas por tomo con paintMangaDexCovers', async () => {
    window.resolveMangaDexVolumeDetails = vi.fn(() => Promise.resolve({
      '1': { count: 2, first: 1, last: 2, cover: 'https://uploads.mangadex.org/covers/m/uno.jpg' },
      '2': { count: 0, first: null, last: null, cover: 'https://uploads.mangadex.org/covers/m/dos.jpg' }
    }));
    window.paintMangaDexCovers = vi.fn(() => Promise.resolve());
    await load('?id=1&nombre=Obra&total=3&img=' + encodeURIComponent('https://s4.anilist.co/x/a.jpg'));
    await new Promise((r) => setTimeout(r, 0));
    expect(window.paintMangaDexCovers).toHaveBeenCalledTimes(1);
    const targets = window.paintMangaDexCovers.mock.calls[0][0];
    expect(targets.map((t) => t.img.getAttribute('data-vol'))).toEqual(['1', '2']);
    expect(targets[1].url).toMatch(/dos\.jpg$/);
    // La fila 3 (sin portada propia) conserva la de la serie.
    expect(document.querySelector('.vols-row-cover[data-vol="3"]').getAttribute('src')).toBe('https://s4.anilist.co/x/a.jpg');
  });
});
