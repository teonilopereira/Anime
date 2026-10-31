Datos de ejemplo para `tools/capturas.cjs`, uno por página (`<pagina>.cjs`).

```js
module.exports = {
    // n: nombre en el archivo; datos: llama a poblar; hash: #fragmento;
    // init: función que corre en el navegador antes de cargar (p. ej. localStorage).
    estados: [{ n: 'invitado' }, { n: 'datos', datos: true }],
    async poblar(page, estado) { await page.evaluate(() => { /* ... */ }); },
};
```

`UserStore` vive en memoria: se carga desde `poblar` después del `load` y luego
se vuelven a llamar las funciones de render de `js/pages/<pagina>.js`. Las
imágenes externas (`https://s4.anilist.co/fake/<n>.png`) reciben un SVG de relleno.
