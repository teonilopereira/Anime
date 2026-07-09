(function () {
    var AD = window.AnimeDestiny = window.AnimeDestiny || {};
    AD.internals = AD.internals || {};
    AD.Constants = AD.Constants || {};
    AD.config = window.AppConfig || {};

    AD.migrate = function (source, target, keys) {
        if (!source || !target) return;
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k in source) target[k] = source[k];
        }
    };

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
})();
