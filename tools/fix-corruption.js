const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPL = '\uFFFD';

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, text) {
    fs.writeFileSync(path.join(ROOT, rel), text, 'utf8');
    console.log('Fixed:', rel);
}

function replaceAll(text, pairs) {
    let out = text;
    for (const [from, to] of pairs) {
        out = out.split(from).join(to);
    }
    return out;
}

// --- index.html ---
write('index.html', replaceAll(read('index.html'), [
    [`Base de datos ${REPL} v2026`, 'Base de datos • v2026'],
    [`constru${REPL} tus listas`, 'construí tus listas'],
    [`Men${REPL} principal`, 'Menú principal'],
    [`pel${REPL}culas`, 'películas'],
    [`C${REPL}mics`, 'Cómics'],
    [`Contin${REPL}a viendo`, 'Continuá viendo'],
]));

// --- detalle.html ---
write('detalle.html', replaceAll(read('detalle.html'), [
    [`<span class="tipo-obra" id="detail-tipo">?? ${REPL}</span>`, '<span class="tipo-obra" id="detail-tipo">…</span>'],
    [`<span class="estado-obra-badge" id="detail-estado-badge">? ${REPL}</span>`, '<span class="estado-obra-badge" id="detail-estado-badge">…</span>'],
    ['<span class="dato-icono" aria-hidden="true">?</span>\n                                    <span class="dato-label" id="detail-stat-1-label">Cap' + REPL + 'tulos</span>', '<span class="dato-icono" aria-hidden="true">📚</span>\n                                    <span class="dato-label" id="detail-stat-1-label">Capítulos</span>'],
    [`Vol${REPL}menes`, 'Volúmenes'],
    ['<span class="dato-icono" aria-hidden="true">??</span>\n                                    <span class="dato-label">Volúmenes</span>', '<span class="dato-icono" aria-hidden="true">📖</span>\n                                    <span class="dato-label">Volúmenes</span>'],
    ['<span class="dato-icono" aria-hidden="true">??</span>\n                                    <span class="dato-label">Estado</span>', '<span class="dato-icono" aria-hidden="true">✓</span>\n                                    <span class="dato-label">Estado</span>'],
    ['<span class="dato-icono" aria-hidden="true">?</span>\n                                    <span class="dato-label">Puntaje</span>', '<span class="dato-icono" aria-hidden="true">⭐</span>\n                                    <span class="dato-label">Puntaje</span>'],
    [`CAP${REPL}TULOS`, 'CAPÍTULOS'],
    ['aria-label="Agregar a favoritos">?</button>', 'aria-label="Agregar a favoritos">❤</button>'],
    ['aria-label="Marcar como visto">?</button>', 'aria-label="Marcar como visto">👁</button>'],
    ['aria-label="Cerrar modal">?</button>', 'aria-label="Cerrar modal">×</button>'],
    [`Aqu${REPL} aparecerá el resumen.`, 'Aquí aparecerá el resumen.'],
]));

// --- privacidad.html ---
write('privacidad.html', replaceAll(read('privacidad.html'), [
    [`pol${REPL}tica`, 'política'],
    [`actualizaci${REPL}n`, 'actualización'],
    [`c${REPL}mo`, 'cómo'],
    [`trav${REPL}s`, 'través'],
    [`autenticaci${REPL}n`, 'autenticación'],
    [`visualizaci${REPL}n`, 'visualización'],
    [`Estad${REPL}sticas`, 'Estadísticas'],
    [`b${REPL}sicas`, 'básicas'],
    [`interacci${REPL}n`, 'interacción'],
    [`ning${REPL}n`, 'ningún'],
    [`est${REPL}ticas`, 'estéticas'],
    [`eliminaci${REPL}n`, 'eliminación'],
    [`aplicaci${REPL}n`, 'aplicación'],
    ['última actualización', 'Última actualización'],
]));

// --- terminos.html ---
write('terminos.html', replaceAll(read('terminos.html'), [
    [`t${REPL}rminos`, 'términos'],
    [`actualizaci${REPL}n`, 'actualización'],
    [`Limitaci${REPL}n`, 'Limitación'],
    [`seg${REPL}n`, 'según'],
    [`ser${REPL}`, 'será'],
    [`p${REPL}rdida`, 'pérdida'],
    [`conexi${REPL}n`, 'conexión'],
    [`pr${REPL}cticas`, 'prácticas'],
    [`regir${REPL}n`, 'regirán'],
    [`interpretar${REPL}n`, 'interpretarán'],
    [`aplicaci${REPL}n`, 'aplicación'],
    ['última actualización', 'Última actualización'],
]));

// --- mis-listas.html ---
let misListas = read('mis-listas.html');
misListas = replaceAll(misListas, [
    [`Estad${REPL}sticas`, 'Estadísticas'],
    [`Un d${REPL}a sin anime es un d${REPL}a perdido.`, 'Un día sin anime es un día perdido.'],
    ['/* ? LAYOUT LISTAS ? */', '/* LAYOUT LISTAS */'],
    ['<!-- ? MIS LISTAS ? -->', '<!-- MIS LISTAS -->'],
    ['<span class="sidebar-icon">??</span> Mis Listas', '<span class="sidebar-icon">📋</span> Mis Listas'],
    ['<span class="sidebar-icon">??</span> Actividad', '<span class="sidebar-icon">📊</span> Actividad'],
    ['<span class="sidebar-icon">??</span> Logros', '<span class="sidebar-icon">🏆</span> Logros'],
    ['<span class="sidebar-icon">??</span> Estadísticas', '<span class="sidebar-icon">📈</span> Estadísticas'],
    ['<div class="quote-author">??</div>', '<div class="quote-author">— Otaku anónimo</div>'],
    ['<div class="cat-card-icon cyan">??</div>', '<div class="cat-card-icon cyan">🎬</div>'],
    ['<div class="cat-card-icon green">??</div>', '<div class="cat-card-icon green">📚</div>'],
    ['<div class="cat-card-icon pink">??</div>', '<div class="cat-card-icon pink">📖</div>'],
    ['<div class="cat-card-icon purple">?</div>', '<div class="cat-card-icon purple">📋</div>'],
    ['<span class="chip-icon">?</span> Todo', '<span class="chip-icon">📋</span> Todo'],
    ['<span class="chip-icon">?</span> Me gusta', '<span class="chip-icon">❤</span> Me gusta'],
    ['<span class="chip-icon">??</span> Vistos', '<span class="chip-icon">👁</span> Vistos'],
    ['<span class="chip-icon">??</span> Exportar JSON', '<span class="chip-icon">📤</span> Exportar JSON'],
    ['<span class="tab-icon">??</span> Anime', '<span class="tab-icon">🎬</span> Anime'],
    ['<span class="tab-icon">??</span> Manga', '<span class="tab-icon">📚</span> Manga'],
    ['<span class="tab-icon">??</span> Novelas', '<span class="tab-icon">📖</span> Novelas'],
]);
write('mis-listas.html', misListas);

// --- usuario.html ---
let usuario = read('usuario.html');
usuario = replaceAll(usuario, [
    [`EN L${REPL}NEA`, 'EN LÍNEA'],
    ['Info y m' + REPL + 'tricas', 'Info y métricas'],
    [`Regi${REPL}n`, 'Región'],
    [`P${REPL}blica`, 'Pública'],
    [`Configuraci${REPL}n`, 'Configuración'],
    [`Estad${REPL}sticas`, 'Estadísticas'],
    ['<div class="perfil-change-img-btn" id="changeImgBtn" title="Cambiar imagen">??</div>', '<div class="perfil-change-img-btn" id="changeImgBtn" title="Cambiar imagen">📷</div>'],
    ['<span class="perfil-edit-icon" title="Editar nombre">??</span>', '<span class="perfil-edit-icon" title="Editar nombre">✏️</span>'],
    ['id="editProfileBtn">?? EDITAR PERFIL</a>', 'id="editProfileBtn">✏️ EDITAR PERFIL</a>'],
    ['id="backBtn">? VOLVER</a>', 'id="backBtn">← VOLVER</a>'],
    ['class="perfil-btn-config">? Configuración</a>', 'class="perfil-btn-config">⚙️ Configuración</a>'],
    ['<span class="perfil-card-icon">?</span>\n                                <span id="cardLevel">', '<span class="perfil-card-icon">🏆</span>\n                                <span id="cardLevel">'],
    ['<span class="perfil-card-icon">??</span>\n                                <span id="cardPoints">', '<span class="perfil-card-icon">⭐</span>\n                                <span id="cardPoints">'],
    ['<span class="perfil-card-icon">?</span>\n                                <span id="cardFavs">', '<span class="perfil-card-icon">❤</span>\n                                <span id="cardFavs">'],
    ['<span class="perfil-card-icon">??</span>\n                                <span id="cardViewed">', '<span class="perfil-card-icon">👁</span>\n                                <span id="cardViewed">'],
    ['<span class="pp-icon">??</span> INFORMACIÓN PERSONAL', '<span class="pp-icon">👤</span> INFORMACIÓN PERSONAL'],
    ['<span class="pir-icon">??</span> Correo electrónico', '<span class="pir-icon">✉️</span> Correo electrónico'],
    ['<span class="pir-icon">??</span> País / Región', '<span class="pir-icon">🌎</span> País / Región'],
    ['<span class="pir-icon">??</span> Idioma', '<span class="pir-icon">🌐</span> Idioma'],
    ['<span class="pir-icon">??</span> Zona horaria', '<span class="pir-icon">🕐</span> Zona horaria'],
    ['id="infoPais">Argentina ????</div>', 'id="infoPais">Argentina 🇦🇷</div>'],
    ['id="cambiarInfoBtn">?? CAMBIAR INFORMACIÓN</button>', 'id="cambiarInfoBtn">✏️ CAMBIAR INFORMACIÓN</button>'],
    ['<span class="pp-icon">??</span> ESTADÍSTICAS', '<span class="pp-icon">📊</span> ESTADÍSTICAS'],
    ['<div class="perfil-stat-icon-wrap">?</div>\n                            <div>\n                                <div class="perfil-stat-label">Tiempo en la app', '<div class="perfil-stat-icon-wrap">⏱️</div>\n                            <div>\n                                <div class="perfil-stat-label">Tiempo en la app'],
    ['<div class="perfil-stat-icon-wrap">??</div>\n                            <div>\n                                <div class="perfil-stat-label">Sesiones', '<div class="perfil-stat-icon-wrap">🔄</div>\n                            <div>\n                                <div class="perfil-stat-label">Sesiones'],
    ['<div class="perfil-stat-icon-wrap">??</div>\n                            <div>\n                                <div class="perfil-stat-label">Contenido explorado', '<div class="perfil-stat-icon-wrap">🔍</div>\n                            <div>\n                                <div class="perfil-stat-label">Contenido explorado'],
    ['<div class="perfil-stat-icon-wrap">??</div>\n                            <div>\n                                <div class="perfil-stat-label">Promedio por sesión', '<div class="perfil-stat-icon-wrap">📈</div>\n                            <div>\n                                <div class="perfil-stat-label">Promedio por sesión'],
    ['<button class="perfil-panel-btn">?? VER ESTADÍSTICAS DETALLADAS</button>', '<button class="perfil-panel-btn">📊 VER ESTADÍSTICAS DETALLADAS</button>'],
    ['<span class="pp-icon">?</span> PREFERENCIAS', '<span class="pp-icon">⚙️</span> PREFERENCIAS'],
    ['<span class="perfil-pref-icon">??</span> Tema de la app', '<span class="perfil-pref-icon">🌙</span> Tema de la app'],
    ['id="prefTema">Oscuro ??</div>', 'id="prefTema">Oscuro 🌙</div>'],
    ['<span class="perfil-pref-icon">??</span> Notificaciones', '<span class="perfil-pref-icon">🔔</span> Notificaciones'],
    ['id="prefNotif">Activadas ??</div>', 'id="prefNotif">Activadas 🔔</div>'],
    ['<span class="perfil-pref-icon">?</span> Contenido sugerido', '<span class="perfil-pref-icon">⭐</span> Contenido sugerido'],
    ['<span class="perfil-pref-icon">??</span> Privacidad', '<span class="perfil-pref-icon">🔒</span> Privacidad'],
    ['id="prefPrivacidad">Pública ??</div>', 'id="prefPrivacidad">Pública 🔒</div>'],
    ['class="perfil-panel-btn purple">? ADMINISTRAR PREFERENCIAS</a>', 'class="perfil-panel-btn purple">⚙️ ADMINISTRAR PREFERENCIAS</a>'],
    ['<span class="pp-icon">?</span> ACTIVIDAD RECIENTE', '<span class="pp-icon">📋</span> ACTIVIDAD RECIENTE'],
    ['VER TODA LA ACTIVIDAD ?</a>', 'VER TODA LA ACTIVIDAD →</a>'],
    ['<span class="perfil-import-icon">??</span> IMPORTAR DESDE MyAnimeList', '<span class="perfil-import-icon">📥</span> IMPORTAR DESDE MyAnimeList'],
    ['id="previewMalBtn">?? VISTA PREVIA</button>', 'id="previewMalBtn">👁️ VISTA PREVIA</button>'],
]);
write('usuario.html', usuario);

// --- configuracion.html ---
let cfg = read('configuracion.html');
cfg = replaceAll(cfg, [
    [`Regi${REPL}n`, 'Región'],
    [`im${REPL}genes`, 'imágenes'],
    [`tambi${REPL}n`, 'también'],
    ['<option value="???">??</option>', '<option value="日本語">日本語 🇯🇵</option>'],
    ['Argentina ????', 'Argentina 🇦🇷'],
    ['México ????', 'México 🇲🇽'],
    ['España ????', 'España 🇪🇸'],
    ['Chile ????', 'Chile 🇨🇱'],
    ['Colombia ????', 'Colombia 🇨🇴'],
    ['Uruguay ????', 'Uruguay 🇺🇾'],
    ['Perú ????', 'Perú 🇵🇪'],
    ['Venezuela ????', 'Venezuela 🇻🇪'],
    ['Ecuador ????', 'Ecuador 🇪🇨'],
    ['Bolivia ????', 'Bolivia 🇧🇴'],
    ['Paraguay ????', 'Paraguay 🇵🇾'],
    ['<span class="cfg-panel-icon">??</span> INFORMACIÓN PERSONAL', '<span class="cfg-panel-icon">👤</span> INFORMACIÓN PERSONAL'],
    ['<span class="cfg-panel-icon">?</span> PREFERENCIAS', '<span class="cfg-panel-icon">⚙️</span> PREFERENCIAS'],
    ['<span class="cfg-panel-icon">??</span> COLORES DE LA APP', '<span class="cfg-panel-icon">🎨</span> COLORES DE LA APP'],
    ['<span class="cfg-panel-icon">??</span> TARJETAS POR FILA', '<span class="cfg-panel-icon">🔲</span> TARJETAS POR FILA'],
    ['<span class="cfg-panel-icon">??</span> FONDO DE PANTALLA', '<span class="cfg-panel-icon">🖼️</span> FONDO DE PANTALLA'],
    ['<span class="cfg-panel-icon">??</span> APARIENCIA DE CARDS', '<span class="cfg-panel-icon">✨</span> APARIENCIA DE CARDS'],
    ['<span class="cfg-panel-icon">??</span> PRIVACIDAD Y DATOS', '<span class="cfg-panel-icon">🔒</span> PRIVACIDAD Y DATOS'],
    ['id="saveInfoPersonal">?? GUARDAR INFORMACIÓN</button>', 'id="saveInfoPersonal">💾 GUARDAR INFORMACIÓN</button>'],
    ['id="savePreferencias">?? GUARDAR PREFERENCIAS</button>', 'id="savePreferencias">💾 GUARDAR PREFERENCIAS</button>'],
    ['<option value="oscuro">?? Oscuro</option>', '<option value="oscuro">🌙 Oscuro</option>'],
    ['<option value="claro">?? Claro</option>', '<option value="claro">☀️ Claro</option>'],
    ['<option value="sistema">?? Según sistema</option>', '<option value="sistema">💻 Según sistema</option>'],
    ['id="saveCpr">?? GUARDAR</button>', 'id="saveCpr">💾 GUARDAR</button>'],
    ['id="resetCpr">? AUTO</button>', 'id="resetCpr">↺ AUTO</button>'],
    ['<span class="cfg-bg-mode-icon">?</span>', '<span class="cfg-bg-mode-icon">🌌</span>'],
    ['<span class="cfg-bg-mode-icon">??</span>\n                        COLOR', '<span class="cfg-bg-mode-icon">🎨</span>\n                        COLOR'],
    ['<span class="cfg-bg-mode-icon">??</span>\n                        IMAGEN', '<span class="cfg-bg-mode-icon">🖼️</span>\n                        IMAGEN'],
    ['id="saveFondo">? APLICAR FONDO</button>', 'id="saveFondo">✓ APLICAR FONDO</button>'],
    ['id="clearFondo">? RESTAURAR POR DEFECTO</button>', 'id="clearFondo">↺ RESTAURAR POR DEFECTO</button>'],
    ['Íconos de ? Visto y Me gusta', 'Íconos de 👁 Visto y ❤ Me gusta'],
    ['id="saveApariencia">?? GUARDAR APARIENCIA</button>', 'id="saveApariencia">💾 GUARDAR APARIENCIA</button>'],
    ['id="exportData">?? EXPORTAR MIS DATOS (JSON)</button>', 'id="exportData">📤 EXPORTAR MIS DATOS (JSON)</button>'],
    ['id="deleteUserBtn">?? ELIMINAR USUARIO</button>', 'id="deleteUserBtn">🗑️ ELIMINAR USUARIO</button>'],
    ['id="clearAllBtn">? BORRAR TODO EL ALMACENAMIENTO</button>', 'id="clearAllBtn">⚠️ BORRAR TODO EL ALMACENAMIENTO</button>'],
    ['id="saveAll">?? GUARDAR TODOS LOS CAMBIOS</button>', 'id="saveAll">💾 GUARDAR TODOS LOS CAMBIOS</button>'],
]);
write('configuracion.html', cfg);

// --- common-ui.js ---
let commonUi = read('js/core/common-ui.js');
commonUi = commonUi.replace(/Â©/g, '©');
commonUi = commonUi.replace(/â¢/g, '•');
commonUi = commonUi.replace(/cargÃ³/g, 'cargó');
commonUi = commonUi.replace(/ââ/g, '──');
commonUi = commonUi.replace(/â/g, '→');
write('js/core/common-ui.js', commonUi);

// --- core-bundle.js: same footer/comment fixes ---
let bundle = read('js/core-bundle.js');
bundle = bundle.replace(/Â©/g, '©');
bundle = bundle.replace(/â¢/g, '•');
bundle = bundle.replace(/cargÃ³/g, 'cargó');
bundle = bundle.replace(/ââ/g, '──');
bundle = bundle.replace(/â/g, '→');
write('js/core-bundle.js', bundle);

console.log('Done.');
