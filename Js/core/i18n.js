(function () {
    "use strict";

    var translations = {
        es: {
            "nav.inicio": "Inicio",
            "nav.anime": "Anime",
            "nav.manga": "Manga",
            "nav.novelas": "Novelas",
            "nav.comparar": "Comparar",
            "nav.top": "Top",
            "nav.mis_listas": "Mis Listas",
            "nav.configuracion": "Configuración",
            "nav.cuenta": "Cuenta",
            "nav.ingresar": "Ingresar",
            "nav.perfil": "Perfil",
            "nav.cerrar_sesion": "Cerrar Sesión",

            "catalog.buscar": "Buscar...",
            "catalog.sin_resultados": "No se encontraron resultados.",
            "catalog.cargando": "Cargando...",
            "catalog.error": "Error al cargar el catálogo.",
            "catalog.continuar_viendo": "Continuar viendo",
            "catalog.favoritos": "Favoritos",
            "catalog.vistos": "Vistos",
            "catalog.filtrar_estado": "Filtrar por estado",

            "detail.cargando": "Buscando detalle en la API...",
            "detail.no_encontrado": "No se encontró este título.",
            "detail.sin_sinopsis": "Sin sinopsis disponible.",
            "detail.sinopsis": "SINOPSIS",
            "detail.generos": "GÉNEROS",
            "detail.capitulos": "CAPÍTULOS",
            "detail.episodios": "EPISODIOS",
            "detail.volumenes": "VOLÚMENES",
            "detail.estado": "Estado",
            "detail.puntaje": "Puntaje",
            "detail.sin_capitulos": "Sin capítulos especificados en la API.",
            "detail.progreso_general": "PROGRESO GENERAL",
            "detail.completados": "{vistos}/{total} completados",
            "detail.volver": "Volver al catálogo",
            "detail.compartir": "Compartir con conocidos o amigos",
            "detail.favorito": "Agregar a favoritos",
            "detail.marcar_visto": "Marcar como visto",
            "detail.ver_mas": "Ver más",

            "rank.cargando": "Cargando ranking...",
            "rank.cargar_mas": "Cargar más",
            "rank.no_resultados": "Sin resultados.",

            "lists.cargando": "Cargando tus listas...",
            "lists.titulo": "MIS LISTAS",
            "lists.subtitulo": "Tus \"Me gusta\" y \"Vistos\" separados por categoría.",
            "lists.vacio": "No tenés elementos en esta categoría.",

            "login.titulo": "Iniciar Sesión",
            "login.usuario": "Nombre de usuario",
            "login.email": "Correo electrónico",
            "login.contrasena": "Contraseña",
            "login.ingresar": "Ingresar",
            "login.crear": "Crear Cuenta",
            "login.google": "Continuar con Google",
            "login.cerrar": "Cerrar",

            "config.titulo": "Configuración",
            "config.fondo": "Fondo",
            "config.color": "Color de fondo",
            "config.imagen": "Imagen de fondo",
            "config.idioma": "Idioma",
            "config.guardado": "Configuración guardada.",

            "user.perfil": "Perfil",
            "user.puntos": "Puntos",
            "user.nivel": "Nivel",
            "user.vistos": "Vistos",
            "user.favoritos": "Favoritos",

            "state.visto": "Visto",
            "state.favorito": "Favorito",
            "state.pendiente": "Pendiente",

            "error.generico": "Algo salió mal. Intentá de nuevo en unos minutos.",
            "error.conexion": "Sin conexión al servidor. Revisá tu internet.",
            "error.no_encontrado": "No encontrado.",
            "error.sesion_expirada": "Sesión expirada. Tus cambios se guardaron y se sincronizarán al reconectar.",
            "error.volver_inicio": "Volver al inicio",

            "general.cargando": "Cargando...",
            "general.guardando": "Guardando...",
            "general.hecho": "Hecho",
            "general.cancelar": "Cancelar",
            "general.cerrar": "Cerrar"
        },
        en: {}
    };

    function resolveKey(obj, key) {
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

    window.applyTranslations = function (lang) {
        lang = lang || localStorage.getItem("pref:lang") || "es";
        var dict = translations[lang];
        if (!dict) {
            if (lang !== "es") { window.applyTranslations("es"); return; }
            return;
        }

        var elements = document.querySelectorAll("[data-i18n]");
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var key = el.getAttribute("data-i18n");
            if (!key) continue;

            var value = resolveKey(dict, key);
            if (value == null) value = "[missing: " + key + "]";

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
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { window.applyTranslations(); });
    } else {
        window.applyTranslations();
    }
})();
