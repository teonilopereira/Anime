(function (window) {
    "use strict";

    // Traduce los enums de estado de AniList/MangaDex para mostrarlos.
    // Cualquier valor no reconocido (datos locales viejos ya en español) pasa tal cual.
    // Vive en el bundle y no en detalle/render.js porque comparar.js tambien lo
    // necesita, y esa pagina no carga los scripts de detalle.
    function formatMediaStatus(status, categoria) {
        const enPublicacion = categoria === 'manga' || categoria === 'novelas';
        const map = {
            RELEASING: enPublicacion ? 'En publicación' : 'En emisión',
            FINISHED: 'Finalizado',
            NOT_YET_RELEASED: 'Próximamente',
            HIATUS: 'En pausa',
            CANCELLED: 'Cancelado'
        };
        return map[String(status || '').toUpperCase()] || status;
    }

    function formatDate(value, locale = "es-AR") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat(locale).format(date);
    }

    function truncateText(value, maxLength = AnimeDestiny.Constants.TRUNCATE_MAX_LENGTH || 140) {
        const text = String(value ?? "").trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
    }

    function parseUrlParams(search = window.location.search) {
        return Object.fromEntries(new URLSearchParams(search).entries());
    }

    function normalizeText(value) {
        return String(value ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "");
    }

    window.normalizeText = normalizeText;

    function getCurrentUserId() {
        const user = window.AppSupabase?.getCurrentUserSync?.()
                  || window.AppSupabase?.client?.auth?.user?.()
                  || null;
        if (!user) return 'Invitado';
        return (
            user.user_metadata?.username ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            (user.email ? user.email.split('@')[0] : '') ||
            user.id ||
            'Usuario'
        );
    }

    function normalizeImageTitle(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function slugifyImageTitle(text, separator = '-') {
        return normalizeImageTitle(text).replace(/\s+/g, separator);
    }

    function buildCatalogImageCandidates(title, currentSrc = '') {
        const cleanTitle = String(title || '').trim();
        const current = String(currentSrc || '').trim();
        const variants = new Set([current]);
        const slug = slugifyImageTitle(cleanTitle);
        const compact = slugifyImageTitle(cleanTitle, '');
        const rawNoSymbols = cleanTitle
            .replace(/[\u2018\u2019\u201C\u201D\u2122']/g, '')
            .replace(/[:!?.,]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        const dashed = slugifyImageTitle(rawNoSymbols);
        const noSpaces = slugifyImageTitle(rawNoSymbols, '');

        const bases = [cleanTitle, rawNoSymbols, slug, dashed, compact, noSpaces];
        bases.forEach(b => {
            if (!b) return;
            variants.add(`images/posters/${slugifyImageTitle(b)}.jpg`);
            variants.add(`images/posters/${slugifyImageTitle(b)}.png`);
            variants.add(`images/posters/${slugifyImageTitle(b)}.webp`);
        });
        return Array.from(variants);
    }

    function createFallbackPosterDataUrl(title, subtitle) {
        const safeTitle = String(title || 'Sin título').slice(0, 40);
        const safeSubtitle = String(subtitle || '').slice(0, 45);
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" height="100%">
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#0a051b"/>
                        <stop offset="100%" stop-color="#2b0a55"/>
                    </linearGradient>
                    <radialGradient id="glow1" cx="25%" cy="20%" r="70%">
                        <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.45"/>
                        <stop offset="100%" stop-color="#00f2ff" stop-opacity="0"/>
                    </radialGradient>
                    <radialGradient id="glow2" cx="75%" cy="80%" r="70%">
                        <stop offset="0%" stop-color="#bc13fe" stop-opacity="0.5"/>
                        <stop offset="100%" stop-color="#bc13fe" stop-opacity="0"/>
                    </radialGradient>
                </defs>
                <rect width="600" height="800" fill="url(#bg)"/>
                <rect width="600" height="800" fill="url(#glow1)"/>
                <rect width="600" height="800" fill="url(#glow2)"/>
                <rect x="36" y="36" width="528" height="728" rx="42" fill="none" stroke="#bc13fe" stroke-width="3"/>
                <text x="300" y="230" text-anchor="middle" fill="#00f2ff" font-size="44" font-family="Orbitron, Arial, sans-serif" font-weight="700">${safeTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
                ${safeSubtitle ? `<text x="300" y="290" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Rajdhani, Arial, sans-serif">${safeSubtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>` : ''}
            </svg>
        `.trim();
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function fallbackCatalogImage(imgEl) {
        if (!(imgEl instanceof HTMLImageElement)) return;
        if (imgEl.dataset.fallbackReady === '1') return;
        imgEl.dataset.fallbackReady = '1';

        const title = imgEl.dataset.title || imgEl.alt || 'Sin título';
        const subtitle = imgEl.dataset.subtitle || '';
        const currentSrc = imgEl.getAttribute('src') || '';
        const candidates = buildCatalogImageCandidates(title, currentSrc);

        let index = 0;
        const tryNext = () => {
            if (index >= candidates.length) {
                imgEl.src = createFallbackPosterDataUrl(title, subtitle);
                return;
            }

            const candidate = candidates[index++];
            if (!candidate || candidate === currentSrc) {
                tryNext();
                return;
            }

            const probe = new Image();
            probe.onload = () => {
                imgEl.src = candidate;
            };
            probe.onerror = tryNext;
            probe.src = candidate;
        };

        tryNext();
    }

    function episodeStorageKey(userId, itemId, seasonIdx, ep) {
        return `u:${userId}|anime:${itemId}|s:${seasonIdx}|ep:${ep}`;
    }

    function volumeStorageKey(userId, itemId, vol, category) {
        const catSingular = category === 'novelas' ? 'novela' : category;
        return `u:${userId}|${catSingular}:${itemId}|vol:${vol}`;
    }

    const utils = {
        normalizeText,
        getCurrentUserId,
        getCurrentUserIdSafe: getCurrentUserId,
        fallbackCatalogImage,
        buildCatalogImageCandidates,
        createFallbackPosterDataUrl,
        episodeStorageKey,
        volumeStorageKey
    };

    window.AppUtils = Object.freeze(utils);
    
    // Bind to window as globals to avoid breaking any callers/HTML scripts
    window.getCurrentUserId = getCurrentUserId;
    window.getCurrentUserIdSafe = getCurrentUserId;
    window.formatMediaStatus = formatMediaStatus;
    window.fallbackCatalogImage = fallbackCatalogImage;
    window.episodeStorageKey = episodeStorageKey;
    window.volumeStorageKey = volumeStorageKey;
})(window);
