/**
 * fetch-quotes.js — Arma data/quotes.json para el juego "¿Quién lo dijo?".
 *
 * Baja citas de Animechan (https://animechan.io) y las guarda en un JSON
 * estático, para que el juego no dependa del límite de pedidos de la API.
 * Correlo a mano, de vez en cuando (no forma parte del build):
 *
 *   node tools/fetch-quotes.js            # 100 pedidos aleatorios
 *   node tools/fetch-quotes.js 300        # otra cantidad
 *
 * El plan gratuito de Animechan tiene un tope de pedidos por hora, así que el
 * script espera entre pedidos y, si la API responde 429, corta y guarda lo que
 * juntó. Vuelve a correr más tarde: suma a lo que ya hay sin duplicar.
 *
 * Formato de salida: [{ "anime": "...", "character": "...", "quote": "..." }]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'quotes.json');
const URL_RANDOM = 'https://api.animechan.io/v1/quotes/random';
const total = Math.max(1, Number(process.argv[2]) || 100);
const PAUSA_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// La v1 responde { status, data: { content, anime: { name }, character: { name } } };
// la versión vieja respondía { anime, character, quote }. Se aceptan las dos.
function normalizar(j) {
    const d = j && j.data ? j.data : j;
    if (!d) return null;
    const quote = d.content || d.quote;
    const anime = (d.anime && d.anime.name) || d.anime;
    const character = (d.character && d.character.name) || d.character || '';
    if (!quote || !anime || typeof anime !== 'string') return null;
    return { anime: anime.trim(), character: String(character).trim(), quote: String(quote).trim() };
}

let lista = [];
try { lista = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* primera vez */ }
const vistas = new Set(lista.map((q) => q.quote));
const antes = lista.length;

for (let i = 0; i < total; i++) {
    let res;
    try { res = await fetch(URL_RANDOM, { headers: { Accept: 'application/json' } }); }
    catch (e) { console.error('Sin conexión:', e.message); break; }
    if (res.status === 429) { console.error('Tope de pedidos alcanzado; se guarda lo juntado.'); break; }
    if (!res.ok) { console.error('Error', res.status); break; }
    const q = normalizar(await res.json());
    if (q && !vistas.has(q.quote)) { vistas.add(q.quote); lista.push(q); }
    process.stdout.write(`\r${i + 1}/${total} · ${lista.length - antes} nuevas`);
    await sleep(PAUSA_MS);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(lista, null, 1) + '\n');
console.log(`\ndata/quotes.json: ${lista.length} citas (${lista.length - antes} nuevas).`);
