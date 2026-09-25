/**
 * tests/unit/watch-links.test.js
 * Tests para js/detalle/watch-links.js → window.DetalleWatchLinks
 *
 * Cubre:
 *  - recolectar: solo enlaces oficiales (STREAMING / lectores conocidos),
 *                descarte de deshabilitados y URLs no https, respaldo con
 *                streamingEpisodes, links de MangaDex, dedupe y español primero
 *  - html:       sección vacía sin enlaces, título según tipo y escapado
 */

import { beforeAll, describe, it, expect } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/detalle/watch-links.js');
});

const W = () => window.DetalleWatchLinks;

function link(site, url, extra) {
  return Object.assign({ site, url, type: 'STREAMING', language: null, isDisabled: false }, extra || {});
}

describe('recolectar (anime)', () => {
  it('toma solo los STREAMING activos de AniList', () => {
    const item = {
      externalLinks: [
        link('Crunchyroll', 'https://www.crunchyroll.com/series/x'),
        link('Twitter', 'https://twitter.com/x', { type: 'SOCIAL' }),
        link('Official Site', 'https://x.jp', { type: 'INFO' }),
        link('Funimation', 'https://funimation.com/x', { isDisabled: true })
      ]
    };
    const r = W().recolectar(item, true);
    expect(r.map((l) => l.site)).toEqual(['Crunchyroll']);
  });

  it('descarta URLs que no son https', () => {
    const item = {
      externalLinks: [
        link('Malo', 'javascript:alert(1)'),
        link('Viejo', 'http://inseguro.com/x'),
        link('Netflix', 'https://www.netflix.com/title/1')
      ]
    };
    expect(W().recolectar(item, true).map((l) => l.site)).toEqual(['Netflix']);
  });

  it('usa streamingEpisodes cuando no hay externalLinks, un enlace por sitio', () => {
    const item = {
      externalLinks: [],
      streamingEpisodes: [
        { site: 'Crunchyroll', url: 'https://crunchyroll.com/ep1' },
        { site: 'Crunchyroll', url: 'https://crunchyroll.com/ep2' }
      ]
    };
    const r = W().recolectar(item, true);
    expect(r).toHaveLength(1);
    expect(r[0].url).toBe('https://crunchyroll.com/ep1');
  });

  it('pone primero los enlaces en español y traduce el idioma', () => {
    const item = {
      externalLinks: [
        link('Crunchyroll', 'https://crunchyroll.com/en', { language: 'English' }),
        link('Crunchyroll', 'https://crunchyroll.com/es', { language: 'Spanish' })
      ]
    };
    const r = W().recolectar(item, true);
    expect(r.map((l) => l.idioma)).toEqual(['Español', 'Inglés']);
  });

  it('no incluye lectores de manga en un anime aunque vengan como INFO', () => {
    const item = { externalLinks: [link('MANGA Plus', 'https://mangaplus.shueisha.co.jp/x', { type: 'INFO' })] };
    expect(W().recolectar(item, true)).toEqual([]);
  });
});

describe('recolectar (manga)', () => {
  it('acepta lectores oficiales conocidos aunque AniList los marque como INFO', () => {
    const item = {
      externalLinks: [
        link('MANGA Plus', 'https://mangaplus.shueisha.co.jp/titles/1', { type: 'INFO' }),
        link('Official Site', 'https://x.jp', { type: 'INFO' })
      ]
    };
    expect(W().recolectar(item, false).map((l) => l.site)).toEqual(['MANGA Plus']);
  });

  it('suma los links oficiales de MangaDex e ignora los catálogos', () => {
    const item = {
      mangadexLinks: {
        al: '30013', mu: 'abc', mal: '13',
        engtl: 'https://www.viz.com/one-piece',
        bw: 'series/123',
        amz: 'https://www.amazon.co.jp/dp/1'
      }
    };
    const r = W().recolectar(item, false);
    expect(r.map((l) => l.url)).toEqual([
      'https://www.viz.com/one-piece',
      'https://bookwalker.jp/series/123',
      'https://www.amazon.co.jp/dp/1'
    ]);
  });

  it('devuelve vacío sin datos', () => {
    expect(W().recolectar({}, false)).toEqual([]);
    expect(W().recolectar(null, false)).toEqual([]);
  });
});

describe('html', () => {
  it('no pinta nada si no hay enlaces', () => {
    expect(W().html({}, true)).toBe('');
  });

  it('usa el título según el tipo y abre en pestaña nueva', () => {
    const item = { externalLinks: [link('Crunchyroll', 'https://crunchyroll.com/x')] };
    expect(W().html(item, true)).toContain('DÓNDE VER');
    expect(W().html(item, false)).toContain('DÓNDE LEER');
    expect(W().html(item, true)).toContain('target="_blank" rel="noopener noreferrer nofollow"');
  });

  it('escapa el nombre del sitio', () => {
    const item = { externalLinks: [link('<img src=x onerror=1>', 'https://ok.com/x')] };
    const out = W().html(item, true);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });
});
