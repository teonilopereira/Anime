/**
 * tests/unit/usuario-publico.test.js
 * Tests para la capa de comunidad de js/pages/usuario.js:
 *  - helpers puros (window.PerfilPublico): ?u=, lista blanca del perfil
 *    público, URLs de imagen seguras y armado de ítems del muro.
 *  - flujo de usuario.html?u=<username>: pinta solo campos públicos, y si el
 *    perfil es privado/no existe (getPublicProfile → null) muestra el estado vacío.
 *  - muro: paginado pidiendo uno de más para saber si hay otra página.
 *
 * Carga el <body> real de usuario.html y el script de la página sobre jsdom.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync(path.resolve(__dirname, '../../usuario.html'), 'utf8');
const BODY = HTML.slice(HTML.indexOf('<body'), HTML.lastIndexOf('</body>'))
  .replace(/^<body[^>]*>/, '')
  .replace(/<script[\s\S]*?<\/script>/g, '');

function fila(i) {
  return {
    username: 'user' + i, display_name: '', photo_url: '', action: i % 2 ? 'liked' : 'viewed',
    category: 'anime', item_id: String(100 + i), titulo: 'Obra ' + i, img: '', created_at: new Date().toISOString()
  };
}

async function cargarPagina({ search = '', supa = null } = {}) {
  vi.resetModules();
  document.body.innerHTML = BODY;
  window.history.replaceState({}, '', '/usuario.html' + search);
  global.AnimeDestiny = { Constants: {}, internals: {} };
  window.UserStore = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.UserStore = window.UserStore;
  global.escapeHtml = (s) => String(s);
  window.AppSupabase = supa;
  delete window.waitForSupabase;
  delete window.__loadSupabase;
  await import('../../js/pages/usuario.js?t=' + Math.random());
  // deja correr las promesas de initPage / muro
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('helpers del perfil público', () => {
  beforeEach(async () => { await cargarPagina(); });

  it('lee ?u= y descarta vacíos, control chars y largos', () => {
    const { leerUsernameDeUrl } = window.PerfilPublico;
    expect(leerUsernameDeUrl('?u=Pepe')).toBe('Pepe');
    expect(leerUsernameDeUrl('?u=%20Ana%20')).toBe('Ana');
    expect(leerUsernameDeUrl('?u=a%00b')).toBe('ab');
    expect(leerUsernameDeUrl('')).toBe('');
    expect(leerUsernameDeUrl('?u=' + 'x'.repeat(200))).toBe('');
  });

  it('armarPerfilPublico usa lista blanca: nunca email, provider, id ni exp', () => {
    const p = window.PerfilPublico.armarPerfilPublico({
      id: 'uuid', username: 'pepe', display_name: 'Pepe', email: 'p@x.com', provider: 'google',
      exp: 999, level: 7, apodo: 'maratonista', total_likes: 3, total_viewed: '12',
      photo_url: 'javascript:alert(1)'
    });
    expect(p).toEqual({ nombre: 'Pepe', username: 'pepe', foto: '', nivel: 7, apodo: 'Maratonista', likes: 3, vistos: 12 });
    expect(JSON.stringify(p)).not.toMatch(/p@x\.com|google|uuid|999/);
  });

  it('armarPerfilPublico normaliza valores raros y rechaza filas sin username', () => {
    const { armarPerfilPublico } = window.PerfilPublico;
    expect(armarPerfilPublico(null)).toBeNull();
    expect(armarPerfilPublico({ display_name: 'x' })).toBeNull();
    const p = armarPerfilPublico({ username: 'a', level: -3, total_likes: 'abc', apodo: 'inventado' });
    expect(p.nivel).toBe(1);
    expect(p.likes).toBe(0);
    expect(p.apodo).toBe('');
    expect(p.nombre).toBe('a');
  });

  it('urlImagenSegura solo deja https y data:image', () => {
    const { urlImagenSegura } = window.PerfilPublico;
    expect(urlImagenSegura('https://x.com/a.png')).toBe('https://x.com/a.png');
    expect(urlImagenSegura('http://x.com/a.png')).toBe('');
    expect(urlImagenSegura('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(urlImagenSegura('data:text/html;base64,AAAA')).toBe('');
  });

  it('armarItemMuro arma enlaces codificados y descarta acciones no públicas', () => {
    const { armarItemMuro } = window.PerfilPublico;
    const it1 = armarItemMuro({ username: 'a b', action: 'liked', category: 'manga', item_id: '1&x', titulo: '' }, Date.now());
    expect(it1.perfilHref).toBe('usuario.html?u=a%20b');
    expect(it1.obraHref).toBe('detalle.html?cat=manga&id=1%26x');
    expect(it1.titulo).toBe('una obra');
    expect(armarItemMuro({ username: 'a', action: 'unliked', item_id: '1' })).toBeNull();
    expect(armarItemMuro({ username: 'a', action: 'liked', category: 'raro', item_id: '1' }).obraHref).toBe('');
  });
});

describe('usuario.html?u=<username>', () => {
  it('pinta solo datos públicos aunque la fila traiga más', async () => {
    const supa = {
      getPublicProfile: vi.fn().mockResolvedValue({
        username: 'pepe', display_name: 'Pepe', email: 'secreto@x.com', provider: 'google', level: 4, total_likes: 2, total_viewed: 5
      }),
      loadActivityFeed: vi.fn().mockResolvedValue([]),
      getCurrentUser: vi.fn().mockResolvedValue(null)
    };
    await cargarPagina({ search: '?u=pepe', supa });
    expect(supa.getPublicProfile).toHaveBeenCalledWith('pepe');
    const sec = document.getElementById('perfilPublico');
    expect(sec.hidden).toBe(false);
    expect(document.getElementById('ppubNombre').textContent).toBe('Pepe');
    expect(document.getElementById('ppubNivel').textContent).toBe('4');
    expect(document.body.textContent).not.toMatch(/secreto@x\.com|google/);
    expect(document.getElementById('perfilContent').classList.contains('perfil-init-hidden')).toBe(true);
    expect(supa.getCurrentUser).not.toHaveBeenCalled();
  });

  it('privado o inexistente → estado vacío', async () => {
    const supa = { getPublicProfile: vi.fn().mockResolvedValue(null), loadActivityFeed: vi.fn().mockResolvedValue([]) };
    await cargarPagina({ search: '?u=nadie', supa });
    expect(document.getElementById('perfilPublicoVacio').hidden).toBe(false);
    expect(document.getElementById('perfilPublico').hidden).toBe(true);
  });
});

describe('muro de actividad', () => {
  it('pagina de a 20 pidiendo 21 y oculta "cargar más" al final', async () => {
    const todas = Array.from({ length: 25 }, (_, i) => fila(i));
    const supa = {
      getCurrentUser: vi.fn().mockResolvedValue(null),
      loadActivityFeed: vi.fn((limit, offset) => Promise.resolve(todas.slice(offset, offset + limit)))
    };
    await cargarPagina({ supa });
    expect(supa.loadActivityFeed).toHaveBeenCalledWith(21, 0);
    expect(document.querySelectorAll('#muroLista .muro-item').length).toBe(20);
    const mas = document.getElementById('muroMasBtn');
    expect(mas.hidden).toBe(false);
    mas.click();
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(supa.loadActivityFeed).toHaveBeenLastCalledWith(21, 20);
    expect(document.querySelectorAll('#muroLista .muro-item').length).toBe(25);
    expect(mas.hidden).toBe(true);
    expect(document.getElementById('muroEstado').textContent).toMatch(/final/);
  });

  it('sin Supabase degrada con mensaje, sin romper', async () => {
    await cargarPagina({ supa: null });
    expect(document.getElementById('muroEstado').textContent).toMatch(/No pudimos cargar/);
  });
});
