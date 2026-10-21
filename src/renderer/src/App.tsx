import { sampleCv } from './domain/sampleCv'
import { CvPages } from './template/CvPages'
import './app.css'

export function App() {
  return (
    <main className="preview">
      <CvPages document={sampleCv} />
    </main>
  )
}
