/**
 * tests/unit/detalle-render-sections.test.js
 * Tests para js/detalle/render-sections.js → window.DetalleSections
 *
 * Cubre:
 *  - texto cuando falta el total: "En emisión (sin total)" / "Sin dato" (#7)
 *  - las cards de temporadas de manga muestran capítulos o tomos con su unidad (#7)
 *  - ancla #epGrid: scroll suave y foco en la grilla, una sola vez (#4)
 */
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

beforeAll(async () => {
  await import('../../js/security/sanitizer.js');
  await import('../../js/detalle/render-sections.js');
});

const S = () => window.DetalleSections;

describe('total desconocido', () => {
  it('en emisión dice "En emisión (sin total)"', () => {
    expect(S().missingTotalLabel('RELEASING')).toBe('En emisión (sin total)');
    expect(S().missingTotalLabel('releasing')).toBe('En emisión (sin total)');
  });

  it('terminada o sin estado dice "Sin dato"', () => {
    expect(S().missingTotalLabel('FINISHED')).toBe('Sin dato');
    expect(S().missingTotalLabel('')).toBe('Sin dato');
    expect(S().missingTotalLabel(undefined)).toBe('Sin dato');
  });
});

describe('cantidades de las temporadas', () => {
  it('usa solo la cantidad de su unidad', () => {
    expect(S().seasonCardCounts({ unit: 'chapters', count: 120, chapters: 120, volumes: 12 }))
      .toEqual({ episodes: 0, chapters: 120, volumes: 0 });
    expect(S().seasonCardCounts({ unit: 'volumes', count: 9, chapters: 0, volumes: 9 }))
      .toEqual({ episodes: 0, chapters: 0, volumes: 9 });
    expect(S().seasonCardCounts({ unit: 'episodes', count: 24, episodes: 24 }))
      .toEqual({ episodes: 24, chapters: 0, volumes: 0 });
  });

  it('temporadas cacheadas sin `unit` conservan lo que traen', () => {
    expect(S().seasonCardCounts({ episodes: 12 })).toEqual({ episodes: 12, chapters: 0, volumes: 0 });
  });

  it('la card de Relacionados de un manga muestra caps o vols', () => {
    const item = {
      id: '1', title: 'Obra',
      seasons: [
        { id: '1', unit: 'volumes', count: 10, volumes: 10, title: 'Obra' },
        { id: '2', unit: 'volumes', count: 5, chapters: 0, volumes: 5, title: 'Obra 2' },
      ],
    };
    const html = S().relatedHtml(item, null);
    expect(html).toContain('5 vols');
    expect(S().mediaCardHtml({ id: 3, title: 'X', chapters: 1 }, 'manga')).toContain('1 cap<');
  });
});

describe('ancla #epGrid', () => {
  let grid;
  beforeEach(() => {
    S()._resetGridAnchor();
    document.body.innerHTML = '<div class="detail-section"><h2>Capítulos</h2><div class="ep-grid" id="epGrid"><button>01</button></div></div>';
    grid = document.getElementById('epGrid');
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => { window.location.hash = ''; });

  it('sin el hash no hace nada', () => {
    expect(S().focusGridFromHash(grid)).toBe(false);
    expect(grid.hasAttribute('tabindex')).toBe(false);
  });

  it('con #epGrid hace scroll suave y pone el foco en la grilla', () => {
    window.location.hash = '#epGrid';
    expect(S().focusGridFromHash(grid)).toBe(true);
    expect(grid.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(grid);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('solo la primera vez (re-renders no mueven la página)', () => {
    window.location.hash = '#epGrid';
    S().focusGridFromHash(grid);
    expect(S().focusGridFromHash(grid)).toBe(false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('con movimiento reducido no anima el scroll', () => {
    window.location.hash = '#epGrid';
    const prev = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    S().focusGridFromHash(grid);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    window.matchMedia = prev;
  });
});
