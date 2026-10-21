import { app, BrowserWindow } from 'electron'
import { registerPdfExport } from './pdfExport'
import { loadRenderer, secureWebPreferences } from './windows'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Moje CV',
    show: false,
    webPreferences: secureWebPreferences
  })

  window.once('ready-to-show', () => window.show())
  void loadRenderer(window)
}

app.whenReady().then(() => {
  registerPdfExport()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
