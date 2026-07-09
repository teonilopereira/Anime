

// Mostrar/ocultar "Continuar viendo" según haya contenido
const _continueSection = document.getElementById('continueWatching');
const _continueDivider = document.getElementById('continueWatchingDivider');
if (_continueSection && _continueDivider) {
    const _obs = new MutationObserver(function () {
        _continueDivider.style.display = _continueSection.children.length > 0 ? '' : 'none';
    });
    _obs.observe(_continueSection, { childList: true });
    _continueDivider.style.display = _continueSection.children.length > 0 ? '' : 'none';
}
