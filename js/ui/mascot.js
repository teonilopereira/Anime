/**
 * mascot.js
 * Mascota 2D (Rimuru, el slime de "Tensei Shitara Slime Datta Ken") que vive en
 * una esquina de la pantalla y, cuando está activada, ANUNCIA las notificaciones
 * "hablando" por un bocadillo en vez de mostrar el toast clásico. Envuelve a
 * window.Toast: si la mascota está apagada, delega en el toast de siempre; si
 * está encendida, Rimuru habla.
 *
 * El sprite es pixel-art animado a partir de un spritesheet (8×5 celdas de
 * 96×96) embebido como data-URI, así no dependemos de ningún asset externo.
 * Las "expresiones" y estados (reposo, caminar, salto, festejo…) se consiguen
 * eligiendo el grupo de fotogramas y desplazando el background-position.
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

    // ── Spritesheet ─────────────────────────────────────────────────────────
    // Hoja de 8 columnas × 5 filas, celdas de 96×96, con el personaje anclado
    // al PIE (borde inferior de cada celda). Embebida como data-URI (PNG
    // indexado de 8 colores) para no depender de ningún asset externo.
    var SHEET_COLS = 8, SHEET_ROWS = 5;
    var SHEET_SRC = "data:image/png;base64,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";

    // Grupos de fotogramas por estado/expresión (índices en la hoja, 0..35):
    //  fila0 0-7  reposo/respiración · fila1 8-15 alt · fila2 16-17 brazos
    //  arriba (festejo), 18-20 embestida, 21-23 recompone · fila3 24-31 caminar
    //  · fila4 32-35 agazapado.
    var ANIMS = {
        idle:      { f: [0, 1, 2, 3, 4, 5, 6, 7], fps: 8 },
        walk:      { f: [24, 25, 26, 27, 28, 29, 30, 31], fps: 11 },
        air:       { f: [17], fps: 1 },              // salto (brazos arriba)
        happy:     { f: [16, 17], fps: 6 },          // festejo
        love:      { f: [16, 17], fps: 7 },
        surprised: { f: [17], fps: 1 },
        sad:       { f: [32, 33], fps: 3 },          // agazapado
        sleep:     { f: [5], fps: 1 }                // pose baja, "asentado"
    };
    // Expresiones que mandan sobre el estado de movimiento mientras están activas.
    var EXPR_ANIM = {
        happy: "happy", love: "love", surprised: "surprised", sad: "sad"
    };

    // Cada tipo de notificación se mapea a una expresión.
    var TYPE_FACE = {
        success: "happy",
        error: "sad",
        warning: "surprised",
        info: "normal"
    };

    // ── Personajes seleccionables ─────────────────────────────────────────────
    // Rimuru es el personaje embebido por defecto (modo 'sheet': un spritesheet
    // con índices de fotogramas). Otras mascotas — generadas con PixelLab por
    // tools/generate-mascots.js — se publican en window.MascotRegistry y usan el
    // modo 'frames': cada animación es una lista de imágenes que se intercambian.
    var CHAR_KEY = "pref:mascotChar";
    var RIMURU = {
        id: "rimuru", name: "Rimuru", anime: "Tensei Slime",
        mode: "sheet", src: SHEET_SRC, cols: SHEET_COLS, rows: SHEET_ROWS, anims: ANIMS
    };
    // Personajes seleccionables: los históricos de window.MascotRegistry
    // (js/ui/mascots.js) más los de window.CharacterRegistry (js/ui/characters.js,
    // generado por tools/slice-characters.py). Se concatenan en un único listado.
    function registry() {
        var m = Array.isArray(window.MascotRegistry) ? window.MascotRegistry : [];
        var c = Array.isArray(window.CharacterRegistry) ? window.CharacterRegistry : [];
        return m.concat(c);
    }
    function allChars() { return [RIMURU].concat(registry()); }
    function readChar() { try { return localStorage.getItem(CHAR_KEY) || "rimuru"; } catch (_) { return "rimuru"; } }
    function findChar(id) {
        var l = allChars();
        for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
        return RIMURU;
    }

    // Modo de render y, en modo 'frames', las listas de imágenes por animación.
    var MASCOT_MODE = "sheet";
    var FRAME_IMGS = null;
    // Ruta del sprite de proyectil del personaje activo (si trae 'attack' con
    // efecto propio); "" cuando no tiene y el golpe usa la marca de corte CSS.
    var MASCOT_PROJECTILE = "";

    // Deriva un mapa ANIMS (índice+fps por estado) desde las listas de frames.
    function framesToAnims(f) {
        var out = {};
        for (var k in f) {
            if (!f.hasOwnProperty(k) || !f[k] || !f[k].length) continue;
            var seq = [];
            for (var i = 0; i < f[k].length; i++) seq.push(i);
            out[k] = { f: seq, fps: (k === "walk" ? 10 : 6) };
        }
        if (!out.idle) out.idle = { f: [0], fps: 1 };
        if (!out.walk) out.walk = out.idle;
        if (!out.air)  out.air  = { f: [out.idle.f[0]], fps: 1 };
        return out;
    }

    // Aplica un personaje: fija modo, hoja/frames y ANIMS. Si el sprite ya existe
    // en el DOM, repinta al vuelo (permite cambiar de mascota sin recargar).
    function applyChar(id) {
        var c = findChar(id);
        MASCOT_PROJECTILE = c.projectile || "";
        MASCOT_MODE = c.mode === "frames" ? "frames" : "sheet";
        if (MASCOT_MODE === "frames") {
            FRAME_IMGS = c.frames || {};
            ANIMS = c.anims || framesToAnims(FRAME_IMGS);
        } else {
            SHEET_SRC  = c.src  || RIMURU.src;
            SHEET_COLS = c.cols || 8;
            SHEET_ROWS = c.rows || 5;
            ANIMS = c.anims || RIMURU.anims;
        }
        if (sprite) {
            if (MASCOT_MODE === "frames") {
                sprite.style.backgroundSize = "100% 100%";
                sprite.style.backgroundPosition = "center bottom";
                // Sprites de anime (con antialiasing): se ven mejor suavizados al
                // escalar que con nearest-neighbor. Rimuru (pixel-art) sí quiere
                // pixelado, así que solo el modo 'frames' pisa el image-rendering.
                sprite.style.imageRendering = "auto";
            } else {
                sprite.style.backgroundImage = "url(" + SHEET_SRC + ")";
                sprite.style.backgroundSize = "";      // vuelve al valor del CSS (800% 500%)
                sprite.style.backgroundPosition = "0 0";
                sprite.style.imageRendering = "";      // vuelve a 'pixelated' del CSS
            }
            animName = null; animFrame = -1; _lastFrameKey = "";
            setFrame(0, "idle");
        }
    }

    // ── Animador de fotogramas ───────────────────────────────────────────────
    // Un único rAF desplaza el background-position del <div.mascot-sprite> según
    // el grupo activo. El grupo sale de: dormido → 'sleep'; si hay expresión
    // especial → esa; si no, del estado de movimiento que fija la física
    // (motionAnim: 'idle' | 'walk' | 'air').
    var motionAnim = "idle";
    var animRAF = null, animStart = 0, animName = null, animFrame = -1;
    var _lastFrameKey = "";  // dedupe en modo 'frames' (nombre+idx)

    function activeAnim() {
        if (sleeping) return "sleep";
        // El golpe manda sobre expresión y movimiento mientras dura (solo las
        // mascotas que traen animación 'attack', p. ej. las de Bleach).
        if (attacking && ANIMS.attack) return "attack";
        var e = EXPR_ANIM[currentExpr];
        if (e) return e;
        return motionAnim;
    }

    // Coloca el fotograma `idx` (0..35) moviendo el fondo. Con background-size
    // de 800%×500% y el elemento del tamaño de UNA celda, la posición en % es
    // col/(cols-1) y row/(rows-1).
    function setFrame(idx, name) {
        if (!sprite) return;
        // Modo 'frames' (mascotas generadas): cada fotograma es una imagen
        // distinta; `idx` es la posición dentro de la lista de esa animación.
        if (MASCOT_MODE === "frames") {
            var list = (FRAME_IMGS && (FRAME_IMGS[name] || FRAME_IMGS.idle)) || [];
            var src = list[idx] || list[0];
            if (src) sprite.style.backgroundImage = "url(" + src + ")";
            return;
        }
        // Modo 'sheet' (Rimuru): se desplaza el background-position dentro de la
        // hoja. Con background-size cols×rows y el elemento del tamaño de UNA
        // celda, la posición en % es col/(cols-1) y row/(rows-1).
        var col = idx % SHEET_COLS, row = (idx / SHEET_COLS) | 0;
        var px = SHEET_COLS > 1 ? (col / (SHEET_COLS - 1)) * 100 : 0;
        var py = SHEET_ROWS > 1 ? (row / (SHEET_ROWS - 1)) * 100 : 0;
        sprite.style.backgroundPosition = px + "% " + py + "%";
    }

    function animTick(ts) {
        if (!sprite) { animRAF = null; return; }
        animRAF = requestAnimationFrame(animTick);
        var name = activeAnim();
        var a = ANIMS[name] || ANIMS.idle;
        if (name !== animName) { animName = name; animStart = ts; }
        // Con movimiento reducido, congelamos en el primer fotograma del estado.
        var i = reducedMotion() ? 0 : Math.floor((ts - animStart) * a.fps / 1000) % a.f.length;
        var frame = a.f[i];
        if (MASCOT_MODE === "frames") {
            // El índice de frame se repite entre animaciones (idle[0], walk[0]…):
            // hay que redibujar también cuando cambia la animación, no solo el idx.
            var key = name + ":" + frame;
            if (key !== _lastFrameKey) { _lastFrameKey = key; animFrame = frame; setFrame(frame, name); }
        } else if (frame !== animFrame) {
            animFrame = frame; setFrame(frame, name);
        }
    }

    function startAnim() {
        if (animRAF != null) return;
        animName = null; animFrame = -1;
        animStart = performance.now();
        animRAF = requestAnimationFrame(animTick);
    }

    function stopAnim() {
        if (animRAF != null) { cancelAnimationFrame(animRAF); animRAF = null; }
    }

    // ── DOM ────────────────────────────────────────────────────────────────
    var root = null;     // contenedor fijo
    var pet = null;      // el botón que contiene al sprite
    var sprite = null;   // <div> con el spritesheet de fondo
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

    // ── Ataque a elementos de la página ────────────────────────────────────
    // De vez en cuando, las mascotas con animación 'attack' (las de Bleach) se
    // orientan hacia un elemento real cercano (card, título, navbar…), pegan el
    // golpe y le aplican un "impacto": el elemento tiembla y aparece una marca
    // de corte encima. Rimuru no tiene 'attack', así que nunca ataca.
    var attacking = false;   // reproduciendo el golpe ahora mismo
    var attackUntil = 0;     // fin del golpe actual (timestamp)
    var attackTarget = null; // { el, rect, cx, cy } del blanco en curso
    var attackHit = false;   // ya se aplicó el impacto de este golpe (una vez)
    var lastAttack = 0;      // cooldown entre golpes

    // Fija la expresión: el animador de fotogramas reflejará el cambio en el
    // próximo frame (ya no se redibuja nada a mano).
    function setExpr(expr) {
        currentExpr = expr;
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
        pet.setAttribute("aria-label", "Rimuru — tu mascota slime. Tocá para saludar.");
        sprite = document.createElement("div");
        sprite.className = "mascot-sprite";
        sprite.setAttribute("aria-hidden", "true");
        pet.appendChild(sprite);
        // Pinta el personaje elegido (Rimuru por defecto): imagen, modo y 1er frame.
        applyChar(readChar());
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
        startAnim();
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
                phys.x = r.left; phys.y = r.top; phys.vx = 0; phys.vy = 0; phys.tvx = 0;
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
    var ACCEL = 950;         // aceleración horizontal en el piso (px/s²): el slime
                             // no salta de golpe a la velocidad máxima, arranca y
                             // frena de a poco → paso a paso más natural y con
                             // "fricción" al aterrizar.
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

    // Elementos "atacables": lo visible y con entidad de la página. Se filtran
    // luego por tamaño, visibilidad y cercanía a la mascota.
    var ATTACK_SEL = [
        ".catalog-neon-card", ".card-container", ".card", ".hero-section",
        ".cfg-panel", "h1.title", "h2.title", ".section-title",
        ".destiny-navbar", ".mobile-bottom-nav"
    ].join(",");
    var ATTACK_MS = 720;          // cuánto dura la animación del golpe
    var ATTACK_COOLDOWN = 12000;  // tiempo mínimo entre golpes ("de vez en cuando")
    var ATTACK_CHANCE = 0.5;      // probabilidad de atacar cuando ya pasó el cooldown
    var ATTACK_RANGE = 200;       // alcance horizontal (px) para elegir blanco

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
        if (phys) phys.tvx = 0; // frena suave (la física lo lleva a 0 en step)
    }

    // Aplica el "mirar hacia" (flip horizontal) sobre el sprite, sin pelear con
    // las animaciones de la mascota (talk/land viven en .mascot-pet; el flip, en
    // .mascot-sprite).
    function applyFace() {
        if (sprite && sprite.style) sprite.style.transform = "scaleX(" + ((phys && phys.face) || 1) + ")";
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

    // Empieza a caminar en una dirección durante un tiempo. Fija una velocidad
    // OBJETIVO (con una pizca de variación para que el andar no sea metronómico);
    // la física acelera hacia ella suavemente en step().
    function walk(dir, ms, ts) {
        phys.tvx = dir * WALK * rand(0.85, 1.12);
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
        phys.vx = dir * WALK * 1.4;      // impulso balístico durante el salto
        phys.tvx = 0;                    // al posarse en la repisa se asienta (frena)
        phys.face = dir < 0 ? -1 : 1;
        phys.ground = null;
        nextDecision = ts + 700;
    }

    // ── Ataque a objetos de la página ──────────────────────────────────────
    // Frases al atacar, según el personaje activo.
    var ATTACK_LINES = {
        ichigo:    ["¡Getsuga Tenshō! ⚔️", "¡Toma esto!", "¡Hyah!"],
        kenpachi:  ["¡A cortar! ⚔️", "¡Nada mal!", "¡Toma esto!"],
        aurora:    ["¡Destello floral! 🌸", "¡Brilla!", "¡Hyah!"],
        escarlata: ["¡Tormenta escarlata! 🌪️", "¡No escaparás!", "¡Toma!"],
        nix:       ["¡Fuego cruzado! 🔫", "¡A cubierto!", "¡Bang!"],
        corvina:   ["¡Descarga! ⚡", "¡Se acabó!", "¡Toma esto!"],
        kitsune:   ["¡Fuego zorruno! 🦊", "¡Kon!", "¡Ardé!"],
        vampi:     ["¡Zarpazo nocturno! 🦇", "¡Sangre!", "¡Hyah!"],
        marea:     ["¡Marea alta! 🌊", "¡Ola va!", "¡Splash!"],
        infernal:  ["¡Llama infernal! 🔥", "¡Ardé!", "¡Toma esto!"],
        kurenai:   ["¡Corte carmesí! ⚔️", "¡Silencio!", "¡Hyah!"],
        kazuha:    ["¡Filo del viento! 🍃", "¡Rápido como el viento!", "¡Toma!"],
        diablilla: ["¡Travesura! 😈", "¡Jiji!", "¡Toma esto!"],
        valkiria:  ["¡Alas de guerra! 🪽", "¡Cae!", "¡Hyah!"]
    };
    function attackLine() {
        return pick(ATTACK_LINES[readChar()] || ["¡Hyah!"]);
    }

    // ¿El personaje activo sabe atacar? (tiene fotogramas de 'attack').
    function hasAttack() {
        return !!(ANIMS && ANIMS.attack && ANIMS.attack.f && ANIMS.attack.f.length);
    }

    // Elige el elemento atacable más cercano a la mascota (o null). Debe estar a
    // la vista, con tamaño suficiente y cerca en horizontal y en altura.
    function findAttackTarget() {
        var els = document.querySelectorAll(ATTACK_SEL);
        var cx = phys.x + phys.w / 2, feet = phys.y + phys.h;
        var W = window.innerWidth, H = window.innerHeight;
        var best = null, bestD = Infinity;
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el === root || root.contains(el) || el.contains(root)) continue;
            var r = el.getBoundingClientRect();
            if (r.width < 24 || r.height < 16) continue;          // muy chico
            if (r.right < 0 || r.left > W || r.bottom < 0 || r.top > H) continue; // fuera de vista
            var nx = Math.max(r.left, Math.min(cx, r.right));
            var dx = Math.abs(nx - cx);
            if (dx > ATTACK_RANGE) continue;                       // lejos en X
            if (feet < r.top - 140 || feet > r.bottom + 90) continue; // muy arriba/abajo
            var ny = Math.max(r.top, Math.min(feet, r.bottom));
            var d = dx + Math.abs(ny - feet) * 0.5;
            if (d < bestD) {
                bestD = d;
                best = { el: el, rect: r, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 };
            }
        }
        return best;
    }

    // ¿Toca atacar ahora? (sabe atacar, no está ocupado y ya pasó el cooldown).
    function canAttack(ts) {
        return hasAttack() && !attacking && !sleeping &&
            ts - lastAttack > ATTACK_COOLDOWN && Math.random() < ATTACK_CHANCE;
    }

    // Arranca el golpe: mira al blanco, pega un pequeño lunge y fija el estado
    // 'attacking' (que el animador refleja con la animación 'attack').
    function startAttack(t, ts) {
        attacking = true;
        attackHit = false;
        attackTarget = t;
        attackUntil = ts + ATTACK_MS;
        lastAttack = ts;
        var cx = phys.x + phys.w / 2;
        var dir = t.cx < cx ? -1 : 1;
        phys.face = dir;
        phys.tvx = 0;
        if (phys.ground) phys.vx = dir * WALK * 1.1;   // impulso hacia el blanco
        nextDecision = attackUntil + 300;
        attentionUntil = Math.max(attentionUntil, attackUntil); // no deambular durante el golpe
        // El proyectil sale un instante después (deja ver la pose de ataque) y
        // aterriza justo cuando se aplica el impacto (a ~55% de la animación).
        if (MASCOT_PROJECTILE) {
            var travel = ATTACK_MS * 0.45;
            setTimeout(function () { launchProjectile(t, travel); }, ATTACK_MS * 0.1);
        }
        if (Math.random() < 0.5) speak(attackLine(), "happy");
    }

    // Lanza el sprite de proyectil del personaje activo desde donde está la
    // mascota hacia el blanco. Vuela durante 'travelMs' y se autodestruye. Solo
    // se usa cuando el personaje trae 'projectile'; si no, el golpe se resuelve
    // con la marca de corte CSS en hitElement.
    function launchProjectile(t, travelMs) {
        if (!MASCOT_PROJECTILE || !t || reducedMotion() || !root) return;
        var from = root.getBoundingClientRect();
        var sx = from.left + from.width / 2;
        var sy = from.top + from.height * 0.45;   // a la altura de las manos
        var tx = t.cx, ty = t.cy;
        var ang = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;
        var size = Math.min(Math.max(from.width * 0.9, 46), 120);

        var img = document.createElement("img");
        img.className = "mascot-projectile";
        img.src = MASCOT_PROJECTILE;
        img.setAttribute("aria-hidden", "true");
        img.style.width = size + "px";
        img.style.left = (sx - size / 2) + "px";
        img.style.top = (sy - size / 2) + "px";
        // El sprite mira a la derecha; se voltea si el blanco está a la izquierda
        // y se orienta hacia él.
        var flip = tx < sx ? -1 : 1;
        img.style.transform = "translate3d(0,0,0) rotate(" + ang + "deg) scaleX(" + flip + ")";
        document.body.appendChild(img);

        // Fuerza reflow y arranca la transición hacia el blanco.
        void img.offsetWidth;
        img.style.transition = "transform " + travelMs + "ms cubic-bezier(0.35,0.15,0.6,1), opacity " + travelMs + "ms ease-in";
        img.style.transform = "translate3d(" + (tx - sx) + "px," + (ty - sy) + "px,0) rotate(" + ang + "deg) scaleX(" + flip + ")";
        setTimeout(function () { img.style.opacity = "0"; }, Math.max(0, travelMs - 90));
        setTimeout(function () { img.remove(); }, travelMs + 140);
    }

    // Impacto: sacude el elemento golpeado y dibuja una marca de corte encima.
    // Si el personaje trae proyectil, el efecto de corte se omite (ya voló el
    // sprite del proyectil desde startAttack) y solo se aplica la sacudida.
    function hitElement(t) {
        if (!t || !t.el) return;
        var el = t.el;
        el.classList.remove("mascot-hit");
        void el.offsetWidth;             // reinicia la animación de sacudida
        el.classList.add("mascot-hit");
        setTimeout(function () { el.classList.remove("mascot-hit"); }, 520);

        if (reducedMotion()) return;     // sin efectos extra con movimiento reducido
        if (MASCOT_PROJECTILE) return;   // el golpe ya lo marca el proyectil
        var r = el.getBoundingClientRect();
        var size = Math.min(Math.max(Math.min(r.width, r.height) * 0.9, 60), 190);
        var slash = document.createElement("div");
        slash.className = "mascot-slash";
        // Rojo Getsuga para Ichigo; blanco para el corte de Kenpachi.
        slash.style.setProperty("--slash-color", readChar() === "ichigo" ? "#ff2d55" : "#eafff8");
        slash.style.left = (r.left + r.width / 2 - size / 2) + "px";
        slash.style.top = (r.top + r.height / 2 - size / 2) + "px";
        slash.style.width = size + "px";
        slash.style.height = size + "px";
        slash.setAttribute("aria-hidden", "true");
        slash.addEventListener("animationend", function () { slash.remove(); });
        document.body.appendChild(slash);
    }

    // Avanza el golpe en curso: aplica el impacto a mitad de la animación (una
    // sola vez) y lo termina cuando vence su tiempo.
    function stepAttack(ts) {
        if (!attacking) return;
        if (!attackHit && ts >= attackUntil - ATTACK_MS * 0.45) {
            attackHit = true;
            hitElement(attackTarget);
        }
        if (ts >= attackUntil) {
            attacking = false;
            attackTarget = null;
            if (phys) phys.tvx = 0;
        }
    }

    // "Cerebro": decide la próxima acción cuando está parado y no está ocupado.
    function decide(ts) {
        // Antes que nada: de vez en cuando, atacar un objeto cercano de la página.
        if (canAttack(ts)) {
            var target = findAttackTarget();
            if (target) { startAttack(target, ts); return; }
        }

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
            // Descansar un momento (frena suave hacia 0).
            phys.tvx = 0;
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
        phys.vx = dir * WALK * 1.8;      // salto de susto (impulso)
        phys.tvx = 0;                    // al caer, frena el correteo del susto
        phys.vy = JUMP_VY * 0.85;
        phys.ground = null;
        nextDecision = ts + 700;
        setExpr("surprised");
        setTimeout(function () { if (currentExpr === "surprised") setExpr("normal"); }, 500);
    }

    // Un paso de simulación.
    function step(dt, ts) {
        var W = window.innerWidth;

        // Golpe en curso: resuelve impacto y fin del ataque antes que nada.
        stepAttack(ts);

        // Decisiones y reacciones solo cuando está parado y sin bocadillo activo.
        if (ts >= attentionUntil) {
            if (!attacking) maybeFlee(ts);
            if (phys.ground && ts >= nextDecision) decide(ts);
        } else {
            phys.tvx = 0; // "viene a hablarte": frena suave y se queda a decir algo
        }

        // Suavizado horizontal: en el piso, la velocidad se acerca a la deseada
        // (tvx) con una aceleración limitada, así arranca y frena con naturalidad
        // en vez de saltar de golpe a la velocidad máxima. En el aire se conserva
        // el impulso balístico (no hay "control aéreo"); al aterrizar, la fricción
        // del piso lo frena hacia tvx.
        if (phys.ground) {
            var tvx = phys.tvx || 0, dv = tvx - phys.vx, maxDv = ACCEL * dt;
            if (dv > maxDv) phys.vx += maxDv;
            else if (dv < -maxDv) phys.vx -= maxDv;
            else phys.vx = tvx;
        }

        // Mirar hacia el cursor cuando está (casi) quieto.
        if (Math.abs(phys.vx) < 6 && mouse.x >= 0 && ts - mouse.t < 3000) {
            phys.face = mouse.x < (phys.x + phys.w / 2) ? -1 : 1;
        }

        // Horizontal + rebote contra los bordes de la ventana (se invierte también
        // la velocidad objetivo para que reencare hacia adentro, no hacia el muro).
        phys.x += phys.vx * dt;
        if (phys.x < MARGIN) {
            phys.x = MARGIN;
            phys.vx = Math.abs(phys.vx); phys.tvx = Math.abs(phys.tvx || 0); phys.face = 1;
        }
        var maxX = W - phys.w - MARGIN;
        if (phys.x > maxX) {
            phys.x = maxX;
            phys.vx = -Math.abs(phys.vx); phys.tvx = -Math.abs(phys.tvx || 0); phys.face = -1;
        }

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

        // Estado de movimiento para el animador de fotogramas.
        motionAnim = !phys.ground ? "air" : (Math.abs(phys.vx) > 1 ? "walk" : "idle");

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
            phys.x = rr.left; phys.y = rr.top; phys.vx = 0; phys.vy = 0; phys.tvx = 0;
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
        phys = { x: r.left, y: r.top, vx: 0, vy: 0, tvx: 0, w: root.offsetWidth || 72,
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
        if (sprite && sprite.style) sprite.style.transform = ""; // mira de frente
        motionAnim = "idle";
        attacking = false; attackTarget = null; // corta cualquier golpe en curso
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
        stopAnim();
        clearTimeout(hideTimer);
        clearTimeout(blinkTimer);
        clearTimeout(loveTimer);
        clearInterval(sleepTimer);
        sleeping = false;
        root.remove();
        root = pet = sprite = bubble = bubbleText = zzz = null;
    }

    // El spritesheet ya trae su propia animación de reposo (respiración), así
    // que el parpadeo dibujado a mano dejó de tener sentido. Se conserva la
    // función como no-op para no tocar sus llamadores.
    function scheduleBlink() {
        clearTimeout(blinkTimer);
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
        "¡Hola! Soy Rimuru. ¿Qué vas a ver hoy?",
        "¡Blop! Estoy aquí si me necesitás.",
        "¿Sumamos algo a tus listas?",
        "¡Ánimo con tu maratón! ✨",
        "Toca una noti y te la leo.",
        "¡Soy Rimuru, tu slime de confianza!"
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
        if (phys) { phys.vx = 0; phys.tvx = 0; phys.face = 1; applyFace(); }
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

    // Cambia el personaje activo, lo persiste y repinta al vuelo si está en pantalla.
    function setCharacter(id) {
        try { localStorage.setItem(CHAR_KEY, id); } catch (_) { /* storage bloqueado */ }
        applyChar(id);
        return id;
    }

    // Lista para el selector: datos mínimos + una miniatura utilizable.
    // 'sheet' → src de la hoja + cols/rows (el selector recorta la celda 0);
    // 'frames' → la primera imagen de idle como miniatura directa.
    function listCharacters() {
        return allChars().map(function (c) {
            var mode = c.mode === "frames" ? "frames" : "sheet";
            var thumb = mode === "frames"
                ? (c.frames && c.frames.idle && c.frames.idle[0]) || ""
                : c.src;
            return {
                id: c.id, name: c.name, anime: c.anime || "",
                mode: mode, thumb: thumb,
                cols: c.cols || 8, rows: c.rows || 5
            };
        });
    }

    // API pública.
    window.Mascot = Object.freeze({
        say: say,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        setRoaming: setRoaming,
        isRoaming: roamPref,
        setCharacter: setCharacter,
        getCharacter: readChar,
        listCharacters: listCharacters
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
