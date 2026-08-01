/**
 * offline.js — Lógica de la página de respaldo sin conexión (offline.html).
 *
 * El Service Worker sirve offline.html cuando una navegación falla por falta de
 * red. Acá solo cableamos el botón de reintento y el reintento automático al
 * recuperar la conexión: no dependemos de ningún otro script de la app para que
 * la página funcione incluso en la primera visita sin red.
 */
(function () {
    "use strict";

    var btn = document.getElementById("offlineRetry");
    if (btn) {
        btn.addEventListener("click", function () {
            // Reintenta la URL original (la barra de direcciones la conserva).
            window.location.reload();
        });
    }

    // Si vuelve la conexión mientras el usuario mira esta página, reintentamos solos.
    window.addEventListener("online", function () {
        window.location.reload();
    });
})();
