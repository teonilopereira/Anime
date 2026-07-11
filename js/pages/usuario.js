/* ── Helpers ── */
function read(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function write(key, val) {
    try { localStorage.setItem(key, val); } catch {}
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

/* ── Init ── */
applyBackgroundPreference();

/* Volver al origen */
document.getElementById('backBtn').addEventListener('click', function(e) {
    e.preventDefault();
    if (document.referrer && document.referrer !== location.href) {
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
    var content = document.getElementById('perfilContent');
    if (content) content.classList.remove('perfil-init-hidden');
}

async function initPage() {
    showLoader();
    var supabase = typeof window.waitForSupabase === 'function' ? await window.waitForSupabase() : window.AppSupabase;
    if (!supabase) { hideLoader(); return; }

    var user = await supabase.getCurrentUser();
    if (!user) {
        hideLoader();
        document.getElementById('userName').textContent = 'No has iniciado sesión';
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

    if (typeof window.refreshUserUi === 'function') {
        window.refreshUserUi();
    }
}

initPage().catch(function(e) {
    console.error('[usuario] Error en initPage:', e);
    hideLoader();
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
    document.getElementById('prefPrivacidad').textContent = read('pref:privacidad', 'publica') === 'privada' ? 'Privada 🔒' : 'Pública 🔒';

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

    var items = rawActivity.length ? rawActivity.slice(-4).reverse() : defaultActivity;

    document.getElementById('activityCards').innerHTML = items.map(function(a) {
        return '<div class="perfil-activity-card">' +
            '<div class="perfil-activity-icon-wrap ' + escapeHtml(a.color) + '">' + escapeHtml(a.icon) + '</div>' +
            '<div class="perfil-activity-info">' +
            '<div class="perfil-activity-title">' + escapeHtml(a.title) + '</div>' +
            '<div class="perfil-activity-time">' + escapeHtml(a.time) + '</div>' +
            '</div>' +
            '<div class="perfil-activity-arrow">›</div>' +
            '</div>';
    }).join('');
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

/* ── Cambio de avatar local (file) ── */
var avatarInput = document.getElementById('avatarInput');
var avatarInner = document.getElementById('avatarInner');

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

