// js/pages/mis-listas-puntos.js
// Barra de PUNTOS/EXP y nivel de "Mis Listas", extraída de mis-listas.js.
// Ámbito global (script clásico con defer).

function renderPoints() {
    const host = document.getElementById('pointsBar');
    if (!host) return;

    const userId = getCurrentUserIdSafe();
    if (userId === 'Invitado') {
        host.innerHTML = '';
        return;
    }

    const pts = (typeof getUserPoints === 'function')
        ? getUserPoints(userId)
        : Number(UserStore.getItem(`u:${userId}|points`) || '0');
    const lv = (typeof levelFromPoints === 'function')
        ? levelFromPoints(pts)
        : { level: 1, current: 0, next: 100 };
    // El nivel, la barra y el "faltan" se derivan todos de lv (puntos) para que
    // el número y la barra siempre coincidan.
    const level = lv.level;
    const pct = Math.max(0, Math.min(100, Math.round((lv.current / lv.next) * 100)));
    const remain = Math.max(0, lv.next - lv.current);

    host.innerHTML = `
        <div class="points-card">
            <div class="points-top">
                <div class="points-title">Nivel ${level}</div>
                <div class="points-value">${pts} pts</div>
            </div>
            <div class="points-track" role="progressbar" aria-label="Progreso de nivel"
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                <div class="points-fill" style="width:${pct}%;--pctnum:${Math.max(pct, 1)}"></div>
            </div>
            <div class="points-sub">${lv.atMax ? '¡Nivel máximo alcanzado!' : `Faltan ${remain} pts para el próximo nivel.`}</div>
        </div>
    `;
}
