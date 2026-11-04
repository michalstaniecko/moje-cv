import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { sampleCvs } from '../renderer/src/domain/sampleCv'
import { createAppearance, windowBackground } from './appearance'
import { createCvRepository } from './cvRepository'
import { registerCvLibrary } from './cvLibrary'
import { createInterfaceLanguage, registerInterfaceLanguage, type InterfaceLanguageState } from './interfaceLanguage'
import { registerAppMenu } from './menu'
import { registerPdfExport } from './pdfExport'
import { registerPhotoPicker } from './photo'
import { registerSettings } from './settings'
import { createSettingsRepository } from './settingsRepository'
import { registerSponsor } from './sponsor'
import { loadRenderer, secureWebPreferences } from './windows'

// Testy e2e (`MOJE_CV_E2E_HIDDEN=1`) uruchamiają aplikację w tle: bez ikony w Docku, z przezroczystym oknem
// pokazanym bez fokusu i przepuszczającym kliknięcia myszy, żeby nie przeszkadzać w pracy na komputerze. Okno
// pozostaje „widoczne” dla Electrona, więc renderer nie jest dławiony, a Playwright steruje nim przez CDP.
const hiddenForTests = process.env['MOJE_CV_E2E_HIDDEN'] === '1'

// Tytuł okna to nazwa aplikacji ze słownika; renderer ustawia go także w dokumencie przy zmianie języka.
// Tło okna równe tłu aplikacji w bieżącym wyglądzie, żeby przy starcie nie było błysku innej barwy.
function createWindow(language: InterfaceLanguageState): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    title: language.dictionary().appName,
    show: false,
    backgroundColor: windowBackground(),
    webPreferences: secureWebPreferences,
    ...(hiddenForTests && { opacity: 0 })
  })

  window.once('ready-to-show', () => {
    if (!hiddenForTests) return window.show()
    window.setIgnoreMouseEvents(true)
    window.showInactive()
  })
  void loadRenderer(window)
}

// Folder danych przypięty do „Moje CV” niezależnie od `productName`, żeby zmiana nazwy aplikacji nie przenosiła danych
// (ADR-0003). `--user-data-dir` (testy e2e) ma pierwszeństwo.
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', join(app.getPath('appData'), 'Moje CV'))

app.whenReady().then(async () => {
  if (hiddenForTests) app.dock?.hide()
  const repository = createCvRepository(join(app.getPath('userData'), 'cvs'))
  const settings = createSettingsRepository(join(app.getPath('userData'), 'settings.json'))
  // Wygląd przed pierwszym oknem, żeby pierwsze malowanie i tło okna były już we właściwej palecie.
  const appearance = await createAppearance(settings)
  const language = await createInterfaceLanguage(settings)
  await repository.addSampleOnFirstRun(sampleCvs[language.current()])
  registerInterfaceLanguage(language)
  registerCvLibrary(repository, settings, language)
  registerSettings(settings)
  registerPdfExport(language)
  registerPhotoPicker(language)
  registerAppMenu(language, appearance)
  registerSponsor()
  createWindow(language)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(language)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
