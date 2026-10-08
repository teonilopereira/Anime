// Proxy de la API de MangaDex con CORS, para las copias del sitio que no están
// en Netlify (GitHub Pages: teonilopereira.github.io/Anime).
//
// En Netlify la app usa /mdapi/* (una reescritura de _redirects, mismo origen).
// Desde GitHub Pages esa ruta no existe y MangaDex no manda CORS para otros
// dominios, así que la app llama acá:
//   https://mirudoku.netlify.app/.netlify/functions/mdapi-cors?path=/manga&title=...
// `path` es la ruta de la API y el resto de la query se reenvía tal cual. La
// función hace el GET a api.mangadex.org y agrega Access-Control-Allow-Origin
// solo para los orígenes permitidos.
//
// También sirve las portadas: ?cover=/<manga>/<archivo> las trae de
// uploads.mangadex.org desde el servidor. Pedidas desde el navegador (directo
// o con la reescritura /mdcovers, que reenvía Referer y Sec-Fetch-Site),
// MangaDex responde un cartel "You can read this at MangaDex" en vez de la tapa.

const ALLOWED_ORIGINS = new Set([
    'https://teonilopereira.github.io'
]);

const COVER_RE = /^\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i;

// Solo rutas de lectura que usa la app (manga, portadas, aggregate, estadísticas).
const PATH_RE = /^\/(manga|cover|statistics)(\/[A-Za-z0-9-]+)*\/?$/;

const UA = 'Mirudoku/1.0 (+https://mirudoku.netlify.app)';

function corsHeaders(origin) {
    return ALLOWED_ORIGINS.has(origin)
        ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
        : { 'Vary': 'Origin' };
}

export default async (req) => {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: { ...corsHeaders(origin), 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Accept' }
        });
    }
    if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });

    const params = new URL(req.url).searchParams;

    const cover = params.get('cover');
    if (cover !== null) {
        if (!COVER_RE.test(cover)) return new Response('Portada no válida', { status: 400, headers: corsHeaders(origin) });
        const img = await fetch('https://uploads.mangadex.org/covers' + cover, { headers: { 'User-Agent': UA } });
        return new Response(img.body, {
            status: img.status,
            headers: {
                ...corsHeaders(origin),
                'Content-Type': img.headers.get('content-type') || 'image/jpeg',
                // Una portada no cambia nunca (el nombre del archivo es único).
                'Cache-Control': img.ok ? 'public, max-age=31536000, immutable' : 'no-store',
                'Netlify-CDN-Cache-Control': img.ok ? 'public, max-age=31536000, durable' : 'no-store'
            }
        });
    }

    const path = params.get('path') || '';
    if (!PATH_RE.test(path)) return new Response('Ruta no permitida', { status: 400, headers: corsHeaders(origin) });
    params.delete('path');
    const query = params.toString();

    const upstream = await fetch('https://api.mangadex.org' + path + (query ? '?' + query : ''), {
        headers: { 'Accept': 'application/json', 'User-Agent': UA }
    });
    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            ...corsHeaders(origin),
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Cache-Control': 'public, max-age=300'
        }
    });
};
