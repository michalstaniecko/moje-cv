import { useCallback, useEffect, useState } from 'react'

// Edit mode (strony z kontrolkami edycji i paskiem bocznym) albo Preview mode (strony dokładnie jak w PDF) – GLOSSARY.md.
export type EditorMode = 'edit' | 'preview'

// Stan sesji ekranu edytora CV poza historią dokumentu (`zundo`): nie trafia do cofania ani do pliku CV i nie jest
// preferencją – każde otwarcie CV startuje w Edit mode (docs/specs/inline-editing-redesign.md, Q16, Q21).
// Tryb jest zgłaszany procesowi głównemu dla zaznaczenia Widok → Podgląd.
export function useEditSession() {
  const [mode, setMode] = useState<EditorMode>('edit')

  useEffect(() => window.api.menu.setPreviewMode(mode === 'preview'), [mode])

  const togglePreview = useCallback(() => setMode((current) => (current === 'edit' ? 'preview' : 'edit')), [])

  return { mode, setMode, togglePreview }
}
