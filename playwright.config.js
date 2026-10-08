import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

// En el contenedor de Claude Code el Chromium viene preinstalado en
// /opt/pw-browsers; en CI lo baja `npx playwright install chromium`.
const CHROMIUM_LOCAL = '/opt/pw-browsers/chromium';
const PORT = Number(process.env.E2E_PORT) || 8123;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: fs.existsSync(CHROMIUM_LOCAL) ? { executablePath: CHROMIUM_LOCAL } : {},
  },
  webServer: {
    command: 'node tools/serve.cjs',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
