/**
 * mascot-loader.js
 * Carga la mascota DESPUÉS del contenido, fuera del bundle principal.
 *
 * La mascota (mascot.js + los registros de personajes) pesa más que cualquier
 * otro módulo del bundle y no hace falta para pintar la página. Antes viajaba
 * dentro de core-bundle.min.js y bloqueaba la primera carga en todas las
 * páginas; ahora este cargador pide css/mascot.min.css y js/mascot.min.js
 * cuando la página ya terminó de cargar y el navegador está libre.
 *
 * Si la mascota está apagada ('pref:mascot' = 'off') no se descarga nada:
 * window.Toast queda como el toast clásico, que es justo lo que mascot.js haría.
 *
 * Mientras la mascota no llegó, los avisos se guardan y se repiten apenas está
 * lista, para que los primeros mensajes de la página también los diga el
 * personaje (como antes). Si la carga falla, salen como toast clásico.
 *
 * La versión la estampa tools/build.js (hash de los archivos de la mascota).
 */
(function (window) {
    "use strict";

    var VERSION = "__MASCOT_VERSION__";
    var document = window.document;

    try {
        if (localStorage.getItem("pref:mascot") === "off") return;
    } catch (_) { /* storage bloqueado: la mascota está encendida por defecto */ }

    // configuracion.html y personajes.html cargan la mascota directamente.
    if (window.Mascot) return;

    var Original = window.Toast;
    var pending = [];
    var done = false;

    if (Original) {
        var queue = function (type) {
            return function (msg, dur) { pending.push([type, msg, dur]); };
        };
        window.Toast = Object.freeze({
            success: queue("success"),
            error: queue("error"),
            info: queue("info"),
            warning: queue("warning")
        });
    }

    // mascot.js envuelve el window.Toast que encuentra al ejecutarse: tiene que
    // ser el original, no la cola, o se llamaría a sí mismo al estar apagada.
    function restore() {
        if (Original) window.Toast = Original;
    }

    function flush() {
        if (done) return;
        done = true;
        var T = window.Toast;
        pending.forEach(function (p) {
            if (T && T[p[0]]) T[p[0]](p[1], p[2]);
        });
        pending = [];
    }

    function fail() {
        restore();
        flush();
    }

    function loadScript() {
        restore();
        var s = document.createElement("script");
        s.src = "js/mascot.min.js?v=" + VERSION;
        s.async = true;
        s.onload = flush;
        s.onerror = fail;
        document.body.appendChild(s);
    }

    function start() {
        // El CSS va primero: si el script corriera antes, el personaje se
        // vería un instante sin estilos al pie de la página.
        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = "css/mascot.min.css?v=" + VERSION;
        l.onload = loadScript;
        l.onerror = fail;
        document.head.appendChild(l);
    }

    var scheduled = false;
    function whenIdle() {
        if (scheduled) return;
        scheduled = true;
        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(start, { timeout: 2000 });
        } else {
            setTimeout(start, 200);
        }
    }

    if (document.readyState === "complete") {
        whenIdle();
    } else {
        window.addEventListener("load", whenIdle, { once: true });
        // 'load' espera a todas las imágenes: en un catálogo con red lenta
        // puede tardar mucho, y los avisos en cola esperarían con él.
        setTimeout(whenIdle, 4000);
    }
})(window);
