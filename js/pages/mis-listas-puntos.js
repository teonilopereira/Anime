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

    host.innerHTML = `
        <div class="points-card">
            <div class="points-top">
                <div class="points-title">Nivel ${level}</div>
                <div class="points-value">${pts} pts</div>
            </div>
            <div class="points-track" aria-hidden="true"><div class="points-fill" style="width:${pct}%"></div></div>
            <div class="points-sub">Faltan ${Math.max(0, lv.next - lv.current)} pts para el próximo nivel.</div>
        </div>
    `;
}
