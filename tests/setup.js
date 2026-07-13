/**
 * tests/setup.js
 * Configuración global para todos los tests.
 * Inicializa los namespaces que el código fuente espera encontrar en window.
 */

// Simular el namespace global que usan los módulos IIFE
global.AnimeDestiny = {
  Constants: {
    TRUNCATE_MAX_LENGTH: 140
  }
};

global.AppSupabase = null;
global.AppUtils = null;
global.AppValidator = null;
