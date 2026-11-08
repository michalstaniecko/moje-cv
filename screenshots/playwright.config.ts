import { defineConfig } from '@playwright/test'

// Zrzuty ekranu do wpisu w Mac App Store (`pnpm screenshots`). Osobna konfiguracja, żeby nie wchodziły do `pnpm test:e2e`
// (ta szuka testów tylko w `e2e/`).
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  workers: 1
})
