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
            "nav.calendario":     "Calendario",
            "nav.retos":          "Retos",
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
            "index.card.retos":    "Adiviná el anime del día",
            "index.reto":          "Reto del día",
            "index.destacados":    "Destacados",
            "index.populares":     "Más populares",
            "index.continuar":     "Continuar viendo",
            "index.recomendado":   "Recomendado para vos",

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

            // ── Tarjetas del catálogo (cards.js, texto dinámico) ─────────────
            "card.type.anime":          "Anime",
            "card.type.novela_ligera":  "Novela ligera",
            "card.type.novela":         "Novela",
            "card.type.novela_coreana": "Novela coreana",
            "card.type.novela_china":   "Novela china",
            "card.type.manga":          "Manga",
            "card.unit.eps":            "eps",
            "card.unit.vol":            "vol.",
            "card.unit.cap":            "cap.",
            "card.label.capitulos":     "capítulos",
            "card.label.volumenes":     "volúmenes",
            "card.progreso_libre":      "Progreso libre",
            "card.progreso_libre_sub":  "Marcá como visto completo usando el botón 👁",
            "card.pct_visto":           "{pct}% VISTO",
            "card.status.releasing":    "En emisión",
            "card.status.publishing":   "Publicándose",
            "card.status.finished":     "Finalizado",
            "card.status.upcoming":     "Próximamente",
            "card.status.cancelled":    "Cancelado",
            "card.status.hiatus":       "En pausa",
            "card.btn.detalle":         "DETALLE",
            "card.btn.ver_episodios":   "Ver episodios",
            "card.btn.ver_vols":        "Ver volúmenes y capítulos",
            "card.btn.episodios":       "EPISODIOS",
            "card.btn.volumenes":       "VOLÚMENES",
            "card.aria.ver_info":       "Ver información de {title}",
            "card.aria.ver_info_short": "Ver info",
            "card.aria.volver":         "Volver al frente",
            "card.aria.volver_short":   "Volver",
            "card.aria.seguimiento":    "Estado de seguimiento",
            "card.aria.favorito":       "Favorito",
            "card.aria.visto":          "Visto",
            "card.seguimiento.placeholder": "— Seguimiento —",
            "card.seguimiento.viendo":      "Viendo",
            "card.seguimiento.pendiente":   "Pendiente",
            "card.seguimiento.pausado":     "En pausa",
            "card.seguimiento.abandonado":  "Abandonado",
            "card.sin_titulo":          "Sin título",
            "card.err.sin_conexion.kicker":  "Sin conexión",
            "card.err.sin_conexion.detalle": "Parece que te quedaste sin internet. Reconectate y tocá Reintentar.",
            "card.err.rate.kicker":     "Demasiadas peticiones",
            "card.err.rate.detalle":    "AniList está limitando las peticiones por exceso de uso. Esperá un minuto y tocá Reintentar, no es un problema de tu conexión.",
            "card.err.timeout.kicker":  "La API tardó demasiado",
            "card.err.timeout.detalle": "AniList no respondió a tiempo. Puede estar saturada; probá de nuevo en unos segundos.",
            "card.err.generico.kicker": "API no disponible",
            "card.err.generico.detalle": "Revisá tu conexión y tocá Reintentar.",
            "card.err.reintentar":      "Reintentar",
            "card.err.reintentando":    "Cargando…",
            "card.loader.animes":       "animes",
            "card.loader.novelas":      "novelas",
            "card.loader.mangas":       "mangas",
            "card.empty.kicker":        "Sin resultados",
            "card.empty.titulo":        "La API no devolvió {tipo} para esta página.",
            "card.empty.detalle":       "Posible límite de velocidad (rate limit). Esperá unos segundos y recargá.",
            "card.err.titulo":          "No se pudo cargar el catálogo de {tipo}.",

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
            "detail.err_conexion":    "No se pudo cargar",
            "detail.err_conexion_kicker": "Error de conexión",
            "detail.err_conexion_msg": "Hubo un problema al conectar con AniList. Revisá tu conexión y tocá Reintentar.",
            "detail.reintentar":      "Reintentar",
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

            // ── Auth (auth.js: mensajes de sesión y racha) ───────────────────
            "auth.iniciar_sesion":     "Iniciar sesión",
            "auth.creando":            "Creando cuenta...",
            "auth.iniciando":          "Iniciando sesión...",
            "auth.err.falta_usuario":  "Escribí un nombre de usuario o correo.",
            "auth.err.usuario_corto":  "El usuario debe tener al menos 3 caracteres.",
            "auth.err.gmail":          "Usá un correo @gmail.com válido.",
            "auth.err.pass_corta":     "La contraseña debe tener al menos 6 caracteres.",
            "auth.err.sin_servidor":   "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
            "auth.err.ya_existe":      "Ese correo ya tiene una cuenta. Iniciá sesión en cambio.",
            "auth.err.email_invalido": "El correo ingresado no es válido.",
            "auth.err.pass_debil":     "La contraseña es muy débil. Usá al menos 6 caracteres.",
            "auth.err.crear":          "Error al crear cuenta. Intentá de nuevo.",
            "auth.ok.confirmar":       "✅ Cuenta creada. Revisá tu correo para confirmarla.",
            "auth.ok.creada":          "✅ Cuenta creada exitosamente.",
            "auth.ok.creada_login":    "Cuenta creada. Iniciá sesión para continuar.",
            "auth.err.sin_conexion":   "Sin conexión al servidor. Revisá tu internet e intentá de nuevo.",
            "auth.err.falta_email":    "Ingresá tu correo electrónico para iniciar sesión.",
            "auth.err.credenciales":   "Correo o contraseña incorrectos.",
            "auth.err.no_confirmado":  "Confirmá tu correo antes de iniciar sesión.",
            "auth.err.login":          "Error al iniciar sesión. Intentá de nuevo.",
            "auth.err.no_login":       "No se pudo iniciar sesión. Intentá de nuevo.",
            "auth.racha":              "¡Racha de {count} días! (+{delta} EXP)",
            "auth.bienvenido":         "¡Bienvenido! (+{delta} EXP por login diario)",

            // ── Login page (login.js: mensajes dinámicos) ────────────────────
            "login.msg.crear_cuenta":    "Crear cuenta",
            "login.msg.iniciar_sesion":  "Iniciar sesión",
            "login.msg.entrar":          "Entrar",
            "login.msg.tu_cuenta":       "Tu cuenta",
            "login.msg.conectado":       "Conectado como {name}.",
            "login.msg.file_protocol":   "Abrí la página con un servidor local (node tools/serve.cjs). Supabase no funciona bien desde file://.",
            "login.msg.falta_config":    "Falta la configuración de Supabase en js/core/config.js.",
            "login.msg.sin_red":         "No hay conexión de red.",
            "login.msg.no_cargo":        "No se cargó Supabase. Revisá la conexión o abrí la app desde un servidor local.",
            "login.msg.no_disponible":   "Supabase no está disponible. Revisá la conexión y recargá la página.",
            "login.msg.correo_invalido": "Ingresá un correo válido.",
            "login.msg.pass_corta":      "La contraseña debe tener al menos 6 caracteres.",
            "login.msg.usuario_corto":   "El usuario debe tener al menos 3 caracteres.",
            "login.msg.creando":         "Creando cuenta...",
            "login.msg.iniciando":       "Iniciando sesión...",
            "login.msg.cuenta_entrando": "Cuenta creada. Entrando...",
            "login.msg.cuenta_confirmar": "Cuenta creada. Revisá tu correo para confirmarla.",
            "login.msg.sesion_iniciada": "Sesión iniciada.",
            "login.msg.credenciales":    "Correo o contraseña incorrectos.",
            "login.msg.no_confirmado":   "Confirmá tu correo antes de iniciar sesión.",
            "login.msg.error":           "Error: {message}",
            "login.msg.google_no":       "El inicio con Google no está habilitado en esta configuración.",
            "login.msg.abriendo_google": "Abriendo Google...",
            "login.msg.google_error":    "No se pudo iniciar con Google: {message}",
            "login.msg.sesion_cerrada":  "Sesión cerrada.",
            "login.msg.file_warn":       "⚠️ Estás usando file://. Usá un servidor local: node tools/serve.cjs",
            "login.msg.volviendo":       "Sesión iniciada. Volviendo...",

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
            "config.sqsize.titulo":  "Tamaño de los cuadrados de detalles",
            "config.sqsize.desc":    "Cambia el tamaño de los cuadrados de capítulos, episodios y volúmenes en cada ficha.",
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
            "calendar.titulo":         "CALENDARIO DE ESTRENOS",
            "calendar.desc":           "Los episodios que salen esta semana. Seguí un anime para verlo destacado.",
            "calendar.solo_seguidos":  "Solo lo que sigo",
            "retos.titulo":            "RETOS DEL DÍA",
            "retos.desc":              "Un anime nuevo para adivinar cada día, misiones que dan EXP y tu resumen del mes.",
            "retos.quiz":              "Adiviná el anime",
            "retos.cargando":          "Cargando el reto de hoy…",
            "retos.misiones":          "Misiones",
            "retos.personajes":        "Adiviná el personaje",
            "retos.tab_anime":         "Del día",
            "retos.tab_personajes":    "Personajes",
            "retos.tab_popular":       "Más popular",
            "retos.tab_deque":         "¿De qué anime?",
            "retos.tab_misiones":      "Misiones",
            "retos.versus":            "¿Cuál es más popular?",
            "retos.deque":             "¿De qué anime es?",
            "retos.cargando_juego":    "Cargando…",
            "retos.resumen":           "Tu mes en Mirudoku",
            "retos.este_mes":          "Este mes",
            "retos.mes_pasado":        "Mes pasado",
            "retos.push":              "¿Querés que te avisemos cuando salga un episodio de lo que estás viendo?",
            "retos.push_btn":          "Activar avisos",

            "compare.titulo":  "COMPARAR",
            "compare.desc":    "Compará dos títulos lado a lado.",

            // ── Estados ──────────────────────────────────────────────────────
            "state.visto":     "Visto",
            "state.favorito":  "Favorito",
            "state.pendiente": "Pendiente",

            // ── Toasts / avisos (states.js) ──────────────────────────────────
            "toast.session.pending":  "Sesión expirada. Los cambios pendientes se reintentarán automáticamente.",
            "toast.session.progress": "Sesión expirada. Tu progreso se guardó y se sincronizará al reconectar.",
            "toast.session.exp":      "Sesión expirada. La experiencia se sincronizará al reconectar.",
            "toast.estado":           "Estado: {label}",
            "toast.estado_quitado":   "Estado de seguimiento quitado",
            "toast.fav_add":          "¡Agregado a Favoritos! ❤️ (+{xp} EXP)",
            "toast.visto_add":        "¡Marcado como Visto! 👁️ (+{xp} EXP)",
            "toast.fav_remove":       "Quitado de Favoritos (-{xp} EXP)",
            "toast.visto_remove":     "Marcado como no visto (-{xp} EXP)",

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
            "privacy.intro":    "En Mirudoku valoramos y respetamos tu privacidad. Esta política describe cómo recopilamos, utilizamos y protegemos la información personal que nos proporcionas al usar nuestra plataforma.",
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
            "terms.intro":  "Bienvenido a Mirudoku. Al acceder y utilizar este sitio web, aceptas cumplir con los siguientes términos y condiciones de uso.",
            "terms.h1":     "1. Uso de la Plataforma",
            "terms.s1.p":   "Mirudoku es un catálogo informativo de anime, manga y novelas ligeras que permite a los usuarios registrar de forma personal su progreso e interactuar con listas. Queda prohibido cualquier uso indebido del sitio, como intentos de vulnerar los sistemas de seguridad de la base de datos o el uso de bots para alterar el ranking de experiencia (XP).",
            "terms.h2":     "2. Propiedad Intelectual e Información de Terceros",
            "terms.s2.p":   "Las portadas, sinopsis y datos de los títulos provienen de APIs públicas de terceros (principalmente AniList y MangaDex). Mirudoku no se adjudica la propiedad de dichos materiales y reconoce los derechos de autor de las respectivas productoras y creadores. Los datos del sitio se proveen únicamente con fines educativos y de entretenimiento personal.",
            "terms.h3":     "3. Limitación de Responsabilidad",
            "terms.s3.p":   "La plataforma se proporciona «tal cual» y «según disponibilidad». No garantizamos que el servicio sea ininterrumpido o libre de errores. Mirudoku no será responsable por la pérdida temporal de datos de progreso que pueda ocurrir debido a problemas de conexión o fallos en las APIs externas.",
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

    // ── Idiomas que no son el español ────────────────────────────────────
    // Viven en su propio archivo (js/core/i18n-<lang>.min.js) y se piden solo
    // si hacen falta: el español siempre esta porque es el fallback, y es lo
    // que usa casi todo el mundo. El build reemplaza __I18N_EN_VERSION__ por el
    // hash del diccionario para que el cache no sirva uno viejo.
    var LAZY_LANGS = { en: "__I18N_EN_VERSION__" };
    var scriptSrc = (document.currentScript && document.currentScript.src) || "";

    function langUrl(lang) {
        var base = scriptSrc ? scriptSrc.replace(/i18n(\.min)?\.js(\?.*)?$/, "") : "js/core/";
        return base + "i18n-" + lang + ".min.js?v=" + LAZY_LANGS[lang];
    }

    // Toma un diccionario que ya se cargo (window.__i18nDicts, lo llena el
    // archivo del idioma) y repinta.
    function registerLang(lang) {
        var dicts = window.__i18nDicts || {};
        if (!dicts[lang]) return;
        translations[lang] = dicts[lang];
        if (getCurrentLang() !== lang) return;
        if (document.readyState !== "loading") window.applyTranslations(lang);
        try {
            window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: lang } }));
        } catch (e) { /* sin CustomEvent: sin repintado en vivo */ }
    }

    function loadLang(lang) {
        if (translations[lang] || !LAZY_LANGS[lang]) return;
        if (window.__i18nDicts && window.__i18nDicts[lang]) { registerLang(lang); return; }
        var url = langUrl(lang);
        if (document.readyState === "loading" && document.currentScript) {
            // Mientras se parsea la pagina, document.write lo carga en orden,
            // antes que los scripts defer: las paginas pintan en el idioma
            // correcto desde el primer render, igual que cuando venia todo junto.
            document.write('<script src="' + url + '"><\/script>');
            return;
        }
        var el = document.createElement("script");
        el.src = url;
        document.head.appendChild(el);
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
            if (!translations[lang] && !LAZY_LANGS[lang]) return;
            localStorage.setItem("pref:lang", lang);
            // Si el diccionario todavia no bajo, registerLang repinta y avisa
            // cuando llegue.
            if (!translations[lang]) { loadLang(lang); return; }
            window.applyTranslations(lang);
            // Aviso para el contenido que las paginas pintan por JS (no via
            // data-i18n): esos no los alcanza applyTranslations y necesitan
            // repintarse. Ej: las cards de comparar.
            try {
                window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: getCurrentLang() } }));
            } catch (e) { /* CustomEvent no disponible: sin repintado en vivo */ }
        },
        getLang: getCurrentLang,
        _register: registerLang,
        t: function (key, args) {
            var lang = getCurrentLang();
            var dict = translations[lang] || translations["es"];
            var value = resolveKey(dict, key);
            if (value == null) value = resolveKey(translations["es"], key);
            if (value == null) return "[" + key + "]";
            return interpolate(value, args);
        }
    };

    loadLang(getCurrentLang());

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
