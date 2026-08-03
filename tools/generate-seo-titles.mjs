/**
 * generate-seo-titles.mjs — Refresca tools/seo-titles.json desde AniList.
 *
 * Uso:
 *   node tools/generate-seo-titles.mjs [--anime N] [--manga N] [--novelas N]
 *
 * Trae los títulos más populares de cada categoría y escribe la semilla que
 * consume build.js para armar las <url> de fichas del sitemap. Se corre A MANO
 * (necesita red); NO forma parte de `npm run build` para que el chequeo de
 * "bundles al día" de CI siga siendo determinista y offline.
 *
 * Se guarda el título (no el id) porque la ficha resuelve por nombre: así la
 * URL del sitemap es estable aunque cambie el id interno, y el canonical lo fija
 * la propia ficha con el id real al cargar.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'seo-titles.json');
const ANILIST = 'https://graphql.anilist.co';

function argN(flag, def) {
    const i = process.argv.indexOf(flag);
    if (i === -1) return def;
    const n = Number(process.argv[i + 1]);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : def;
}

const COUNTS = { anime: argN('--anime', 60), manga: argN('--manga', 40), novelas: argN('--novelas', 20) };

// AniList pagina de a 50 como máximo.
const QUERY = `
query ($type: MediaType, $format: MediaFormat, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: $type, format: $format, sort: POPULARITY_DESC, isAdult: false) {
      title { romaji english }
    }
  }
}`;

async function fetchPage(type, format, page, perPage) {
    const res = await fetch(ANILIST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { type, format, page, perPage } }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (json.errors) throw new Error(`AniList: ${JSON.stringify(json.errors)}`);
    return json.data.Page.media || [];
}

async function fetchTop(type, format, count) {
    const out = [];
    for (let page = 1; out.length < count && page <= 10; page++) {
        const perPage = Math.min(50, count - out.length);
        const media = await fetchPage(type, format, page, perPage);
        if (!media.length) break;
        for (const m of media) {
            const nombre = (m.title?.romaji || m.title?.english || '').trim();
            if (nombre) out.push(nombre);
        }
        // Cortesía con la API pública (~90 req/min).
        await new Promise((r) => setTimeout(r, 700));
    }
    return out;
}

async function main() {
    console.log('Obteniendo títulos populares de AniList…');
    const anime = await fetchTop('ANIME', null, COUNTS.anime);
    const manga = await fetchTop('MANGA', null, COUNTS.manga);
    const novelas = await fetchTop('MANGA', 'NOVEL', COUNTS.novelas);

    const titles = [];
    const vistos = new Set();
    const push = (cat, nombres) => {
        for (const nombre of nombres) {
            const clave = `${cat}|${nombre}`;
            if (vistos.has(clave)) continue;
            vistos.add(clave);
            titles.push({ cat, nombre });
        }
    };
    push('anime', anime);
    push('manga', manga);
    push('novelas', novelas);

    const data = {
        _comment: 'Semilla de títulos para el sitemap (URLs SEO por nombre). Generado por tools/generate-seo-titles.mjs. build.js lo lee para agregar <url> del tipo detalle.html?cat=<cat>&nombre=<nombre>. Correr `npm run build` después de regenerar.',
        titles,
    };
    fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`OK — ${titles.length} títulos escritos en ${path.relative(process.cwd(), OUT)}`);
    console.log('Ahora corré: npm run build  (para volcarlos al sitemap.xml)');
}

main().catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
});
