// Lado "manos y ojos" del explorador: abre el navegador para una persona,
// describe la página en texto (con referencias numeradas a lo clickeable) y
// ejecuta las acciones que pide el modelo. No sabe nada de la API de Claude,
// así que se puede probar solo (ver tools/explorador-ia/README.md).

import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import { instalarRed } from '../../tests/e2e/personas/fake-anilist.js';

const CHROMIUM_LOCAL = '/opt/pw-browsers/chromium';

// Lo que se considera "interactivo" para darle una referencia al modelo.
const INTERACTIVOS = [
  'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
  '[role=button]', '[role=link]', '[role=tab]', '[role=option]', '[role=checkbox]',
  '[role=menuitem]', '[role=switch]', '[tabindex]:not([tabindex="-1"])',
].join(',');

const MAX_REFS = 70;

export async function abrirNavegador(persona, { baseUrl, red = 'simulada' }) {
  const browser = await chromium.launch(
    fs.existsSync(CHROMIUM_LOCAL) ? { executablePath: CHROMIUM_LOCAL } : {},
  );
  let opciones = { viewport: { width: 1366, height: 820 } };
  if (persona.dispositivo === 'celular') {
    const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
    opciones = iphone;
  }
  const context = await browser.newContext({
    ...opciones,
    locale: persona.idioma,
    colorScheme: persona.esquema,
    // Sin service worker: si no, el SW cachearía respuestas entre pasos.
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const origen = new URL(baseUrl).origin;

  if (red === 'simulada') {
    await instalarRed(page);
  } else {
    // Red real: la app usa sus APIs, pero el agente no puede navegar fuera del sitio.
    await page.route('**/*', (route) => {
      const req = route.request();
      if (req.isNavigationRequest() && req.frame() === page.mainFrame() && !req.url().startsWith(origen)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  const eventos = [];
  page.on('pageerror', (e) => eventos.push(`Excepción de JS: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
      eventos.push(`console.error: ${m.text().slice(0, 300)}`);
    }
  });
  page.on('dialog', async (d) => {
    eventos.push(`Diálogo del navegador (${d.type()}): "${d.message()}" (se aceptó)`);
    await d.accept().catch(() => {});
  });

  return { browser, context, page, origen, eventos, persona };
}

async function esperarCalma(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(900);
}

// Describe la página como texto para el modelo y marca cada elemento
// interactivo con data-explorador-ref para poder actuar sobre él.
export async function describir(sesion) {
  const { page, eventos } = sesion;
  const datos = await page.evaluate(({ selector, max }) => {
    document.querySelectorAll('[data-explorador-ref]').forEach((e) => e.removeAttribute('data-explorador-ref'));
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
    };
    const etiqueta = (el) => {
      const t = el.getAttribute('aria-label') || (el.innerText || '').trim() || el.getAttribute('placeholder') ||
        el.getAttribute('title') || el.querySelector('img')?.getAttribute('alt') || el.value || '';
      let txt = t.replace(/\s+/g, ' ').slice(0, 70);
      // Botones cortos dentro de una tarjeta ("Favorito", "Visto"): decir de qué obra son.
      const obra = el.closest('[data-title]')?.getAttribute('data-title');
      if (obra && txt.length < 25 && !txt.includes(obra)) txt += ` (de "${obra.slice(0, 40)}")`;
      return txt;
    };
    const candidatos = [...document.querySelectorAll(selector)].filter(visible);
    // Primero lo que está en pantalla, después lo de más abajo.
    candidatos.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ea = ra.bottom > 0 && ra.top < vh ? 0 : 1, eb = rb.bottom > 0 && rb.top < vh ? 0 : 1;
      return ea - eb || ra.top - rb.top || ra.left - rb.left;
    });
    const refs = candidatos.slice(0, max).map((el, i) => {
      el.setAttribute('data-explorador-ref', String(i + 1));
      const r = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      const tipo = tag === 'input' ? `input[${el.type}]` : (el.getAttribute('role') || tag);
      return {
        ref: i + 1, tipo, texto: etiqueta(el),
        enPantalla: r.bottom > 0 && r.top < vh,
        tamano: `${Math.round(r.width)}x${Math.round(r.height)}`,
        extra: [el.disabled ? 'deshabilitado' : '', el.getAttribute('aria-expanded') ? `expanded=${el.getAttribute('aria-expanded')}` : '',
          el.getAttribute('aria-current') ? 'actual' : '', tag === 'a' ? `→ ${el.getAttribute('href').slice(0, 60)}` : ''].filter(Boolean).join(' '),
      };
    });
    const foco = document.activeElement && document.activeElement !== document.body ? (() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      const marcado = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return `${el.tagName.toLowerCase()} "${etiqueta(el)}"${el.dataset.exploradorRef ? ` (ref ${el.dataset.exploradorRef})` : ''}` +
        // Solo cuenta si el navegador debería mostrar el foco (:focus-visible,
        // p. ej. tras Tab); tras un clic con mouse es normal que no se vea.
        (marcado || !el.matches(':focus-visible') ? '' : ' — SIN indicador de foco visible');
    })() : 'ninguno (body)';
    const titulos = [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 15)
      .map((h) => `${h.tagName.toLowerCase()}: ${h.innerText.trim().replace(/\s+/g, ' ').slice(0, 80)}`);
    const avisos = [...document.querySelectorAll('[role=alert],[role=status],[aria-live],.toast,dialog[open],[role=dialog]')]
      .filter(visible).map((e) => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 200)).filter(Boolean);
    const texto = (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').trim().slice(0, 1800);
    return {
      url: location.pathname + location.search, titulo: document.title, lang: document.documentElement.lang,
      scroll: `${Math.round(scrollY)} de ${Math.max(0, document.documentElement.scrollHeight - vh)} px`,
      desbordeHorizontal: document.documentElement.scrollWidth > vw + 1,
      refs, foco, titulos, avisos, texto,
    };
  }, { selector: INTERACTIVOS, max: MAX_REFS });

  const lineas = [
    `URL: ${datos.url}`,
    `Título de la pestaña: ${datos.titulo}  |  lang="${datos.lang}"  |  scroll: ${datos.scroll}`,
    datos.desbordeHorizontal ? 'AVISO: la página tiene scroll horizontal.' : '',
    `Foco actual: ${datos.foco}`,
    datos.titulos.length ? `Encabezados:\n  ${datos.titulos.join('\n  ')}` : 'Encabezados: ninguno visible',
    datos.avisos.length ? `Avisos/diálogos visibles:\n  ${datos.avisos.join('\n  ')}` : '',
    'Elementos interactivos (ref · tipo · texto · tamaño):',
    ...datos.refs.map((r) => `  [${r.ref}] ${r.tipo} "${r.texto}" ${r.tamano}${r.enPantalla ? '' : ' (fuera de pantalla)'}${r.extra ? ' ' + r.extra : ''}`),
    `Texto visible (recortado): ${datos.texto}`,
  ];
  const nuevos = eventos.splice(0);
  if (nuevos.length) lineas.push(`Errores técnicos desde la última vista:\n  ${nuevos.slice(0, 8).join('\n  ')}`);
  return lineas.filter(Boolean).join('\n');
}

export async function captura(sesion, archivo) {
  const buf = await sesion.page.screenshot({ type: 'jpeg', quality: 60, fullPage: false });
  if (archivo) {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, buf);
  }
  return buf.toString('base64');
}

function localizar(page, ref) {
  return page.locator(`[data-explorador-ref="${Number(ref)}"]`);
}

// Ejecuta una acción del modelo. Devuelve { texto, imagen? } o lanza Error con
// un mensaje que el modelo puede leer (p. ej. "otro elemento tapa el botón").
export async function ejecutar(sesion, nombre, input) {
  const { page, persona, origen } = sesion;
  const soloTeclado = !!persona.soloTeclado;

  switch (nombre) {
    case 'ver_pagina':
      return { texto: await describir(sesion) };

    case 'mirar':
      return { texto: 'Captura de lo que se ve en pantalla.', imagen: await captura(sesion) };

    case 'clic': {
      if (soloTeclado) throw new Error('Sos un usuario de teclado: no podés hacer clic. Usá la herramienta tecla.');
      try {
        await localizar(page, input.ref).click({ timeout: 4000 });
      } catch (e) {
        const motivo = /intercepts pointer events/.test(e.message)
          ? 'otro elemento tapa ese lugar y se lleva el clic'
          : /not visible|not found|resolved to 0/.test(e.message)
            ? 'el elemento ya no está o no se ve (pedí ver_pagina para refrescar las referencias)'
            : e.message.split('\n')[0].slice(0, 200);
        throw new Error(`No se pudo hacer clic en [${input.ref}]: ${motivo}`);
      }
      await esperarCalma(page);
      return { texto: await describir(sesion) };
    }

    case 'escribir': {
      if (input.ref) {
        if (soloTeclado) throw new Error('Sos un usuario de teclado: llegá al campo con Tab y usá ref null.');
        await localizar(page, input.ref).fill('', { timeout: 4000 }).catch(() => {
          throw new Error(`[${input.ref}] no es un campo donde se pueda escribir.`);
        });
        await localizar(page, input.ref).pressSequentially(input.texto, { delay: 25 });
      } else {
        await page.keyboard.type(input.texto, { delay: 25 });
      }
      if (input.enter) await page.keyboard.press('Enter');
      await esperarCalma(page);
      return { texto: await describir(sesion) };
    }

    case 'tecla': {
      const permitidas = /^(Shift\+)?(Tab|Enter|Escape|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Backspace)$/;
      if (!permitidas.test(input.tecla)) throw new Error(`Tecla no permitida: ${input.tecla}`);
      const veces = Math.min(Math.max(input.veces || 1, 1), 15);
      for (let i = 0; i < veces; i++) await page.keyboard.press(input.tecla === 'Space' ? ' ' : input.tecla);
      await esperarCalma(page);
      return { texto: await describir(sesion) };
    }

    case 'desplazar': {
      const dy = { abajo: 0.8, arriba: -0.8 }[input.direccion];
      if (dy == null) throw new Error('direccion debe ser "abajo" o "arriba".');
      await page.mouse.wheel(0, Math.round((page.viewportSize()?.height || 800) * dy));
      await page.waitForTimeout(700);
      return { texto: await describir(sesion) };
    }

    case 'ir_a': {
      if (!/^\/[^/]/.test(input.ruta) && input.ruta !== '/') throw new Error('ruta debe empezar con / (solo páginas de este sitio).');
      await page.goto(origen + input.ruta, { waitUntil: 'domcontentloaded' });
      await esperarCalma(page);
      return { texto: await describir(sesion) };
    }

    case 'volver':
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await esperarCalma(page);
      return { texto: await describir(sesion) };

    default:
      throw new Error(`Herramienta desconocida: ${nombre}`);
  }
}
