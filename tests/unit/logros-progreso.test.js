/**
 * tests/unit/logros-progreso.test.js
 * Logros opcionales por progreso real (js/pages/mis-listas-logros.js →
 * window.AppLogrosProgreso.evaluar) y el historial de 7 días que usa
 * "Semana Intensa" (js/core/missions.js → AppMissions.getRecentCount).
 *
 * Cada logro: condición cumplida / no cumplida / datos incompletos.
 */
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

let uid = 'teo';

beforeAll(async () => {
  window.getCurrentUserIdSafe = () => uid;
  await import('../../js/core/missions.js');
  await import('../../js/pages/mis-listas-logros.js');
});

const evaluar = (d) => window.AppLogrosProgreso.evaluar(d);
const prog = (obj) => new Map(Object.entries(obj).map(([k, n]) => [k, { count: n, unit: 'ep' }]));

describe('Hasta el Final (fin_serie)', () => {
  it('se cumple con todos los episodios marcados', () => {
    const r = evaluar({ entries: [{ category: 'anime', id: '1', total: 12 }], progress: prog({ 'anime:1': 12 }) });
    expect(r.fin_serie).toBe(true);
  });
  it('no se cumple a mitad de serie', () => {
    const r = evaluar({ entries: [{ category: 'anime', id: '1', total: 12 }], progress: prog({ 'anime:1': 5 }) });
    expect(r.fin_serie).toBe(false);
  });
  it('sin total conocido no se puede afirmar', () => {
    const r = evaluar({ entries: [{ category: 'manga', id: '2', total: 0 }], progress: prog({ 'manga:2': 300 }) });
    expect(r.fin_serie).toBe(false);
    expect(evaluar(undefined).fin_serie).toBe(false);
  });
});

describe('Al Día (al_dia)', () => {
  it('se cumple si todo lo que está en "Viendo" está al día', () => {
    const r = evaluar({
      entries: [
        { category: 'anime', id: '1', wstatus: 'viendo', total: 12 },
        { category: 'anime', id: '3', wstatus: 'viendo', total: 0 }, // en emisión sin total
        { category: 'manga', id: '9', wstatus: 'pendiente', total: 100 } // no cuenta
      ],
      progress: prog({ 'anime:1': 12, 'anime:3': 4 })
    });
    expect(r.al_dia).toBe(true);
    expect(r.detalle.atrasadas).toBe(0);
  });
  it('no se cumple con una obra atrasada o sin progreso', () => {
    const r = evaluar({
      entries: [
        { category: 'anime', id: '1', wstatus: 'viendo', total: 12 },
        { category: 'manga', id: '2', wstatus: 'viendo', total: 0 }
      ],
      progress: prog({ 'anime:1': 7 })
    });
    expect(r.al_dia).toBe(false);
    expect(r.detalle.atrasadas).toBe(2);
  });
  it('sin nada en "Viendo" (o sin datos) no se cumple', () => {
    expect(evaluar({ entries: [{ category: 'anime', id: '1', viewed: true }], progress: {} }).al_dia).toBe(false);
    expect(evaluar({}).al_dia).toBe(false);
  });
});

describe('Nuevo Horizonte (nueva_categoria)', () => {
  it('se cumple con la primera obra de una segunda categoría', () => {
    const r = evaluar({
      entries: [
        { category: 'anime', id: '1', viewed: true },
        { category: 'novelas', id: '5', wstatus: 'pendiente' }
      ]
    });
    expect(r.nueva_categoria).toBe(true);
  });
  it('cuenta también el progreso marcado aunque la obra no esté en la lista', () => {
    const r = evaluar({ entries: [{ category: 'anime', id: '1', fav: true }], progress: prog({ 'manga:7': 1 }) });
    expect(r.nueva_categoria).toBe(true);
  });
  it('no se cumple con una sola categoría', () => {
    const r = evaluar({ entries: [{ category: 'anime', id: '1', viewed: true }, { category: 'anime', id: '2', fav: true }] });
    expect(r.nueva_categoria).toBe(false);
  });
  it('ignora entradas incompletas o sin estado', () => {
    const r = evaluar({
      entries: [{ category: 'anime', id: '1', viewed: true }, { id: '2', viewed: true }, null, { category: 'manga', id: '3' }]
    });
    expect(r.nueva_categoria).toBe(false);
  });
});

describe('Semana Intensa (semana_intensa)', () => {
  it('se cumple con 10 o más en 7 días', () => {
    expect(evaluar({ recentProgress: 10 }).semana_intensa).toBe(true);
  });
  it('no se cumple con menos', () => {
    expect(evaluar({ recentProgress: 9 }).semana_intensa).toBe(false);
  });
  it('sin historial (null / sin sesión) no se cumple', () => {
    expect(evaluar({ recentProgress: null }).semana_intensa).toBe(false);
    expect(evaluar({ recentProgress: 'x' }).semana_intensa).toBe(false);
  });
});

describe('AppMissions.getRecentCount (historial de 7 días)', () => {
  const setDay = (d) => vi.setSystemTime(new Date(d + 'T12:00:00'));
  beforeEach(() => {
    localStorage.clear();
    uid = 'teo';
    window.addUserPoints = vi.fn();
    window.Toast = { success: vi.fn() };
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('suma los últimos 7 días y descarta lo más viejo', () => {
    setDay('2026-10-01'); window.AppMissions.track('progress', 4); // 8 días antes del 09
    setDay('2026-10-03'); window.AppMissions.track('progress', 3);
    setDay('2026-10-09'); window.AppMissions.track('progress', 7);
    expect(window.AppMissions.getRecentCount('progress', 7)).toBe(10);
    // la clave del 01/10 se podó; la del 03/10 sigue
    expect(localStorage.getItem('ad:mis:teo:d:2026-10-01')).toBeNull();
    expect(localStorage.getItem('ad:mis:teo:d:2026-10-03')).not.toBeNull();
  });

  it('sin sesión devuelve null (dato incompleto, no cero)', () => {
    uid = 'Invitado';
    expect(window.AppMissions.getRecentCount('progress', 7)).toBeNull();
  });
});

describe('render en mis-listas (grupos colapsables)', () => {
  it('arma "Logros de progreso" cerrado y "Todos los logros" abierto, sin perder lo ganado', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    localStorage.clear();
    const store = new Map();
    window.UserStore = {
      keys: () => Array.from(store.keys()),
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    window.getCurrentUserIdSafe = () => 'teo';
    window.getAllItems = () => [];
    window.escapeHtml = (s) => String(s);
    window.renderPoints = window.renderProfileSummary = window.renderApodos = () => {};
    document.body.innerHTML = '<div id="tab"><div id="achievementsGrid"></div></div>';
    const src = fs.readFileSync(path.resolve('js/pages/mis-listas-logros.js'), 'utf8');
    window.eval(src);

    // Ya ganado antes (flag persistente) aunque hoy no se cumpla
    localStorage.setItem('ad:achvGrant:teo:prog_semana', '1');
    window.renderAchievements();

    const prog = document.getElementById('achvGroupProgreso');
    const todos = document.getElementById('achvGroupTodos');
    expect(prog.tagName).toBe('DETAILS');
    expect(prog.open).toBe(false);
    expect(todos.open).toBe(true);
    expect(todos.contains(document.getElementById('achievementsGrid'))).toBe(true);
    expect(prog.querySelectorAll('.achievement-card')).toHaveLength(4);
    expect(prog.querySelector('summary').textContent).toContain('1 de 4');
    expect(prog.querySelectorAll('.achievement-card.is-unlocked')).toHaveLength(1);

    // Segundo render: no duplica los grupos
    window.renderAchievements();
    expect(document.querySelectorAll('#achvGroupProgreso')).toHaveLength(1);
  });
});
