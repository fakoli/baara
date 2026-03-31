import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
  },
  webServer: {
    command: 'bun run src/index.ts',
    port: 3000,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
