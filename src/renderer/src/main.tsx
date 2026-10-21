import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PrintView } from './PrintView'

const isPrintRoute = window.location.hash === '#/print'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPrintRoute ? <PrintView /> : <App />}</StrictMode>
)
