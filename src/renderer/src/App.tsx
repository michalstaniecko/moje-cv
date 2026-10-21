import { useState } from 'react'
import { CvScreen } from './CvScreen'
import type { CvDocument } from './domain/schema'
import { Library } from './Library'
import './app.css'

export function App() {
  const [openDocument, setOpenDocument] = useState<CvDocument | null>(null)

  return openDocument ? (
    <CvScreen document={openDocument} onBack={() => setOpenDocument(null)} />
  ) : (
    <Library onOpen={setOpenDocument} />
  )
}
