// @vitest-environment node
/**
 * tests/unit/mdapi-cors.test.js
 * Tests para netlify/functions/mdapi-cors.mjs → proxy de MangaDex con CORS.
 *
 * Cubre:
 *  - CORS:      Access-Control-Allow-Origin solo para los orígenes permitidos
 *  - preflight: OPTIONS → 204; otros métodos → 405
 *  - rutas:     solo manga/cover/statistics; cualquier otra → 400 sin ir a la red
 *  - query:     `path` se saca y el resto se reenvía tal cual a la API
 *  - portadas:  ?cover= válido va a uploads.mangadex.org; inválido → 400;
 *               una portada fallida no se cachea
 *
 * Corre en entorno node (no jsdom): la función usa Request/Response nativos.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import handler from '../../netlify/functions/mdapi-cors.mjs';

const BASE = 'https://mirudoku.netlify.app/.netlify/functions/mdapi-cors';
const PERMITIDO = 'https://teonilopereira.github.io';

function pedido(query, { method = 'GET', origin = PERMITIDO } = {}) {
  return new Request(BASE + query, { method, headers: origin ? { origin } : {} });
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{"result":"ok"}', {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CORS', () => {
  it('agrega Allow-Origin para el origen permitido', async () => {
    const res = await handler(pedido('?path=/manga'));
    expect(res.headers.get('access-control-allow-origin')).toBe(PERMITIDO);
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('no agrega Allow-Origin para otros orígenes', async () => {
    const res = await handler(pedido('?path=/manga', { origin: 'https://evil.example' }));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('OPTIONS responde 204 sin ir a la red', async () => {
    const res = await handler(pedido('?path=/manga', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toBe('GET');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza métodos que no son GET', async () => {
    const res = await handler(pedido('?path=/manga', { method: 'POST' }));
    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('rutas de la API', () => {
  it.each([
    '/manga',
    '/manga/0a1b2c3d-0000-4000-8000-000000000000',
    '/manga/0a1b2c3d-0000-4000-8000-000000000000/aggregate',
    '/cover',
    '/statistics/manga/abc'
  ])('permite %s', async (ruta) => {
    const res = await handler(pedido('?path=' + encodeURIComponent(ruta)));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    '',
    '/user/me',
    '/auth/login',
    '/manga/../user',
    '//evil.example/manga',
    '/manga?x=1'
  ])('rechaza %j sin ir a la red', async (ruta) => {
    const res = await handler(pedido('?path=' + encodeURIComponent(ruta)));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saca `path` y reenvía el resto de la query', async () => {
    await handler(pedido('?path=/manga&title=Berserk&limit=5'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mangadex.org/manga?title=Berserk&limit=5');
    expect(init.headers['Accept']).toBe('application/json');
    expect(init.headers['User-Agent']).toMatch(/^Mirudoku\//);
  });

  it('devuelve el status y el cuerpo de MangaDex', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"errors":[]}', { status: 404 }));
    const res = await handler(pedido('?path=/manga/abc'));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('{"errors":[]}');
  });
});

describe('portadas', () => {
  const COVER = '/0a1b2c3d-0000-4000-8000-000000000000/tapa.jpg.512.jpg';

  it('trae la portada de uploads.mangadex.org y la cachea para siempre', async () => {
    fetchMock.mockResolvedValueOnce(new Response('img', {
      status: 200,
      headers: { 'content-type': 'image/jpeg' }
    }));
    const res = await handler(pedido('?cover=' + encodeURIComponent(COVER)));
    expect(fetchMock.mock.calls[0][0]).toBe('https://uploads.mangadex.org/covers' + COVER);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('no cachea una portada que falló', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    const res = await handler(pedido('?cover=' + encodeURIComponent(COVER)));
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    '/no-es-un-uuid/tapa.jpg',
    '/0a1b2c3d-0000-4000-8000-000000000000/../../etc',
    'https://evil.example/x.jpg'
  ])('rechaza %j sin ir a la red', async (cover) => {
    const res = await handler(pedido('?cover=' + encodeURIComponent(cover)));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
