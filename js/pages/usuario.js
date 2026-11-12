/* ── Helpers ── */
function read(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
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

function applyBackgroundPreference() {
    const body = document.body;
    const mode = read('pref:bgMode', 'default');
    body.style.removeProperty('background');
    body.style.removeProperty('background-image');
    body.style.removeProperty('background-color');
    body.style.removeProperty('background-repeat');
    body.style.removeProperty('background-size');
    body.style.removeProperty('background-position');
    body.style.removeProperty('background-attachment');
    if (mode === 'color') {
        const color = read('pref:bgColor', '#2b0a55');
        body.style.background = 'linear-gradient(180deg, #000000 0%, ' + color + ' 100%)';
        body.style.backgroundAttachment = 'fixed';
    } else if (mode === 'image') {
        const imageUrl = sanitizeBgUrl(read('pref:bgImage', ''));
        if (imageUrl) {
            body.style.backgroundImage = 'linear-gradient(rgba(0,0,0,.62), rgba(0,0,0,.76)), url("' + imageUrl + '")';
            body.style.backgroundSize = 'cover';
            body.style.backgroundPosition = 'center';
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundAttachment = 'fixed';
        }
    }
}

function levelFromPoints(pts) {
    var level = 1, need = AnimeDestiny.Constants.XP_BASE || 100, rem = Number(pts) || 0;
    while (rem >= need && level < (AnimeDestiny.Constants.XP_MAX_LEVEL || 50)) { rem -= need; level++; need = Math.floor(need * (AnimeDestiny.Constants.XP_MULTIPLIER || 1.2)); }
    return { level: level, current: rem, next: need };
}

function levelName(lvl) {
    if (lvl < 3) return 'Principiante';
    if (lvl < 6) return 'Explorador';
    if (lvl < 10) return 'Veterano';
    if (lvl < 15) return 'Élite';
    return 'Leyenda';
}

function formatTime(minutes) {
    if (!minutes || minutes < 1) return '0m';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        var d = new Date(iso);
        return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    } catch { return '—'; }
}

function displayName(user) {
    if (!user) return 'Invitado';
    return user.user_metadata?.username ||
           user.user_metadata?.name ||
           user.user_metadata?.full_name ||
           (user.email ? user.email.split('@')[0] : '') ||
           'Usuario';
}

// Etiquetas de apodo (grado). Mantener en sincronía con APODOS en
// js/pages/mis-listas.js y APODO_LABELS en js/core/auth.js.
var APODO_LABELS = {
    novato: 'Novato',
    corazon: 'Corazón de Otaku',
    coleccionista: 'Coleccionista',
    observador: 'Observador',
    devorador: 'Devorador de Mundos',
    primer_paso: 'Un Pasito',
    maratonista: 'Maratonista',
    veterano: 'Veterano',
    leyenda: 'Leyenda Mirudoku'
};

/* ── Comunidad: helpers puros (perfil público y muro) ──
 * Sin DOM ni red, para poder testearlos (tests/unit/usuario-publico.test.js).
 * La privacidad la hace cumplir la base (migración 013: solo is_public = true);
 * estos helpers son una segunda capa: lista blanca de campos y URLs seguras.
 */
var USERNAME_MAX = 128;

/** Lee ?u=<username> de un location.search. '' si no hay o es inválido. */
function leerUsernameDeUrl(search) {
    var raw = '';
    try { raw = new URLSearchParams(search || '').get('u') || ''; } catch (_) { return ''; }
    raw = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!raw || raw.length > USERNAME_MAX) return '';
    return raw;
}

/** Solo https: o data:image/ (avatar redimensionado que guarda usuario.js). */
function urlImagenSegura(url) {
    if (!url || typeof url !== 'string') return '';
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
    try {
        var u = new URL(url);
        return u.protocol === 'https:' ? u.href : '';
    } catch (_) { return ''; }
}

function enteroNoNegativo(v, min) {
    var n = Math.floor(Number(v));
    if (!isFinite(n)) n = 0;
    return Math.max(min || 0, n);
}

/**
 * Arma la tarjeta pública a partir de lo que devuelve getPublicProfile.
 * Lista blanca: aunque la fila traiga email, provider, id o exp, no salen.
 */
function armarPerfilPublico(row) {
    if (!row || typeof row !== 'object') return null;
    var username = String(row.username || '').trim();
    if (!username) return null;
    var nombre = String(row.display_name || '').trim() || username;
    return {
        nombre: nombre,
        username: username,
        foto: urlImagenSegura(row.photo_url),
        nivel: Math.min(enteroNoNegativo(row.level, 1), 50),
        apodo: row.apodo && APODO_LABELS[row.apodo] ? APODO_LABELS[row.apodo] : '',
        likes: enteroNoNegativo(row.total_likes),
        vistos: enteroNoNegativo(row.total_viewed)
    };
}

function tiempoRelativo(iso, ahora) {
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    var diff = Math.max(0, Math.round(((ahora || Date.now()) - t) / 1000));
    if (diff < 60) return 'hace un momento';
    var min = Math.floor(diff / 60);
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.floor(h / 24);
    if (d < 30) return d === 1 ? 'hace 1 día' : 'hace ' + d + ' días';
    try { return new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (_) { return ''; }
}

var MURO_VERBOS = { liked: 'le dio me gusta a', viewed: 'marcó como vista' };
var MURO_CATS = { anime: 1, manga: 1, novelas: 1 };

/** Convierte una fila de loadActivityFeed en datos listos para pintar (o null). */
function armarItemMuro(row, ahora) {
    if (!row || !row.username || !MURO_VERBOS[row.action] || !row.item_id) return null;
    var cat = MURO_CATS[row.category] ? row.category : '';
    var username = String(row.username);
    return {
        quien: String(row.display_name || '').trim() || username,
        perfilHref: 'usuario.html?u=' + encodeURIComponent(username),
        verbo: MURO_VERBOS[row.action],
        titulo: String(row.titulo || '').trim() || 'una obra',
        obraHref: cat ? 'detalle.html?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(String(row.item_id)) : '',
        img: urlImagenSegura(row.img),
        cuando: tiempoRelativo(row.created_at, ahora)
    };
}

window.PerfilPublico = {
    leerUsernameDeUrl: leerUsernameDeUrl,
    urlImagenSegura: urlImagenSegura,
    armarPerfilPublico: armarPerfilPublico,
    armarItemMuro: armarItemMuro,
    tiempoRelativo: tiempoRelativo
};

// Antes de initPage(): decide si la página es el perfil propio o uno público.
var _usernamePublico = leerUsernameDeUrl(window.location.search);
var _perfilPublicoCargado = false;

/* ── Init ── */
applyBackgroundPreference();

/* Volver al origen */
document.getElementById('backBtn').addEventListener('click', function(e) {
    e.preventDefault();
    if (window.history.length > 1) {
        history.back();
    } else {
        location.href = 'index.html';
    }
});

var _currentUser = null;
var _currentProfile = null;

function showLoader() {
    var loader = document.getElementById('perfilLoader');
    if (loader) loader.style.display = '';
}
function hideLoader() {
    var loader = document.getElementById('perfilLoader');
    if (loader) loader.style.display = 'none';
}
function showContent() {
    var guest = document.getElementById('perfilGuest');
    if (guest) guest.hidden = true;
    var content = document.getElementById('perfilContent');
    if (content) content.classList.remove('perfil-init-hidden');
}
function showGuest() {
    var content = document.getElementById('perfilContent');
    if (content) content.classList.add('perfil-init-hidden');
    var guest = document.getElementById('perfilGuest');
    if (!guest) {
        // Fallback: HTML viejo cacheado por el SW sin el panel de invitado.
        guest = document.createElement('section');
        guest.className = 'perfil-guest';
        guest.id = 'perfilGuest';
        guest.innerHTML =
            '<div class="perfil-guest-icon">👤</div>' +
            '<h2 class="perfil-guest-title">TU PERFIL TE ESPERA</h2>' +
            '<p class="perfil-guest-text">Inicia sesión para ver tu nivel, tus puntos, tus favoritos y tu actividad reciente.</p>' +
            '<div class="perfil-guest-btns">' +
            '<a href="Login.html" class="perfil-guest-btn-login">🚀 INICIAR SESIÓN</a>' +
            '<a href="index.html" class="perfil-guest-btn-back">← VOLVER AL INICIO</a>' +
            '</div>';
        var main = document.getElementById('main-content');
        if (main && content) main.insertBefore(guest, content);
        else if (main) main.appendChild(guest);
    }
    guest.hidden = false;
}

async function initPage() {
    if (_usernamePublico) { await initPerfilPublico(); return; }
    showLoader();
    var supabase = typeof window.waitForSupabase === 'function' ? await window.waitForSupabase() : window.AppSupabase;
    if (!supabase) { hideLoader(); showGuest(); return; }

    var user = await supabase.getCurrentUser();
    if (!user) {
        hideLoader();
        showGuest();
        return;
    }
    _currentUser = user;

    try {
        var { data } = await supabase.client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        _currentProfile = data || null;

        if (data && typeof data.exp === 'number' && window.UserStore) {
            window.UserStore.setItem('u:' + user.id + '|points', String(data.exp));
        }
    } catch (e) {
        console.warn('[usuario] Error cargando perfil:', e);
        _currentProfile = null;
    }

    if (supabase.loadItemStates) {
        try {
            var cats = ['anime', 'manga', 'novelas'];
            var results = await Promise.all(
                cats.map(function(c) { return supabase.loadItemStates(c); })
            );
            results.forEach(function(states) {
                if (!Array.isArray(states)) return;
                states.forEach(function(state) {
                    if (!state.item_id) return;
                    if (state.fav)    UserStore.setItem('u:' + user.id + '|item:' + state.item_id + '|fav', '1');
                    else              UserStore.removeItem('u:' + user.id + '|item:' + state.item_id + '|fav');
                    if (state.viewed) UserStore.setItem('u:' + user.id + '|item:' + state.item_id + '|viewed', '1');
                    else              UserStore.removeItem('u:' + user.id + '|item:' + state.item_id + '|viewed');
                });
            });
        } catch (e) {
            console.warn('[usuario] Error cargando estados:', e);
        }
    }

    window.__profileData = AnimeDestiny.internals.__profileData = _currentProfile || null;

    renderProfile(user, _currentProfile);

    hideLoader();
    showContent();

    if (typeof window.refreshUserUi === 'function') {
        window.refreshUserUi();
    }
}

initPage().catch(function(e) {
    console.error('[usuario] Error en initPage:', e);
    hideLoader();
    showContent();
    var nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = 'Error al cargar perfil';
});

function renderProfile(user, profile) {
    var name = profile?.display_name || displayName(user);
    var photoUrl = profile?.photo_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    var created = profile?.created_at || user.created_at;
    var email = user.email || '—';

    document.getElementById('userName').textContent = name;
    document.getElementById('memberSince').textContent = created ? formatDate(created) : '—';
    document.getElementById('infoEmail').textContent = email;

    // Apodo (grado) equipado
    var apodoEl = document.getElementById('perfilApodo');
    if (apodoEl) {
        var apodoLabel = profile && profile.apodo ? (APODO_LABELS[profile.apodo] || '') : '';
        if (apodoLabel) {
            apodoEl.textContent = '★ ' + apodoLabel;
            apodoEl.hidden = false;
        } else {
            apodoEl.hidden = true;
        }
    }

    var avatarInner = document.getElementById('avatarInner');
    var initials = document.getElementById('avatarInitials');
    var oldImg = avatarInner.querySelector('img');
    if (oldImg) oldImg.remove();

    if (photoUrl) {
        initials.style.display = 'none';
        var img = document.createElement('img');
        img.src = photoUrl;
        img.alt = name;
        img.onerror = function() {
            this.remove();
            initials.style.display = '';
            initials.textContent = name.slice(0, 2).toUpperCase();
        };
        avatarInner.appendChild(img);
    } else {
        initials.style.display = '';
        initials.textContent = name.slice(0, 2).toUpperCase();
    }

    var localExp = Number(window.UserStore?.getItem('u:' + user.id + '|points') || 0);
    var exp = Math.max(profile?.exp || 0, localExp);

    var localLikes = 0;
    var localViewed = 0;
    try {
        var prefix = 'u:' + user.id + '|item:';
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k.startsWith(prefix)) {
                if (k.endsWith('|fav') && localStorage.getItem(k) === '1') localLikes++;
                if (k.endsWith('|viewed') && localStorage.getItem(k) === '1') localViewed++;
            }
        }
    } catch {}

    var likes = Math.max(profile?.total_likes || 0, localLikes);
    var viewed = Math.max(profile?.total_viewed || 0, localViewed);
    
    var lv = levelFromPoints(exp);
    var level = Math.max(profile?.level || 1, lv.level);
    var levelPct = Math.min(100, Math.round((lv.current / lv.next) * 100));

    document.getElementById('cardLevel').textContent = level;
    document.getElementById('cardLevelLabel').textContent = levelName(level);
    document.getElementById('cardPoints').textContent = exp;
    document.getElementById('cardFavs').textContent = likes;
    document.getElementById('cardViewed').textContent = viewed;
    document.getElementById('levelBarFill').style.width = levelPct + '%';
    document.getElementById('levelPctText').textContent = levelPct + '% para el siguiente nivel';

    var sessions = Number(UserStore.getItem('u:' + user.id + '|sessions') || '1');
    var totalMinutes = Number(UserStore.getItem('u:' + user.id + '|totalMinutes') || '0');
    var explored = viewed;
    var avgMin = sessions > 0 ? Math.round(totalMinutes / sessions) : 0;

    document.getElementById('statTiempo').textContent = formatTime(totalMinutes);
    document.getElementById('statSesiones').textContent = sessions;
    document.getElementById('statExplorado').textContent = explored;
    document.getElementById('statPromedio').textContent = formatTime(avgMin);

    document.getElementById('prefTema').textContent = read('pref:bgMode', 'default') === 'default' ? 'Oscuro 🌙' : read('pref:bgMode') === 'color' ? 'Color 🎨' : 'Imagen 🖼';
    document.getElementById('prefNotif').textContent = read('pref:notif', 'on') === 'off' ? 'Desactivadas 🔕' : 'Activadas 🔔';
    document.getElementById('prefContenido').textContent = read('pref:contenido', 'personalizado') === 'general' ? 'General ⭐' : 'Personalizado ⭐';
    // La fuente de verdad es profiles.is_public (013); sin la columna, el cache local.
    var esPublico = profile && typeof profile.is_public === 'boolean'
        ? profile.is_public
        : read('pref:privacidad', 'privada') === 'publica';
    document.getElementById('prefPrivacidad').textContent = esPublico ? 'Pública 🌐' : 'Privada 🔒';

    var rawActivity = [];
    try {
        var stored = UserStore.getItem('u:' + user.id + '|activity') || '';
        if (stored) rawActivity.push.apply(rawActivity, JSON.parse(stored));
    } catch {}

    var defaultActivity = [
        { icon: '1', color: 'cyan',   title: 'Inicio de sesión',          time: 'Hoy, 14:35' },
        { icon: '\u2764', color: 'purple', title: 'Guardaste un favorito',  time: 'Hoy, 13:02' },
        { icon: '\uD83D\uDC41', color: 'pink',  title: 'Exploraste contenido',  time: 'Ayer, 21:47' },
        { icon: '⚙', color: 'orange', title: 'Configuración actualizada', time: 'Ayer, 18:22' }
    ];

    _allActivity = rawActivity.length ? rawActivity.slice().reverse() : defaultActivity;
    _activityExpanded = false;
    renderActivity();
}

var _allActivity = [];
var _activityExpanded = false;

function renderActivity() {
    var container = document.getElementById('activityCards');
    if (!container) return;

    var items = _activityExpanded ? _allActivity : _allActivity.slice(0, 4);
    container.innerHTML = items.map(function(a) {
        return '<div class="perfil-activity-card">' +
            '<div class="perfil-activity-icon-wrap ' + escapeHtml(a.color) + '">' + escapeHtml(a.icon) + '</div>' +
            '<div class="perfil-activity-info">' +
            '<div class="perfil-activity-title">' + escapeHtml(a.title) + '</div>' +
            '<div class="perfil-activity-time">' + escapeHtml(a.time) + '</div>' +
            '</div>' +
            '<div class="perfil-activity-arrow">›</div>' +
            '</div>';
    }).join('');

    var link = document.getElementById('verActividadBtn');
    if (link) {
        if (_allActivity.length <= 4) {
            link.hidden = true;
        } else {
            link.hidden = false;
            link.textContent = _activityExpanded ? '← VER MENOS' : 'VER TODA LA ACTIVIDAD →';
        }
    }
}

/* ── Editar perfil ── */
var editModeActive = false;

function toggleEditMode() {
    editModeActive = !editModeActive;
    var nameEl = document.getElementById('userName');
    var btn = document.getElementById('editProfileBtn');

    if (editModeActive) {
        var currentName = nameEl.textContent;
        nameEl.innerHTML = '<input type="text" id="editNameInput" class="perfil-edit-input" value="' + escapeHtml(currentName) + '" style="width:200px">';
        btn.textContent = '\u2714 GUARDAR';
    } else {
        saveProfile();
    }
}

async function saveProfile() {
    var supabase = window.AppSupabase;
    if (!supabase || !_currentUser) return;

    var newName = document.getElementById('editNameInput')?.value?.trim() || displayName(_currentUser);

    var nameEl = document.getElementById('userName');
    nameEl.textContent = newName;
    document.getElementById('editProfileBtn').textContent = '\u270F EDITAR PERFIL';

    try {
        await supabase.saveUserProfile(_currentUser, {
            display_name: newName
        });
        if (_currentProfile) {
            _currentProfile.display_name = newName;
        }
        window.__profileData = AnimeDestiny.internals.__profileData = _currentProfile || null;
        if (typeof window.refreshUserUi === 'function') {
            window.refreshUserUi();
        }
    } catch (e) {
        console.error('[usuario] Error guardando perfil:', e);
        alert('Error al guardar: ' + e.message);
    }
}

/* ── Editar información personal ── */
function toggleInfoEdit() {
    var btn = document.getElementById('cambiarInfoBtn');
    var emailRow = document.getElementById('infoEmail');

    if (btn.textContent.includes('CAMBIAR')) {
        var currentEmail = emailRow.textContent;
        emailRow.innerHTML = '<input type="email" id="editEmailInput" class="perfil-edit-input" value="' + escapeHtml(currentEmail) + '" style="width:250px">';
        btn.textContent = '✔ GUARDAR INFORMACIÓN';
    } else {
        saveInfo();
    }
}

async function saveInfo() {
    var supabase = window.AppSupabase;
    if (!supabase || !_currentUser) return;

    var newEmail = document.getElementById('editEmailInput')?.value?.trim() || _currentUser.email || '';

    document.getElementById('infoEmail').textContent = newEmail;
    document.getElementById('cambiarInfoBtn').textContent = '✏ CAMBIAR INFORMACIÓN';

    try {
        await supabase.saveUserProfile(_currentUser, { email: newEmail });
    } catch (e) {
        console.error('[usuario] Error guardando email:', e);
        alert('Error al guardar: ' + e.message);
    }
}

// ── Init ──
window.addEventListener('supabase-auth-changed', function() {
    try { initPage(); } catch (e) { console.error('[usuario] Error en auth change:', e); }
});

// ── Botones ──
document.getElementById('editProfileBtn').addEventListener('click', function(e) {
    e.preventDefault();
    toggleEditMode();
});

document.getElementById('cambiarInfoBtn').addEventListener('click', function() {
    toggleInfoEdit();
});

var verActividadBtn = document.getElementById('verActividadBtn');
if (verActividadBtn) {
    verActividadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        _activityExpanded = !_activityExpanded;
        renderActivity();
    });
}

/* ── Cambio de avatar local (file) ── */
var avatarInput = document.getElementById('avatarInput');

document.getElementById('avatarRing').addEventListener('click', function() { avatarInput.click(); });
document.getElementById('changeImgBtn').addEventListener('click', function(e) { e.stopPropagation(); avatarInput.click(); });

async function uploadAvatarToSupabase(file) {
    var supabase = window.AppSupabase;
    if (!supabase || !_currentUser) return null;

    // Try Storage bucket first
    try {
        var ext = (file.name || '').split('.').pop().toLowerCase() || 'png';
        var fileName = _currentUser.id + '/' + Date.now() + '.' + ext;

        var { error: upErr } = await supabase.client.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true, contentType: file.type });

        if (!upErr) {
            var { data: urlData } = supabase.client.storage
                .from('avatars')
                .getPublicUrl(fileName);
            if (urlData?.publicUrl) return urlData.publicUrl;
        }
        console.warn('[avatar] Storage upload failed, falling back to base64:', upErr?.message);
    } catch (e) {
        console.warn('[avatar] Storage error:', e);
    }

    // Fallback: resize & store as Base64 in profile
    return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var MAX = 200;
                var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

avatarInput.addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    this.value = '';

    // Immediate preview via FileReader
    var readerPreview = new FileReader();
    readerPreview.onload = function(ev) {
        var avatarInnerEl = document.getElementById('avatarInner');
        var oldImg = avatarInnerEl.querySelector('img');
        if (oldImg) oldImg.remove();
        var initials = document.getElementById('avatarInitials');
        if (initials) initials.style.display = 'none';

        var preview = document.createElement('img');
        preview.src = ev.target.result;
        preview.alt = 'Avatar';
        avatarInnerEl.appendChild(preview);
    };
    readerPreview.readAsDataURL(file);

    // Upload & save to profile
    uploadAvatarToSupabase(file).then(function(publicUrl) {
        if (!publicUrl || !_currentUser) return;
        var sb = window.AppSupabase;
        if (!sb) return;
        var newName = (_currentProfile?.display_name) || (sb.supabaseUserName ? sb.supabaseUserName(_currentUser) : '');
        sb.saveUserProfile(_currentUser, { photo_url: publicUrl, display_name: newName })
          .then(function() {
              if (_currentProfile) _currentProfile.photo_url = publicUrl;
              // Update the preview with the persisted URL if it's not base64
              if (!publicUrl.startsWith('data:')) {
                  var avatarInnerEl = document.getElementById('avatarInner');
                  var existImg = avatarInnerEl.querySelector('img');
                  if (existImg) existImg.src = publicUrl;
              }
          })
          .catch(function(e) { console.warn('[avatar] Error saving profile:', e); });
    });
});

/* Registrar sesión */
(function() {
    var sessionUser = window.AppSupabase?.getCurrentUserSync?.();
    if (!sessionUser) return;
    var currentSessions = Number(UserStore.getItem('u:' + sessionUser.id + '|sessions') || '0') || 0;
    var lastSession = UserStore.getItem('u:' + sessionUser.id + '|lastSession') || '';
    var now = new Date().toISOString();
    var today = now.slice(0, 10);
    if (lastSession.slice(0, 10) !== today) {
        UserStore.setItem('u:' + sessionUser.id + '|sessions', String(currentSessions + 1));
        UserStore.setItem('u:' + sessionUser.id + '|lastSession', now);
    }
})();



/* ══════════════════════════════════════════════════════════════
   Comunidad: perfil público (usuario.html?u=<username>) y muro
   ══════════════════════════════════════════════════════════════ */


/** Cliente de Supabase también para visitantes sin sesión (carga diferida). */
async function clienteComunidad() {
    if (window.AppSupabase) return window.AppSupabase;
    try {
        if (typeof window.waitForSupabase === 'function') {
            var sb = await window.waitForSupabase();
            if (sb) return sb;
        }
        if (typeof window.__loadSupabase === 'function') return await window.__loadSupabase();
    } catch (e) { console.warn('[comunidad] Supabase no disponible:', e); }
    return window.AppSupabase || null;
}

function mostrarSolo(idVisible) {
    ['perfilGuest', 'perfilPublico', 'perfilPublicoVacio'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = id !== idVisible;
    });
    var content = document.getElementById('perfilContent');
    if (content) content.classList.add('perfil-init-hidden');
}

function pintarAvatar(contenedor, iniciales, foto, nombre) {
    var vieja = contenedor.querySelector('img');
    if (vieja) vieja.remove();
    iniciales.textContent = nombre.slice(0, 2).toUpperCase();
    iniciales.style.display = '';
    if (!foto) return;
    var img = document.createElement('img');
    img.alt = '';
    img.src = foto;
    img.onerror = function () { img.remove(); iniciales.style.display = ''; };
    iniciales.style.display = 'none';
    contenedor.appendChild(img);
}

async function initPerfilPublico() {
    if (_perfilPublicoCargado) return;
    _perfilPublicoCargado = true;
    showLoader();

    var title = document.getElementById('perfilPageTitle');
    var lead = document.getElementById('perfilPageLead');
    if (title) title.textContent = 'PERFIL';
    if (lead) lead.textContent = 'Lo que esta persona eligió mostrar en Mirudoku.';

    var perfil = null;
    var sb = await clienteComunidad();
    if (sb && sb.getPublicProfile) {
        try { perfil = armarPerfilPublico(await sb.getPublicProfile(_usernamePublico)); }
        catch (e) { console.warn('[comunidad] getPublicProfile:', e); }
    }
    hideLoader();

    if (!perfil) {
        var texto = document.getElementById('perfilPublicoVacioTexto');
        if (texto && !sb) texto.textContent = 'No pudimos cargar perfiles ahora. Probá de nuevo en un rato.';
        mostrarSolo('perfilPublicoVacio');
        return;
    }

    document.title = 'Mirudoku | ' + perfil.nombre;
    document.getElementById('ppubNombre').textContent = perfil.nombre;
    document.getElementById('ppubUsername').textContent = '@' + perfil.username;
    var apodo = document.getElementById('ppubApodo');
    apodo.hidden = !perfil.apodo;
    apodo.textContent = perfil.apodo ? '★ ' + perfil.apodo : '';
    document.getElementById('ppubNivel').textContent = String(perfil.nivel);
    document.getElementById('ppubNivelLabel').textContent = levelName(perfil.nivel);
    document.getElementById('ppubLikes').textContent = String(perfil.likes);
    document.getElementById('ppubVistos').textContent = String(perfil.vistos);
    pintarAvatar(document.getElementById('ppubAvatar'), document.getElementById('ppubIniciales'), perfil.foto, perfil.nombre);
    mostrarSolo('perfilPublico');
}

/* ── Muro de actividad paginado ── */
var MURO_PAGINA = 20;
var _muroOffset = 0;
var _muroCargando = false;
var _muroIniciado = false;

function nodoItemMuro(item) {
    var li = document.createElement('li');
    li.className = 'muro-item';
    if (item.img) {
        var img = document.createElement('img');
        img.className = 'muro-item-img';
        img.src = item.img;
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = function () { img.remove(); };
        li.appendChild(img);
    }
    var texto = document.createElement('div');
    texto.className = 'muro-item-texto';
    var quien = document.createElement('a');
    quien.href = item.perfilHref;
    quien.textContent = item.quien;
    texto.appendChild(quien);
    texto.appendChild(document.createTextNode(' ' + item.verbo + ' '));
    var obra = document.createElement(item.obraHref ? 'a' : 'strong');
    if (item.obraHref) obra.href = item.obraHref;
    obra.textContent = item.titulo;
    texto.appendChild(obra);
    if (item.cuando) {
        var cuando = document.createElement('span');
        cuando.className = 'muro-item-cuando';
        cuando.textContent = item.cuando;
        texto.appendChild(cuando);
    }
    li.appendChild(texto);
    return li;
}

async function loadMuroPagina() {
    if (_muroCargando) return;
    var lista = document.getElementById('muroLista');
    var estado = document.getElementById('muroEstado');
    var mas = document.getElementById('muroMasBtn');
    if (!lista) return;
    _muroCargando = true;
    if (mas) mas.disabled = true;
    if (estado) estado.textContent = 'Cargando actividad…';

    var filas = null;
    var sb = await clienteComunidad();
    if (sb && sb.loadActivityFeed) {
        // Se pide uno de más para saber si hay otra página sin un COUNT.
        try { filas = await sb.loadActivityFeed(MURO_PAGINA + 1, _muroOffset); }
        catch (e) { console.warn('[comunidad] loadActivityFeed:', e); }
    }
    _muroCargando = false;
    if (mas) mas.disabled = false;

    if (!Array.isArray(filas)) {
        if (estado) estado.textContent = 'No pudimos cargar el muro ahora. Probá de nuevo en un rato.';
        if (mas) mas.hidden = _muroOffset === 0;
        return;
    }

    var hayMas = filas.length > MURO_PAGINA;
    var pagina = filas.slice(0, MURO_PAGINA);
    _muroOffset += pagina.length;
    var ahora = Date.now();
    pagina.forEach(function (row) {
        var item = armarItemMuro(row, ahora);
        if (item) lista.appendChild(nodoItemMuro(item));
    });

    if (estado) {
        estado.textContent = lista.children.length ? (hayMas ? '' : 'Llegaste al final del muro.')
            : 'Todavía no hay actividad pública. Cuando alguien con perfil público marque una obra, aparece acá.';
    }
    if (mas) mas.hidden = !hayMas;
}

function initMuro() {
    var seccion = document.getElementById('muroActividad');
    if (!seccion || _muroIniciado) return;
    var arrancar = function () {
        if (_muroIniciado) return;
        _muroIniciado = true;
        loadMuroPagina();
    };
    var mas = document.getElementById('muroMasBtn');
    if (mas) mas.addEventListener('click', function () { loadMuroPagina(); });
    // Diferido hasta que se ve: para un visitante sin sesión el muro es lo
    // único que obliga a descargar el SDK de Supabase.
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); arrancar(); }
        }, { rootMargin: '200px' });
        io.observe(seccion);
    } else {
        arrancar();
    }
}

initMuro();
