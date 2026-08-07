/*
 * personajes.js — Selector de personaje.
 *
 * Lee la lista de personajes de window.Mascot.listCharacters() (Rimuru + los de
 * window.MascotRegistry y window.CharacterRegistry), pinta una tarjeta por cada
 * uno y, al tocar, cambia el personaje activo al instante con
 * Mascot.setCharacter(). La preferencia vive en localStorage 'pref:mascotChar'
 * (lo persiste el propio mascot.js).
 */
(function () {
    "use strict";

    function $(id) { return document.getElementById(id); }

    function toast(msg) {
        var t = $("mscToast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
    }

    // Estilo de la miniatura según el modo del personaje.
    function paintThumb(el, c) {
        if (!c.thumb) return;
        el.style.backgroundImage = 'url("' + String(c.thumb).replace(/"/g, "%22") + '")';
        if (c.mode === "sheet") {
            // Mostrar solo la primera celda de la hoja (cols×rows).
            el.style.backgroundSize = (c.cols * 100) + "% " + (c.rows * 100) + "%";
            el.style.backgroundPosition = "0 0";
        } else {
            el.style.backgroundSize = "contain";
            el.style.backgroundPosition = "center bottom";
        }
    }

    function render() {
        var grid = $("mscGrid");
        if (!grid || !window.Mascot || !window.Mascot.listCharacters) return;

        var chars = window.Mascot.listCharacters();
        var current = window.Mascot.getCharacter ? window.Mascot.getCharacter() : "rimuru";
        grid.innerHTML = "";

        chars.forEach(function (c) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "msc-card" + (c.id === current ? " is-selected" : "");
            card.setAttribute("data-id", c.id);
            card.setAttribute("aria-pressed", c.id === current ? "true" : "false");

            var badge = document.createElement("span");
            badge.className = "msc-badge";
            badge.textContent = "✓";
            badge.setAttribute("aria-hidden", "true");

            var thumb = document.createElement("div");
            thumb.className = "msc-thumb";
            paintThumb(thumb, c);

            var name = document.createElement("div");
            name.className = "msc-name";
            name.textContent = c.name;

            var anime = document.createElement("div");
            anime.className = "msc-anime";
            anime.textContent = c.anime || "";

            card.appendChild(badge);
            card.appendChild(thumb);
            card.appendChild(name);
            card.appendChild(anime);

            card.addEventListener("click", function () { choose(c); });
            grid.appendChild(card);
        });
    }

    function choose(c) {
        if (!window.Mascot || !window.Mascot.setCharacter) return;
        window.Mascot.setCharacter(c.id);

        // Marcar la seleccionada sin re-render (mantiene el scroll).
        var cards = document.querySelectorAll(".msc-card");
        for (var i = 0; i < cards.length; i++) {
            var sel = cards[i].getAttribute("data-id") === c.id;
            cards[i].classList.toggle("is-selected", sel);
            cards[i].setAttribute("aria-pressed", sel ? "true" : "false");
        }

        // Si la mascota está apagada, avisamos que se activa al verla.
        if (window.Mascot.isEnabled && !window.Mascot.isEnabled()) {
            toast("Elegiste a " + c.name + ". Activá la mascota en Configuración para verla.");
        } else {
            toast("¡Ahora te acompaña " + c.name + "!");
        }
    }

    // mascot.js se carga con defer y puede terminar después de este script.
    function boot() {
        if (window.Mascot && window.Mascot.listCharacters) { render(); return; }
        // Reintento corto hasta que mascot.js exponga su API.
        var tries = 0;
        var iv = setInterval(function () {
            if ((window.Mascot && window.Mascot.listCharacters) || tries++ > 40) {
                clearInterval(iv);
                render();
            }
        }, 50);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
