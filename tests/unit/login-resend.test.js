/**
 * tests/unit/login-resend.test.js
 * js/pages/login.js (#14): tras registrarse con correo sin sesión aparece
 * "Reenviar correo" con la nota de spam y una espera de 60 s; al tocarlo usa
 * AppSupabase.resendSignupEmail y avisa por toast (éxito o error).
 */
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

const client = {
  signUpWithEmail: vi.fn(() => Promise.resolve({ user: { id: 'n1' }, session: null })),
  resendSignupEmail: vi.fn(() => Promise.resolve({})),
  onAuthChange: () => () => {},
};

beforeAll(async () => {
  document.body.innerHTML = `
    <h1 id="loginTitle"></h1>
    <div class="login-tabs"><button id="tabLogin"></button><button id="tabRegister"></button></div>
    <form id="loginForm">
      <div class="login-field is-hidden" id="usernameField"><input id="usernameInput"></div>
      <div class="login-field"><input id="emailInput"></div>
      <div class="login-field"><input id="passwordInput"></div>
      <p id="loginStatus"></p>
      <button id="submitBtn" type="submit"></button>
      <button id="googleBtn" type="button"></button>
      <button id="logoutBtn" type="button"></button>
    </form>`;
  window.AppSupabase = client;
  window.Toast = { success: vi.fn(), error: vi.fn() };
  await import('../../js/pages/login.js');
  vi.useFakeTimers();
});

afterAll(() => vi.useRealTimers());

async function register() {
  document.getElementById('tabRegister').click();
  document.getElementById('usernameInput').value = 'ana';
  document.getElementById('emailInput').value = 'ana@example.com';
  document.getElementById('passwordInput').value = 'secreto123';
  document.getElementById('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
  await vi.advanceTimersByTimeAsync(0);
}

describe('login: reenviar correo de confirmación', () => {
  it('tras el registro sin sesión muestra el botón en espera y la nota de spam', async () => {
    await register();
    expect(client.signUpWithEmail).toHaveBeenCalled();
    const box = document.getElementById('loginResend');
    expect(box).not.toBeNull();
    expect(box.hidden).toBe(false);
    expect(box.textContent).toMatch(/spam/i);
    const btn = document.getElementById('resendBtn');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/60/);
  });

  it('a los 60 s se habilita y reenvía con toast de éxito', async () => {
    const btn = document.getElementById('resendBtn');
    await vi.advanceTimersByTimeAsync(59000);
    expect(btn.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(btn.disabled).toBe(false);
    btn.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.resendSignupEmail).toHaveBeenCalledWith('ana@example.com');
    expect(window.Toast.success).toHaveBeenCalled();
    // Vuelve a esperar antes del próximo intento.
    expect(btn.disabled).toBe(true);
  });

  it('si Supabase falla avisa con toast de error', async () => {
    client.resendSignupEmail.mockImplementationOnce(() => Promise.reject(new Error('rate limit')));
    const btn = document.getElementById('resendBtn');
    await vi.advanceTimersByTimeAsync(60000);
    btn.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(window.Toast.error).toHaveBeenCalledWith(expect.stringMatching(/rate limit/));
    expect(btn.disabled).toBe(true);
  });

  it('cambiar de pestaña oculta el bloque', () => {
    document.getElementById('tabLogin').click();
    expect(document.getElementById('loginResend').hidden).toBe(true);
  });
});
