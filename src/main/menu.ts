import { app, BrowserWindow, ipcMain, Menu, shell, type BaseWindow, type MenuItemConstructorOptions } from 'electron'
import type { HistoryCommand, MenuCommand } from '../shared/api'
import { interfaceLanguageCodes, interfaceLanguages } from '../shared/i18n/languages'
import { appearances, type Appearance } from '../shared/appearance'
import { HELP_URL } from '../shared/links'
import type { AppearanceState } from './appearance'
import { isMacAppStore } from './channel'
import { helpMenuItems } from './helpMenu'
import type { InterfaceLanguageState } from './interfaceLanguage'
import { requireAppScreen } from './ipcArgs'
import { enabledMenuCommands } from './menuCommands'
import { currentScreen, isEditorActive, trackScreen } from './screens'

// Menu aplikacji w języku interfejsu, przebudowywane przy zmianie języka, wyglądu (zaznaczenie radio) i ekranu
// (aktywność pozycji menu Plik). Cofnij / Ponów w edytorze CV działają na historii CV (jak Cmd+Z w edytorze),
// a poza edytorem jak zwykłe cofanie pola tekstowego.
export function registerAppMenu(language: InterfaceLanguageState, appearance: AppearanceState): void {
  const build = () => {
    app.setAboutPanelOptions(aboutPanelOptions(language.dictionary().appName))
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(language, appearance)))
  }
  ipcMain.on('menu:screen', (event, screen: unknown) => {
    trackScreen(event.sender, requireAppScreen(screen), build)
    build()
  })
  language.onChange(build)
  appearance.onChange(build)
  build()
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
    if (isEditorActive(contents)) contents.send(`editor:${command}`)
    else contents[command]()
  }
}

// Pozycja menu Plik: aktywna według ekranu okna; komenda trafia do okna, z którego kliknięto, i wykonuje ją
// zamontowany ekran renderera.
function menuCommand(command: MenuCommand, enabled: ReadonlySet<MenuCommand>): MenuItemConstructorOptions {
  return {
    enabled: enabled.has(command),
    click: (_item, window) => {
      if (window instanceof BrowserWindow) window.webContents.send('menu:command', command)
    }
  }
}

function menuTemplate(language: InterfaceLanguageState, appearance: AppearanceState): MenuItemConstructorOptions[] {
  const dictionary = language.dictionary()
  const { appName, menu } = dictionary
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
  // Pozycje Plik wykonują w rendererze te same akcje co przyciski biblioteki CV i edytora. Skróty działają także
  // w polach tekstowych (żadne pole ich nie używa); przy nieaktywnej pozycji skrót nic nie robi.
  const enabled = enabledMenuCommands(currentScreen())
  const fileMenu: MenuItemConstructorOptions = {
    label: menu.file,
    submenu: [
      { label: menu.newCv, accelerator: 'CmdOrCtrl+N', ...menuCommand('new-cv', enabled) },
      { label: menu.addSample, ...menuCommand('add-sample', enabled) },
      { label: menu.importCv, accelerator: 'CmdOrCtrl+O', ...menuCommand('import', enabled) },
      { type: 'separator' },
      { label: menu.exportJson, ...menuCommand('export-json', enabled) },
      { label: menu.exportPdf, accelerator: 'CmdOrCtrl+E', ...menuCommand('export-pdf', enabled) },
      { type: 'separator' },
      { role: 'close', label: menu.closeWindow, accelerator: 'CmdOrCtrl+W' }
    ]
  }
  // Pełny ekran. Jeśli macOS dopisze do menu Widok własną pozycję pełnego ekranu (duplikat), zostaje systemowa,
  // a tę usuwamy. Systemowych pozycji nie widać w `Menu.getApplicationMenu()`, więc e2e tego nie sprawdzi – sprawdza
  // to ręcznie checklista wydania (docs/release-checklist.md, „Menu aplikacji”).
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
      language.choose(choice).catch((error: unknown) => console.error('Failed to save the interface language', error))
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
  // Pomoc: rola `help` daje na macOS systemowe pole wyszukiwania pozycji menu. Pozycje otwierają stałe adresy
  // w przeglądarce prosto z procesu głównego (bez IPC); Sponsor link tylko poza Mac App Store.
  const helpMenu: MenuItemConstructorOptions = {
    label: menu.help,
    role: 'help',
    submenu: helpMenuItems({
      dictionary,
      macAppStore: isMacAppStore(),
      open: (url) =>
        void shell.openExternal(url).catch((error: unknown) => console.error('Nie udało się otworzyć adresu', url, error))
    })
  }
  return process.platform === 'darwin'
    ? [appMenu, fileMenu, editMenu, viewMenu, languageMenu, appearanceMenu, windowMenu, helpMenu]
    : [fileMenu, editMenu, viewMenu, languageMenu, appearanceMenu, windowMenu, helpMenu]
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
