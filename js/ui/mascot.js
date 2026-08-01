/**
 * mascot.js
 * Mascota 2D (Slime) que vive en una esquina de la pantalla y, cuando está
 * activada, ANUNCIA las notificaciones "hablando" por un bocadillo en vez de
 * mostrar el toast clásico. Envuelve a window.Toast: si la mascota está
 * apagada, delega en el toast de siempre; si está encendida, el slime habla.
 *
 * El sprite es pixel-art dibujado con <rect> en un SVG (shape-rendering
 * crispEdges), así no dependemos de ningún asset externo y las expresiones se
 * cambian recomponiendo unos pocos píxeles.
 *
 * Preferencia: localStorage 'pref:mascot' = 'on' | 'off' (default: on).
 * Expone window.Mascot { say, setEnabled, isEnabled }.
 */
(function (window) {
    "use strict";

    var document = window.document;

    // ── Preferencia ────────────────────────────────────────────────────────
    var PREF_KEY = "pref:mascot";

    function readPref() {
        try { return localStorage.getItem(PREF_KEY); } catch (_) { return null; }
    }
    function isEnabled() {
        // Default ON: si nunca se tocó, la mascota está encendida.
        return readPref() !== "off";
    }
    function reducedMotion() {
        try {
            if (localStorage.getItem("pref:reduceMotion") === "true") return true;
        } catch (_) {}
        try {
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (_) { return false; }
    }

    // ── Paleta del sprite ──────────────────────────────────────────────────
    var COLORS = {
        O: "#1f6f3a", // contorno (verde oscuro)
        B: "#57c85a", // cuerpo (verde)
        H: "#9be89d", // brillo
        W: "#ffffff", // ojo (blanco)
        P: "#14301c", // pupila / boca
        M: "#14301c", // boca
        C: "#ff9ec4", // mejilla (rosa)
        T: "#4fc3f7"  // lágrima (celeste)
    };

    // Cuerpo del slime (16x14). '.' = transparente.
    var BODY = [
        "................",
        ".....OOOOOO.....",
        "...OOBBBBBBOO...",
        "..OBBBBBBBBBBO..",
        "..OBHHBBBBBBBO..",
        ".OBBHBBBBBBBBBO.",
        ".OBBBBBBBBBBBBO.",
        ".OBBBBBBBBBBBBO.",
        ".OBBBBBBBBBBBBO.",
        ".OBBBBBBBBBBBBO.",
        ".OBBBBBBBBBBBBO.",
        "..OBBBBBBBBBBO..",
        "..OOBBBBBBBBOO..",
        "...OOOOOOOOOO..."
    ];

    // Rasgos (ojos/boca/mejillas) por expresión, en la misma grilla 16x14.
    // Se dibujan ENCIMA del cuerpo; '.' deja ver el cuerpo debajo.
    var EMPTY = "................";
    function overlay(rows) {
        // Completa hasta 14 filas con vacíos.
        var out = rows.slice();
        while (out.length < 14) out.push(EMPTY);
        return out;
    }

    var FACES = {
        normal: overlay([
            EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
            "....WW....WW....",
            "....WP....WP....",
            EMPTY,
            ".......MM......."
        ]),
        happy: overlay([
            EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
            ".....P....P.....",
            "....P.P..P.P....",
            EMPTY,
            "...C........C...",
            ".....M....M.....",
            "......MMMM......"
        ]),
        sad: overlay([
            EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
            "....WW....WW....",
            "....WP....PW....",
            "..T.............",
            "......MMMM......",
            ".....M....M....."
        ]),
        surprised: overlay([
            EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
            "....WW....WW....",
            "....WP....PW....",
            EMPTY,
            ".......MM.......",
            ".......MM......."
        ]),
        blink: overlay([
            EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
            "....PP....PP...."
        ])
    };

    // Cada tipo de notificación se mapea a una expresión.
    var TYPE_FACE = {
        success: "happy",
        error: "sad",
        warning: "surprised",
        info: "normal"
    };

    // ── Render del sprite ──────────────────────────────────────────────────
    function buildSVG(expr) {
        var face = FACES[expr] || FACES.normal;
        var rects = "";
        for (var y = 0; y < BODY.length; y++) {
            for (var x = 0; x < BODY[y].length; x++) {
                var ch = BODY[y].charAt(x);
                if (ch !== "." && COLORS[ch]) {
                    rects += rect(x, y, COLORS[ch]);
                }
            }
        }
        for (var fy = 0; fy < face.length; fy++) {
            for (var fx = 0; fx < face[fy].length; fx++) {
                var fc = face[fy].charAt(fx);
                if (fc !== "." && COLORS[fc]) {
                    rects += rect(fx, fy, COLORS[fc]);
                }
            }
        }
        return '<svg viewBox="0 0 16 14" xmlns="http://www.w3.org/2000/svg" ' +
            'shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
            rects + '</svg>';
    }

    function rect(x, y, color) {
        return '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + color + '"/>';
    }

    // ── DOM ────────────────────────────────────────────────────────────────
    var root = null;     // contenedor fijo
    var pet = null;      // el sprite (botón)
    var bubble = null;   // bocadillo
    var bubbleText = null;
    var hideTimer = null;
    var blinkTimer = null;
    var currentExpr = "normal";

    function setExpr(expr) {
        currentExpr = expr;
        if (pet) pet.innerHTML = buildSVG(expr);
    }

    function ensureDom() {
        if (root) return;

        root = document.createElement("div");
        root.className = "mascot-root";
        if (reducedMotion()) root.classList.add("mascot-reduced");

        bubble = document.createElement("div");
        bubble.className = "mascot-bubble";
        // Anuncia a lectores de pantalla, igual que haría un toast.
        bubble.setAttribute("role", "status");
        bubble.setAttribute("aria-live", "polite");

        bubbleText = document.createElement("span");
        bubbleText.className = "mascot-bubble-text";
        bubble.appendChild(bubbleText);

        var close = document.createElement("button");
        close.className = "mascot-bubble-close";
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar mensaje");
        close.innerHTML = "&times;";
        close.addEventListener("click", function (e) {
            e.stopPropagation();
            hideBubble();
        });
        bubble.appendChild(close);

        pet = document.createElement("button");
        pet.className = "mascot-pet";
        pet.type = "button";
        pet.setAttribute("aria-label", "Slime — tu mascota. Tocá para saludar.");
        pet.innerHTML = buildSVG("normal");
        pet.addEventListener("click", onPetClick);
        // Pausar el auto-ocultado mientras el mouse está sobre la mascota.
        pet.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
        bubble.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });

        root.appendChild(bubble);
        root.appendChild(pet);
        document.body.appendChild(root);

        scheduleBlink();
    }

    function removeDom() {
        if (!root) return;
        clearTimeout(hideTimer);
        clearTimeout(blinkTimer);
        root.remove();
        root = pet = bubble = bubbleText = null;
    }

    // Parpadeo ocasional en reposo: da vida sin ser molesto.
    function scheduleBlink() {
        clearTimeout(blinkTimer);
        if (reducedMotion()) return;
        var delay = 3500 + Math.random() * 4000;
        blinkTimer = setTimeout(function () {
            if (pet && !bubble.classList.contains("is-visible")) {
                var prev = currentExpr;
                setExpr("blink");
                setTimeout(function () { setExpr(prev); scheduleBlink(); }, 160);
            } else {
                scheduleBlink();
            }
        }, delay);
    }

    // ── Hablar ─────────────────────────────────────────────────────────────
    var DURATION = function () {
        return (window.AnimeDestiny && window.AnimeDestiny.Constants &&
            window.AnimeDestiny.Constants.TOAST_DURATION_MS) || 4000;
    };

    function say(message, type, duration) {
        if (!isEnabled()) return;
        ensureDom();

        setExpr(TYPE_FACE[type] || "normal");
        bubbleText.textContent = String(message);
        bubble.classList.remove("is-leaving");
        // Reinicia la animación de "hablar".
        pet.classList.remove("mascot-talking");
        void pet.offsetWidth; // reflow para reiniciar la animación
        pet.classList.add("mascot-talking");

        requestAnimationFrame(function () {
            bubble.classList.add("is-visible");
        });

        var dur = duration || DURATION();
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideBubble, dur);

        // Al salir el mouse, reanuda el cierre con la mitad del tiempo.
        bubble.onmouseleave = pet.onmouseleave = function () {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideBubble, dur / 2);
        };
    }

    function hideBubble() {
        if (!bubble) return;
        clearTimeout(hideTimer);
        bubble.classList.remove("is-visible");
        bubble.classList.add("is-leaving");
        if (pet) pet.classList.remove("mascot-talking");
        setExpr("normal");
        scheduleBlink();
    }

    // ── Interacción: tocar la mascota ──────────────────────────────────────
    var GREETINGS = [
        "¡Hola! ¿Qué vas a ver hoy?",
        "¡Blop! Estoy aquí si me necesitás.",
        "¿Sumamos algo a tus listas?",
        "¡Ánimo con tu maratón! ✨",
        "Toca una noti y te la leo.",
        "¡Soy tu slime de confianza!"
    ];
    var greetIdx = 0;
    function onPetClick() {
        setExpr("happy");
        bubbleText.textContent = GREETINGS[greetIdx % GREETINGS.length];
        greetIdx++;
        bubble.classList.remove("is-leaving");
        pet.classList.remove("mascot-talking");
        void pet.offsetWidth;
        pet.classList.add("mascot-talking");
        requestAnimationFrame(function () { bubble.classList.add("is-visible"); });
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideBubble, DURATION());
    }

    // ── Encender / apagar en vivo (desde configuración) ────────────────────
    function setEnabled(on) {
        try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch (_) {}
        if (on) {
            ensureDom();
        } else {
            removeDom();
        }
    }

    // ── Envolver window.Toast ──────────────────────────────────────────────
    // toast.js corre antes en el bundle, así que window.Toast ya existe. Si la
    // mascota está encendida, el slime habla en lugar del toast; si está
    // apagada, cae al toast original.
    var Original = window.Toast;

    function relay(type) {
        return function (msg, dur) {
            if (isEnabled()) {
                say(msg, type, dur);
            } else if (Original && Original[type]) {
                Original[type](msg, dur);
            }
        };
    }

    if (Original) {
        window.Toast = Object.freeze({
            success: relay("success"),
            error: relay("error"),
            info: relay("info"),
            warning: relay("warning")
        });
    }

    // API pública.
    window.Mascot = Object.freeze({
        say: say,
        setEnabled: setEnabled,
        isEnabled: isEnabled
    });

    // Mostrar la mascota al cargar si está activada (es una mascota que "vive"
    // en pantalla, no solo aparece con las notificaciones).
    function init() {
        if (isEnabled()) ensureDom();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

})(window);
