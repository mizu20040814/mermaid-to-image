import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromiumPath = '/opt/pw-browsers/chromium';
const executablePath = existsSync(chromiumPath) ? chromiumPath : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
