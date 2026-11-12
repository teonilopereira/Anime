import { test, expect } from '@playwright/test';

// Flujos (BACKLOG #13). Como el humo, la red externa queda cortada; AniList se
// reemplaza por un mock mínimo cuando el flujo lo necesita y Supabase nunca
// responde. Cada flujo corre en escritorio y en móvil.
const VIEWPORTS = {
  escritorio: { width: 1440, height: 900 },
  movil: { width: 390, height: 844 },
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};

// Media mínima: lo que lee anilistItemToLocal (js/core/api.js) para pintar
// la ficha y la grilla de episodios.
const MEDIA = {
  id: 1, idMal: 1, type: 'ANIME', format: 'TV', status: 'FINISHED',
  title: { romaji: 'Obra de prueba', english: 'Test Show', native: null },
  synonyms: [], coverImage: { extraLarge: null, large: null }, bannerImage: null,
  episodes: 12, chapters: null, volumes: null, duration: 24,
  genres: ['Action'], averageScore: 80, meanScore: 80, popularity: 1, favourites: 1,
  description: 'Sinopsis de prueba.', season: 'SPRING', seasonYear: 2020, source: 'ORIGINAL',
  countryOfOrigin: 'JP', startDate: { year: 2020, month: 4, day: 1 }, endDate: { year: 2020, month: 6, day: 30 },
  rankings: [], tags: [], staff: { edges: [] }, nextAiringEpisode: null, streamingEpisodes: [],
  externalLinks: [], studios: { nodes: [] }, trailer: null,
  characters: { edges: [] }, recommendations: { nodes: [] }, relations: { edges: [] },
};

function anilistBody(query) {
  const q = String(query || '');
  if (/\bPage\s*\(/.test(q) || /\w+\s*:\s*Page\s*\(/.test(q)) {
    // Listas/búsquedas/calendario: vacías pero con forma válida.
    const page = { pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false }, media: [], airingSchedules: [] };
    const alias = [...q.matchAll(/(\w+)\s*:\s*Page\s*\(/g)].map((m) => m[1]);
    const data = alias.length ? Object.fromEntries(alias.map((a) => [a, page])) : { Page: page };
    return { data };
  }
  if (/\bMedia\s*\(/.test(q)) return { data: { Media: MEDIA } };
  return { data: {} };
}

/** Corta toda la red externa salvo AniList, que responde el mock. */
async function mockAniList(page) {
  await page.route('https://graphql.anilist.co/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    let query = '';
    try { query = JSON.parse(req.postData() || '{}').query; } catch { /* sin cuerpo */ }
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(anilistBody(query)) });
  });
}

/** Helper del humo: excepciones de JS y violaciones del CSP. */
async function vigilar(page) {
  const errores = [];
  page.on('pageerror', (err) => errores.push(err.message));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(`${e.violatedDirective} -> ${e.blockedURI}`);
    });
  });
  return async () => {
    expect(errores, 'excepciones de JS').toEqual([]);
    expect(await page.evaluate(() => window.__csp), 'violaciones del CSP').toEqual([]);
  };
}

for (const [nombre, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`flujos (${nombre})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      // Las rutas se evalúan de la última a la primera: los mocks registrados
      // después en cada test ganan sobre este corte general.
      await page.route((url) => url.hostname !== 'localhost', (route) => route.abort());
    });

    test('invitado marca un episodio: pide login y no encola progreso', async ({ page }) => {
      const comprobar = await vigilar(page);
      await mockAniList(page);
      await page.goto('/detalle.html?cat=anime&id=1');

      const ep = page.locator('button.ep-btn[data-ep="1"]').first();
      await expect(ep).toBeVisible({ timeout: 15_000 });
      await ep.click();

      const aviso = page.locator('.toast-item').filter({ hasText: /Inici[aá] sesi[oó]n|Sign in/ });
      await expect(aviso).toBeVisible();
      await expect(aviso.locator('a.toast-action')).toHaveAttribute('href', /^Login\.html\?return=/);
      await expect(ep).not.toHaveClass(/is-active/);

      const cola = await page.evaluate(() => localStorage.getItem('progressSyncQueue'));
      expect(cola === null || JSON.parse(cola).length === 0, 'progressSyncQueue vacía').toBe(true);
      const marcas = await page.evaluate(() => Object.keys(localStorage).filter((k) => /\|ep:|ep_/.test(k)));
      expect(marcas, 'claves de episodio en localStorage').toEqual([]);
      await comprobar();
    });

    test('home sin sesión: invitación visible y bloques de sesión ocultos', async ({ page }) => {
      const comprobar = await vigilar(page);
      await page.goto('/index.html');
      // JOIN_FALLBACK_MS = 1500 en js/pages/inicio.js.
      await expect(page.locator('#homeJoin')).toBeVisible({ timeout: 5_000 });
      for (const id of ['#homeStage', '#homeNovedades', '#homeReco']) {
        await expect(page.locator(id), `${id} oculto sin sesión`).toBeHidden();
      }
      await comprobar();
    });

    test('home con Supabase caído y AniList mock: carga sin excepciones', async ({ page }) => {
      const comprobar = await vigilar(page);
      await mockAniList(page);
      await page.route(/supabase\.co/, (route) => route.abort());
      // Sesión guardada (vencida) para forzar la carga del cliente de Supabase
      // (api/supabase-config.js solo lo baja si hay sesión) y que choque con la red cortada.
      await page.addInitScript(() => {
        if (sessionStorage.getItem('__seeded')) return;
        sessionStorage.setItem('__seeded', '1');
        localStorage.setItem('sb-llytokoztnjuczuppzgs-auth-token', JSON.stringify({
          access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer',
          expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 60,
          user: { id: '00000000-0000-0000-0000-000000000000', aud: 'authenticated', email: 'e2e@example.invalid' },
        }));
      });
      const res = await page.goto('/index.html', { waitUntil: 'load' });
      expect(res.status()).toBe(200);
      await expect(page.locator('#homeTopStrip')).toBeAttached();
      await page.waitForTimeout(3000);
      await comprobar();
    });

    test('configuración: avisos por categoría y pausa de 1 día', async ({ page }) => {
      const comprobar = await vigilar(page);
      await page.goto('/configuracion.html');

      const box = page.locator('#cfgNotif');
      // La sección puede estar en otro panel (hidden): se togglea por JS, como un
      // usuario lo haría tras abrir el panel, para no depender del menú.
      await expect(box).toBeAttached();
      const antes = await page.locator('#notifRacha').isChecked();
      await page.locator('#notifRacha').evaluate((el) => { el.click(); });
      const guardado = await page.evaluate(() => Object.fromEntries(
        Object.keys(localStorage).filter((k) => k.startsWith('pref:notif:')).map((k) => [k, localStorage.getItem(k)])));
      const claveRacha = Object.keys(guardado).find((k) => /racha/.test(k));
      expect(claveRacha, `clave pref:notif:* de racha (hay: ${Object.keys(guardado)})`).toBeTruthy();
      expect(await page.locator('#notifRacha').isChecked()).toBe(!antes);
      const estado = await page.evaluate(() => window.AppNotifPrefs.get().categories.racha);
      expect(estado).toBe(!antes);

      await page.locator('#notifPause1').evaluate((el) => { el.click(); });
      const status = page.locator('#notifPauseStatus');
      await expect(status).not.toHaveAttribute('hidden', /.*/);
      await expect(status).toHaveText(/pausad|paused/i);
      await expect(page.locator('#notifResume')).not.toHaveAttribute('hidden', /.*/);
      const pausa = await page.evaluate(() => window.AppNotifPrefs.get().pausedUntil);
      expect(pausa).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
      await comprobar();
    });

    test('calendario: "Solo lo que sigo" sin sesión pide iniciar sesión', async ({ page }) => {
      const comprobar = await vigilar(page);
      await mockAniList(page);
      await page.goto('/calendario.html');
      await expect(page.locator('#calendarBody .cal-loading')).toHaveCount(0, { timeout: 15_000 });
      await page.locator('#calOnlyMine').check();
      await expect(page.locator('#calendarBody .cal-empty')).toHaveText(/Inici[aá] sesi[oó]n|Sign in/);
      await comprobar();
    });
  });
}
