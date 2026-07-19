/*
 * Configuracion.
 *
 * Todo se guarda solo: cada control escribe su preferencia apenas cambia y
 * aplica el efecto en el momento. Antes habia siete botones de guardar, uno por
 * panel, y como algunos ajustes estaban duplicados en dos paneles el boton de
 * uno pisaba lo que acababas de guardar en el otro.
 *
 * Regla para agregar un ajuste: solo va a esta pagina si algo del resto de la
 * app lee su clave. Se quitaron pais, zona horaria, tema, historial, badges,
 * barra de progreso y correo porque se guardaban y no los leia nadie: la
 * pagina prometia cosas que no pasaban.
 */

/* ── Helpers ── */
function r(key, def = '') { try { return localStorage.getItem(key) || def; } catch { return def; } }
function w(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) { console.warn('config save failed:', key, e); } }
function rb(key, def = false) { const v = r(key, null); return v === null ? def : v === 'true'; }
function $(id) { return document.getElementById(id); }

function getCurrentUserName() {
    try {
        if (window.AppSupabase && window.AppSupabase.isSignedIn()) {
            var u = window.AppSupabase.getCurrentUserSync();
            if (u) return u.user_metadata?.username || u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuario';
        }
    } catch (e) { console.warn('getCurrentUserName failed:', e); }
    return 'Invitado';
}

function toast(msg, isError = false) {
    const t = $('cfgToast');
    t.textContent = msg;
    t.className = 'cfg-toast' + (isError ? ' error' : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

// Con autoguardado el toast salta en cada cambio, y tocar tres toggles seguidos
// encadenaba tres avisos. Este agrupa: el ultimo cambio pisa al anterior.
let guardadoTimer = null;
function avisarGuardado(msg) {
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(() => toast(msg || '✅ Guardado'), 250);
}

/* ── Preferencias booleanas ──
 * Cada entrada asocia el id del control con su clave. Agregar un toggle es
 * sumar una linea aca y el <input> en el HTML: el wiring es automatico.
 */
const TOGGLES = {
    prefPublic:       { key: 'pref:privacidad', def: true,  onOff: ['publica', 'privada'] },
    prefNsfw:         { key: 'pref:nsfw',       def: false },
    prefContenido:    { key: 'pref:contenido',  def: true,  onOff: ['personalizado', 'general'] },
    prefNotif:        { key: 'pref:notif',      def: false, onOff: ['on', 'off'] },
    prefCompact:      { key: 'pref:compactCards',  def: false },
    prefReduceMotion: { key: 'pref:reduceMotion',  def: false }
};

function leerToggle(cfg) {
    if (cfg.onOff) return r(cfg.key, cfg.def ? cfg.onOff[0] : cfg.onOff[1]) === cfg.onOff[0];
    return rb(cfg.key, cfg.def);
}

function escribirToggle(cfg, checked) {
    w(cfg.key, cfg.onOff ? (checked ? cfg.onOff[0] : cfg.onOff[1]) : checked);
}

/* ── Colores de la app ── */
const COLOR_KEYS = {
    clrNeonPurple: 'pref:color:neonPurple',
    clrNavAccent:  'pref:color:navAccent',
    clrCyan:       'pref:color:cyan',
    clrDarkBg:     'pref:color:darkBg',
    clrTextMain:   'pref:color:textMain',
    clrTextMuted:  'pref:color:textMuted'
};
const COLOR_DEFAULTS = {
    clrNeonPurple: '#bc13fe',
    clrNavAccent:  '#a855f7',
    clrCyan:       '#00f2ff',
    clrDarkBg:     '#050505',
    clrTextMain:   '#ffffff',
    clrTextMuted:  '#b0b0b0'
};

function applyCustomColors() {
    var vars = {
        '--neon-purple': r(COLOR_KEYS.clrNeonPurple, COLOR_DEFAULTS.clrNeonPurple),
        '--nav-accent':  r(COLOR_KEYS.clrNavAccent,  COLOR_DEFAULTS.clrNavAccent),
        '--accent-cyan': r(COLOR_KEYS.clrCyan,       COLOR_DEFAULTS.clrCyan),
        '--dark-bg':     r(COLOR_KEYS.clrDarkBg,     COLOR_DEFAULTS.clrDarkBg),
        '--text-main':   r(COLOR_KEYS.clrTextMain,   COLOR_DEFAULTS.clrTextMain),
        '--text-muted':  r(COLOR_KEYS.clrTextMuted,  COLOR_DEFAULTS.clrTextMuted)
    };
    var root = document.documentElement;
    for (var name in vars) {
        if (vars.hasOwnProperty(name)) root.style.setProperty(name, vars[name]);
    }
    root.style.setProperty('--nav-accent-soft', vars['--nav-accent'] + '3d');
}

/* ── Fondo ── */
function sanitizeBgUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:image/')) return url;
    try {
        var parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch (_) {}
    return '';
}

function applyBgToPage() {
    const mode = r('pref:bgMode', 'default');
    const body = document.body;
    ['background','background-image','background-color','background-repeat','background-size','background-position','background-attachment']
        .forEach(p => body.style.removeProperty(p));
    if (mode === 'color') {
        const color = r('pref:bgColor', '#2b0a55');
        body.style.background = `linear-gradient(180deg, #000000 0%, ${color} 100%)`;
        body.style.backgroundAttachment = 'fixed';
    } else if (mode === 'image') {
        const url = sanitizeBgUrl(r('pref:bgImage', ''));
        if (url) {
            body.style.backgroundImage = `linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,.76)),url("${url}")`;
            body.style.backgroundSize = 'cover';
            body.style.backgroundPosition = 'center';
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundAttachment = 'fixed';
        }
    }
}

function updateBgSections(mode) {
    $('bgColorSection').style.display = mode === 'color' ? 'block' : 'none';
    $('bgImageSection').style.display = mode === 'image' ? 'block' : 'none';
}

/* ── Tarjetas por fila ── */
const CPR_MIN = () => AnimeDestiny.Constants.CARDS_PER_ROW_MIN || 2;
const CPR_MAX = () => AnimeDestiny.Constants.CARDS_PER_ROW_MAX || 8;
const CPR_DEF = () => AnimeDestiny.Constants.CARDS_PER_ROW_DEFAULT || 4;

// Separado del guardado a proposito: al restablecer hay que dejar la grilla en
// automatico SIN volver a escribir la clave que se acaba de borrar.
function aplicarCprEnPagina(valor) {
    if (valor === 'auto') {
        document.body.classList.remove('fixed-cards-row');
        document.documentElement.style.removeProperty('--cards-per-row');
        return;
    }
    document.documentElement.style.setProperty('--cards-per-row', String(valor));
    document.body.classList.add('fixed-cards-row');
}

function aplicarCpr(valor) {
    w('pref:cardsPerRow', String(valor));
    aplicarCprEnPagina(valor);
}

/* ── Pintar la UI con lo guardado ── */
function syncUI() {
    var user = getCurrentUserName();
    $('cfgUserName').textContent = user;
    $('cfgAvatar').textContent = user.slice(0, 2).toUpperCase();

    // El idioma vive en pref:lang, que es lo que lee i18n.js. Antes esta pagina
    // escribia pref:idioma, una clave que no leia nadie.
    $('cfgIdioma').value = r('pref:lang', 'es');

    for (var id in TOGGLES) {
        if (TOGGLES.hasOwnProperty(id)) $(id).checked = leerToggle(TOGGLES[id]);
    }

    for (var cid in COLOR_KEYS) {
        if (COLOR_KEYS.hasOwnProperty(cid)) $(cid).value = r(COLOR_KEYS[cid], COLOR_DEFAULTS[cid]);
    }

    const bgMode = r('pref:bgMode', 'default');
    document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = $('bgBtn' + bgMode.charAt(0).toUpperCase() + bgMode.slice(1));
    if (activeBtn) activeBtn.classList.add('active');
    $('cfgBgColor').value = r('pref:bgColor', '#2b0a55');
    $('cfgBgUrl').value = r('pref:bgImage', '').startsWith('data:') ? '' : r('pref:bgImage', '');
    updateBgSections(bgMode);

    const cprSaved = r('pref:cardsPerRow', 'auto');
    const fijado = cprSaved !== 'auto';
    $('cprToggle').checked = fijado;
    $('cprSliderWrap').style.display = fijado ? 'block' : 'none';
    if (fijado) {
        var val = parseInt(cprSaved, 10);
        if (!(val >= CPR_MIN() && val <= CPR_MAX())) val = CPR_DEF();
        $('cprSlider').value = val;
        $('cprValue').textContent = val;
    }
}

/* ── Wiring: cada control guarda al cambiar ── */

$('cfgIdioma').addEventListener('change', function () {
    if (window.AppI18n) window.AppI18n.setLang(this.value);
    avisarGuardado('✅ Idioma actualizado');
});

for (const id in TOGGLES) {
    if (!TOGGLES.hasOwnProperty(id)) continue;
    const cfg = TOGGLES[id];
    $(id).addEventListener('change', function () {
        escribirToggle(cfg, this.checked);
        avisarGuardado();
    });
}

// Los colores se aplican en vivo mientras arrastras (input) pero solo avisan al
// soltar (change): con 'input' el toast se dispararia decenas de veces.
for (const id in COLOR_KEYS) {
    if (!COLOR_KEYS.hasOwnProperty(id)) continue;
    const key = COLOR_KEYS[id];
    $(id).addEventListener('input', function () { w(key, this.value); applyCustomColors(); });
    $(id).addEventListener('change', function () { avisarGuardado('✅ Colores aplicados'); });
}

$('resetColores').addEventListener('click', function () {
    for (var id in COLOR_DEFAULTS) {
        if (!COLOR_DEFAULTS.hasOwnProperty(id)) continue;
        localStorage.removeItem(COLOR_KEYS[id]);
        $(id).value = COLOR_DEFAULTS[id];
    }
    applyCustomColors();
    toast('↩ Colores restablecidos');
});

/* Fondo */
document.querySelectorAll('.cfg-bg-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        updateBgSections(mode);
        w('pref:bgMode', mode);
        if (mode === 'default') {
            localStorage.removeItem('pref:bgColor');
            localStorage.removeItem('pref:bgImage');
            $('cfgBgUrl').value = '';
        }
        applyBgToPage();
        avisarGuardado('✅ Fondo actualizado');
    });
});

$('cfgBgColor').addEventListener('input', function () {
    w('pref:bgColor', this.value);
    applyBgToPage();
});
$('cfgBgColor').addEventListener('change', () => avisarGuardado('✅ Fondo actualizado'));

$('cfgBgUrl').addEventListener('change', function () {
    const limpia = sanitizeBgUrl(this.value.trim());
    if (this.value.trim() && !limpia) { toast('Esa URL no es válida', true); return; }
    w('pref:bgImage', limpia);
    applyBgToPage();
    avisarGuardado('✅ Fondo actualizado');
});

$('cfgBgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
        $('bgBtnImage').classList.add('active');
        updateBgSections('image');
        w('pref:bgMode', 'image');
        w('pref:bgImage', reader.result);
        applyBgToPage();
        toast('✅ Imagen de fondo aplicada');
    };
    reader.readAsDataURL(file);
});

/* Tarjetas por fila */
$('cprToggle').addEventListener('change', function () {
    $('cprSliderWrap').style.display = this.checked ? 'block' : 'none';
    if (this.checked) {
        const val = parseInt($('cprSlider').value, 10) || CPR_DEF();
        $('cprValue').textContent = val;
        aplicarCpr(val);
        avisarGuardado('✅ ' + val + ' tarjetas por fila');
    } else {
        aplicarCpr('auto');
        avisarGuardado('↩ Cantidad automática');
    }
});

$('cprSlider').addEventListener('input', function () {
    $('cprValue').textContent = this.value;
    const val = parseInt(this.value, 10);
    if (val >= CPR_MIN() && val <= CPR_MAX()) {
        aplicarCpr(val);
        avisarGuardado('✅ ' + val + ' tarjetas por fila');
    }
});

/* Preferencias locales de visualizacion. Se usan para exportar y para
 * restablecer. Las listas y el progreso viven en Supabase: no estan aca. */
const PREF_KEYS = [
    'pref:bgMode', 'pref:bgColor', 'pref:bgImage',
    'pref:compactCards', 'pref:reduceMotion', 'pref:nsfw',
    'pref:notif', 'pref:contenido', 'pref:privacidad', 'pref:cardsPerRow',
    ...Object.values(COLOR_KEYS)
];

/* ── Exportar datos ── */
$('exportData').addEventListener('click', async () => {
    const supaUser = await window.AppSupabase?.getCurrentUser?.();
    if (!supaUser) { toast('Iniciá sesión primero', true); return; }
    const username = supaUser.user_metadata?.username || supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || supaUser.id;
    const data = { user: username, exportedAt: new Date().toISOString(), prefs: {}, lists: {} };

    PREF_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) data.prefs[k] = v;
    });

    try {
        const client = window.AppSupabase;
        if (client?.loadItemStates) {
            const categorias = ['anime', 'manga', 'novelas'];
            const all = await Promise.all(categorias.map(cat =>
                client.loadItemStates(cat).then(states => ({ cat, states }))
            ));
            all.forEach(({ cat, states }) => {
                if (!Array.isArray(states)) return;
                states.forEach(s => {
                    if (!data.lists[cat]) data.lists[cat] = [];
                    data.lists[cat].push({ id: s.item_id, fav: s.fav, viewed: s.viewed });
                });
            });
        }
    } catch (e) { console.warn('Error exportando desde Supabase:', e); }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `anime-destiny-${username}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('✅ Datos exportados');
});

/* ── Restablecer apariencia ── */
$('resetAll').addEventListener('click', () => {
    if (!confirm('¿Restablecer la apariencia a los valores por defecto? Tus listas y tu progreso no se tocan.')) return;
    PREF_KEYS.forEach(k => localStorage.removeItem(k));
    aplicarCprEnPagina('auto');
    applyCustomColors();
    applyBgToPage();
    syncUI();
    toast('✅ Apariencia restablecida');
});

/* ── Cerrar sesión ── */
$('logoutBtn').addEventListener('click', async () => {
    const supaUser = await window.AppSupabase?.getCurrentUser?.();
    if (!supaUser) { toast('No hay usuario activo', true); return; }
    const username = supaUser.user_metadata?.username || supaUser.email?.split('@')[0] || 'usuario';
    if (!confirm(`¿Cerrar sesión de "${username}"? Tus datos quedan guardados en tu cuenta.`)) return;
    try {
        await window.logoutUser?.();
        toast('✅ Sesión cerrada');
        setTimeout(() => window.location.href = 'index.html', AnimeDestiny.Constants.PROFILE_REDIRECT_DELAY_MS || 1000);
    } catch (e) {
        toast('Error al cerrar sesión: ' + e.message, true);
    }
});

/* ── Init ── */
applyCustomColors();
applyBgToPage();
syncUI();

window.addEventListener('supabase-ready', () => {
    const nameEl = $('cfgUserName');
    if (nameEl) nameEl.textContent = getCurrentUserName();
    if (typeof window.refreshUserUi === 'function') window.refreshUserUi();
}, { once: true });
