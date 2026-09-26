// Proxy de la API de MangaDex con CORS, para las copias del sitio que no están
// en Netlify (GitHub Pages: teonilopereira.github.io/Anime).
//
// En Netlify la app usa /mdapi/* (una reescritura de _redirects, mismo origen).
// Desde GitHub Pages esa ruta no existe y MangaDex no manda CORS para otros
// dominios, así que la app llama acá:
//   https://animedestiny.netlify.app/.netlify/functions/mdapi-cors?path=/manga&title=...
// `path` es la ruta de la API y el resto de la query se reenvía tal cual. La
// función hace el GET a api.mangadex.org y agrega Access-Control-Allow-Origin
// solo para los orígenes permitidos.

const ALLOWED_ORIGINS = new Set([
    'https://teonilopereira.github.io'
]);

// Solo rutas de lectura que usa la app (manga, portadas, aggregate, estadísticas).
const PATH_RE = /^\/(manga|cover|statistics)(\/[A-Za-z0-9-]+)*\/?$/;

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
    const path = params.get('path') || '';
    if (!PATH_RE.test(path)) return new Response('Ruta no permitida', { status: 400, headers: corsHeaders(origin) });
    params.delete('path');
    const query = params.toString();

    const upstream = await fetch('https://api.mangadex.org' + path + (query ? '?' + query : ''), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'AnimeDestiny/1.0 (+https://animedestiny.netlify.app)' }
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
