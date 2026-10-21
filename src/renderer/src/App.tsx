import { useState } from 'react'
import { sampleCv } from './domain/sampleCv'
import { CvPages } from './template/CvPages'
import './app.css'

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'saved'; filePath: string }
  | { status: 'failed' }

export function App() {
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })

  const exportPdf = async () => {
    setExportState({ status: 'exporting' })
    try {
      const result = await window.api.pdf.export(sampleCv)
      setExportState(result.status === 'saved' ? result : { status: 'idle' })
    } catch {
      setExportState({ status: 'failed' })
    }
  }

  return (
    <>
      <header className="toolbar">
        <button type="button" onClick={exportPdf} disabled={exportState.status === 'exporting'}>
          {exportState.status === 'exporting' ? 'Eksportowanie…' : 'Eksportuj do PDF'}
        </button>
        {exportState.status === 'saved' && (
          <p className="toolbar-notice" role="status">
            Zapisano PDF: {baseName(exportState.filePath)}
            <button type="button" onClick={() => window.api.pdf.open(exportState.filePath)}>
              Otwórz
            </button>
            <button type="button" onClick={() => window.api.pdf.showInFolder(exportState.filePath)}>
              Pokaż w Finderze
            </button>
          </p>
        )}
        {exportState.status === 'failed' && (
          <p className="toolbar-notice toolbar-notice--error" role="alert">
            Nie udało się zapisać PDF. Spróbuj ponownie.
          </p>
        )}
      </header>
      <main className="preview">
        <CvPages document={sampleCv} />
      </main>
    </>
  )
}

const baseName = (filePath: string) => filePath.split(/[\\/]/).at(-1)
