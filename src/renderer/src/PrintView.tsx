import { useEffect, useState } from 'react'
import type { CvDocument } from './domain/schema'
import { CvPages } from './template/CvPages'
import './print.css'

// Trasa ukrytego okna eksportu: wyłącznie strony CV w skali 1:1.
export function PrintView() {
  const [document, setDocument] = useState<CvDocument | null>(null)

  useEffect(() => {
    void window.api.print.getDocument().then(setDocument)
  }, [])

  return document && <CvPages document={document} onReady={window.api.print.ready} />
}
