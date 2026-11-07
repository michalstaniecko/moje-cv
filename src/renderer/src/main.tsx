import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { InterfaceLanguageProvider } from './i18n'
import { PrintView } from './PrintView'

const isPrintRoute = window.location.hash === '#/print'
// Zawęża białe tło strony z print.css do okna eksportu (print.css jest w tym samym bundlu CSS co app.css).
document.documentElement.classList.toggle('print-route', isPrintRoute)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrintRoute ? (
      <PrintView />
    ) : (
      <InterfaceLanguageProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </InterfaceLanguageProvider>
    )}
  </StrictMode>
)
