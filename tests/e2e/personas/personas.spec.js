import { test, expect, devices } from '@playwright/test';
import { instalarRed } from './fake-anilist.js';

// Pruebas por "persona": cada bloque simula un tipo de usuario distinto
// (dispositivo, idioma, red, forma de navegar) y recorre lo que ese usuario
// haría. AniList se simula con datos falsos (fake-anilist.js); el resto de la
// red externa se corta. Ninguna persona tiene cuenta: Supabase no se simula.

const DETALLE = '/detalle.html?cat=anime&id=900003&nombre=x';
// Tarjetas del catálogo: divs clickeables; la búsqueda oculta las que no coinciden.
const TARJETAS = '#main-content .card-container:visible';

// Errores de JS sin capturar: ninguna persona debería verlos.
function vigilarErrores(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  return errores;
}

test.describe('Visitante nuevo (escritorio, primera vez)', () => {
  test('entra al inicio, va al catálogo, busca y abre una ficha', async ({ page }) => {
    const errores = vigilarErrores(page);
    await instalarRed(page);

    await page.goto('/index.html');
    await expect(page.locator('h1')).toBeVisible();
    // Ve lo más popular sin tener cuenta.
    await expect(page.locator('a[href*="detalle.html"]').first()).toBeVisible();

    await page.getByRole('link', { name: /^anime$/i }).first().click();
    await expect(page).toHaveURL(/anime\.html/);
    const tarjetas = page.locator(TARJETAS);
    await expect(tarjetas.first()).toBeVisible();

    await page.locator('#catalogSearch').fill('Marea');
    await page.locator('#catalogSearch').press('Enter');
    await expect(tarjetas.filter({ hasText: 'Marea' }).first()).toBeVisible();
    // Tras Enter las sugerencias no deben reabrirse encima de los resultados
    // (antes las reabría el re-render del catálogo y tapaban las tarjetas).
    await page.waitForTimeout(1500);
    await expect(page.locator('#catalogSuggestions')).not.toHaveClass(/is-open/);

    // Se entra por el título: la portada no es un link.
    await tarjetas.filter({ hasText: 'Marea' }).first().locator('a.catalog-card-title').click();
    await expect(page).toHaveURL(/detalle\.html/);
    await expect(page).toHaveTitle(/\| Mirudoku/);
    expect(errores).toEqual([]);
  });

  test('la ficha tiene un solo título principal con texto', async ({ page }) => {
    await instalarRed(page);
    await page.goto(DETALLE);
    await expect(page).toHaveTitle(/Jardín de Acero/);
    const h1s = await page.locator('h1:visible').allInnerTexts();
    expect(h1s.map((t) => t.trim()), 'h1 visibles en la ficha').toEqual(['Jardín de Acero']);
  });
});

test.describe('Usuario sin cuenta que quiere guardar algo', () => {
  test('al marcar "Viendo" se le pide iniciar sesión', async ({ page }) => {
    const errores = vigilarErrores(page);
    await instalarRed(page);
    await page.goto(DETALLE);
    await page.getByRole('button', { name: /^viendo$/i }).first().click();
    // O lo manda a Login.html o le abre un aviso que lleva a iniciar sesión.
    await expect
      .poll(async () => /Login\.html/.test(page.url()) ||
        (await page.getByText(/inici(á|a)r? sesi(ó|o)n|ingres(á|a)|cuenta/i).filter({ visible: true }).count()) > 1,
      { message: 'debería pedirle login' })
      .toBe(true);
    expect(errores).toEqual([]);
  });
});

test.describe('Usuario de celular', () => {
  // iPhone 13 sin cambiar de motor (defaultBrowserType forzaría otro worker).
  const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
  test.use(iphone);

  for (const pagina of ['/index.html', '/anime.html', '/manga.html', DETALLE, '/Login.html', '/ranking.html']) {
    test(`${pagina} no se desborda a lo ancho`, async ({ page }) => {
      await instalarRed(page);
      await page.goto(pagina);
      await page.waitForTimeout(1500);
      const { ancho, vista, culpables } = await page.evaluate(() => {
        const vista = document.documentElement.clientWidth;
        const culpables = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > vista + 1 && getComputedStyle(el).position !== 'fixed';
          })
          .slice(0, 5)
          .map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
        return { ancho: document.documentElement.scrollWidth, vista, culpables };
      });
      expect(ancho, `scroll horizontal; se salen: ${culpables.join(', ')}`).toBeLessThanOrEqual(vista);
    });
  }

  test('puede llegar a Mis Listas desde la navegación', async ({ page }) => {
    await instalarRed(page);
    await page.goto('/index.html');
    const link = page.locator('a[href="mis-listas.html"]').filter({ visible: true }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/listas/i);
    const caja = await link.boundingBox();
    // Objetivo táctil mínimo razonable (WCAG 2.5.8 pide 24px).
    expect(Math.min(caja.width, caja.height)).toBeGreaterThanOrEqual(24);
  });
});

test.describe('Usuario que navega solo con teclado', () => {
  test('el foco es visible y llega al contenido', async ({ page }) => {
    await instalarRed(page);
    await page.goto('/index.html');
    const visitados = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      visitados.push(await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        const marca = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none';
        return { tag: el.tagName, texto: (el.textContent || '').trim().slice(0, 30), marca, enMain: !!el.closest('main, #main-content') };
      }));
    }
    const sinMarca = visitados.filter((v) => v.tag !== 'BODY' && !v.marca);
    expect(sinMarca, 'elementos que reciben foco sin indicador visible').toEqual([]);
    expect(visitados.some((v) => v.enMain), 'en 15 Tabs no llegó al contenido principal').toBe(true);
  });

  test('puede buscar en el catálogo sin mouse', async ({ page }) => {
    await instalarRed(page);
    await page.goto('/anime.html');
    await page.locator('#catalogSearch').focus();
    await page.keyboard.type('Café');
    await page.keyboard.press('Enter');
    await expect(page.locator(TARJETAS).first()).toBeVisible();
    // Si sigue tipeando, las sugerencias vuelven.
    await page.keyboard.type(' Y');
    await expect(page.locator('#catalogSuggestions')).toHaveClass(/is-open/);
  });
});

test.describe('Usuario que habla inglés', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pref:lang', 'en'));
  });

  for (const pagina of ['/index.html', '/anime.html', '/Login.html']) {
    test(`${pagina} sale en inglés`, async ({ page }) => {
      await instalarRed(page);
      await page.goto(pagina);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      // Ninguna palabra de interfaz típica en castellano debería quedar a la vista.
      const texto = await page.locator('body').innerText();
      const restos = texto.match(/\b(Iniciar sesión|Explorá|Buscar|Limpiar Filtros|Mis Listas|Ingresar)\b/gi) || [];
      expect([...new Set(restos)], 'textos sin traducir').toEqual([]);
    });
  }
});

test.describe('Usuario con modo oscuro del sistema', () => {
  test.use({ colorScheme: 'dark' });
  test('el inicio respeta el modo oscuro', async ({ page }) => {
    await instalarRed(page);
    await page.goto('/index.html');
    const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = fondo.match(/\d+/g).map(Number);
    expect((r + g + b) / 3, `fondo ${fondo}`).toBeLessThan(90);
  });
});

test.describe('Usuario con conexión lenta', () => {
  test('ve que algo está cargando y después el contenido', async ({ page }) => {
    const errores = vigilarErrores(page);
    await instalarRed(page, { modo: 'lento', demoraMs: 3000 });
    await page.goto('/anime.html');
    await page.waitForTimeout(800);
    const cargando = await page.locator('[class*="skeleton"], [class*="loading"], [aria-busy="true"], .spinner').filter({ visible: true }).count();
    expect(cargando, 'sin indicador de carga mientras espera').toBeGreaterThan(0);
    await expect(page.locator(TARJETAS).first()).toBeVisible({ timeout: 15_000 });
    expect(errores).toEqual([]);
  });
});

test.describe('Usuario cuando AniList está caído', () => {
  test('el catálogo explica el error y no dice "sin resultados"', async ({ page }) => {
    const errores = vigilarErrores(page);
    await instalarRed(page, { modo: 'caido' });
    await page.goto('/anime.html');
    const main = page.locator('#main-content');
    await expect(main).toContainText(/error|no se pudo|conexi(ó|o)n|reintentar|intent(á|a)/i, { timeout: 20_000 });
    await expect(main).not.toContainText(/sin resultados|no se encontr/i);
    expect(errores).toEqual([]);
  });

  test('la ficha ofrece reintentar en vez de "no encontrado"', async ({ page }) => {
    await instalarRed(page, { modo: 'caido' });
    await page.goto(DETALLE);
    await expect(page.locator('#detail-error-retry')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText(/no encontrado/i);
  });
});
