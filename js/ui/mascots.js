/**
 * mascots.js — Registro de mascotas seleccionables (además de Rimuru).
 *
 * Este archivo lo GENERA `tools/generate-mascots.js` a partir de las mascotas
 * creadas con PixelLab. Cada entrada describe un personaje en modo 'frames':
 *
 *   {
 *     id: "gato-ninja",
 *     name: "Gato Ninja",
 *     anime: "Original",
 *     mode: "frames",
 *     frames: {
 *       idle: ["images/mascots/gato-ninja/idle-0.png", ...],
 *       walk: ["images/mascots/gato-ninja/walk-0.png", ...]
 *     }
 *   }
 *
 * mascot.js lee window.MascotRegistry y lo suma a la lista del selector.
 * Mientras no se generen mascotas, el arreglo queda vacío y solo aparece Rimuru.
 */
window.MascotRegistry = window.MascotRegistry || [];
