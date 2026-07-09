(() => {
    "use strict";

    let pendingSync = null;
    let changedItems = {};

    const scheduleSync = (itemId) => {
        changedItems[itemId] = true;
        if (pendingSync) return;
        pendingSync = setTimeout(flushSync, AnimeDestiny.Constants.SYNC_DEBOUNCE_MS || 250);
    };

    const flushSync = () => {
        pendingSync = null;

        const username = getUsername();
        if (!username || username === "Invitado") {
            // Auth aún no listo — reintentar cuando llegue la sesión
            const onReady = () => {
                window.removeEventListener('supabase-auth-changed', onReady);
                flushSync();
            };
            window.addEventListener('supabase-auth-changed', onReady, { once: true });
            return;
        }

        const fn = window.syncItemStateToSupabase;
        if (typeof fn !== "function") {
            pendingSync = setTimeout(flushSync, AnimeDestiny.Constants.SYNC_DEBOUNCE_MS || 250);
            return;
        }

        const ids = Object.keys(changedItems);
        if (!ids.length) return;
        changedItems = {};

        const metaPrefix = `u:${username}|itemMeta:`;
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const fav = window.UserStore.getItem(`u:${username}|item:${id}|fav`) === "1";
            const viewed = window.UserStore.getItem(`u:${username}|item:${id}|viewed`) === "1";

            const metaRaw = window.UserStore.getItem(`${metaPrefix}${id}`);
            let meta = {};
            try { if (metaRaw) meta = JSON.parse(metaRaw); } catch { console.warn('data-sync: invalid meta JSON for', id); }

            fn(meta.__category || guessCategory(), String(id), fav, viewed, meta);
        }
    };

    const getUsername = () => {
        const user = window.AppSupabase?.getCurrentUserSync?.() || null;
        if (!user) return "Invitado";
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split("@")[0] : "") ||
            user.id ||
            "Invitado"
        );
    };

    const guessCategory = () => {
        const path = String(window.location.pathname || "").toLowerCase();
        if (path.includes("anime")) return "anime";
        if (path.includes("manga")) return "manga";
        if (path.includes("novelas")) return "novelas";
        return document.body.getAttribute("data-page") || "unknown";
    };

    // ─── Exportar scheduleSync para uso externo ──────────────────
    window.__dataSyncSchedule = AnimeDestiny.internals.__dataSyncSchedule = scheduleSync;

})();
