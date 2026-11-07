import { app, BrowserWindow, ipcMain, Menu, type BaseWindow, type MenuItemConstructorOptions, type WebContents } from 'electron'
import type { HistoryCommand, MenuCommand } from '../shared/api'
import { interfaceLanguageCodes, interfaceLanguages } from '../shared/i18n/languages'
import { appearances, type Appearance } from '../shared/appearance'
import { HELP_URL } from '../shared/links'
import type { AppearanceState } from './appearance'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { requireBoolean } from './ipcArgs'

// Okna (według id webContents), w których jest otwarty edytor CV – zgłasza je renderer.
// Wartość odpina nasłuchiwanie zamknięcia i przeładowania okna i usuwa flagę.
const activeEditors = new Map<number, () => void>()

// Menu aplikacji w języku interfejsu, przebudowywane przy zmianie języka i wyglądu (zaznaczenie radio).
// Cofnij / Ponów w edytorze CV działają na historii CV (jak Cmd+Z w edytorze), a poza edytorem jak zwykłe
// cofanie pola tekstowego.
export function registerAppMenu(language: InterfaceLanguageState, appearance: AppearanceState): void {
  ipcMain.on('editor:active', (event, active: unknown) => {
    if (requireBoolean(active)) trackEditor(event.sender)
    else activeEditors.get(event.sender.id)?.()
  })
  const build = () => {
    app.setAboutPanelOptions(aboutPanelOptions(language.dictionary().appName))
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(language, appearance)))
  }
  language.onChange(build)
  appearance.onChange(build)
  build()
}

// Flaga znika razem z oknem i przy przeładowaniu strony (edytor zgłosi się ponownie po otwarciu).
function trackEditor(contents: WebContents) {
  if (activeEditors.has(contents.id)) return
  const id = contents.id
  const onNavigation = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
    if (details.isMainFrame && !details.isSameDocument) clear()
  }
  const clear = () => {
    activeEditors.delete(id)
    if (contents.isDestroyed()) return
    contents.off('did-start-navigation', onNavigation)
    contents.off('destroyed', clear)
  }
  contents.on('did-start-navigation', onNavigation)
  contents.once('destroyed', clear)
  activeEditors.set(id, clear)
}

// Panel „O aplikacji”: wersja z `app.getVersion()` (jedno źródło, wzorem ADR-0005). W spakowanej aplikacji pole
// `version` jest pominięte, więc macOS pokazuje numer buildu z Info.plist (`CFBundleVersion`); poza paczką „dev”,
// żeby panel nie pokazywał wersji Electrona. `website` działa tylko na Linuksie – na macOS do pomocy prowadzi menu Pomoc.
function aboutPanelOptions(appName: string): Electron.AboutPanelOptionsOptions {
  return {
    applicationName: appName,
    applicationVersion: app.getVersion(),
    ...(app.isPackaged ? {} : { version: 'dev' }),
    copyright: '© 2026 Michal Staniecko',
    website: HELP_URL
  }
}

// Skrót Cmd+Z obsłużony przez edytor (preventDefault) nie dociera do menu, więc tu trafia tylko kliknięcie
// w menu albo skrót poza edytorem.
function historyCommand(command: HistoryCommand) {
  return (_item: Electron.MenuItem, window: BaseWindow | undefined) => {
    if (!(window instanceof BrowserWindow)) return
    const contents = window.webContents
    if (activeEditors.has(contents.id)) contents.send(`editor:${command}`)
    else contents[command]()
  }
}

// Komenda z menu Plik trafia do okna, z którego kliknięto; obsługuje ją zamontowany ekran renderera.
function menuCommand(command: MenuCommand) {
  return (_item: Electron.MenuItem, window: BaseWindow | undefined) => {
    if (window instanceof BrowserWindow) window.webContents.send('menu:command', command)
  }
}

function menuTemplate(language: InterfaceLanguageState, appearance: AppearanceState): MenuItemConstructorOptions[] {
  const { appName, menu } = language.dictionary()
  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { role: 'about', label: menu.about(appName) },
      { type: 'separator' },
      { role: 'services', label: menu.services },
      { type: 'separator' },
      { role: 'hide', label: menu.hide(appName) },
      { role: 'hideOthers', label: menu.hideOthers },
      { role: 'unhide', label: menu.showAll },
      { type: 'separator' },
      { role: 'quit', label: menu.quit(appName) }
    ]
  }
  const editMenu: MenuItemConstructorOptions = {
    label: menu.edit,
    submenu: [
      { label: menu.undo, accelerator: 'CmdOrCtrl+Z', click: historyCommand('undo') },
      { label: menu.redo, accelerator: 'Shift+CmdOrCtrl+Z', click: historyCommand('redo') },
      { type: 'separator' },
      { role: 'cut', label: menu.cut },
      { role: 'copy', label: menu.copy },
      { role: 'paste', label: menu.paste },
      { role: 'selectAll', label: menu.selectAll }
    ]
  }
  // Pozycje Plik wykonują w rendererze te same akcje co przyciski biblioteki CV i edytora (`menuCommand`).
  const fileMenu: MenuItemConstructorOptions = {
    label: menu.file,
    submenu: [
      { label: menu.newCv, accelerator: 'CmdOrCtrl+N', click: menuCommand('new-cv') },
      { label: menu.addSample, click: menuCommand('add-sample') },
      { label: menu.importCv, accelerator: 'CmdOrCtrl+O', click: menuCommand('import') },
      { type: 'separator' },
      { label: menu.exportJson, click: menuCommand('export-json') },
      { label: menu.exportPdf, accelerator: 'CmdOrCtrl+E', click: menuCommand('export-pdf') },
      { type: 'separator' },
      { role: 'close', label: menu.closeWindow, accelerator: 'CmdOrCtrl+W' }
    ]
  }
  const viewMenu: MenuItemConstructorOptions = {
    label: menu.view,
    submenu: [{ role: 'togglefullscreen', label: menu.toggleFullScreen }]
  }
  // Rola `windowMenu` czyni z niego systemowe menu okien: macOS dopisuje listę otwartych okien.
  const windowMenu: MenuItemConstructorOptions = {
    label: menu.window,
    role: 'windowMenu',
    submenu: [
      { role: 'minimize', label: menu.minimize },
      { role: 'zoom', label: menu.zoom },
      { type: 'separator' },
      { role: 'front', label: menu.bringAllToFront }
    ]
  }
  // Language (etykieta dwujęzyczna, np. „Sprache / Language”): zaznaczony jest wybór użytkownika (albo System), a nie wynik – np. System przy polskim systemie.
  const languageMenu = preferenceSubmenu({
    label: menu.language,
    values: interfaceLanguageCodes,
    valueLabel: (code) => interfaceLanguages[code].name,
    systemLabel: menu.systemLanguage,
    preference: language.preference(),
    choose: (choice) =>
      language.choose(choice).catch((error: unknown) => console.error('Nie udało się zapisać języka interfejsu', error))
  })
  // Wygląd / Appearance: tak samo wybór użytkownika (albo Systemowy). Błąd zapisu jest logowany w `choose`,
  // a wybór i tak zastosowany.
  const appearanceLabels: Record<Appearance, string> = { light: menu.lightAppearance, dark: menu.darkAppearance }
  const appearanceMenu = preferenceSubmenu({
    label: menu.appearance,
    values: appearances,
    valueLabel: (value) => appearanceLabels[value],
    systemLabel: menu.systemAppearance,
    preference: appearance.preference(),
    choose: (choice) => void appearance.choose(choice)
  })
  return process.platform === 'darwin'
    ? [appMenu, fileMenu, editMenu, viewMenu, languageMenu, appearanceMenu, windowMenu]
    : [fileMenu, editMenu, viewMenu, languageMenu, appearanceMenu, windowMenu]
}

// Podmenu preferencji „wartości + System”: po jednym radio na wartość i radio System zaznaczone, gdy preferencji
// nie ma (`undefined`). Wybór System przekazuje `null`.
function preferenceSubmenu<Value extends string>({
  label,
  values,
  valueLabel,
  systemLabel,
  preference,
  choose
}: {
  label: string
  values: readonly Value[]
  valueLabel: (value: Value) => string
  systemLabel: string
  preference: Value | undefined
  choose: (choice: Value | null) => void
}): MenuItemConstructorOptions {
  return {
    label,
    submenu: [
      ...values.map(
        (value): MenuItemConstructorOptions => ({
          label: valueLabel(value),
          type: 'radio',
          checked: preference === value,
          click: () => choose(value)
        })
      ),
      { label: systemLabel, type: 'radio', checked: preference === undefined, click: () => choose(null) }
    ]
  }
}
