// js/pages/mis-listas-logros.js
// Sistema de LOGROS de "Mis Listas", extraído de mis-listas.js.
// Ámbito global (script clásico con defer), igual que mis-listas.js: todas
// estas funciones quedan disponibles para el resto de la página en runtime.
// Incluye además los helpers de franquicias (FRANQUICIAS, getViewedIdSet,
// franquiciaVista) que comparten logros y apodos; por eso este archivo se
// carga antes que mis-listas-apodos.js.

// ─── EXP por logros + idempotencia persistente ───
// UserStore es solo en memoria; para no premiar EXP dos veces al recargar,
// los flags "ya premiado" se guardan en localStorage (los logros son monótonos).
const ACHV_EXP_COMMON = 25;
const ACHV_EXP_SECRET = 50;

function _lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* storage lleno/bloqueado */ } }
function _achvGrantKey(userId, id) { return 'ad:achvGrant:' + userId + ':' + id; }
function _achvInitKey(userId) { return 'ad:achvInit:' + userId; }

// ─── Franquicias: ids aceptados por obra, para logros y apodos ───
// Ids de AniList VERIFICADOS contra su API (un id inventado hace el logro
// imposible de sacar en silencio). Cada obra lista todas las variantes que
// cuentan: temporadas del anime, el manga/novela, y para Berserk tambien el
// UUID de MangaDex, porque una card servida por MangaDex marca ese id y no el
// de AniList.
const FRANQUICIAS = Object.freeze({
    jjk_anime:    [113415, 145064],                        // JJK S1 + S2
    jjk_manga:    [101517],
    naruto:       [20, 1735],                              // Naruto + Shippuden
    onepiece:     [21, 30013],                             // anime + manga
    bleach:       [269, 116674],                           // Bleach + TYBW
    aot:          [16498, 20958, 99147, 104578, 110277],   // todas las temporadas
    demonslayer:  [101922, 87216],                         // anime + manga
    deathnote:    [1535, 30021],                           // anime + manga
    fmab:         [5114],
    berserk:      [30002, '801513ba-a712-498c-8f57-cae55b38cc92'],
    sololeveling: [151807, 105398],                        // anime + manhwa
    mushoku:      [85470, 108465],                         // novela + anime
    rezero:       [85737, 21355],                          // novela + anime
    frieren:      [154587],
    csm:          [127230, 105778],                        // anime + manga
    mha:          [21459],
    hxh:          [11061]
});

// Set con los ids marcados como "Visto" por el usuario, para consultar
// franquicias sin recorrer UserStore una vez por regla.
function getViewedIdSet(userId) {
    const vistos = new Set();
    if (!userId || userId === 'Invitado') return vistos;
    const prefix = 'u:' + userId + '|item:';
    UserStore.keys().forEach(function (key) {
        if (!key.startsWith(prefix) || !key.endsWith('|viewed')) return;
        if (!UserStore.getItem(key)) return;
        vistos.add(key.slice(prefix.length, key.length - '|viewed'.length));
    });
    return vistos;
}

function franquiciaVista(vistos, clave) {
    return (FRANQUICIAS[clave] || []).some(function (id) { return vistos.has(String(id)); });
}

function renderAchievements() {
    const host = document.getElementById('achievementsGrid');
    if (!host) return;

    const userId = getCurrentUserIdSafe();
    const lists = { fav: 0, viewed: 0, eps: 0 };
    if (userId !== 'Invitado') {
        UserStore.keys().forEach((key) => {
            if (!key.startsWith(`u:${userId}|`) || !UserStore.getItem(key)) return;
            if (key.endsWith('|fav')) lists.fav++;
            if (key.endsWith('|viewed')) lists.viewed++;
            if (key.includes('|ep:') || key.includes('|ch:') || key.includes('|vol:')) lists.eps++;
        });
    }

    // Conteo por categoría para logros temáticos (anime / manga / novelas)
    const catViewed = { anime: 0, manga: 0, novelas: 0 };
    if (userId !== 'Invitado') {
        getAllItems().forEach(function (item) {
            const cat = item.__category;
            if (catViewed[cat] === undefined) return;
            if (UserStore.getItem('u:' + userId + '|item:' + item.id + '|viewed')) catViewed[cat]++;
        });
    }

    // Nivel del usuario para logros de nivel
    const achvPts = (typeof getUserPoints === 'function')
        ? getUserPoints(userId)
        : Number(UserStore.getItem('u:' + userId + '|points') || '0');
    const achvLvInfo = (typeof levelFromPoints === 'function') ? levelFromPoints(achvPts) : { level: 1 };
    const achvDbLevel = Number(UserStore.getItem('u:' + userId + '|level') || '0');
    const level = Math.max(achvDbLevel, achvLvInfo.level);
    const totalSaved = lists.fav + lists.viewed;

    // Vistos por id, para los logros atados a obras concretas
    const vistos = getViewedIdSet(userId);
    const fr = function (clave) { return franquiciaVista(vistos, clave); };

    // Racha diaria: el mejor histórico decide los logros de racha (una vez que
    // se alcanzó un hito, no se pierde aunque después se corte la racha).
    const streakInfo = (window.AppStreak && typeof window.AppStreak.getStreak === 'function')
        ? window.AppStreak.getStreak(userId)
        : { count: 0, best: 0 };
    const bestStreak = Math.max(Number(streakInfo.best) || 0, Number(streakInfo.count) || 0);

    const rules = [
        // — Me gusta —
        { id: 'fav1',  title: 'Corazón de Otaku',     desc: 'Marcá 1 título como "Me gusta".',   req: lists.fav >= 1,  icon: '❤️' },
        { id: 'fav5',  title: 'Nakama',                desc: 'Marcá 5 títulos como "Me gusta".',  req: lists.fav >= 5,  icon: '🤝' },
        { id: 'fav10', title: 'Coleccionista',         desc: 'Marcá 10 títulos como "Me gusta".', req: lists.fav >= 10, icon: '🌟' },
        { id: 'fav25', title: 'Corazón Gentil',        desc: 'Marcá 25 títulos como "Me gusta".', req: lists.fav >= 25, icon: '💗', secret: true },
        { id: 'fav50', title: 'Rey de los Piratas',    desc: 'Marcá 50 títulos como "Me gusta".', req: lists.fav >= 50, icon: '🏴‍☠️', secret: true },
        { id: 'fav100', title: 'Emperador del Harem',  desc: 'Marcá 100 títulos como "Me gusta".', req: lists.fav >= 100, icon: '👑', secret: true },

        // — Vistos —
        { id: 'view1',   title: 'Primer Vistazo',      desc: 'Marcá 1 título como "Visto".',   req: lists.viewed >= 1,   icon: '👁️' },
        { id: 'view10',  title: 'Cazador Novato',      desc: 'Marcá 10 títulos como "Visto".', req: lists.viewed >= 10,  icon: '🗡️' },
        { id: 'view25',  title: 'Alquimista de Acero', desc: 'Marcá 25 títulos como "Visto".', req: lists.viewed >= 25,  icon: '⚗️' },
        { id: 'view50',  title: 'Devorador de Mundos', desc: 'Marcá 50 títulos como "Visto".', req: lists.viewed >= 50,  icon: '🔥', secret: true },
        { id: 'view100', title: 'Dios de la Muerte',   desc: 'Marcá 100 títulos como "Visto".', req: lists.viewed >= 100, icon: '💀', secret: true },
        { id: 'view250', title: 'El Que Todo Lo Vio',  desc: 'Marcá 250 títulos como "Visto".', req: lists.viewed >= 250, icon: '🌌', secret: true },

        // — Progreso (episodios / capítulos) —
        { id: 'ep1',    title: 'Un Pasito',        desc: 'Marcá tu primer capítulo o episodio.', req: lists.eps >= 1,    icon: '🎬' },
        { id: 'ep10',   title: 'Ganbatte!',        desc: 'Marcá 10 capítulos o episodios.',      req: lists.eps >= 10,   icon: '💪' },
        { id: 'ep50',   title: 'Plus Ultra',       desc: 'Marcá 50 capítulos o episodios.',      req: lists.eps >= 50,   icon: '⚡' },
        { id: 'ep100',  title: 'Maratonista',      desc: 'Marcá 100 capítulos o episodios.',     req: lists.eps >= 100,  icon: '🏃', secret: true },
        { id: 'ep500',  title: 'Sennin del Binge', desc: 'Marcá 500 capítulos o episodios.',     req: lists.eps >= 500,  icon: '🧙', secret: true },
        { id: 'ep1000', title: 'El Elegido',       desc: 'Marcá 1000 capítulos o episodios.',    req: lists.eps >= 1000, icon: '🌠', secret: true },

        // — Nivel —
        { id: 'level5',  title: 'Aprendiz de Hokage', desc: 'Alcanzá el nivel 5.',  req: level >= 5,  icon: '🍥' },
        { id: 'level10', title: 'Caballero de Élite', desc: 'Alcanzá el nivel 10.', req: level >= 10, icon: '🛡️' },
        { id: 'level20', title: 'Súper Saiyajin',     desc: 'Alcanzá el nivel 20.', req: level >= 20, icon: '💥', secret: true },
        { id: 'level30', title: 'Ultra Instinto',     desc: 'Alcanzá el nivel 30.', req: level >= 30, icon: '🔱', secret: true },

        // — Racha diaria (días seguidos entrando) —
        { id: 'racha3',   title: 'Hábito Naciente',   desc: 'Mantené una racha de 3 días seguidos.',   req: bestStreak >= 3,   icon: '🔥' },
        { id: 'racha7',   title: 'Semana Perfecta',   desc: 'Mantené una racha de 7 días seguidos.',   req: bestStreak >= 7,   icon: '📅' },
        { id: 'racha14',  title: 'Rutina Otaku',      desc: 'Mantené una racha de 14 días seguidos.',  req: bestStreak >= 14,  icon: '⏳', secret: true },
        { id: 'racha30',  title: 'Disciplina Shonen', desc: 'Mantené una racha de 30 días seguidos.',  req: bestStreak >= 30,  icon: '🗓️', secret: true },
        { id: 'racha100', title: 'Voluntad de Acero', desc: 'Mantené una racha de 100 días seguidos.', req: bestStreak >= 100, icon: '💯', secret: true },

        // — Temáticos por categoría —
        { id: 'anime15',  title: 'Maestro del Anime',   desc: 'Marcá 15 animes como "Visto".',   req: catViewed.anime >= 15,   icon: '📺' },
        { id: 'anime30',  title: 'Otaku de Élite',      desc: 'Marcá 30 animes como "Visto".',   req: catViewed.anime >= 30,   icon: '🎇', secret: true },
        { id: 'manga15',  title: 'Rincón del Mangaka',  desc: 'Marcá 15 mangas como "Visto".',   req: catViewed.manga >= 15,   icon: '📖' },
        { id: 'manga30',  title: 'Sabio del Manga',     desc: 'Marcá 30 mangas como "Visto".',   req: catViewed.manga >= 30,   icon: '🖌️', secret: true },
        { id: 'novela10', title: 'Isekai Trotamundos',  desc: 'Marcá 10 novelas como "Visto".',  req: catViewed.novelas >= 10, icon: '📜' },
        { id: 'novela25', title: 'Erudito de Novelas',  desc: 'Marcá 25 novelas como "Visto".',  req: catViewed.novelas >= 25, icon: '📚', secret: true },
        { id: 'trifecta', title: 'Camino del Héroe',    desc: 'Terminá al menos 1 anime, 1 manga y 1 novela.', req: catViewed.anime >= 1 && catViewed.manga >= 1 && catViewed.novelas >= 1, icon: '🎌', secret: true },

        // — Franquicias (obras concretas, cualquier variante listada cuenta) —
        { id: 'fr_jjk',      title: 'Estudiante de Jujutsu',       desc: 'Marcá Jujutsu Kaisen (anime) como "Visto".',                  req: fr('jjk_anime'), icon: '🌀' },
        { id: 'fr_naruto',   title: 'Camino del Ninja',            desc: 'Marcá Naruto o Naruto: Shippuden como "Visto".',              req: fr('naruto'), icon: '🍃' },
        { id: 'fr_onepiece', title: 'Rumbo a Laugh Tale',          desc: 'Marcá One Piece (anime o manga) como "Visto".',               req: fr('onepiece'), icon: '👒' },
        { id: 'fr_aot',      title: 'Alas de la Libertad',         desc: 'Marcá Attack on Titan (cualquier temporada) como "Visto".',   req: fr('aot'), icon: '🕊️' },
        { id: 'fr_ds',       title: 'Respiración: Primera Forma',  desc: 'Marcá Demon Slayer (anime o manga) como "Visto".',            req: fr('demonslayer'), icon: '🌊' },
        { id: 'fr_fmab',     title: 'Alquimista Nacional',         desc: 'Marcá Fullmetal Alchemist: Brotherhood como "Visto".',        req: fr('fmab'), icon: '⚙️' },
        { id: 'fr_solo',     title: 'De Rango E a Rango S',        desc: 'Marcá Solo Leveling (anime o manhwa) como "Visto".',          req: fr('sololeveling'), icon: '🗡️' },
        { id: 'fr_mushoku',  title: 'Segunda Oportunidad',         desc: 'Marcá Mushoku Tensei (novela o anime) como "Visto".',         req: fr('mushoku'), icon: '♻️' },
        { id: 'fr_frieren',  title: 'El Fin del Viaje',            desc: 'Marcá Frieren como "Visto".',                                 req: fr('frieren'), icon: '🧝' },
        { id: 'fr_hxh',      title: 'Examen del Cazador',          desc: 'Marcá Hunter x Hunter (2011) como "Visto".',                  req: fr('hxh'), icon: '🎣' },
        { id: 'fr_mha',      title: 'Plus Ultra, Héroe',           desc: 'Marcá My Hero Academia como "Visto".',                        req: fr('mha'), icon: '🦸' },
        { id: 'fr_dn',       title: 'Just as Planned',             desc: 'Marcá Death Note (anime o manga) como "Visto".',              req: fr('deathnote'), icon: '📓', secret: true },
        { id: 'fr_berserk',  title: 'Marca del Sacrificio',        desc: 'Marcá Berserk (manga) como "Visto".',                         req: fr('berserk'), icon: '⚔️', secret: true },
        { id: 'fr_rezero',   title: 'Volver a Empezar',            desc: 'Marcá Re:Zero (novela o anime) como "Visto".',                req: fr('rezero'), icon: '⏪', secret: true },
        { id: 'fr_csm',      title: 'Contrato con Pochita',        desc: 'Marcá Chainsaw Man (anime o manga) como "Visto".',            req: fr('csm'), icon: '🪚', secret: true },
        { id: 'fr_jjk_full', title: 'Hechicero de Grado Especial', desc: 'Marcá el anime y el manga de Jujutsu Kaisen como "Visto".',   req: fr('jjk_anime') && fr('jjk_manga'), icon: '🟣', secret: true },
        { id: 'fr_big3',     title: 'Los Tres Grandes',            desc: 'Marcá Naruto, One Piece y Bleach como "Visto".',              req: fr('naruto') && fr('onepiece') && fr('bleach'), icon: '⚓', secret: true },

        // — Global —
        { id: 'library100', title: 'Biblioteca Viviente', desc: 'Acumulá 100 títulos entre "Me gusta" y "Visto".', req: totalSaved >= 100, icon: '🏛️', secret: true }
    ];

    // Detección de logros recién desbloqueados para premiar EXP + notificar.
    // UserStore es solo en memoria, así que la idempotencia (no premiar dos
    // veces al recargar) se persiste en localStorage. En el PRIMER encuentro
    // del usuario con el sistema se siembran los flags en silencio (sin EXP ni
    // toast) para no regalar EXP retroactiva ni spamear a usuarios existentes.
    const userInited = _lsGet(_achvInitKey(userId)) === '1';
    const newlyUnlocked = [];

    rules.forEach(function(r) {
        if (r.req && userId !== 'Invitado') {
            UserStore.setItem('u:' + userId + '|achievement:' + r.id, '1');
            const granted = _lsGet(_achvGrantKey(userId, r.id)) === '1';
            if (!granted) {
                _lsSet(_achvGrantKey(userId, r.id), '1');
                if (userInited) newlyUnlocked.push(r);
            }
        }
    });

    if (!userInited && userId !== 'Invitado') {
        _lsSet(_achvInitKey(userId), '1');
    }

    host.innerHTML = rules.map(function(r) {
        var unlocked = UserStore.getItem('u:' + userId + '|achievement:' + r.id) === '1';
        var isSecret = r.secret && !unlocked;

        return '<div class="achievement-card ' + (unlocked ? 'is-unlocked' : 'is-locked') + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                '<span class="achievement-icon" aria-hidden="true">' + (isSecret ? '❓' : escapeHtml(r.icon)) + '</span>' +
                '<span class="achievement-state">' + (unlocked ? 'Desbloqueado' : 'Bloqueado') + '</span>' +
            '</div>' +
            '<div>' +
                '<div class="achievement-title">' + (isSecret ? '???' : escapeHtml(r.title)) + '</div>' +
                (isSecret ? '' : '<div class="achievement-desc">' + escapeHtml(r.desc) + '</div>') +
            '</div>' +
        '</div>';
    }).join('');

    // Premiar EXP y notificar los logros realmente nuevos de esta sesión
    if (newlyUnlocked.length) {
        newlyUnlocked.forEach(function(r) {
            const exp = r.secret ? (ACHV_EXP_SECRET) : (ACHV_EXP_COMMON);
            if (typeof window.addUserPoints === 'function') window.addUserPoints(userId, exp);
            if (window.Toast) window.Toast.success('🏆 ¡Logro desbloqueado! ' + r.title + ' (+' + exp + ' EXP)', 6000);
        });
        // La barra de EXP/nivel quedó desactualizada tras sumar puntos
        renderPoints();
        renderProfileSummary();
        renderApodos(); // el EXP nuevo puede desbloquear apodos por nivel
    }
}
