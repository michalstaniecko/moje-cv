import { useSyncExternalStore } from 'react'

// Komunikaty `aria-live` warstwy edycji (docs/specs/wysiwyg-editing.md, W22): zmiany struktury z klawiatury w Page fields
// (nowy punkt, złączenie, usunięcie, przeniesienie, nowy kontakt) i z menu uchwytu (przeniesienie). Mały magazyn
// w sesji edycji, bo pola leżą na stronach, a region – w warstwie edycji. Każdy komunikat ma nowy klucz, więc ten sam
// tekst powtórzony jest ogłaszany znowu.
export type Announcement = { text: string; key: number }

export function createAnnouncer() {
  let current: Announcement | null = null
  const listeners = new Set<() => void>()
  return {
    announce(text: string) {
      current = { text, key: (current?.key ?? 0) + 1 }
      for (const listener of listeners) listener()
    },
    get: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export type Announcer = ReturnType<typeof createAnnouncer>

// Region `aria-live` (ukryty wizualnie) – stale w DOM warstwy edycji, treść wstawiana przy każdym komunikacie.
export function LiveRegion({ announcer }: { announcer: Announcer }) {
  const announcement = useSyncExternalStore(announcer.subscribe, announcer.get)
  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {announcement && <span key={announcement.key}>{announcement.text}</span>}
    </div>
  )
}
