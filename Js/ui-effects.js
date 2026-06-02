// Js/ui-effects.js

function updatePrices() {
    const priceElements = document.querySelectorAll('.price-tag');
    priceElements.forEach((element) => {
        let currentText = element.innerText.replace('$', '').replace(/\\./g, '').trim();
        let basePrice = parseFloat(currentText);

        if (!isNaN(basePrice)) {
            const variation = Math.floor(Math.random() * 1001) - 500;
            let newPrice = basePrice + variation;

            if (newPrice < 1000) newPrice = 1000;

            element.innerText = \`$\${newPrice.toLocaleString('es-AR')}\`;
            element.style.color = "var(--accent-cyan)";
            setTimeout(() => { element.style.color = "white"; }, 500);
        }
    });
}

function iniciarParticulas() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    const particleCount = 80;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor() { this.init(); }
        init() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
            this.color = Math.random() > 0.5 ? '#00f2ff' : '#bc13fe';
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    animate();
}

function getPreference(key, fallback = false) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        return value === 'true';
    } catch {
        return fallback;
    }
}

function applyUserPreferences() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.toggle('compact-cards', getPreference('pref:compactCards', false));
    document.body.classList.toggle('reduce-motion', getPreference('pref:reduceMotion', false));
}

function getPreferenceValue(key, fallback = '') {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch {
        return fallback;
    }
}

function clearInlineBackgroundStyle(body) {
    body.style.removeProperty('background');
    body.style.removeProperty('background-image');
    body.style.removeProperty('background-color');
    body.style.removeProperty('background-repeat');
    body.style.removeProperty('background-size');
    body.style.removeProperty('background-position');
    body.style.removeProperty('background-attachment');
}

function applyBackgroundPreference() {
    if (typeof document === 'undefined' || !document.body) return;
    const body = document.body;
    const mode = getPreferenceValue('pref:bgMode', 'default');
    clearInlineBackgroundStyle(body);

    if (mode === 'color') {
        const color = getPreferenceValue('pref:bgColor', '#2b0a55');
        body.style.background = \`linear-gradient(180deg, #000000 0%, \${color} 100%)\`;
        body.style.backgroundAttachment = 'fixed';
    } else if (mode === 'image') {
        const imageUrl = getPreferenceValue('pref:bgImage', '');
        if (imageUrl) {
            body.style.backgroundImage = \`linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.76)), url("\${String(imageUrl).replaceAll('"', '\\\\"')}")\`;
            body.style.backgroundSize = 'cover';
            body.style.backgroundPosition = 'center center';
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundAttachment = 'fixed';
        }
    }
}

function inicializarNavbarAdaptable() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    if (!navbar.querySelector('.nav-toggle')) {
        const toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Abrir menú');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = \`<span class="nav-toggle-icon" aria-hidden="true"></span><span>Menú</span>\`;
        navbar.insertBefore(toggle, navbar.firstElementChild);

        toggle.addEventListener('click', () => {
            const isOpen = navbar.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
        });
    }

    const update = () => {
        navbar.classList.toggle('is-scrolled', (window.scrollY || 0) > 12);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
}

function injectAfterNavbar(html) {
    const navbar = document.querySelector('.navbar');
    if (!navbar || navbar.nextElementSibling?.classList?.contains('profile-strip')) return null;
    const wrapper = document.createElement('section');
    wrapper.className = 'profile-strip';
    wrapper.innerHTML = html;
    navbar.insertAdjacentElement('afterend', wrapper);
    return wrapper;
}

function renderUserProfileStrip() {
    if (typeof getCurrentUserId !== 'function') return;
    const userId = getCurrentUserId();
    const existing = document.querySelector('.profile-strip');
    if (existing) existing.remove();

    const summary = (typeof getUserStateSummary === 'function') ? getUserStateSummary(userId) : { level: { current: 0, next: 100 } };
    const initials = String(userId || 'A').trim().slice(0, 2).toUpperCase();
    const levelPct = Math.min(100, Math.round((summary.level.current / summary.level.next) * 100));
    const label = userId === 'Invitado' ? 'Invitado' : userId;

    function escapeHtmlSafe(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

    injectAfterNavbar(\`
        <div class="profile-card profile-card-strip">
            <div class="profile-avatar" aria-hidden="true">\${escapeHtmlSafe(initials)}</div>
            <div class="profile-main">
                <div class="profile-topline">
                    <div>
                        <div class="profile-label">Perfil</div>
                        <a class="profile-name profile-name-link" href="usuario.html">\${escapeHtmlSafe(label)}</a>
                    </div>
                    <div class="profile-actions">
                        <a class="profile-compare" href="usuario.html">Abrir</a>
                        <a class="profile-config-btn" href="configuracion.html">Configuración</a>
                    </div>
                </div>
                <div class="profile-track" aria-label="Progreso de nivel">
                    <div class="profile-fill" style="width:\${levelPct}%"></div>
                </div>
            </div>
        </div>
    \`);
}

function enhanceFooters() {
    const footers = document.querySelectorAll('.app-footer-inner');
    footers.forEach((footer) => {
        if (footer.querySelector('[data-footer-summary="1"]')) return;
        const summary = document.createElement('div');
        summary.className = 'app-footer-col app-footer-summary';
        summary.setAttribute('data-footer-summary', '1');
        summary.innerHTML = \`
            <div class="app-footer-title">Atajos</div>
            <p class="app-footer-text">Usá el perfil para ver tu progreso, el comparador para revisar 2 títulos y el buscador para filtrar por título, género o estudio.</p>
        \`;
        footer.appendChild(summary);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyUserPreferences();
    renderUserProfileStrip();
    enhanceFooters();
    inicializarNavbarAdaptable();
    iniciarParticulas();
    applyBackgroundPreference();
    updatePrices();
    setInterval(updatePrices, 8000);
});
