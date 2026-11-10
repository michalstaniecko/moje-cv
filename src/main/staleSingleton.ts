import { readlinkSync, rmSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'

type Environment = { hostname: string; isRunning: (pid: number) => boolean }

// Blokada jednej instancji (`app.requestSingleInstanceLock`) w App Sandbox (ADR-0003). Electron trzyma wtedy gniazdo
// blokady w stałym folderze kontenera (`Data/tmp/S`) zamiast w nowym folderze tymczasowym. Po awarii albo wymuszonym
// zakończeniu zostają w nim `SingletonSocket` i `SingletonCookie`, więc następne uruchomienie nie może założyć blokady
// i od razu się kończy (dopiero kolejne działa). Zanim aplikacja poprosi o blokadę, sprzątamy ten folder – ale tylko
// gdy proces z `SingletonLock` (`host-pid`) na tym komputerze już nie żyje; żywy właściciel zachowuje swoje gniazdo,
// więc ponowne uruchomienie nadal tylko przywołuje jego okno.
export function clearStaleSingletonSocket(userDataDir: string, environment: Environment = currentEnvironment()): void {
  const lock = readLink(join(userDataDir, 'SingletonLock'))
  const match = lock?.match(/^(.*)-(\d+)$/)
  if (!match || match[1] !== environment.hostname || environment.isRunning(Number(match[2]))) return
  const socket = readLink(join(userDataDir, 'SingletonSocket'))
  if (!socket) return
  for (const name of ['SingletonSocket', 'SingletonCookie']) rmSync(join(dirname(socket), name), { force: true })
}

function readLink(path: string): string | undefined {
  try {
    return readlinkSync(path)
  } catch {
    return undefined
  }
}

function currentEnvironment(): Environment {
  return {
    hostname: hostname(),
    isRunning: (pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch (error) {
        // EPERM: proces istnieje, tylko sandbox nie pozwala wysłać mu sygnału.
        return (error as NodeJS.ErrnoException).code === 'EPERM'
      }
    }
  }
}
