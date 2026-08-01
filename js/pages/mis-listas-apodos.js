// js/pages/mis-listas-apodos.js
// Sistema de APODOS (títulos equipables) de "Mis Listas", extraído de
// mis-listas.js. Ámbito global (script clásico con defer).
// Usa FRANQUICIAS/getViewedIdSet/franquiciaVista definidos en
// mis-listas-logros.js (se carga después de ese archivo).

// ─── Apodos (títulos) que se desbloquean con logros ───
const APODOS = Object.freeze([
    { id: 'novato',        nick: 'Novato',              desc: 'Disponible desde el comienzo.',        test: function () { return true; } },
    { id: 'corazon',       nick: 'Corazón de Otaku',    desc: 'Marcá 1 título como "Me gusta".',      test: function (s) { return s.fav >= 1; } },
    { id: 'coleccionista', nick: 'Coleccionista',       desc: 'Marcá 10 títulos como "Me gusta".',    test: function (s) { return s.fav >= 10; } },
    { id: 'observador',    nick: 'Observador',          desc: 'Marcá 1 título como "Visto".',         test: function (s) { return s.viewed >= 1; } },
    { id: 'devorador',     nick: 'Devorador de Mundos', desc: 'Marcá 50 títulos como "Visto".',       test: function (s) { return s.viewed >= 50; } },
    { id: 'primer_paso',   nick: 'Un Pasito',           desc: 'Marcá tu primer capítulo o episodio.', test: function (s) { return s.eps >= 1; } },
    { id: 'maratonista',   nick: 'Maratonista',         desc: 'Marcá 100 capítulos o episodios.',     test: function (s) { return s.eps >= 100; } },
    { id: 'veterano',      nick: 'Veterano',            desc: 'Alcanzá el nivel 5.',                  test: function (s) { return s.level >= 5; } },
    { id: 'leyenda',       nick: 'Leyenda Destiny',     desc: 'Alcanzá el nivel 10.',                 test: function (s) { return s.level >= 10; } },

    // — Apodos de franquicia: se ganan viendo obras concretas —
    { id: 'hechicero_actual',   nick: 'El Hechicero Más Fuerte Actual',        desc: 'Marcá Jujutsu Kaisen (anime) como "Visto".',                test: function (s) { return franquiciaVista(s.vistos, 'jjk_anime'); } },
    { id: 'hechicero_historia', nick: 'El Hechicero Más Fuerte de la Historia', desc: 'Marcá el anime y el manga de Jujutsu Kaisen como "Visto".', test: function (s) { return franquiciaVista(s.vistos, 'jjk_anime') && franquiciaVista(s.vistos, 'jjk_manga'); } },
    { id: 'rey_piratas',        nick: 'El Próximo Rey de los Piratas',         desc: 'Marcá One Piece como "Visto".',                             test: function (s) { return franquiciaVista(s.vistos, 'onepiece'); } },
    { id: 'hokage',             nick: 'Séptimo Hokage',                        desc: 'Marcá Naruto y Naruto: Shippuden como "Visto".',            test: function (s) { return s.vistos.has('20') && s.vistos.has('1735'); } },
    { id: 'soldado',            nick: 'El Soldado Más Fuerte de la Humanidad', desc: 'Marcá Attack on Titan como "Visto".',                       test: function (s) { return franquiciaVista(s.vistos, 'aot'); } },
    { id: 'espadachin_negro',   nick: 'El Espadachín Negro',                   desc: 'Marcá Berserk (manga) como "Visto".',                       test: function (s) { return franquiciaVista(s.vistos, 'berserk'); } },
    { id: 'monarca',            nick: 'Monarca de las Sombras',                desc: 'Marcá Solo Leveling como "Visto".',                         test: function (s) { return franquiciaVista(s.vistos, 'sololeveling'); } },
    { id: 'simbolo_paz',        nick: 'El Símbolo de la Paz',                  desc: 'Marcá My Hero Academia como "Visto".',                      test: function (s) { return franquiciaVista(s.vistos, 'mha'); } },
    { id: 'pilar',              nick: 'Pilar del Agua',                        desc: 'Marcá Demon Slayer como "Visto".',                          test: function (s) { return franquiciaVista(s.vistos, 'demonslayer'); } },
    { id: 'kira',               nick: 'Kira',                                  desc: 'Marcá Death Note como "Visto".',                            test: function (s) { return franquiciaVista(s.vistos, 'deathnote'); } }
]);

function computeApodoStats(userId) {
    const stats = { fav: 0, viewed: 0, eps: 0, level: 1, pts: 0, vistos: getViewedIdSet(userId) };
    if (userId === 'Invitado') return stats;

    UserStore.keys().forEach(function (key) {
        if (!key.startsWith('u:' + userId + '|') || !UserStore.getItem(key)) return;
        if (key.endsWith('|fav')) stats.fav++;
        if (key.endsWith('|viewed')) stats.viewed++;
        if (key.includes('|ep:') || key.includes('|ch:') || key.includes('|vol:')) stats.eps++;
    });

    stats.pts = (typeof getUserPoints === 'function')
        ? getUserPoints(userId)
        : Number(UserStore.getItem('u:' + userId + '|points') || '0');
    const lv = (typeof levelFromPoints === 'function') ? levelFromPoints(stats.pts) : { level: 1 };
    const dbLevel = Number(UserStore.getItem('u:' + userId + '|level') || '0');
    stats.level = Math.max(dbLevel, lv.level);
    return stats;
}

function getActiveApodo(userId, stats) {
    let active = UserStore.getItem('u:' + userId + '|apodo') || 'novato';
    const def = APODOS.find(function (a) { return a.id === active; });
    // Si el apodo equipado ya no está desbloqueado, volver al por defecto
    if (!def || (stats && !def.test(stats))) active = 'novato';
    return active;
}

function getActiveApodoNick(userId) {
    const stats = computeApodoStats(userId);
    const active = getActiveApodo(userId, stats);
    const def = APODOS.find(function (a) { return a.id === active; });
    return def ? def.nick : 'Novato';
}

function renderApodos() {
    const host = document.getElementById('apodosGrid');
    if (!host) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        host.innerHTML = '<div class="lists-empty" style="grid-column:1/-1"><h3>Iniciá sesión</h3><p>Entrá con tu cuenta para desbloquear y equipar apodos.</p></div>';
        return;
    }

    const stats = computeApodoStats(userId);
    const active = getActiveApodo(userId, stats);

    host.innerHTML = APODOS.map(function (a) {
        const unlocked = a.test(stats);
        const isActive = unlocked && a.id === active;
        const badge = isActive ? 'Equipado' : (unlocked ? 'Equipar' : 'Bloqueado');
        return '<div class="apodo-card ' + (unlocked ? 'is-unlocked' : 'is-locked') + (isActive ? ' is-equipped' : '') + '"' +
            ' data-apodo="' + escapeHtml(a.id) + '"' + (unlocked ? ' role="button" tabindex="0"' : '') + '>' +
            '<div class="apodo-top">' +
                '<span class="apodo-nick">' + (unlocked ? escapeHtml(a.nick) : '???') + '</span>' +
                '<span class="apodo-badge">' + badge + '</span>' +
            '</div>' +
            '<div class="apodo-desc">' + escapeHtml(a.desc) + '</div>' +
        '</div>';
    }).join('');
}

function equipApodo(apodoId) {
    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') return;
    const stats = computeApodoStats(userId);
    const def = APODOS.find(function (a) { return a.id === apodoId; });
    if (!def || !def.test(stats)) return; // no equipar bloqueados
    UserStore.setItem('u:' + userId + '|apodo', apodoId);
    renderApodos();
    renderProfileSummary();
    if (window.Toast) window.Toast.success('Apodo equipado: ' + def.nick);

    // Reflejar el cambio en el badge del navbar al instante. El orden importa:
    // primero se pisa window.__profileData.apodo y despues se llama a
    // refreshUserUi, porque resolveGrade mira el perfil en memoria antes de ir
    // a Supabase — si no, la consulta puede ganarle al saveApodo de abajo y el
    // navbar quedaria mostrando el apodo anterior.
    window.__profileData = Object.assign({}, window.__profileData, { apodo: apodoId });
    if (typeof window.refreshUserUi === 'function') window.refreshUserUi();

    // Persistir en Supabase (si hay sesión y la columna existe)
    if (window.AppSupabase && typeof window.AppSupabase.saveApodo === 'function') {
        Promise.resolve(window.AppSupabase.saveApodo(apodoId)).catch(function (e) {
            console.warn('[mis-listas] No se pudo guardar el apodo en Supabase:', e);
            // Si falla, el apodo solo vive en memoria y se pierde al recargar:
            // conviene decirlo en vez de dejar el "Apodo equipado" mintiendo.
            if (window.Toast) window.Toast.error('El apodo no se pudo guardar; se va a perder al recargar.');
        });
    }
}
