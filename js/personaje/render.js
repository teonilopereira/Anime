// js/personaje/render.js
// Ficha de un personaje (tipo=character) o de su actor de voz / seiyū
// (tipo=staff). Consume window.getCharacterById / window.getStaffById (definidos
// en js/core/api.js, dentro del core-bundle) y pinta el resultado en
// personaje.html. Es autocontenido: no depende de los scripts del detalle.
(function () {
    'use strict';

    var esc = window.escapeHtml || function (v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
    var url = window.safeUrl || function (v) { return v ? String(v) : ''; };

    var ROLE_LABELS = { MAIN: 'Principal', SUPPORTING: 'Secundario', BACKGROUND: 'Fondo' };
    var GENDER_LABELS = { Male: 'Masculino', Female: 'Femenino', 'Non-binary': 'No binario' };

    // Orden y títulos de las subsecciones agrupadas por rol. Se listan los
    // principales primero, después los secundarios, el fondo y por último los
    // que llegan sin rol reconocible ('OTHER').
    var ROLE_ORDER = ['MAIN', 'SUPPORTING', 'BACKGROUND', 'OTHER'];
    // Ficha del actor de voz: los personajes que interpreta.
    var STAFF_GROUP_LABELS = {
        MAIN: 'Personajes principales',
        SUPPORTING: 'Personajes secundarios',
        BACKGROUND: 'Personajes de fondo',
        OTHER: 'Otros personajes'
    };
    // Ficha del personaje: las obras donde aparece, según su papel en cada una.
    var CHAR_GROUP_LABELS = {
        MAIN: 'Como protagonista',
        SUPPORTING: 'Como secundario',
        BACKGROUND: 'Apariciones de fondo',
        OTHER: 'Otras apariciones'
    };

    // Agrupa una lista por su campo .role (normalizado a MAYÚSCULAS). Cualquier
    // rol fuera de MAIN/SUPPORTING/BACKGROUND cae en 'OTHER' para no perderse.
    function groupByRole(items) {
        var groups = {};
        (items || []).forEach(function (it) {
            var key = String(it.role || '').toUpperCase();
            if (ROLE_ORDER.indexOf(key) === -1 || key === 'OTHER') key = 'OTHER';
            (groups[key] || (groups[key] = [])).push(it);
        });
        return groups;
    }

    // Arma una subsección por cada grupo de rol con contenido, en el orden de
    // ROLE_ORDER. Cada subsección lleva su título, un contador y la grilla de
    // cards. Si un solo grupo tiene datos igual se pinta con su encabezado, así
    // la pantalla queda "acomodada" y consistente en todos los casos.
    function buildRoleSections(items, labels, cardFn) {
        var groups = groupByRole(items);
        return ROLE_ORDER.map(function (key) {
            var list = groups[key];
            if (!list || !list.length) return '';
            return '<section class="persona-section">' +
                '<h2 class="persona-h2">' + esc(labels[key]) +
                    '<span class="persona-count">' + list.length + '</span>' +
                '</h2>' +
                '<div class="persona-grid">' + list.map(cardFn).join('') + '</div>' +
            '</section>';
        }).join('');
    }

    // ── Traducción de biografía ──
    // Reutiliza el mismo endpoint y prefijo de caché que las sinopsis del detalle
    // (js/detalle/data.js), así una traducción hecha en cualquiera de las dos
    // pantallas sirve para la otra.
    var TRANSLATION_CACHE_PREFIX = 'ad:trans:v2:';
    var TRANSLATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

    function translationCacheKey(text) {
        var s = String(text).trim().toLowerCase();
        if (s.length > 120) s = s.slice(0, 120);
        return TRANSLATION_CACHE_PREFIX + s;
    }

    async function translateText(text) {
        if (!text || typeof text !== 'string' || text.length < 10) return text;
        var cacheKey = translationCacheKey(text);
        try {
            var cached = localStorage.getItem(cacheKey);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (Date.now() < parsed.expiry) return parsed.text;
            }
        } catch (_) {}
        try {
            var resp = await fetch('https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(text.slice(0, 2000)) + '&langpair=en|es&de=demo@example.com');
            var data = await resp.json();
            var translated = text;
            if (data && data.matches && data.matches.length) {
                var cleanInput = text.toLowerCase().trim();
                var best = null;
                for (var i = 0; i < data.matches.length; i++) {
                    var m = data.matches[i];
                    if (!m || !m.translation) continue;
                    var segment = (m.segment || '').toLowerCase().trim();
                    var isExact = segment === cleanInput;
                    var isMT = m['created-by'] === 'MT!' || m.model === 'neural';
                    if (isExact && isMT) { best = m; break; }
                    if (isExact && !best) best = m;
                    if (isMT && !best) best = m;
                }
                if (!best) best = data.matches[0];
                translated = best.translation
                    .replace(/^\d+\s*[.)\]]?\s*/g, '').replace(/\s*\d+\s*[.)\]]?\s*$/g, '').trim();
            }
            if (translated !== text) {
                localStorage.setItem(cacheKey, JSON.stringify({ text: translated, expiry: Date.now() + TRANSLATION_CACHE_TTL }));
            }
            return translated;
        } catch (err) {
            console.warn('Translation error:', err);
            return text;
        }
    }

    // AniList devuelve la bio en markdown ligero con bloques de spoiler ~!...!~.
    // Se quitan los spoilers enteros (no queremos reventarle la trama a nadie que
    // solo vino a ver quién le pone la voz) y las marcas de énfasis / notas de
    // fuente, dejando texto plano para traducir y escapar.
    function cleanBio(raw) {
        if (!raw) return '';
        return String(raw)
            .replace(/~!([\s\S]*?)!~/g, '')          // bloques de spoiler completos
            .replace(/\(source:[^)]*\)/gi, '')        // "(Source: ...)"
            .replace(/__([^_]+)__/g, '$1')            // negrita __x__
            .replace(/\*\*([^*]+)\*\*/g, '$1')        // negrita **x**
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // ── Estados de la vista ──
    function setState(state, title, msg) {
        var loading = document.getElementById('persona-loading');
        var error = document.getElementById('persona-error');
        var content = document.getElementById('persona-content');
        if (loading) loading.hidden = state !== 'loading';
        if (content) content.hidden = state !== 'content';
        if (error) {
            error.hidden = state !== 'error';
            if (state === 'error') {
                var t = document.getElementById('persona-error-title');
                var m = document.getElementById('persona-error-msg');
                if (t && title) t.textContent = title;
                if (m) m.textContent = msg || '';
            }
        }
    }

    // ── Helpers de markup ──
    function metaChip(label, value) {
        if (!value) return '';
        return '<div class="persona-meta-item">' +
            '<span class="persona-meta-label">' + esc(label) + '</span>' +
            '<span class="persona-meta-value">' + esc(value) + '</span>' +
            '</div>';
    }

    function bioBlock(text) {
        if (!text) return '';
        var paras = text.split(/\n{2,}/).map(function (p) {
            return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
        }).join('');
        // Clamp con "ver más": el bloque arranca recortado y el botón lo expande.
        return '<div class="persona-bio">' +
            '<h2 class="persona-h2">Biografía</h2>' +
            '<div class="persona-bio-text is-clamped" id="persona-bio-text">' + paras + '</div>' +
            '<button type="button" class="btn-ver-mas" id="persona-bio-toggle">Ver más</button>' +
            '</div>';
    }

    // Card de una obra donde aparece el personaje (enlaza al detalle) con su seiyū.
    // Cuando la card ya vive dentro de una subsección agrupada por rol, se pasa
    // hideRole=true para no repetir el papel (ya lo dice el encabezado del grupo).
    function appearanceCard(a, hideRole) {
        var roleLabel = hideRole ? '' : (ROLE_LABELS[a.role] || '');
        var mediaHref = a.id ? 'detalle.html?cat=' + esc(a.cat) + '&id=' + esc(String(a.id)) : '';
        var cover = a.cover
            ? '<img class="persona-card-cover" src="' + url(a.cover) + '" alt="" loading="lazy">'
            : '<span class="persona-card-cover persona-card-cover--empty"></span>';
        var inner =
            cover +
            '<span class="persona-card-body">' +
                '<span class="persona-card-title">' + esc(a.title) + '</span>' +
                (roleLabel ? '<span class="persona-card-role">' + esc(roleLabel) + '</span>' : '') +
            '</span>';
        var media = mediaHref
            ? '<a class="persona-card-main" href="' + mediaHref + '">' + inner + '</a>'
            : '<div class="persona-card-main">' + inner + '</div>';
        // Mini-ficha del seiyū a la derecha, con enlace a su propia página.
        var va = '';
        if (a.vaName) {
            var vaInner =
                (a.vaImage ? '<img class="persona-va-face" src="' + url(a.vaImage) + '" alt="" loading="lazy">' : '') +
                '<span class="persona-va-text">' +
                    '<span class="persona-va-name">' + esc(a.vaName) + '</span>' +
                    '<span class="persona-card-role">Seiyū</span>' +
                '</span>';
            va = a.vaId
                ? '<a class="persona-va" href="personaje.html?tipo=staff&id=' + esc(String(a.vaId)) + '">' + vaInner + '</a>'
                : '<div class="persona-va">' + vaInner + '</div>';
        }
        return '<div class="persona-card">' + media + va + '</div>';
    }

    // Card de un personaje interpretado por el seiyū (enlaza a su ficha) + la obra.
    function roleCard(r) {
        var charHref = r.charId ? 'personaje.html?tipo=character&id=' + esc(String(r.charId)) : '';
        var face = r.charImage
            ? '<img class="persona-card-cover" src="' + url(r.charImage) + '" alt="" loading="lazy">'
            : '<span class="persona-card-cover persona-card-cover--empty"></span>';
        var inner =
            face +
            '<span class="persona-card-body">' +
                '<span class="persona-card-title">' + esc(r.charName) + '</span>' +
                (r.mediaTitle ? '<span class="persona-card-role">' + esc(r.mediaTitle) + '</span>' : '') +
            '</span>';
        var charBlock = charHref
            ? '<a class="persona-card-main" href="' + charHref + '">' + inner + '</a>'
            : '<div class="persona-card-main">' + inner + '</div>';
        var media = '';
        if (r.mediaCover && r.mediaId) {
            media = '<a class="persona-va" href="detalle.html?cat=' + esc(r.mediaCat) + '&id=' + esc(String(r.mediaId)) + '">' +
                '<img class="persona-va-face persona-va-face--cover" src="' + url(r.mediaCover) + '" alt="" loading="lazy">' +
                '</a>';
        }
        return '<div class="persona-card">' + charBlock + media + '</div>';
    }

    function heroBlock(data, kicker) {
        var img = data.image
            ? '<img class="persona-hero-img" src="' + url(data.image) + '" alt="' + esc(data.name) + '" loading="lazy">'
            : '<div class="persona-hero-img persona-hero-img--empty"></div>';
        var native = data.native && data.native !== data.name
            ? '<p class="persona-native">' + esc(data.native) + '</p>' : '';
        return '<section class="persona-hero">' +
            '<div class="persona-hero-portada">' + img + '</div>' +
            '<div class="persona-hero-info">' +
                '<span class="persona-kicker">' + esc(kicker) + '</span>' +
                '<h1 class="persona-name">' + esc(data.name) + '</h1>' +
                native +
                '<div class="persona-meta-grid" id="persona-meta"></div>' +
            '</div>' +
        '</section>';
    }

    function renderCharacter(data) {
        var kicker = 'Personaje';
        var meta =
            metaChip('Género', GENDER_LABELS[data.gender] || data.gender) +
            metaChip('Edad', data.age) +
            metaChip('Cumpleaños', data.dateOfBirth) +
            metaChip('Tipo de sangre', data.bloodType) +
            metaChip('Favoritos', data.favourites ? '♥ ' + data.favourites.toLocaleString('es') : '');

        // Apariciones agrupadas por el papel del personaje en cada obra:
        // protagónicas primero, después secundarias, etc.
        var appearances = data.appearances.length
            ? buildRoleSections(data.appearances, CHAR_GROUP_LABELS, function (a) {
                return appearanceCard(a, true);
              })
            : '';

        return { kicker: kicker, meta: meta, sections: appearances };
    }

    function renderStaff(data) {
        var kicker = 'Actor de voz';
        var occ = data.occupations.length ? data.occupations.join(', ') : '';
        var meta =
            metaChip('Idioma', data.language) +
            metaChip('Ocupación', occ) +
            metaChip('Género', GENDER_LABELS[data.gender] || data.gender) +
            metaChip('Edad', data.age) +
            metaChip('Cumpleaños', data.dateOfBirth) +
            metaChip('Origen', data.homeTown) +
            metaChip('Favoritos', data.favourites ? '♥ ' + data.favourites.toLocaleString('es') : '');

        // Personajes que interpreta el seiyū, agrupados por rol: los papeles
        // principales (protagónicos) primero y los secundarios después, para que
        // se distingan de un vistazo los personajes que comparten esta misma voz.
        var roles = data.roles.length
            ? buildRoleSections(data.roles, STAFF_GROUP_LABELS, roleCard)
            : '';

        return { kicker: kicker, meta: meta, sections: roles };
    }

    function paint(data) {
        var built = data.kind === 'staff' ? renderStaff(data) : renderCharacter(data);
        var content = document.getElementById('persona-content');
        if (!content) return;

        content.innerHTML =
            heroBlock(data, built.kicker) +
            '<div id="persona-bio-slot"></div>' +
            built.sections +
            '<div class="persona-back"><a class="detail-back" href="index.html">Volver al inicio</a></div>';

        document.getElementById('persona-meta').innerHTML = built.meta;
        document.title = 'Anime Destiny | ' + data.name;
        setCanonical(data);
        setState('content');
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

        // Biografía: se pinta el original de inmediato y se reemplaza por la
        // traducción cuando llega, para no dejar la sección en blanco esperando.
        var cleaned = cleanBio(data.description);
        var slot = document.getElementById('persona-bio-slot');
        if (cleaned && slot) {
            slot.innerHTML = bioBlock(cleaned);
            wireBioToggle();
            translateText(cleaned).then(function (translated) {
                if (translated && translated !== cleaned) {
                    slot.innerHTML = bioBlock(translated);
                    wireBioToggle();
                }
            });
        }
    }

    function wireBioToggle() {
        var toggle = document.getElementById('persona-bio-toggle');
        var text = document.getElementById('persona-bio-text');
        if (!toggle || !text) return;
        // Altura real (sin recorte) vs recortada: si no desborda, el botón sobra.
        var clampedH = text.clientHeight;
        text.classList.remove('is-clamped');
        var fullH = text.scrollHeight;
        if (fullH <= clampedH + 4) {
            toggle.hidden = true;
            return;
        }
        text.classList.add('is-clamped');
        toggle.addEventListener('click', function () {
            var clamped = text.classList.toggle('is-clamped');
            toggle.textContent = clamped ? 'Ver más' : 'Ver menos';
        });
    }

    // Canonical con tipo + id: el contenido depende del query string, igual que
    // el detalle, así que la URL canónica se arma en runtime (el build no la pisa).
    function setCanonical(data) {
        var href = 'https://animedestiny.netlify.app/personaje.html?tipo=' +
            (data.kind === 'staff' ? 'staff' : 'character') + '&id=' + data.id;
        var link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'canonical');
            document.head.appendChild(link);
        }
        link.setAttribute('href', href);
    }

    // ── Bootstrap ──
    function getParams() {
        var params = new URLSearchParams(window.location.search);
        var tipo = (params.get('tipo') || 'character').toLowerCase();
        if (tipo !== 'character' && tipo !== 'staff') tipo = 'character';
        var id = params.get('id') || '';
        return { tipo: tipo, id: id };
    }

    async function init() {
        var params = getParams();
        var numId = Number(params.id);
        if (!params.id || !Number.isFinite(numId) || numId <= 0) {
            setState('error', 'Faltan parámetros', 'Abrí una ficha desde el reparto de un anime o manga.');
            return;
        }
        var fetcher = params.tipo === 'staff' ? window.getStaffById : window.getCharacterById;
        if (typeof fetcher !== 'function') {
            setState('error', 'No disponible', 'No se pudo inicializar la búsqueda. Recargá la página.');
            return;
        }
        setState('loading');
        try {
            var data = await fetcher(numId);
            if (!data) {
                setState('error', 'No encontrado', 'No se encontró esta ficha en AniList.');
                return;
            }
            paint(data);
        } catch (err) {
            console.warn('personaje init error:', err);
            setState('error', 'Error', 'Hubo un problema al cargar la ficha. Probá de nuevo.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
