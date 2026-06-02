// Compat: redirige al nuevo detalle.html
document.addEventListener('DOMContentLoaded', () => {
    const params = window.location.search || '';
    window.location.replace(`detalle.html${params}`);
});
