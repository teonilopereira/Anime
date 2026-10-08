import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Humo: cada pagina carga sin excepciones de JS ni violaciones del CSP.
// La red externa (AniList, Supabase, MangaDex...) se corta a proposito: el test
// no depende de APIs ajenas y de paso prueba que la pagina aguanta sin ellas.
const PAGINAS = fs.readdirSync('.').filter((f) => f.endsWith('.html')).sort();

test.beforeEach(async ({ page }) => {
  await page.route((url) => url.hostname !== 'localhost', (route) => route.abort());
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(`${e.violatedDirective} -> ${e.blockedURI}`);
    });
  });
});

for (const pagina of PAGINAS) {
  test(`${pagina} carga sin errores`, async ({ page }) => {
    const errores = [];
    page.on('pageerror', (err) => errores.push(err.message));

    const res = await page.goto(`/${pagina}`, { waitUntil: 'load' });
    expect(res.status()).toBe(200);
    await page.waitForTimeout(1500);

    expect(errores, 'excepciones de JS').toEqual([]);
    expect(await page.evaluate(() => window.__csp), 'violaciones del CSP').toEqual([]);
  });
}
