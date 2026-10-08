import fs from 'node:fs';
import path from 'node:path';

// netlify.toml es la unica fuente del CSP. Esto lo lee y arma la version para
// el <meta> que el build estampa en cada HTML: GitHub Pages no manda cabeceras
// propias, asi que sin el <meta> el sitio ahi quedaba sin CSP.
//
// El navegador aplica cabecera y <meta> juntas; como el <meta> se genera desde
// la misma politica, no puede quedar mas estricto que la cabecera (el problema
// que tenian las copias a mano que se quitaron en su momento).
//
// frame-ancestors se saca porque en un <meta> se ignora y solo deja un aviso
// en la consola; esa proteccion la siguen dando las cabeceras (Netlify/Vercel).
export function leerCspCabecera(root) {
    const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    return (toml.match(/Content-Security-Policy = "([^"]*)"/) || [])[1] || null;
}

export function cspParaMeta(csp) {
    return csp
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d && !/^frame-ancestors\b/.test(d))
        .join('; ') + ';';
}

export const CSP_META_RE = /\s*<meta http-equiv="Content-Security-Policy"[^>]*>/g;
