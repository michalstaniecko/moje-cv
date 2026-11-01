import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { sampleCvs } from '../renderer/src/domain/sampleCv'
import { createCvRepository } from './cvRepository'
import { registerCvLibrary } from './cvLibrary'
import { createInterfaceLanguage, registerInterfaceLanguage, type InterfaceLanguageState } from './interfaceLanguage'
import { registerAppMenu } from './menu'
import { registerPdfExport } from './pdfExport'
import { registerPhotoPicker } from './photo'
import { registerSettings } from './settings'
import { createSettingsRepository } from './settingsRepository'
import { loadRenderer, secureWebPreferences } from './windows'
import { lightWindowBackground } from '../shared/interfaceLook'

// Tytuł okna to nazwa aplikacji ze słownika; renderer ustawia go także w dokumencie przy zmianie języka.
// Tło okna równe tłu aplikacji, żeby przy starcie nie było białego błysku.
function createWindow(language: InterfaceLanguageState): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    title: language.dictionary().appName,
    show: false,
    backgroundColor: lightWindowBackground,
    webPreferences: secureWebPreferences
  })

  window.once('ready-to-show', () => window.show())
  void loadRenderer(window)
}

// Folder danych przypięty do „Moje CV” niezależnie od `productName`, żeby zmiana nazwy aplikacji nie przenosiła danych
// (ADR-0003). `--user-data-dir` (testy e2e) ma pierwszeństwo.
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', join(app.getPath('appData'), 'Moje CV'))

app.whenReady().then(async () => {
  const repository = createCvRepository(join(app.getPath('userData'), 'cvs'))
  const settings = createSettingsRepository(join(app.getPath('userData'), 'settings.json'))
  const language = await createInterfaceLanguage(settings)
  await repository.addSampleOnFirstRun(sampleCvs[language.current()])
  registerInterfaceLanguage(language)
  registerCvLibrary(repository, settings, language)
  registerSettings(settings)
  registerPdfExport(language)
  registerPhotoPicker(language)
  registerAppMenu(language)
  createWindow(language)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(language)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
