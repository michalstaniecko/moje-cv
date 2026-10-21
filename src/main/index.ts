import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { sampleCv } from '../renderer/src/domain/sampleCv'
import { createCvRepository } from './cvRepository'
import { registerCvLibrary } from './cvLibrary'
import { createInterfaceLanguage, registerInterfaceLanguage, type InterfaceLanguageState } from './interfaceLanguage'
import { registerAppMenu } from './menu'
import { registerPdfExport } from './pdfExport'
import { registerPhotoPicker } from './photo'
import { registerSettings } from './settings'
import { createSettingsRepository } from './settingsRepository'
import { loadRenderer, secureWebPreferences } from './windows'

// Tytuł okna to nazwa aplikacji ze słownika; renderer ustawia go także w dokumencie przy zmianie języka.
function createWindow(language: InterfaceLanguageState): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    title: language.dictionary().appName,
    show: false,
    webPreferences: secureWebPreferences
  })

  window.once('ready-to-show', () => window.show())
  void loadRenderer(window)
}

app.whenReady().then(async () => {
  const repository = createCvRepository(join(app.getPath('userData'), 'cvs'))
  await repository.addSampleOnFirstRun(sampleCv)
  const settings = createSettingsRepository(join(app.getPath('userData'), 'settings.json'))
  registerCvLibrary(repository, settings)
  registerSettings(settings)
  registerPdfExport()
  registerPhotoPicker()
  const language = await createInterfaceLanguage(settings)
  registerInterfaceLanguage(language)
  registerAppMenu(language)
  createWindow(language)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(language)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
