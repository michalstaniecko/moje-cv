import { app } from 'electron'
import { clearStaleSingletonSocket } from './staleSingleton'

// Przygotowanie do App Sandbox (ADR-0003). Poza sandboksem (`pnpm dev`, `pnpm test:e2e`) nic nie robi. Wywoływane przed
// `app.requestSingleInstanceLock()` i `app.whenReady`.
//
// 1. Zwykły (nie-MAS) Electron zamyka helpery (renderer, GPU, sieć) we własnym sandboksie Chromium (Seatbelt), ale
//    proces już objęty App Sandbox nie może założyć drugiego: helpery kończą się przy starcie („sandbox initialization
//    failed: Operation not permitted”). Build Mac App Store tego nie robi – opiera się tylko na App Sandbox, który
//    helpery dziedziczą (`com.apple.security.inherit`). W `.dmg` to samo: wyłączamy Seatbelt Chromium, więc renderery
//    ogranicza tylko App Sandbox. Kompromis i jego uzasadnienie: ADR-0007.
// 2. W obu kanałach: pozostałości blokady jednej instancji po awarii (`staleSingleton.ts`).
//
// System ustawia `APP_SANDBOX_CONTAINER_ID` tylko procesom w App Sandbox.
export function prepareForAppSandbox(userDataDir: string): void {
  if (!process.env['APP_SANDBOX_CONTAINER_ID']) return
  if (!process.mas) app.commandLine.appendSwitch('no-sandbox')
  clearStaleSingletonSocket(userDataDir)
}
