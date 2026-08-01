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

    // Modo "paseo": el slime camina y salta solo por la pantalla, con gravedad,
    // y se posa sobre la estructura real de la página (navbar, cards, títulos…).
    // Preferencia independiente para poder tener la mascota quieta si molesta.
    var ROAM_KEY = "pref:mascotRoam";

    function readPref() {
        try { return localStorage.getItem(PREF_KEY); } catch (_) { return null; }
    }
    function isEnabled() {
        // Default ON: si nunca se tocó, la mascota está encendida.
        return readPref() !== "off";
    }
    function roamPref() {
        // Default ON: el slime se mueve salvo que lo apaguen explícitamente.
        try { return localStorage.getItem(ROAM_KEY) !== "off"; } catch (_) { return true; }
    }
    // El paseo requiere que el usuario no haya pedido reducir el movimiento.
    function roamEnabled() {
        return roamPref() && !reducedMotion();
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
        T:  "#bfe9ff", // lágrima
        R:  "#ff4d6d"  // corazón (rojo/rosa) para los ojos enamorados
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

    // Corazón pequeño (ojo enamorado): dos lóbulos arriba + punta abajo.
    function heartEye(px, cx, cy, c) {
        disc(px, cx - 0.9, cy - 0.2, 1.0, c);
        disc(px, cx + 0.9, cy - 0.2, 1.0, c);
        setPx(px, cx - 1.1, cy + 0.7, c);
        setPx(px, cx + 1.1, cy + 0.7, c);
        setPx(px, cx - 0.5, cy + 1.2, c);
        setPx(px, cx + 0.5, cy + 1.2, c);
        setPx(px, cx, cy + 1.7, c);
        setPx(px, cx, cy - 0.6, COL.H); // brillito
    }

    // Ojo dormido: párpado cerrado con una pestaña curva hacia abajo.
    function sleepyEye(px, cx) {
        arc(px, cx, 10.4, 2.0, 20, 160, COL.P);
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
        } else if (expr === "love") {
            heartEye(px, lx, 10.8, COL.R);            // ojos de corazón
            heartEye(px, rx, 10.8, COL.R);
            disc(px, 4.4, 13.8, 1.2, COL.C);          // mejillas sonrojadas
            disc(px, 17.6, 13.8, 1.2, COL.C);
            smile(px, 11, 13.4, 3.0);                 // sonrisota
            smile(px, 11, 13.4, 2.4);
        } else if (expr === "sleep") {
            sleepyEye(px, lx); sleepyEye(px, rx);     // párpados cerrados
            disc(px, 11, 15.0, 0.9, COL.P);           // boquita entreabierta
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
    var zzz = null;         // "Zzz" flotante cuando duerme

    // ── Cariño / mimos ─────────────────────────────────────────────────────
    var petStreak = 0;      // clicks encadenados (mimos seguidos)
    var lastPetAt = 0;      // timestamp del último mimo, para encadenar
    var loveTimer = null;   // vuelve a la cara normal tras enamorarse

    // ── Sueño por inactividad ──────────────────────────────────────────────
    var sleeping = false;      // el slime está dormido
    var lastActivity = 0;      // último movimiento/tecla/scroll del usuario
    var sleepTimer = null;     // vigía que lo duerme tras un rato quieto
    var IDLE_SLEEP_MS = 45000; // inactividad para empezar a dormir

    // ── Estado del motor de movimiento (paseo con física) ──────────────────
    // Todo en coordenadas de viewport (position: fixed), refiriéndose a la
    // esquina superior-izquierda del sprite (mismo sistema que place()).
    var phys = null;         // { x, y, vx, vy, w, h, face, ground }
    var rafId = null;        // id del requestAnimationFrame en curso
    var lastT = 0;           // timestamp del frame anterior (para dt)
    var running = false;     // motor activo (paseo encendido y pestaña visible)
    var platCache = { list: [], t: 0 };   // plataformas detectadas (con caché)
    var mouse = { x: -1, y: -1, t: 0 };   // último puntero conocido
    var nextDecision = 0;    // cuándo el slime vuelve a elegir qué hacer
    var attentionUntil = 0;  // pausa el paseo (habla / click) hasta este tiempo
    var lastReact = 0;       // cooldown de reacciones al contenido
    var lastFlee = 0;        // cooldown del "susto" al acercar el cursor
    var mouseWired = false;  // para no duplicar el listener global de puntero

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
        // Al pasar el cursor por encima, si estaba dormido, despierta.
        pet.addEventListener("mouseenter", wakeUp);
        // Arrastre para reubicar la mascota (no tapar botones).
        wireDrag();

        // "Zzz" flotante para el modo dormido (oculto por CSS salvo al dormir).
        zzz = document.createElement("div");
        zzz.className = "mascot-zzz";
        zzz.setAttribute("aria-hidden", "true");
        zzz.textContent = "z";

        root.appendChild(bubble);
        root.appendChild(zzz);
        root.appendChild(pet);
        document.body.appendChild(root);

        applyPosition();
        scheduleBlink();
        wireActivity();
        // Arranca el paseo (si está permitido); si no, queda quieta y arrastrable.
        startEngine();
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
            // Al soltarlo, si el paseo está activo lo dejamos caer desde donde
            // quedó: la física lo lleva a posarse sobre la repisa más cercana.
            if (running && phys) {
                var r = root.getBoundingClientRect();
                phys.x = r.left; phys.y = r.top; phys.vx = 0; phys.vy = 0;
                phys.ground = null;
                nextDecision = performance.now() + 500;
            }
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
            // Con el paseo activo el motor controla la posición: solo refrescamos
            // el tamaño del sprite y las plataformas, y re-encajamos la física
            // dentro de la ventana (que pudo achicarse).
            if (running && phys) {
                refreshMetrics();
                phys.x = Math.max(MARGIN, Math.min(phys.x, window.innerWidth - phys.w - MARGIN));
                phys.ground = null; // recalcula dónde apoyarse tras el resize
                return;
            }
            var p = readPos();
            if (p && typeof p.rx === "number") placeByRatio(p.rx, p.ry);
            else { var r = root.getBoundingClientRect(); place(r.left, r.top); }
        });
    }
    // Reescanear plataformas al hacer scroll (las repisas se mueven con la página).
    window.addEventListener("scroll", function () { platCache.t = 0; }, { passive: true });
    window.addEventListener("resize", reflow);
    window.addEventListener("orientationchange", reflow);

    // ── Motor de movimiento: paseo, gravedad e interacción con la página ────
    //
    // El slime deja de estar clavado en una esquina y pasa a "vivir" en la
    // pantalla: camina, salta y cae con gravedad, aterrizando sobre el borde
    // superior de elementos reales (navbar inferior, cards, títulos, footer…)
    // que se detectan con getBoundingClientRect. También mira/sigue/esquiva el
    // cursor y, al posarse sobre una card, comenta por el bocadillo.
    //
    // Todo con un único requestAnimationFrame; sin librerías (respeta el CSP).

    var GRAV = 2600;         // aceleración de la gravedad (px/s²)
    var WALK = 82;           // velocidad al caminar (px/s)
    var JUMP_VY = -900;      // impulso de un salto normal (px/s) → alcanza ~155px
    var JUMP_MAX = 1220;     // impulso máximo para trepar a repisas altas (px/s)

    // Elementos que sirven de "repisa". Selectores robustos y genéricos: si un
    // rect no cumple los filtros (ancho, altura, estar a la vista) se descarta,
    // así funciona en cualquier página sin mantener una lista por vista.
    var PLATFORM_SEL = [
        ".mobile-bottom-nav", ".card-container", ".catalog-neon-card",
        ".card", ".hero-section", ".cfg-panel", "footer",
        "h1.title", "h2.title", ".section-title"
    ].join(",");

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function rand(a, b) { return a + Math.random() * (b - a); }

    // Refresca el tamaño del sprite (cambia con el ancho de pantalla por el
    // clamp() del CSS) e invalida la caché de plataformas.
    function refreshMetrics() {
        if (!root || !phys) return;
        phys.w = root.offsetWidth || 72;
        phys.h = root.offsetHeight || 66;
        platCache.t = 0;
    }

    // Detecta las repisas visibles (con caché corta para no escanear cada frame).
    // Cada plataforma guarda `top` ya convertido a la Y del BORDE SUPERIOR del
    // sprite cuando está parado encima, para que el aterrizaje sea una simple
    // comparación. Se incluye el piso de la ventana como plataforma base.
    function scanPlatforms() {
        var now = performance.now();
        if (platCache.list.length && now - platCache.t < 350) return platCache.list;

        var W = window.innerWidth, H = window.innerHeight;
        var floorTop = H - phys.h - MARGIN;
        var out = [{ left: 0, right: W, top: floorTop, floor: true }];

        var els = document.querySelectorAll(PLATFORM_SEL);
        for (var i = 0; i < els.length && out.length < 60; i++) {
            var el = els[i];
            if (el === root || root.contains(el)) continue;
            var r = el.getBoundingClientRect();
            if (r.width < phys.w * 1.1 || r.height < 10) continue; // muy chico
            if (r.right < 0 || r.left > W) continue;                // fuera de X
            var top = r.top - phys.h;                               // Y del sprite parado
            if (top < MARGIN + 2 || top > floorTop - 2) continue;   // fuera de Y útil
            out.push({ left: Math.max(0, r.left), right: Math.min(W, r.right), top: top, el: el });
        }
        platCache = { list: out, t: now };
        return out;
    }

    // Al caer (prevY→newY), busca la repisa MÁS ALTA que el sprite cruza con su
    // centro horizontal dentro del rango de la repisa. Devuelve null si no toca.
    function landingFor(prevY, newY, cx) {
        var list = scanPlatforms(), best = null;
        for (var i = 0; i < list.length; i++) {
            var p = list[i];
            if (cx < p.left - 6 || cx > p.right + 6) continue;
            if (prevY <= p.top && newY >= p.top && (!best || p.top < best.top)) best = p;
        }
        return best;
    }

    // Pausa el paseo un rato (mientras habla o tras un click): se queda quieto.
    function pauseRoam(ms) {
        attentionUntil = performance.now() + (ms || DURATION());
        if (phys) phys.vx = 0;
    }

    // Aplica el "mirar hacia" (flip horizontal) sobre el SVG, sin pelear con las
    // animaciones de la mascota (idle/talk viven en .mascot-pet; el flip, en svg).
    function applyFace() {
        var svg = pet && pet.firstChild;
        if (svg && svg.style) svg.style.transform = "scaleX(" + (phys.face || 1) + ")";
    }

    // Reacción contextual al posarse sobre un elemento real de la página.
    function reactTo(plat, ts) {
        if (!plat || plat.floor || !plat.el) return;
        if (ts - lastReact < 9000 || Math.random() < 0.35) return; // sin spamear
        var el = plat.el, title = null;
        if (el.getAttribute) title = el.getAttribute("data-title");
        if (!title && el.querySelector) {
            var t = el.querySelector("[data-title]");
            if (t) title = t.getAttribute("data-title");
        }
        var msg = null;
        if (title) {
            msg = pick([
                "¿'" + title + "' a tu lista? 👀",
                "¡'" + title + "' tiene buena pinta!",
                "Marcá '" + title + "' como visto 👁"
            ]);
        } else if (el.matches && el.matches(".mobile-bottom-nav")) {
            msg = "Tocá un ícono para navegar 📱";
        } else if (el.matches && el.matches(".hero-section, h1, h2, .title, .section-title")) {
            msg = pick(["¿Exploramos? 🚀", "¡Vamos a maratonear! ✨"]);
        } else if (el.matches && el.matches("footer")) {
            msg = "Llegaste al final 👋";
        }
        if (msg) { lastReact = ts; speak(msg); }
    }

    // Se ejecuta al aterrizar: squash de impacto + posible reacción.
    function onLand(plat, ts) {
        if (pet) {
            pet.classList.remove("mascot-land");
            void pet.offsetWidth;
            pet.classList.add("mascot-land");
        }
        reactTo(plat, ts);
    }

    // Empieza a caminar en una dirección durante un tiempo.
    function walk(dir, ms, ts) {
        phys.vx = dir * WALK;
        phys.face = dir < 0 ? -1 : 1;
        nextDecision = ts + ms;
    }

    // Salto simple: impulso vertical fijo. El aterrizaje lo resuelve la física.
    function jump(ts) {
        if (!phys.ground) return;
        phys.vy = JUMP_VY;
        phys.ground = null;
        nextDecision = ts + 600;
    }

    // Busca una repisa MÁS ALTA que la actual, alcanzable de un salto (por altura
    // y por distancia horizontal), para "trepar" la estructura de la página.
    function reachableTarget() {
        var list = scanPlatforms();
        var cx = phys.x + phys.w / 2;
        var maxRise = (JUMP_MAX * JUMP_MAX) / (2 * GRAV);   // altura máx alcanzable
        var best = null, bestScore = Infinity;
        for (var i = 0; i < list.length; i++) {
            var p = list[i];
            if (p === phys.ground) continue;
            var rise = phys.y - p.top;                       // cuánto hay que subir
            if (rise < 12 || rise > maxRise) continue;       // ni plana ni imposible
            var tx = Math.max(p.left, Math.min(cx, p.right)); // punto más cercano
            var dx = Math.abs(tx - cx);
            if (dx > 320) continue;                          // demasiado lejos
            var score = rise + dx * 0.6;                     // prioriza cerca y bajo
            if (score < bestScore) { bestScore = score; best = p; }
        }
        return best;
    }

    // Salto dirigido hacia una repisa concreta: calcula el impulso justo para
    // superar su altura y se orienta hacia ella. La física + landingFor la posan.
    function hopTo(plat, ts) {
        if (!phys.ground) return;
        var cx = phys.x + phys.w / 2;
        var tx = Math.max(plat.left, Math.min(cx, plat.right));
        var rise = phys.y - plat.top + 26;                  // + holgura para pasarla
        var vy = Math.min(JUMP_MAX, Math.sqrt(2 * GRAV * Math.max(rise, 20)));
        phys.vy = -vy;
        var dir = tx < cx ? -1 : (tx > cx ? 1 : (Math.random() < 0.5 ? -1 : 1));
        phys.vx = dir * WALK * 1.4;
        phys.face = dir < 0 ? -1 : 1;
        phys.ground = null;
        nextDecision = ts + 700;
    }

    // "Cerebro": decide la próxima acción cuando está parado y no está ocupado.
    function decide(ts) {
        var cx = phys.x + phys.w / 2;
        var mouseFresh = mouse.x >= 0 && ts - mouse.t < 2500;
        var r = Math.random();

        if (mouseFresh && r < 0.28) {
            // Seguir el cursor: camina hacia su X (y salta si está más arriba).
            var dir = mouse.x < cx ? -1 : 1;
            walk(dir, rand(700, 1400), ts);
            if (mouse.y < phys.y - 20 && Math.random() < 0.5) jump(ts);
        } else if (r < 0.55) {
            // Deambular: dirección al azar (o hacia el centro si está en un borde).
            var d = cx < window.innerWidth * 0.15 ? 1 :
                    cx > window.innerWidth * 0.85 ? -1 : (Math.random() < 0.5 ? -1 : 1);
            walk(d, rand(800, 1800), ts);
            if (Math.random() < 0.3) jump(ts); // saltito exploratorio
        } else if (r < 0.72) {
            // Trepar: si hay una repisa alcanzable más arriba, salta hacia ella;
            // si no, un salto simple exploratorio.
            var target = reachableTarget();
            if (target) hopTo(target, ts); else jump(ts);
        } else {
            // Descansar un momento.
            phys.vx = 0;
            nextDecision = ts + rand(900, 2200);
        }
    }

    // Susto: si el cursor se mete muy cerca y en movimiento, pega un salto para
    // el lado contrario (con cooldown para que no sea epiléptico).
    function maybeFlee(ts) {
        if (!phys.ground || ts - lastFlee < 1500) return;
        if (mouse.x < 0 || ts - mouse.t > 400) return;
        var cx = phys.x + phys.w / 2, cy = phys.y + phys.h / 2;
        if (Math.hypot(mouse.x - cx, mouse.y - cy) > phys.w * 0.9) return;
        lastFlee = ts;
        var dir = mouse.x < cx ? 1 : -1; // huir del cursor
        phys.face = dir < 0 ? -1 : 1;
        phys.vx = dir * WALK * 1.8;
        phys.vy = JUMP_VY * 0.85;
        phys.ground = null;
        nextDecision = ts + 700;
        setExpr("surprised");
        setTimeout(function () { if (currentExpr === "surprised") setExpr("normal"); }, 500);
    }

    // Un paso de simulación.
    function step(dt, ts) {
        var W = window.innerWidth;

        // Decisiones y reacciones solo cuando está parado y sin bocadillo activo.
        if (ts >= attentionUntil) {
            maybeFlee(ts);
            if (phys.ground && ts >= nextDecision) decide(ts);
        } else {
            phys.vx = 0; // "viene a hablarte": se queda quieto mientras dice algo
        }

        // Mirar hacia el cursor cuando está quieto.
        if (!phys.vx && mouse.x >= 0 && ts - mouse.t < 3000) {
            phys.face = mouse.x < (phys.x + phys.w / 2) ? -1 : 1;
        }

        // Horizontal + rebote contra los bordes de la ventana.
        phys.x += phys.vx * dt;
        if (phys.x < MARGIN) { phys.x = MARGIN; phys.vx = Math.abs(phys.vx); phys.face = 1; }
        var maxX = W - phys.w - MARGIN;
        if (phys.x > maxX) { phys.x = maxX; phys.vx = -Math.abs(phys.vx); phys.face = -1; }

        // Vertical: si está apoyado, comprueba que no se pasó del borde (si sí,
        // cae); si está en el aire, integra gravedad y busca dónde aterrizar.
        var prevY = phys.y, cx = phys.x + phys.w / 2;
        if (phys.ground) {
            if (cx < phys.ground.left - 3 || cx > phys.ground.right + 3) {
                phys.ground = null; // caminó fuera de la repisa → cae
            } else {
                phys.y = phys.ground.top;
            }
        }
        if (!phys.ground) {
            phys.vy += GRAV * dt;
            phys.y += phys.vy * dt;
            if (phys.vy > 0) {
                var land = landingFor(prevY, phys.y, cx);
                if (land) { phys.y = land.top; phys.vy = 0; phys.ground = land; onLand(land, ts); }
            }
        }

        place(phys.x, phys.y);
        applyFace();
    }

    function tick(ts) {
        // Solo reagenda mientras el motor está activo: si se detuvo (pestaña
        // oculta, paseo apagado, DOM removido) el bucle muere en vez de girar.
        if (!running || !phys) { rafId = null; return; }
        rafId = requestAnimationFrame(tick);

        // Mientras se arrastra, el usuario manda: sincronizamos la física con el
        // DOM y no simulamos (al soltar, endDrag la deja caer y aterrizar).
        if (drag) {
            var rr = root.getBoundingClientRect();
            phys.x = rr.left; phys.y = rr.top; phys.vx = 0; phys.vy = 0;
            phys.ground = null; lastT = ts;
            return;
        }

        if (!lastT) lastT = ts;
        var dt = Math.min(0.05, (ts - lastT) / 1000); // clamp para saltos de pestaña
        lastT = ts;
        if (dt > 0) step(dt, ts);
    }

    function startEngine() {
        if (!root || running || !roamEnabled()) return;
        var r = root.getBoundingClientRect();
        phys = { x: r.left, y: r.top, vx: 0, vy: 0, w: root.offsetWidth || 72,
                 h: root.offsetHeight || 66, face: 1, ground: null };
        root.classList.add("mascot-roaming");
        running = true;
        lastT = 0;
        nextDecision = performance.now() + 600;
        wireMouse();
        if (rafId == null) rafId = requestAnimationFrame(tick);
    }

    function stopEngine() {
        running = false;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
        if (root) root.classList.remove("mascot-roaming");
        var svg = pet && pet.firstChild;
        if (svg && svg.style) svg.style.transform = ""; // vuelve a mirar de frente
        phys = null;
    }

    function wireMouse() {
        if (mouseWired) return;
        mouseWired = true;
        window.addEventListener("mousemove", function (e) {
            mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now();
        }, { passive: true });
        // Pausar el motor cuando la pestaña no se ve (ahorra batería/CPU).
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) {
                if (running) { running = false; if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }
            } else if (root && roamEnabled() && !running) {
                startEngine();
            }
        });
    }

    // API para configuración: encender/apagar el paseo en vivo.
    function setRoaming(on) {
        try { localStorage.setItem(ROAM_KEY, on ? "on" : "off"); } catch (_) {}
        if (on) { if (root) startEngine(); }
        else { stopEngine(); }
    }

    function removeDom() {
        if (!root) return;
        stopEngine();
        clearTimeout(hideTimer);
        clearTimeout(blinkTimer);
        clearTimeout(loveTimer);
        clearInterval(sleepTimer);
        sleeping = false;
        root.remove();
        root = pet = bubble = bubbleText = zzz = null;
    }

    // Parpadeo ocasional en reposo: da vida sin ser molesto.
    function scheduleBlink() {
        clearTimeout(blinkTimer);
        if (reducedMotion() || sleeping) return;
        var delay = 3500 + Math.random() * 4000;
        blinkTimer = setTimeout(function () {
            if (pet && !sleeping && !bubble.classList.contains("is-visible")) {
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

    // Muestra el bocadillo con un texto y reinicia la animación de "hablar".
    // Mientras el slime habla, se detiene su paseo para que "venga a decirte".
    function showBubble(message, dur) {
        // Si llega algo que decir mientras duerme, despierta sin el respingo
        // (la cara ya la fijó quien llama a hablar).
        if (sleeping) {
            sleeping = false;
            root.classList.remove("mascot-sleeping");
            attentionUntil = 0;
            lastActivity = performance.now();
        }
        bubbleText.textContent = String(message);
        bubble.classList.remove("is-leaving");
        // Reinicia la animación de "hablar".
        pet.classList.remove("mascot-talking");
        void pet.offsetWidth; // reflow para reiniciar la animación
        pet.classList.add("mascot-talking");

        requestAnimationFrame(function () {
            bubble.classList.add("is-visible");
        });

        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideBubble, dur);

        // Pausa el paseo mientras hay algo en pantalla que leer.
        pauseRoam(dur);

        // Al salir el mouse, reanuda el cierre con la mitad del tiempo.
        bubble.onmouseleave = pet.onmouseleave = function () {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideBubble, dur / 2);
        };
    }

    function say(message, type, duration) {
        if (!isEnabled()) return;
        ensureDom();
        setExpr(TYPE_FACE[type] || "normal");
        showBubble(message, duration || DURATION());
    }

    // Reacción espontánea del slime al posarse sobre un elemento de la página.
    function speak(message, expr) {
        if (!bubble || bubble.classList.contains("is-visible")) return;
        setExpr(expr || "happy");
        showBubble(message, DURATION());
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

    // ── Corazones flotantes (feedback de cariño) ───────────────────────────
    // Suelta unos corazones que suben y se desvanecen desde el slime. Puro CSS
    // para la animación; JS solo los crea y los limpia al terminar.
    function emitHearts(n) {
        if (!root || reducedMotion()) return;
        for (var i = 0; i < n; i++) {
            (function (i) {
                var h = document.createElement("span");
                h.className = "mascot-heart";
                h.setAttribute("aria-hidden", "true");
                h.textContent = "❤";
                // Dispersión horizontal y arranque escalonado por corazón.
                h.style.setProperty("--hx", (Math.random() * 40 - 20).toFixed(0) + "px");
                h.style.animationDelay = (i * 90) + "ms";
                h.addEventListener("animationend", function () { h.remove(); });
                root.appendChild(h);
            })(i);
        }
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

    // Saludos según la página: el slime "sabe" dónde estás y lo comenta.
    var PAGE_GREETINGS = {
        "index":         ["¡Bienvenido a Anime Destiny! ✨", "¿Descubrimos algo nuevo hoy?"],
        "anime":         ["¿Qué anime maratoneamos? 🍿", "¡Buenísimo el catálogo de hoy!"],
        "manga":         ["¿Un buen manga para leer? 📖", "Pasá página conmigo 📚"],
        "novelas":       ["¿Nos clavamos una novela? 📓", "Historias largas, las mejores ✨"],
        "detalle":       ["¿Te tiño esta ficha de tu color? 🎨", "¿A tu lista con esta?"],
        "mis-listas":    ["¡Ordenemos tus listas! 🗂️", "¿Qué seguís viendo?"],
        "ranking":       ["¡Al top del ranking! 🏆", "¿Quién manda hoy?"],
        "top":           ["Los más grandes de todos 🏆", "¿Coincidís con el top?"],
        "comparar":      ["Enfrentá dos obras ⚔️", "¿Cuál gana el duelo?"],
        "configuracion": ["Toqueteá los ajustes 🛠️", "¿Me apagás? ¡No seas malo! 🥺"]
    };

    // Nombre de la página actual (sin extensión) para elegir el saludo.
    function currentPage() {
        try {
            var p = (location.pathname.split("/").pop() || "index").toLowerCase();
            p = p.replace(/\.html?$/, "");
            return p || "index";
        } catch (_) { return "index"; }
    }

    // Pool de saludos: los de la página + los genéricos, sin repetir.
    function greetingPool() {
        var page = PAGE_GREETINGS[currentPage()] || [];
        return page.concat(GREETINGS);
    }
    var greetIdx = 0;

    // Frases de cariño cuando lo miman varias veces seguidas.
    var LOVE_LINES = ["¡Me hacés cosquillas! 😆", "¡Te quiero! ❤", "¡Blop blop! 💕", "¡Más mimos, más! 🥰"];

    function onPetClick() {
        // Si el click viene de terminar un arrastre, no saludar.
        if (justDragged) { justDragged = false; return; }
        wakeUp();

        var now = performance.now();
        // Mimos encadenados: si tocás rápido varias veces, el slime se enamora.
        petStreak = (now - lastPetAt < 1600) ? petStreak + 1 : 1;
        lastPetAt = now;

        if (petStreak >= 3) {
            setExpr("love");
            emitHearts(Math.min(3 + petStreak, 7));
            showBubble(pick(LOVE_LINES), DURATION());
            clearTimeout(loveTimer);
            loveTimer = setTimeout(function () {
                if (currentExpr === "love") setExpr("normal");
            }, DURATION());
            return;
        }

        setExpr("happy");
        var pool = greetingPool();
        showBubble(pool[greetIdx % pool.length], DURATION());
        greetIdx++;
    }

    // ── Sueño por inactividad ──────────────────────────────────────────────
    // Tras un rato sin actividad del usuario, el slime cabecea y se duerme con
    // un "Zzz". Cualquier interacción (mover el mouse, teclear, tocarlo) lo
    // despierta con un pequeño respingo.
    var activityWired = false; // para no duplicar listeners al reactivar la mascota
    function wireActivity() {
        lastActivity = performance.now();
        clearInterval(sleepTimer);
        sleepTimer = setInterval(checkIdle, 5000);
        if (activityWired) return;
        activityWired = true;
        var mark = function () { lastActivity = performance.now(); wakeUp(); };
        var opts = { passive: true };
        window.addEventListener("mousemove", mark, opts);
        window.addEventListener("keydown", mark, opts);
        window.addEventListener("scroll", mark, opts);
        window.addEventListener("touchstart", mark, opts);
        window.addEventListener("pointerdown", mark, opts);
    }

    function checkIdle() {
        if (sleeping || !root) return;
        if (bubble && bubble.classList.contains("is-visible")) return; // hablando
        if (drag) return;                                              // en la mano
        if (performance.now() - lastActivity < IDLE_SLEEP_MS) return;
        goToSleep();
    }

    function goToSleep() {
        if (sleeping || !root) return;
        sleeping = true;
        clearTimeout(blinkTimer);
        if (phys) { phys.vx = 0; phys.face = 1; applyFace(); }
        pauseRoam(3.6e6); // no deambula mientras duerme (se corta al despertar)
        setExpr("sleep");
        root.classList.add("mascot-sleeping");
    }

    function wakeUp() {
        if (!sleeping) return;
        sleeping = false;
        root.classList.remove("mascot-sleeping");
        attentionUntil = 0; // corta la pausa larga del paseo
        lastActivity = performance.now();
        // Pequeño respingo al despertar y vuelta a la normalidad.
        setExpr("surprised");
        setTimeout(function () { if (currentExpr === "surprised" && !sleeping) setExpr("normal"); }, 550);
        scheduleBlink();
        if (phys) nextDecision = performance.now() + 700;
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
        isEnabled: isEnabled,
        setRoaming: setRoaming,
        isRoaming: roamPref
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
