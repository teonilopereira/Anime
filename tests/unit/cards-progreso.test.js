/**
 * tests/unit/cards-progreso.test.js
 * El progreso de la card del catálogo (resolveCatalogProgress en
 * js/catalog/cards.js) cuenta solo la unidad que muestra la card: tomos (vol:)
 * en cards VOL, capítulos (ch:) en cards CH. Antes los sumaba juntos y la card
 * no coincidía con volumenes.html.
 */
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

beforeAll(async () => {
  await import('../../js/core/constants.js');
  await import('../../js/core/user-store.js');
  // statusStorageKey vive en states.js (se carga antes que cards.js en el bundle).
  window.statusStorageKey = (uid, id, s) => 'u:' + uid + '|item:' + id + '|status:' + s;
  const src = fs.readFileSync(path.resolve(__dirname, '../../js/catalog/cards.js'), 'utf8');
  (0, eval)(src);
});

beforeEach(() => {
  UserStore.keys().forEach((k) => UserStore.removeItem(k));
  window._invalidateProgressIndex();
});

function card(total, prefix) {
  const el = document.createElement('div');
  el.innerHTML = `<div data-progress data-total="${total}" data-label="x" data-prefix="${prefix}"></div>`;
  return el;
}

function mark(key) { UserStore.setItem(key, '1'); }

describe('resolveCatalogProgress (manga)', () => {
  it('card VOL cuenta solo tomos, no capítulos', () => {
    mark('u:u1|manga:42|vol:1');
    mark('u:u1|manga:42|vol:2');
    mark('u:u1|manga:42|ch:3');
    const r = resolveCatalogProgress('u1', 'manga', '42', card(10, 'VOL'));
    expect(r.watched).toBe(2);
    expect(r.pct).toBe(20);
  });

  it('card CH cuenta solo capítulos, no tomos', () => {
    mark('u:u1|manga:42|vol:1');
    mark('u:u1|manga:42|ch:1');
    mark('u:u1|manga:42|ch:2');
    mark('u:u1|manga:42|ch:3');
    const r = resolveCatalogProgress('u1', 'manga', '42', card(10, 'CH'));
    expect(r.watched).toBe(3);
  });

  it('un tomo y un capítulo con el mismo número no se pisan', () => {
    mark('u:u1|manga:42|vol:3');
    mark('u:u1|manga:42|ch:3');
    expect(resolveCatalogProgress('u1', 'manga', '42', card(10, 'VOL')).watched).toBe(1);
    window._invalidateProgressIndex();
    expect(resolveCatalogProgress('u1', 'manga', '42', card(10, 'CH')).watched).toBe(1);
  });

  it('ignora números fuera de 1..total y claves de otro usuario', () => {
    mark('u:u1|manga:42|vol:0');
    mark('u:u1|manga:42|vol:15');
    mark('u:u1|manga:42|vol:5');
    mark('u:u2|manga:42|vol:6');
    const r = resolveCatalogProgress('u1', 'manga', '42', card(12, 'VOL'));
    expect(r.watched).toBe(1);
  });
});
