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

    var POS_KEY = "pref:mascotPos";

    function readPref() {
        try { return localStorage.getItem(PREF_KEY); } catch (_) { return null; }
    }
    function isEnabled() {
        // Default ON: si nunca se tocó, la mascota está encendida.
        return readPref() !== "off";
    }
    function readPos() {
        try {
            var v = localStorage.getItem(POS_KEY);
            return v ? JSON.parse(v) : null;
        } catch (_) { return null; }
    }
    function writePos(p) {
        try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (_) {}
    }
    function reducedMotion() {
        try {
            if (localStorage.getItem("pref:reduceMotion") === "true") return true;
        } catch (_) {}
        try {
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (_) { return false; }
    }

    // ── Paleta del sprite (slime azul) ─────────────────────────────────────
    var COL = {
        O:  "#0a2f5c", // contorno (azul muy oscuro)
        D:  "#1657a3", // sombra
        B:  "#2f83d6", // cuerpo (azul medio)
        L:  "#63b3f2", // luz
        H:  "#bfe6ff", // brillo glossy
        W:  "#ffffff", // ojo (blanco)
        P:  "#0a2340", // pupila / boca
        C:  "#ff9ec4", // mejilla (rosa)
        T:  "#bfe9ff"  // lágrima
    };

    // Grilla del sprite: mayor resolución = más detalle/gráficos.
    var GW = 22, GH = 20;

    // Cada tipo de notificación se mapea a una expresión.
    var TYPE_FACE = {
        success: "happy",
        error: "sad",
        warning: "surprised",
        info: "normal"
    };

    // ── Geometría / sombreado del cuerpo ───────────────────────────────────
    // Elipse un poco más alta abajo → forma de gota/slime.
    function inBlob(x, y) {
        var nx = (x + 0.5 - 11) / 9.4;
        var ny = (y + 0.5 - 11.4) / 8.9;
        return nx * nx + ny * ny <= 1;
    }

    // Sombreado: brillo glossy arriba-izquierda + degradado vertical.
    function shadeAt(x, y) {
        var cx = x + 0.5, cy = y + 0.5;
        var gloss = Math.hypot(cx - 8, cy - 7);
        if (gloss < 2.5) return COL.H;               // brillo principal
        if (Math.hypot(cx - 15.5, cy - 6) < 1.4) return COL.H; // brillito 2
        if (gloss < 3.9) return COL.L;
        var t = cy / GH;
        if (t < 0.42) return COL.L;                  // parte alta iluminada
        if (t < 0.68) return COL.B;                  // medio
        return COL.D;                                // base en sombra
    }

    // ── Utilidades de dibujo sobre una grilla ──────────────────────────────
    function setPx(px, x, y, c) {
        x = Math.round(x); y = Math.round(y);
        if (y >= 0 && y < GH && x >= 0 && x < GW && inBlob(x, y)) px[y * GW + x] = c;
    }
    function disc(px, cx, cy, r, c) {
        for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
            for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) setPx(px, x, y, c);
            }
        }
    }
    function arc(px, cx, cy, r, a0, a1, c) {
        for (var a = a0; a <= a1; a += 5) {
            var rad = a * Math.PI / 180;
            setPx(px, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, c);
            setPx(px, cx + Math.cos(rad) * (r - 0.9), cy + Math.sin(rad) * (r - 0.9), c);
        }
    }

    // Sonrisa: mitad inferior de un círculo (curva hacia arriba en los bordes).
    function smile(px, cx, cy, r) { arc(px, cx, cy, r, 28, 152, COL.P); }
    // Ceño triste: mitad superior de un círculo (curva hacia abajo en el centro).
    function frown(px, cx, cy, r) { arc(px, cx, cy, r, 208, 332, COL.P); }

    // Ojo redondo con pupila y brillito.
    function eye(px, cx, look) {
        disc(px, cx, 11, 2.1, COL.W);
        disc(px, cx + look, 11.5, 1.15, COL.P);
        setPx(px, cx - 0.7, 10.2, COL.W);
    }

    // ── Rasgos por expresión ───────────────────────────────────────────────
    function drawFace(px, expr) {
        var lx = 7.5, rx = 14.5; // centros de ojos
        if (expr === "happy") {
            arc(px, lx, 11.8, 2.0, 200, 340, COL.P); // ojos felices ^
            arc(px, rx, 11.8, 2.0, 200, 340, COL.P);
            disc(px, 4.4, 13.4, 1.2, COL.C);          // mejillas
            disc(px, 17.6, 13.4, 1.2, COL.C);
            smile(px, 11, 13.0, 3.0);                 // sonrisota abierta
            smile(px, 11, 13.0, 2.4);
        } else if (expr === "sad") {
            eye(px, lx, 0.2); eye(px, rx, -0.2);
            disc(px, 5.0, 13.6, 1.15, COL.T);         // lágrima
            disc(px, 5.0, 14.7, 0.7, COL.T);
            setPx(px, 4.6, 13.1, COL.W);              // brillito de la lágrima
            frown(px, 11, 16.9, 2.9);                 // boca triste
            frown(px, 11, 16.9, 2.4);
        } else if (expr === "surprised") {
            eye(px, lx, 0); eye(px, rx, 0);
            disc(px, 11, 14.7, 1.5, COL.P);           // boca "o"
            disc(px, 11, 14.9, 0.7, COL.D);
        } else if (expr === "blink") {
            for (var i = -2; i <= 2; i++) { setPx(px, lx + i, 11, COL.P); setPx(px, rx + i, 11, COL.P); }
        } else { // normal / info
            eye(px, lx, 0.2); eye(px, rx, 0.2);
            smile(px, 11, 12.9, 2.7);                 // sonrisa suave
            smile(px, 11, 12.9, 2.2);
        }
    }

    // ── Render del sprite → SVG de <rect> (crisp) ──────────────────────────
    function buildSVG(expr) {
        var px = new Array(GW * GH);
        var x, y;
        // 1) cuerpo sombreado + contorno
        for (y = 0; y < GH; y++) {
            for (x = 0; x < GW; x++) {
                if (!inBlob(x, y)) continue;
                var edge = !inBlob(x - 1, y) || !inBlob(x + 1, y) ||
                           !inBlob(x, y - 1) || !inBlob(x, y + 1);
                px[y * GW + x] = edge ? COL.O : shadeAt(x, y);
            }
        }
        // 2) cara
        drawFace(px, expr);

        // Sombra en el piso (debajo del slime) para dar volumen.
        var rects = '<ellipse cx="11" cy="19.3" rx="7.2" ry="1.25" ' +
            'fill="rgba(0,0,0,0.28)"/>';
        for (y = 0; y < GH; y++) {
            for (x = 0; x < GW; x++) {
                var c = px[y * GW + x];
                if (c) rects += rect(x, y, c);
            }
        }
        return '<svg viewBox="0 0 ' + GW + ' ' + GH + '" xmlns="http://www.w3.org/2000/svg" ' +
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
    var drag = null;        // estado del arrastre en curso
    var justDragged = false; // para no disparar el saludo al soltar tras mover

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
        // Arrastre para reubicar la mascota (no tapar botones).
        wireDrag();

        root.appendChild(bubble);
        root.appendChild(pet);
        document.body.appendChild(root);

        applyPosition();
        scheduleBlink();
    }

    // ── Arrastrar / posición ────────────────────────────────────────────────
    var MARGIN = 8; // margen mínimo con los bordes de la ventana

    // Rango de píxeles disponible para el borde superior-izquierdo del sprite.
    function availX() { return Math.max(0, window.innerWidth - root.offsetWidth - MARGIN * 2); }
    function availY() { return Math.max(0, window.innerHeight - root.offsetHeight - MARGIN * 2); }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    // Fija la mascota en (left, top) recortada a la ventana para que nunca quede
    // fuera de pantalla, y ancla el bocadillo al lado que corresponda.
    function place(left, top) {
        var w = root.offsetWidth;
        left = Math.max(MARGIN, Math.min(left, MARGIN + availX()));
        top = Math.max(MARGIN, Math.min(top, MARGIN + availY()));
        root.style.left = left + "px";
        root.style.top = top + "px";
        root.style.right = "auto";
        root.style.bottom = "auto";
        // Si su centro cae en la mitad izquierda, el bocadillo abre a la derecha.
        root.classList.toggle("mascot-left", (left + w / 2) < window.innerWidth / 2);
    }

    // Ubica por proporción (0..1) del área disponible: así la posición es
    // responsive y sobrevive a rotar el móvil o cambiar de tamaño de pantalla.
    function placeByRatio(rx, ry) {
        place(MARGIN + rx * availX(), MARGIN + ry * availY());
    }

    // Proporción actual del sprite dentro del área disponible.
    function currentRatio() {
        var r = root.getBoundingClientRect();
        var ax = availX() || 1, ay = availY() || 1;
        return { rx: clamp01((r.left - MARGIN) / ax), ry: clamp01((r.top - MARGIN) / ay) };
    }

    function applyPosition() {
        var p = readPos();
        if (!p) return; // sin posición guardada → default de CSS (abajo-derecha)
        if (typeof p.rx === "number") placeByRatio(p.rx, p.ry);
        else if (typeof p.left === "number") place(p.left, p.top); // formato viejo
    }

    function wireDrag() {
        pet.addEventListener("pointerdown", function (e) {
            if (e.button != null && e.button !== 0) return; // solo botón primario
            justDragged = false;
            var r = root.getBoundingClientRect();
            drag = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, id: e.pointerId, moved: false };
            try { pet.setPointerCapture(e.pointerId); } catch (_) {}
        });
        pet.addEventListener("pointermove", function (e) {
            if (!drag || e.pointerId !== drag.id) return;
            var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
            if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < 4) return; // umbral: click vs arrastre
            if (!drag.moved) {
                drag.moved = true;
                justDragged = true;
                root.classList.add("mascot-dragging");
                clearTimeout(hideTimer);
                hideBubble();
            }
            place(drag.left + dx, drag.top + dy);
        });
        function endDrag(e) {
            if (!drag || (e && e.pointerId !== drag.id)) return;
            try { pet.releasePointerCapture(drag.id); } catch (_) {}
            root.classList.remove("mascot-dragging");
            if (drag.moved) writePos(currentRatio());
            drag = null;
        }
        pet.addEventListener("pointerup", endDrag);
        pet.addEventListener("pointercancel", endDrag);
    }

    // Al cambiar el tamaño/orientación, reubicar por proporción si hay posición
    // manual (o re-encajar la posición vieja en px). Se hace en rAF para leer
    // el tamaño ya recalculado por el clamp de CSS.
    function reflow() {
        if (!root || !root.style.left) return;
        requestAnimationFrame(function () {
            var p = readPos();
            if (p && typeof p.rx === "number") placeByRatio(p.rx, p.ry);
            else { var r = root.getBoundingClientRect(); place(r.left, r.top); }
        });
    }
    window.addEventListener("resize", reflow);
    window.addEventListener("orientationchange", reflow);

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
        // Si el click viene de terminar un arrastre, no saludar.
        if (justDragged) { justDragged = false; return; }
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
