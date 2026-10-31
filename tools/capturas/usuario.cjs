// Datos de ejemplo de usuario.html para tools/capturas.cjs.
module.exports = {
    estados: [
        { n: 'invitado' },
        { n: 'datos', datos: true },
        { n: 'foto', datos: true, foto: true },
    ],
    async poblar(page, estado) {
        await page.evaluate((conFoto) => {
            const uid = 'demo-uid';
            const user = { id: uid, email: 'kaede.nakamura.largo@demo-mirudoku.test', created_at: '2025-03-14T10:00:00Z', user_metadata: { username: 'kaede' } };
            const profile = { display_name: 'Kaede Nakamura', apodo: 'maratonista', exp: 1340, level: 0, total_likes: 23, total_viewed: 187, created_at: '2025-03-14T10:00:00Z', photo_url: conFoto ? 'https://s4.anilist.co/fake/avatar.png' : '' };
            const S = window.UserStore;
            S.setItem(`u:${uid}|sessions`, '42');
            S.setItem(`u:${uid}|totalMinutes`, '1835');
            S.setItem(`u:${uid}|activity`, JSON.stringify([
                { icon: '⚙', color: 'orange', title: 'Configuración actualizada', time: 'Lun, 18:22' },
                { icon: '👁', color: 'pink', title: 'Exploraste Chainsaw Man', time: 'Lun, 21:47' },
                { icon: '❤', color: 'purple', title: 'Guardaste Frieren: Beyond Journey\'s End en favoritos', time: 'Ayer, 13:02' },
                { icon: '✔', color: 'cyan', title: 'Terminaste Cowboy Bebop', time: 'Ayer, 23:10' },
                { icon: '★', color: 'purple', title: 'Subiste al nivel 6', time: 'Hoy, 09:15' },
                { icon: '1', color: 'cyan', title: 'Inicio de sesión', time: 'Hoy, 14:35' },
            ]));
            /* global _currentUser _currentProfile renderProfile hideLoader showContent */
            _currentUser = user; // eslint-disable-line no-global-assign
            _currentProfile = profile; // eslint-disable-line no-global-assign
            renderProfile(user, profile);
            hideLoader(); showContent();
            try { window.lucide && window.lucide.createIcons(); } catch (_) { /* sin íconos */ }
        }, !!estado.foto);
        await page.waitForTimeout(1500);
    },
};
