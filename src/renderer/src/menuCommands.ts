import { useEffect, useRef } from 'react'
import type { MenuCommand } from '../../shared/api'

// Komendy menu Plik dla zamontowanego ekranu: obsługę dostaje zawsze najnowsza funkcja `handle` (z bieżącym stanem
// ekranu), a subskrypcja trwa, dopóki ekran jest zamontowany.
export function useMenuCommands(handle: (command: MenuCommand) => void) {
  const latest = useRef(handle)
  useEffect(() => {
    latest.current = handle
  })
  useEffect(() => window.api.menu.onCommand((command) => latest.current(command)), [])
}
