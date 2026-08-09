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
            "nav.top_jugadores":  "Top de jugadores",
            "nav.ranking":        "Ranking",
            "nav.mis_listas":     "Mis Listas",
            "nav.listas":         "Listas",
            "nav.mas":            "Más",
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
            "index.card.ranking":  "Los títulos mejor puntuados",
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
            "catalog.refinar":        "REFINAR",
            "catalog.orden":          "Orden",
            "catalog.orden.popularidad": "Popularidad",
            "catalog.orden.tendencia":   "Tendencia",
            "catalog.orden.puntuados":   "Mejor puntuados",
            "catalog.orden.recientes":   "Más recientes",
            "catalog.orden.az":          "A – Z",
            "catalog.anio":           "Año",
            "catalog.todos":          "Todos",
            "catalog.todas":          "Todas",
            "catalog.temporada":      "Temporada",
            "catalog.temporada.invierno":  "Invierno",
            "catalog.temporada.primavera": "Primavera",
            "catalog.temporada.verano":    "Verano",
            "catalog.temporada.otono":     "Otoño",
            "catalog.formato":        "Formato",
            "catalog.formato.pelicula":  "Película",
            "catalog.formato.especial":  "Especial",
            "catalog.formato.tvcorta":   "TV corta",
            "catalog.formato.musical":   "Musical",

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
            "config.mascota.elegir":     "🐾 Elegí tu personaje",
            "personajes.titulo":         "ELEGÍ TU PERSONAJE",
            "personajes.subtitulo":      "Tocá un personaje para que te acompañe por la app.",
            "personajes.nota":           "El cambio se aplica al instante y se guarda en este dispositivo.",
            "personajes.volver":         "← Volver a configuración",
            "config.idioma":         "Idioma",
            "config.tema":           "Tema",
            "config.tema.auto":      "🌗 Automático (sistema)",
            "config.tema.oscuro":    "🌙 Oscuro",
            "config.tema.claro":     "☀️ Claro",
            "config.notif.titulo":   "Notificaciones",
            "config.notif.desc":     "Recibir alertas y novedades de la app.",
            "config.mascota.titulo": "Personaje Rimuru",
            "config.mascota.desc":   "Rimuru, el slime, anuncia las notificaciones hablando en pantalla.",
            "config.roam.titulo":    "Rimuru en movimiento",
            "config.roam.desc":      "Rimuru pasea por la pantalla y se posa sobre las cards y la barra.",
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

            // ── Comparar (comparar.html) ─────────────────────────────────────
            "compare.label.catalogo": "Catálogo",
            "compare.label.primero":  "Primer título",
            "compare.label.segundo":  "Segundo título",
            "compare.buscar_ph":      "Buscá un título...",
            "compare.boton":          "Comparar",
            "compare.opt.anime":      "Anime",
            "compare.opt.manga":      "Manga",
            "compare.opt.novelas":    "Novelas",
            "compare.aria.form":      "Elegir títulos a comparar",
            "compare.aria.resultado": "Resultado comparación",
            "compare.sin_portada":    "Sin portada",
            "compare.sin_sinopsis":   "Sin sinopsis disponible.",
            "compare.sin_titulo":     "Sin título",
            "compare.stat.puntaje":    "Puntaje",
            "compare.stat.episodios":  "Episodios",
            "compare.stat.por_ep":     "Por episodio",
            "compare.stat.duracion":   "Duración",
            "compare.stat.usuarios":   "Usuarios",
            "compare.stat.volumenes":  "Volúmenes",
            "compare.stat.capitulos":  "Capítulos",
            "compare.det.estudio":     "Estudio",
            "compare.det.basado":      "Basado en",
            "compare.det.emision":     "Emisión",
            "compare.det.favoritos":   "Favoritos",
            "compare.det.autor":       "Autor",
            "compare.det.origen":      "Origen",
            "compare.det.publicacion": "Publicación",
            "compare.kind.anime":      "Anime",
            "compare.kind.manga":      "Manga",
            "compare.kind.novela":     "Novela",
            "compare.abrir":           "Abrir detalle",
            "compare.vacio":           "Seleccioná un ítem para comparar",
            "compare.buscando":        "Buscando…",
            "compare.sin_resultados":  "Sin resultados",
            "compare.error_busqueda":  "No se pudo buscar. Probá de nuevo.",
            "compare.link_copiado":    "Enlace copiado",
            "compare.intercambiar":    "Intercambiar",
            "compare.copiar":          "Copiar enlace",
            "compare.aria.intercambiar": "Intercambiar los dos lados",
            "compare.aria.copiar":     "Copiar enlace de la comparación",

            // ── Ranking de títulos (ranking.html) ────────────────────────────
            "rank.tab.anime":         "Anime",
            "rank.tab.manga":         "Manga",
            "rank.tab.novelas":       "Novelas",
            "rank.aria.categoria":    "Categoría del ranking",
            "rank.ver_jugadores":     "Ver el ranking de jugadores",
            "rank.error":             "No se pudo cargar el ranking. Puede ser un límite temporal de la API.",
            "rank.reintentar":        "Reintentar",
            "rank.en_ranking":        "{n} {cat} en el ranking",
            "rank.sin_titulo":        "Sin título",

            // ── Privacidad (privacidad.html) ─────────────────────────────────
            "privacy.intro":    "En Anime Destiny valoramos y respetamos tu privacidad. Esta política describe cómo recopilamos, utilizamos y protegemos la información personal que nos proporcionas al usar nuestra plataforma.",
            "privacy.h1":       "1. Información que recopilamos",
            "privacy.s1.intro": "Al registrarte y utilizar nuestra plataforma, recopilamos la siguiente información:",
            "privacy.s1.li1.k": "Información de registro:",
            "privacy.s1.li1.v": "Correo electrónico y nombre de usuario provisto a través del sistema de autenticación de Supabase.",
            "privacy.s1.li2.k": "Datos de actividad:",
            "privacy.s1.li2.v": "Tu progreso de lectura o visualización, tus listas de favoritos («Me gusta») y marcados como «Vistos».",
            "privacy.s1.li3.k": "Estadísticas básicas:",
            "privacy.s1.li3.v": "Puntajes y niveles ganados por interacción de experiencia (XP).",
            "privacy.h2":       "2. Uso de la información",
            "privacy.s2.intro": "Utilizamos los datos recopilados únicamente para:",
            "privacy.s2.li1":   "Permitir el acceso seguro a tu cuenta y sincronizar tu progreso entre múltiples dispositivos.",
            "privacy.s2.li2":   "Mostrar tus estadísticas personalizadas de perfil y ranking global de usuarios.",
            "privacy.s2.li3":   "Mejorar el sistema de recomendaciones locales basado en tu historial.",
            "privacy.h3":       "3. Almacenamiento y protección de datos",
            "privacy.s3.p":     "Todos tus datos de autenticación y listas se almacenan de manera segura en las bases de datos de Supabase. Nosotros no vendemos ni compartimos tu información personal con terceros bajo ningún concepto.",
            "privacy.h4":       "4. Cookies y almacenamiento local",
            "privacy.s4.p":     "Utilizamos almacenamiento local (localStorage) para guardar temporalmente tus preferencias estéticas (como el color del tema visual o el tamaño de las cards) y para mantener tu sesión activa de manera segura mediante el token de autenticación provisto por Supabase.",
            "privacy.h5":       "5. Tus derechos",
            "privacy.s5.p":     "Tienes derecho en cualquier momento a solicitar la eliminación completa de tu cuenta y todos tus datos asociados. Puedes hacerlo directamente desde la sección de configuración de perfil en nuestra aplicación.",
            "privacy.h6":       "6. Contacto",
            "privacy.s6.p":     "Si tienes alguna consulta sobre nuestra política de privacidad, puedes contactarnos en:",

            // ── Términos (terminos.html) ─────────────────────────────────────
            "terms.intro":  "Bienvenido a Anime Destiny. Al acceder y utilizar este sitio web, aceptas cumplir con los siguientes términos y condiciones de uso.",
            "terms.h1":     "1. Uso de la Plataforma",
            "terms.s1.p":   "Anime Destiny es un catálogo informativo de anime, manga y novelas ligeras que permite a los usuarios registrar de forma personal su progreso e interactuar con listas. Queda prohibido cualquier uso indebido del sitio, como intentos de vulnerar los sistemas de seguridad de la base de datos o el uso de bots para alterar el ranking de experiencia (XP).",
            "terms.h2":     "2. Propiedad Intelectual e Información de Terceros",
            "terms.s2.p":   "Las portadas, sinopsis y datos de los títulos provienen de APIs públicas de terceros (principalmente AniList y MangaDex). Anime Destiny no se adjudica la propiedad de dichos materiales y reconoce los derechos de autor de las respectivas productoras y creadores. Los datos del sitio se proveen únicamente con fines educativos y de entretenimiento personal.",
            "terms.h3":     "3. Limitación de Responsabilidad",
            "terms.s3.p":   "La plataforma se proporciona «tal cual» y «según disponibilidad». No garantizamos que el servicio sea ininterrumpido o libre de errores. Anime Destiny no será responsable por la pérdida temporal de datos de progreso que pueda ocurrir debido a problemas de conexión o fallos en las APIs externas.",
            "terms.h4":     "4. Cuentas de Usuario y Modificaciones",
            "terms.s4.p":   "Nos reservamos el derecho de dar de baja o suspender cuentas de usuario que realicen prácticas abusivas o fraudulentas en el sistema. Asimismo, nos reservamos el derecho de modificar estos términos de servicio en cualquier momento, informando de los cambios en esta página.",
            "terms.h5":     "5. Legislación Aplicable",
            "terms.s5.p":   "Estos términos se regirán e interpretarán de acuerdo con las leyes vigentes del territorio desde donde se hostea la aplicación principal.",

            // ── Sin conexión (offline.html) ──────────────────────────────────
            "offline.title": "Sin conexión",
            "offline.text":  "No pudimos cargar esta página. Revisá tu conexión a internet e intentá de nuevo.",
            "offline.retry": "Reintentar",
            "offline.home":  "Ir al inicio",

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
            "nav.top_jugadores":  "Player ranking",
            "nav.ranking":        "Ranking",
            "nav.mis_listas":     "My Lists",
            "nav.listas":         "Lists",
            "nav.mas":            "More",
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
            "index.card.ranking":  "The highest rated titles",
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
            "catalog.refinar":        "REFINE",
            "catalog.orden":          "Sort",
            "catalog.orden.popularidad": "Popularity",
            "catalog.orden.tendencia":   "Trending",
            "catalog.orden.puntuados":   "Top rated",
            "catalog.orden.recientes":   "Newest",
            "catalog.orden.az":          "A – Z",
            "catalog.anio":           "Year",
            "catalog.todos":          "All",
            "catalog.todas":          "All",
            "catalog.temporada":      "Season",
            "catalog.temporada.invierno":  "Winter",
            "catalog.temporada.primavera": "Spring",
            "catalog.temporada.verano":    "Summer",
            "catalog.temporada.otono":     "Fall",
            "catalog.formato":        "Format",
            "catalog.formato.pelicula":  "Movie",
            "catalog.formato.especial":  "Special",
            "catalog.formato.tvcorta":   "TV short",
            "catalog.formato.musical":   "Music",
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
            "config.mascota.elegir":     "🐾 Choose your character",
            "personajes.titulo":         "CHOOSE YOUR CHARACTER",
            "personajes.subtitulo":      "Tap a character to have it follow you around the app.",
            "personajes.nota":           "The change applies instantly and is saved on this device.",
            "personajes.volver":         "← Back to settings",
            "config.idioma":          "Language",
            "config.tema":            "Theme",
            "config.tema.auto":       "🌗 Automatic (system)",
            "config.tema.oscuro":     "🌙 Dark",
            "config.tema.claro":      "☀️ Light",
            "config.notif.titulo":    "Notifications",
            "config.notif.desc":      "Receive alerts and app updates.",
            "config.mascota.titulo":  "Rimuru character",
            "config.mascota.desc":    "Rimuru the slime announces notifications by speaking on-screen.",
            "config.roam.titulo":     "Roaming Rimuru",
            "config.roam.desc":       "Rimuru wanders the screen and perches on cards and the bar.",
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

            // ── Compare (comparar.html) ──────────────────────────────────────
            "compare.label.catalogo": "Catalog",
            "compare.label.primero":  "First title",
            "compare.label.segundo":  "Second title",
            "compare.buscar_ph":      "Search a title...",
            "compare.boton":          "Compare",
            "compare.opt.anime":      "Anime",
            "compare.opt.manga":      "Manga",
            "compare.opt.novelas":    "Novels",
            "compare.aria.form":      "Choose titles to compare",
            "compare.aria.resultado": "Comparison result",
            "compare.sin_portada":    "No cover",
            "compare.sin_sinopsis":   "No synopsis available.",
            "compare.sin_titulo":     "Untitled",
            "compare.stat.puntaje":    "Score",
            "compare.stat.episodios":  "Episodes",
            "compare.stat.por_ep":     "Per episode",
            "compare.stat.duracion":   "Duration",
            "compare.stat.usuarios":   "Users",
            "compare.stat.volumenes":  "Volumes",
            "compare.stat.capitulos":  "Chapters",
            "compare.det.estudio":     "Studio",
            "compare.det.basado":      "Based on",
            "compare.det.emision":     "Airing",
            "compare.det.favoritos":   "Favorites",
            "compare.det.autor":       "Author",
            "compare.det.origen":      "Origin",
            "compare.det.publicacion": "Publication",
            "compare.kind.anime":      "Anime",
            "compare.kind.manga":      "Manga",
            "compare.kind.novela":     "Novel",
            "compare.abrir":           "Open details",
            "compare.vacio":           "Pick a title to compare",
            "compare.buscando":        "Searching…",
            "compare.sin_resultados":  "No results",
            "compare.error_busqueda":  "Couldn't search. Try again.",
            "compare.link_copiado":    "Link copied",
            "compare.intercambiar":    "Swap",
            "compare.copiar":          "Copy link",
            "compare.aria.intercambiar": "Swap the two sides",
            "compare.aria.copiar":     "Copy comparison link",

            // ── Title ranking (ranking.html) ─────────────────────────────────
            "rank.tab.anime":         "Anime",
            "rank.tab.manga":         "Manga",
            "rank.tab.novelas":       "Novels",
            "rank.aria.categoria":    "Ranking category",
            "rank.ver_jugadores":     "See the player ranking",
            "rank.error":             "The ranking could not be loaded. It may be a temporary API limit.",
            "rank.reintentar":        "Retry",
            "rank.en_ranking":        "{n} {cat} in the ranking",
            "rank.sin_titulo":        "Untitled",

            // ── Privacy (privacidad.html) ────────────────────────────────────
            "privacy.intro":    "At Anime Destiny we value and respect your privacy. This policy describes how we collect, use and protect the personal information you provide when using our platform.",
            "privacy.h1":       "1. Information we collect",
            "privacy.s1.intro": "When you sign up and use our platform, we collect the following information:",
            "privacy.s1.li1.k": "Registration information:",
            "privacy.s1.li1.v": "Email and username provided through the Supabase authentication system.",
            "privacy.s1.li2.k": "Activity data:",
            "privacy.s1.li2.v": "Your reading or viewing progress, your favorites lists (“Likes”) and items marked as “Watched”.",
            "privacy.s1.li3.k": "Basic statistics:",
            "privacy.s1.li3.v": "Scores and levels earned through experience points (XP) interaction.",
            "privacy.h2":       "2. Use of information",
            "privacy.s2.intro": "We use the collected data solely to:",
            "privacy.s2.li1":   "Allow secure access to your account and sync your progress across multiple devices.",
            "privacy.s2.li2":   "Show your personalized profile statistics and global user ranking.",
            "privacy.s2.li3":   "Improve the local recommendation system based on your history.",
            "privacy.h3":       "3. Data storage and protection",
            "privacy.s3.p":     "All your authentication data and lists are stored securely in Supabase databases. We do not sell or share your personal information with third parties under any circumstances.",
            "privacy.h4":       "4. Cookies and local storage",
            "privacy.s4.p":     "We use local storage (localStorage) to temporarily save your visual preferences (such as the theme color or card size) and to keep your session active securely through the authentication token provided by Supabase.",
            "privacy.h5":       "5. Your rights",
            "privacy.s5.p":     "You have the right at any time to request the complete deletion of your account and all associated data. You can do it directly from the profile settings section in our application.",
            "privacy.h6":       "6. Contact",
            "privacy.s6.p":     "If you have any questions about our privacy policy, you can contact us at:",

            // ── Terms (terminos.html) ────────────────────────────────────────
            "terms.intro":  "Welcome to Anime Destiny. By accessing and using this website, you agree to comply with the following terms and conditions of use.",
            "terms.h1":     "1. Use of the Platform",
            "terms.s1.p":   "Anime Destiny is an informational catalog of anime, manga and light novels that lets users personally track their progress and interact with lists. Any misuse of the site is prohibited, such as attempts to breach the database security systems or the use of bots to alter the experience (XP) ranking.",
            "terms.h2":     "2. Intellectual Property and Third-Party Information",
            "terms.s2.p":   "Covers, synopses and title data come from public third-party APIs (mainly AniList and MangaDex). Anime Destiny does not claim ownership of such materials and acknowledges the copyright of the respective studios and creators. The site's data is provided solely for educational and personal entertainment purposes.",
            "terms.h3":     "3. Limitation of Liability",
            "terms.s3.p":   "The platform is provided “as is” and “as available”. We do not guarantee that the service will be uninterrupted or error-free. Anime Destiny will not be liable for the temporary loss of progress data that may occur due to connection issues or failures in external APIs.",
            "terms.h4":     "4. User Accounts and Modifications",
            "terms.s4.p":   "We reserve the right to remove or suspend user accounts that engage in abusive or fraudulent practices in the system. Likewise, we reserve the right to modify these terms of service at any time, reporting the changes on this page.",
            "terms.h5":     "5. Applicable Law",
            "terms.s5.p":   "These terms shall be governed and interpreted in accordance with the laws in force in the territory where the main application is hosted.",

            // ── Offline (offline.html) ───────────────────────────────────────
            "offline.title": "No connection",
            "offline.text":  "We couldn't load this page. Check your internet connection and try again.",
            "offline.retry": "Retry",
            "offline.home":  "Go to home",

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
            // Aviso para el contenido que las paginas pintan por JS (no via
            // data-i18n): esos no los alcanza applyTranslations y necesitan
            // repintarse. Ej: las cards de comparar.
            try {
                window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: getCurrentLang() } }));
            } catch (e) { /* CustomEvent no disponible: sin repintado en vivo */ }
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
