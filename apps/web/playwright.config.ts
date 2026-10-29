import { defineConfig } from '@playwright/test'

// E2E nerede koşar: sunucuda geçici, ağsız yığında (tests/sunucu/e2e-test.sh).
// Hedef adres ortamdan gelir; canlı ya da staging adresine karşı varsayılan YOKTUR.
const baseURL = process.env.E2E_BASE_URL
if (!baseURL) {
  throw new Error('E2E_BASE_URL tanımlı değil (örn. http://web:3000). Canlı adrese varsayılan yoktur.')
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: process.env.E2E_OUT_DIR ?? 'e2e/.cikti',
  use: {
    baseURL,
    // Yerelde kurulu Edge/Chrome için E2E_CHANNEL=msedge; konteynerde paketli Chromium.
    channel: process.env.E2E_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  },
})
