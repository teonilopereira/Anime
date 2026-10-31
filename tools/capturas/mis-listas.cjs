// Datos de ejemplo de mis-listas.html para tools/capturas.cjs.
const ITEMS = [
    { id: '101', cat: 'anime', titulo: 'Frieren: Beyond Journey\'s End', ws: 'viendo', fav: 1, eps: 9, total: 28, info: 'Adventure | Drama | Fantasy' },
    { id: '102', cat: 'anime', titulo: 'Kusuriya no Hitorigoto', ws: 'viendo', eps: 3, total: 24, info: 'Drama | Mystery' },
    { id: '103', cat: 'manga', titulo: 'Chainsaw Man', ws: 'viendo', ch: 12, total: 150, info: 'Action | Horror' },
    { id: '104', cat: 'anime', titulo: 'Cowboy Bebop', viewed: 1, fav: 1, info: 'Action | Sci-Fi' },
    { id: '105', cat: 'anime', titulo: 'Shingeki no Kyojin: The Final Season Part 2', viewed: 1, info: 'Action | Drama | Mystery' },
    { id: '106', cat: 'manga', titulo: 'Vagabond', ws: 'pausado', info: 'Action | Drama' },
    { id: '107', cat: 'novelas', titulo: 'Mushoku Tensei: Jobless Reincarnation', ws: 'pendiente', info: 'Fantasy' },
    { id: '108', cat: 'anime', titulo: 'Dandadan', ws: 'pendiente', info: 'Comedy | Supernatural' },
    { id: '109', cat: 'manga', titulo: 'Berserk', viewed: 1, fav: 1, info: 'Action | Horror | Fantasy' },
    { id: '110', cat: 'anime', titulo: 'Ping Pong the Animation', ws: 'abandonado', info: 'Sports' },
    { id: '111', cat: 'novelas', titulo: 'Overlord', viewed: 1, info: 'Fantasy | Action' },
    { id: '112', cat: 'anime', titulo: 'Bocchi the Rock!', fav: 1, info: 'Comedy | Music' },
];

module.exports = {
    estados: [
        { n: 'invitado' },
        { n: 'datos', datos: true },
        { n: 'datos-lista', datos: true, init: () => { try { localStorage.setItem('ad:listsView', 'list'); } catch (_) { /* sin storage */ } } },
        { n: 'actividad', datos: true, hash: 'actividad' },
    ],
    async poblar(page) {
        await page.evaluate((ITEMS) => {
            const uid = 'kaede';
            window.getCurrentUserId = () => uid;
            // eslint-disable-next-line no-undef
            _sessionUser = { id: 'demo', email: 'kaede@demo.test', user_metadata: { username: uid } };
            const S = window.UserStore;
            const now = Date.now();
            ITEMS.forEach((it, i) => {
                const meta = { id: it.id, __category: it.cat, titulo: it.titulo, img: `https://s4.anilist.co/fake/${i}.png`, info: it.info, total: it.total || 0 };
                S.setItem(`u:${uid}|itemMeta:${it.id}`, JSON.stringify(meta));
                S.setItem(`u:${uid}|item:${it.id}|ts`, new Date(now - i * 3600e3).toISOString());
                if (it.fav) S.setItem(`u:${uid}|item:${it.id}|fav`, '1');
                if (it.viewed) S.setItem(`u:${uid}|item:${it.id}|viewed`, '1');
                if (it.ws) S.setItem(`u:${uid}|item:${it.id}|wstatus`, it.ws);
                for (let e = 1; e <= (it.eps || 0); e++) S.setItem(`u:${uid}|anime:${it.id}|s:1|ep:${e}`, '1');
                for (let c = 1; c <= (it.ch || 0); c++) S.setItem(`u:${uid}|manga:${it.id}|ch:${c}`, '1');
            });
            S.setItem(`u:${uid}|points`, '340');
            const base = Math.floor(now / 1000);
            window.getAiringSchedule = async () => [
                { id: 101, title: 'Frieren: Beyond Journey\'s End', episode: 10, airingAt: base + 3600 * 5 },
                { id: 102, title: 'Kusuriya no Hitorigoto', episode: 4, airingAt: base + 86400 * 1.2 },
                { id: 108, title: 'Dandadan', episode: 1, airingAt: base + 86400 * 3.5 },
            ];
            /* global renderProfileSummary renderPoints renderAchievements renderApodos render renderContinue renderWeek renderActividad updateCategoryCards renderStats filterModeState */
            [renderProfileSummary, renderPoints, renderAchievements, renderApodos, () => render(filterModeState),
                renderContinue, renderWeek, renderActividad, updateCategoryCards, renderStats].forEach((fn) => {
                try { const r = fn(); if (r && r.catch) r.catch(() => {}); } catch (e) { console.warn('poblar', e); }
            });
            try { window.lucide && window.lucide.createIcons(); } catch (_) { /* sin íconos */ }
        }, ITEMS);
        await page.waitForTimeout(600);
    },
};
