/**
 * tests/unit/sanitizer.test.js
 * Tests para js/security/sanitizer.js
 *
 * Cubre:
 *  - escapeHtml: evita XSS escapando caracteres HTML peligrosos
 *  - safeUrl:    filtra protocolos peligrosos (javascript:, etc.)
 */

import { beforeAll, describe, it, expect } from 'vitest';

// Cargar el módulo IIFE en el entorno jsdom (se registra en window)
beforeAll(async () => {
  // setup.js ya corre antes; aquí solo necesitamos importar el archivo fuente
  await import('../../js/security/sanitizer.js');
});

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapa el símbolo &', () => {
    expect(escapeHtml('Rock & Roll')).toBe('Rock &amp; Roll');
  });

  it('escapa <script> para evitar XSS básico', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapa comillas dobles', () => {
    expect(escapeHtml('"hola"')).toBe('&quot;hola&quot;');
  });

  it('escapa comillas simples', () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it('escapa los cuatro caracteres a la vez', () => {
    const input  = `<div class="test" id='x'> A & B </div>`;
    const result = escapeHtml(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).not.toContain("'");
  });

  it('devuelve "" para null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('devuelve "" para undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('devuelve el texto sin cambios si no hay caracteres especiales', () => {
    expect(escapeHtml('Naruto Shippuden')).toBe('Naruto Shippuden');
  });

  it('convierte números a string y los devuelve intactos', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

// ─── safeUrl ─────────────────────────────────────────────────────────────────

describe('safeUrl', () => {
  it('permite URLs https', () => {
    expect(safeUrl('https://example.com/imagen.jpg')).toBe('https://example.com/imagen.jpg');
  });

  it('permite URLs http', () => {
    expect(safeUrl('http://cdn.example.com/img.png')).toBe('http://cdn.example.com/img.png');
  });

  it('bloquea el protocolo javascript: (XSS)', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });

  it('bloquea el protocolo data: que no sea imagen', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('permite data:image/ (usado como fallback de pósters)', () => {
    const dataUri = 'data:image/svg+xml;charset=UTF-8,%3Csvg%3E%3C%2Fsvg%3E';
    expect(safeUrl(dataUri)).toBe(dataUri);
  });

  it('permite rutas relativas locales', () => {
    expect(safeUrl('images/posters/naruto.jpg')).toBe('images/posters/naruto.jpg');
  });

  it('devuelve "" para undefined', () => {
    expect(safeUrl(undefined)).toBe('');
  });

  it('devuelve "" para cadena vacía', () => {
    expect(safeUrl('')).toBe('');
  });

  it('bloquea ftp:', () => {
    expect(safeUrl('ftp://files.example.com/archivo')).toBe('');
  });
});
