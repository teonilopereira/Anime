/**
 * tests/unit/inicio-home-plus.test.js
 * js/pages/inicio.js con sesión simulada:
 *   - #10: el "+1" de "Seguí donde lo dejaste" da la misma XP que la ficha
 *     (XP_PROGRESS por addUserPoints + misión "progress"), vía
 *     AppSupabase.grantProgressXp si existe o la misma ruta a mano.
 *   - #4: los enlaces del escenario apuntan a la grilla (#epGrid).
 *   - #21: Novedades recibe states/progress ya cargados y la home pide
 *     loadItemStates/loadAllProgress una sola vez aunque el evento de sesión
 *     llegue varias veces.
 */
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';

const flush = () => new Promise((r) => setTimeout(r, 0));

const states = [
  { item_id: '10', category: 'anime', watch_status: 'viendo', meta: { titulo: 'Serie A', img: '', total: 12 }, updated_at: '2026-11-01T00:00:00Z' },
  { item_id: '20', category: 'manga', watch_status: 'viendo', meta: { titulo: 'Manga B', img: '' }, updated_at: '2026-10-01T00:00:00Z' },
];
const progress = [
  { category: 'anime', item_id: '10', pkey: 's:0|ep:3', value: true, updated_at: '2026-11-02T00:00:00Z' },
];

const client = {
  isSignedIn: () => true,
  getCurrentUser: () => Promise.resolve({ id: 'u1' }),
  getCurrentUserSync: () => ({ id: 'u1' }),
  loadItemStates: vi.fn(() => Promise.resolve(states)),
  loadAllProgress: vi.fn(() => Promise.resolve(progress)),
  setProgress: vi.fn(() => Promise.resolve()),
};

const novedadesRender = vi.fn(() => Promise.resolve(false));

beforeAll(async () => {
  document.body.innerHTML =
    '<div id="streakWidget" hidden></div><section id="homeJoin" hidden></section>' +
    '<section id="homeStage" hidden></section><section id="homeNovedades" hidden></section>' +
    '<section id="homeReco" hidden><h2 id="homeRecoTitle"></h2><div id="homeRecoTrack"></div></section>';
  window.getCurrentUserIdSafe = () => 'u1';
  window.addUserPoints = vi.fn();
  window.AppMissions = { track: vi.fn(), getState: () => ({ signedIn: false, daily: [] }) };
  window.Toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  window.AppNovedades = { render: novedadesRender };
  window.AppSupabase = client;
  window.AppSupabaseReady = Promise.resolve(client);
  await import('../../js/pages/inicio.js');
  // La sesión "llega" varias veces, como en la app real.
  window.dispatchEvent(new CustomEvent('supabase-auth-changed', { detail: { user: { id: 'u1' } } }));
  window.dispatchEvent(new CustomEvent('supabase-auth-changed', { detail: { user: { id: 'u1' } } }));
  await flush(); await flush();
});

beforeEach(() => {
  window.addUserPoints.mockClear();
  window.AppMissions.track.mockClear();
});

describe('home: escenario "Seguí donde lo dejaste"', () => {
  it('carga estados y progreso una sola vez y se los pasa a Novedades (#21)', () => {
    expect(client.loadItemStates).toHaveBeenCalledTimes(1);
    expect(client.loadAllProgress).toHaveBeenCalledTimes(1);
    expect(novedadesRender).toHaveBeenCalledTimes(1);
    const [host, data] = novedadesRender.mock.calls[0];
    expect(host).toBe(document.getElementById('homeNovedades'));
    expect(data.states).toBe(states);
    expect(data.progress).toBe(progress);
  });

  it('muestra "Ep. N de M" con el total del servidor y enlaza a #epGrid (#4)', () => {
    const stage = document.getElementById('homeStage');
    expect(stage.hidden).toBe(false);
    expect(stage.querySelector('.home-stage-step').textContent).toBe('Sigue: Ep. 4 de 12');
    const links = Array.from(stage.querySelectorAll('a.home-stage-btn, a.home-stage-mini'));
    expect(links.length).toBe(2);
    links.forEach((a) => expect(a.getAttribute('href')).toMatch(/^detalle\.html\?cat=\w+&id=\d+#epGrid$/));
    expect(window.AppInicio.progressUrl('anime', 10)).toBe('detalle.html?cat=anime&id=10#epGrid');
  });

  it('+1 da la misma XP que la ficha (XP_PROGRESS) y cuenta la misión (#10)', async () => {
    const btn = document.querySelector('#homeStage button.home-plus[data-plus-id="10"]');
    btn.click();
    await flush();
    expect(client.setProgress).toHaveBeenCalledWith({ category: 'anime', itemId: '10', key: 's:0|ep:4', value: true });
    expect(window.addUserPoints).toHaveBeenCalledTimes(1);
    expect(window.addUserPoints).toHaveBeenCalledWith('u1', 2);
    expect(window.AppMissions.track).toHaveBeenCalledWith('progress');
    expect(document.querySelector('#homeStage .home-stage-step').textContent).toBe('Sigue: Ep. 5 de 12');
  });

  it('prefiere AppSupabase.grantProgressXp cuando existe', () => {
    client.grantProgressXp = vi.fn(() => 2);
    expect(window.AppInicio.grantProgressXp('u1')).toBe(2);
    expect(client.grantProgressXp).toHaveBeenCalledWith('u1');
    expect(window.addUserPoints).not.toHaveBeenCalled();
    delete client.grantProgressXp;
  });

  it('sin sesión (Invitado) no da XP', () => {
    expect(window.AppInicio.grantProgressXp('Invitado')).toBe(0);
    expect(window.addUserPoints).not.toHaveBeenCalled();
  });

  it('si Supabase falla, encola con owner = id de la cuenta', async () => {
    localStorage.removeItem('progressSyncQueue');
    client.setProgress.mockImplementationOnce(() => Promise.reject(new Error('red')));
    document.querySelector('#homeStage button.home-plus[data-plus-id="10"]').click();
    await flush();
    const q = JSON.parse(localStorage.getItem('progressSyncQueue'));
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ category: 'anime', itemId: '10', key: 's:0|ep:5', value: true, owner: 'u1' });
    expect(window.Toast.warning).toHaveBeenCalled();
  });
});

describe('home: vaciado de la cola de progreso', () => {
  const queue = [
    { category: 'anime', itemId: '1', key: 's:0|ep:1', value: true, owner: 'u1' },
    { category: 'anime', itemId: '2', key: 's:0|ep:1', value: true, owner: 'otra' },
    { category: 'anime', itemId: '3', key: 's:0|ep:1', value: true },
  ];

  it('sin sesión no intenta nada y deja la cola intacta', async () => {
    localStorage.setItem('progressSyncQueue', JSON.stringify(queue));
    client.setProgress.mockClear();
    const prev = client.isSignedIn;
    client.isSignedIn = () => false;
    window.dispatchEvent(new Event('online'));
    await flush();
    client.isSignedIn = prev;
    expect(client.setProgress).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('progressSyncQueue'))).toHaveLength(3);
  });

  it('con sesión manda lo propio (y lo sin owner) y conserva lo de otra cuenta', async () => {
    localStorage.setItem('progressSyncQueue', JSON.stringify(queue));
    client.setProgress.mockClear();
    window.dispatchEvent(new Event('online'));
    await flush();
    const sent = client.setProgress.mock.calls.map((c) => c[0].itemId);
    expect(sent).toEqual(['1', '3']);
    const rest = JSON.parse(localStorage.getItem('progressSyncQueue'));
    expect(rest).toHaveLength(1);
    expect(rest[0].owner).toBe('otra');
  });

  it('delega en DetalleProgress.drain si está cargado', async () => {
    window.DetalleProgress = { drain: vi.fn(() => Promise.resolve()) };
    client.setProgress.mockClear();
    window.dispatchEvent(new Event('online'));
    await flush();
    expect(window.DetalleProgress.drain).toHaveBeenCalled();
    expect(client.setProgress).not.toHaveBeenCalled();
    delete window.DetalleProgress;
  });
});
