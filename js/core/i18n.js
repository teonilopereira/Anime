(function () {
    "use strict";

    var translations = {
        es: {
            // ── Navegación ──────────────────────────────────────────────────
            "nav.inicio":         "Inicio",
            "nav.anime":          "Anime",
            "nav.manga":          "Manga",
            "nav.novelas":        "Novelas",
            "nav.comparar":       "Comparar",
            "nav.top":            "Top",
            "nav.mis_listas":     "Mis Listas",
            "nav.listas":         "Listas",
            "nav.configuracion":  "Configuración",
            "nav.cuenta":         "Cuenta",
            "nav.ingresar":       "Ingresar",
            "nav.perfil":         "Perfil",
            "nav.cerrar_sesion":  "Cerrar Sesión",
            "nav.menu":           "Menú",
            "nav.usuario_invitado": "Invitado",
            "nav.usuario": "Usuario",

            // ── Index / Inicio ───────────────────────────────────────────────
            "index.eyebrow":       "Base de datos • v2026",
            "index.subtitle":      "Explorá el catálogo, guardá tu progreso y construí tus listas.",
            "index.card.anime":    "Series y películas",
            "index.card.manga":    "Cómics y tankobon",
            "index.card.novelas":  "Light novels y más",
            "index.card.listas":   "Favoritos y vistos",
            "index.card.ranking":  "Rankings F2P y P2W",
            "index.card.comparar": "Dos títulos lado a lado",
            "index.destacados":    "Destacados",
            "index.populares":     "Más populares",
            "index.continuar":     "Continuar viendo",

            // ── Catálogo (anime / manga / novelas) ───────────────────────────
            "catalog.title.anime":    "CATÁLOGO DE ANIME",
            "catalog.title.manga":    "CATÁLOGO DE MANGA",
            "catalog.title.novelas":  "CATÁLOGO DE NOVELAS",
            "catalog.subtitle.anime": "Explorá, descubrí y guardá tus animes favoritos.",
            "catalog.subtitle.manga": "Explorá, descubrí y guardá tus mangas favoritos.",
            "catalog.subtitle.novelas": "Explorá, descubrí y guardá tus novelas favoritas.",
            "catalog.buscar":         "Buscar...",
            "catalog.buscar.anime":   "Buscar anime...",
            "catalog.buscar.manga":   "Buscar manga...",
            "catalog.buscar.novelas": "Buscar novela...",
            "catalog.sin_resultados": "No se encontraron resultados.",
            "catalog.cargando":       "Cargando...",
            "catalog.error":          "Error al cargar el catálogo.",
            "catalog.continuar_viendo": "Continuar viendo",
            "catalog.favoritos":      "Favoritos",
            "catalog.vistos":         "Vistos",
            "catalog.filtrar_estado": "Filtrar por estado",
            "catalog.filtros":        "FILTROS ADICIONALES",
            "catalog.limpiar":        "Limpiar Filtros",
            "catalog.nsfw.titulo":    "Mostrar NSFW",
            "catalog.nsfw.desc":      "Activa para mostrar contenido para adultos.",
            "catalog.genero":         "GÉNERO",
            "catalog.buscar_genero":  "Buscar género...",
            "catalog.abrir_filtros":  "Abrir filtros",

            // ── Detalle ──────────────────────────────────────────────────────
            "detail.cargando":        "Buscando detalle en la API...",
            "detail.no_encontrado":   "No se encontró este título.",
            "detail.sin_sinopsis":    "Sin sinopsis disponible.",
            "detail.sinopsis":        "SINOPSIS",
            "detail.generos":         "GÉNEROS",
            "detail.capitulos":       "CAPÍTULOS",
            "detail.episodios":       "EPISODIOS",
            "detail.volumenes":       "VOLÚMENES",
            "detail.estado":          "Estado",
            "detail.puntaje":         "Puntaje",
            "detail.sin_capitulos":   "Sin capítulos especificados en la API.",
            "detail.progreso_general": "PROGRESO GENERAL",
            "detail.completados":     "{vistos}/{total} completados",
            "detail.volver":          "Volver al catálogo",
            "detail.compartir":       "Compartir con conocidos o amigos",
            "detail.favorito":        "Agregar a favoritos",
            "detail.marcar_visto":    "Marcar como visto",
            "detail.ver_mas":         "Ver más",
            "detail.perfil":          "PERFIL",
            "detail.abrir":           "ABRIR",
            "detail.configuracion":   "CONFIGURACIÓN",
            "detail.cargando_kicker": "Cargando",
            "detail.no_encontrado_kicker": "No encontrado",
            "detail.sinopsis_h3":     "SINOPSIS",
            "detail.generos_h3":      "GÉNEROS",
            "detail.capitulos_h3":    "CAPÍTULOS",
            "detail.episodios_h3":    "EPISODIOS",
            "detail.volumenes_h3":    "VOLÚMENES",
            "detail.barra_capitulos": "CAPÍTULOS GENERAL",
            "detail.barra_episodios": "EPISODIOS GENERAL",
            "detail.barra_volumenes": "VOLÚMENES GENERAL",
            "detail.modal.info":      "Información",
            "detail.modal.cerrar":    "Cerrar",

            // ── Top / Ranking ────────────────────────────────────────────────
            "rank.titulo":       "TOP RANKING",
            "rank.subtitulo":    "Los mejor puntuados por la comunidad.",
            "rank.cargando":     "Cargando ranking...",
            "rank.cargar_mas":   "Cargar más",
            "rank.no_resultados": "Sin resultados.",
            "top.rank.title":    "RANKING",
            "top.rank.subtitle": "Jugadores ordenados por nivel y experiencia total.",

            // ── Mis Listas ───────────────────────────────────────────────────
            "lists.cargando":    "Cargando tus listas...",
            "lists.titulo":      "MIS LISTAS",
            "lists.subtitulo":   "Tus \"Me gusta\" y \"Vistos\" separados por categoría.",
            "lists.vacio":       "No tenés elementos en esta categoría.",
            "lists.sidebar.mis_listas": "Mis Listas",
            "lists.sidebar.actividad": "Actividad",
            "lists.sidebar.logros": "Logros",
            "lists.sidebar.estadisticas": "Estadísticas",
            "lists.card.anime": "ANIME",
            "lists.card.manga": "MANGA",
            "lists.card.novelas": "NOVELAS",
            "lists.card.sublabel": "Títulos guardados",
            "lists.card.ver_catalogo": "Ver catálogo ➜",
            "lists.card.actividad_reciente": "ACTIVIDAD RECIENTE",
            "lists.card.ver_todo": "Ver todo ➜",
            "lists.card.sin_actividad": "Sin actividad reciente.",
            "lists.filter.todo": "Todo",
            "lists.filter.me_gusta": "Me gusta",
            "lists.filter.vistos": "Vistos",
            "lists.filter.exportar": "Exportar JSON",
            "lists.results.titulo": "RESULTADOS",
            "lists.results.todos": "Todos",
            "lists.results.anime": "Anime",
            "lists.results.manga": "Manga",
            "lists.results.novelas": "Novelas",
            "lists.recommend.titulo": "RECOMENDADO PARA VOS",
            "lists.recommend.subtitulo": "Basado en lo que marcaste como visto.",
            "lists.activity.titulo": "ACTIVIDAD RECIENTE",
            "lists.activity.subtitulo": "Tus últimos animes, mangas y novelas marcados.",
            "lists.activity.sin_actividad": "Sin actividad",
            "lists.activity.no_actividad_desc": "No hay actividad reciente.",
            "lists.achievements.titulo": "LOGROS",
            "lists.achievements.subtitulo": "Desbloqueá logros marcando Me gusta, Visto y registrando progreso.",
            "lists.stats.titulo": "ESTADÍSTICAS",
            "lists.stats.subtitulo": "Resumen de tu actividad en la app.",

            // ── Login ────────────────────────────────────────────────────────
            "login.kicker":      "Tu cuenta",
            "login.copy":        "Entrá para guardar favoritos, progreso y listas en tu perfil.",
            "login.titulo":      "Iniciar sesión",
            "login.tab.login":   "Iniciar",
            "login.tab.crear":   "Crear cuenta",
            "login.usuario":     "Usuario",
            "login.email":       "Correo",
            "login.contrasena":  "Contraseña",
            "login.ingresar":    "Entrar",
            "login.crear":       "Crear Cuenta",
            "login.google":      "Continuar con Google",
            "login.cerrar":      "Cerrar sesión",
            "login.volver":      "Volver al inicio",
            "login.mis_listas":  "Ver mis listas",
            "login.placeholder.usuario":   "Ej: NarutoFan",
            "login.placeholder.email":     "tuusuario@gmail.com",
            "login.placeholder.password":  "********",

            // ── Configuración ────────────────────────────────────────────────
            "config.titulo":         "CONFIGURACIÓN",
            "config.subtitulo":      "Personalizá tu experiencia, información y preferencias de la app.",
            "config.usuario_activo": "Usuario activo",
            "config.volver_perfil":  "← Volver al perfil",
            "config.idioma":         "Idioma",
            "config.notif.titulo":   "Notificaciones",
            "config.notif.desc":     "Recibir alertas y novedades de la app.",
            "config.sugerido.titulo": "Contenido sugerido personalizado",
            "config.sugerido.desc":  "Recomendaciones basadas en tus gustos.",
            "config.compact.titulo": "Cards compactas",
            "config.compact.desc":   "Reduce el tamaño de las cards para ver más contenido.",
            "config.motion.titulo":  "Reducir animaciones",
            "config.motion.desc":     "Menos efectos visuales para navegación más suave.",
            "config.public.titulo":  "Perfil público",
            "config.public.desc":    "Permitir que otros usuarios vean tu perfil.",
            "config.nsfw.titulo":    "Mostrar contenido NSFW",
            "config.nsfw.desc":      "Activar para ver contenido para adultos en el catálogo.",
            "config.fondo":          "FONDO DE PANTALLA",
            "config.autoguardado":   "Los cambios se guardan solos.",
            "config.cuenta":         "CUENTA",
            "config.cuenta_nota":    "Tu correo y tu contraseña se gestionan desde la cuenta con la que iniciás sesión.",
            "config.contenido_privacidad": "CONTENIDO Y PRIVACIDAD",
            "config.apariencia":     "APARIENCIA",
            "config.cpr.titulo":     "Fijar tarjetas por fila",
            "config.cpr.desc":       "Sin esto se ajustan solas al ancho de la pantalla.",
            "config.cpr.nota":       "Solo aplica en pantallas grandes; en el celular se mantiene el diseño responsive.",
            "config.colores":        "COLORES",
            "config.color.principal":   "Acento principal",
            "config.color.navbar":      "Acento navbar",
            "config.color.secundario":  "Acento secundario",
            "config.color.fondo":       "Fondo oscuro",
            "config.color.texto":       "Texto principal",
            "config.color.texto2":      "Texto secundario",
            "config.color.reset":       "🔄 RESTABLECER COLORES",
            "config.fondo.default":     "POR DEFECTO",
            "config.fondo.color":       "COLOR",
            "config.fondo.imagen":      "IMAGEN",
            "config.fondo.color_label": "Color de fondo",
            "config.fondo.url":         "URL de imagen",
            "config.fondo.archivo":     "O subir imagen desde tu dispositivo",
            "config.datos":          "TUS DATOS",
            "config.exportar":       "📥 EXPORTAR MIS DATOS (JSON)",
            "config.restablecer":    "🔄 RESTABLECER LA APARIENCIA",
            "config.cerrar_sesion":  "🚪 CERRAR SESIÓN",
            "config.datos_nota":     "Restablecer solo afecta cómo se ve la app en este dispositivo. Tus listas y tu progreso están guardados en tu cuenta y no se tocan.",
            "notification.levelup":   "¡Subiste de Nivel! 🎉 ¡Ahora eres Nivel {level}! 🌟",

            // ── Usuario / Perfil ─────────────────────────────────────────────
            "user.perfil":     "Perfil",
            "user.puntos":     "Puntos",
            "user.nivel":      "Nivel",
            "user.vistos":     "Vistos",
            "user.favoritos":  "Favoritos",

            // ── Comparar ─────────────────────────────────────────────────────
            "compare.titulo":  "COMPARAR",
            "compare.desc":    "Compará dos títulos lado a lado.",

            // ── Estados ──────────────────────────────────────────────────────
            "state.visto":     "Visto",
            "state.favorito":  "Favorito",
            "state.pendiente": "Pendiente",

            // ── Errores ──────────────────────────────────────────────────────
            "error.generico":        "Algo salió mal. Intentá de nuevo en unos minutos.",
            "error.conexion":        "Sin conexión al servidor. Revisá tu internet.",
            "error.online":          "¡Conexión restablecida!",
            "error.no_encontrado":   "No encontrado.",
            "error.404.title":       "Ruta perdida en la Red",
            "error.404.text":        "El enlace que ingresaste no existe, fue movido o se cayó temporalmente.",
            "error.sesion_expirada": "Sesión expirada. Tus cambios se guardaron y se sincronizarán al reconectar.",
            "error.volver_inicio":   "Volver al inicio",
            "privacy.title":         "Política de Privacidad",
            "privacy.updated":       "Última actualización: Julio 2026",
            "terms.title":           "Términos de Servicio",
            "terms.updated":         "Última actualización: Julio 2026",

            // ── General ──────────────────────────────────────────────────────
            "general.cargando":  "Cargando...",
            "general.guardando": "Guardando...",
            "general.hecho":     "Hecho",
            "general.cancelar":  "Cancelar",
            "general.cerrar":    "Cerrar"
        },

        en: {
            // ── Navigation ───────────────────────────────────────────────────
            "nav.inicio":         "Home",
            "nav.anime":          "Anime",
            "nav.manga":          "Manga",
            "nav.novelas":        "Novels",
            "nav.comparar":       "Compare",
            "nav.top":            "Top",
            "nav.mis_listas":     "My Lists",
            "nav.listas":         "Lists",
            "nav.configuracion":  "Settings",
            "nav.cuenta":         "Account",
            "nav.ingresar":       "Log In",
            "nav.perfil":         "Profile",
            "nav.cerrar_sesion":  "Log Out",
            "nav.menu":           "Menu",
            "nav.usuario_invitado": "Guest",
            "nav.usuario": "User",

            // ── Index / Home ─────────────────────────────────────────────────
            "index.eyebrow":       "Database • v2026",
            "index.subtitle":      "Browse the catalog, track your progress and build your lists.",
            "index.card.anime":    "Series & movies",
            "index.card.manga":    "Comics & tankobon",
            "index.card.novelas":  "Light novels & more",
            "index.card.listas":   "Favorites & watched",
            "index.card.ranking":  "F2P & P2W Rankings",
            "index.card.comparar": "Two titles side by side",
            "index.destacados":    "Featured",
            "index.populares":     "Most popular",
            "index.continuar":     "Continue watching",

            // ── Catalog ──────────────────────────────────────────────────────
            "catalog.title.anime":    "ANIME CATALOG",
            "catalog.title.manga":    "MANGA CATALOG",
            "catalog.title.novelas":  "NOVEL CATALOG",
            "catalog.subtitle.anime": "Browse, discover and save your favorite anime.",
            "catalog.subtitle.manga": "Browse, discover and save your favorite manga.",
            "catalog.subtitle.novelas": "Browse, discover and save your favorite novels.",
            "catalog.buscar":         "Search...",
            "catalog.buscar.anime":   "Search anime...",
            "catalog.buscar.manga":   "Search manga...",
            "catalog.buscar.novelas": "Search novel...",
            "catalog.sin_resultados": "No results found.",
            "catalog.cargando":       "Loading...",
            "catalog.error":          "Error loading catalog.",
            "catalog.continuar_viendo": "Continue watching",
            "catalog.favoritos":      "Favorites",
            "catalog.vistos":         "Watched",
            "catalog.filtrar_estado": "Filter by status",
            "catalog.filtros":        "ADDITIONAL FILTERS",
            "catalog.limpiar":        "Clear Filters",
            "catalog.nsfw.titulo":    "Show NSFW",
            "catalog.nsfw.desc":      "Enable to show adult content.",
            "catalog.genero":         "GENRE",
            "catalog.buscar_genero":  "Search genre...",
            "catalog.abrir_filtros":  "Open filters",

            // ── Detail ───────────────────────────────────────────────────────
            "detail.cargando":        "Fetching detail from the API...",
            "detail.no_encontrado":   "This title was not found.",
            "detail.sin_sinopsis":    "No synopsis available.",
            "detail.sinopsis":        "SYNOPSIS",
            "detail.generos":         "GENRES",
            "detail.capitulos":       "CHAPTERS",
            "detail.episodios":       "EPISODES",
            "detail.volumenes":       "VOLUMES",
            "detail.estado":          "Status",
            "detail.puntaje":         "Score",
            "detail.sin_capitulos":   "No chapters specified in the API.",
            "detail.progreso_general": "OVERALL PROGRESS",
            "detail.completados":     "{vistos}/{total} completed",
            "detail.volver":          "Back to catalog",
            "detail.compartir":       "Share with friends",
            "detail.favorito":        "Add to favorites",
            "detail.marcar_visto":    "Mark as watched",
            "detail.ver_mas":         "See more",
            "detail.perfil":          "PROFILE",
            "detail.abrir":           "OPEN",
            "detail.configuracion":   "SETTINGS",
            "detail.cargando_kicker": "Loading",
            "detail.no_encontrado_kicker": "Not found",
            "detail.sinopsis_h3":     "SYNOPSIS",
            "detail.generos_h3":      "GENRES",
            "detail.capitulos_h3":    "CHAPTERS",
            "detail.episodios_h3":    "EPISODES",
            "detail.volumenes_h3":    "VOLUMES",
            "detail.barra_capitulos": "OVERALL CHAPTERS",
            "detail.barra_episodios": "OVERALL EPISODES",
            "detail.barra_volumenes": "OVERALL VOLUMES",
            "detail.modal.info":      "Information",
            "detail.modal.cerrar":    "Close",

            // ── Top / Ranking ────────────────────────────────────────────────
            "rank.titulo":        "TOP RANKING",
            "rank.subtitulo":     "The highest rated by the community.",
            "rank.cargando":      "Loading ranking...",
            "rank.cargar_mas":    "Load more",
            "rank.no_resultados": "No results.",
            "top.rank.title":     "RANKING",
            "top.rank.subtitle":  "Players sorted by level and total experience.",

            // ── My Lists ─────────────────────────────────────────────────────
            "lists.cargando":   "Loading your lists...",
            "lists.titulo":     "MY LISTS",
            "lists.subtitulo":  "Your \"Likes\" and \"Watched\" separated by category.",
            "lists.vacio":      "You have no items in this category.",
            "lists.sidebar.mis_listas": "My Lists",
            "lists.sidebar.actividad": "Activity",
            "lists.sidebar.logros": "Achievements",
            "lists.sidebar.estadisticas": "Statistics",
            "lists.card.anime": "ANIME",
            "lists.card.manga": "MANGA",
            "lists.card.novelas": "NOVELS",
            "lists.card.sublabel": "Saved titles",
            "lists.card.ver_catalogo": "View catalog ➜",
            "lists.card.actividad_reciente": "RECENT ACTIVITY",
            "lists.card.ver_todo": "View all ➜",
            "lists.card.sin_actividad": "No recent activity.",
            "lists.filter.todo": "All",
            "lists.filter.me_gusta": "Likes",
            "lists.filter.vistos": "Watched",
            "lists.filter.exportar": "Export JSON",
            "lists.results.titulo": "RESULTS",
            "lists.results.todos": "All",
            "lists.results.anime": "Anime",
            "lists.results.manga": "Manga",
            "lists.results.novelas": "Novels",
            "lists.recommend.titulo": "RECOMMENDED FOR YOU",
            "lists.recommend.subtitulo": "Based on what you marked as watched.",
            "lists.activity.titulo": "RECENT ACTIVITY",
            "lists.activity.subtitulo": "Your latest anime, manga and novels tracked.",
            "lists.activity.sin_actividad": "No activity",
            "lists.activity.no_actividad_desc": "No recent activity.",
            "lists.achievements.titulo": "ACHIEVEMENTS",
            "lists.achievements.subtitulo": "Unlock achievements by liking, watching, and logging progress.",
            "lists.stats.titulo": "STATISTICS",
            "lists.stats.subtitulo": "Summary of your app activity.",

            // ── Login ────────────────────────────────────────────────────────
            "login.kicker":     "Your account",
            "login.copy":       "Log in to save favorites, progress and lists to your profile.",
            "login.titulo":     "Log In",
            "login.tab.login":  "Log In",
            "login.tab.crear":  "Create account",
            "login.usuario":    "Username",
            "login.email":      "Email",
            "login.contrasena": "Password",
            "login.ingresar":   "Enter",
            "login.crear":      "Create Account",
            "login.google":     "Continue with Google",
            "login.cerrar":     "Log Out",
            "login.volver":     "Back to home",
            "login.mis_listas": "View my lists",
            "login.placeholder.usuario":   "e.g. NarutoFan",
            "login.placeholder.email":     "youruser@gmail.com",
            "login.placeholder.password":  "********",

            // ── Settings ─────────────────────────────────────────────────────
            "config.titulo":          "SETTINGS",
            "config.subtitulo":       "Customize your experience, information and app preferences.",
            "config.usuario_activo":  "Active user",
            "config.volver_perfil":   "← Back to profile",
            "config.idioma":          "Language",
            "config.notif.titulo":    "Notifications",
            "config.notif.desc":      "Receive alerts and app updates.",
            "config.sugerido.titulo": "Personalized suggested content",
            "config.sugerido.desc":   "Recommendations based on your taste.",
            "config.compact.titulo":  "Compact cards",
            "config.compact.desc":    "Reduce card size to see more content.",
            "config.motion.titulo":   "Reduce animations",
            "config.motion.desc":     "Fewer visual effects for smoother navigation.",
            "config.public.titulo":   "Public profile",
            "config.public.desc":     "Allow other users to view your profile.",
            "config.nsfw.titulo":     "Show NSFW content",
            "config.nsfw.desc":       "Enable to see adult content in the catalog.",
            "config.fondo":           "BACKGROUND",
            "config.autoguardado":    "Changes are saved automatically.",
            "config.cuenta":          "ACCOUNT",
            "config.cuenta_nota":     "Your email and password are managed from the account you sign in with.",
            "config.contenido_privacidad": "CONTENT AND PRIVACY",
            "config.apariencia":      "APPEARANCE",
            "config.cpr.titulo":      "Fix cards per row",
            "config.cpr.desc":        "Without this they adjust to the screen width.",
            "config.cpr.nota":        "Only applies on large screens; on mobile the responsive layout is kept.",
            "config.colores":         "COLORS",
            "config.color.principal":    "Primary accent",
            "config.color.navbar":       "Navbar accent",
            "config.color.secundario":   "Secondary accent",
            "config.color.fondo":        "Dark background",
            "config.color.texto":        "Main text",
            "config.color.texto2":       "Secondary text",
            "config.color.reset":        "🔄 RESET COLORS",
            "config.fondo.default":      "DEFAULT",
            "config.fondo.color":        "COLOR",
            "config.fondo.imagen":       "IMAGE",
            "config.fondo.color_label":  "Background color",
            "config.fondo.url":          "Image URL",
            "config.fondo.archivo":      "Or upload an image from your device",
            "config.datos":           "YOUR DATA",
            "config.exportar":        "📥 EXPORT MY DATA (JSON)",
            "config.restablecer":     "🔄 RESET APPEARANCE",
            "config.cerrar_sesion":   "🚪 SIGN OUT",
            "config.datos_nota":      "Resetting only affects how the app looks on this device. Your lists and progress are stored in your account and are not touched.",
            "notification.levelup":    "Level Up! 🎉 You are now Level {level}! 🌟",

            // ── User / Profile ───────────────────────────────────────────────
            "user.perfil":    "Profile",
            "user.puntos":    "Points",
            "user.nivel":     "Level",
            "user.vistos":    "Watched",
            "user.favoritos": "Favorites",

            // ── Compare ──────────────────────────────────────────────────────
            "compare.titulo": "COMPARE",
            "compare.desc":   "Compare two titles side by side.",

            // ── States ───────────────────────────────────────────────────────
            "state.visto":     "Watched",
            "state.favorito":  "Favorite",
            "state.pendiente": "Pending",

            // ── Errors ───────────────────────────────────────────────────────
            "error.generico":        "Something went wrong. Please try again in a few minutes.",
            "error.conexion":        "No server connection. Check your internet.",
            "error.online":          "Connection restored!",
            "error.no_encontrado":   "Not found.",
            "error.404.title":       "Route lost in the Grid",
            "error.404.text":        "The link you entered does not exist, was moved or is temporarily down.",
            "error.sesion_expirada": "Session expired. Your changes were saved and will sync on reconnect.",
            "error.volver_inicio":   "Back to home",
            "privacy.title":         "Privacy Policy",
            "privacy.updated":       "Last updated: July 2026",
            "terms.title":           "Terms of Service",
            "terms.updated":         "Last updated: July 2026",

            // ── General ──────────────────────────────────────────────────────
            "general.cargando":  "Loading...",
            "general.guardando": "Saving...",
            "general.hecho":     "Done",
            "general.cancelar":  "Cancel",
            "general.cerrar":    "Close"
        }
    };

    function resolveKey(obj, key) {
        // Soporte para claves planas ("nav.inicio") y anidadas
        if (obj[key] != null) return obj[key];
        var parts = key.split(".");
        var current = obj;
        for (var i = 0; i < parts.length && current != null; i++) {
            current = current[parts[i]];
        }
        return current != null ? current : null;
    }

    function interpolate(text, args) {
        if (!args) return text;
        return text.replace(/\{(\w+)\}/g, function (_, k) {
            return args[k] != null ? String(args[k]) : _;
        });
    }

    function getCurrentLang() {
        return localStorage.getItem("pref:lang") || "es";
    }

    var isTranslating = false;
    window.applyTranslations = function (lang) {
        if (isTranslating) return;
        isTranslating = true;
        try {
            lang = lang || getCurrentLang();
            var dict = translations[lang];
            if (!dict) {
                if (lang !== "es") { window.applyTranslations("es"); return; }
                return;
            }

            // Actualizar atributo lang del documento
            document.documentElement.setAttribute("lang", lang);

            var elements = document.querySelectorAll("[data-i18n]");
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                var key = el.getAttribute("data-i18n");
                if (!key) continue;

                var value = resolveKey(dict, key);
                // Fallback al español si la clave no está traducida
                if (value == null) value = resolveKey(translations["es"], key);
                if (value == null) value = "[" + key + "]";

                var argsAttr = el.getAttribute("data-i18n-args");
                var args = null;
                if (argsAttr) { try { args = JSON.parse(argsAttr); } catch (e) { args = null; } }

                var text = interpolate(value, args);
                var attrList = el.getAttribute("data-i18n-attr");

                if (attrList) {
                    var attrs = attrList.split(",");
                    for (var j = 0; j < attrs.length; j++) {
                        var attr = attrs[j].trim();
                        if (attr) el.setAttribute(attr, text);
                    }
                } else {
                    el.textContent = text;
                }
            }
            if (window.lucide) {
                window.lucide.createIcons();
            }
        } finally {
            isTranslating = false;
        }
    };

    // API pública
    window.AppI18n = {
        _translations: translations,
        setLang: function (lang) {
            if (!translations[lang]) return;
            localStorage.setItem("pref:lang", lang);
            window.applyTranslations(lang);
        },
        getLang: getCurrentLang,
        t: function (key, args) {
            var lang = getCurrentLang();
            var dict = translations[lang] || translations["es"];
            var value = resolveKey(dict, key);
            if (value == null) value = resolveKey(translations["es"], key);
            if (value == null) return "[" + key + "]";
            return interpolate(value, args);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { window.applyTranslations(); });
    } else {
        window.applyTranslations();
    }

    // Observador de cambios para traducir elementos inyectados dinámicamente
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function (mutations) {
            if (isTranslating) return;
            var needsTranslation = false;
            for (var i = 0; i < mutations.length; i++) {
                var addedNodes = mutations[i].addedNodes;
                for (var j = 0; j < addedNodes.length; j++) {
                    var node = addedNodes[j];
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        if (node.hasAttribute("data-i18n") || node.querySelector("[data-i18n]")) {
                            needsTranslation = true;
                            break;
                        }
                    }
                }
                if (needsTranslation) break;
            }
            if (needsTranslation) {
                window.applyTranslations();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
