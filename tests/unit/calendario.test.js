/**
 * tests/unit/calendario.test.js
 * Tests para js/pages/calendario.js → calendario semanal de estrenos.
 *
 * Cubre:
 *  - agrupa los estrenos por día y pinta un ticket por episodio (antes se
 *    rompía al agrupar y la página quedaba vacía)
 *  - el ticket lleva la hora y el número de episodio en el talón
 *  - el encabezado de "Hoy" usa el corte diagonal púrpura; el resto, cian
 */

import { beforeAll, describe, it, expect } from 'vitest';

const ahora = Math.floor(Date.now() / 1000);

beforeAll(async () => {
  document.body.innerHTML = '<div id="calendarBody"></div>';
  window.getWeeklyAiringSchedule = async () => [
    { id: 1, title: 'Sousou no Frieren', episode: 7, airingAt: ahora + 1, img: '' },
    { id: 2, title: 'Dandadan', episode: 19, airingAt: ahora + 2, img: '' },
    { id: 3, title: 'One Piece', episode: 1146, airingAt: ahora + 2 * 86400, img: '' },
  ];
  await import('../../js/pages/calendario.js');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
});

describe('calendario', () => {
  it('pinta un ticket por estreno, agrupados por día', () => {
    const dias = document.querySelectorAll('.cal-day');
    expect(dias.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelectorAll('.q-ticket')).toHaveLength(3);
  });

  it('el talón lleva la hora y el episodio', () => {
    const ticket = document.querySelector('.q-ticket');
    expect(ticket.querySelector('.q-ticket__big').textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(ticket.querySelector('.q-ticket__small').textContent).toBe('Ep. 7');
    expect(ticket.getAttribute('href')).toBe('detalle.html?cat=anime&id=1');
  });

  it('"Hoy" va en púrpura y los demás días en cian', () => {
    const titulos = Array.from(document.querySelectorAll('.cal-day-title'));
    const hoy = titulos.find((t) => t.textContent.startsWith('Hoy'));
    const otro = titulos.find((t) => !t.textContent.startsWith('Hoy'));
    expect(hoy.classList.contains('q-slant--cyan')).toBe(false);
    expect(otro.classList.contains('q-slant--cyan')).toBe(true);
  });
});
