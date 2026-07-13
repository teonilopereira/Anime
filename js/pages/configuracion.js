/* ── Helpers ── */
function r(key, def = '') { try { return localStorage.getItem(key) || def; } catch { return def; } }
function w(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) { console.warn('config save failed:', key, e); } }
function rb(key, def = false) { const v = r(key, null); return v === null ? def : v === 'true'; }

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
    const t = document.getElementById('cfgToast');
    t.textContent = msg;
    t.className = 'cfg-toast' + (isError ? ' error' : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

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
        '--neon-purple':   r(COLOR_KEYS.clrNeonPurple, COLOR_DEFAULTS.clrNeonPurple),
        '--nav-accent':    r(COLOR_KEYS.clrNavAccent,  COLOR_DEFAULTS.clrNavAccent),
        '--accent-cyan':   r(COLOR_KEYS.clrCyan,       COLOR_DEFAULTS.clrCyan),
        '--dark-bg':       r(COLOR_KEYS.clrDarkBg,     COLOR_DEFAULTS.clrDarkBg),
        '--text-main':     r(COLOR_KEYS.clrTextMain,   COLOR_DEFAULTS.clrTextMain),
        '--text-muted':    r(COLOR_KEYS.clrTextMuted,  COLOR_DEFAULTS.clrTextMuted)
    };
    var root = document.documentElement;
    for (var name in vars) {
        if (vars.hasOwnProperty(name)) {
            root.style.setProperty(name, vars[name]);
        }
    }
    var navAccent = vars['--nav-accent'];
    root.style.setProperty('--nav-accent-soft', navAccent + '3d');
}

function syncColorPickers() {
    for (var id in COLOR_KEYS) {
        if (COLOR_KEYS.hasOwnProperty(id)) {
            var el = document.getElementById(id);
            if (el) el.value = r(COLOR_KEYS[id], COLOR_DEFAULTS[id]);
        }
    }
}

/* ── Sync UI con localStorage ── */
function syncUI() {
    var user = getCurrentUserName();
    document.getElementById('cfgUserName').textContent = user;
    document.getElementById('cfgAvatar').textContent = user.slice(0, 2).toUpperCase();

    document.getElementById('cfgEmail').value = r('u:' + user + '|email', '');
    document.getElementById('cfgPais').value = r('pref:pais', 'Argentina');
    document.getElementById('cfgIdioma').value = r('pref:idioma', 'Español');
    document.getElementById('cfgZona').value = r('pref:zona', 'GMT-3 (Buenos Aires)');

    document.getElementById('prefNotif').checked = rb('pref:notif', false) || r('pref:notif', 'off') === 'on';
    document.getElementById('prefContenido').checked = r('pref:contenido', 'personalizado') === 'personalizado';
    document.getElementById('prefCompact').checked = rb('pref:compactCards', false);
    document.getElementById('prefReduceMotion').checked = rb('pref:reduceMotion', false);
    document.getElementById('prefShowProgress').checked = rb('pref:showProgress', true);
    document.getElementById('prefPublic').checked = r('pref:privacidad', 'publica') === 'publica';
    document.getElementById('prefNsfw').checked = rb('pref:nsfw', false);
    document.getElementById('prefTema').value = r('pref:tema', 'oscuro');

    document.getElementById('compactCards2').checked = rb('pref:compactCards', false);
    document.getElementById('showBadges').checked = rb('pref:showBadges', true);
    document.getElementById('showProgressBadge').checked = rb('pref:showProgress', true);

    document.getElementById('privPublic2').checked = r('pref:privacidad', 'publica') === 'publica';
    document.getElementById('privHistory').checked = rb('pref:history', true);

    const bgMode = r('pref:bgMode', 'default');
    document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('bgBtn' + bgMode.charAt(0).toUpperCase() + bgMode.slice(1));
    if (activeBtn) activeBtn.classList.add('active');
    document.getElementById('cfgBgColor').value = r('pref:bgColor', '#2b0a55');
    document.getElementById('cfgBgUrl').value = r('pref:bgImage', '').startsWith('data:') ? '' : r('pref:bgImage', '');
    updateBgSections(bgMode);
    syncColorPickers();
    syncCprUI();
}

function updateBgSections(mode) {
    document.getElementById('bgColorSection').style.display = mode === 'color' ? 'block' : 'none';
    document.getElementById('bgImageSection').style.display = mode === 'image' ? 'block' : 'none';
}

/* ── Eventos de fondo ── */
let currentBgMode = r('pref:bgMode', 'default');
document.querySelectorAll('.cfg-bg-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBgMode = btn.dataset.mode;
        updateBgSections(currentBgMode);
    });
});

document.getElementById('cfgBgColor').addEventListener('input', () => {
    if (currentBgMode === 'color') {
        w('pref:bgColor', document.getElementById('cfgBgColor').value);
        applyBgToPage();
    }
});

document.getElementById('cfgBgUrl').addEventListener('input', () => {
    if (currentBgMode === 'image') {
        w('pref:bgImage', document.getElementById('cfgBgUrl').value.trim());
        applyBgToPage();
    }
});

document.getElementById('cfgBgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        currentBgMode = 'image';
        document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('bgBtnImage').classList.add('active');
        updateBgSections('image');
        w('pref:bgMode', 'image');
        w('pref:bgImage', reader.result);
        applyBgToPage();
        toast("✅ Imagen de fondo aplicada");
    };
    reader.readAsDataURL(file);
});

document.getElementById('saveFondo').addEventListener('click', () => {
    w('pref:bgMode', currentBgMode);
    if (currentBgMode === 'color') w('pref:bgColor', document.getElementById('cfgBgColor').value);
    if (currentBgMode === 'image') w('pref:bgImage', document.getElementById('cfgBgUrl').value.trim());
    applyBgToPage();
    toast("✅ Fondo guardado correctamente");
});

document.getElementById('clearFondo').addEventListener('click', () => {
    currentBgMode = 'default';
    document.querySelectorAll('.cfg-bg-mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('bgBtnDefault').classList.add('active');
    updateBgSections('default');
    w('pref:bgMode', 'default');
    localStorage.removeItem('pref:bgColor');
    localStorage.removeItem('pref:bgImage');
    applyBgToPage();
    toast("✅ Fondo restaurado al predeterminado");
});

/* ── Guardar información personal ── */
document.getElementById('saveInfoPersonal').addEventListener('click', () => {
    var user = getCurrentUserName();
    w('u:' + user + '|email', document.getElementById('cfgEmail').value.trim());
    w('pref:pais', document.getElementById('cfgPais').value);
    w('pref:idioma', document.getElementById('cfgIdioma').value);
    w('pref:zona', document.getElementById('cfgZona').value);
    toast("✅ Información personal guardada");
});

/* ── Guardar colores ── */
document.getElementById('saveColores').addEventListener('click', function() {
    for (var id in COLOR_KEYS) {
        if (COLOR_KEYS.hasOwnProperty(id)) {
            var el = document.getElementById(id);
            if (el) w(COLOR_KEYS[id], el.value);
        }
    }
    applyCustomColors();
    toast("✅ Colores aplicados");
});

/* ── Cards per row ── */
var cprToggle = document.getElementById('cprToggle');
var cprSlider = document.getElementById('cprSlider');
var cprValue = document.getElementById('cprValue');
var cprSliderWrap = document.getElementById('cprSliderWrap');
var cprActions = document.getElementById('cprActions');
var cprSaved = r('pref:cardsPerRow', 'auto');

function syncCprUI() {
    cprToggle.checked = cprSaved !== 'auto';
    cprSliderWrap.style.display = cprToggle.checked ? 'block' : 'none';
    cprActions.style.display = cprToggle.checked ? 'flex' : 'none';
    if (cprToggle.checked) {
        var val = parseInt(cprSaved, 10);
        if (val < (AnimeDestiny.Constants.CARDS_PER_ROW_MIN || 2) || val > (AnimeDestiny.Constants.CARDS_PER_ROW_MAX || 8)) val = AnimeDestiny.Constants.CARDS_PER_ROW_DEFAULT || 4;
        cprSlider.value = val;
        cprValue.textContent = val;
    }
}

cprToggle.addEventListener('change', function() {
    if (this.checked) {
        cprSliderWrap.style.display = 'block';
        cprActions.style.display = 'flex';
        var val = parseInt(cprSlider.value, 10);
        cprValue.textContent = val;
    } else {
        cprSliderWrap.style.display = 'none';
        cprActions.style.display = 'none';
        w('pref:cardsPerRow', 'auto');
        document.body.classList.remove('fixed-cards-row');
        document.documentElement.style.removeProperty('--cards-per-row');
        toast("↩ Cantidad automática");
    }
});

cprSlider.addEventListener('input', function() {
    cprValue.textContent = this.value;
});

document.getElementById('saveCpr').addEventListener('click', function() {
    var val = parseInt(cprSlider.value, 10);
    if (val >= (AnimeDestiny.Constants.CARDS_PER_ROW_MIN || 2) && val <= (AnimeDestiny.Constants.CARDS_PER_ROW_MAX || 8)) {
        cprSaved = String(val);
        w('pref:cardsPerRow', cprSaved);
        document.documentElement.style.setProperty('--cards-per-row', cprSaved);
        document.body.classList.add('fixed-cards-row');
        toast("✅ " + val + " tarjetas por fila");
    }
});

document.getElementById('resetCpr').addEventListener('click', function() {
    cprSaved = 'auto';
    w('pref:cardsPerRow', 'auto');
    document.body.classList.remove('fixed-cards-row');
    document.documentElement.style.removeProperty('--cards-per-row');
    cprToggle.checked = false;
    cprSliderWrap.style.display = 'none';
    cprActions.style.display = 'none';
    toast("↩ Cantidad automática");
});

/* ── Guardar colores ── */
document.getElementById('resetColores').addEventListener('click', function() {
    for (var id in COLOR_DEFAULTS) {
        if (COLOR_DEFAULTS.hasOwnProperty(id)) {
            localStorage.removeItem(COLOR_KEYS[id]);
            var el = document.getElementById(id);
            if (el) el.value = COLOR_DEFAULTS[id];
        }
    }
    applyCustomColors();
    toast("↩ Colores restablecidos");
});

/* ── Guardar preferencias ── */
document.getElementById('savePreferencias').addEventListener('click', () => {
    w('pref:notif', document.getElementById('prefNotif').checked ? 'on' : 'off');
    w('pref:contenido', document.getElementById('prefContenido').checked ? 'personalizado' : 'general');
    w('pref:compactCards', document.getElementById('prefCompact').checked);
    w('pref:reduceMotion', document.getElementById('prefReduceMotion').checked);
    w('pref:showProgress', document.getElementById('prefShowProgress').checked);
    w('pref:privacidad', document.getElementById('prefPublic').checked ? 'publica' : 'privada');
    w('pref:nsfw', document.getElementById('prefNsfw').checked);
    w('pref:tema', document.getElementById('prefTema').value);
    toast("✅ Preferencias guardadas");
});

/* ── Guardar apariencia ── */
document.getElementById('saveApariencia').addEventListener('click', () => {
    w('pref:compactCards', document.getElementById('compactCards2').checked);
    w('pref:showBadges', document.getElementById('showBadges').checked);
    w('pref:showProgress', document.getElementById('showProgressBadge').checked);
    document.getElementById('prefCompact').checked = document.getElementById('compactCards2').checked;
    toast("✅ Apariencia guardada");
});

/* ── Guardar privacidad ── */
document.getElementById('privPublic2').addEventListener('change', () => {
    document.getElementById('prefPublic').checked = document.getElementById('privPublic2').checked;
});

/* ── Exportar datos ── */
document.getElementById('exportData').addEventListener('click', async () => {
    const supaUser = await window.AppSupabase?.getCurrentUser?.();
    if (!supaUser) { toast('Iniciá sesión primero', true); return; }
    const username = supaUser.user_metadata?.username || supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || supaUser.id;
    const data = { user: username, exportedAt: new Date().toISOString(), prefs: {}, lists: {} };

    ['pref:bgMode','pref:bgColor','pref:bgImage','pref:compactCards','pref:reduceMotion',
     'pref:showProgress','pref:notif','pref:contenido','pref:privacidad','pref:tema',
     'pref:pais','pref:idioma','pref:zona','pref:showBadges','pref:history','pref:nsfw'].forEach(k => {
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
    toast("✅ Datos exportados desde Supabase");
});

/* ── Cerrar sesión / Eliminar usuario ── */
document.getElementById('deleteUserBtn').addEventListener('click', async () => {
    const supaUser = await window.AppSupabase?.getCurrentUser?.();
    if (!supaUser) { toast('No hay usuario activo', true); return; }
    const username = supaUser.user_metadata?.username || supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'usuario';
    if (!confirm(`¿Cerrar sesión de "${username}"? Los datos están guardados en Supabase.`)) return;
    try {
        await window.AppSupabase?.signOutGoogle?.();
        if (typeof UserStore !== 'undefined') UserStore.clear();
        toast("✅ Sesión cerrada");
        setTimeout(() => window.location.href = 'index.html', AnimeDestiny.Constants.PROFILE_REDIRECT_DELAY_MS || 1000);
    } catch (e) {
        toast('Error al cerrar sesión: ' + e.message, true);
    }
});

/* ── Cerrar sesión ── */
document.getElementById('logoutBtn').addEventListener('click', async () => {
    const supaUser = await window.AppSupabase?.getCurrentUser?.();
    if (!supaUser) { toast('No hay usuario activo', true); return; }
    const username = supaUser.user_metadata?.username || supaUser.email?.split('@')[0] || 'usuario';
    if (!confirm(`¿Cerrar sesión de "${username}"? Tus datos están guardados en Supabase.`)) return;
    try {
        await window.logoutUser?.();
        toast("✅ Sesión cerrada");
        setTimeout(() => window.location.href = 'index.html', AnimeDestiny.Constants.PROFILE_REDIRECT_DELAY_MS || 1000);
    } catch (e) {
        toast('Error al cerrar sesión: ' + e.message, true);
    }
});

/* ── Borrar preferencias de UI ── */
document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (!confirm('¿Borrar las preferencias de visualización? Los datos de progreso están seguros en Supabase.')) return;
    ['pref:bgMode','pref:bgColor','pref:bgImage','pref:compactCards','pref:reduceMotion',
     'pref:showProgress','pref:notif','pref:contenido','pref:privacidad','pref:tema',
     'pref:pais','pref:idioma','pref:zona','pref:showBadges','pref:history','pref:nsfw'].forEach(k => localStorage.removeItem(k));
    if (typeof UserStore !== 'undefined') UserStore.clear();
    toast("✅ Preferencias borradas");
    setTimeout(() => window.location.href = 'index.html', AnimeDestiny.Constants.PROFILE_REDIRECT_DELAY_MS || 1000);
});

/* ── Guardar todo ── */
document.getElementById('saveAll').addEventListener('click', () => {
    document.getElementById('saveInfoPersonal').click();
    document.getElementById('savePreferencias').click();
    document.getElementById('saveApariencia').click();
    document.getElementById('saveFondo').click();
    document.getElementById('saveColores').click();
    if (cprToggle.checked) document.getElementById('saveCpr').click();
    toast("✅ Todos los cambios guardados");
});

/* ── Restablecer todo ── */
document.getElementById('resetAll').addEventListener('click', () => {
    if (!confirm('¿Restablecer todas las preferencias a los valores por defecto?')) return;
    ['pref:bgMode','pref:bgColor','pref:bgImage','pref:compactCards','pref:reduceMotion',
     'pref:showProgress','pref:notif','pref:contenido','pref:privacidad','pref:tema',
     'pref:pais','pref:idioma','pref:zona','pref:showBadges','pref:history','pref:nsfw'].forEach(k => localStorage.removeItem(k));
    syncUI();
    applyBgToPage();
    toast("✅ Preferencias restablecidas");
});

/* ── Init ── */
applyCustomColors();
applyBgToPage();
syncUI();

/* ── Actualizar nombre de usuario cuando Supabase cargue ── */
window.addEventListener('supabase-ready', () => {
    const nameEl = document.getElementById('cfgUserName');
    if (nameEl) nameEl.textContent = getCurrentUserName();
    if (typeof window.refreshUserUi === 'function') window.refreshUserUi();
}, { once: true });








