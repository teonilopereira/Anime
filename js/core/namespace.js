(function () {
    var AD = window.AnimeDestiny = window.AnimeDestiny || {};
    AD.internals = AD.internals || {};
    AD.Constants = AD.Constants || {};
    AD.config = window.AppConfig || {};

    AD.reportError = function (namespace, message, data) {
        var prefix = '[AnimeDestiny:' + namespace + ']';
        if (data) {
            console.warn(prefix, message, data);
        } else {
            console.warn(prefix, message);
        }
    };

    window.addEventListener('error', function (e) {
        AD.reportError('global', e.message || 'Uncaught error', {
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            stack: e.error?.stack
        });
    });

    window.addEventListener('unhandledrejection', function (e) {
        var reason = e.reason;
        AD.reportError('global', reason?.message || 'Unhandled promise rejection', {
            stack: reason?.stack
        });
    });

    // 1. Registro de Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').then(function (reg) {
                console.log('[AnimeDestiny:PWA] Service Worker registrado con éxito:', reg.scope);
                reg.update();
            }).catch(function (err) {
                console.warn('[AnimeDestiny:PWA] Error al registrar Service Worker:', err);
            });
        });
    }

    // 3. Forzar redirección HTTPS en producción
    if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        location.replace('https://' + location.hostname + location.pathname + location.search);
    }

    // 4. Banners de Estado de Conexión (Offline/Online)
    function showConnectionStatusToast(online) {
        if (window.Toast) {
            if (online) {
                window.Toast.success(window.AppI18n ? window.AppI18n.t("error.online") || "¡Conexión restablecida!" : "¡Conexión restablecida!");
            } else {
                window.Toast.error(window.AppI18n ? window.AppI18n.t("error.conexion") : "Sin conexión al servidor. Revisá tu internet.");
            }
        } else {
            var bannerId = 'connection-status-banner';
            var banner = document.getElementById(bannerId);
            if (!banner) {
                banner = document.createElement('div');
                banner.id = bannerId;
                banner.style.position = 'fixed';
                banner.style.top = '0';
                banner.style.left = '0';
                banner.style.width = '100%';
                banner.style.textAlign = 'center';
                banner.style.padding = '12px';
                banner.style.fontFamily = 'sans-serif';
                banner.style.fontWeight = 'bold';
                banner.style.fontSize = '14px';
                banner.style.zIndex = '99999';
                banner.style.transition = 'all 0.3s ease';
                document.body.appendChild(banner);
            }
            if (online) {
                banner.textContent = window.AppI18n ? window.AppI18n.t("error.online") || "¡Conexión restablecida!" : "¡Conexión restablecida!";
                banner.style.background = '#10B981';
                banner.style.color = '#fff';
                setTimeout(function () {
                    if (banner.parentNode) banner.parentNode.removeChild(banner);
                }, 3000);
            } else {
                banner.textContent = window.AppI18n ? window.AppI18n.t("error.conexion") : "Sin conexión al servidor. Revisá tu internet.";
                banner.style.background = '#EF4444';
                banner.style.color = '#fff';
            }
        }
    }

    window.addEventListener('online', function () { showConnectionStatusToast(true); });
    window.addEventListener('offline', function () { showConnectionStatusToast(false); });
})();
