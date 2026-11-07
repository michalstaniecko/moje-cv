import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { sampleCvs } from '../renderer/src/domain/sampleCv'
import { en } from '../shared/i18n/en'
import { createAppearance, windowBackground } from './appearance'
import { createWindowStateKeeper, type InitialWindowState, type WindowStateKeeper } from './appWindowState'
import { isMacAppStore } from './channel'
import { guardUnsavedChanges } from './closeGuard'
import { reloadAfterRendererCrash, reportMainProcessErrors } from './crashHandling'
import { createCvRepository } from './cvRepository'
import { registerCvLibrary } from './cvLibrary'
import { createInterfaceLanguage, registerInterfaceLanguage, type InterfaceLanguageState } from './interfaceLanguage'
import { registerAppInfo } from './appInfo'
import { registerAppMenu } from './menu'
import { registerPdfExport } from './pdfExport'
import { registerPhotoPicker } from './photo'
import { registerSettings } from './settings'
import { createSettingsRepository } from './settingsRepository'
import { registerSponsor } from './sponsor'
import { registerUpdates } from './updates'
import { loadAppWindow, lockNavigation, secureWebPreferences } from './windows'
import { MIN_WINDOW_SIZE } from './windowState'

// Testy e2e (`MOJE_CV_E2E_HIDDEN=1`) uruchamiają aplikację w tle: bez ikony w Docku, z przezroczystym oknem
// pokazanym bez fokusu i przepuszczającym kliknięcia myszy, żeby nie przeszkadzać w pracy na komputerze. Okno
// pozostaje „widoczne” dla Electrona, więc renderer nie jest dławiony, a Playwright steruje nim przez CDP.
const hiddenForTests = process.env['MOJE_CV_E2E_HIDDEN'] === '1'

// Język interfejsu jest znany dopiero po starcie; wcześniejsze błędy procesu głównego dostają tekst angielski.
let interfaceLanguage: InterfaceLanguageState | undefined
reportMainProcessErrors(() => interfaceLanguage?.dictionary() ?? en)

// Okno aplikacji. Proces główny trzyma do niego referencję, bo `BrowserWindow.getAllWindows()` zwraca też ukryte
// okna wydruku PDF.
let mainWindow: BrowserWindow | null = null

// Tytuł okna to nazwa aplikacji ze słownika; renderer ustawia go także w dokumencie przy zmianie języka.
// Tło okna równe tłu aplikacji w bieżącym wyglądzie, żeby przy starcie nie było błysku innej barwy.
// Okno otwiera się w zapamiętanym rozmiarze i miejscu (albo w domyślnym) i nie da się go zmniejszyć poniżej minimum.
function createWindow(language: InterfaceLanguageState, windowState: WindowStateKeeper, initial: InitialWindowState): void {
  const window = (mainWindow = new BrowserWindow({
    ...initial.bounds,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    title: language.dictionary().appName,
    show: false,
    backgroundColor: windowBackground(),
    webPreferences: secureWebPreferences,
    ...(hiddenForTests && { opacity: 0 })
  }))

  window.once('ready-to-show', () => {
    if (hiddenForTests) window.setIgnoreMouseEvents(true)
    if (initial.maximized) window.maximize()
    showWindow(window)
  })
  windowState.track(window)
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  reloadAfterRendererCrash(window, language.dictionary)
  guardUnsavedChanges(window, language.dictionary)
  loadAppWindow(window)
}

// W testach e2e okno wychodzi na wierzch bez zabierania fokusu.
function showWindow(window: BrowserWindow): void {
  if (hiddenForTests) return window.showInactive()
  window.show()
  window.focus()
}

// Folder danych przypięty do „Moje CV” niezależnie od `productName`, żeby zmiana nazwy aplikacji nie przenosiła danych
// (ADR-0003). `--user-data-dir` (testy e2e) ma pierwszeństwo.
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', join(app.getPath('appData'), 'Moje CV'))

// Jedna instancja aplikacji na folder danych: dwie kopie pisałyby równolegle do tych samych CV i ustawień. Blokada
// (Chromium `ProcessSingleton`) leży w folderze danych, więc musi być zakładana po jego ustawieniu. Druga kopia kończy
// się od razu, bez okna i bez Sample CV, a działająca wychodzi na wierzch.
const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) app.quit()

app.on('web-contents-created', (_event, contents) => lockNavigation(contents))

app.whenReady().then(async () => {
  if (!primaryInstance) return
  if (hiddenForTests) app.dock?.hide()
  const repository = createCvRepository(join(app.getPath('userData'), 'cvs'))
  const settings = createSettingsRepository(join(app.getPath('userData'), 'settings.json'))
  // Wygląd przed pierwszym oknem, żeby pierwsze malowanie i tło okna były już we właściwej palecie.
  const appearance = await createAppearance(settings)
  const language = (interfaceLanguage = await createInterfaceLanguage(settings))
  await repository.addSampleOnFirstRun(sampleCvs[language.current()])
  registerInterfaceLanguage(language)
  registerCvLibrary(repository, settings, language)
  registerSettings(settings)
  registerPdfExport(language)
  registerPhotoPicker(language)
  registerSponsor()
  // Ta sama reguła kanału co Sponsor bar i menu Pomoc: w Mac App Store bez żadnego ruchu sieciowego (ADR-0006).
  const updates = registerUpdates({ language, settings, macAppStore: isMacAppStore() })
  registerAppMenu(language, appearance, updates.checkForUpdates)
  registerAppInfo()
  const windowState = createWindowStateKeeper(settings)
  const openWindow = async () => createWindow(language, windowState, await windowState.initial())
  await openWindow()

  app.on('activate', () => {
    if (!mainWindow) void openWindow()
  })
  // Ponowne uruchomienie (np. `open -n`, z terminala) pokazuje działające okno, przywrócone, jeśli było
  // zminimalizowane; na macOS po zamknięciu okna otwiera nowe.
  app.on('second-instance', () => {
    if (!mainWindow) return void openWindow()
    if (mainWindow.isMinimized()) mainWindow.restore()
    showWindow(mainWindow)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
