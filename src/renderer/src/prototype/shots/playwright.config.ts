// PROTOTYP – zrzuty wariantów: VITE_PROTOTYPE=1 pnpm build && pnpm playwright test -c src/renderer/src/prototype/shots
import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', timeout: 120_000, workers: 1 })
